import React, { useCallback } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../Avatar';
import { DiscoverEmptyState } from './DiscoverEmptyState';
import { ScreenHeader } from '../ui/ScreenHeader';
import * as api from '../../api/client';
import { formatUsername } from '../../utils/identity';
import { Colors, ContentInsets, Radius, Spacing, TextStyles, Typography } from '../../theme';

function relationshipGoalLabel(goal: api.DatingRelationshipGoal): string | null {
    switch (goal) {
        case 'long_term':
            return 'Long-term';
        case 'life_partner':
            return 'Life partner';
        case 'casual':
            return 'Casual';
        case 'open_to_explore':
            return 'Open to explore';
        default:
            return null;
    }
}

interface DatingLikesScreenProps {
    likes: api.DatingProfile[];
    loading: boolean;
    fetchingNext: boolean;
    hasNextPage: boolean;
    pendingActionIds: Set<string>;
    onBack?: () => void;
    onLike: (profile: api.DatingProfile) => void;
    onPass: (profile: api.DatingProfile) => void;
    onOpenProfile: (profile: api.DatingProfile) => void;
    onLoadMore: () => void;
}

export function DatingLikesScreen({
    likes,
    loading,
    fetchingNext,
    hasNextPage,
    pendingActionIds,
    onBack,
    onLike,
    onPass,
    onOpenProfile,
    onLoadMore,
}: DatingLikesScreenProps) {
    const safeLikes = likes ?? [];
    const handleEndReached = useCallback((): void => {
        if (hasNextPage && !fetchingNext) {
            onLoadMore();
        }
    }, [fetchingNext, hasNextPage, onLoadMore]);

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {onBack ? <ScreenHeader title="Liked you" onBack={onBack} /> : null}

            {loading && safeLikes.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                </View>
            ) : safeLikes.length === 0 ? (
                <DiscoverEmptyState
                    title="No likes right now"
                    description="When someone likes you in Dating, they will appear here."
                />
            ) : (
                <FlatList
                    data={safeLikes}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <DatingLikeRow
                            profile={item}
                            pending={pendingActionIds.has(item.id)}
                            onLike={() => onLike(item)}
                            onPass={() => onPass(item)}
                            onOpenProfile={() => onOpenProfile(item)}
                        />
                    )}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.35}
                    ListFooterComponent={fetchingNext ? (
                        <ActivityIndicator color={Colors.primary} style={styles.footerLoader} />
                    ) : null}
                />
            )}
        </SafeAreaView>
    );
}

function DatingLikeRow({
    profile,
    pending,
    onLike,
    onPass,
    onOpenProfile,
}: {
    profile: api.DatingProfile;
    pending: boolean;
    onLike: () => void;
    onPass: () => void;
    onOpenProfile: () => void;
}) {
    const primaryPhoto = (profile.photos ?? [])[0]?.image_url;
    const locationLabel = profile.city
        ? `${profile.city}${profile.country ? `, ${profile.country}` : ''}`
        : profile.country ?? null;
    const nameLabel = profile.age ? `${formatUsername(profile.username)}, ${profile.age}` : formatUsername(profile.username);
    const metaLabel = [relationshipGoalLabel(profile.relationship_goal), locationLabel].filter(Boolean).join(' · ');

    return (
        <View style={styles.row}>
            <TouchableOpacity
                style={styles.profileArea}
                onPress={onOpenProfile}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityLabel={`View ${formatUsername(profile.username)} profile`}
            >
                <Avatar username={profile.username} avatarUrl={primaryPhoto} size={58} fontSize={20} />
                <View style={styles.profileText}>
                    <Text style={styles.username} numberOfLines={1}>{nameLabel}</Text>
                    {metaLabel ? <Text style={styles.meta} numberOfLines={1}>{metaLabel}</Text> : null}
                    {profile.bio ? (
                        <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
                    ) : null}
                </View>
            </TouchableOpacity>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.passButton]}
                    onPress={onPass}
                    disabled={pending}
                    activeOpacity={0.84}
                    accessibilityLabel={`Pass on ${formatUsername(profile.username)}`}
                >
                    <Text style={[styles.actionText, styles.passText]}>Pass</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.likeButton]}
                    onPress={onLike}
                    disabled={pending}
                    activeOpacity={0.84}
                    accessibilityLabel={`Like back ${formatUsername(profile.username)}`}
                >
                    <Text style={[styles.actionText, styles.likeText]}>Like back</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingTop: 0,
        paddingBottom: ContentInsets.listBottom,
    },
    row: {
        minHeight: 120,
        gap: Spacing.sm,
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
    },
    profileArea: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    profileText: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    username: {
        fontSize: Typography.sizes.md,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    meta: {
        ...TextStyles.secondary,
        color: Colors.text.secondary,
    },
    bio: {
        ...TextStyles.secondary,
        color: Colors.text.muted,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    actionButton: {
        flex: 1,
        minHeight: 42,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    passButton: {
        borderColor: Colors.danger,
        backgroundColor: Colors.dangerSubtle,
    },
    likeButton: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    actionText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
    },
    passText: {
        color: Colors.danger,
    },
    likeText: {
        color: Colors.textOn.primary,
    },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
});
