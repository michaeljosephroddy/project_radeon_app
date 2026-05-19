import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';

export type GlobalCreateActionKey = 'post' | 'support_request' | 'meetup' | 'group';

export interface GlobalCreateAction {
    key: GlobalCreateActionKey;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
}

interface CreateActionSheetProps {
    visible: boolean;
    actions: GlobalCreateAction[];
    onClose: () => void;
}

const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 900;

export function CreateActionSheet({
    visible,
    actions,
    onClose,
}: CreateActionSheetProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(0)).current;
    const isDownwardSheetDrag = (_dx: number, dy: number): boolean => (
        dy > 6 && Math.abs(dy) > Math.abs(_dx)
    );

    useEffect(() => {
        if (visible) {
            translateY.setValue(0);
        }
    }, [translateY, visible]);

    const closeFromDrag = (): void => {
        Animated.timing(translateY, {
            toValue: 420,
            duration: 160,
            useNativeDriver: true,
        }).start(() => onClose());
    };

    const springBack = (): void => {
        Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 220,
        }).start();
    };

    const handleDragRelease = (dy: number, vy: number): void => {
        const shouldDismiss = dy > DISMISS_DISTANCE || vy > DISMISS_VELOCITY / 1000;
        if (shouldDismiss) {
            closeFromDrag();
            return;
        }
        springBack();
    };

    const contentPanResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_event, gestureState) => (
                isDownwardSheetDrag(gestureState.dx, gestureState.dy)
            ),
            onPanResponderMove: (_event, gestureState) => {
                translateY.setValue(Math.max(gestureState.dy, 0));
            },
            onPanResponderRelease: (_event, gestureState) => {
                handleDragRelease(gestureState.dy, gestureState.vy);
            },
            onPanResponderTerminate: () => {
                springBack();
            },
        })
    ).current;

    const headerPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_event, gestureState) => {
                translateY.setValue(Math.max(gestureState.dy, 0));
            },
            onPanResponderRelease: (_event, gestureState) => {
                handleDragRelease(gestureState.dy, gestureState.vy);
            },
            onPanResponderTerminate: () => {
                springBack();
            },
        })
    ).current;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalRoot}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close create menu"
                    style={styles.scrim}
                    onPress={onClose}
                />
                <Animated.View
                    style={[
                        styles.sheet,
                        { paddingBottom: insets.bottom + Spacing.xl },
                        { transform: [{ translateY }] },
                    ]}
                >
                    <View {...headerPanResponder.panHandlers} style={styles.dragHeader}>
                        <View style={styles.handle} />
                        <Text style={styles.title}>Create</Text>
                    </View>
                    <View {...contentPanResponder.panHandlers} style={styles.actionList}>
                        {actions.map((action) => (
                            <Pressable
                                key={action.key}
                                accessibilityRole="button"
                                accessibilityLabel={action.title}
                                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                                onPress={action.onPress}
                            >
                                <View style={styles.iconWrap}>
                                    <Ionicons name={action.icon} size={22} color={Colors.primary} />
                                </View>
                                <View style={styles.actionCopy}>
                                    <Text style={styles.actionTitle}>{action.title}</Text>
                                    <Text style={styles.actionDescription}>{action.description}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={Colors.text.muted} />
                            </Pressable>
                        ))}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.overlay,
    },
    sheet: {
        backgroundColor: Colors.bg.raised,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        zIndex: 1,
    },
    dragHeader: {
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    handle: {
        alignSelf: 'center',
        width: 42,
        height: 4,
        borderRadius: Radius.pill,
        backgroundColor: Colors.border.emphasis,
        marginBottom: Spacing.lg,
    },
    title: {
        ...Typography.screenTitle,
        color: Colors.text.primary,
    },
    actionList: {
        gap: Spacing.sm,
    },
    actionRow: {
        minHeight: 64,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    actionRowPressed: {
        backgroundColor: Colors.bg.hover,
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionCopy: {
        flex: 1,
        gap: 2,
    },
    actionTitle: {
        ...TextStyles.body,
        color: Colors.text.primary,
        fontWeight: '700',
    },
    actionDescription: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
    },
});
