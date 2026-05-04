import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bindAppAlertHandler, type AppAlertButton, type AppAlertPayload } from './appAlert';
import { Colors, ControlSizes, Radius, Spacing, TextStyles } from '../../theme';

interface QueuedAlert extends AppAlertPayload {
    id: number;
}

interface AppPopupProviderProps {
    children: React.ReactNode;
}

const DEFAULT_BUTTON: AppAlertButton = { text: 'OK', style: 'default' };

function resolveButtons(alert: QueuedAlert | null): AppAlertButton[] {
    if (!alert?.buttons || alert.buttons.length === 0) return [DEFAULT_BUTTON];
    return alert.buttons;
}

export function AppPopupProvider({ children }: AppPopupProviderProps): React.ReactElement {
    const [activeAlert, setActiveAlert] = useState<QueuedAlert | null>(null);
    const [queue, setQueue] = useState<QueuedAlert[]>([]);
    const nextIDRef = useRef(1);

    useEffect(() => (
        bindAppAlertHandler((payload) => {
            const id = nextIDRef.current;
            nextIDRef.current += 1;
            setQueue((current) => [...current, { ...payload, id }]);
        })
    ), []);

    useEffect(() => {
        if (activeAlert || queue.length === 0) return;
        const [next, ...rest] = queue;
        setActiveAlert(next);
        setQueue(rest);
    }, [activeAlert, queue]);

    const buttons = useMemo(() => resolveButtons(activeAlert), [activeAlert]);
    const hasDestructiveAction = buttons.some((button) => button.style === 'destructive');
    const iconName: keyof typeof Ionicons.glyphMap = hasDestructiveAction ? 'warning-outline' : 'information-circle-outline';
    const iconColor = hasDestructiveAction ? Colors.danger : Colors.primary;

    const dismissAlert = (button?: AppAlertButton): void => {
        const currentAlert = activeAlert;
        setActiveAlert(null);
        try {
            button?.onPress?.();
        } finally {
            currentAlert?.options?.onDismiss?.();
        }
    };

    const canDismissViaBackdrop = activeAlert?.options?.cancelable ?? (buttons.length <= 1);

    return (
        <>
            {children}
            <Modal
                visible={activeAlert !== null}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    if (canDismissViaBackdrop) dismissAlert();
                }}
            >
                <View style={styles.backdrop}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => {
                            if (canDismissViaBackdrop) dismissAlert();
                        }}
                    />
                    <View style={styles.dialog}>
                        <View style={styles.iconWrap}>
                            <Ionicons name={iconName} size={22} color={iconColor} />
                        </View>
                        <Text style={styles.title}>{activeAlert?.title ?? ''}</Text>
                        {activeAlert?.message ? <Text style={styles.message}>{activeAlert.message}</Text> : null}
                        <View style={styles.actions}>
                            {buttons.map((button, index) => {
                                const style = button.style ?? 'default';
                                return (
                                    <Pressable
                                        key={`${button.text ?? 'action'}-${index}`}
                                        style={[
                                            styles.actionButton,
                                            style === 'cancel' && styles.actionButtonSecondary,
                                            style === 'destructive' && styles.actionButtonDestructive,
                                        ]}
                                        onPress={() => dismissAlert(button)}
                                    >
                                        <Text
                                            style={[
                                                styles.actionText,
                                                style === 'cancel' && styles.actionTextSecondary,
                                                style === 'destructive' && styles.actionTextDestructive,
                                            ]}
                                        >
                                            {button.text ?? 'OK'}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(11,16,28,0.45)',
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialog: {
        width: '100%',
        maxWidth: 380,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.default,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.page,
        borderWidth: 1,
        borderColor: Colors.border.default,
    },
    title: {
        ...TextStyles.sectionTitle,
    },
    message: {
        ...TextStyles.secondary,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    actionButton: {
        minHeight: ControlSizes.buttonMinHeight,
        minWidth: 84,
        borderRadius: Radius.sm,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
    },
    actionButtonSecondary: {
        backgroundColor: Colors.bg.page,
        borderWidth: 1,
        borderColor: Colors.border.default,
    },
    actionButtonDestructive: {
        backgroundColor: Colors.danger,
    },
    actionText: {
        ...TextStyles.button,
    },
    actionTextSecondary: {
        color: Colors.text.primary,
    },
    actionTextDestructive: {
        color: Colors.textOn.primary,
    },
});
