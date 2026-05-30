import { appAlert } from '@/components/ui/appAlert';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { InfiniteData, QueryClient, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
import { PostCard } from '../../../components/posts/PostCard';
import { groupPostToPostDisplayModel } from '../../../components/posts/postMappers';
import { SupportRequestCard } from '../../../components/support/SupportRequestCard';
import { getSupportOfferType, getSupportTypeLabel } from '../../../components/support/supportRequestPresentation';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { ScrollToTopButton } from '../../../components/ui/ScrollToTopButton';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TextField } from '../../../components/ui/TextField';
import { AppKeyboardAwareScrollView } from '../../../components/ui/AppKeyboardAwareScrollView';
import {
    useContactGroupAdminsMutation,
    useDeleteGroupPostMutation,
    useGroup,
    useGroupMedia,
    useGroupMembers,
    useGroupPosts,
    usePinGroupPostMutation,
    useToggleGroupPostReactionMutation,
} from '../../../hooks/queries/useGroups';
import { useMySupportRequests } from '../../../hooks/queries/useSupport';
import { useAuth } from '../../../hooks/useAuth';
import { useScrollToTopButton } from '../../../hooks/useScrollToTopButton';
import { screenStandards } from '../../../styles/screenStandards';
import { AvatarSizes, Colors, ControlSizes, IconSizes, Radius, Spacing, TextStyles, Typography } from '../../../theme';
import { formatUsername } from '../../../utils/identity';

interface GroupDetailScreenProps {
    groupId: string;
    onBack: () => void;
    onOpenComments: (post: api.GroupPost) => void;
    onOpenChat: (chat: api.Chat) => void;
    onOpenAdmin: () => void;
    onOpenReport: () => void;
    onManageSupportRequest: (request: api.SupportRequest, post?: api.GroupPost) => void;
    focusPostRequest: { postId: string; nonce: number } | null;
    onFocusPostConsumed: (nonce: number) => void;
    focusSupportRequest: { requestId: string; nonce: number; postId?: string } | null;
    onFocusSupportRequestConsumed: (nonce: number) => void;
}

type GroupDetailTab = 'posts' | 'media' | 'members' | 'about';
type GroupSupportSurface = 'feed' | 'mine';

export function GroupDetailScreen({
    groupId,
    onBack,
    onOpenComments,
    onOpenChat,
    onOpenAdmin,
    onOpenReport,
    onManageSupportRequest,
    focusPostRequest,
    onFocusPostConsumed,
    focusSupportRequest,
    onFocusSupportRequestConsumed,
}: GroupDetailScreenProps): React.ReactElement {
    const [activeTab, setActiveTab] = useState<GroupDetailTab>('posts');
    const groupQuery = useGroup(groupId, true);
    const group = groupQuery.data;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title="Group" onBack={onBack} />
            {groupQuery.isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : group ? (
                <>
                    <View style={screenStandards.pageTabsWrap}>
                        <SegmentedControl
                            items={[
                                { key: 'posts', label: 'Posts' },
                                { key: 'media', label: 'Media' },
                                { key: 'members', label: 'Members' },
                                { key: 'about', label: 'About' },
                            ]}
                            activeKey={activeTab}
                            onChange={(key) => setActiveTab(key as GroupDetailTab)}
                            layer="page"
                            tone="primary"
                            style={screenStandards.pageTabsControl}
                        />
                    </View>
                    {activeTab === 'posts' ? (
                        <GroupPostsTab
                            group={group}
                            onOpenComments={onOpenComments}
                            onOpenChat={onOpenChat}
                            onManageSupportRequest={onManageSupportRequest}
                            focusPostRequest={focusPostRequest}
                            onFocusPostConsumed={onFocusPostConsumed}
                            focusSupportRequest={focusSupportRequest}
                            onFocusSupportRequestConsumed={onFocusSupportRequestConsumed}
                        />
                    ) : activeTab === 'media' ? (
                        <GroupMediaTab group={group} />
                    ) : activeTab === 'members' ? (
                        <GroupMembersTab group={group} />
                    ) : (
                        <GroupAboutTab
                            group={group}
                            onOpenAdmin={onOpenAdmin}
                            onOpenReport={onOpenReport}
                        />
                    )}
                </>
            ) : (
                <EmptyState title="Group not found" />
            )}
        </SafeAreaView>
    );
}

function GroupSummaryHeader({ group }: { group: api.Group }): React.ReactElement {
    return (
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
                <Text style={styles.metaText}>Public</Text>
            </View>
        </View>
    );
}

function GroupPostsTab({
    group,
    onOpenComments,
    onOpenChat,
    onManageSupportRequest,
    focusPostRequest,
    onFocusPostConsumed,
    focusSupportRequest,
    onFocusSupportRequestConsumed,
}: {
    group: api.Group;
    onOpenComments: (post: api.GroupPost) => void;
    onOpenChat: (chat: api.Chat) => void;
    onManageSupportRequest: (request: api.SupportRequest, post?: api.GroupPost) => void;
    focusPostRequest: { postId: string; nonce: number } | null;
    onFocusPostConsumed: (nonce: number) => void;
    focusSupportRequest: { requestId: string; nonce: number; postId?: string } | null;
    onFocusSupportRequestConsumed: (nonce: number) => void;
}): React.ReactElement {
    const groupId = group.id;
    const listRef = useRef<FlatList<api.GroupPost> | null>(null);
    const requestListRef = useRef<FlatList<api.SupportRequest> | null>(null);
    const scrollToTop = useScrollToTopButton({ threshold: 520 });
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isCommunitySupport = false;
    const [supportSurface, setSupportSurface] = useState<GroupSupportSurface>('feed');
    const [pendingSupportIds, setPendingSupportIds] = useState<Set<string>>(new Set());
    const postsQuery = useGroupPosts(groupId, 20, true);
    const myRequestsQuery = useMySupportRequests(20, isCommunitySupport);
    const reactionMutation = useToggleGroupPostReactionMutation(groupId);
    const pinPostMutation = usePinGroupPostMutation(groupId);
    const deletePostMutation = useDeleteGroupPostMutation(groupId);
    const posts = useMemo(
        () => (postsQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [postsQuery.data?.pages],
    );
    const myRequests = useMemo(
        () => (myRequestsQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [myRequestsQuery.data?.pages],
    );
    const openMyRequests = useMemo(
        () => myRequests.filter((request) => request.status === 'open'),
        [myRequests],
    );

    useEffect(() => {
        if (!focusPostRequest || postsQuery.isLoading) return;
        const focusedPost = posts.find((post) => post.id === focusPostRequest.postId);
        if (focusedPost) {
            onOpenComments(focusedPost);
        }
        onFocusPostConsumed(focusPostRequest.nonce);
    }, [focusPostRequest, onFocusPostConsumed, onOpenComments, posts, postsQuery.isLoading]);

    useEffect(() => {
        if (!focusSupportRequest) return;
        if (postsQuery.isLoading || myRequestsQuery.isLoading) return;
        let cancelled = false;
        const post = posts.find((item) => (
            item.support_request?.id === focusSupportRequest.requestId
            || item.support_request_id === focusSupportRequest.requestId
            || (focusSupportRequest.postId ? item.id === focusSupportRequest.postId : false)
        ));
        const request = myRequests.find((item) => item.id === focusSupportRequest.requestId)
            ?? post?.support_request
            ?? null;
        if (request) {
            onManageSupportRequest(request, post);
            onFocusSupportRequestConsumed(focusSupportRequest.nonce);
            return () => {
                cancelled = true;
            };
        }
        void api.getSupportRequest(focusSupportRequest.requestId)
            .then((loaded) => {
                if (cancelled) return;
                onManageSupportRequest(loaded, post);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) {
                    onFocusSupportRequestConsumed(focusSupportRequest.nonce);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [
        focusSupportRequest,
        myRequests,
        myRequestsQuery.isLoading,
        onFocusSupportRequestConsumed,
        onManageSupportRequest,
        posts,
        postsQuery.isLoading,
    ]);

    const setSupportPending = useCallback((id: string, value: boolean): void => {
        setPendingSupportIds((current) => {
            const next = new Set(current);
            if (value) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const invalidateSupportGroup = useCallback((): void => {
        void Promise.all([
            queryClient.invalidateQueries({ queryKey: ['groups', 'posts', groupId] }),
            queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] }),
            queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
            queryClient.invalidateQueries({ queryKey: ['support-offers'] }),
            queryClient.invalidateQueries({ queryKey: ['chats'] }),
        ]);
    }, [groupId, queryClient]);

    const handlePinPost = useCallback(async (post: api.GroupPost): Promise<void> => {
        try {
            await pinPostMutation.mutateAsync({ postId: post.id, pinned: !post.pinned_at });
        } catch (e: unknown) {
            appAlert.alert(
                'Could not update post',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        }
    }, [pinPostMutation]);

    const handleDeletePost = useCallback((post: api.GroupPost): void => {
        appAlert.alert(
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
                                appAlert.alert(
                                    'Could not remove post',
                                    e instanceof Error ? e.message : 'Something went wrong.',
                                );
                            },
                        });
                    },
                },
            ],
        );
    }, [deletePostMutation]);

    const handleReportPost = useCallback((post: api.GroupPost): void => {
        appAlert.alert('Report post?', 'This sends the post to group moderators.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Report',
                style: 'destructive',
                onPress: () => {
                    void api.reportGroupTarget(groupId, {
                        target_type: 'post',
                        target_id: post.id,
                        reason: 'Safety concern',
                        details: null,
                    }).then(() => {
                        appAlert.alert('Report sent', 'Thanks for helping keep this group safe.');
                    }).catch((error: unknown) => {
                        appAlert.alert('Report failed', error instanceof Error ? error.message : 'Please try again.');
                    });
                },
            },
        ]);
    }, [groupId]);

    const findSupportPost = useCallback((request: api.SupportRequest): api.GroupPost | undefined => (
        posts.find((post) => post.support_request?.id === request.id || post.support_request_id === request.id)
    ), [posts]);

    const handleOpenSupportComments = useCallback((request: api.SupportRequest): void => {
        const post = findSupportPost(request);
        if (post) onOpenComments(post);
    }, [findSupportPost, onOpenComments]);

    const handleSupportPrimaryAction = useCallback(async (request: api.SupportRequest): Promise<void> => {
        if (request.is_own_request) {
            if (request.status === 'active' && request.chat_id) {
                setSupportPending(request.id, true);
                try {
                    const chat = await api.getChat(request.chat_id);
                    onOpenChat(chat);
                } catch (e: unknown) {
                    appAlert.alert('Could not open chat', e instanceof Error ? e.message : 'Something went wrong.');
                } finally {
                    setSupportPending(request.id, false);
                }
                return;
            }
            const post = findSupportPost(request);
            onManageSupportRequest(request, post);
            return;
        }

        if (request.status !== 'open') {
            handleOpenSupportComments(request);
            return;
        }
        if (request.already_chatting) {
            appAlert.alert('Already chatting', `You already have an open chat with ${formatUsername(request.username)}.`);
            return;
        }

        const offerType = getSupportOfferType(request);
        setSupportPending(request.id, true);
        try {
            await api.createSupportOffer(request.id, {
                offer_type: offerType,
                message: `I can help with ${getSupportTypeLabel(offerType).toLowerCase()} support.`,
            });
            appAlert.alert('Offer sent', 'The requester can accept it if they want direct support.');
            invalidateSupportGroup();
        } catch (e: unknown) {
            appAlert.alert('Could not send offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSupportPending(request.id, false);
        }
    }, [findSupportPost, handleOpenSupportComments, invalidateSupportGroup, onManageSupportRequest, onOpenChat, setSupportPending]);

    const handleCloseSupportRequest = useCallback((request: api.SupportRequest): void => {
        appAlert.alert(
            'Close request?',
            'This marks the support request as closed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close',
                    style: 'destructive',
                    onPress: () => {
                        setSupportPending(request.id, true);
                        void api.updateSupportRequest(request.id, { status: 'closed' })
                            .then(() => {
                                removeSupportRequestFromGroupPostCache(queryClient, groupId, request.id);
                                invalidateSupportGroup();
                            })
                            .catch((e: unknown) => {
                                appAlert.alert('Could not close request', e instanceof Error ? e.message : 'Something went wrong.');
                            })
                            .finally(() => setSupportPending(request.id, false));
                    },
                },
            ],
        );
    }, [invalidateSupportGroup, setSupportPending]);

    const shouldShowSupportPrimaryAction = useCallback((request: api.SupportRequest): boolean => {
        if (request.is_own_request) return true;
        return request.status === 'open';
    }, []);

    const renderPost = useCallback(({ item }: { item: api.GroupPost }): React.ReactElement => {
        if (isCommunitySupport && item.post_type === 'need_support' && item.support_request) {
            return (
                <SupportRequestCard
                    request={item.support_request}
                    pending={pendingSupportIds.has(item.support_request.id)}
                    onOpenComments={() => onOpenComments(item)}
                    onPrimaryAction={shouldShowSupportPrimaryAction(item.support_request)
                        ? (request) => { void handleSupportPrimaryAction(request); }
                        : undefined}
                    onClose={handleCloseSupportRequest}
                />
            );
        }

        return (
            <PostCard
                post={groupPostToPostDisplayModel(item, user?.id ?? '')}
                onReact={() => reactionMutation.mutate(item.id)}
                onOpenComments={() => onOpenComments(item)}
                actions={[
                    ...(group.can_moderate_content ? [
                        { label: item.pinned_at ? 'Unpin' : 'Pin', onPress: () => { void handlePinPost(item); } },
                        { label: 'Remove', destructive: true, onPress: () => handleDeletePost(item) },
                    ] : []),
                    ...(item.user_id !== user?.id ? [
                        { label: 'Report', destructive: true, onPress: () => handleReportPost(item) },
                    ] : []),
                ]}
            />
        );
    }, [
        group.can_moderate_content,
        handleCloseSupportRequest,
        handleDeletePost,
        handlePinPost,
        handleReportPost,
        handleSupportPrimaryAction,
        isCommunitySupport,
        onOpenComments,
        pendingSupportIds,
        reactionMutation,
        shouldShowSupportPrimaryAction,
        user?.id,
    ]);

    const renderSupportRequest = useCallback(({ item }: { item: api.SupportRequest }): React.ReactElement => (
        <SupportRequestCard
            request={item}
            pending={pendingSupportIds.has(item.id)}
            onOpenComments={() => {
                const post = findSupportPost(item);
                if (post) {
                    onOpenComments(post);
                    return;
                }
                onManageSupportRequest(item, post);
            }}
            onPrimaryAction={(request) => { void handleSupportPrimaryAction(request); }}
            onClose={handleCloseSupportRequest}
        />
    ), [findSupportPost, handleCloseSupportRequest, handleSupportPrimaryAction, onManageSupportRequest, onOpenComments, pendingSupportIds]);

    const renderHeader = useCallback((): React.ReactElement => (
        <>
            <GroupSummaryHeader group={group} />
            {isCommunitySupport ? (
                <SegmentedControl
                    items={[
                        { key: 'feed', label: 'Feed' },
                        { key: 'mine', label: 'My Requests', flex: 1.25 },
                    ]}
                    activeKey={supportSurface}
                    onChange={(next) => setSupportSurface(next as GroupSupportSurface)}
                    layer="section"
                    tone="secondary"
                    style={styles.innerTabs}
                />
            ) : null}
        </>
    ), [group, isCommunitySupport, supportSurface]);

    const handleScroll = useCallback((...args: Parameters<typeof scrollToTop.onScroll>): void => {
        const [event] = args;
        scrollToTop.onScroll(event);
    }, [scrollToTop]);

    if (isCommunitySupport && supportSurface === 'mine') {
        return (
            <View style={styles.postsSurface}>
                <FlatList
                    ref={requestListRef}
                    data={openMyRequests}
                    keyExtractor={item => item.id}
                    contentContainerStyle={[styles.postListContent, { paddingBottom: Spacing.xl + insets.bottom + 72 }]}
                    ListHeaderComponent={renderHeader}
                    renderItem={renderSupportRequest}
                    ListEmptyComponent={!myRequestsQuery.isLoading ? (
                        <EmptyState title="No open support requests" compact />
                    ) : null}
                    ListFooterComponent={myRequestsQuery.isFetchingNextPage ? (
                        <ActivityIndicator color={Colors.primary} />
                    ) : null}
                    onEndReachedThreshold={0.4}
                    onEndReached={() => {
                        if (myRequestsQuery.hasNextPage && !myRequestsQuery.isFetchingNextPage) {
                            myRequestsQuery.fetchNextPage();
                        }
                    }}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                />

                {scrollToTop.isVisible ? (
                    <ScrollToTopButton onPress={() => requestListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
                ) : null}

            </View>
        );
    }

    return (
        <View style={styles.postsSurface}>
            <FlatList
                ref={listRef}
                data={posts}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.postListContent, { paddingBottom: Spacing.xl + insets.bottom + 72 }]}
                ListHeaderComponent={renderHeader}
                renderItem={renderPost}
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
                onScroll={handleScroll}
                scrollEventThrottle={16}
            />

            {scrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}

        </View>
    );
}

function GroupMediaTab({ group }: { group: api.Group }): React.ReactElement {
    const listRef = useRef<FlatList<api.GroupMediaItem> | null>(null);
    const scrollToTop = useScrollToTopButton({ threshold: 520 });
    const mediaQuery = useGroupMedia(group.id, 30, true);
    const media = useMemo(
        () => (mediaQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [mediaQuery.data?.pages],
    );

    return (
        <View style={styles.listSurface}>
            <FlatList
                ref={listRef}
                data={media}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.mediaGrid}
                ListHeaderComponent={<GroupSummaryHeader group={group} />}
                renderItem={({ item }) => (
                    <Image source={{ uri: item.image_url }} style={styles.mediaItem} resizeMode="cover" />
                )}
                ItemSeparatorComponent={() => <View style={styles.mediaSeparator} />}
                ListEmptyComponent={!mediaQuery.isLoading ? (
                    <EmptyState title="No shared photos yet" compact />
                ) : null}
                ListFooterComponent={mediaQuery.isFetchingNextPage ? (
                    <ActivityIndicator color={Colors.primary} />
                ) : null}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                    if (mediaQuery.hasNextPage && !mediaQuery.isFetchingNextPage) {
                        mediaQuery.fetchNextPage();
                    }
                }}
                onScroll={scrollToTop.onScroll}
                scrollEventThrottle={16}
            />
            {scrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
        </View>
    );
}

function GroupMembersTab({ group }: { group: api.Group }): React.ReactElement {
    const listRef = useRef<FlatList<api.GroupMember> | null>(null);
    const scrollToTop = useScrollToTopButton({ threshold: 520 });
    const membersQuery = useGroupMembers(group.id, 30, true);
    const members = useMemo(
        () => (membersQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [membersQuery.data?.pages],
    );

    return (
        <View style={styles.listSurface}>
            <FlatList
                ref={listRef}
                data={members}
                keyExtractor={item => item.user_id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={<GroupSummaryHeader group={group} />}
                renderItem={({ item }) => (
                    <View style={styles.memberRow}>
                        <Avatar username={item.username} avatarUrl={item.avatar_url ?? undefined} size={AvatarSizes.compact} fontSize={TextStyles.chip.fontSize} />
                        <Text style={styles.memberName}>{item.username}</Text>
                        <Text style={styles.roleLabel}>{item.role}</Text>
                    </View>
                )}
                ListEmptyComponent={!membersQuery.isLoading ? (
                    <EmptyState title="No members visible" compact />
                ) : null}
                ListFooterComponent={membersQuery.isFetchingNextPage ? (
                    <ActivityIndicator color={Colors.primary} />
                ) : null}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                    if (membersQuery.hasNextPage && !membersQuery.isFetchingNextPage) {
                        membersQuery.fetchNextPage();
                    }
                }}
                onScroll={scrollToTop.onScroll}
                scrollEventThrottle={16}
            />
            {scrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
        </View>
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
    const contactMutation = useContactGroupAdminsMutation(group.id);

    const handleContactAdmins = async (): Promise<void> => {
        const body = contactBody.trim();
        if (!body) return;
        try {
            await contactMutation.mutateAsync({ body });
            setContactBody('');
            appAlert.alert('Sent', 'Your message was sent to the group admins.');
        } catch (e: unknown) {
            appAlert.alert('Could not send message', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    return (
        <AppKeyboardAwareScrollView
            contentContainerStyle={styles.aboutContent}
        >
            <GroupSummaryHeader group={group} />
            <View style={styles.aboutSections}>
                <Text style={styles.aboutLabel}>Rules</Text>
                <Text style={styles.aboutBody}>{group.rules || 'No rules have been added yet.'}</Text>
                <Text style={styles.aboutLabel}>Tags</Text>
                <Text style={styles.aboutBody}>{group.tags.length ? group.tags.join(', ') : 'No tags'}</Text>
                <Text style={styles.aboutLabel}>Recovery pathways</Text>
                <Text style={styles.aboutBody}>{group.recovery_pathways.length ? group.recovery_pathways.join(', ') : 'No pathway filters'}</Text>

                <Text style={styles.aboutLabel}>Group admins</Text>
                <View style={styles.adminPreviewList}>
                    {group.owner ? (
                        <AdminPreviewRow admin={group.owner} label="Owner" />
                    ) : (
                        <Text style={styles.aboutBody}>Owner unavailable</Text>
                    )}
                    {(group.admins ?? []).map((admin) => (
                        <AdminPreviewRow key={admin.user_id} admin={admin} label={admin.role === 'moderator' ? 'Moderator' : 'Admin'} />
                    ))}
                    {!group.owner && (group.admins ?? []).length === 0 ? (
                        <Text style={styles.aboutBody}>No admins visible.</Text>
                    ) : null}
                </View>

                {group.can_manage_members || group.can_moderate_content ? (
                    <View style={styles.aboutPanel}>
                        <Text style={styles.panelTitle}>Admin tools</Text>
                        <TouchableOpacity style={styles.panelButton} onPress={onOpenAdmin}>
                            <Ionicons name="shield-checkmark-outline" size={IconSizes.inline} color={Colors.textOn.primary} />
                            <Text style={styles.panelButtonText}>Open admin center</Text>
                        </TouchableOpacity>
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
                    <Text style={styles.aboutBody}>Reports go to the moderation team for review. Moderator-submitted reports escalate to owner/admin review.</Text>
                    <TouchableOpacity style={styles.reportButton} onPress={onOpenReport}>
                        <Text style={styles.reportButtonText}>Report</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </AppKeyboardAwareScrollView>
    );
}

function AdminPreviewRow({
    admin,
    label,
}: {
    admin: api.GroupAdminPreview;
    label: string;
}): React.ReactElement {
    return (
        <View style={styles.adminPreviewRow}>
            <Avatar username={admin.username} avatarUrl={admin.avatar_url ?? undefined} size={AvatarSizes.mini} fontSize={TextStyles.caption.fontSize} />
            <Text style={styles.memberName}>{admin.username}</Text>
            <Text style={styles.roleLabel}>{label}</Text>
        </View>
    );
}

function removeSupportRequestFromGroupPostCache(
    queryClient: QueryClient,
    groupId: string,
    requestId: string,
): void {
    queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.GroupPost>>>(
        { queryKey: ['groups', 'posts', groupId] },
        (current) => {
            if (!current) return current;
            return {
                ...current,
                pages: current.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).filter((post) => (
                        post.support_request?.id !== requestId
                        && post.support_request_id !== requestId
                    )),
                })),
            };
        },
    );
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
        ...TextStyles.sectionTitle,
        fontSize: Typography.sizes.xl,
    },
    description: {
        ...TextStyles.postBody,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    metaText: {
        ...TextStyles.caption,
    },
    metaDot: {
        color: Colors.text.muted,
    },
    innerTabs: {
        marginHorizontal: Spacing.md,
        marginTop: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    listContent: {
        paddingBottom: Spacing.md,
    },
    postsSurface: {
        flex: 1,
    },
    listSurface: {
        flex: 1,
    },
    postListContent: {
        paddingTop: 0,
    },
    composerButtonDisabled: {
        opacity: 0.5,
    },
    mediaGrid: {
        paddingBottom: Spacing.md,
    },
    mediaItem: {
        width: '100%',
        aspectRatio: 1.2,
        backgroundColor: Colors.bg.surface,
    },
    mediaSeparator: {
        height: 1,
        backgroundColor: Colors.border.emphasis,
    },
    memberRow: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
        paddingHorizontal: Spacing.md,
    },
    memberName: {
        flex: 1,
        ...TextStyles.bodyEmphasis,
    },
    roleLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.muted,
        textTransform: 'capitalize',
    },
    aboutContent: {
        paddingBottom: Spacing.md,
    },
    aboutSections: {
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
    },
    aboutLabel: {
        marginTop: Spacing.sm,
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    aboutBody: {
        ...TextStyles.postBody,
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
    adminPreviewList: {
        gap: Spacing.xs,
    },
    adminPreviewRow: {
        minHeight: 42,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    panelTitle: {
        fontSize: Typography.sizes.base,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    panelInput: {
        minHeight: ControlSizes.inputMinHeight,
    },
    panelButton: {
        alignSelf: 'flex-start',
        minHeight: ControlSizes.iconButton,
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
    panelSecondaryButton: {
        alignSelf: 'flex-start',
        minHeight: ControlSizes.iconButton,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
    },
    panelSecondaryButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.primary,
    },
    inviteCard: {
        borderWidth: 1,
        borderColor: Colors.border.emphasis,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.raised,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    inviteTitle: {
        ...TextStyles.bodyEmphasis,
        fontWeight: '800',
    },
    inviteBody: {
        ...TextStyles.secondary,
    },
    inviteLink: {
        ...TextStyles.caption,
        color: Colors.info,
    },
    inviteActionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    chatSharePanel: {
        borderTopWidth: 1,
        borderTopColor: Colors.border.emphasis,
        paddingTop: Spacing.sm,
        gap: Spacing.xs,
    },
    chatSharePanelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    chatSharePanelTitle: {
        ...TextStyles.label,
        fontWeight: '800',
    },
    chatShareSearch: {
        minHeight: ControlSizes.inputMinHeight,
    },
    chatShareRow: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.sm,
    },
    chatShareRowPending: {
        opacity: 0.6,
    },
    chatShareName: {
        flex: 1,
        ...TextStyles.bodyEmphasis,
    },
    chatShareActionLabel: {
        ...TextStyles.badge,
        color: Colors.primary,
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
        width: ControlSizes.iconButton,
        height: ControlSizes.iconButton,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.page,
    },
    reportButton: {
        alignSelf: 'flex-start',
        minHeight: ControlSizes.iconButton,
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
