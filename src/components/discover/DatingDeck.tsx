import React, { useEffect } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    type GestureResponderEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { DiscoverEmptyState } from './DiscoverEmptyState';
import { DatingPhotoCarousel } from './DatingPhotoCarousel';
import * as api from '../../api/client';
import { formatUsername } from '../../utils/identity';
import { Colors, IconSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.24;
const SWIPE_EXIT_DISTANCE = SCREEN_WIDTH * 1.2;
const SWIPE_EXIT_DURATION_MS = 240;
const DECK_CARD_HEIGHT = Math.round(Math.min(680, Math.max(420, SCREEN_HEIGHT * 0.62)));

function relationshipGoalLabel(goal: api.DatingRelationshipGoal): string | null {
    switch (goal) {
        case 'long_term':
            return 'Long-term relationship';
        case 'life_partner':
            return 'Life partner';
        case 'short_term_open_to_long_term':
        case 'casual':
            return 'Short-term, open to long-term';
        case 'still_figuring_it_out':
        case 'open_to_explore':
            return 'Still figuring it out';
        case 'new_sober_connections':
            return 'New sober connections';
        default:
            return null;
    }
}

interface DatingDeckProps {
    profiles: api.DatingProfile[];
    loading: boolean;
    fetchingNext: boolean;
    emptyTitle: string;
    emptyDescription: string;
    onLike: (profile: api.DatingProfile) => void;
    onPass: (profile: api.DatingProfile) => void;
    onOpenProfile: (profile: api.DatingProfile) => void;
    onLoadMore: () => void;
}

function DatingProfileCard({
    profile,
    onPress,
    onPassPress,
    onConnectPress,
    likeLabelStyle,
    passLabelStyle,
}: {
    profile: api.DatingProfile;
    onPress: () => void;
    onPassPress: () => void;
    onConnectPress: () => void;
    likeLabelStyle: AnimatedStyle<object>;
    passLabelStyle: AnimatedStyle<object>;
}) {
    const profilePhotos = profile.photos ?? [];
    const locationLabel = profile.city
        ? `${profile.city}${profile.country ? `, ${profile.country}` : ''}`
        : profile.country ?? null;
    const nameLabel = profile.age ? `${formatUsername(profile.username)}, ${profile.age}` : formatUsername(profile.username);
    const metaLabel = [relationshipGoalLabel(profile.relationship_goal), locationLabel].filter(Boolean).join(' · ');

    const handlePassPress = (event: GestureResponderEvent): void => {
        event.stopPropagation();
        onPassPress();
    };

    const handleConnectPress = (event: GestureResponderEvent): void => {
        event.stopPropagation();
        onConnectPress();
    };

    const handleOpenProfilePress = (event: GestureResponderEvent): void => {
        event.stopPropagation();
        onPress();
    };

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.94}
            accessibilityRole="button"
            accessibilityLabel={`View ${formatUsername(profile.username)} dating profile`}
        >
            <DatingPhotoCarousel
                username={profile.username}
                photos={profilePhotos}
                style={StyleSheet.absoluteFill}
                onPress={onPress}
            />

            <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.82)']}
                locations={[0, 0.48, 1]}
                style={styles.cardScrim}
            />
            <Animated.View style={[styles.swipeLabel, styles.passLabel, passLabelStyle]} pointerEvents="none">
                <Text style={[styles.swipeLabelText, styles.passLabelText]}>PASS</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeLabel, styles.likeLabel, likeLabelStyle]} pointerEvents="none">
                <Text style={[styles.swipeLabelText, styles.likeLabelText]}>CONNECT</Text>
            </Animated.View>
            <View style={styles.cardOverlay}>
                <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{nameLabel}</Text>
                    <TouchableOpacity
                        style={styles.viewProfileButton}
                        onPress={handleOpenProfilePress}
                        activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${formatUsername(profile.username)} dating profile`}
                >
                        <Ionicons name="chevron-up" size={IconSizes.tool} color={Colors.textOn.primary} />
                    </TouchableOpacity>
                </View>
                {metaLabel ? <Text style={styles.meta} numberOfLines={1}>{metaLabel}</Text> : null}
                {profile.bio ? <Text style={styles.meta} numberOfLines={2}>{profile.bio}</Text> : null}
            </View>
            <View style={styles.cardActionRow}>
                <TouchableOpacity
                    style={styles.cardActionButton}
                    onPress={handlePassPress}
                    activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel={`Pass on ${formatUsername(profile.username)}`}
                >
                    <Ionicons name="close" size={IconSizes.hero} color={Colors.danger} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.cardActionButton}
                    onPress={handleConnectPress}
                    activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel={`Connect with ${formatUsername(profile.username)}`}
                >
                    <Ionicons name="heart" size={IconSizes.primaryAction} color={Colors.primary} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}

export function DatingDeck({
    profiles,
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
    const safeProfiles = profiles ?? [];
    const activeProfile = safeProfiles[0];
    const bottomPadding = Math.max(Math.min(insets.bottom, Spacing.lg), Spacing.md);

    useEffect(() => {
        if (safeProfiles.length <= 2 && !fetchingNext) {
            onLoadMore();
        }
    }, [fetchingNext, onLoadMore, safeProfiles.length]);

    useEffect(() => {
        translateX.value = 0;
        isDismissing.value = false;
    }, [activeProfile?.id, isDismissing, translateX]);

    const triggerPass = (): void => {
        if (activeProfile) onPass(activeProfile);
    };

    const triggerLike = (): void => {
        if (activeProfile) onLike(activeProfile);
    };

    const animatePass = (): void => {
        if (!activeProfile || isDismissing.value) return;
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
    };

    const animateLike = (): void => {
        if (!activeProfile || isDismissing.value) return;
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

    if (loading && safeProfiles.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={Colors.primary} size="large" />
            </View>
        );
    }

    if (!activeProfile) {
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
                        profile={activeProfile}
                        onPress={() => onOpenProfile(activeProfile)}
                        onPassPress={animatePass}
                        onConnectPress={animateLike}
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
        left: Spacing.xl,
        borderColor: Colors.danger,
    },
    likeLabel: {
        right: Spacing.xl,
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
        paddingBottom: 92,
        gap: Spacing.xs,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    viewProfileButton: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        backgroundColor: 'rgba(0,0,0,0.48)',
    },
    cardActionRow: {
        position: 'absolute',
        left: Spacing.lg,
        right: Spacing.lg,
        bottom: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xl,
    },
    cardActionButton: {
        width: 58,
        height: 58,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        backgroundColor: 'rgba(0,0,0,0.5)',
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 4,
    },
    name: {
        flex: 1,
        minWidth: 0,
        fontSize: Typography.sizes.xxl,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    meta: {
        ...TextStyles.secondary,
        color: Colors.text.primary,
    },
    footerLoader: {
        marginTop: -Spacing.sm,
    },
});
