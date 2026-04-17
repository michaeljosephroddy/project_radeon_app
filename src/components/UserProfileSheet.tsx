import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
    useSharedValue, useAnimatedStyle,
    withTiming, withSpring, runOnJS, Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { Colors, Typography, Spacing, Radii } from '../utils/theme';
import * as api from '../api/client';

interface UserProfileSheetProps {
    visible: boolean;
    userId: string | null;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    isFollowing: boolean;
    onClose: () => void;
    onFollowChange: (userId: string, following: boolean) => void;
}

export function UserProfileSheet({
    visible, userId, firstName, lastName, avatarUrl,
    isFollowing, onClose, onFollowChange,
}: UserProfileSheetProps) {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(600);
    const opacity = useSharedValue(0);

    const [profile, setProfile] = useState<api.User | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    const slideOut = (onDone?: () => void) => {
        translateY.value = withTiming(600, { duration: 280, easing: Easing.in(Easing.quad) });
        opacity.value = withTiming(0, { duration: 200 }, onDone
            ? (finished) => { 'worklet'; if (finished) runOnJS(onDone)(); }
            : undefined,
        );
    };

    useEffect(() => {
        if (visible) {
            translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
            opacity.value = withTiming(1, { duration: 250 });
            if (userId) {
                setProfile(null);
                setLoadingProfile(true);
                api.getUser(userId)
                    .then(setProfile)
                    .catch(() => {})
                    .finally(() => setLoadingProfile(false));
            }
        } else {
            translateY.value = 600;
            opacity.value = 0;
            setProfile(null);
        }
    }, [visible, userId]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const dismiss = () => slideOut(onClose);

    const panGesture = Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetY(-5)
        .onUpdate(e => {
            if (e.translationY > 0) translateY.value = e.translationY;
        })
        .onEnd(e => {
            if (e.translationY > 80 || e.velocityY > 500) {
                runOnJS(slideOut)(onClose);
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
            }
        });

    const handleFollow = async () => {
        if (!userId) return;
        setFollowLoading(true);
        const next = !isFollowing;
        onFollowChange(userId, next);
        try {
            if (next) {
                await api.followUser(userId);
            } else {
                await api.unfollowUser(userId);
            }
        } catch {
            onFollowChange(userId, !next);
        } finally {
            setFollowLoading(false);
        }
    };

    if (!visible && !userId) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={dismiss}>
            <Animated.View style={[styles.backdrop, backdropStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
            </Animated.View>

            <GestureDetector gesture={panGesture}>
                <Animated.View
                    style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}
                >
                    <View style={styles.handleArea}>
                        <View style={styles.handle} />
                    </View>

                    <View style={styles.profile}>
                        <Avatar
                            firstName={firstName}
                            lastName={lastName}
                            avatarUrl={avatarUrl}
                            size={64}
                            fontSize={22}
                        />
                        <Text style={styles.name}>{firstName} {lastName}</Text>

                        {loadingProfile ? (
                            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 4 }} />
                        ) : (
                            <>
                                {profile?.city && <Text style={styles.meta}>{profile.city}</Text>}
                                {profile?.sober_since && (
                                    <Text style={styles.meta}>Sober since {profile.sober_since}</Text>
                                )}
                                {(profile?.interests?.length ?? 0) > 0 && (
                                    <View style={styles.interests}>
                                        {profile!.interests.slice(0, 5).map(interest => (
                                            <View key={interest} style={styles.interestPill}>
                                                <Text style={styles.interestPillText}>{interest}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.followBtn, isFollowing && styles.followingBtn, followLoading && { opacity: 0.6 }]}
                        onPress={handleFollow}
                        disabled={followLoading || !userId}
                    >
                        <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                            {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </GestureDetector>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
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
    handleArea: { paddingVertical: 12, alignItems: 'center' },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.light.border },

    profile: { alignItems: 'center', paddingVertical: Spacing.md, gap: 6 },
    name: { fontSize: Typography.sizes.lg, fontWeight: '600', color: Colors.light.textPrimary, marginTop: 4 },
    meta: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },

    interests: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center', marginTop: 4 },
    interestPill: {
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.light.border,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    interestPillText: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary },

    followBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    followingBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: Colors.light.border,
    },
    followBtnText: { fontSize: Typography.sizes.base, fontWeight: '600', color: '#FFFFFF' },
    followingBtnText: { color: Colors.light.textSecondary },
});
