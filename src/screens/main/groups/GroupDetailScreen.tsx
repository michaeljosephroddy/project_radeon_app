import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Share,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { InfiniteData, QueryClient, useQueryClient } from '@tanstack/react-query';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
import { CreatePostFab } from '../../../components/posts/CreatePostFab';
import { PostCard } from '../../../components/posts/PostCard';
import { groupPostToPostDisplayModel } from '../../../components/posts/postMappers';
import { SupportRequestCard } from '../../../components/support/SupportRequestCard';
import { getSupportOfferType, getSupportTypeLabel } from '../../../components/support/supportRequestPresentation';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { ScrollToTopButton } from '../../../components/ui/ScrollToTopButton';
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
import { useMySupportRequests } from '../../../hooks/queries/useSupport';
import { useAuth } from '../../../hooks/useAuth';
import { useFloatingActionVisibility } from '../../../hooks/useFloatingActionVisibility';
import { useGradualKeyboardInset } from '../../../hooks/useGradualKeyboardInset';
import { useScrollToTopButton } from '../../../hooks/useScrollToTopButton';
import { screenStandards } from '../../../styles/screenStandards';
import { Colors, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../../theme';
import { GroupAdminScreen } from './GroupAdminScreen';
import { GroupReportScreen } from './GroupReportScreen';
import { formatReadableTimestamp } from '../../../utils/date';
import { formatUsername } from '../../../utils/identity';

const COMMUNITY_SUPPORT_KEY = 'community_support';

interface GroupDetailScreenProps {
    groupId: string;
    onBack: () => void;
    onOpenComments: (post: api.GroupPost) => void;
    onOpenCreatePost: (group: api.Group) => void;
    onOpenCreateSupportRequest: () => void;
    onOpenChat: (chat: api.Chat) => void;
    initialAdminTab?: 'requests' | 'inbox' | 'reports';
    initialAdminThreadId?: string;
    focusPostRequest: { postId: string; nonce: number } | null;
    onFocusPostConsumed: (nonce: number) => void;
    focusSupportRequest: { requestId: string; nonce: number; postId?: string } | null;
    onFocusSupportRequestConsumed: (nonce: number) => void;
}

type GroupDetailTab = 'posts' | 'media' | 'members' | 'about';
type GroupDetailSurface = 'detail' | 'admin' | 'report';
type GroupSupportSurface = 'feed' | 'mine';

interface SupportManagementTarget {
    request: api.SupportRequest;
    post?: api.GroupPost;
}

export function GroupDetailScreen({
    groupId,
    onBack,
    onOpenComments,
    onOpenCreatePost,
    onOpenCreateSupportRequest,
    onOpenChat,
    initialAdminTab,
    initialAdminThreadId,
    focusPostRequest,
    onFocusPostConsumed,
    focusSupportRequest,
    onFocusSupportRequestConsumed,
}: GroupDetailScreenProps): React.ReactElement {
    const [activeTab, setActiveTab] = useState<GroupDetailTab>('posts');
    const [surface, setSurface] = useState<GroupDetailSurface>('detail');
    const [adminStartTab, setAdminStartTab] = useState<'requests' | 'inbox' | 'reports' | undefined>(initialAdminTab);
    const [adminStartThreadId, setAdminStartThreadId] = useState<string | undefined>(initialAdminThreadId);
    const [managedSupportTarget, setManagedSupportTarget] = useState<SupportManagementTarget | null>(null);
    const queryClient = useQueryClient();
    const groupQuery = useGroup(groupId, true);
    const group = groupQuery.data;

    useEffect(() => {
        if (!initialAdminTab) return;
        setAdminStartTab(initialAdminTab);
        setAdminStartThreadId(initialAdminThreadId);
        setSurface('admin');
    }, [initialAdminTab, initialAdminThreadId]);

    if (group && surface === 'admin') {
        return (
            <GroupAdminScreen
                group={group}
                onBack={() => {
                    setSurface('detail');
                    setAdminStartThreadId(undefined);
                }}
                initialTab={adminStartTab}
                initialThreadId={adminStartThreadId}
            />
        );
    }

    if (group && managedSupportTarget) {
        return (
            <SupportRequestManagementScreen
                request={managedSupportTarget.request}
                post={managedSupportTarget.post}
                onBack={() => setManagedSupportTarget(null)}
                onOpenComments={onOpenComments}
                onOpenChat={onOpenChat}
                onChanged={() => {
                    setManagedSupportTarget(null);
                    void Promise.all([
                        queryClient.invalidateQueries({ queryKey: ['groups', 'posts', group.id] }),
                        queryClient.invalidateQueries({ queryKey: ['groups', 'detail', group.id] }),
                        queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
                        queryClient.invalidateQueries({ queryKey: ['support-offers'] }),
                        queryClient.invalidateQueries({ queryKey: ['chats'] }),
                    ]);
                }}
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
                    <View style={screenStandards.fixedTabsWrap}>
                        <SegmentedControl
                            items={[
                                { key: 'posts', label: 'Posts' },
                                { key: 'media', label: 'Media' },
                                { key: 'members', label: 'Members' },
                                { key: 'about', label: 'About' },
                            ]}
                            activeKey={activeTab}
                            onChange={(key) => setActiveTab(key as GroupDetailTab)}
                            style={screenStandards.fixedTabsControl}
                        />
                    </View>
                    {activeTab === 'posts' ? (
                        <GroupPostsTab
                            group={group}
                            onOpenComments={onOpenComments}
                            onOpenCreatePost={onOpenCreatePost}
                            onOpenCreateSupportRequest={onOpenCreateSupportRequest}
                            onOpenChat={onOpenChat}
                            onManageSupportRequest={(request, post) => setManagedSupportTarget({ request, post })}
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
                            onOpenAdmin={() => setSurface('admin')}
                            onOpenReport={() => setSurface('report')}
                        />
                    )}
                    {surface === 'report' ? (
                        <View style={styles.reportOverlay}>
                            <GroupReportScreen
                                group={group}
                                onBack={() => setSurface('detail')}
                                onReported={() => setSurface('detail')}
                            />
                        </View>
                    ) : null}
                </>
            ) : (
                <EmptyState title="Group not found" />
            )}
        </SafeAreaView>
    );
}

function SupportRequestManagementScreen({
    request,
    post,
    onBack,
    onOpenComments,
    onOpenChat,
    onChanged,
}: {
    request: api.SupportRequest;
    post?: api.GroupPost;
    onBack: () => void;
    onOpenComments: (post: api.GroupPost) => void;
    onOpenChat: (chat: api.Chat) => void;
    onChanged: () => void;
}): React.ReactElement {
    const [offers, setOffers] = useState<api.SupportOffer[]>([]);
    const [replies, setReplies] = useState<api.SupportReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingId, setPendingId] = useState<string | null>(null);

    useEffect(() => {
        if (!request) return undefined;
        let cancelled = false;
        setLoading(true);
        void Promise.all([
            api.getSupportOffers(request.id, 1, 30),
            api.getSupportReplies(request.id, undefined, 40),
        ])
            .then(([offersPage, repliesPage]) => {
                if (cancelled) return;
                setOffers(offersPage.items ?? []);
                setReplies(repliesPage.items ?? []);
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    Alert.alert('Could not load request details', e instanceof Error ? e.message : 'Something went wrong.');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [request]);

    const handleAcceptOffer = useCallback(async (offer: api.SupportOffer): Promise<void> => {
        if (!request) return;
        setPendingId(offer.id);
        try {
            const accepted = await api.acceptSupportOffer(request.id, offer.id);
            onChanged();
            if (accepted.chat_id) {
                const chat = await api.getChat(accepted.chat_id);
                onOpenChat(chat);
            }
        } catch (e: unknown) {
            Alert.alert('Could not accept offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingId(null);
        }
    }, [onChanged, onOpenChat, request]);

    const handleDeclineOffer = useCallback(async (offer: api.SupportOffer): Promise<void> => {
        if (!request) return;
        setPendingId(offer.id);
        try {
            await api.declineSupportOffer(request.id, offer.id);
            setOffers((current) => current.map((item) => item.id === offer.id ? { ...item, status: 'not_selected' } : item));
        } catch (e: unknown) {
            Alert.alert('Could not decline offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingId(null);
        }
    }, [request]);

    const handleCloseRequest = useCallback((): void => {
        if (!request) return;
        Alert.alert(
            'Close request?',
            'This marks the support request as closed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close',
                    style: 'destructive',
                    onPress: () => {
                        setPendingId(request.id);
                        void api.updateSupportRequest(request.id, { status: 'closed' })
                            .then(onChanged)
                            .catch((e: unknown) => {
                                Alert.alert('Could not close request', e instanceof Error ? e.message : 'Something went wrong.');
                            })
                            .finally(() => setPendingId(null));
                    },
                },
            ],
        );
    }, [onChanged, request]);

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title="Support request" onBack={onBack} />
            <ScrollView contentContainerStyle={styles.manageContent}>
                <SupportRequestCard
                    request={request}
                    pending={pendingId === request.id}
                    onOpenComments={() => {
                        if (post) {
                            onOpenComments(post);
                        } else {
                            Alert.alert('Replies unavailable', 'Open this request from the group feed to view public replies.');
                        }
                    }}
                    onClose={handleCloseRequest}
                />

                <View style={styles.manageSection}>
                    <Text style={styles.manageTitle}>Replies</Text>
                    {loading ? (
                        <ActivityIndicator color={Colors.primary} />
                    ) : replies.length === 0 ? (
                        <Text style={styles.aboutBody}>No replies yet.</Text>
                    ) : (
                        replies.map((reply) => (
                            <View key={reply.id} style={styles.replyRow}>
                                <Avatar username={reply.username} avatarUrl={reply.avatar_url ?? undefined} size={30} />
                                <View style={styles.replyBody}>
                                    <Text style={styles.replyAuthor}>{reply.username}</Text>
                                    <Text style={styles.aboutBody}>{reply.body}</Text>
                                    <Text style={styles.metaText}>{formatReadableTimestamp(reply.created_at)}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                <View style={styles.manageSection}>
                    <Text style={styles.manageTitle}>Offers</Text>
                    {loading ? (
                        <ActivityIndicator color={Colors.primary} />
                    ) : offers.length === 0 ? (
                        <Text style={styles.aboutBody}>No private offers yet.</Text>
                    ) : offers.map((offer) => (
                        <View key={offer.id} style={styles.offerRow}>
                            <Avatar username={offer.username} avatarUrl={offer.avatar_url ?? undefined} size={34} />
                            <View style={styles.offerBody}>
                                <Text style={styles.offerName}>{offer.username}</Text>
                                <Text style={styles.metaText}>{getSupportTypeLabel(offer.offer_type)} · {offer.status.replace('_', ' ')}</Text>
                                {offer.message ? <Text style={styles.aboutBody}>{offer.message}</Text> : null}
                            </View>
                            {offer.status === 'pending' && request.status === 'open' ? (
                                <View style={styles.offerActions}>
                                    <TouchableOpacity
                                        style={[styles.offerPrimaryButton, pendingId === offer.id && styles.composerButtonDisabled]}
                                        onPress={() => { void handleAcceptOffer(offer); }}
                                        disabled={pendingId === offer.id}
                                    >
                                        <Text style={styles.offerPrimaryButtonText}>Accept</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.offerSecondaryButton, pendingId === offer.id && styles.composerButtonDisabled]}
                                        onPress={() => { void handleDeclineOffer(offer); }}
                                        disabled={pendingId === offer.id}
                                    >
                                        <Text style={styles.offerSecondaryButtonText}>Decline</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                        </View>
                    ))}
                </View>
            </ScrollView>
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
                <Text style={styles.metaText}>{visibilityLabel(group.visibility)}</Text>
            </View>
        </View>
    );
}

function GroupPostsTab({
    group,
    onOpenComments,
    onOpenCreatePost,
    onOpenCreateSupportRequest,
    onOpenChat,
    onManageSupportRequest,
    focusPostRequest,
    onFocusPostConsumed,
    focusSupportRequest,
    onFocusSupportRequestConsumed,
}: {
    group: api.Group;
    onOpenComments: (post: api.GroupPost) => void;
    onOpenCreatePost: (group: api.Group) => void;
    onOpenCreateSupportRequest: () => void;
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
    const createFab = useFloatingActionVisibility({ enabled: group.can_post, idleDelayMs: 150 });
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isCommunitySupport = group.system_key === COMMUNITY_SUPPORT_KEY;
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
            Alert.alert(
                'Could not update post',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        }
    }, [pinPostMutation]);

    const handleDeletePost = useCallback((post: api.GroupPost): void => {
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
    }, [deletePostMutation]);

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
                    Alert.alert('Could not open chat', e instanceof Error ? e.message : 'Something went wrong.');
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
            Alert.alert('Already chatting', `You already have an open chat with ${formatUsername(request.username)}.`);
            return;
        }

        const offerType = getSupportOfferType(request);
        setSupportPending(request.id, true);
        try {
            await api.createSupportOffer(request.id, {
                offer_type: offerType,
                message: `I can help with ${getSupportTypeLabel(offerType).toLowerCase()} support.`,
            });
            Alert.alert('Offer sent', 'The requester can accept it if they want direct support.');
            invalidateSupportGroup();
        } catch (e: unknown) {
            Alert.alert('Could not send offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSupportPending(request.id, false);
        }
    }, [findSupportPost, handleOpenSupportComments, invalidateSupportGroup, onManageSupportRequest, onOpenChat, setSupportPending]);

    const handleCloseSupportRequest = useCallback((request: api.SupportRequest): void => {
        Alert.alert(
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
                                Alert.alert('Could not close request', e instanceof Error ? e.message : 'Something went wrong.');
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
                actions={group.can_moderate_content ? [
                    { label: item.pinned_at ? 'Unpin' : 'Pin', onPress: () => { void handlePinPost(item); } },
                    { label: 'Remove', destructive: true, onPress: () => handleDeletePost(item) },
                ] : undefined}
            />
        );
    }, [
        group.can_moderate_content,
        handleCloseSupportRequest,
        handleDeletePost,
        handlePinPost,
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
                    style={styles.innerTabs}
                />
            ) : null}
        </>
    ), [group, isCommunitySupport, supportSurface]);

    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
        scrollToTop.onScroll(event);
        createFab.onScroll(event);
    }, [createFab, scrollToTop]);

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

                <CreatePostFab
                    visible={group.can_post && createFab.isVisible}
                    bottom={20}
                    label="Support"
                    onPress={onOpenCreateSupportRequest}
                />
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

            <CreatePostFab
                visible={group.can_post && createFab.isVisible}
                bottom={20}
                label={isCommunitySupport ? 'Support' : undefined}
                onPress={() => isCommunitySupport ? onOpenCreateSupportRequest() : onOpenCreatePost(group)}
            />
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
                        <Avatar username={item.username} avatarUrl={item.avatar_url ?? undefined} size={38} fontSize={13} />
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
    const [invite, setInvite] = useState<api.GroupInvite | null>(null);
    const [chatShareOpen, setChatShareOpen] = useState(false);
    const [chatShareLoading, setChatShareLoading] = useState(false);
    const [chatShareSendingId, setChatShareSendingId] = useState<string | null>(null);
    const [chatShareQuery, setChatShareQuery] = useState('');
    const [shareChats, setShareChats] = useState<api.Chat[]>([]);
    const contactMutation = useContactGroupAdminsMutation(group.id);
    const inviteMutation = useCreateGroupInviteMutation(group.id);
    const joinRequestsQuery = useGroupJoinRequests(group.id, group.can_manage_members);
    const reviewMutation = useReviewGroupJoinRequestMutation(group.id);
    const insets = useSafeAreaInsets();
    const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
    const { height: keyboardInsetHeight } = useGradualKeyboardInset({
        closedHeight: bottomSafeSpace,
        openedOffset: Spacing.sm,
    });
    const keyboardSpacerStyle = useAnimatedStyle((): { height: number } => ({
        height: keyboardInsetHeight.value,
    }));
    const filteredShareChats = useMemo(() => {
        const query = chatShareQuery.trim().toLowerCase();
        const openChats = shareChats.filter((chat) => isChatOpenForMessaging(chat));
        if (!query) return openChats;
        return openChats.filter((chat) => {
            const name = chat.is_group ? (chat.name ?? '') : (chat.username ?? '');
            return name.toLowerCase().includes(query);
        });
    }, [chatShareQuery, shareChats]);

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
            setInvite(invite);
        } catch (e: unknown) {
            Alert.alert('Could not create invite', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    const handleShareInvite = async (): Promise<void> => {
        if (!invite?.token) return;
        try {
            await Share.share({
                message: formatGroupInviteMessage(group, invite),
            });
        } catch (e: unknown) {
            Alert.alert('Could not share invite', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    const loadChatShareTargets = useCallback(async (): Promise<void> => {
        setChatShareLoading(true);
        try {
            const page = await api.getChats({ limit: 25 });
            setShareChats(page.items ?? []);
        } catch (e: unknown) {
            Alert.alert('Could not load chats', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setChatShareLoading(false);
        }
    }, []);

    const handleOpenChatShare = useCallback((): void => {
        if (!invite?.token) {
            Alert.alert('Create invite first', 'Create an invite link before sending it to chat.');
            return;
        }
        setChatShareOpen((current) => !current);
        void loadChatShareTargets();
    }, [invite?.token, loadChatShareTargets]);

    const handleSendInviteToChat = useCallback(async (chat: api.Chat): Promise<void> => {
        if (!invite?.token) return;
        if (!isChatOpenForMessaging(chat)) {
            Alert.alert('Chat unavailable', 'This chat is not open for messaging yet.');
            setShareChats((current) => current.filter((item) => item.id !== chat.id));
            return;
        }
        setChatShareSendingId(chat.id);
        try {
            await api.sendMessage(chat.id, formatGroupInviteMessage(group, invite));
            const name = chat.is_group ? (chat.name ?? 'Group') : formatUsername(chat.username);
            Alert.alert('Invite sent', `Sent to ${name}.`);
            setChatShareOpen(false);
        } catch (e: unknown) {
            if (e instanceof Error && e.message.toLowerCase().includes('chat is not open for messaging')) {
                setShareChats((current) => current.filter((item) => item.id !== chat.id));
            }
            Alert.alert('Could not send invite', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setChatShareSendingId(null);
        }
    }, [group, invite]);

    return (
        <ScrollView
            contentContainerStyle={styles.aboutContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={false}
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
                        {invite?.token ? (
                            <View style={styles.inviteCard}>
                                <Text style={styles.inviteTitle}>{group.name} invite</Text>
                                <Text style={styles.inviteBody}>
                                    {group.visibility === 'approval_required' || invite.requires_approval
                                        ? 'Recipients can request to join from this invite.'
                                        : 'Recipients can join from this invite.'}
                                </Text>
                                <Text style={styles.inviteLink} selectable>{formatGroupInviteShareUrl(invite.token)}</Text>
                                <View style={styles.inviteActionRow}>
                                    <TouchableOpacity style={styles.panelButton} onPress={handleOpenChatShare}>
                                        <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.textOn.primary} />
                                        <Text style={styles.panelButtonText}>Send in chat</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.panelSecondaryButton} onPress={handleShareInvite}>
                                        <Ionicons name="share-outline" size={16} color={Colors.primary} />
                                        <Text style={styles.panelSecondaryButtonText}>Share outside</Text>
                                    </TouchableOpacity>
                                </View>
                                {chatShareOpen ? (
                                    <View style={styles.chatSharePanel}>
                                        <View style={styles.chatSharePanelHeader}>
                                            <Text style={styles.chatSharePanelTitle}>Chats</Text>
                                            <TouchableOpacity style={styles.iconAction} onPress={() => { void loadChatShareTargets(); }}>
                                                <Ionicons name="refresh" size={16} color={Colors.primary} />
                                            </TouchableOpacity>
                                        </View>
                                        <TextField
                                            value={chatShareQuery}
                                            onChangeText={setChatShareQuery}
                                            placeholder="Search chats"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            style={styles.chatShareSearch}
                                        />
                                        {chatShareLoading ? (
                                            <ActivityIndicator color={Colors.primary} />
                                        ) : filteredShareChats.length === 0 ? (
                                            <Text style={styles.aboutBody}>No chats open for messaging.</Text>
                                        ) : filteredShareChats.map((chat) => (
                                            <TouchableOpacity
                                                key={chat.id}
                                                style={[styles.chatShareRow, chatShareSendingId === chat.id && styles.chatShareRowPending]}
                                                onPress={() => { void handleSendInviteToChat(chat); }}
                                                disabled={chatShareSendingId === chat.id}
                                            >
                                                <Avatar
                                                    username={chat.is_group ? (chat.name ?? 'group') : (chat.username ?? 'member')}
                                                    avatarUrl={chat.is_group ? undefined : chat.avatar_url}
                                                    size={32}
                                                    fontSize={11}
                                                />
                                                <Text style={styles.chatShareName} numberOfLines={1}>
                                                    {chat.is_group ? (chat.name ?? 'Group') : formatUsername(chat.username)}
                                                </Text>
                                                <Text style={styles.chatShareActionLabel}>
                                                    {chatShareSendingId === chat.id ? 'Sending…' : 'Send'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : null}
                            </View>
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
                    <Text style={styles.aboutBody}>Reports go to the moderation team for review. Moderator-submitted reports escalate to owner/admin review.</Text>
                    <TouchableOpacity style={styles.reportButton} onPress={onOpenReport}>
                        <Text style={styles.reportButtonText}>Report</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <Animated.View style={[styles.keyboardSpacer, keyboardSpacerStyle]} />
        </ScrollView>
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
            <Avatar username={admin.username} avatarUrl={admin.avatar_url ?? undefined} size={32} fontSize={11} />
            <Text style={styles.memberName}>{admin.username}</Text>
            <Text style={styles.roleLabel}>{label}</Text>
        </View>
    );
}

function isChatOpenForMessaging(chat: api.Chat): boolean {
    if (chat.status && chat.status !== 'active') return false;
    const supportStatus = chat.support_context?.status;
    if (!supportStatus) return true;
    return supportStatus === 'accepted';
}

function visibilityLabel(visibility: api.GroupVisibility): string {
    if (visibility === 'approval_required') return 'Approval required';
    if (visibility === 'invite_only') return 'Invite only';
    if (visibility === 'private_hidden') return 'Private';
    return 'Public';
}

function formatGroupInviteDeepLink(token: string): string {
    return `soberspace://group-invites/${encodeURIComponent(token)}`;
}

function formatGroupInviteShareUrl(token: string): string {
    return `https://soberspace.app/group-invites/${encodeURIComponent(token)}`;
}

function formatGroupInviteMessage(group: api.Group, invite: api.GroupInvite): string {
    const approval = group.visibility === 'approval_required' || invite.requires_approval
        ? 'This group requires admin approval.'
        : 'You can accept this invite to join.';
    return [
        `Group invite: ${group.name}`,
        approval,
        invite.token ? `Open in app: ${formatGroupInviteDeepLink(invite.token)}` : '',
        invite.token ? `Web preview: ${formatGroupInviteShareUrl(invite.token)}` : '',
    ].filter(Boolean).join('\n');
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
    reportOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.bg.page,
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
        backgroundColor: Colors.border.subtle,
    },
    memberRow: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
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
    keyboardSpacer: {
        flexShrink: 0,
        backgroundColor: Colors.bg.page,
    },
    manageContent: {
        paddingBottom: Spacing.xl,
    },
    manageSection: {
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    replyRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.sm,
    },
    replyBody: {
        flex: 1,
        gap: 2,
    },
    replyAuthor: {
        ...TextStyles.bodyEmphasis,
        fontSize: TextStyles.bodyEmphasis.fontSize,
    },
    manageTitle: {
        ...TextStyles.sectionTitle,
        fontWeight: '800',
    },
    offerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
    },
    offerBody: {
        flex: 1,
        minWidth: 0,
        gap: Spacing.xs,
    },
    offerName: {
        ...TextStyles.bodyEmphasis,
    },
    offerActions: {
        gap: Spacing.xs,
    },
    offerPrimaryButton: {
        minHeight: ControlSizes.chipMinHeight,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.sm,
    },
    offerPrimaryButtonText: {
        ...TextStyles.badge,
        color: Colors.textOn.primary,
    },
    offerSecondaryButton: {
        minHeight: ControlSizes.chipMinHeight,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.sm,
    },
    offerSecondaryButtonText: {
        ...TextStyles.badge,
        color: Colors.text.secondary,
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
        borderTopColor: Colors.border.default,
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
