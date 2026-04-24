import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput, Image,
    StyleSheet, RefreshControl, ActivityIndicator, Alert,
    Platform, KeyboardAvoidingView, Keyboard, BackHandler, LayoutAnimation, UIManager,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import * as api from '../../api/client';
import { useCreatePostMutation } from '../../hooks/queries/useCreatePostMutation';
import { useFeed } from '../../hooks/queries/useFeed';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { useAuth } from '../../hooks/useAuth';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { getListPerformanceProps } from '../../utils/listPerformance';
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
    resolvedImageSource: string | null;
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
    onLoadMoreComments: (postId: string) => void;
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    isCommentComposerActive: boolean;
}

interface CommentItemProps {
    comment: api.Comment;
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

interface SelectedPostImage {
    uri: string;
    mimeType: string;
    fileName: string;
}

interface ComposerImageState {
    localImage: SelectedPostImage;
    status: 'uploading' | 'uploaded' | 'failed';
    uploadToken: number;
    uploadedImage?: api.PostImage;
}

function dedupePostsById(posts: api.Post[]): api.Post[] {
    const seen = new Set<string>();
    return posts.filter((post) => {
        if (seen.has(post.id)) return false;
        seen.add(post.id);
        return true;
    });
}

interface PreviewCacheEntry {
    localUri: string;
    remoteUri: string;
    isRemoteReady: boolean;
}

const CommentItem = React.memo(function CommentItem({ comment, onPressUser }: CommentItemProps) {
    return (
        <View style={styles.commentRow}>
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
    );
});

function inferMimeType(uri: string | undefined, fallback = 'image/jpeg'): string {
    if (!uri) return fallback;
    const normalizedUri = uri.toLowerCase();
    if (normalizedUri.endsWith('.png')) return 'image/png';
    if (normalizedUri.endsWith('.jpg') || normalizedUri.endsWith('.jpeg')) return 'image/jpeg';
    return fallback;
}

function inferFileName(uri: string | undefined, fallback: string): string {
    if (!uri) return fallback;
    const path = uri.split('/').pop();
    return path && path.includes('.') ? path : fallback;
}

async function buildSelectedPostImage(asset: ImagePicker.ImagePickerAsset): Promise<SelectedPostImage> {
    return {
        uri: asset.uri,
        mimeType: asset.mimeType ?? inferMimeType(asset.uri),
        fileName: asset.fileName ?? inferFileName(asset.uri, 'post.jpg'),
    };
}

function createOptimisticPost(user: api.User, postId: string, body: string, images: api.PostImage[]): api.Post {
    return {
        id: postId,
        user_id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        body,
        created_at: new Date().toISOString(),
        comment_count: 0,
        like_count: 0,
        images,
    };
}

const PostCard = React.memo(function PostCard({
    post,
    resolvedImageSource,
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
    onLoadMoreComments,
    onPressUser,
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
    const handleLoadMoreComments = useCallback(() => onLoadMoreComments(post.id), [post.id, onLoadMoreComments]);
    const handlePressUser = useCallback(() => onPressUser({ userId: post.user_id, username: post.username, avatarUrl: post.avatar_url }), [post.user_id, post.username, post.avatar_url, onPressUser]);

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
                {!!post.body && <Text style={styles.postBody}>{post.body}</Text>}
                {resolvedImageSource ? (
                    <Image
                        source={{ uri: resolvedImageSource }}
                        style={styles.postImage}
                        resizeMode="cover"
                    />
                ) : null}
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
            {commentsExpanded && (
                <View style={styles.commentsSection}>
                    {commentsLoading ? (
                        <View style={styles.commentsLoading}>
                            <ActivityIndicator color={Colors.primary} size="small" />
                        </View>
                    ) : comments.length > 0 ? (
                        <View style={styles.commentsList}>
                            {comments.map(comment => (
                                <CommentItem key={comment.id} comment={comment} onPressUser={onPressUser} />
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.commentsEmpty}>No comments yet.</Text>
                    )}

                    {hasMoreComments && (
                        <TouchableOpacity
                            style={[styles.loadMoreCommentsButton, commentsLoadingMore && styles.loadMoreCommentsButtonDisabled]}
                            onPress={handleLoadMoreComments}
                            disabled={commentsLoadingMore}
                        >
                            {commentsLoadingMore ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                                <Text style={styles.loadMoreCommentsText}>Load more comments</Text>
                            )}
                        </TouchableOpacity>
                    )}

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
}, arePostCardPropsEqual);

interface FeedScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    focusRequest?: { postId: string; commentId?: string; nonce: number } | null;
}

export function FeedScreen({
    isActive,
    onOpenUserProfile,
    focusRequest,
}: FeedScreenProps) {
    const ScreenContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
    const { user } = useAuth();
    const createPostMutation = useCreatePostMutation();
    const queryClient = useQueryClient();
    const hasActivated = useLazyActivation(isActive);
    const feedListProps = getListPerformanceProps('denseFeed');
    const feedQuery = useFeed(20, hasActivated);
    useRefetchOnActiveIfStale(isActive, feedQuery);
    const feedPosts = useMemo(
        () => (feedQuery.data?.pages ?? []).flatMap((page: api.CursorResponse<api.Post>) => page.items ?? []),
        [feedQuery.data],
    );
    const feedScrollToTop = useScrollToTopButton({ threshold: 520 });
    const [posts, setPosts] = useState<api.Post[]>([]);
    const [composing, setComposing] = useState(false);
    const [draft, setDraft] = useState('');
    const [selectedImage, setSelectedImage] = useState<ComposerImageState | null>(null);
    const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());
    const [commentLoadingIds, setCommentLoadingIds] = useState<Set<string>>(new Set());
    const [commentLoadingMoreIds, setCommentLoadingMoreIds] = useState<Set<string>>(new Set());
    const [commentSubmittingIds, setCommentSubmittingIds] = useState<Set<string>>(new Set());
    const [commentsByPostId, setCommentsByPostId] = useState<Record<string, api.Comment[]>>({});
    const [commentHasMoreByPostId, setCommentHasMoreByPostId] = useState<Record<string, boolean>>({});
    const [activeCommentDraft, setActiveCommentDraft] = useState('');
    const [activeMention, setActiveMention] = useState<ActiveMentionState | undefined>(undefined);
    const [activeMentionSuggestions, setActiveMentionSuggestions] = useState<api.User[]>(EMPTY_USERS);
    const [isMentionSearching, setIsMentionSearching] = useState(false);
    const hasLoadedRef = useRef(false);
    const postsRef = useRef<api.Post[]>([]);
    const loadedCommentPostIdsRef = useRef<Set<string>>(new Set());
    const commentCursorRef = useRef<Record<string, string | undefined>>({});
    const commentLoadingMoreRef = useRef<Set<string>>(new Set());
    const mentionSearchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const mentionSearchSeqRef = useRef(0);
    const commentDraftCacheRef = useRef<Record<string, string>>({});
    const selectedMentionUserIdsRef = useRef<Record<string, Record<string, string>>>({});
    const flatListRef = useRef<FlatList>(null);
    const commentInputRef = useRef<TextInput>(null);
    const canCloseComposerOnKeyboardHideRef = useRef(false);
    const imageUploadPromiseRef = useRef<Promise<api.PostImage> | null>(null);
    const imageUploadTokenRef = useRef(0);
    // Keeps optimistic post images on the local file URI until the uploaded
    // remote image has been prefetched and is safe to swap in.
    const previewCacheRef = useRef<Record<string, PreviewCacheEntry>>({});
    const localManagedPostIdsRef = useRef<Set<string>>(new Set());
    const insets = useSafeAreaInsets();
    const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const closeActiveCommentComposer = useCallback(() => {
        canCloseComposerOnKeyboardHideRef.current = false;
        mentionSearchSeqRef.current += 1;
        setActiveCommentPostId(null);
        setActiveCommentDraft('');
        setActiveMention(undefined);
        setActiveMentionSuggestions(EMPTY_USERS);
        setIsMentionSearching(false);
        if (mentionSearchTimerRef.current) clearTimeout(mentionSearchTimerRef.current);
    }, []);

    useEffect(() => {
        postsRef.current = posts;
    }, [posts]);

    useEffect(() => {
        const serverPostIds = new Set(feedPosts.map(post => post.id));
        setPosts(current => {
            const preservedLocalPosts = current.filter(post =>
                localManagedPostIdsRef.current.has(post.id) && !serverPostIds.has(post.id)
            );
            localManagedPostIdsRef.current.forEach(postId => {
                if (serverPostIds.has(postId)) {
                    localManagedPostIdsRef.current.delete(postId);
                }
            });
            const nextPosts = dedupePostsById([...preservedLocalPosts, ...feedPosts]);
            postsRef.current = nextPosts;
            return nextPosts;
        });
        if (feedPosts.length > 0) {
            hasLoadedRef.current = true;
        }
    }, [feedPosts]);

    useEffect(() => () => {
        if (mentionSearchTimerRef.current) clearTimeout(mentionSearchTimerRef.current);
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
                closeActiveCommentComposer();
            }
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [activeCommentPostId, closeActiveCommentComposer]);

    const onRefresh = useCallback(async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.feed(20));
        await feedQuery.refetch();
    }, [feedQuery, queryClient]);

    const beginImageUpload = useCallback((image: SelectedPostImage, uploadToken: number): Promise<api.PostImage> => {
        const uploadPromise = api.uploadPostImage({
            uri: image.uri,
            mimeType: image.mimeType,
            fileName: image.fileName,
        });
        imageUploadPromiseRef.current = uploadPromise;

        void uploadPromise.then(uploadedImage => {
            setSelectedImage(current => {
                if (!current || current.uploadToken !== uploadToken) return current;
                return {
                    ...current,
                    status: 'uploaded',
                    uploadedImage,
                };
            });
        }).catch(() => {
            setSelectedImage(current => {
                if (!current || current.uploadToken !== uploadToken) return current;
                return {
                    ...current,
                    status: 'failed',
                };
            });
        }).finally(() => {
            if (imageUploadTokenRef.current === uploadToken) {
                imageUploadPromiseRef.current = null;
            }
        });

        return uploadPromise;
    }, []);

    const removeSelectedImage = useCallback(() => {
        imageUploadTokenRef.current += 1;
        imageUploadPromiseRef.current = null;
        setSelectedImage(null);
    }, []);

    const resolvePostImageSource = useCallback((post: api.Post): string | null => {
        const image = post.images[0];
        if (!image) return null;
        const cachedPreview = previewCacheRef.current[post.id];
        if (cachedPreview && cachedPreview.remoteUri === image.image_url && !cachedPreview.isRemoteReady) {
            return cachedPreview.localUri;
        }
        return image.image_url;
    }, []);

    const warmRemotePostImage = useCallback((postId: string, remoteUri: string) => {
        const cachedPreview = previewCacheRef.current[postId];
        if (!cachedPreview || cachedPreview.remoteUri !== remoteUri || cachedPreview.isRemoteReady) return;

        void Image.prefetch(remoteUri).finally(() => {
            const latestPreview = previewCacheRef.current[postId];
            if (!latestPreview || latestPreview.remoteUri !== remoteUri) return;
            previewCacheRef.current[postId] = {
                ...latestPreview,
                isRemoteReady: true,
            };
            setPosts(current => [...current]);
        });
    }, []);

    const handlePost = () => {
        if (!draft.trim() && !selectedImage) return;
        if (!user) return;
        const body = draft.trim();
        const selectedImageState = selectedImage;
        const optimisticPostId = `temp-${Date.now()}`;
        const optimisticImages = selectedImageState
            ? [selectedImageState.uploadedImage ?? {
                id: `temp-image-${Date.now()}`,
                image_url: selectedImageState.localImage.uri,
                width: 0,
                height: 0,
                sort_order: 0,
            }]
            : [];

        setPosts(current => {
            const nextPosts = [createOptimisticPost(user, optimisticPostId, body, optimisticImages), ...current];
            postsRef.current = nextPosts;
            return nextPosts;
        });
        localManagedPostIdsRef.current.add(optimisticPostId);
        setDraft('');
        removeSelectedImage();
        setComposing(false);

        // Post creation intentionally continues in the background so the
        // composer can clear and the optimistic post can appear immediately.
        void (async () => {
            try {
                let uploadedImages: api.PostImage[] = [];
                if (selectedImageState) {
                    if (selectedImageState.uploadedImage) {
                        uploadedImages = [selectedImageState.uploadedImage];
                    } else if (selectedImageState.status === 'uploading' && imageUploadPromiseRef.current) {
                        uploadedImages = [await imageUploadPromiseRef.current];
                    } else {
                        const uploadToken = ++imageUploadTokenRef.current;
                        uploadedImages = [await beginImageUpload(selectedImageState.localImage, uploadToken)];
                    }
                }

                const createdPost = await createPostMutation.mutateAsync({
                    body: body || undefined,
                    images: uploadedImages,
                    currentUserId: user.id,
                });
                if (selectedImageState?.localImage.uri && uploadedImages[0]?.image_url) {
                    previewCacheRef.current[createdPost.id] = {
                        localUri: selectedImageState.localImage.uri,
                        remoteUri: uploadedImages[0].image_url,
                        isRemoteReady: false,
                    };
                    warmRemotePostImage(createdPost.id, uploadedImages[0].image_url);
                }
                setPosts(current => {
                    const nextPosts = current.map(post =>
                        post.id === optimisticPostId
                        ? createOptimisticPost(user, createdPost.id, body, optimisticImages)
                        : post
                    );
                    postsRef.current = nextPosts;
                    return nextPosts;
                });
                localManagedPostIdsRef.current.delete(optimisticPostId);
                localManagedPostIdsRef.current.add(createdPost.id);
            } catch (e: unknown) {
                setPosts(current => {
                    const nextPosts = current.filter(post => post.id !== optimisticPostId);
                    postsRef.current = nextPosts;
                    return nextPosts;
                });
                localManagedPostIdsRef.current.delete(optimisticPostId);
                Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
            }
        })();
    };

    const handlePickPostImage = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission required', 'Allow access to your photo library to attach a post image.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [6, 5],
            quality: 1,
            ...(Platform.OS === 'ios'
                ? {
                    preferredAssetRepresentationMode:
                        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
                }
                : {}),
        });
        if (result.canceled) return;

        try {
            const nextSelectedImage = await buildSelectedPostImage(result.assets[0]);
            const uploadToken = ++imageUploadTokenRef.current;
            const nextComposerImage: ComposerImageState = {
                localImage: nextSelectedImage,
                status: 'uploading',
                uploadToken,
            };
            setSelectedImage(nextComposerImage);
            setComposing(true);
            beginImageUpload(nextSelectedImage, uploadToken).catch(() => {});
        } catch {
            Alert.alert('Error', 'Could not prepare that image. Please try a different photo.');
        }
    };

    const handleLoadMore = useCallback(async () => {
        if (!isActive || !feedQuery.hasNextPage || feedQuery.isFetchingNextPage) return;
        await feedQuery.fetchNextPage();
    }, [feedQuery, isActive]);
    const feedListPagination = useGuardedEndReached(handleLoadMore);

    const loadComments = useCallback(async (postId: string) => {
        setCommentLoadingIds(prev => new Set(prev).add(postId));
        try {
            const result = await api.getComments(postId);
            setCommentsByPostId(prev => ({ ...prev, [postId]: result.items ?? [] }));
            commentCursorRef.current[postId] = result.next_cursor ?? undefined;
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
        const shouldCloseComposer = activeCommentPostId === postId;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
        if (shouldCloseComposer) closeActiveCommentComposer();
        if (shouldLoad) loadComments(postId).catch(() => {});
    }, [activeCommentPostId, closeActiveCommentComposer, loadComments]);

    const handleStartComment = useCallback((post: api.Post) => {
        let shouldLoad = false;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
        setActiveCommentDraft(commentDraftCacheRef.current[post.id] ?? '');
        setActiveMention(undefined);
        setActiveMentionSuggestions(EMPTY_USERS);
        setIsMentionSearching(false);
        setActiveCommentPostId(post.id);
    }, [loadComments, posts]);

    useEffect(() => {
        if (!isActive || !focusRequest) return;

        void (async () => {
            if (!postsRef.current.some(post => post.id === focusRequest.postId)) {
                await feedQuery.refetch();
            }

            const post = postsRef.current.find(item => item.id === focusRequest.postId);
            if (!post) return;
            handleStartComment(post);
        })();
    }, [feedQuery, focusRequest, handleStartComment, isActive]);

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
                closeActiveCommentComposer();
            }
            return true;
        });

        return () => subscription.remove();
    }, [activeCommentPostId, closeActiveCommentComposer, keyboardHeight]);

    const loadMoreComments = useCallback(async (postId: string) => {
        if (commentLoadingMoreRef.current.has(postId)) return;
        if (!commentHasMoreByPostId[postId]) return;

        commentLoadingMoreRef.current.add(postId);
        setCommentLoadingMoreIds(new Set(commentLoadingMoreRef.current));

        try {
            const result = await api.getComments(postId, commentCursorRef.current[postId]);
            commentCursorRef.current[postId] = result.next_cursor ?? undefined;
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
    }, [commentHasMoreByPostId]);

    const handleActiveCommentDraftChange = useCallback((value: string) => {
        if (!activeCommentPostId) return;

        setActiveCommentDraft(value);
        commentDraftCacheRef.current[activeCommentPostId] = value;
        pruneSelectedMentions(activeCommentPostId, value, selectedMentionUserIdsRef.current);

        const nextMention = findActiveMention(value);
        setActiveMention(nextMention);

        if (mentionSearchTimerRef.current) clearTimeout(mentionSearchTimerRef.current);

        if (!nextMention || !nextMention.query.trim()) {
            setActiveMentionSuggestions(EMPTY_USERS);
            setIsMentionSearching(false);
            return;
        }

        mentionSearchTimerRef.current = setTimeout(async () => {
            const nextSeq = mentionSearchSeqRef.current + 1;
            mentionSearchSeqRef.current = nextSeq;
            setIsMentionSearching(true);

            try {
                const result = await api.discoverUsers({ query: nextMention.query, page: 1, limit: 5 });
                if (mentionSearchSeqRef.current !== nextSeq) return;
                setActiveMentionSuggestions(result.items ?? []);
            } catch {
                if (mentionSearchSeqRef.current !== nextSeq) return;
                setActiveMentionSuggestions(EMPTY_USERS);
            } finally {
                if (mentionSearchSeqRef.current !== nextSeq) return;
                setIsMentionSearching(false);
            }
        }, 180);
    }, [activeCommentPostId]);

    const handleSelectMention = useCallback((selectedUser: api.User) => {
        if (!activeCommentPostId || !activeMention) return;

        const nextValue = `${activeCommentDraft.slice(0, activeMention.tokenStart)}@${selectedUser.username} ${activeCommentDraft.slice(activeMention.tokenEnd)}`;
        setActiveCommentDraft(nextValue);
        commentDraftCacheRef.current[activeCommentPostId] = nextValue;
        selectedMentionUserIdsRef.current[activeCommentPostId] = {
            ...(selectedMentionUserIdsRef.current[activeCommentPostId] ?? {}),
            [selectedUser.username.toLowerCase()]: selectedUser.id,
        };
        setActiveMention(undefined);
        setActiveMentionSuggestions(EMPTY_USERS);
        setIsMentionSearching(false);
    }, [activeCommentDraft, activeCommentPostId, activeMention]);

    const handleSubmitComment = useCallback(async (post: api.Post) => {
        const draftValue = activeCommentDraft.trim();
        if (!draftValue || !user) return;
        const selectedMentionUserIds = selectedMentionUserIdsRef.current[post.id] ?? {};
        const mentionUserIds = collectMentionUserIds(draftValue, selectedMentionUserIds);

        const optimisticComment = buildOptimisticComment({
            body: draftValue,
            postId: post.id,
            user,
            selectedMentionUserIds,
        });

        setCommentSubmittingIds(prev => new Set(prev).add(post.id));
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        delete commentDraftCacheRef.current[post.id];
        delete selectedMentionUserIdsRef.current[post.id];
        setCommentsByPostId(prev => ({ ...prev, [post.id]: [...(prev[post.id] ?? []), optimisticComment] }));
        setPosts(prev => prev.map(item => item.id === post.id ? { ...item, comment_count: item.comment_count + 1 } : item));
        closeActiveCommentComposer();
        Keyboard.dismiss();
        loadedCommentPostIdsRef.current.add(post.id);

        try {
            const newComment = await api.addComment(post.id, draftValue, mentionUserIds);
            setCommentsByPostId(prev => ({
                ...prev,
                [post.id]: (prev[post.id] ?? []).map(comment => comment.id === optimisticComment.id ? newComment : comment),
            }));
        } catch (e: unknown) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            commentDraftCacheRef.current[post.id] = draftValue;
            setCommentsByPostId(prev => ({
                ...prev,
                [post.id]: (prev[post.id] ?? []).filter(comment => comment.id !== optimisticComment.id),
            }));
            setPosts(prev => prev.map(item => item.id === post.id ? { ...item, comment_count: Math.max(item.comment_count - 1, 0) } : item));
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setCommentSubmittingIds(prev => {
                const next = new Set(prev);
                next.delete(post.id);
                return next;
            });
        }
    }, [activeCommentDraft, closeActiveCommentComposer, user]);

    const currentUserId = user?.id ?? '';
    const activeCommentPost = activeCommentPostId ? posts.find(post => post.id === activeCommentPostId) ?? null : null;
    const isActiveCommentSubmitting = activeCommentPost ? commentSubmittingIds.has(activeCommentPost.id) : false;
    const composerBottomOffset = Platform.OS === 'android' ? keyboardHeight : 0;
    const composerClosedPadding = insets.bottom + 8;
    const activeComposerPadding = activeCommentPost
        ? 164 + composerClosedPadding + (activeMention?.query.trim() ? 128 : 0)
        : 110 + insets.bottom;

    const handleSubmitActiveComment = useCallback(() => {
        if (!activeCommentPost) return;
        handleSubmitComment(activeCommentPost);
    }, [activeCommentPost, handleSubmitComment]);

    const renderItem = useCallback(({ item }: { item: api.Post }) => (
        <PostCard
            post={item}
            resolvedImageSource={resolvePostImageSource(item)}
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
            onLoadMoreComments={loadMoreComments}
            onPressUser={onOpenUserProfile}
            isCommentComposerActive={activeCommentPostId === item.id}
        />
    ), [
        resolvePostImageSource,
        currentUserId, commentsByPostId, expandedCommentIds, commentLoadingIds,
        commentLoadingMoreIds, commentHasMoreByPostId, commentSubmittingIds,
        handleToggleComments, handleStartComment, loadMoreComments,
        onOpenUserProfile, activeCommentPostId,
    ]);

    const isInitialLoading = posts.length === 0 && feedQuery.isLoading;
    const isRefreshing = feedQuery.isRefetching && !feedQuery.isFetchingNextPage;

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
                data={posts}
                keyExtractor={p => p.id}
                {...feedListProps}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                onEndReached={feedListPagination.onEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={feedListPagination.onMomentumScrollBegin}
                onScrollBeginDrag={feedListPagination.onScrollBeginDrag}
                onScroll={feedScrollToTop.onScroll}
                scrollEventThrottle={16}
                onScrollToIndexFailed={({ index, averageItemLength }) => {
                    flatListRef.current?.scrollToOffset({
                        offset: Math.max(index * averageItemLength - 120, 0),
                        animated: true,
                    });
                }}
                ListHeaderComponent={
                    <View style={styles.listHeader}>
                        <View style={styles.composeBar}>
                            {user && <Avatar username={user.username} avatarUrl={user.avatar_url} size={28} />}
                            {composing ? (
                                <View style={styles.composeExpanded}>
                                    <TextInput
                                        style={styles.composeInput}
                                        placeholder="What's on your mind?"
                                        placeholderTextColor={Colors.light.textTertiary}
                                        value={draft}
                                        onChangeText={setDraft}
                                        multiline
                                        autoFocus={!selectedImage}
                                    />
                                    {selectedImage ? (
                                        <View style={styles.composeImagePreviewWrap}>
                                            <Image source={{ uri: selectedImage.localImage.uri }} style={styles.composeImagePreview} resizeMode="cover" />
                                            <TouchableOpacity style={styles.removeImageButton} onPress={removeSelectedImage}>
                                                <Ionicons name="close" size={14} color={Colors.textOn.primary} />
                                            </TouchableOpacity>
                                            <View style={styles.composeImageStatusBadge}>
                                                <Text style={styles.composeImageStatusText}>
                                                    {selectedImage.status === 'uploading'
                                                        ? 'Uploading...'
                                                        : selectedImage.status === 'uploaded'
                                                            ? 'Ready'
                                                            : 'Retry on post'}
                                                </Text>
                                            </View>
                                        </View>
                                    ) : null}
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.composeTrigger} onPress={() => setComposing(true)}>
                                    <Text style={styles.composePlaceholder}>What's on your mind?</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.attachImageButton}
                                onPress={handlePickPostImage}
                            >
                                <Ionicons name="image-outline" size={18} color={Colors.primary} />
                            </TouchableOpacity>
                            {composing && (
                                <TouchableOpacity
                                    style={styles.postBtn}
                                    onPress={handlePost}
                                >
                                    <Text style={styles.postBtnText}>Post</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.feedNotice}>
                            <Text style={styles.feedNoticeTitle}>Community Feed</Text>
                            <Text style={styles.feedNoticeText}>
                                Posts here come from the wider community as well as your friends.
                            </Text>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <EmptyState
                        title="No posts yet."
                        description="Community posts will show up here as people share."
                    />
                }
                renderItem={renderItem}
                ListFooterComponent={feedQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                contentContainerStyle={[
                    styles.list,
                    {
                        paddingBottom: activeComposerPadding,
                    },
                ]}
            />
            {isActive && feedScrollToTop.isVisible && !activeCommentPost ? (
                <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}

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
                                        onPress={() => handleSelectMention(user)}
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
                            multiline
                            autoCapitalize="none"
                            autoCorrect={false}
                            textAlignVertical="top"
                            maxLength={1000}
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

function arePostCardPropsEqual(prev: PostCardProps, next: PostCardProps) {
    return prev.post === next.post
        && prev.resolvedImageSource === next.resolvedImageSource
        && prev.displayedCommentCount === next.displayedCommentCount
        && prev.currentUserId === next.currentUserId
        && prev.comments === next.comments
        && prev.commentsExpanded === next.commentsExpanded
        && prev.commentsLoading === next.commentsLoading
        && prev.commentsLoadingMore === next.commentsLoadingMore
        && prev.hasMoreComments === next.hasMoreComments
        && prev.commentSubmitting === next.commentSubmitting
        && prev.isCommentComposerActive === next.isCommentComposerActive;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.md, paddingBottom: 32 },
    listHeader: { gap: Spacing.sm, marginBottom: Spacing.md },
    feedNotice: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: 4,
    },
    feedNoticeTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    feedNoticeText: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        lineHeight: 18,
    },
    composeBar: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        padding: Spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
    },
    composeTrigger: { flex: 1 },
    composeExpanded: { flex: 1, gap: Spacing.sm },
    composeInput: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textPrimary, maxHeight: 100 },
    composePlaceholder: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textTertiary, textAlignVertical: 'center' },
    attachImageButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.background,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
    },
    composeImagePreviewWrap: {
        position: 'relative',
        width: 104,
        height: 104,
    },
    composeImagePreview: {
        width: 104,
        height: 104,
        borderRadius: Radii.md,
        backgroundColor: Colors.light.background,
    },
    composeImageStatusBadge: {
        position: 'absolute',
        left: 6,
        bottom: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radii.full,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
    },
    composeImageStatusText: {
        fontSize: Typography.sizes.xs,
        color: Colors.textOn.primary,
        fontWeight: '600',
    },
    removeImageButton: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
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
    postImage: {
        width: '100%',
        aspectRatio: 1.2,
        borderRadius: Radii.md,
        marginTop: Spacing.sm,
        backgroundColor: Colors.light.backgroundSecondary,
    },
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
    loadMoreCommentsButton: {
        minHeight: 38,
        borderRadius: Radii.full,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
    },
    loadMoreCommentsButtonDisabled: { opacity: 0.7 },
    loadMoreCommentsText: {
        fontSize: Typography.sizes.sm,
        color: Colors.primary,
        fontWeight: '600',
    },
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
    commentComposerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
    commentInput: {
        flex: 1,
        backgroundColor: Colors.light.background,
        minHeight: 44,
        maxHeight: 108,
        borderRadius: 22,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textPrimary,
    },
    commentSendButton: {
        backgroundColor: Colors.success,
        borderRadius: Radii.full,
        minWidth: 58,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
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

function buildOptimisticComment(params: {
    postId: string;
    body: string;
    user: NonNullable<ReturnType<typeof useAuth>['user']>;
    selectedMentionUserIds: Record<string, string>;
}): api.Comment {
    const mentionHandles = extractMentionHandles(params.body);

    return {
        id: `optimistic-${params.postId}-${Date.now()}`,
        user_id: params.user.id,
        username: params.user.username,
        avatar_url: params.user.avatar_url,
        body: params.body,
        created_at: new Date().toISOString(),
        mentions: mentionHandles
            .map(handle => {
                const userId = params.selectedMentionUserIds[handle];
                return userId ? { user_id: userId, username: handle } : null;
            })
            .filter((mention): mention is api.CommentMention => !!mention),
    };
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
