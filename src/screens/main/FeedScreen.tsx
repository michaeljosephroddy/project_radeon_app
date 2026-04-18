import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';

function timeAgo(dateStr: string): string {
    // Feed timestamps stay intentionally compact because they sit in dense cards.
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

interface PostCardProps {
    post: api.Post;
    displayedCommentCount: number;
    currentUserId: string;
    isFollowing: boolean;
    followPending: boolean;
    comments: api.Comment[];
    commentsExpanded: boolean;
    commentsLoading: boolean;
    commentSubmitting: boolean;
    commentDraft: string;
    onCommentDraftChange: (value: string) => void;
    onToggleComments: () => void;
    onSubmitComment: () => void;
    onPressUser: () => void;
    onPressFollow: () => void;
}

function PostCard({
    post,
    displayedCommentCount,
    currentUserId,
    isFollowing,
    followPending,
    comments,
    commentsExpanded,
    commentsLoading,
    commentSubmitting,
    commentDraft,
    onCommentDraftChange,
    onToggleComments,
    onSubmitComment,
    onPressUser,
    onPressFollow,
}: PostCardProps) {
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post.like_count);
    const isOwn = post.user_id === currentUserId;

    useEffect(() => {
        setLikeCount(post.like_count);
    }, [post.like_count]);

    const handleReact = async () => {
        try {
            const res = await api.reactToPost(post.id);
            setLiked(res.reacted);
            // Update the count optimistically from the server toggle response instead
            // of forcing the entire feed to refetch after every like.
            setLikeCount(prev => res.reacted ? prev + 1 : prev - 1);
        } catch { }
    };

    return (
        <View style={styles.postCard}>
            <View style={styles.postHead}>
                <TouchableOpacity onPress={isOwn ? undefined : onPressUser} disabled={isOwn}>
                    <Avatar username={post.username} avatarUrl={post.avatar_url} size={36} />
                </TouchableOpacity>
                <View style={styles.postHeadBody}>
                    <Text style={styles.postName}>{formatUsername(post.username)}</Text>
                    <Text style={styles.postMeta}>{timeAgo(post.created_at)}</Text>
                </View>
                {!isOwn && (
                    <TouchableOpacity
                        style={[
                            styles.followPill,
                            isFollowing && styles.followingPill,
                            followPending && styles.followPillDisabled,
                        ]}
                        onPress={onPressFollow}
                        disabled={isFollowing || followPending}
                    >
                        <Text style={[styles.followPillText, isFollowing && styles.followingPillText]}>
                            {isFollowing ? 'Following' : '+ Follow'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.postBody}>{post.body}</Text>
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
                <TouchableOpacity style={styles.postAction} onPress={onToggleComments}>
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
            {commentsExpanded && (
                <View style={styles.commentsSection}>
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
                                            <Text style={styles.commentAuthor}>{formatUsername(comment.username)}</Text>
                                            <Text style={styles.commentBody}>{comment.body}</Text>
                                        </View>
                                        <Text style={styles.commentMeta}>{timeAgo(comment.created_at)}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.commentsEmpty}>No comments yet.</Text>
                    )}

                    <View style={styles.commentComposer}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Write a comment"
                            placeholderTextColor={Colors.light.textTertiary}
                            value={commentDraft}
                            onChangeText={onCommentDraftChange}
                            editable={!commentSubmitting}
                        />
                        <TouchableOpacity
                            style={[styles.commentSendButton, (commentSubmitting || !commentDraft.trim()) && styles.commentSendButtonDisabled]}
                            onPress={onSubmitComment}
                            disabled={commentSubmitting || !commentDraft.trim()}
                        >
                            <Text style={styles.commentSendButtonText}>{commentSubmitting ? '...' : 'Send'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}

interface FeedScreenProps {
    isActive: boolean;
    followingIds: Set<string>;
    onFollowChange: (userId: string, following: boolean) => void;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

export function FeedScreen({ isActive, followingIds, onFollowChange, onOpenUserProfile }: FeedScreenProps) {
    const { user } = useAuth();
    const [posts, setPosts] = useState<api.Post[]>([]);
    const [loading, setLoading] = useState(isActive);
    const [refreshing, setRefreshing] = useState(false);
    const [composing, setComposing] = useState(false);
    const [draft, setDraft] = useState('');
    const [posting, setPosting] = useState(false);
    const [pendingFollows, setPendingFollows] = useState<Set<string>>(new Set());
    const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());
    const [commentLoadingIds, setCommentLoadingIds] = useState<Set<string>>(new Set());
    const [commentSubmittingIds, setCommentSubmittingIds] = useState<Set<string>>(new Set());
    const [commentsByPostId, setCommentsByPostId] = useState<Record<string, api.Comment[]>>({});
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
    const hasLoadedRef = useRef(false);
    const wasActiveRef = useRef(false);
    const loadInFlightRef = useRef<Promise<void> | null>(null);
    const loadedCommentPostIdsRef = useRef<Set<string>>(new Set());

    const load = useCallback(async () => {
        if (loadInFlightRef.current) return loadInFlightRef.current;

        // Share one in-flight promise across refreshes/initial mount so concurrent
        // callers do not stampede the feed endpoint.
        const request = (async () => {
            try {
                const feedData = await api.getFeed();
                setPosts(feedData ?? []);
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

        // Tabs stay mounted, so only trigger the expensive first load when this tab
        // becomes visible rather than every parent re-render.
        if (!becameActive) return;

        const isFirstLoad = !hasLoadedRef.current;
        if (isFirstLoad) setLoading(true);

        load().finally(() => {
            hasLoadedRef.current = true;
            if (isFirstLoad) setLoading(false);
        });
    }, [isActive, load]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await load();
        } finally {
            setRefreshing(false);
        }
    };

    const handleFollow = async (post: api.Post) => {
        if (followingIds.has(post.user_id)) return;

        // Mirror the follow immediately in parent-owned state so every screen that
        // consumes followingIds stays in sync without waiting for the network.
        setPendingFollows(prev => new Set(prev).add(post.user_id));
        onFollowChange(post.user_id, true);

        try {
            await api.followUser(post.user_id);
        } catch (e: unknown) {
            onFollowChange(post.user_id, false);
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingFollows(prev => {
                const next = new Set(prev);
                next.delete(post.user_id);
                return next;
            });
        }
    };

    const handlePost = async () => {
        if (!draft.trim()) return;
        setPosting(true);
        try {
            await api.createPost(draft.trim());
            setDraft('');
            setComposing(false);
            await load();
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPosting(false);
        }
    };

    const loadComments = useCallback(async (postId: string) => {
        setCommentLoadingIds(prev => new Set(prev).add(postId));
        try {
            const comments = await api.getComments(postId);
            setCommentsByPostId(prev => ({ ...prev, [postId]: comments ?? [] }));
            // Keep the feed card count aligned with the fetched thread because the
            // summary count in the feed payload can lag behind comment creation.
            setPosts(prev =>
                prev.map(post =>
                    post.id === postId
                        ? { ...post, comment_count: comments?.length ?? 0 }
                        : post
                )
            );
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
                // Fetch a thread only on first expansion; after that we keep the
                // local cache warm so collapsing/reopening feels instant.
                shouldLoad = !loadedCommentPostIdsRef.current.has(postId);
            }
            return next;
        });

        if (shouldLoad) {
            loadComments(postId).catch(() => {});
        }
    }, [loadComments]);

    const handleCommentDraftChange = useCallback((postId: string, value: string) => {
        setCommentDrafts(prev => ({ ...prev, [postId]: value }));
    }, []);

    const handleSubmitComment = useCallback(async (post: api.Post) => {
        const draftValue = commentDrafts[post.id]?.trim() ?? '';
        if (!draftValue || !user) return;

        setCommentSubmittingIds(prev => new Set(prev).add(post.id));
        try {
            const res = await api.addComment(post.id, draftValue);
            // Insert the new comment locally so the user sees it immediately even
            // though the feed endpoint itself is not reloaded.
            const newComment: api.Comment = {
                id: res.id,
                user_id: user.id,
                username: user.username,
                avatar_url: user.avatar_url,
                body: draftValue,
                created_at: new Date().toISOString(),
            };

            let nextCommentCount = 1;
            setCommentsByPostId(prev => {
                const nextComments = [...(prev[post.id] ?? []), newComment];
                nextCommentCount = nextComments.length;
                return {
                    ...prev,
                    [post.id]: nextComments,
                };
            });
            loadedCommentPostIdsRef.current.add(post.id);
            setCommentDrafts(prev => ({ ...prev, [post.id]: '' }));
            setPosts(prev =>
                prev.map(item =>
                    item.id === post.id
                        ? { ...item, comment_count: nextCommentCount }
                        : item
                )
            );
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

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={posts}
                keyExtractor={p => p.id}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
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
                        <Text style={styles.emptySubtext}>Follow people to see their posts here.</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const loadedComments = commentsByPostId[item.id];
                    const displayedCommentCount = loadedComments
                        ? Math.max(item.comment_count, loadedComments.length)
                        : item.comment_count;

                    return (
                    <PostCard
                        post={item}
                        displayedCommentCount={displayedCommentCount}
                        currentUserId={user?.id ?? ''}
                        isFollowing={followingIds.has(item.user_id)}
                        followPending={pendingFollows.has(item.user_id)}
                        comments={loadedComments ?? []}
                        commentsExpanded={expandedCommentIds.has(item.id)}
                        commentsLoading={commentLoadingIds.has(item.id)}
                        commentSubmitting={commentSubmittingIds.has(item.id)}
                        commentDraft={commentDrafts[item.id] ?? ''}
                        onCommentDraftChange={value => handleCommentDraftChange(item.id, value)}
                        onToggleComments={() => handleToggleComments(item.id)}
                        onSubmitComment={() => handleSubmitComment(item)}
                        onPressUser={() => onOpenUserProfile({
                            userId: item.user_id,
                            username: item.username,
                            avatarUrl: item.avatar_url,
                        })}
                        onPressFollow={() => handleFollow(item)}
                    />
                    );
                }}
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
    composeInput: {
        flex: 1,
        fontSize: Typography.sizes.base,
        color: Colors.light.textPrimary,
        maxHeight: 100,
    },
    composePlaceholder: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textTertiary, textAlignVertical: 'center' },
    postBtn: {
        backgroundColor: Colors.success,
        borderRadius: Radii.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    postBtnText: { color: Colors.textOn.primary, fontSize: Typography.sizes.sm, fontWeight: '600' },

    postCard: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.lg,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
    },
    postHeadBody: { flex: 1 },
    postHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    postName: { fontSize: Typography.sizes.md, fontWeight: '500', color: Colors.light.textPrimary },
    postMeta: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary, marginTop: 1 },
    postBody: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textSecondary,
        lineHeight: 19,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
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
    liked: { color: Colors.danger },
    commentsSection: {
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    commentsLoading: {
        paddingVertical: Spacing.sm,
        alignItems: 'center',
    },
    commentsList: { gap: Spacing.sm },
    commentsEmpty: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    commentRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
    },
    commentBodyWrap: { flex: 1, minWidth: 0 },
    commentBubble: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 8,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
    },
    commentAuthor: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        marginBottom: 2,
    },
    commentBody: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        lineHeight: 18,
    },
    commentMeta: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
        marginTop: 4,
        paddingHorizontal: 2,
    },
    commentComposer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
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
    commentSendButton: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    commentSendButtonDisabled: {
        opacity: 0.6,
    },
    commentSendButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.textOn.primary,
    },

    followPill: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    followPillDisabled: { opacity: 0.6 },
    followingPill: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    followPillText: { fontSize: Typography.sizes.xs, color: '#FFFFFF', fontWeight: '500' },
    followingPillText: { color: Colors.light.textTertiary },

    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
    emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm, textAlign: 'center' },
});
