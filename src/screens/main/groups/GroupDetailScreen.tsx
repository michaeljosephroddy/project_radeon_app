import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as api from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
import { CommentThreadModal } from '../../../components/comments/CommentThreadModal';
import { CommentThreadAdapter, groupCommentToDisplayModel } from '../../../components/comments/commentTypes';
import { CreatePostFab } from '../../../components/posts/CreatePostFab';
import { PostCard } from '../../../components/posts/PostCard';
import { groupPostToPostDisplayModel } from '../../../components/posts/postMappers';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TextField } from '../../../components/ui/TextField';
import {
    useCreateGroupPostMutation,
    useContactGroupAdminsMutation,
    useCreateGroupCommentMutation,
    useDeleteGroupPostMutation,
    useCreateGroupInviteMutation,
    useGroup,
    useGroupJoinRequests,
    useGroupMedia,
    useGroupMembers,
    useGroupPosts,
    useReviewGroupJoinRequestMutation,
    usePinGroupPostMutation,
    useToggleGroupPostReactionMutation,
} from '../../../hooks/queries/useGroups';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { GroupAdminScreen } from './GroupAdminScreen';
import { GroupReportScreen } from './GroupReportScreen';

interface GroupDetailScreenProps {
    groupId: string;
    onBack: () => void;
}

type GroupDetailTab = 'posts' | 'media' | 'members' | 'about';
type GroupDetailSurface = 'detail' | 'admin' | 'report';

interface SelectedGroupImage {
    uri: string;
    mimeType: string;
    fileName: string;
    width: number | null;
    height: number | null;
}

interface GroupImageState {
    localImage: SelectedGroupImage;
    status: 'uploading' | 'uploaded' | 'failed';
    uploadedImage?: api.PostImage;
}

export function GroupDetailScreen({ groupId, onBack }: GroupDetailScreenProps): React.ReactElement {
    const [activeTab, setActiveTab] = useState<GroupDetailTab>('posts');
    const [surface, setSurface] = useState<GroupDetailSurface>('detail');
    const groupQuery = useGroup(groupId, true);
    const group = groupQuery.data;

    if (group && surface === 'admin') {
        return <GroupAdminScreen group={group} onBack={() => setSurface('detail')} />;
    }

    if (group && surface === 'report') {
        return (
            <GroupReportScreen
                group={group}
                onBack={() => setSurface('detail')}
                onReported={() => setSurface('detail')}
            />
        );
    }

    return (
        <View style={styles.container}>
            <ScreenHeader title="Group" onBack={onBack} />
            {groupQuery.isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : group ? (
                <>
                    <View style={styles.headerBlock}>
                        <Text style={styles.groupName}>{group.name}</Text>
                        {group.description ? (
                            <Text style={styles.description} numberOfLines={3}>{group.description}</Text>
                        ) : null}
                        <View style={styles.metaRow}>
                            <Text style={styles.metaText}>{group.member_count} members</Text>
                            <Text style={styles.metaDot}>•</Text>
                            <Text style={styles.metaText}>{group.post_count} posts</Text>
                            <Text style={styles.metaDot}>•</Text>
                            <Text style={styles.metaText}>{visibilityLabel(group.visibility)}</Text>
                        </View>
                    </View>
                    <SegmentedControl
                        items={[
                            { key: 'posts', label: 'Posts' },
                            { key: 'media', label: 'Media' },
                            { key: 'members', label: 'Members' },
                            { key: 'about', label: 'About' },
                        ]}
                        activeKey={activeTab}
                        onChange={(key) => setActiveTab(key as GroupDetailTab)}
                        style={styles.tabs}
                    />
                    {activeTab === 'posts' ? (
                        <GroupPostsTab group={group} />
                    ) : activeTab === 'media' ? (
                        <GroupMediaTab groupId={groupId} />
                    ) : activeTab === 'members' ? (
                        <GroupMembersTab groupId={groupId} />
                    ) : (
                        <GroupAboutTab
                            group={group}
                            onOpenAdmin={() => setSurface('admin')}
                            onOpenReport={() => setSurface('report')}
                        />
                    )}
                </>
            ) : (
                <EmptyState title="Group not found" />
            )}
        </View>
    );
}

function GroupPostsTab({ group }: { group: api.Group }): React.ReactElement {
    const groupId = group.id;
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [draft, setDraft] = useState('');
    const [composerOpen, setComposerOpen] = useState(false);
    const [commentPost, setCommentPost] = useState<api.GroupPost | null>(null);
    const [selectedImage, setSelectedImage] = useState<GroupImageState | null>(null);
    const uploadPromiseRef = useRef<Promise<api.PostImage> | null>(null);
    const postsQuery = useGroupPosts(groupId, 20, true);
    const createPostMutation = useCreateGroupPostMutation(groupId);
    const createCommentMutation = useCreateGroupCommentMutation(groupId, commentPost?.id ?? '');
    const createGroupComment = createCommentMutation.mutateAsync;
    const reactionMutation = useToggleGroupPostReactionMutation(groupId);
    const pinPostMutation = usePinGroupPostMutation(groupId);
    const deletePostMutation = useDeleteGroupPostMutation(groupId);
    const posts = useMemo(
        () => (postsQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [postsQuery.data?.pages],
    );

    const handleCreatePost = async (): Promise<void> => {
        const body = draft.trim();
        if (!body && !selectedImage) return;
        try {
            let images: api.PostImage[] = [];
            if (selectedImage) {
                if (selectedImage.uploadedImage) {
                    images = [selectedImage.uploadedImage];
                } else if (selectedImage.status === 'uploading' && uploadPromiseRef.current) {
                    images = [await uploadPromiseRef.current];
                } else {
                    images = [await beginImageUpload(selectedImage.localImage)];
                }
            }
            await createPostMutation.mutateAsync({
                body: body || 'Shared a photo',
                post_type: 'standard',
                images: images.map(image => ({
                    image_url: image.image_url,
                    width: image.width,
                    height: image.height,
                })),
            });
            setDraft('');
            setSelectedImage(null);
            setComposerOpen(false);
            uploadPromiseRef.current = null;
        } catch (e: unknown) {
            Alert.alert(
                'Could not post',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        }
    };

    const beginImageUpload = useCallback((image: SelectedGroupImage): Promise<api.PostImage> => {
        const uploadPromise = api.uploadPostImage({
            uri: image.uri,
            mimeType: image.mimeType,
            fileName: image.fileName,
        });
        uploadPromiseRef.current = uploadPromise;
        void uploadPromise
            .then((uploadedImage) => {
                setSelectedImage((current) => {
                    if (!current || current.localImage.uri !== image.uri) return current;
                    return { ...current, status: 'uploaded', uploadedImage };
                });
            })
            .catch(() => {
                setSelectedImage((current) => {
                    if (!current || current.localImage.uri !== image.uri) return current;
                    return { ...current, status: 'failed' };
                });
            });
        return uploadPromise;
    }, []);

    const handlePickImage = useCallback(async (): Promise<void> => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission required', 'Allow access to your photo library to attach a group photo.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        const image: SelectedGroupImage = {
            uri: asset.uri,
            mimeType: asset.mimeType ?? inferMimeType(asset.uri),
            fileName: asset.fileName ?? inferFileName(asset.uri, 'group-photo.jpg'),
            width: asset.width,
            height: asset.height,
        };
        setSelectedImage({ localImage: image, status: 'uploading' });
        beginImageUpload(image).catch(() => {});
    }, [beginImageUpload]);

    const handlePinPost = async (post: api.GroupPost): Promise<void> => {
        try {
            await pinPostMutation.mutateAsync({ postId: post.id, pinned: !post.pinned_at });
        } catch (e: unknown) {
            Alert.alert(
                'Could not update post',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        }
    };

    const handleDeletePost = (post: api.GroupPost): void => {
        Alert.alert(
            'Remove post?',
            'This removes the post from the group for all members.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        deletePostMutation.mutate(post.id, {
                            onError: (e: unknown) => {
                                Alert.alert(
                                    'Could not remove post',
                                    e instanceof Error ? e.message : 'Something went wrong.',
                                );
                            },
                        });
                    },
                },
            ],
        );
    };

    const handleOpenPostActions = useCallback((post: api.GroupPost): void => {
        Alert.alert(
            'Post options',
            'Choose a moderation action for this group post.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: post.pinned_at ? 'Unpin' : 'Pin', onPress: () => { void handlePinPost(post); } },
                { text: 'Remove', style: 'destructive', onPress: () => handleDeletePost(post) },
            ],
        );
    }, [handleDeletePost, handlePinPost]);

    const commentAdapter = useMemo<CommentThreadAdapter | null>(() => {
        if (!commentPost) return null;
        return {
            loadComments: async (cursor?: string) => {
                const result = await api.listGroupComments(groupId, commentPost.id, cursor);
                return {
                    ...result,
                    items: (result.items ?? []).map(groupCommentToDisplayModel),
                };
            },
            createComment: async (body: string) => {
                const comment = await createGroupComment(body);
                return groupCommentToDisplayModel(comment);
            },
        };
    }, [commentPost, createGroupComment, groupId]);

    return (
        <View style={styles.postsSurface}>
            <FlatList
                data={posts}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.postListContent, { paddingBottom: Spacing.xl + insets.bottom + 72 }]}
                renderItem={({ item }) => (
                    <PostCard
                        post={groupPostToPostDisplayModel(item, user?.id ?? '')}
                        onReact={() => reactionMutation.mutate(item.id)}
                        onOpenComments={() => setCommentPost(item)}
                        onOpenActions={group.can_moderate_content ? () => handleOpenPostActions(item) : undefined}
                    />
                )}
                ListEmptyComponent={!postsQuery.isLoading ? (
                    <EmptyState title="No posts yet" compact />
                ) : null}
                ListFooterComponent={postsQuery.isFetchingNextPage ? (
                    <ActivityIndicator color={Colors.primary} />
                ) : null}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                    if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) {
                        postsQuery.fetchNextPage();
                    }
                }}
            />

            <CreatePostFab
                visible={group.can_post}
                bottom={insets.bottom + 20}
                onPress={() => setComposerOpen(true)}
            />

            <Modal
                visible={composerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    if (createPostMutation.isPending) return;
                    setComposerOpen(false);
                }}
            >
                <View style={styles.composerBackdrop}>
                    <View style={styles.composerModal}>
                        <Text style={styles.composerTitle}>Post to {group.name}</Text>
                        <TextField
                            value={draft}
                            onChangeText={setDraft}
                            placeholder="Post to the group"
                            multiline
                            style={styles.composerInput}
                        />
                        {selectedImage ? (
                            <View style={styles.selectedImageRow}>
                                <Image source={{ uri: selectedImage.localImage.uri }} style={styles.selectedImage} />
                                <View style={styles.selectedImageCopy}>
                                    <Text style={styles.selectedImageTitle}>
                                        {selectedImage.status === 'uploaded'
                                            ? 'Photo ready'
                                            : selectedImage.status === 'failed'
                                                ? 'Upload failed'
                                                : 'Uploading photo'}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            uploadPromiseRef.current = null;
                                            setSelectedImage(null);
                                        }}
                                    >
                                        <Text style={styles.removeImageText}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}
                        <View style={styles.composerActions}>
                            <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
                                <Ionicons name="image-outline" size={17} color={Colors.primary} />
                                <Text style={styles.photoButtonText}>Photo</Text>
                            </TouchableOpacity>
                            <View style={styles.composerModalActions}>
                                <TouchableOpacity
                                    style={styles.composerSecondaryButton}
                                    disabled={createPostMutation.isPending}
                                    onPress={() => setComposerOpen(false)}
                                >
                                    <Text style={styles.composerSecondaryText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.composerButton,
                                        ((!draft.trim() && !selectedImage) || createPostMutation.isPending) && styles.composerButtonDisabled,
                                    ]}
                                    onPress={handleCreatePost}
                                    disabled={(!draft.trim() && !selectedImage) || createPostMutation.isPending}
                                >
                                    {createPostMutation.isPending ? (
                                        <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                    ) : (
                                        <Text style={styles.composerButtonText}>Post</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {commentPost && user && commentAdapter ? (
                <View style={StyleSheet.absoluteFillObject}>
                    <CommentThreadModal
                        title={commentPost.comment_count > 0
                            ? `${commentPost.comment_count} Comment${commentPost.comment_count === 1 ? '' : 's'}`
                            : 'Comments'}
                        adapter={commentAdapter}
                        currentUser={user}
                        initialCommentCount={commentPost.comment_count}
                        focusComposer={false}
                        onClose={() => setCommentPost(null)}
                        onPressUser={() => {}}
                    />
                </View>
            ) : null}
        </View>
    );
}

function GroupMediaTab({ groupId }: { groupId: string }): React.ReactElement {
    const mediaQuery = useGroupMedia(groupId, 30, true);
    const media = useMemo(
        () => (mediaQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [mediaQuery.data?.pages],
    );

    return (
        <FlatList
            data={media}
            keyExtractor={item => item.id}
            numColumns={3}
            contentContainerStyle={styles.mediaGrid}
            renderItem={({ item }) => (
                <Image source={{ uri: item.thumb_url ?? item.image_url }} style={styles.mediaItem} />
            )}
            ListEmptyComponent={!mediaQuery.isLoading ? (
                <EmptyState title="No shared photos yet" compact />
            ) : null}
        />
    );
}

function GroupMembersTab({ groupId }: { groupId: string }): React.ReactElement {
    const membersQuery = useGroupMembers(groupId, 30, true);
    const members = useMemo(
        () => (membersQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [membersQuery.data?.pages],
    );

    return (
        <FlatList
            data={members}
            keyExtractor={item => item.user_id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
                <View style={styles.memberRow}>
                    <Avatar username={item.username} avatarUrl={item.avatar_url ?? undefined} size={38} fontSize={13} />
                    <Text style={styles.memberName}>{item.username}</Text>
                    <Text style={styles.roleLabel}>{item.role}</Text>
                </View>
            )}
            ListEmptyComponent={!membersQuery.isLoading ? (
                <EmptyState title="No members visible" compact />
            ) : null}
        />
    );
}

function GroupAboutTab({
    group,
    onOpenAdmin,
    onOpenReport,
}: {
    group: api.Group;
    onOpenAdmin: () => void;
    onOpenReport: () => void;
}): React.ReactElement {
    const [contactBody, setContactBody] = useState('');
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const contactMutation = useContactGroupAdminsMutation(group.id);
    const inviteMutation = useCreateGroupInviteMutation(group.id);
    const joinRequestsQuery = useGroupJoinRequests(group.id, group.can_manage_members);
    const reviewMutation = useReviewGroupJoinRequestMutation(group.id);

    const handleContactAdmins = async (): Promise<void> => {
        const body = contactBody.trim();
        if (!body) return;
        try {
            await contactMutation.mutateAsync({ body });
            setContactBody('');
            Alert.alert('Sent', 'Your message was sent to the group admins.');
        } catch (e: unknown) {
            Alert.alert('Could not send message', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    const handleCreateInvite = async (): Promise<void> => {
        try {
            const invite = await inviteMutation.mutateAsync({ requires_approval: group.visibility === 'approval_required' });
            setInviteToken(invite.token ?? null);
        } catch (e: unknown) {
            Alert.alert('Could not create invite', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.aboutContent}>
            <Text style={styles.aboutLabel}>Rules</Text>
            <Text style={styles.aboutBody}>{group.rules || 'No rules have been added yet.'}</Text>
            <Text style={styles.aboutLabel}>Tags</Text>
            <Text style={styles.aboutBody}>{group.tags.length ? group.tags.join(', ') : 'No tags'}</Text>
            <Text style={styles.aboutLabel}>Recovery pathways</Text>
            <Text style={styles.aboutBody}>{group.recovery_pathways.length ? group.recovery_pathways.join(', ') : 'No pathway filters'}</Text>

            {group.can_manage_members || group.can_moderate_content ? (
                <View style={styles.aboutPanel}>
                    <Text style={styles.panelTitle}>Admin tools</Text>
                    <TouchableOpacity style={styles.panelButton} onPress={onOpenAdmin}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={Colors.textOn.primary} />
                        <Text style={styles.panelButtonText}>Open admin center</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {group.can_invite ? (
                <View style={styles.aboutPanel}>
                    <Text style={styles.panelTitle}>Invite</Text>
                    <TouchableOpacity
                        style={styles.panelButton}
                        onPress={handleCreateInvite}
                        disabled={inviteMutation.isPending}
                    >
                        <Text style={styles.panelButtonText}>Create invite link</Text>
                    </TouchableOpacity>
                    {inviteToken ? (
                        <Text style={styles.tokenText} selectable>{inviteToken}</Text>
                    ) : null}
                </View>
            ) : null}

            {group.can_manage_members ? (
                <View style={styles.aboutPanel}>
                    <Text style={styles.panelTitle}>Join requests</Text>
                    {(joinRequestsQuery.data?.items ?? []).length === 0 ? (
                        <Text style={styles.aboutBody}>No pending requests.</Text>
                    ) : null}
                    {(joinRequestsQuery.data?.items ?? []).map(request => (
                        <View key={request.id} style={styles.requestRow}>
                            <Avatar username={request.username} avatarUrl={request.avatar_url ?? undefined} size={32} fontSize={11} />
                            <View style={styles.requestCopy}>
                                <Text style={styles.memberName}>{request.username}</Text>
                                {request.message ? <Text style={styles.aboutBody}>{request.message}</Text> : null}
                            </View>
                            <TouchableOpacity
                                style={styles.iconAction}
                                onPress={() => reviewMutation.mutate({ requestId: request.id, approve: true })}
                            >
                                <Ionicons name="checkmark" size={17} color={Colors.success} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.iconAction}
                                onPress={() => reviewMutation.mutate({ requestId: request.id, approve: false })}
                            >
                                <Ionicons name="close" size={17} color={Colors.danger} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            ) : null}

            <View style={styles.aboutPanel}>
                <Text style={styles.panelTitle}>Contact admins</Text>
                <TextField
                    value={contactBody}
                    onChangeText={setContactBody}
                    placeholder="Message the group admins"
                    multiline
                    style={styles.panelInput}
                />
                <TouchableOpacity
                    style={[styles.panelButton, !contactBody.trim() && styles.composerButtonDisabled]}
                    onPress={handleContactAdmins}
                    disabled={!contactBody.trim() || contactMutation.isPending}
                >
                    <Text style={styles.panelButtonText}>Send</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.aboutPanel}>
                <Text style={styles.panelTitle}>Report group</Text>
                <TouchableOpacity style={styles.reportButton} onPress={onOpenReport}>
                    <Text style={styles.reportButtonText}>Report</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

function visibilityLabel(visibility: api.GroupVisibility): string {
    if (visibility === 'approval_required') return 'Approval required';
    if (visibility === 'invite_only') return 'Invite only';
    if (visibility === 'private_hidden') return 'Private';
    return 'Public';
}

function inferMimeType(uri: string): string {
    const lower = uri.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
}

function inferFileName(uri: string, fallback: string): string {
    const parts = uri.split('/');
    return parts[parts.length - 1] || fallback;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerBlock: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
        gap: Spacing.xs,
    },
    groupName: {
        fontSize: Typography.sizes.xl,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    description: {
        fontSize: Typography.sizes.base,
        lineHeight: 21,
        color: Colors.text.secondary,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    metaText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.muted,
    },
    metaDot: {
        color: Colors.text.muted,
    },
    tabs: {
        marginHorizontal: Spacing.md,
    },
    listContent: {
        padding: Spacing.md,
        gap: Spacing.md,
    },
    postsSurface: {
        flex: 1,
    },
    postListContent: {
        paddingTop: Spacing.md,
    },
    composerBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.56)',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    composerModal: {
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    composerTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    composerInput: {
        minHeight: 78,
        textAlignVertical: 'top',
    },
    composerButton: {
        alignSelf: 'flex-end',
        minWidth: 82,
        minHeight: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
    },
    composerButtonDisabled: {
        opacity: 0.5,
    },
    composerButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.textOn.primary,
    },
    composerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    composerModalActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    composerSecondaryButton: {
        minHeight: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
    },
    composerSecondaryText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    photoButton: {
        minHeight: 36,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.primarySubtle,
    },
    photoButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.primary,
    },
    selectedImageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.page,
        padding: Spacing.sm,
    },
    selectedImage: {
        width: 54,
        height: 54,
        borderRadius: Radius.sm,
        backgroundColor: Colors.bg.surface,
    },
    selectedImageCopy: {
        flex: 1,
        gap: 4,
    },
    selectedImageTitle: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    removeImageText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.danger,
    },
    mediaGrid: {
        padding: Spacing.md,
    },
    mediaItem: {
        flex: 1,
        aspectRatio: 1,
        margin: 2,
        borderRadius: Radius.sm,
        backgroundColor: Colors.bg.surface,
    },
    memberRow: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    memberName: {
        flex: 1,
        fontSize: Typography.sizes.base,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    roleLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.muted,
        textTransform: 'capitalize',
    },
    aboutContent: {
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    aboutLabel: {
        marginTop: Spacing.sm,
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    aboutBody: {
        fontSize: Typography.sizes.base,
        lineHeight: 22,
        color: Colors.text.secondary,
    },
    aboutPanel: {
        marginTop: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    panelTitle: {
        fontSize: Typography.sizes.base,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    panelInput: {
        minHeight: 44,
    },
    panelButton: {
        alignSelf: 'flex-start',
        minHeight: 36,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
    },
    panelButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.textOn.primary,
    },
    tokenText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
    },
    requestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        minHeight: 46,
    },
    requestCopy: {
        flex: 1,
    },
    iconAction: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: Colors.bg.page,
    },
    reportButton: {
        alignSelf: 'flex-start',
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.danger,
        paddingHorizontal: Spacing.md,
    },
    reportButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.textOn.danger,
    },
});
