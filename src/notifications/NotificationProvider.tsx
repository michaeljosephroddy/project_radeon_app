import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as api from '../api/client';
import { useAuth } from '../hooks/useAuth';

type NotificationIntent =
    | { kind: 'chat'; chatId: string; notificationId?: string }
    | { kind: 'mention'; postId: string; commentId?: string; notificationId?: string };

interface NotificationContextValue {
    intent: NotificationIntent | null;
    consumeIntent: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [intent, setIntent] = useState<NotificationIntent | null>(null);
    const registrationAttemptedRef = useRef(false);

    const consumeIntent = useCallback(() => {
        setIntent(null);
    }, []);

    useEffect(() => {
        if (!isAuthenticated || registrationAttemptedRef.current) return;
        registrationAttemptedRef.current = true;

        void (async () => {
            try {
                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('default', {
                        name: 'default',
                        importance: Notifications.AndroidImportance.MAX,
                    });
                }

                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;
                if (existingStatus !== 'granted') {
                    const permission = await Notifications.requestPermissionsAsync();
                    finalStatus = permission.status;
                }
                if (finalStatus !== 'granted') {
                    Alert.alert(
                        'Notifications disabled',
                        Platform.OS === 'android'
                            ? 'If you are on Android 12 or below, the system may not show a permission prompt because notifications are granted by default. On Android 13+, enable notifications for this app in system settings if you previously denied them.'
                            : 'Enable notifications for this app in system settings if you previously denied them.',
                    );
                    return;
                }
                if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

                const projectId = resolveExpoProjectId();
                if (!projectId) {
                    Alert.alert(
                        'Notifications unavailable',
                        'Set EXPO_PUBLIC_EAS_PROJECT_ID in .env or add extra.eas.projectId to the Expo config so the app can request an Expo push token.',
                    );
                    return;
                }

                const token = await Notifications.getExpoPushTokenAsync({ projectId });
                await api.registerPushDevice({
                    push_token: token.data,
                    platform: Platform.OS,
                });
            } catch (error: unknown) {
                console.warn('Notification registration failed', error);
            }
        })();
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) {
            registrationAttemptedRef.current = false;
            setIntent(null);
            return;
        }

        const applyResponse = async (response: Notifications.NotificationResponse | null) => {
            const nextIntent = toIntent(response);
            if (!nextIntent) return;
            setIntent(nextIntent);
            if (nextIntent.notificationId) {
                try {
                    await api.markNotificationRead(nextIntent.notificationId);
                } catch {
                    // Ignore read-state failures; navigation should still proceed.
                }
            }
        };

        void Notifications.getLastNotificationResponseAsync().then(applyResponse).catch(() => {});
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            void applyResponse(response);
        });

        return () => {
            subscription.remove();
        };
    }, [isAuthenticated]);

    const value = useMemo(() => ({
        intent,
        consumeIntent,
    }), [consumeIntent, intent]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotificationIntent() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotificationIntent must be used within NotificationProvider');
    return ctx;
}

function toIntent(response: Notifications.NotificationResponse | null): NotificationIntent | null {
    const data = response?.notification.request.content.data;
    if (!data || typeof data !== 'object') return null;

    const type = readString(data, 'type');
    const notificationId = readString(data, 'notification_id');
    if (type === 'chat.message') {
        const chatId = readString(data, 'chat_id');
        if (!chatId) return null;
        return { kind: 'chat', chatId, notificationId: notificationId ?? undefined };
    }
    if (type === 'comment.mention') {
        const postId = readString(data, 'post_id');
        if (!postId) return null;
        return {
            kind: 'mention',
            postId,
            commentId: readString(data, 'comment_id') ?? undefined,
            notificationId: notificationId ?? undefined,
        };
    }
    return null;
}

function readString(data: Record<string, unknown>, key: string): string | null {
    const value = data[key];
    return typeof value === 'string' && value.trim() ? value : null;
}

function resolveExpoProjectId(): string | null {
    const expoConfigProjectId = readNestedString(Constants.expoConfig, ['extra', 'eas', 'projectId']);
    if (expoConfigProjectId) return expoConfigProjectId;

    const easConfigProjectId = readNestedString(Constants.easConfig, ['projectId']);
    if (easConfigProjectId) return easConfigProjectId;

    const envProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    return typeof envProjectId === 'string' && envProjectId.trim() ? envProjectId : null;
}

function readNestedString(source: unknown, path: string[]): string | null {
    let current: unknown = source;
    for (const key of path) {
        if (!current || typeof current !== 'object' || !(key in current)) return null;
        current = (current as Record<string, unknown>)[key];
    }

    return typeof current === 'string' && current.trim() ? current : null;
}
