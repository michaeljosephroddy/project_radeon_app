import React, { useMemo, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { SobrietyCounter } from '../../components/SobrietyCounter';
import { ProfileContentTabs, ProfileContentTabKey } from '../../components/profile/ProfileContentTabs';
import { ProfileEmptyTabState } from '../../components/profile/ProfileEmptyTabState';
import { ProfilePostCard } from '../../components/profile/ProfilePostCard';
import type { CommentThreadTarget } from '../../components/CommentsModal';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useUserProfile } from '../../hooks/queries/useUserProfile';
import { useUserPosts } from '../../hooks/queries/useUserPosts';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { useQueryClient } from '@tanstack/react-query';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { dedupeById } from '../../utils/list';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing, Radius, ContentInsets } from '../../theme';
import { formatUsername } from '../../utils/identity';

interface UserProfileScreenProps {
    userId: string;
    username: string;
    avatarUrl?: string;
    isActive?: boolean;
    onBack: () => void;
    onOpenChat: (chat: api.Chat) => void;
    onOpenComments: (thread: CommentThreadTarget, focusComposer: boolean, onCommentCreated?: (comment: api.Comment) => void) => void;
    onComposeDM: (info: { recipientId: string; username: string; avatarUrl?: string }) => void;
}

function formatCount(value: number): string {
    if (value >= 1000000) return `${Math.floor(value / 100000) / 10}M`;
    if (value >= 1000) return `${Math.floor(value / 100) / 10}K`;
    return String(value);
}

function tabData(tab: ProfileContentTabKey, posts: api.Post[]): api.Post[] {
    if (tab === 'posts') return posts;
    return [];
}

// Renders another user's public profile with an Instagram-style header and content tabs.
export function UserProfileScreen({
    userId, username, avatarUrl,
    isActive = true,
    onBack, onOpenComments, onComposeDM,
}: UserProfileScreenProps) {
    const flatListRef = useRef<FlatList<api.Post> | null>(null);
    const queryClient = useQueryClient();
    const profileQuery = useUserProfile(userId);
    const userPostsQuery = useUserPosts(userId);
    const userPostsListProps = getListPerformanceProps('detailList');
    const userPostsScrollToTop = useScrollToTopButton({ threshold: 320 });
    const [friendActionLoading, setFriendActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<ProfileContentTabKey>('posts');

    const profile = profileQuery.data ?? null;
    const posts = dedupeById((userPostsQuery.data?.pages ?? []).flatMap(page => page.items ?? []));
    const activeData = useMemo(() => tabData(activeTab, posts), [activeTab, posts]);
    const profileName = formatUsername(profile?.username ?? username);
    const profileAvatarUrl = profile?.avatar_url ?? avatarUrl;
    const loadingProfile = !profile && profileQuery.isLoading;
    const loadingPosts = activeTab === 'posts' && posts.length === 0 && userPostsQuery.isLoading;
    const loading = loadingProfile || loadingPosts;
    const refreshing = (profileQuery.isRefetching || (activeTab === 'posts' && userPostsQuery.isRefetching)) && !userPostsQuery.isFetchingNextPage;
    const loadingMorePosts = activeTab === 'posts' && userPostsQuery.isFetchingNextPage;
    const postsHasMore = activeTab === 'posts' && (userPostsQuery.hasNextPage ?? false);
    const friendshipStatus = profile?.friendship_status === 'self' ? 'friends' : (profile?.friendship_status ?? 'none');

    const onRefresh = async (): Promise<void> => {
        if (activeTab === 'posts') {
            resetInfiniteQueryToFirstPage(queryClient, queryKeys.userPosts(userId, 20));
            await Promise.all([
                profileQuery.refetch(),
                userPostsQuery.refetch(),
            ]);
            return;
        }

        await profileQuery.refetch();
    };

    const handleFriendAction = async (): Promise<void> => {
        if (!profile) return;

        setFriendActionLoading(true);
        try {
            if (friendshipStatus === 'friends') {
                await api.removeFriend(userId);
            } else if (friendshipStatus === 'incoming') {
                await api.updateFriendRequest(userId, 'accept');
            } else if (friendshipStatus === 'outgoing') {
                await api.cancelFriendRequest(userId);
            } else {
                await api.sendFriendRequest(userId);
            }
            await profileQuery.refetch();
        } catch (error: unknown) {
            Alert.alert('Profile action failed', error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setFriendActionLoading(false);
        }
    };

    const handleDM = (): void => {
        onComposeDM({ recipientId: userId, username: profile?.username ?? username, avatarUrl: profileAvatarUrl });
    };

    const handleOpenPostComments = (post: api.Post): void => {
        onOpenComments({
            itemId: post.id,
            itemKind: 'post',
            commentCount: post.comment_count,
        }, false);
    };

    const friendButtonLabel = friendshipStatus === 'friends'
        ? 'Friends'
        : friendshipStatus === 'incoming'
            ? 'Accept'
            : friendshipStatus === 'outgoing'
                ? 'Requested'
                : 'Add Friend';

    const handleLoadMorePosts = async (): Promise<void> => {
        if (loading || refreshing || loadingMorePosts || !postsHasMore) return;
        await userPostsQuery.fetchNextPage();
    };

    const handleTabChange = (tab: ProfileContentTabKey): void => {
        setActiveTab(tab);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    };

    const userPostsPagination = useGuardedEndReached(handleLoadMorePosts);

    const ProfileHeader = (
        <View style={styles.profileHeader}>
            <View style={styles.identityRow}>
                <View style={styles.avatarFrame}>
                    <Avatar username={profileName} avatarUrl={profileAvatarUrl} size={92} fontSize={31} />
                </View>
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statCount}>{formatCount(posts.length)}</Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statCount}>{formatCount(profile?.friend_count ?? 0)}</Text>
                        <Text style={styles.statLabel}>Friends</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statCount}>{formatCount(profile?.interests?.length ?? 0)}</Text>
                        <Text style={styles.statLabel}>Interests</Text>
                    </View>
                </View>
            </View>

            <View style={styles.bioBlock}>
                <Text style={styles.name}>{profileName}</Text>
                {loadingProfile ? (
                    <ActivityIndicator color={Colors.primary} style={styles.profileLoader} />
                ) : (
                    <>
                        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
                        {profile?.city ? (
                            <View style={styles.metaRow}>
                                <Ionicons name="location-outline" size={14} color={Colors.text.muted} />
                                <Text style={styles.meta}>{profile.city}{profile.country ? `, ${profile.country}` : ''}</Text>
                            </View>
                        ) : null}
                        {profile?.interests?.length ? (
                            <View style={styles.interestsWrap}>
                                {profile.interests.slice(0, 5).map((interest) => (
                                    <View key={interest} style={styles.interestChip}>
                                        <Text style={styles.interestChipText}>{interest}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}
                        <SobrietyCounter soberSince={profile?.sober_since} compact style={styles.sobrietyCounter} />
                    </>
                )}
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[
                        styles.followBtn,
                        friendshipStatus === 'friends' && styles.followingBtn,
                        friendActionLoading && styles.disabledButton,
                    ]}
                    onPress={handleFriendAction}
                    disabled={friendActionLoading || loadingProfile}
                >
                    <Text style={[styles.followBtnText, friendshipStatus === 'friends' && styles.followingBtnText]}>
                        {friendButtonLabel}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.dmBtn}
                    onPress={handleDM}
                    disabled={loadingProfile}
                >
                    <Text style={styles.dmBtnText}>Message</Text>
                </TouchableOpacity>
            </View>

            <ProfileContentTabs activeTab={activeTab} onChange={handleTabChange} />
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader onBack={onBack} title={profileName} />

            <FlatList
                ref={flatListRef}
                key={activeTab}
                data={activeData}
                keyExtractor={item => item.id}
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
                ListEmptyComponent={!loading ? <ProfileEmptyTabState tab={activeTab} username={profileName} /> : null}
                renderItem={({ item }) => (
                    <ProfilePostCard post={item} onPressComments={handleOpenPostComments} />
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
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    list: {
        paddingBottom: ContentInsets.listBottom,
    },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
    profileHeader: {
        backgroundColor: Colors.bg.page,
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
        gap: Spacing.lg,
    },
    avatarFrame: {
        width: 98,
        height: 98,
        borderRadius: 49,
        borderWidth: 2,
        borderColor: Colors.border.emphasis,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsRow: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statCount: {
        fontSize: Typography.sizes.lg,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    statLabel: {
        marginTop: 2,
        fontSize: Typography.sizes.xs,
        color: Colors.text.secondary,
    },
    bioBlock: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        gap: Spacing.xs,
    },
    profileLoader: {
        alignSelf: 'flex-start',
        marginTop: Spacing.xs,
    },
    name: {
        fontSize: Typography.sizes.base,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.xs,
    },
    meta: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    bio: {
        fontSize: Typography.sizes.base,
        color: Colors.text.secondary,
        lineHeight: 20,
    },
    interestsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    interestChip: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    interestChipText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    sobrietyCounter: {
        marginTop: Spacing.sm,
    },
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    followBtn: {
        flex: 1,
        backgroundColor: Colors.primary,
        borderRadius: Radius.sm,
        paddingVertical: 9,
        alignItems: 'center',
    },
    followingBtn: {
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.default,
    },
    disabledButton: {
        opacity: 0.6,
    },
    followBtnText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    followingBtnText: {
        color: Colors.text.primary,
    },
    dmBtn: {
        flex: 1,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.sm,
        paddingVertical: 9,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border.default,
    },
    dmBtnText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.primary,
    },
});
