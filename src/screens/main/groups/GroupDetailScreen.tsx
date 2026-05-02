import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as api from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
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
    useGroupComments,
    useGroupJoinRequests,
    useGroupMedia,
    useGroupMembers,
    useGroupPosts,
    useReviewGroupJoinRequestMutation,
    usePinGroupPostMutation,
    useToggleGroupPostReactionMutation,
} from '../../../hooks/queries/useGroups';
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
    const [draft, setDraft] = useState('');
    const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<GroupImageState | null>(null);
    const uploadPromiseRef = useRef<Promise<api.PostImage> | null>(null);
    const postsQuery = useGroupPosts(groupId, 20, true);
    const createPostMutation = useCreateGroupPostMutation(groupId);
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

    return (
        <FlatList
            data={posts}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={group.can_post ? (
                <View style={styles.composer}>
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
                    <TouchableOpacity
                        style={[
                            styles.composerButton,
                                (!draft.trim() && !selectedImage || createPostMutation.isPending) && styles.composerButtonDisabled,
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
            ) : null}
            renderItem={({ item }) => (
                <GroupPostCard
                    post={item}
                    canModerate={group.can_moderate_content}
                    onReact={() => reactionMutation.mutate(item.id)}
                    onPin={() => handlePinPost(item)}
                    onDelete={() => handleDeletePost(item)}
                    commentsExpanded={expandedPostId === item.id}
                    onToggleComments={() => setExpandedPostId(current => current === item.id ? null : item.id)}
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
    );
}

function GroupPostCard({
    post,
    canModerate,
    onReact,
    onPin,
    onDelete,
    commentsExpanded,
    onToggleComments,
}: {
    post: api.GroupPost;
    canModerate: boolean;
    onReact: () => void;
    onPin: () => void;
    onDelete: () => void;
    commentsExpanded: boolean;
    onToggleComments: () => void;
}): React.ReactElement {
    return (
        <View style={styles.postCard}>
            <View style={styles.postHeader}>
                <Avatar username={post.username} avatarUrl={post.avatar_url ?? undefined} size={34} fontSize={12} />
                <View style={styles.postHeaderCopy}>
                    <Text style={styles.postAuthor}>{post.anonymous ? 'Anonymous member' : post.username}</Text>
                    <Text style={styles.postType}>{postTypeLabel(post.post_type)}</Text>
                </View>
                {post.pinned_at ? (
                    <Ionicons name="pin" size={16} color={Colors.primary} />
                ) : null}
            </View>
            {canModerate ? (
                <View style={styles.moderationRow}>
                    <TouchableOpacity style={styles.moderationButton} onPress={onPin}>
                        <Ionicons
                            name={post.pinned_at ? 'remove-circle-outline' : 'pin-outline'}
                            size={15}
                            color={Colors.text.secondary}
                        />
                        <Text style={styles.moderationText}>{post.pinned_at ? 'Unpin' : 'Pin'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.moderationButton} onPress={onDelete}>
                        <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                        <Text style={[styles.moderationText, styles.moderationTextDanger]}>Remove</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
            <Text style={styles.postBody}>{post.body}</Text>
            {post.images[0] ? (
                <Image source={{ uri: post.images[0].thumb_url ?? post.images[0].image_url }} style={styles.postImage} />
            ) : null}
            <View style={styles.postActions}>
                <TouchableOpacity style={styles.actionButton} onPress={onReact}>
                    <Ionicons
                        name={post.viewer_has_reacted ? 'heart' : 'heart-outline'}
                        size={17}
                        color={post.viewer_has_reacted ? Colors.danger : Colors.text.secondary}
                    />
                    <Text style={styles.actionText}>{post.reaction_count}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={onToggleComments}>
                    <Ionicons name="chatbubble-outline" size={16} color={Colors.text.secondary} />
                    <Text style={styles.actionText}>{post.comment_count}</Text>
                </TouchableOpacity>
            </View>
            {commentsExpanded ? <GroupCommentsPanel post={post} /> : null}
        </View>
    );
}

function GroupCommentsPanel({ post }: { post: api.GroupPost }): React.ReactElement {
    const [draft, setDraft] = useState('');
    const commentsQuery = useGroupComments(post.group_id, post.id, 20, true);
    const createCommentMutation = useCreateGroupCommentMutation(post.group_id, post.id);
    const comments = useMemo(
        () => (commentsQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [commentsQuery.data?.pages],
    );

    const handleComment = async (): Promise<void> => {
        const body = draft.trim();
        if (!body) return;
        try {
            await createCommentMutation.mutateAsync(body);
            setDraft('');
        } catch (e: unknown) {
            Alert.alert(
                'Could not comment',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        }
    };

    return (
        <View style={styles.commentsPanel}>
            {comments.map(comment => (
                <View key={comment.id} style={styles.commentRow}>
                    <Avatar username={comment.username} avatarUrl={comment.avatar_url ?? undefined} size={28} fontSize={10} />
                    <View style={styles.commentBubble}>
                        <Text style={styles.commentAuthor}>{comment.username}</Text>
                        <Text style={styles.commentBody}>{comment.body}</Text>
                    </View>
                </View>
            ))}
            {comments.length === 0 && !commentsQuery.isLoading ? (
                <Text style={styles.noCommentsText}>No comments yet</Text>
            ) : null}
            <View style={styles.commentComposer}>
                <TextField
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Write a comment"
                    style={styles.commentInput}
                />
                <TouchableOpacity
                    style={[
                        styles.commentButton,
                        (!draft.trim() || createCommentMutation.isPending) && styles.commentButtonDisabled,
                    ]}
                    onPress={handleComment}
                    disabled={!draft.trim() || createCommentMutation.isPending}
                >
                    <Ionicons name="send" size={15} color={Colors.textOn.primary} />
                </TouchableOpacity>
            </View>
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

function postTypeLabel(type: api.GroupPostType): string {
    if (type === 'need_support') return 'Needs support';
    if (type === 'admin_announcement') return 'Announcement';
    if (type === 'check_in') return 'Check-in';
    if (type === 'milestone') return 'Milestone';
    return 'Post';
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
    postCard: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
        gap: Spacing.md,
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    postHeaderCopy: {
        flex: 1,
    },
    postAuthor: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    postType: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.text.muted,
    },
    postBody: {
        fontSize: Typography.sizes.base,
        lineHeight: 22,
        color: Colors.text.primary,
    },
    moderationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingTop: Spacing.xs,
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
    },
    moderationButton: {
        minHeight: 30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    moderationText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '800',
        color: Colors.text.secondary,
    },
    moderationTextDanger: {
        color: Colors.danger,
    },
    postImage: {
        width: '100%',
        aspectRatio: 4 / 3,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.page,
    },
    postActions: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    composer: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
        gap: Spacing.sm,
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
    actionButton: {
        minHeight: 32,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    actionText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.secondary,
    },
    commentsPanel: {
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
        paddingTop: Spacing.md,
        gap: Spacing.sm,
    },
    commentRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    commentBubble: {
        flex: 1,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.page,
        padding: Spacing.sm,
        gap: 2,
    },
    commentAuthor: {
        fontSize: Typography.sizes.xs,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    commentBody: {
        fontSize: Typography.sizes.sm,
        lineHeight: 18,
        color: Colors.text.secondary,
    },
    noCommentsText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    commentComposer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    commentInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: Typography.sizes.sm,
    },
    commentButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
    },
    commentButtonDisabled: {
        opacity: 0.5,
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
