import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, RefreshControl, ActivityIndicator, Alert, Dimensions,
    Platform, KeyboardAvoidingView, Keyboard, BackHandler, LayoutAnimation, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';
import { formatReadableTimestamp } from '../../utils/date';

const EMPTY_COMMENTS: api.Comment[] = [];
const EMPTY_USERS: api.User[] = [];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ActiveMentionState {
    query: string;
    tokenStart: number;
    tokenEnd: number;
}

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
    onToggleComments: (postId: string) => void;
    onStartComment: (post: api.Post) => void;
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onRegisterCommentSentinel: (postId: string, ref: View | null) => void;
    isCommentComposerActive: boolean;
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
    onToggleComments,
    onStartComment,
    onPressUser,
    onRegisterCommentSentinel,
    isCommentComposerActive,
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
    const handleStartComment = useCallback(() => onStartComment(post), [post, onStartComment]);
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
                                            <Text style={styles.commentBody}>
                                                {renderCommentBody(comment, onPressUser)}
                                            </Text>
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
                        <TouchableOpacity
                            style={[styles.commentComposerLauncher, isCommentComposerActive && styles.commentComposerLauncherActive]}
                            onPress={handleStartComment}
                            disabled={commentSubmitting}
                        >
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.light.textTertiary} />
                            <Text style={styles.commentComposerLauncherText}>
                                {isCommentComposerActive ? 'Writing a comment…' : 'Write a comment'}
                            </Text>
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
    const ScreenContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
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
    const [activeMentionByPostId, setActiveMentionByPostId] = useState<Record<string, ActiveMentionState | undefined>>({});
    const [mentionSuggestionsByPostId, setMentionSuggestionsByPostId] = useState<Record<string, api.User[]>>({});
    const [mentionLoadingIds, setMentionLoadingIds] = useState<Set<string>>(new Set());
    const hasLoadedRef = useRef(false);
    const wasActiveRef = useRef(false);
    const loadInFlightRef = useRef<Promise<void> | null>(null);
    const nextCursorRef = useRef<string | undefined>(undefined);
    const loadedCommentPostIdsRef = useRef<Set<string>>(new Set());
    const commentCursorRef = useRef<Record<string, string | undefined>>({});
    const commentHasMoreRef = useRef<Record<string, boolean>>({});
    const commentLoadingMoreRef = useRef<Set<string>>(new Set());
    const commentSentinelRefs = useRef<Record<string, View | null>>({});
    const mentionSearchTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
    const mentionSearchSeqRef = useRef<Record<string, number>>({});
    const selectedMentionUserIdsRef = useRef<Record<string, Record<string, string>>>({});
    const flatListRef = useRef<FlatList>(null);
    const commentInputRef = useRef<TextInput>(null);
    const canCloseComposerOnKeyboardHideRef = useRef(false);
    const insets = useSafeAreaInsets();
    const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

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

    useEffect(() => () => {
        Object.values(mentionSearchTimersRef.current).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
    }, []);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, event => {
            setKeyboardHeight(event.endCoordinates?.height ?? 0);
            if (Platform.OS === 'android' && activeCommentPostId) {
                canCloseComposerOnKeyboardHideRef.current = true;
            }
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
            if (Platform.OS === 'android' && activeCommentPostId && canCloseComposerOnKeyboardHideRef.current) {
                canCloseComposerOnKeyboardHideRef.current = false;
                setActiveCommentPostId(null);
            }
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [activeCommentPostId]);

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
                setActiveCommentPostId(current => current === postId ? null : current);
            } else {
                next.add(postId);
                shouldLoad = !loadedCommentPostIdsRef.current.has(postId);
            }
            return next;
        });
        if (shouldLoad) loadComments(postId).catch(() => {});
    }, [loadComments]);

    const handleStartComment = useCallback((post: api.Post) => {
        let shouldLoad = false;
        setExpandedCommentIds(prev => {
            if (prev.has(post.id)) return prev;
            const next = new Set(prev);
            next.add(post.id);
            shouldLoad = !loadedCommentPostIdsRef.current.has(post.id);
            return next;
        });
        if (shouldLoad) loadComments(post.id).catch(() => {});

        const postIndex = posts.findIndex(item => item.id === post.id);
        if (postIndex >= 0) {
            flatListRef.current?.scrollToIndex({ index: postIndex, animated: true, viewPosition: 0.5 });
        }

        canCloseComposerOnKeyboardHideRef.current = false;
        setActiveCommentPostId(post.id);
    }, [loadComments, posts]);

    useEffect(() => {
        if (!activeCommentPostId) return;

        const focusTimer = setTimeout(() => {
            commentInputRef.current?.focus();
        }, 50);

        return () => clearTimeout(focusTimer);
    }, [activeCommentPostId]);

    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!activeCommentPostId) return false;
            if (keyboardHeight > 0) {
                Keyboard.dismiss();
            } else {
                canCloseComposerOnKeyboardHideRef.current = false;
                setActiveCommentPostId(null);
            }
            return true;
        });

        return () => subscription.remove();
    }, [activeCommentPostId, keyboardHeight]);

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

    useEffect(() => {
        checkCommentSentinels();
    }, [commentHasMoreByPostId, checkCommentSentinels]);

    const handleCommentDraftChange = useCallback((postId: string, value: string) => {
        setCommentDrafts(prev => ({ ...prev, [postId]: value }));
        pruneSelectedMentions(postId, value, selectedMentionUserIdsRef.current);

        const activeMention = findActiveMention(value);
        setActiveMentionByPostId(prev => ({ ...prev, [postId]: activeMention }));

        if (mentionSearchTimersRef.current[postId]) clearTimeout(mentionSearchTimersRef.current[postId]);

        if (!activeMention || !activeMention.query.trim()) {
            setMentionSuggestionsByPostId(prev => ({ ...prev, [postId]: EMPTY_USERS }));
            setMentionLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(postId);
                return next;
            });
            return;
        }

        mentionSearchTimersRef.current[postId] = setTimeout(async () => {
            const nextSeq = (mentionSearchSeqRef.current[postId] ?? 0) + 1;
            mentionSearchSeqRef.current[postId] = nextSeq;
            setMentionLoadingIds(prev => new Set(prev).add(postId));

            try {
                const result = await api.discoverUsers({ query: activeMention.query, page: 1, limit: 5 });
                if (mentionSearchSeqRef.current[postId] !== nextSeq) return;
                setMentionSuggestionsByPostId(prev => ({ ...prev, [postId]: result.items ?? [] }));
            } catch {
                if (mentionSearchSeqRef.current[postId] !== nextSeq) return;
                setMentionSuggestionsByPostId(prev => ({ ...prev, [postId]: EMPTY_USERS }));
            } finally {
                if (mentionSearchSeqRef.current[postId] !== nextSeq) return;
                setMentionLoadingIds(prev => {
                    const next = new Set(prev);
                    next.delete(postId);
                    return next;
                });
            }
        }, 180);
    }, []);

    const handleSelectMention = useCallback((postId: string, selectedUser: api.User) => {
        const activeMention = activeMentionByPostId[postId];
        const draftValue = commentDrafts[postId] ?? '';
        if (!activeMention) return;

        const nextValue = `${draftValue.slice(0, activeMention.tokenStart)}@${selectedUser.username} ${draftValue.slice(activeMention.tokenEnd)}`;
        setCommentDrafts(prev => ({ ...prev, [postId]: nextValue }));
        selectedMentionUserIdsRef.current[postId] = {
            ...(selectedMentionUserIdsRef.current[postId] ?? {}),
            [selectedUser.username.toLowerCase()]: selectedUser.id,
        };
        setActiveMentionByPostId(prev => ({ ...prev, [postId]: undefined }));
        setMentionSuggestionsByPostId(prev => ({ ...prev, [postId]: EMPTY_USERS }));
    }, [activeMentionByPostId, commentDrafts]);

    const handleSubmitComment = useCallback(async (post: api.Post) => {
        const draftValue = commentDrafts[post.id]?.trim() ?? '';
        if (!draftValue || !user) return;

        setCommentSubmittingIds(prev => new Set(prev).add(post.id));
        try {
            const mentionUserIds = collectMentionUserIds(draftValue, selectedMentionUserIdsRef.current[post.id] ?? {});
            const newComment = await api.addComment(post.id, draftValue, mentionUserIds);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            canCloseComposerOnKeyboardHideRef.current = false;
            setActiveCommentPostId(current => current === post.id ? null : current);
            Keyboard.dismiss();

            setCommentDrafts(prev => ({ ...prev, [post.id]: '' }));
            setActiveMentionByPostId(prev => ({ ...prev, [post.id]: undefined }));
            setMentionSuggestionsByPostId(prev => ({ ...prev, [post.id]: EMPTY_USERS }));
            delete selectedMentionUserIdsRef.current[post.id];

            const applyCommentUpdate = () => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setCommentsByPostId(prev => ({ ...prev, [post.id]: [...(prev[post.id] ?? []), newComment] }));
                loadedCommentPostIdsRef.current.add(post.id);
                setPosts(prev => prev.map(item => item.id === post.id ? { ...item, comment_count: item.comment_count + 1 } : item));
            };

            requestAnimationFrame(() => {
                setTimeout(applyCommentUpdate, Platform.OS === 'android' ? 90 : 60);
            });
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
    const activeCommentPost = activeCommentPostId ? posts.find(post => post.id === activeCommentPostId) ?? null : null;
    const activeCommentDraft = activeCommentPost ? (commentDrafts[activeCommentPost.id] ?? '') : '';
    const activeMention = activeCommentPost ? activeMentionByPostId[activeCommentPost.id] : undefined;
    const activeMentionSuggestions = activeCommentPost ? (mentionSuggestionsByPostId[activeCommentPost.id] ?? EMPTY_USERS) : EMPTY_USERS;
    const isMentionSearching = activeCommentPost ? mentionLoadingIds.has(activeCommentPost.id) : false;
    const isActiveCommentSubmitting = activeCommentPost ? commentSubmittingIds.has(activeCommentPost.id) : false;
    const composerBottomOffset = Platform.OS === 'android' ? keyboardHeight : 0;
    const composerClosedPadding = insets.bottom + 8;

    const handleActiveCommentDraftChange = useCallback((value: string) => {
        if (!activeCommentPost) return;
        handleCommentDraftChange(activeCommentPost.id, value);
    }, [activeCommentPost, handleCommentDraftChange]);

    const handleSubmitActiveComment = useCallback(() => {
        if (!activeCommentPost) return;
        handleSubmitComment(activeCommentPost);
    }, [activeCommentPost, handleSubmitComment]);

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
            onToggleComments={handleToggleComments}
            onStartComment={handleStartComment}
            onPressUser={onOpenUserProfile}
            onRegisterCommentSentinel={handleRegisterCommentSentinel}
            isCommentComposerActive={activeCommentPostId === item.id}
        />
    ), [
        currentUserId, commentsByPostId, expandedCommentIds, commentLoadingIds,
        commentLoadingMoreIds, commentHasMoreByPostId, commentSubmittingIds,
        handleToggleComments, handleStartComment,
        onOpenUserProfile, handleRegisterCommentSentinel, activeCommentPostId,
    ]);

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <ScreenContainer
            style={styles.container}
            {...(Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {})}
        >
            <FlatList
                ref={flatListRef}
                data={posts}
                keyExtractor={p => p.id}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
                onScroll={checkCommentSentinels}
                onScrollToIndexFailed={({ index, averageItemLength }) => {
                    flatListRef.current?.scrollToOffset({
                        offset: Math.max(index * averageItemLength - 120, 0),
                        animated: true,
                    });
                }}
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
                contentContainerStyle={[
                    styles.list,
                    {
                        paddingBottom: activeCommentPost
                            ? 168 + composerClosedPadding + composerBottomOffset
                            : 110 + insets.bottom,
                    },
                ]}
            />

            {activeCommentPost && (
                <View
                    style={[
                        styles.activeCommentComposerShell,
                        {
                            paddingBottom: composerClosedPadding,
                            bottom: composerBottomOffset,
                        },
                    ]}
                >
                    {!!activeMention?.query.trim() && (
                        <View style={styles.mentionPanel}>
                            {isMentionSearching ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                            ) : activeMentionSuggestions.length > 0 ? (
                                activeMentionSuggestions.map(user => (
                                    <TouchableOpacity
                                        key={user.id}
                                        style={styles.mentionRow}
                                        onPress={() => handleSelectMention(activeCommentPost.id, user)}
                                    >
                                        <Avatar username={user.username} avatarUrl={user.avatar_url} size={26} fontSize={10} />
                                        <Text style={styles.mentionRowText}>{formatUsername(user.username)}</Text>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={styles.mentionEmpty}>No matches for @{activeMention?.query}</Text>
                            )}
                        </View>
                    )}

                    <View style={styles.activeCommentComposerHeader}>
                        <Text style={styles.activeCommentComposerTitle}>
                            Commenting on {formatUsername(activeCommentPost.username)}
                        </Text>
                    </View>

                    <View style={styles.commentComposerRow}>
                        <TextInput
                            ref={commentInputRef}
                            style={styles.commentInput}
                            placeholder="Write a comment"
                            placeholderTextColor={Colors.light.textTertiary}
                            value={activeCommentDraft}
                            onChangeText={handleActiveCommentDraftChange}
                            editable={!isActiveCommentSubmitting}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus
                        />
                        <TouchableOpacity
                            style={[styles.commentSendButton, (isActiveCommentSubmitting || !activeCommentDraft.trim()) && styles.commentSendButtonDisabled]}
                            onPress={handleSubmitActiveComment}
                            disabled={isActiveCommentSubmitting || !activeCommentDraft.trim()}
                        >
                            <Text style={styles.commentSendButtonText}>{isActiveCommentSubmitting ? '...' : 'Send'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </ScreenContainer>
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
    commentComposer: { gap: Spacing.xs },
    commentComposerLauncher: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.light.background,
        borderRadius: Radii.full,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    commentComposerLauncherActive: {
        borderColor: Colors.primary,
    },
    commentComposerLauncherText: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    commentComposerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
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
    commentMention: { color: Colors.primary, fontWeight: '600' },
    activeCommentComposerShell: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        backgroundColor: Colors.light.backgroundSecondary,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        gap: Spacing.xs,
    },
    activeCommentComposerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activeCommentComposerTitle: {
        flex: 1,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        fontWeight: '500',
    },
    mentionPanel: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.md,
        backgroundColor: Colors.light.background,
        paddingVertical: 6,
    },
    mentionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 8,
    },
    mentionRowText: { fontSize: Typography.sizes.sm, color: Colors.light.textPrimary, fontWeight: '500' },
    mentionEmpty: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 8,
    },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
    emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm, textAlign: 'center' },
    footerLoader: { paddingVertical: Spacing.md },
});

function pruneSelectedMentions(postId: string, value: string, store: Record<string, Record<string, string>>) {
    const current = store[postId];
    if (!current) return;

    const handles = new Set(extractMentionHandles(value));
    store[postId] = Object.fromEntries(
        Object.entries(current).filter(([username]) => handles.has(username))
    );
}

function collectMentionUserIds(value: string, selectedMentionUserIds: Record<string, string>): string[] {
    const ids = new Set<string>();

    extractMentionHandles(value).forEach(handle => {
        const id = selectedMentionUserIds[handle];
        if (id) ids.add(id);
    });

    return Array.from(ids);
}

function findActiveMention(value: string): ActiveMentionState | undefined {
    const match = value.match(/(^|\s)@([a-z0-9._]*)$/i);
    if (!match || match.index === undefined) return undefined;

    return {
        query: match[2] ?? '',
        tokenStart: match.index + match[1].length,
        tokenEnd: value.length,
    };
}

function extractMentionHandles(value: string): string[] {
    const matches = value.match(/(^|\s)@([a-z0-9._]+)/gi) ?? [];
    const seen = new Set<string>();
    const handles: string[] = [];

    matches.forEach(match => {
        const handle = match.trim().slice(1).toLowerCase();
        if (seen.has(handle)) return;
        seen.add(handle);
        handles.push(handle);
    });

    return handles;
}

function renderCommentBody(
    comment: api.Comment,
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void
) {
    const mentionByUsername = new Map((comment.mentions ?? []).map(mention => [mention.username.toLowerCase(), mention]));
    const parts: Array<{ key: string; text: string; mention?: api.CommentMention }> = [];
    let cursor = 0;
    let lastPlainStart = 0;
    let keyIndex = 0;

    while (cursor < comment.body.length) {
        if (comment.body[cursor] === '@' && (cursor === 0 || !isMentionBodyChar(comment.body[cursor - 1]))) {
            let next = cursor + 1;
            while (next < comment.body.length && isMentionBodyChar(comment.body[next])) next += 1;

            if (next > cursor + 1) {
                const username = comment.body.slice(cursor + 1, next).toLowerCase();
                const mention = mentionByUsername.get(username);
                if (mention) {
                    if (lastPlainStart < cursor) {
                        parts.push({ key: `plain-${keyIndex++}`, text: comment.body.slice(lastPlainStart, cursor) });
                    }
                    parts.push({ key: `mention-${keyIndex++}`, text: comment.body.slice(cursor, next), mention });
                    cursor = next;
                    lastPlainStart = next;
                    continue;
                }
            }
        }
        cursor += 1;
    }

    if (lastPlainStart < comment.body.length) {
        parts.push({ key: `plain-${keyIndex++}`, text: comment.body.slice(lastPlainStart) });
    }

    if (parts.length === 0) {
        return comment.body;
    }

    return parts.map(part => part.mention ? (
        <Text
            key={part.key}
            style={styles.commentMention}
            onPress={() => onPressUser({ userId: part.mention!.user_id, username: part.mention!.username })}
        >
            {part.text}
        </Text>
    ) : (
        <Text key={part.key}>{part.text}</Text>
    ));
}

function isMentionBodyChar(char?: string) {
    return !!char && /[a-z0-9._]/i.test(char);
}
