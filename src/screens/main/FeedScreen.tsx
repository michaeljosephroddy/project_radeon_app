import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput, Image,
    StyleSheet, RefreshControl, ActivityIndicator, Alert,
    Platform, KeyboardAvoidingView,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
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
import { Colors, Typography, Spacing, Radii, Composer as ComposerMetrics } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';
import { dedupeById } from '../../utils/list';
import { formatReadableTimestamp } from '../../utils/date';
import { composerStandards } from '../../styles/composerStandards';
import { screenStandards } from '../../styles/screenStandards';

interface PostCardProps {
    post: api.Post;
    resolvedImageSource: string | null;
    displayedCommentCount: number;
    currentUserId: string;
    onToggleComments: (postId: string) => void;
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

interface PreviewCacheEntry {
    localUri: string;
    remoteUri: string;
    isRemoteReady: boolean;
}

const PostCard = React.memo(function PostCard({
    post,
    resolvedImageSource,
    displayedCommentCount,
    currentUserId,
    onToggleComments,
    onPressUser,
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

    const handleToggleComments = useCallback(
        () => onToggleComments(post.id),
        [post.id, onToggleComments],
    );
    const handlePressUser = useCallback(
        () => onPressUser({ userId: post.user_id, username: post.username, avatarUrl: post.avatar_url }),
        [post.user_id, post.username, post.avatar_url, onPressUser],
    );

    return (
        <View style={styles.postCard}>
            <View style={styles.postHead}>
                <TouchableOpacity onPress={isOwn ? undefined : handlePressUser} disabled={isOwn}>
                    <Avatar username={post.username} avatarUrl={post.avatar_url} size={44} />
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
                        name="chatbubble-outline"
                        size={15}
                        color={Colors.light.textTertiary}
                    />
                    <Text style={styles.postActionText}>
                        {displayedCommentCount > 0 ? `${displayedCommentCount} comments` : 'Comment'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}, arePostCardPropsEqual);

interface FeedScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onOpenComments: (post: api.Post, focusComposer: boolean) => void;
    focusRequest?: { postId: string; commentId?: string; nonce: number } | null;
}

export function FeedScreen({
    isActive,
    onOpenUserProfile,
    onOpenComments,
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
    const insets = useSafeAreaInsets();
    const [posts, setPosts] = useState<api.Post[]>([]);
    const [composing, setComposing] = useState(false);
    const [draft, setDraft] = useState('');
    const [selectedImage, setSelectedImage] = useState<ComposerImageState | null>(null);

    const postsRef = useRef<api.Post[]>([]);
    const flatListRef = useRef<FlatList>(null);
    const imageUploadPromiseRef = useRef<Promise<api.PostImage> | null>(null);
    const imageUploadTokenRef = useRef(0);
    const previewCacheRef = useRef<Record<string, PreviewCacheEntry>>({});
    const localManagedPostIdsRef = useRef<Set<string>>(new Set());

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
            const nextPosts = dedupeById([...preservedLocalPosts, ...feedPosts]);
            postsRef.current = nextPosts;
            return nextPosts;
        });
    }, [feedPosts]);

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
                return { ...current, status: 'uploaded', uploadedImage };
            });
        }).catch(() => {
            setSelectedImage(current => {
                if (!current || current.uploadToken !== uploadToken) return current;
                return { ...current, status: 'failed' };
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
            previewCacheRef.current[postId] = { ...latestPreview, isRemoteReady: true };
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
                ? { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current }
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

    const handleOpenComments = useCallback((postId: string, focusComposer = false) => {
        const post = postsRef.current.find(p => p.id === postId);
        if (!post) return;
        onOpenComments(post, focusComposer);
    }, [onOpenComments]);

    useEffect(() => {
        if (!isActive || !focusRequest) return;

        void (async () => {
            if (!postsRef.current.some(post => post.id === focusRequest.postId)) {
                await feedQuery.refetch();
            }
            const post = postsRef.current.find(p => p.id === focusRequest.postId);
            if (!post) return;
            onOpenComments(post, true);
        })();
    }, [feedQuery, focusRequest, isActive, onOpenComments]);

    const currentUserId = user?.id ?? '';
    const listPaddingBottom = 110 + insets.bottom;

    const renderItem = useCallback(({ item }: { item: api.Post }) => (
        <PostCard
            post={item}
            resolvedImageSource={resolvePostImageSource(item)}
            displayedCommentCount={item.comment_count}
            currentUserId={currentUserId}
            onToggleComments={handleOpenComments}
            onPressUser={onOpenUserProfile}
        />
    ), [resolvePostImageSource, currentUserId, handleOpenComments, onOpenUserProfile]);

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
                                <View style={[styles.composeField, styles.composeExpanded]}>
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
                                <TouchableOpacity style={styles.composeField} onPress={() => setComposing(true)}>
                                    <Text style={styles.composePlaceholder}>What's on your mind?</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={composerStandards.iconButton} onPress={handlePickPostImage}>
                                <Ionicons name="image-outline" size={18} color={Colors.primary} />
                            </TouchableOpacity>
                            {composing && (
                                <TouchableOpacity
                                    style={[composerStandards.actionButton, composerStandards.actionButtonSuccess, styles.postBtn]}
                                    onPress={handlePost}
                                >
                                    <Text style={composerStandards.actionButtonText}>Post</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <InfoNoticeCard
                            title="Community Feed"
                            description="Posts here come from the wider community as well as your friends."
                        />
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
                contentContainerStyle={[screenStandards.listContent, { paddingBottom: listPaddingBottom }]}
            />

            {isActive && feedScrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
        </ScreenContainer>
    );
}

function arePostCardPropsEqual(prev: PostCardProps, next: PostCardProps) {
    return prev.post === next.post
        && prev.resolvedImageSource === next.resolvedImageSource
        && prev.displayedCommentCount === next.displayedCommentCount
        && prev.currentUserId === next.currentUserId
        && prev.onToggleComments === next.onToggleComments
        && prev.onPressUser === next.onPressUser;
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listHeader: { gap: Spacing.sm, marginBottom: Spacing.md },
    composeBar: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        padding: Spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
    },
    composeField: {
        flex: 1,
        minHeight: ComposerMetrics.minHeight,
        borderRadius: Radii.pill,
        backgroundColor: Colors.light.background,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: ComposerMetrics.inputHorizontal,
        paddingVertical: ComposerMetrics.inputVertical,
        justifyContent: 'center',
    },
    composeExpanded: { gap: Spacing.sm },
    composeInput: {
        flex: 1,
        maxHeight: ComposerMetrics.maxHeight,
        fontSize: Typography.body.fontSize,
        lineHeight: Typography.body.lineHeight,
        color: Colors.light.textPrimary,
        padding: 0,
        textAlignVertical: 'top',
    },
    composePlaceholder: {
        fontSize: Typography.body.fontSize,
        lineHeight: Typography.body.lineHeight,
        color: Colors.light.textTertiary,
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
    postBtn: { minWidth: 72 },
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
    footerLoader: { paddingVertical: Spacing.md },
});
