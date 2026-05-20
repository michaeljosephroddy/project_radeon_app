import React, { useEffect } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    type AnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Avatar } from '../Avatar';
import { DiscoverEmptyState } from './DiscoverEmptyState';
import * as api from '../../api/client';
import { getRecoveryMilestone } from '../../utils/date';
import { formatUsername } from '../../utils/identity';
import { Colors, Radius, Spacing, TextStyles, Typography, getAvatarColors } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.24;
const SWIPE_EXIT_DISTANCE = SCREEN_WIDTH * 1.2;
const SWIPE_EXIT_DURATION_MS = 240;
const DECK_CARD_HEIGHT = Math.round(Math.min(680, Math.max(420, SCREEN_HEIGHT * 0.62)));

interface DatingDeckProps {
    users: api.User[];
    loading: boolean;
    fetchingNext: boolean;
    emptyTitle: string;
    emptyDescription: string;
    onLike: (user: api.User) => void;
    onPass: (user: api.User) => void;
    onOpenProfile: (user: api.User) => void;
    onLoadMore: () => void;
}

function DatingProfileCard({
    user,
    onPress,
    likeLabelStyle,
    passLabelStyle,
}: {
    user: api.User;
    onPress: () => void;
    likeLabelStyle: AnimatedStyle<object>;
    passLabelStyle: AnimatedStyle<object>;
}) {
    const avatarColors = getAvatarColors(user.username);
    const milestone = getRecoveryMilestone(user.sober_since);
    const locationLabel = user.city
        ? `${user.city}${user.country ? `, ${user.country}` : ''}`
        : user.country ?? null;
    const metaLabel = [milestone?.currentLabel, locationLabel].filter(Boolean).join(' · ');
    const interests = user.interests.slice(0, 4);

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.94}
            accessibilityRole="button"
            accessibilityLabel={`View ${formatUsername(user.username)} profile`}
        >
            {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: avatarColors.bg }]} />
            )}
            {!user.avatar_url ? (
                <View style={styles.avatarFallback}>
                    <Avatar username={user.username} avatarUrl={user.avatar_url} size={112} fontSize={36} />
                </View>
            ) : null}

            <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.82)']}
                locations={[0, 0.48, 1]}
                style={styles.cardScrim}
            />
            <Animated.View style={[styles.swipeLabel, styles.passLabel, passLabelStyle]} pointerEvents="none">
                <Text style={[styles.swipeLabelText, styles.passLabelText]}>PASS</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeLabel, styles.likeLabel, likeLabelStyle]} pointerEvents="none">
                <Text style={[styles.swipeLabelText, styles.likeLabelText]}>LIKE</Text>
            </Animated.View>
            <View style={styles.cardOverlay}>
                <Text style={styles.name} numberOfLines={1}>{formatUsername(user.username)}</Text>
                {metaLabel ? <Text style={styles.meta} numberOfLines={1}>{metaLabel}</Text> : null}
                {user.bio ? <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text> : null}
                {interests.length ? (
                    <View style={styles.interestRow}>
                        {interests.map((interest) => (
                            <View key={interest} style={styles.interestChip}>
                                <Text style={styles.interestText} numberOfLines={1}>{interest}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

export function DatingDeck({
    users,
    loading,
    fetchingNext,
    emptyTitle,
    emptyDescription,
    onLike,
    onPass,
    onOpenProfile,
    onLoadMore,
}: DatingDeckProps) {
    const insets = useSafeAreaInsets();
    const translateX = useSharedValue(0);
    const isDismissing = useSharedValue(false);
    const activeUser = users[0];
    const bottomPadding = Math.max(Math.min(insets.bottom, Spacing.lg), Spacing.md);

    useEffect(() => {
        if (users.length <= 2 && !fetchingNext) {
            onLoadMore();
        }
    }, [fetchingNext, onLoadMore, users.length]);

    useEffect(() => {
        translateX.value = 0;
        isDismissing.value = false;
    }, [activeUser?.id, isDismissing, translateX]);

    const triggerPass = (): void => {
        if (activeUser) onPass(activeUser);
    };

    const triggerLike = (): void => {
        if (activeUser) onLike(activeUser);
    };

    const gesture = Gesture.Pan()
        .onUpdate((event) => {
            if (isDismissing.value) return;
            translateX.value = event.translationX;
        })
        .onEnd((event) => {
            if (isDismissing.value) return;
            if (event.translationX > SWIPE_THRESHOLD) {
                isDismissing.value = true;
                translateX.value = withTiming(
                    SWIPE_EXIT_DISTANCE,
                    { duration: SWIPE_EXIT_DURATION_MS, easing: Easing.out(Easing.cubic) },
                    (finished) => {
                        if (finished) {
                            runOnJS(triggerLike)();
                        }
                    },
                );
                return;
            }
            if (event.translationX < -SWIPE_THRESHOLD) {
                isDismissing.value = true;
                translateX.value = withTiming(
                    -SWIPE_EXIT_DISTANCE,
                    { duration: SWIPE_EXIT_DURATION_MS, easing: Easing.out(Easing.cubic) },
                    (finished) => {
                        if (finished) {
                            runOnJS(triggerPass)();
                        }
                    },
                );
                return;
            }
            translateX.value = withSpring(0);
        });

    const cardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            {
                rotate: `${interpolate(
                    translateX.value,
                    [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                    [-10, 0, 10],
                    Extrapolation.CLAMP,
                )}deg`,
            },
        ],
    }));
    const likeLabelStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateX.value,
            [0, SWIPE_THRESHOLD * 0.7],
            [0, 1],
            Extrapolation.CLAMP,
        ),
        transform: [
            { rotate: '10deg' },
            {
                scale: interpolate(
                    translateX.value,
                    [0, SWIPE_THRESHOLD],
                    [0.92, 1],
                    Extrapolation.CLAMP,
                ),
            },
        ],
    }));
    const passLabelStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateX.value,
            [-SWIPE_THRESHOLD * 0.7, 0],
            [1, 0],
            Extrapolation.CLAMP,
        ),
        transform: [
            { rotate: '-10deg' },
            {
                scale: interpolate(
                    translateX.value,
                    [-SWIPE_THRESHOLD, 0],
                    [1, 0.92],
                    Extrapolation.CLAMP,
                ),
            },
        ],
    }));

    if (loading && users.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={Colors.primary} size="large" />
            </View>
        );
    }

    if (!activeUser) {
        return (
            <DiscoverEmptyState
                title={emptyTitle}
                description={emptyDescription}
            />
        );
    }

    return (
        <View style={[styles.container, { paddingBottom: bottomPadding }]}>
            <GestureDetector gesture={gesture}>
                <Animated.View style={[styles.cardWrap, cardStyle]}>
                    <DatingProfileCard
                        user={activeUser}
                        onPress={() => onOpenProfile(activeUser)}
                        likeLabelStyle={likeLabelStyle}
                        passLabelStyle={passLabelStyle}
                    />
                </Animated.View>
            </GestureDetector>

            {fetchingNext ? (
                <ActivityIndicator color={Colors.primary} style={styles.footerLoader} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: Spacing.md,
        paddingTop: 0,
        gap: Spacing.sm,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardWrap: {
        flex: 1,
        minHeight: 0,
        maxHeight: DECK_CARD_HEIGHT,
    },
    card: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    avatarFallback: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardScrim: {
        ...StyleSheet.absoluteFillObject,
    },
    swipeLabel: {
        position: 'absolute',
        top: Spacing.xl,
        borderWidth: 3,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: 'rgba(0,0,0,0.26)',
    },
    passLabel: {
        left: Spacing.lg,
        borderColor: Colors.danger,
    },
    likeLabel: {
        right: Spacing.lg,
        borderColor: Colors.primary,
    },
    swipeLabelText: {
        fontSize: Typography.sizes.xl,
        fontWeight: '800',
        letterSpacing: 0,
    },
    passLabelText: {
        color: Colors.danger,
    },
    likeLabelText: {
        color: Colors.primary,
    },
    cardOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.lg,
        gap: Spacing.xs,
    },
    name: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    meta: {
        ...TextStyles.secondary,
        color: Colors.text.primary,
    },
    bio: {
        ...TextStyles.body,
        lineHeight: 21,
        color: Colors.text.secondary,
    },
    interestRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        paddingTop: Spacing.sm,
    },
    interestChip: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        backgroundColor: 'rgba(0,0,0,0.38)',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 5,
        maxWidth: '48%',
    },
    interestText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    footerLoader: {
        marginTop: -Spacing.sm,
    },
});
