import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue, useAnimatedStyle,
    withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { Colors, Typography, Spacing } from '../utils/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface ProfileSheetProps {
    visible: boolean;
    onClose: () => void;
    onLogout: () => void;
    user: { first_name: string; last_name: string; email?: string } | null;
}

const MENU_ITEMS = [
    { icon: '👤', label: 'Edit profile', onPress: () => { } },
    { icon: '🔔', label: 'Notifications', onPress: () => { } },
    { icon: '🔒', label: 'Privacy', onPress: () => { } },
    { icon: '⚙️', label: 'Settings', onPress: () => { } },
];

export function ProfileSheet({ visible, onClose, onLogout, user }: ProfileSheetProps) {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(300);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            translateY.value = withTiming(0, { duration: 250 });
            opacity.value = withTiming(1, { duration: 200 });
        } else {
            translateY.value = withTiming(300, { duration: 200 });
            opacity.value = withTiming(0, { duration: 200 });
        }
    }, [visible]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const dismiss = () => {
        translateY.value = withTiming(300, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () => runOnJS(onClose)());
    };

    const panGesture = Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetY(-5)
        .onUpdate((e) => {
            if (e.translationY > 0) {
                translateY.value = e.translationY;
            }
        })
        .onEnd((e) => {
            if (e.translationY > 80 || e.velocityY > 500) {
                translateY.value = withTiming(300, { duration: 200 });
                opacity.value = withTiming(0, { duration: 200 }, () => runOnJS(onClose)());
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
            }
        });

    const handleLogout = () => {
        translateY.value = withTiming(300, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, (finished) => {
            'worklet';
            if (finished) {
                runOnJS(onClose)();
                runOnJS(onLogout)();
            }
        });
    };
    if (!user) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={dismiss}>
            {/* Backdrop */}
            <Animated.View style={[styles.backdrop, backdropStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
            </Animated.View>

            {/* Sheet */}
            <GestureHandlerRootView>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}>

                        {/* Handle */}
                        <View style={styles.handleArea}>
                            <View style={styles.handle} />
                        </View>

                        {/* User identity */}
                        <View style={styles.identity}>
                            <Avatar
                                firstName={user.first_name}
                                lastName={user.last_name}
                                size={52}
                                fontSize={18}
                            />
                            <View style={styles.identityText}>
                                <Text style={styles.fullName}>
                                    {user.first_name} {user.last_name}
                                </Text>
                                {user.email && (
                                    <Text style={styles.email}>{user.email}</Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Menu items */}
                        {MENU_ITEMS.map((item) => (
                            <TouchableOpacity key={item.label} style={styles.menuRow} onPress={item.onPress}>
                                <Text style={styles.menuIcon}>{item.icon}</Text>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                                <Text style={styles.menuChevron}>›</Text>
                            </TouchableOpacity>
                        ))}

                        <View style={styles.divider} />

                        {/* Logout */}
                        <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
                            <Text style={styles.logoutIcon}>↩</Text>
                            <Text style={styles.logoutLabel}>Log out</Text>
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
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
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
    identity: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingBottom: 18,
    },
    identityText: {
        flex: 1,
    },
    fullName: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    email: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        marginTop: 2,
    },
    divider: {
        height: 0.5,
        backgroundColor: Colors.light.border,
        marginVertical: 6,
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        gap: 12,
    },
    menuIcon: {
        fontSize: 16,
        width: 24,
        textAlign: 'center',
    },
    menuLabel: {
        flex: 1,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textPrimary,
    },
    menuChevron: {
        fontSize: 18,
        color: Colors.light.textTertiary,
        lineHeight: 20,
    },
    logoutRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        gap: 12,
    },
    logoutIcon: {
        fontSize: 16,
        width: 24,
        textAlign: 'center',
    },
    logoutLabel: {
        fontSize: Typography.sizes.sm,
        color: '#D85A30',
        fontWeight: '500',
    },
});
