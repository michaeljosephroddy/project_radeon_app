declare module 'expo-notifications' {
    export interface NotificationResponse {
        notification: {
            date?: number;
            request: {
                content: {
                    data: Record<string, unknown>;
                };
            };
        };
    }

    export interface PermissionResponse {
        status: 'granted' | 'denied' | 'undetermined';
    }

    export interface ExpoPushToken {
        data: string;
    }

    export interface ExpoPushTokenOptions {
        projectId: string;
    }

    export interface Subscription {
        remove: () => void;
    }

    export interface NotificationBehavior {
        shouldShowBanner: boolean;
        shouldShowList: boolean;
        shouldPlaySound: boolean;
        shouldSetBadge: boolean;
    }

    export interface NotificationHandler {
        handleNotification: () => Promise<NotificationBehavior>;
    }

    export const AndroidImportance: {
        MAX: number;
    };

    export function getPermissionsAsync(): Promise<PermissionResponse>;
    export function requestPermissionsAsync(): Promise<PermissionResponse>;
    export function getExpoPushTokenAsync(options?: ExpoPushTokenOptions): Promise<ExpoPushToken>;
    export function setNotificationHandler(handler: NotificationHandler): void;
    export function setNotificationChannelAsync(
        channelId: string,
        channel: {
            name: string;
            importance: number;
        },
    ): Promise<void>;
    export function getLastNotificationResponseAsync(): Promise<NotificationResponse | null>;
    export function clearLastNotificationResponseAsync(): Promise<void>;
    export function addNotificationResponseReceivedListener(
        listener: (response: NotificationResponse) => void,
    ): Subscription;
}
