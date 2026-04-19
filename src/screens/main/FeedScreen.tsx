import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, RefreshControl, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';
import { formatReadableTimestamp } from '../../utils/date';

const EMPTY_COMMENTS: api.Comment[] = [];

interface PostCardProps {
    post: api.Post;
    displayedCommentCount: number;
    currentUserId: string;
    comments: api.Comment[];
    commentsExpanded: boolean;
    commentsLoading: boolean;
    commentsLoadingMore: boolean;
    hasMoreComments: boolean;
    commentSubmitting: boolean;
    commentDraft: string;
    onCommentDraftChange: (postId: string, value: string) => void;
    onToggleComments: (postId: string) => void;
    onSubmitComment: (post: api.Post) => void;
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onRegisterCommentSentinel: (postId: string, ref: View | null) => void;
}

const PostCard = React.memo(function PostCard({
    post,
    displayedCommentCount,
    currentUserId,
    comments,
    commentsExpanded,
    commentsLoading,
    commentsLoadingMore,
    hasMoreComments,
    commentSubmitting,
    commentDraft,
    onCommentDraftChange,
    onToggleComments,
    onSubmitComment,
    onPressUser,
    onRegisterCommentSentinel,
}: PostCardProps) {
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post.like_count);
    const isOwn = post.user_id === currentUserId;

    useEffect(() => {
        setLikeCount(post.like_count);
    }, [post.like_count]);

    const handleReact = useCallback(async () => {
        try {
            const res = await api.reactToPost(post.id);
            setLiked(res.reacted);
            setLikeCount(prev => res.reacted ? prev + 1 : prev - 1);
        } catch { }
    }, [post.id]);

    const handleToggleComments = useCallback(() => onToggleComments(post.id), [post.id, onToggleComments]);
    const handleCommentDraftChange = useCallback((value: string) => onCommentDraftChange(post.id, value), [post.id, onCommentDraftChange]);
    const handleSubmitComment = useCallback(() => onSubmitComment(post), [post, onSubmitComment]);
    const handlePressUser = useCallback(() => onPressUser({ userId: post.user_id, username: post.username, avatarUrl: post.avatar_url }), [post.user_id, post.username, post.avatar_url, onPressUser]);
    const handleRegisterSentinel = useCallback((ref: View | null) => onRegisterCommentSentinel(post.id, ref), [post.id, onRegisterCommentSentinel]);

    return (
        <View style={styles.postCard}>
            <View style={styles.postHead}>
                <TouchableOpacity onPress={isOwn ? undefined : handlePressUser} disabled={isOwn}>
                    <Avatar username={post.username} avatarUrl={post.avatar_url} size={36} />
                </TouchableOpacity>
                <View style={styles.postHeadBody}>
                    <View style={styles.postTitleRow}>
                        <Text style={styles.postName}>{formatUsername(post.username)}</Text>
                        <Text style={styles.postMeta}>{formatReadableTimestamp(post.created_at)}</Text>
                    </View>
                </View>
            </View>
            <View style={styles.postContent}>
                <Text style={styles.postBody}>{post.body}</Text>
            </View>
            <View style={styles.postFoot}>
                <TouchableOpacity style={styles.postAction} onPress={handleReact}>
                    <Ionicons
                        name={liked ? 'heart' : 'heart-outline'}
                        size={16}
                        color={liked ? Colors.danger : Colors.light.textTertiary}
                    />
                    <Text style={[styles.postActionText, liked && styles.liked]}>
                        {likeCount > 0 ? likeCount : 'Like'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postAction} onPress={handleToggleComments}>
                    <Ionicons
                        name={commentsExpanded ? 'chatbubble' : 'chatbubble-outline'}
                        size={15}
                        color={Colors.light.textTertiary}
                    />
                    <Text style={styles.postActionText}>
                        {displayedCommentCount > 0 ? `${displayedCommentCount} comments` : 'Comment'}
                    </Text>
                </TouchableOpacity>
            </View>
            {(commentsExpanded || comments.length > 0) && (
                <View style={[styles.commentsSection, !commentsExpanded && { display: 'none' }]}>
                    {commentsLoading ? (
                        <View style={styles.commentsLoading}>
                            <ActivityIndicator color={Colors.primary} size="small" />
                        </View>
                    ) : comments.length > 0 ? (
                        <View style={styles.commentsList}>
                            {comments.map(comment => (
                                <View key={comment.id} style={styles.commentRow}>
                                    <Avatar username={comment.username} avatarUrl={comment.avatar_url} size={28} fontSize={11} />
                                    <View style={styles.commentBodyWrap}>
                                        <View style={styles.commentBubble}>
                                            <View style={styles.commentHeader}>
                                                <Text style={styles.commentAuthor}>{formatUsername(comment.username)}</Text>
                                                <Text style={styles.commentMeta}>{formatReadableTimestamp(comment.created_at)}</Text>
                                            </View>
                                            <Text style={styles.commentBody}>{comment.body}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.commentsEmpty}>No comments yet.</Text>
                    )}

                    {hasMoreComments && <View ref={handleRegisterSentinel} style={styles.commentSentinel} />}
                    {commentsLoadingMore && <ActivityIndicator size="small" color={Colors.primary} style={styles.commentsLoadingMore} />}

                    <View style={styles.commentComposer}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Write a comment"
                            placeholderTextColor={Colors.light.textTertiary}
                            value={commentDraft}
                            onChangeText={handleCommentDraftChange}
                            editable={!commentSubmitting}
                        />
                        <TouchableOpacity
                            style={[styles.commentSendButton, (commentSubmitting || !commentDraft.trim()) && styles.commentSendButtonDisabled]}
                            onPress={handleSubmitComment}
                            disabled={commentSubmitting || !commentDraft.trim()}
                        >
                            <Text style={styles.commentSendButtonText}>{commentSubmitting ? '...' : 'Send'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
});

interface FeedScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

export function FeedScreen({
    isActive,
    onOpenUserProfile,
}: FeedScreenProps) {
    const { user } = useAuth();
    const [posts, setPosts] = useState<api.Post[]>([]);
    const [loading, setLoading] = useState(isActive);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [composing, setComposing] = useState(false);
    const [draft, setDraft] = useState('');
    const [posting, setPosting] = useState(false);
    const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());
    const [commentLoadingIds, setCommentLoadingIds] = useState<Set<string>>(new Set());
    const [commentLoadingMoreIds, setCommentLoadingMoreIds] = useState<Set<string>>(new Set());
    const [commentSubmittingIds, setCommentSubmittingIds] = useState<Set<string>>(new Set());
    const [commentsByPostId, setCommentsByPostId] = useState<Record<string, api.Comment[]>>({});
    const [commentHasMoreByPostId, setCommentHasMoreByPostId] = useState<Record<string, boolean>>({});
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
    const hasLoadedRef = useRef(false);
    const wasActiveRef = useRef(false);
    const loadInFlightRef = useRef<Promise<void> | null>(null);
    const nextCursorRef = useRef<string | undefined>(undefined);
    const loadedCommentPostIdsRef = useRef<Set<string>>(new Set());
    const commentCursorRef = useRef<Record<string, string | undefined>>({});
    const commentHasMoreRef = useRef<Record<string, boolean>>({});
    const commentLoadingMoreRef = useRef<Set<string>>(new Set());
    const commentSentinelRefs = useRef<Record<string, View | null>>({});
    const flatListRef = useRef<FlatList>(null);

    // Feed paging reuses a single in-flight request so pull-to-refresh and
    // scroll pagination cannot stampede the same endpoint concurrently.
    const load = useCallback(async (cursor?: string, replace = false) => {
        if (loadInFlightRef.current) return loadInFlightRef.current;

        const request = (async () => {
            try {
                const feedData = await api.getFeed(cursor, 20);
                setPosts(current => replace ? (feedData.items ?? []) : [...current, ...(feedData.items ?? [])]);
                nextCursorRef.current = feedData.next_cursor ?? undefined;
                setHasMore(feedData.has_more);
            } catch { }
        })();

        loadInFlightRef.current = request;

        try {
            await request;
        } finally {
            loadInFlightRef.current = null;
        }
    }, []);

    useEffect(() => {
        const becameActive = isActive && !wasActiveRef.current;
        wasActiveRef.current = isActive;
        if (!becameActive) return;

        const isFirstLoad = !hasLoadedRef.current;
        if (isFirstLoad) setLoading(true);

        load(undefined, true).finally(() => {
            hasLoadedRef.current = true;
            if (isFirstLoad) setLoading(false);
        });
    }, [isActive, load]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await load(undefined, true);
        } finally {
            setRefreshing(false);
        }
    };

    const handlePost = async () => {
        if (!draft.trim()) return;
        setPosting(true);
        try {
            await api.createPost(draft.trim());
            setDraft('');
            setComposing(false);
            await load(undefined, true);
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPosting(false);
        }
    };

    // Feed pages append in order; comment state stays separate so expanding a
    // thread does not force a feed-wide reload.
    const handleLoadMore = async () => {
        if (!isActive || loading || refreshing || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            await load(nextCursorRef.current);
        } finally {
            setLoadingMore(false);
        }
    };

    const loadComments = useCallback(async (postId: string) => {
        setCommentLoadingIds(prev => new Set(prev).add(postId));
        try {
            const result = await api.getComments(postId);
            setCommentsByPostId(prev => ({ ...prev, [postId]: result.items ?? [] }));
            commentCursorRef.current[postId] = result.next_cursor ?? undefined;
            commentHasMoreRef.current[postId] = result.has_more;
            setCommentHasMoreByPostId(prev => ({ ...prev, [postId]: result.has_more }));
            loadedCommentPostIdsRef.current.add(postId);
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setCommentLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(postId);
                return next;
            });
        }
    }, []);

    const handleToggleComments = useCallback((postId: string) => {
        let shouldLoad = false;
        setExpandedCommentIds(prev => {
            const next = new Set(prev);
            if (next.has(postId)) {
                next.delete(postId);
            } else {
                next.add(postId);
                shouldLoad = !loadedCommentPostIdsRef.current.has(postId);
            }
            return next;
        });
        if (shouldLoad) loadComments(postId).catch(() => {});
    }, [loadComments]);

    const loadMoreComments = useCallback(async (postId: string) => {
        if (commentLoadingMoreRef.current.has(postId)) return;
        if (!commentHasMoreRef.current[postId]) return;

        commentLoadingMoreRef.current.add(postId);
        setCommentLoadingMoreIds(new Set(commentLoadingMoreRef.current));

        try {
            const result = await api.getComments(postId, commentCursorRef.current[postId]);
            commentCursorRef.current[postId] = result.next_cursor ?? undefined;
            commentHasMoreRef.current[postId] = result.has_more;
            setCommentHasMoreByPostId(prev => ({ ...prev, [postId]: result.has_more }));
            setCommentsByPostId(prev => ({
                ...prev,
                [postId]: [...(prev[postId] ?? []), ...(result.items ?? [])],
            }));
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            commentLoadingMoreRef.current.delete(postId);
            setCommentLoadingMoreIds(new Set(commentLoadingMoreRef.current));
        }
    }, []);

    const checkCommentSentinels = useCallback(() => {
        const screenHeight = Dimensions.get('window').height;
        Object.entries(commentSentinelRefs.current).forEach(([postId, sentinelRef]) => {
            if (!sentinelRef) return;
            if (!commentHasMoreRef.current[postId]) return;
            if (commentLoadingMoreRef.current.has(postId)) return;
            sentinelRef.measure((_x, _y, _w, _h, _pageX, pageY) => {
                if (pageY <= screenHeight + 150) {
                    loadMoreComments(postId);
                }
            });
        });
    }, [loadMoreComments]);

    // Re-check sentinels after new pages load in case the sentinel is already on screen.
    useEffect(() => {
        checkCommentSentinels();
    }, [commentHasMoreByPostId, checkCommentSentinels]);

    const handleCommentDraftChange = useCallback((postId: string, value: string) => {
        setCommentDrafts(prev => ({ ...prev, [postId]: value }));
    }, []);

    const handleSubmitComment = useCallback(async (post: api.Post) => {
        const draftValue = commentDrafts[post.id]?.trim() ?? '';
        if (!draftValue || !user) return;

        setCommentSubmittingIds(prev => new Set(prev).add(post.id));
        try {
            const res = await api.addComment(post.id, draftValue);
            const newComment: api.Comment = {
                id: res.id,
                user_id: user.id,
                username: user.username,
                avatar_url: user.avatar_url,
                body: draftValue,
                created_at: new Date().toISOString(),
            };

            setCommentsByPostId(prev => ({ ...prev, [post.id]: [...(prev[post.id] ?? []), newComment] }));
            loadedCommentPostIdsRef.current.add(post.id);
            setCommentDrafts(prev => ({ ...prev, [post.id]: '' }));
            setPosts(prev => prev.map(item => item.id === post.id ? { ...item, comment_count: item.comment_count + 1 } : item));
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setCommentSubmittingIds(prev => {
                const next = new Set(prev);
                next.delete(post.id);
                return next;
            });
        }
    }, [commentDrafts, user]);

    const handleRegisterCommentSentinel = useCallback((postId: string, ref: View | null) => {
        commentSentinelRefs.current[postId] = ref;
    }, []);

    const currentUserId = user?.id ?? '';

    const renderItem = useCallback(({ item }: { item: api.Post }) => (
        <PostCard
            post={item}
            displayedCommentCount={item.comment_count}
            currentUserId={currentUserId}
            comments={commentsByPostId[item.id] ?? EMPTY_COMMENTS}
            commentsExpanded={expandedCommentIds.has(item.id)}
            commentsLoading={commentLoadingIds.has(item.id)}
            commentsLoadingMore={commentLoadingMoreIds.has(item.id)}
            hasMoreComments={commentHasMoreByPostId[item.id] ?? false}
            commentSubmitting={commentSubmittingIds.has(item.id)}
            commentDraft={commentDrafts[item.id] ?? ''}
            onCommentDraftChange={handleCommentDraftChange}
            onToggleComments={handleToggleComments}
            onSubmitComment={handleSubmitComment}
            onPressUser={onOpenUserProfile}
            onRegisterCommentSentinel={handleRegisterCommentSentinel}
        />
    ), [
        currentUserId, commentsByPostId, expandedCommentIds, commentLoadingIds,
        commentLoadingMoreIds, commentHasMoreByPostId, commentSubmittingIds, commentDrafts,
        handleCommentDraftChange, handleToggleComments, handleSubmitComment,
        onOpenUserProfile, handleRegisterCommentSentinel,
    ]);

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={posts}
                keyExtractor={p => p.id}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
                onScroll={checkCommentSentinels}
                scrollEventThrottle={200}
                ListHeaderComponent={
                    <View style={styles.composeBar}>
                        {user && <Avatar username={user.username} avatarUrl={user.avatar_url} size={28} />}
                        {composing ? (
                            <TextInput
                                style={styles.composeInput}
                                placeholder="What's on your mind?"
                                placeholderTextColor={Colors.light.textTertiary}
                                value={draft}
                                onChangeText={setDraft}
                                multiline
                                autoFocus
                            />
                        ) : (
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => setComposing(true)}>
                                <Text style={styles.composePlaceholder}>What's on your mind?</Text>
                            </TouchableOpacity>
                        )}
                        {composing && (
                            <TouchableOpacity
                                style={[styles.postBtn, posting && { opacity: 0.6 }]}
                                onPress={handlePost}
                                disabled={posting}
                            >
                                <Text style={styles.postBtnText}>Post</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No posts yet.</Text>
                        <Text style={styles.emptySubtext}>Community posts will show up here as people share.</Text>
                    </View>
                }
                renderItem={renderItem}
                ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                contentContainerStyle={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.md, paddingBottom: 32 },
    composeBar: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        padding: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    composeInput: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textPrimary, maxHeight: 100 },
    composePlaceholder: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textTertiary, textAlignVertical: 'center' },
    postBtn: { backgroundColor: Colors.success, borderRadius: Radii.sm, paddingHorizontal: Spacing.md, paddingVertical: 6 },
    postBtnText: { color: Colors.textOn.primary, fontSize: Typography.sizes.sm, fontWeight: '600' },
    postCard: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.lg,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
    },
    postHeadBody: { flex: 1, minWidth: 0 },
    postHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, paddingBottom: Spacing.sm },
    postTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
    postName: { fontSize: Typography.sizes.md, fontWeight: '500', color: Colors.light.textPrimary },
    postContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
    postMeta: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary },
    postBody: { fontSize: Typography.sizes.base, color: Colors.light.textSecondary, lineHeight: 19 },
    postFoot: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.md, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: Colors.light.border },
    postAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    postActionText: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
    liked: { color: Colors.danger },
    commentsSection: {
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    commentsLoading: { paddingVertical: Spacing.sm, alignItems: 'center' },
    commentsList: { gap: Spacing.sm },
    commentsEmpty: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
    commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    commentBodyWrap: { flex: 1, minWidth: 0 },
    commentBubble: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 8,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    commentAuthor: { fontSize: Typography.sizes.sm, fontWeight: '600', color: Colors.light.textPrimary },
    commentBody: { fontSize: Typography.sizes.sm, color: Colors.light.textSecondary, lineHeight: 18 },
    commentMeta: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
    },
    commentSentinel: { height: 1 },
    commentsLoadingMore: { marginVertical: 4 },
    commentComposer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    commentInput: {
        flex: 1,
        backgroundColor: Colors.light.background,
        borderRadius: Radii.full,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textPrimary,
    },
    commentSendButton: { backgroundColor: Colors.success, borderRadius: Radii.full, paddingHorizontal: Spacing.md, paddingVertical: 10 },
    commentSendButtonDisabled: { opacity: 0.6 },
    commentSendButtonText: { fontSize: Typography.sizes.sm, fontWeight: '600', color: Colors.textOn.primary },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
    emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm, textAlign: 'center' },
    footerLoader: { paddingVertical: Spacing.md },
});
