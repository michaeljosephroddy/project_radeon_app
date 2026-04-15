import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue, useAnimatedStyle,
    withTiming, withSpring, runOnJS, Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { Colors, Typography, Spacing, Radii } from '../utils/theme';
import type * as api from '../api/client';

interface ConnectionSheetProps {
    visible: boolean;
    connection: api.Connection | null;
    onClose: () => void;
    onMessage: (conn: api.Connection) => void;
}

export function ConnectionSheet({ visible, connection, onClose, onMessage }: ConnectionSheetProps) {
    const insets = useSafeAreaInsets();
    const sheetHeight = useSharedValue(600);
    const translateY = useSharedValue(600);
    const opacity = useSharedValue(0);

    const slideOut = (onDone?: () => void) => {
        'worklet';
        translateY.value = withTiming(sheetHeight.value, { duration: 280, easing: Easing.in(Easing.quad) });
        opacity.value = withTiming(0, { duration: 200 }, onDone
            ? (finished) => { 'worklet'; if (finished) runOnJS(onDone)(); }
            : undefined,
        );
    };

    useEffect(() => {
        if (visible) {
            translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
            opacity.value = withTiming(1, { duration: 250 });
        } else {
            slideOut();
        }
    }, [visible]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const dismiss = () => {
        slideOut(onClose);
    };

    const panGesture = Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetY(-5)
        .onUpdate((e) => {
            if (e.translationY > 0) translateY.value = e.translationY;
        })
        .onEnd((e) => {
            if (e.translationY > 80 || e.velocityY > 500) {
                slideOut(onClose);
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
            }
        });

    if (!connection) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={dismiss}>
            <Animated.View style={[styles.backdrop, backdropStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
            </Animated.View>

            <GestureHandlerRootView style={styles.gestureRoot}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View
                        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}
                        onLayout={(e) => { sheetHeight.value = e.nativeEvent.layout.height; }}
                    >

                        <View style={styles.handleArea}>
                            <View style={styles.handle} />
                        </View>

                        {/* Profile */}
                        <View style={styles.profile}>
                            <Avatar
                                firstName={connection.first_name}
                                lastName={connection.last_name}
                                size={64}
                                fontSize={22}
                            />
                            <Text style={styles.name}>
                                {connection.first_name} {connection.last_name}
                            </Text>
                            {connection.city && (
                                <Text style={styles.city}>{connection.city}</Text>
                            )}
                        </View>

                        {/* Message button */}
                        <TouchableOpacity
                            style={styles.messageBtn}
                            onPress={() => onMessage(connection)}
                        >
                            <Text style={styles.messageBtnText}>Send message</Text>
                        </TouchableOpacity>

                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    gestureRoot: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    sheet: {
        backgroundColor: Colors.light.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 16,
    },
    handleArea: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.light.border,
    },
    profile: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 6,
    },
    name: {
        fontSize: Typography.sizes.lg,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        marginTop: 4,
    },
    city: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    messageBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    messageBtnText: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: '#fff',
    },
});
