import React, { useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Image, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { SectionLabel } from '../../components/ui/SectionLabel';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useUserProfile } from '../../hooks/queries/useUserProfile';
import { useUserPosts } from '../../hooks/queries/useUserPosts';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { useQueryClient } from '@tanstack/react-query';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing, Radii, ContentInsets } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';
import { formatRecoveryDuration, formatSobrietyDate, getRecoveryMilestone } from '../../utils/date';

// Formats profile post timestamps into compact relative labels.
function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

interface UserProfileScreenProps {
    userId: string;
    username: string;
    avatarUrl?: string;
    isActive?: boolean;
    onBack: () => void;
    onOpenChat: (chat: api.Chat) => void;
    onComposeDM: (info: { recipientId: string; username: string; avatarUrl?: string }) => void;
}

// Renders another user's profile plus friendship and direct-message actions.
export function UserProfileScreen({
    userId, username, avatarUrl,
    isActive = true,
    onBack, onOpenChat, onComposeDM,
}: UserProfileScreenProps) {
    const flatListRef = useRef<FlatList<api.Post> | null>(null);
    const queryClient = useQueryClient();
    const profileQuery = useUserProfile(userId);
    const userPostsQuery = useUserPosts(userId);
    const userPostsListProps = getListPerformanceProps('detailList');
    const userPostsScrollToTop = useScrollToTopButton({ threshold: 320 });
    const [friendActionLoading, setFriendActionLoading] = useState(false);
    const profile = profileQuery.data ?? null;
    const posts = (userPostsQuery.data?.pages ?? []).flatMap(page => page.items ?? []);
    const loading = (!profile && profileQuery.isLoading) || (posts.length === 0 && userPostsQuery.isLoading);
    const refreshing = (profileQuery.isRefetching || userPostsQuery.isRefetching) && !userPostsQuery.isFetchingNextPage;
    const loadingMorePosts = userPostsQuery.isFetchingNextPage;
    const postsHasMore = userPostsQuery.hasNextPage ?? false;
    const friendshipStatus = profile?.friendship_status === 'self' ? 'friends' : (profile?.friendship_status ?? 'none');
    const formattedSobrietyDate = formatSobrietyDate(profile?.sober_since);
    const recoveryMilestone = getRecoveryMilestone(profile?.sober_since);

    const onRefresh = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.userPosts(userId, 20));
        await Promise.all([
            profileQuery.refetch(),
            userPostsQuery.refetch(),
        ]);
    };

    const handleFriendAction = async () => {
        if (friendshipStatus === 'friends') {
            setFriendActionLoading(true);
            try {
                await api.removeFriend(userId);
                await profileQuery.refetch();
            } catch {
            } finally {
                setFriendActionLoading(false);
            }
            return;
        }

        setFriendActionLoading(true);
        try {
            if (friendshipStatus === 'incoming') {
                await api.updateFriendRequest(userId, 'accept');
            } else if (friendshipStatus === 'outgoing') {
                await api.cancelFriendRequest(userId);
            } else {
                await api.sendFriendRequest(userId);
            }
            await profileQuery.refetch();
        } catch {
        } finally {
            setFriendActionLoading(false);
        }
    };

    const handleDM = () => {
        onComposeDM({ recipientId: userId, username, avatarUrl });
    };

    const friendButtonLabel = friendshipStatus === 'friends'
        ? 'Friends'
        : friendshipStatus === 'incoming'
            ? 'Accept Friend'
            : friendshipStatus === 'outgoing'
                ? 'Requested'
                : 'Add Friend';

    // Profile timelines use the same paged contract as the main feed, which
    // keeps large author histories bounded on-device.
    const handleLoadMorePosts = async () => {
        if (loading || refreshing || loadingMorePosts || !postsHasMore) return;
        await userPostsQuery.fetchNextPage();
    };
    const userPostsPagination = useGuardedEndReached(handleLoadMorePosts);

    const ProfileHeader = (
        <View style={styles.profileHeader}>
            {profile?.banner_url
                ? <Image source={{ uri: profile.banner_url }} style={styles.banner} resizeMode="cover" />
                : <View style={styles.bannerPlaceholder} />
            }
            <View style={styles.avatarOverlapRow}>
                <View style={styles.avatarBorder}>
                    <Avatar username={username} avatarUrl={avatarUrl} size={96} fontSize={34} />
                </View>
            </View>
            <View style={styles.profileContent}>
                <Text style={styles.name}>{formatUsername(username)}</Text>

                {loading ? (
                    <ActivityIndicator color={Colors.primary} style={styles.profileLoader} />
                ) : (
                    <>
                        {profile?.bio ? (
                            <Text style={styles.bio}>{profile.bio}</Text>
                        ) : null}
                        {profile?.city && (
                            <Text style={styles.meta}>{profile.city}{profile.country ? `, ${profile.country}` : ''}</Text>
                        )}
                        {profile?.interests?.length ? (
                            <View style={styles.interestsWrap}>
                                {profile.interests.map((interest) => (
                                    <View key={interest} style={styles.interestChip}>
                                        <Text style={styles.interestChipText}>{interest}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}
                        {formattedSobrietyDate && (
                            <Text style={styles.meta}>Sober since {formattedSobrietyDate}</Text>
                        )}
                        {recoveryMilestone && (
                            <View style={styles.milestoneCard}>
                                <Text style={styles.milestoneLabel}>MILESTONE</Text>
                                <View style={styles.milestoneBadge}>
                                    <Text style={styles.milestoneBadgeText}>{recoveryMilestone.currentLabel}</Text>
                                </View>
                                <Text style={styles.milestoneValue}>
                                    {formatRecoveryDuration(recoveryMilestone.daysSober)}
                                </Text>
                                <Text style={styles.milestoneHint}>
                                    {recoveryMilestone.nextLabel && recoveryMilestone.daysToNext
                                        ? `${recoveryMilestone.daysToNext} days to ${recoveryMilestone.nextLabel}`
                                        : 'Longest milestone badge unlocked'}
                                </Text>
                            </View>
                        )}
                    </>
                )}

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.followBtn, friendshipStatus === 'friends' && styles.followingBtn, friendActionLoading && { opacity: 0.6 }]}
                        onPress={handleFriendAction}
                        disabled={friendActionLoading}
                    >
                        <Text style={[styles.followBtnText, friendshipStatus === 'friends' && styles.followingBtnText]}>
                            {friendButtonLabel}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.dmBtn}
                        onPress={handleDM}
                    >
                        <Text style={styles.dmBtnText}>Message</Text>
                    </TouchableOpacity>
                </View>

                <SectionLabel style={styles.postsLabel}>POSTS</SectionLabel>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader onBack={onBack} title={formatUsername(username)} />

            <FlatList
                ref={flatListRef}
                data={posts}
                keyExtractor={p => p.id}
                {...userPostsListProps}
                onEndReached={userPostsPagination.onEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={userPostsPagination.onMomentumScrollBegin}
                onScrollBeginDrag={userPostsPagination.onScrollBeginDrag}
                onScroll={userPostsScrollToTop.onScroll}
                scrollEventThrottle={16}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                ListHeaderComponent={ProfileHeader}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    !loading ? (
                        <EmptyState
                            title="No posts yet."
                            compact
                            titleStyle={styles.emptyText}
                        />
                    ) : null
                }
                renderItem={({ item }) => (
                    <View style={styles.postCard}>
                        <View style={styles.postHead}>
                            <Avatar username={item.username} avatarUrl={item.avatar_url} size={44} fontSize={14} />
                            <View style={styles.postHeadBody}>
                                <Text style={styles.postName}>{formatUsername(item.username)}</Text>
                                <Text style={styles.postMeta}>{timeAgo(item.created_at)}</Text>
                            </View>
                        </View>
                        {!!item.body && <Text style={styles.postBody}>{item.body}</Text>}
                        {item.images[0] ? (
                            <Image
                                source={{ uri: item.images[0].image_url }}
                                style={styles.postImage}
                                resizeMode="cover"
                            />
                        ) : null}
                        <View style={styles.postFoot}>
                            <View style={styles.postAction}>
                                <Ionicons name="heart-outline" size={16} color={Colors.light.textTertiary} />
                                <Text style={styles.postActionText}>
                                    {item.like_count > 0 ? item.like_count : 'Like'}
                                </Text>
                            </View>
                            <View style={styles.postAction}>
                                <Ionicons name="chatbubble-outline" size={15} color={Colors.light.textTertiary} />
                                <Text style={styles.postActionText}>
                                    {item.comment_count > 0 ? `${item.comment_count} comments` : 'Comment'}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
                ListFooterComponent={loadingMorePosts ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
            />
            {isActive && userPostsScrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    list: { paddingBottom: ContentInsets.listBottom },
    footerLoader: { paddingVertical: Spacing.md },

    profileHeader: {
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
        marginBottom: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    banner: {
        height: 140,
        marginHorizontal: Spacing.md,
        borderRadius: Radii.lg,
    },
    bannerPlaceholder: {
        height: 140,
        marginHorizontal: Spacing.md,
        borderRadius: Radii.lg,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    avatarOverlapRow: {
        alignItems: 'center',
        marginHorizontal: Spacing.md,
        marginTop: -48,
        marginBottom: Spacing.sm,
    },
    avatarBorder: {
        width: 102,
        height: 102,
        borderRadius: 51,
        backgroundColor: Colors.light.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileContent: {
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        gap: 6,
    },
    profileLoader: {
        marginTop: Spacing.sm,
    },
    name: {
        fontSize: Typography.sizes.xl,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        textAlign: 'center',
    },
    meta: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    bio: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginTop: Spacing.sm,
    },
    interestsWrap: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    interestChip: {
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.backgroundSecondary,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
    },
    interestChipText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '500',
        color: Colors.light.textSecondary,
    },
    milestoneCard: {
        width: '100%',
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        gap: 6,
        marginTop: Spacing.md,
    },
    milestoneLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.light.textTertiary,
        letterSpacing: 0.7,
    },
    milestoneBadge: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 7,
    },
    milestoneBadgeText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    milestoneValue: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    milestoneHint: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    followBtn: {
        flex: 1,
        backgroundColor: Colors.primary,
        borderRadius: Radii.md,
        paddingVertical: 10,
        alignItems: 'center',
    },
    followingBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: Colors.light.border,
    },
    followBtnText: { fontSize: Typography.sizes.base, fontWeight: '600', color: '#FFFFFF' },
    followingBtnText: { color: Colors.light.textSecondary },
    dmBtn: {
        flex: 1,
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.light.border,
    },
    dmBtnText: { fontSize: Typography.sizes.base, fontWeight: '600', color: Colors.light.textPrimary },

    postsLabel: {
        alignSelf: 'flex-start',
        marginTop: Spacing.md,
    },

    postCard: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.lg,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
    },
    postHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    postHeadBody: { flex: 1 },
    postName: { fontSize: Typography.sizes.md, fontWeight: '500', color: Colors.light.textPrimary },
    postMeta: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary, marginTop: 1 },
    postBody: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textSecondary,
        lineHeight: 19,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    postImage: {
        width: '100%',
        aspectRatio: 1.2,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    postFoot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
    },
    postAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    postActionText: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
    emptyText: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary },
});
