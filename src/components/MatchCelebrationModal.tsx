import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Animated, {
    useSharedValue, useAnimatedStyle,
    withTiming, withSpring, withDelay,
} from 'react-native-reanimated';
import { Avatar } from './Avatar';
import { useAuth } from '../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../utils/theme';
import type * as api from '../api/client';

interface MatchCelebrationModalProps {
    visible: boolean;
    matchedUser: api.ScoredUser | null;
    onMessage: () => void;
    onDismiss: () => void;
}

export function MatchCelebrationModal({ visible, matchedUser, onMessage, onDismiss }: MatchCelebrationModalProps) {
    const { user } = useAuth();

    const overlayOpacity = useSharedValue(0);
    const leftX = useSharedValue(-140);
    const rightX = useSharedValue(140);
    const contentOpacity = useSharedValue(0);
    const contentY = useSharedValue(16);

    useEffect(() => {
        if (visible) {
            overlayOpacity.value = withTiming(1, { duration: 300 });
            leftX.value = withDelay(80, withSpring(0, { damping: 18, stiffness: 180 }));
            rightX.value = withDelay(80, withSpring(0, { damping: 18, stiffness: 180 }));
            contentOpacity.value = withDelay(420, withTiming(1, { duration: 280 }));
            contentY.value = withDelay(420, withSpring(0, { damping: 20, stiffness: 200 }));
        } else {
            overlayOpacity.value = 0;
            leftX.value = -140;
            rightX.value = 140;
            contentOpacity.value = 0;
            contentY.value = 16;
        }
    }, [visible]);

    const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
    const leftAvatarStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftX.value }] }));
    const rightAvatarStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightX.value }] }));
    const contentStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        transform: [{ translateY: contentY.value }],
    }));

    if (!matchedUser || !user) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
            <Animated.View style={[styles.overlay, overlayStyle]}>
                <View style={styles.container}>
                    <Text style={styles.title}>It's a Match!</Text>
                    <Text style={styles.subtitle}>
                        You and {matchedUser.first_name} found each other
                    </Text>

                    <View style={styles.avatarRow}>
                        <Animated.View style={[styles.avatarRing, styles.avatarLeft, leftAvatarStyle]}>
                            <Avatar
                                firstName={user.first_name}
                                lastName={user.last_name}
                                avatarUrl={user.avatar_url}
                                size={96}
                                fontSize={32}
                            />
                        </Animated.View>
                        <Animated.View style={[styles.avatarRing, styles.avatarRight, rightAvatarStyle]}>
                            <Avatar
                                firstName={matchedUser.first_name}
                                lastName={matchedUser.last_name}
                                avatarUrl={matchedUser.avatar_url}
                                size={96}
                                fontSize={32}
                            />
                        </Animated.View>
                    </View>

                    <Animated.View style={[styles.buttons, contentStyle]}>
                        <TouchableOpacity style={styles.messageBtn} onPress={onMessage}>
                            <Text style={styles.messageBtnText}>Send a Message</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
                            <Text style={styles.dismissBtnText}>Keep Swiping</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.88)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        width: '100%',
    },
    title: {
        fontSize: 34,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: Typography.sizes.base,
        color: 'rgba(255,255,255,0.65)',
        textAlign: 'center',
        marginBottom: 52,
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 52,
    },
    avatarRing: {
        width: 104,
        height: 104,
        borderRadius: 52,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLeft: {
        marginRight: -22,
        zIndex: 1,
    },
    avatarRight: {
        zIndex: 2,
    },
    buttons: {
        width: '100%',
        gap: Spacing.md,
    },
    messageBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.md,
        paddingVertical: 16,
        alignItems: 'center',
    },
    messageBtnText: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    dismissBtn: {
        borderRadius: Radii.md,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    dismissBtnText: {
        fontSize: Typography.sizes.base,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.75)',
    },
});
