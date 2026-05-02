import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput, Image,
    StyleSheet, RefreshControl, ActivityIndicator, Alert, Modal,
    Platform, KeyboardAvoidingView,
} from 'react-native';
import type { AlertButton, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import type { CommentThreadTarget } from './feed/FeedCommentsModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { CreatePostFab } from '../../components/posts/CreatePostFab';
import { PostCard } from '../../components/posts/PostCard';
import { feedItemToPostDisplayModel } from '../../components/posts/postMappers';
import * as api from '../../api/client';
import { useHomeFeed } from '../../hooks/queries/useFeed';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { useAuth } from '../../hooks/useAuth';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing, Radius, ContentInsets } from '../../theme';
import { formatUsername } from '../../utils/identity';
import { dedupeById } from '../../utils/list';
import { formatReadableTimestamp } from '../../utils/date';

interface ReshareCardProps {
    item: api.FeedItem;
    resolvedImageSource: string | null;
    onOpenComments: (item: api.FeedItem, focusComposer?: boolean) => void;
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onOpenItemActions: (item: api.FeedItem) => void;
    onSharePost: (item: api.FeedItem) => void;
    onLocalReactionChange: (item: api.FeedItem, reacted: boolean) => void;
    showShareAction: boolean;
}

// The feed is now a single ranked home surface, so telemetry always reports one mode.
const HOME_FEED_MODE: api.FeedMode = 'home';
const FEED_RESHARES_ENABLED = process.env.EXPO_PUBLIC_FEED_RESHARES_ENABLED !== 'false';
const FEED_TELEMETRY_BATCH_DELAY_MS = 1500;

interface ActiveFeedImpression {
    item: api.FeedItem;
    feedMode: api.FeedMode;
    position: number;
    servedAt: string;
    visibleSinceMs: number;
    wasClicked: boolean;
    wasLiked: boolean;
    wasCommented: boolean;
}

interface HiddenUndoState {
    item: api.FeedItem;
    index: number;
}

const ReshareCard = React.memo(function ReshareCard({
    item,
    resolvedImageSource,
    onOpenComments,
    onPressUser,
    onOpenItemActions,
    onSharePost,
    onLocalReactionChange,
    showShareAction,
}: ReshareCardProps) {
    const originalPost = item.original_post;
    if (!originalPost) return null;
    const [liked, setLiked] = useState(item.viewer_state.is_liked);
    const [likeCount, setLikeCount] = useState(item.like_count);

    useEffect(() => {
        setLiked(item.viewer_state.is_liked);
        setLikeCount(item.like_count);
    }, [item.like_count, item.viewer_state.is_liked]);

    const handlePressResharer = useCallback(
        () => onPressUser({ userId: item.author.user_id, username: item.author.username, avatarUrl: item.author.avatar_url ?? undefined }),
        [item.author.avatar_url, item.author.user_id, item.author.username, onPressUser],
    );
    const handlePressOriginalAuthor = useCallback(
        () => onPressUser({ userId: originalPost.author.user_id, username: originalPost.author.username, avatarUrl: originalPost.author.avatar_url ?? undefined }),
        [onPressUser, originalPost.author.avatar_url, originalPost.author.user_id, originalPost.author.username],
    );
    const handleOpenComments = useCallback(
        () => onOpenComments(item),
        [item, onOpenComments],
    );
    const handleOpenActions = useCallback(
        () => onOpenItemActions(item),
        [item, onOpenItemActions],
    );
    const handleShare = useCallback(
        () => onSharePost(item),
        [item, onSharePost],
    );
    const handleReact = useCallback(async () => {
        try {
            const res = await api.reactToFeedItem(item.id, item.kind);
            setLiked(res.reacted);
            setLikeCount(prev => res.reacted ? prev + 1 : prev - 1);
            onLocalReactionChange(item, res.reacted);
        } catch { }
    }, [item, onLocalReactionChange]);

    return (
        <View style={styles.postCard}>
            <View style={styles.postHead}>
                <TouchableOpacity onPress={handlePressResharer}>
                    <Avatar username={item.author.username} avatarUrl={item.author.avatar_url ?? undefined} size={44} />
                </TouchableOpacity>
                <View style={styles.postHeadBody}>
                    <View style={styles.postTitleRow}>
                        <Text style={styles.postName}>{formatUsername(item.author.username)}</Text>
                        <Text style={styles.reshareLabel}>reshared</Text>
                        <Text style={styles.postMeta}>{formatReadableTimestamp(item.created_at)}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.headActionButton} onPress={handleOpenActions}>
                    <Ionicons name="ellipsis-horizontal" size={18} color={Colors.text.muted} />
                </TouchableOpacity>
            </View>
            {!!item.body && (
                <View style={styles.postContent}>
                    <Text style={styles.postBody}>{item.body}</Text>
                </View>
            )}
            <View style={styles.reshareEmbed}>
                <View style={styles.reshareEmbedHead}>
                    <TouchableOpacity onPress={handlePressOriginalAuthor}>
                        <Avatar username={originalPost.author.username} avatarUrl={originalPost.author.avatar_url ?? undefined} size={36} fontSize={12} />
                    </TouchableOpacity>
                    <View style={styles.postHeadBody}>
                        <Text style={styles.reshareOriginalName}>{formatUsername(originalPost.author.username)}</Text>
                        <Text style={styles.postMeta}>{formatReadableTimestamp(originalPost.created_at)}</Text>
                    </View>
                </View>
                <Text style={styles.postBody}>{originalPost.body}</Text>
                {resolvedImageSource ? (
                    <Image
                        source={{ uri: resolvedImageSource }}
                        style={styles.postImage}
                        resizeMode="cover"
                    />
                ) : null}
                {renderPostTags(originalPost.tags)}
            </View>
            <View style={styles.postFoot}>
                <TouchableOpacity style={styles.postAction} onPress={handleReact}>
                    <Ionicons
                        name={liked ? 'heart' : 'heart-outline'}
                        size={16}
                        color={liked ? Colors.danger : Colors.text.muted}
                    />
                    <Text style={[styles.postActionText, liked && styles.liked]}>
                        {likeCount > 0 ? likeCount : 'Like'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postAction} onPress={handleOpenComments}>
                    <Ionicons
                        name="chatbubble-outline"
                        size={15}
                        color={Colors.text.muted}
                    />
                    <Text style={styles.postActionText}>
                        {item.comment_count > 0 ? `${item.comment_count} comments` : 'Comment'}
                    </Text>
                </TouchableOpacity>
                {showShareAction ? (
                    <TouchableOpacity style={styles.postAction} onPress={handleShare}>
                        <Ionicons
                            name="repeat-outline"
                            size={16}
                            color={Colors.text.muted}
                        />
                        <Text style={styles.postActionText}>Share</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}, areReshareCardPropsEqual);

interface FeedScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onOpenComments: (thread: CommentThreadTarget, focusComposer: boolean, onCommentCreated?: (comment: api.Comment) => void) => void;
    onOpenCreatePost: () => void;
    focusRequest?: { postId: string; commentId?: string; nonce: number } | null;
    onFocusRequestConsumed?: (nonce: number) => void;
    topContentInset?: number;
}

export function FeedScreen({
    isActive,
    onOpenUserProfile,
    onOpenComments,
    onOpenCreatePost,
    focusRequest,
    onFocusRequestConsumed,
    topContentInset = 0,
}: FeedScreenProps) {
    const ScreenContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const hasActivated = useLazyActivation(isActive);
    const feedListProps = getListPerformanceProps('denseFeed');
    const homeFeedQuery = useHomeFeed(20, hasActivated);
    useRefetchOnActiveIfStale(isActive, homeFeedQuery);
    const activeFeedQuery = homeFeedQuery;
    const serverFeedItems = useMemo(
        () => (homeFeedQuery.data?.pages ?? []).flatMap((page: api.CursorResponse<api.FeedItem>) => page.items ?? []),
        [homeFeedQuery.data],
    );
    const feedScrollToTop = useScrollToTopButton({ threshold: 520 });
    const insets = useSafeAreaInsets();
    const [feedItems, setFeedItems] = useState<api.FeedItem[]>([]);
    const [isCreateFabVisible, setIsCreateFabVisible] = useState(true);
    const [shareTarget, setShareTarget] = useState<api.FeedItem | null>(null);
    const [shareCommentary, setShareCommentary] = useState('');
    const [isSubmittingShare, setIsSubmittingShare] = useState(false);
    const [hiddenUndo, setHiddenUndo] = useState<HiddenUndoState | null>(null);

    const feedItemsRef = useRef<api.FeedItem[]>([]);
    const flatListRef = useRef<FlatList<api.FeedItem>>(null);
    const lastFeedScrollYRef = useRef(0);
    const createFabRevealTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const localManagedPostIdsRef = useRef<Set<string>>(new Set());
    const feedSessionIdRef = useRef(`feed-${Date.now()}`);
    const activeImpressionsRef = useRef<Record<string, ActiveFeedImpression>>({});
    const servedAtByItemRef = useRef<Record<string, string>>({});
    const hiddenUndoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const impressionBatchRef = useRef<api.FeedImpressionInput[]>([]);
    const eventBatchRef = useRef<api.FeedEventInput[]>([]);
    const impressionFlushTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const eventFlushTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => {
        if (hiddenUndoTimerRef.current) clearTimeout(hiddenUndoTimerRef.current);
        if (createFabRevealTimerRef.current) clearTimeout(createFabRevealTimerRef.current);
        if (impressionFlushTimerRef.current) clearTimeout(impressionFlushTimerRef.current);
        if (eventFlushTimerRef.current) clearTimeout(eventFlushTimerRef.current);
    }, []);

    useEffect(() => {
        feedItemsRef.current = feedItems;
    }, [feedItems]);

    const currentUserId = user?.id ?? '';

    const reconcileFeedItems = useCallback((nextServerItems: api.FeedItem[]) => {
        const localManagedIds = localManagedPostIdsRef.current;
        const serverItemIds = new Set(nextServerItems.map((item) => item.id));
        setFeedItems((current) => {
            // Keep locally created items visible until the server starts returning them.
            const preservedLocalItems = current.filter((item) =>
                localManagedIds.has(item.id) && !serverItemIds.has(item.id)
            );
            localManagedIds.forEach((postId) => {
                if (serverItemIds.has(postId)) {
                    localManagedIds.delete(postId);
                }
            });
            return dedupeById([...preservedLocalItems, ...nextServerItems]);
        });
    }, []);

    useEffect(() => {
        reconcileFeedItems(serverFeedItems);
    }, [reconcileFeedItems, serverFeedItems]);

    const onRefresh = useCallback(async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.homeFeed(20));
        await homeFeedQuery.refetch();
    }, [homeFeedQuery, queryClient]);

    const handleFeedScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        feedScrollToTop.onScroll(event);

        const offsetY = event.nativeEvent.contentOffset.y;
        const deltaY = offsetY - lastFeedScrollYRef.current;
        lastFeedScrollYRef.current = offsetY;

        if (createFabRevealTimerRef.current) {
            clearTimeout(createFabRevealTimerRef.current);
        }
        if (Math.abs(deltaY) > 4) {
            setIsCreateFabVisible((current) => (!current ? current : false));
        }
        createFabRevealTimerRef.current = setTimeout(() => {
            setIsCreateFabVisible(true);
        }, 320);
    }, [feedScrollToTop.onScroll]);

    const handleLoadMore = useCallback(async () => {
        if (!isActive || !activeFeedQuery.hasNextPage || activeFeedQuery.isFetchingNextPage) return;
        await activeFeedQuery.fetchNextPage();
    }, [activeFeedQuery, isActive]);
    const feedListPagination = useGuardedEndReached(handleLoadMore);

    const hideCreateFabDuringScroll = useCallback(() => {
        if (createFabRevealTimerRef.current) {
            clearTimeout(createFabRevealTimerRef.current);
        }
        setIsCreateFabVisible(false);
    }, []);

    const handleFeedScrollBeginDrag = useCallback(() => {
        feedListPagination.onScrollBeginDrag();
        hideCreateFabDuringScroll();
    }, [feedListPagination.onScrollBeginDrag, hideCreateFabDuringScroll]);

    const handleFeedMomentumScrollBegin = useCallback(() => {
        feedListPagination.onMomentumScrollBegin();
        hideCreateFabDuringScroll();
    }, [feedListPagination.onMomentumScrollBegin, hideCreateFabDuringScroll]);

    const handleFeedScrollEnd = useCallback(() => {
        if (createFabRevealTimerRef.current) {
            clearTimeout(createFabRevealTimerRef.current);
        }
        createFabRevealTimerRef.current = setTimeout(() => {
            setIsCreateFabVisible(true);
        }, 180);
    }, []);

    const getImpressionKey = useCallback((item: api.FeedItem, feedMode: api.FeedMode = HOME_FEED_MODE) => {
        return `${feedMode}:${item.kind}:${item.id}`;
    }, []);

    const getFeedItemPosition = useCallback((itemId: string) => {
        return feedItemsRef.current.findIndex((feedItem) => feedItem.id === itemId);
    }, []);

    const ensureServedAt = useCallback((item: api.FeedItem, feedMode: api.FeedMode = HOME_FEED_MODE) => {
        const key = getImpressionKey(item, feedMode);
        const existing = servedAtByItemRef.current[key];
        if (existing) return existing;
        const servedAt = new Date().toISOString();
        servedAtByItemRef.current[key] = servedAt;
        return servedAt;
    }, [getImpressionKey]);

    const markVisibleItemInteraction = useCallback((item: api.FeedItem, updates: Partial<Pick<ActiveFeedImpression, 'wasClicked' | 'wasLiked' | 'wasCommented'>>) => {
        const key = getImpressionKey(item);
        const active = activeImpressionsRef.current[key];
        if (!active) return;
        activeImpressionsRef.current[key] = { ...active, ...updates };
    }, [getImpressionKey]);

    const flushQueuedImpressions = useCallback(() => {
        const impressions = impressionBatchRef.current;
        if (impressionFlushTimerRef.current) {
            clearTimeout(impressionFlushTimerRef.current);
            impressionFlushTimerRef.current = undefined;
        }
        if (impressions.length === 0) return;
        impressionBatchRef.current = [];
        void api.logFeedImpressions(impressions).catch(() => {});
    }, []);

    const scheduleImpressionFlush = useCallback(() => {
        if (impressionFlushTimerRef.current) return;
        // Batch short bursts of visibility updates so scrolling does not turn
        // into one network request per cell that briefly crosses the viewport.
        impressionFlushTimerRef.current = setTimeout(() => {
            impressionFlushTimerRef.current = undefined;
            flushQueuedImpressions();
        }, FEED_TELEMETRY_BATCH_DELAY_MS);
    }, [flushQueuedImpressions]);

    const enqueueImpression = useCallback((impression: api.FeedImpressionInput) => {
        impressionBatchRef.current.push(impression);
        if (impressionBatchRef.current.length >= 20) {
            flushQueuedImpressions();
            return;
        }
        scheduleImpressionFlush();
    }, [flushQueuedImpressions, scheduleImpressionFlush]);

    const flushQueuedEvents = useCallback(() => {
        const events = eventBatchRef.current;
        if (eventFlushTimerRef.current) {
            clearTimeout(eventFlushTimerRef.current);
            eventFlushTimerRef.current = undefined;
        }
        if (events.length === 0) return;
        eventBatchRef.current = [];
        void api.logFeedEvents(events).catch(() => {});
    }, []);

    const scheduleEventFlush = useCallback(() => {
        if (eventFlushTimerRef.current) return;
        eventFlushTimerRef.current = setTimeout(() => {
            eventFlushTimerRef.current = undefined;
            flushQueuedEvents();
        }, FEED_TELEMETRY_BATCH_DELAY_MS);
    }, [flushQueuedEvents]);

    const enqueueFeedEvent = useCallback((event: api.FeedEventInput) => {
        eventBatchRef.current.push(event);
        if (eventBatchRef.current.length >= 10) {
            flushQueuedEvents();
            return;
        }
        scheduleEventFlush();
    }, [flushQueuedEvents, scheduleEventFlush]);

    const flushImpression = useCallback((key: string, nowMs = Date.now()) => {
        const active = activeImpressionsRef.current[key];
        if (!active) return;
        delete activeImpressionsRef.current[key];
        const viewMs = Math.max(0, Math.round(nowMs - active.visibleSinceMs));
        // Ignore fly-by visibility so impressions better match actual consumption.
        if (viewMs < 400) return;

        enqueueImpression({
            item_id: active.item.id,
            item_kind: active.item.kind,
            feed_mode: active.feedMode,
            session_id: feedSessionIdRef.current,
            position: active.position,
            served_at: active.servedAt,
            viewed_at: new Date(nowMs).toISOString(),
            view_ms: viewMs,
            was_clicked: active.wasClicked,
            was_liked: active.wasLiked,
            was_commented: active.wasCommented,
        });
    }, [enqueueImpression]);

    const flushAllImpressions = useCallback(() => {
        const nowMs = Date.now();
        Object.keys(activeImpressionsRef.current).forEach((key) => {
            flushImpression(key, nowMs);
        });
    }, [flushImpression]);

    useEffect(() => () => {
        // Flush both active-view state and queued telemetry on unmount so the
        // final scroll segment is still accounted for.
        flushAllImpressions();
        flushQueuedImpressions();
        flushQueuedEvents();
    }, [flushAllImpressions, flushQueuedEvents, flushQueuedImpressions]);

    useEffect(() => {
        if (!isActive) {
            flushAllImpressions();
            flushQueuedImpressions();
            flushQueuedEvents();
        }
    }, [flushAllImpressions, flushQueuedEvents, flushQueuedImpressions, isActive]);

    const logFeedEvent = useCallback((item: api.FeedItem, eventType: api.FeedEventType, payload?: Record<string, unknown>) => {
        const position = getFeedItemPosition(item.id);
        enqueueFeedEvent({
            item_id: item.id,
            item_kind: item.kind,
            feed_mode: HOME_FEED_MODE,
            event_type: eventType,
            position: position >= 0 ? position : undefined,
            payload,
        });
    }, [enqueueFeedEvent, getFeedItemPosition]);

    const buildCommentThreadTarget = useCallback((item: api.FeedItem): CommentThreadTarget => {
        return {
            itemId: item.id,
            itemKind: item.kind,
            commentCount: item.comment_count,
            title: item.kind === 'reshare' ? 'Share comments' : undefined,
        };
    }, []);

    const handleCommentCreated = useCallback((item: api.FeedItem) => {
        return () => {
            markVisibleItemInteraction(item, { wasCommented: true, wasClicked: true });
            logFeedEvent(item, 'comment');
            setFeedItems((current) => current.map((currentItem) => {
                if (currentItem.id === item.id && currentItem.kind === item.kind) {
                    return { ...currentItem, comment_count: currentItem.comment_count + 1 };
                }
                if (item.kind === 'post' && currentItem.kind === 'reshare' && currentItem.original_post?.post_id === item.id) {
                    return {
                        ...currentItem,
                        original_post: {
                            ...currentItem.original_post,
                            comment_count: currentItem.original_post.comment_count + 1,
                        },
                    };
                }
                return currentItem;
            }));
        };
    }, [logFeedEvent, markVisibleItemInteraction]);

    const handleOpenComments = useCallback((item: api.FeedItem, focusComposer = false) => {
        markVisibleItemInteraction(item, { wasClicked: true });
        logFeedEvent(item, 'open_comments');
        onOpenComments(buildCommentThreadTarget(item), focusComposer, handleCommentCreated(item));
    }, [buildCommentThreadTarget, handleCommentCreated, logFeedEvent, markVisibleItemInteraction, onOpenComments]);

    const handleSharePost = useCallback((item: api.FeedItem) => {
        markVisibleItemInteraction(item, { wasClicked: true });
        logFeedEvent(item, 'share_open');
        setShareTarget(item);
        setShareCommentary('');
    }, [logFeedEvent, markVisibleItemInteraction]);

    const handleSubmitShare = useCallback(() => {
        if (!shareTarget || isSubmittingShare) return;
        const sourcePostId = shareTarget.kind === 'post' ? shareTarget.id : shareTarget.original_post?.post_id;
        if (!sourcePostId) return;

        setIsSubmittingShare(true);
        void (async () => {
            try {
                await api.sharePost({
                    postId: sourcePostId,
                    commentary: shareCommentary.trim() || undefined,
                });
                logFeedEvent(shareTarget, 'share_create', shareCommentary.trim() ? { commentary: true } : undefined);
                setShareTarget(null);
                setShareCommentary('');
                void queryClient.invalidateQueries({ queryKey: queryKeys.homeFeed() });
            } catch (error) {
                Alert.alert('Could not share post', error instanceof Error ? error.message : 'Please try again.');
            } finally {
                setIsSubmittingShare(false);
            }
        })();
    }, [isSubmittingShare, logFeedEvent, queryClient, shareCommentary, shareTarget]);

    const handleHideItem = useCallback((item: api.FeedItem) => {
        void (async () => {
            try {
                await api.hideFeedItem({ itemId: item.id, itemKind: item.kind });
                logFeedEvent(item, 'hide');
                if (hiddenUndoTimerRef.current) clearTimeout(hiddenUndoTimerRef.current);
                const hiddenIndex = feedItemsRef.current.findIndex((currentItem) => currentItem.id === item.id && currentItem.kind === item.kind);
                setHiddenUndo({
                    item,
                    index: hiddenIndex >= 0 ? hiddenIndex : 0,
                });
                hiddenUndoTimerRef.current = setTimeout(() => {
                    setHiddenUndo(null);
                    hiddenUndoTimerRef.current = undefined;
                }, 5000);
                setFeedItems((current) => current.filter((currentItem) => !(currentItem.id === item.id && currentItem.kind === item.kind)));
                void queryClient.invalidateQueries({ queryKey: queryKeys.homeFeed() });
            } catch (error) {
                Alert.alert('Could not hide item', error instanceof Error ? error.message : 'Please try again.');
            }
        })();
    }, [logFeedEvent, queryClient]);

    const handleUndoHide = useCallback(() => {
        if (!hiddenUndo) return;
        const { item, index } = hiddenUndo;
        if (hiddenUndoTimerRef.current) {
            clearTimeout(hiddenUndoTimerRef.current);
            hiddenUndoTimerRef.current = undefined;
        }
        setHiddenUndo(null);
        void (async () => {
            try {
                await api.unhideFeedItem({ itemId: item.id, itemKind: item.kind });
                setFeedItems((current) => {
                    const next = [...current];
                    const insertAt = Math.min(Math.max(index, 0), next.length);
                    next.splice(insertAt, 0, item);
                    return dedupeById(next);
                });
                void queryClient.invalidateQueries({ queryKey: queryKeys.homeFeed() });
            } catch (error) {
                Alert.alert('Could not restore item', error instanceof Error ? error.message : 'Please try again.');
            }
        })();
    }, [hiddenUndo, queryClient]);

    const handleMuteAuthor = useCallback((item: api.FeedItem) => {
        void (async () => {
            try {
                await api.muteFeedAuthor(item.author.user_id);
                logFeedEvent(item, 'mute_author', { author_id: item.author.user_id });
                setFeedItems((current) => current.filter((currentItem) => currentItem.author.user_id !== item.author.user_id));
                void queryClient.invalidateQueries({ queryKey: queryKeys.homeFeed() });
            } catch (error) {
                Alert.alert('Could not mute author', error instanceof Error ? error.message : 'Please try again.');
            }
        })();
    }, [logFeedEvent, queryClient]);

    const handleOpenItemActions = useCallback((item: api.FeedItem) => {
        const isOwnAuthor = item.author.user_id === currentUserId;
        const actions: AlertButton[] = [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'Hide', onPress: () => handleHideItem(item) },
        ];
        if (!isOwnAuthor) {
            actions.push({
                text: `Mute ${formatUsername(item.author.username)}`,
                style: 'destructive' as const,
                onPress: () => handleMuteAuthor(item),
            });
        }
        Alert.alert(
            'Post options',
            item.kind === 'reshare' ? 'Choose what to do with this reshare.' : 'Choose what to do with this post.',
            actions,
        );
    }, [currentUserId, handleHideItem, handleMuteAuthor]);

    const handleLocalReactionChange = useCallback((item: api.FeedItem, reacted: boolean) => {
        markVisibleItemInteraction(item, { wasLiked: reacted, wasClicked: true });
        logFeedEvent(item, reacted ? 'like' : 'unlike');
        setFeedItems((current) => current.map((currentItem) => {
            if (currentItem.id === item.id && currentItem.kind === item.kind) {
                return {
                    ...currentItem,
                    like_count: Math.max(0, currentItem.like_count + (reacted ? 1 : -1)),
                    viewer_state: { ...currentItem.viewer_state, is_liked: reacted },
                };
            }
            if (item.kind === 'post' && currentItem.kind === 'reshare' && currentItem.original_post?.post_id === item.id) {
                return {
                    ...currentItem,
                    original_post: {
                        ...currentItem.original_post,
                        like_count: Math.max(0, currentItem.original_post.like_count + (reacted ? 1 : -1)),
                    },
                };
            }
            return currentItem;
        }));
    }, [logFeedEvent, markVisibleItemInteraction]);

    const handleFeedPostReact = useCallback(async (item: api.FeedItem): Promise<void> => {
        try {
            const res = await api.reactToFeedItem(item.id, item.kind);
            handleLocalReactionChange(item, res.reacted);
        } catch { }
    }, [handleLocalReactionChange]);

    const handleViewableItemsChanged = useCallback(({ changed, viewableItems }: {
        changed: Array<{ item: api.FeedItem | null; index: number | null; isViewable: boolean }>;
        viewableItems: Array<{ item: api.FeedItem | null; index: number | null }>;
    }) => {
        const nowMs = Date.now();
        const visibleIndexById = new Map<string, number>();
        viewableItems.forEach((entry, index) => {
            if (!entry.item) return;
            visibleIndexById.set(entry.item.id, entry.index ?? index);
        });

        changed.forEach((entry) => {
            const item = entry.item;
            if (!item) return;
            const key = getImpressionKey(item);
            if (entry.isViewable) {
                const active = activeImpressionsRef.current[key];
                const nextPosition = visibleIndexById.get(item.id) ?? entry.index ?? 0;
                if (active) {
                    active.position = nextPosition;
                    return;
                }
                activeImpressionsRef.current[key] = {
                    item,
                    feedMode: HOME_FEED_MODE,
                    position: nextPosition,
                    servedAt: ensureServedAt(item),
                    visibleSinceMs: nowMs,
                    wasClicked: false,
                    wasLiked: false,
                    wasCommented: false,
                };
                return;
            }
            flushImpression(key, nowMs);
        });
    }, [ensureServedAt, flushImpression, getImpressionKey]);

    useEffect(() => {
        if (!isActive || !focusRequest) return;

        void (async () => {
            const requestNonce = focusRequest.nonce;
            if (!feedItemsRef.current.some((item) => item.id === focusRequest.postId || item.original_post?.post_id === focusRequest.postId)) {
                await activeFeedQuery.refetch();
            }
            const post = findFeedPost(feedItemsRef.current, focusRequest.postId);
            if (!post) return;
            onOpenComments({
                itemId: post.id,
                itemKind: 'post',
                commentCount: post.comment_count,
            }, true);
            onFocusRequestConsumed?.(requestNonce);
        })();
    }, [activeFeedQuery, focusRequest, isActive, onFocusRequestConsumed, onOpenComments]);

    const listPaddingBottom = (hiddenUndo ? 110 : 72) + insets.bottom;
    const createFabBottom = hiddenUndo ? 60 + insets.bottom : 20;

    const renderItem = useCallback(({ item }: { item: api.FeedItem }) => {
        if (item.kind === 'reshare') {
            return (
                <ReshareCard
                    item={item}
                    resolvedImageSource={resolveEmbeddedImageSource(item)}
                    onOpenComments={handleOpenComments}
                    onPressUser={onOpenUserProfile}
                    onOpenItemActions={handleOpenItemActions}
                    onSharePost={handleSharePost}
                    onLocalReactionChange={handleLocalReactionChange}
                    showShareAction={FEED_RESHARES_ENABLED}
                />
            );
        }

        const post = feedItemToPostDisplayModel(item, currentUserId);
        return (
            <PostCard
                post={post}
                onReact={() => { void handleFeedPostReact(item); }}
                onOpenComments={() => handleOpenComments(item)}
                onPressUser={() => onOpenUserProfile({ userId: item.author.user_id, username: item.author.username, avatarUrl: item.author.avatar_url ?? undefined })}
                onShare={() => handleSharePost(item)}
                onOpenActions={() => handleOpenItemActions(item)}
                showShareAction={FEED_RESHARES_ENABLED}
            />
        );
    }, [currentUserId, handleFeedPostReact, handleOpenComments, handleOpenItemActions, handleSharePost, onOpenUserProfile]);

    const isInitialLoading = feedItems.length === 0 && activeFeedQuery.isLoading;
    const isRefreshing = activeFeedQuery.isRefetching && !activeFeedQuery.isFetchingNextPage;

    if (isInitialLoading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <ScreenContainer
            style={styles.container}
            {...(Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {})}
        >
            <FlatList
                ref={flatListRef}
                data={feedItems}
                keyExtractor={p => `${p.kind}:${p.id}`}
                {...feedListProps}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                onEndReached={feedListPagination.onEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={handleFeedMomentumScrollBegin}
                onScrollBeginDrag={handleFeedScrollBeginDrag}
                onScrollEndDrag={handleFeedScrollEnd}
                onMomentumScrollEnd={handleFeedScrollEnd}
                onScroll={handleFeedScroll}
                scrollEventThrottle={16}
                onViewableItemsChanged={handleViewableItemsChanged}
                viewabilityConfig={stylesViewabilityConfig}
                onScrollToIndexFailed={({ index, averageItemLength }) => {
                    flatListRef.current?.scrollToOffset({
                        offset: Math.max(index * averageItemLength - 120, 0),
                        animated: true,
                    });
                }}
                ListHeaderComponent={
                    <View style={styles.listHeader}>
                        <InfoNoticeCard
                            title="Community feed"
                            description={FEED_RESHARES_ENABLED
                                ? 'Post updates and see friend activity, community posts, and reshares.'
                                : 'Post updates and see friend activity and relevant community posts.'}
                            style={styles.headerNotice}
                        />
                    </View>
                }
                ListEmptyComponent={
                    <EmptyState
                        title="No posts yet."
                        description={FEED_RESHARES_ENABLED
                            ? 'Friend posts, community updates, and reshares will show up here as people share.'
                            : 'Friend posts and community updates will show up here as people post.'}
                    />
                }
                renderItem={renderItem}
                ListFooterComponent={activeFeedQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                contentContainerStyle={[
                    styles.feedListContent,
                    { paddingTop: ContentInsets.screenHorizontal + topContentInset, paddingBottom: listPaddingBottom },
                ]}
            />

            {isActive && feedScrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}

            <CreatePostFab
                visible={isActive && Boolean(user) && isCreateFabVisible}
                bottom={createFabBottom}
                onPress={onOpenCreatePost}
            />

            {hiddenUndo ? (
                <View style={styles.hiddenUndoBanner}>
                    <Text style={styles.hiddenUndoText}>Post hidden.</Text>
                    <TouchableOpacity style={styles.hiddenUndoButton} onPress={handleUndoHide}>
                        <Text style={styles.hiddenUndoButtonText}>Undo</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            <Modal
                visible={shareTarget !== null}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    if (isSubmittingShare) return;
                    setShareTarget(null);
                    setShareCommentary('');
                }}
            >
                <View style={styles.shareComposerBackdrop}>
                    <View style={styles.shareComposerCard}>
                        <Text style={styles.shareComposerTitle}>Share post</Text>
                        <Text style={styles.shareComposerDescription}>
                            Add a note to turn this into a quote share, or share it as-is.
                        </Text>
                        <TextInput
                            style={styles.shareComposerInput}
                            placeholder="Add your thoughts..."
                            placeholderTextColor={Colors.text.muted}
                            value={shareCommentary}
                            onChangeText={setShareCommentary}
                            multiline
                            editable={!isSubmittingShare}
                            maxLength={500}
                        />
                        <View style={styles.shareComposerActions}>
                            <TouchableOpacity
                                style={styles.shareComposerSecondary}
                                disabled={isSubmittingShare}
                                onPress={() => {
                                    setShareTarget(null);
                                    setShareCommentary('');
                                }}
                            >
                                <Text style={styles.shareComposerSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.shareComposerPrimary, isSubmittingShare && styles.shareComposerPrimaryDisabled]}
                                disabled={isSubmittingShare}
                                onPress={handleSubmitShare}
                            >
                                {isSubmittingShare
                                    ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                    : <Text style={styles.shareComposerPrimaryText}>Share</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScreenContainer>
    );
}

function areReshareCardPropsEqual(prev: ReshareCardProps, next: ReshareCardProps) {
    return prev.item === next.item
        && prev.resolvedImageSource === next.resolvedImageSource
        && prev.onOpenComments === next.onOpenComments
        && prev.onPressUser === next.onPressUser
        && prev.onOpenItemActions === next.onOpenItemActions
        && prev.onSharePost === next.onSharePost
        && prev.onLocalReactionChange === next.onLocalReactionChange
        && prev.showShareAction === next.showShareAction;
}

function renderPostTags(tags: string[]): React.ReactElement | null {
    if (tags.length === 0) return null;
    return (
        <View style={styles.postTags}>
            {tags.map((tag) => (
                <Text key={tag} style={styles.postTag}>#{tag}</Text>
            ))}
        </View>
    );
}

function feedItemToPost(item: api.FeedItem): api.Post {
    return {
        id: item.id,
        user_id: item.author.user_id,
        username: item.author.username,
        avatar_url: item.author.avatar_url ?? undefined,
        body: item.body,
        source_type: item.source_type,
        source_id: item.source_id,
        source_label: item.source_label,
        created_at: item.created_at,
        comment_count: item.comment_count,
        like_count: item.like_count,
        images: item.images,
        tags: item.tags,
    };
}

function findFeedPost(items: api.FeedItem[], postId: string): api.Post | null {
    for (const item of items) {
        if (item.kind === 'post' && item.id === postId) {
            return feedItemToPost(item);
        }
        if (item.kind === 'reshare' && item.original_post?.post_id === postId) {
            return {
                id: item.original_post.post_id,
                user_id: item.original_post.author.user_id,
                username: item.original_post.author.username,
                avatar_url: item.original_post.author.avatar_url ?? undefined,
                body: item.original_post.body,
                created_at: item.original_post.created_at,
                comment_count: item.original_post.comment_count,
                like_count: item.original_post.like_count,
                images: item.original_post.images,
                tags: item.original_post.tags,
            };
        }
    }
    return null;
}

function resolveEmbeddedImageSource(item: api.FeedItem): string | null {
    const image = item.original_post?.images[0];
    return image?.image_url ?? null;
}

const stylesViewabilityConfig = {
    itemVisiblePercentThreshold: 60,
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    feedListContent: {
        paddingTop: ContentInsets.screenHorizontal,
    },
    listHeader: {
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    headerNotice: {
        marginHorizontal: ContentInsets.screenHorizontal,
    },
    postCard: {
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
    },
    postHeadBody: { flex: 1, minWidth: 0 },
    postHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, paddingBottom: Spacing.sm },
    headActionButton: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    postTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
    postName: { fontSize: Typography.sizes.md, fontWeight: '500', color: Colors.text.primary },
    postContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
    postMeta: { fontSize: Typography.sizes.xs, color: Colors.text.muted },
    postSource: { fontSize: Typography.sizes.xs, fontWeight: '600', color: Colors.primary, marginTop: 2 },
    reshareLabel: { fontSize: Typography.sizes.xs, color: Colors.primary, fontWeight: '600' },
    postBody: { fontSize: Typography.sizes.base, color: Colors.text.secondary, lineHeight: 19 },
    postImage: {
        width: '100%',
        aspectRatio: 1.2,
        borderRadius: Radius.md,
        marginTop: Spacing.sm,
        backgroundColor: Colors.bg.surface,
    },
    postTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        marginTop: Spacing.sm,
    },
    postTag: {
        overflow: 'hidden',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        backgroundColor: Colors.primarySubtle,
        color: Colors.primary,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
    },
    postFoot: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.md, paddingVertical: 10 },
    postAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    postActionText: { fontSize: Typography.sizes.sm, color: Colors.text.muted },
    liked: { color: Colors.danger },
    reshareEmbed: {
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.raised,
        gap: Spacing.sm,
    },
    reshareEmbedHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    reshareOriginalName: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    shareComposerBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    shareComposerCard: {
        width: '100%',
        maxWidth: 420,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.page,
        borderWidth: 1,
        borderColor: Colors.border.default,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    shareComposerTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    shareComposerDescription: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
        lineHeight: 19,
    },
    shareComposerInput: {
        minHeight: 120,
        maxHeight: 220,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: Typography.sizes.base,
        lineHeight: 20,
        color: Colors.text.primary,
        textAlignVertical: 'top',
    },
    shareComposerActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
    },
    shareComposerSecondary: {
        minWidth: 88,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareComposerSecondaryText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    shareComposerPrimary: {
        minWidth: 88,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareComposerPrimaryDisabled: {
        opacity: 0.72,
    },
    shareComposerPrimaryText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    hiddenUndoBanner: {
        position: 'absolute',
        left: Spacing.md,
        right: Spacing.md,
        bottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.page,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    hiddenUndoText: {
        flex: 1,
        fontSize: Typography.sizes.sm,
        color: Colors.text.primary,
        fontWeight: '600',
    },
    hiddenUndoButton: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
    },
    hiddenUndoButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    footerLoader: { paddingVertical: Spacing.md },
});
