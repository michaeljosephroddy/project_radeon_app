import React, { useCallback, useMemo, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
import { CreatePostFab } from '../../../components/posts/CreatePostFab';
import { PostCard } from '../../../components/posts/PostCard';
import { groupPostToPostDisplayModel } from '../../../components/posts/postMappers';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TextField } from '../../../components/ui/TextField';
import {
    useContactGroupAdminsMutation,
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
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { GroupAdminScreen } from './GroupAdminScreen';
import { GroupReportScreen } from './GroupReportScreen';

interface GroupDetailScreenProps {
    groupId: string;
    onBack: () => void;
    onOpenComments: (post: api.GroupPost) => void;
    onOpenCreatePost: (group: api.Group) => void;
}

type GroupDetailTab = 'posts' | 'media' | 'members' | 'about';
type GroupDetailSurface = 'detail' | 'admin' | 'report';

export function GroupDetailScreen({
    groupId,
    onBack,
    onOpenComments,
    onOpenCreatePost,
}: GroupDetailScreenProps): React.ReactElement {
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
        <SafeAreaView style={styles.container} edges={['bottom']}>
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
                        <GroupPostsTab
                            group={group}
                            onOpenComments={onOpenComments}
                            onOpenCreatePost={onOpenCreatePost}
                        />
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
        </SafeAreaView>
    );
}

function GroupPostsTab({
    group,
    onOpenComments,
    onOpenCreatePost,
}: {
    group: api.Group;
    onOpenComments: (post: api.GroupPost) => void;
    onOpenCreatePost: (group: api.Group) => void;
}): React.ReactElement {
    const groupId = group.id;
    const insets = useSafeAreaInsets();
    const postsQuery = useGroupPosts(groupId, 20, true);
    const reactionMutation = useToggleGroupPostReactionMutation(groupId);
    const pinPostMutation = usePinGroupPostMutation(groupId);
    const deletePostMutation = useDeleteGroupPostMutation(groupId);
    const posts = useMemo(
        () => (postsQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [postsQuery.data?.pages],
    );

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

    return (
        <View style={styles.postsSurface}>
            <FlatList
                data={posts}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.postListContent, { paddingBottom: Spacing.xl + insets.bottom + 72 }]}
                renderItem={({ item }) => (
                    <PostCard
                        post={groupPostToPostDisplayModel(item, '')}
                        onReact={() => reactionMutation.mutate(item.id)}
                        onOpenComments={() => onOpenComments(item)}
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
                onPress={() => onOpenCreatePost(group)}
            />
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
    composerButtonDisabled: {
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
