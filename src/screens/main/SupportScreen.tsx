import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { CreatePostFab } from '../../components/posts/CreatePostFab';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { useMySupportRequests, useSupportRequests } from '../../hooks/queries/useSupport';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { screenStandards } from '../../styles/screenStandards';
import { Colors, ContentInsets, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { formatUsername } from '../../utils/identity';
import { dedupeById } from '../../utils/list';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { MeetingsView } from './support/MeetingsView';

type SupportSurface = 'feed' | 'my_requests' | 'meetings';
type MyRequestScope = 'open' | 'active' | 'closed';

interface SupportScreenProps {
    isActive: boolean;
    onOpenChat: (chat: api.Chat) => void;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onOpenCreateSupportRequest: () => void;
}

interface DetailState {
    request: api.SupportRequest;
    replies: api.SupportReply[];
    offers: api.SupportOffer[];
    repliesCursor?: string | null;
    repliesHasMore: boolean;
    offersPage: number;
    offersHasMore: boolean;
    loading: boolean;
}

interface SupportRequestCardProps {
    request: api.SupportRequest;
    pending: boolean;
    onOpen: (request: api.SupportRequest) => void;
    onPrimaryAction: (request: api.SupportRequest) => void;
    onClose: (request: api.SupportRequest) => void;
    onOpenChat: (request: api.SupportRequest) => void;
    onPressUser: (request: api.SupportRequest) => void;
}

const SUPPORT_TYPE_LABELS: Record<api.SupportType, string> = {
    chat: 'Chat',
    call: 'Call',
    meetup: 'Meetup',
    general: 'General',
};

const URGENCY_LABELS: Record<api.SupportUrgency, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

const TOPIC_LABELS: Record<api.SupportTopic, string> = {
    anxiety: 'Anxiety',
    relapse_risk: 'Relapse risk',
    loneliness: 'Loneliness',
    cravings: 'Cravings',
    depression: 'Depression',
    family: 'Family',
    work: 'Work',
    sleep: 'Sleep',
    celebration: 'Celebration',
    general: 'General',
};

const OFFERABLE_SUPPORT_TYPES: Array<Exclude<api.SupportType, 'general'>> = ['chat', 'call', 'meetup'];

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

function getOfferType(request: api.SupportRequest): Exclude<api.SupportType, 'general'> {
    return request.support_type === 'general' ? 'chat' : request.support_type;
}

function getPrimaryActionLabel(request: api.SupportRequest): string {
    if (request.is_own_request) return request.status === 'active' ? 'Open chat' : 'Manage';
    if (request.status !== 'open') return 'View';
    if (request.support_type === 'general') return 'Reply';
    return `Offer ${SUPPORT_TYPE_LABELS[getOfferType(request)].toLowerCase()}`;
}

function getRequestLocationLabel(request: api.SupportRequest): string | null {
    const location = request.location;
    if (location?.visibility && location.visibility !== 'hidden') {
        return [location.city, location.region].filter(Boolean).join(', ') || null;
    }
    return request.city ?? null;
}

function SupportRequestCard({
    request,
    pending,
    onOpen,
    onPrimaryAction,
    onClose,
    onOpenChat,
    onPressUser,
}: SupportRequestCardProps) {
    const locationLabel = getRequestLocationLabel(request);
    const offerCount = request.offer_count;
    const canClose = request.is_own_request && request.status !== 'closed';
    const canOpenChat = request.is_own_request && request.status === 'active' && Boolean(request.chat_id);

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <TouchableOpacity
                    onPress={() => onPressUser(request)}
                    disabled={request.is_own_request}
                >
                    <Avatar username={request.username} avatarUrl={request.avatar_url ?? undefined} size={44} />
                </TouchableOpacity>
                <View style={styles.cardHeadBody}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.cardName}>{formatUsername(request.username)}</Text>
                        <View style={styles.badgeRow}>
                            <View style={[styles.badge, request.urgency === 'high' && styles.badgeUrgent]}>
                                <Text style={[styles.badgeText, request.urgency === 'high' && styles.badgeUrgentText]}>
                                    {URGENCY_LABELS[request.urgency]}
                                </Text>
                            </View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{SUPPORT_TYPE_LABELS[request.support_type]}</Text>
                            </View>
                            {request.is_priority ? (
                                <View style={styles.priorityBadge}>
                                    <Text style={styles.priorityBadgeText}>Priority</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                    <Text style={styles.cardMeta}>
                        {timeAgo(request.created_at)}
                        {locationLabel ? ` · ${locationLabel}` : ''}
                    </Text>
                </View>
            </View>

            {request.topics.length > 0 ? (
                <View style={styles.topicRow}>
                    {request.topics.slice(0, 4).map((topic) => (
                        <View key={topic} style={styles.topicChip}>
                            <Text style={styles.topicChipText}>{TOPIC_LABELS[topic]}</Text>
                        </View>
                    ))}
                </View>
            ) : null}

            {request.message ? (
                <Text style={styles.cardBody} numberOfLines={4}>{request.message}</Text>
            ) : null}

            <Text style={styles.cardFooterText}>
                {request.reply_count} repl{request.reply_count === 1 ? 'y' : 'ies'} · {offerCount} offer{offerCount === 1 ? '' : 's'}
                {request.has_replied ? ' · You replied' : ''}
                {request.has_offered ? ' · You offered' : ''}
            </Text>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.actionPrimary, pending && styles.actionDisabled]}
                    onPress={() => canOpenChat ? onOpenChat(request) : onPrimaryAction(request)}
                    disabled={pending}
                >
                    <Text style={styles.actionPrimaryText}>{pending ? 'Working...' : getPrimaryActionLabel(request)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionSecondary} onPress={() => onOpen(request)}>
                    <Text style={styles.actionSecondaryText}>View</Text>
                </TouchableOpacity>
                {canClose ? (
                    <TouchableOpacity
                        style={[styles.actionSecondary, pending && styles.actionDisabled]}
                        onPress={() => onClose(request)}
                        disabled={pending}
                    >
                        <Text style={styles.actionSecondaryText}>Close</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

function SupportRequestSeparator() {
    return <View style={styles.requestSeparator} />;
}

export function SupportScreen({
    isActive,
    onOpenChat,
    onOpenUserProfile,
    onOpenCreateSupportRequest,
}: SupportScreenProps) {
    const queryClient = useQueryClient();
    const flatListRef = useRef<FlatList<api.SupportRequest> | null>(null);
    const hasActivated = useLazyActivation(isActive);
    const [surface, setSurface] = useState<SupportSurface>('feed');
    const [feedFilter, setFeedFilter] = useState<api.SupportRequestFilter>('all');
    const [myScope, setMyScope] = useState<MyRequestScope>('open');
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
    const [detail, setDetail] = useState<DetailState | null>(null);
    const [replyDraft, setReplyDraft] = useState('');
    const [showMyRequestsNotice, setShowMyRequestsNotice] = useState(true);
    const [showFeedNotice, setShowFeedNotice] = useState(true);

    const listProps = getListPerformanceProps('detailList');
    const feedQuery = useSupportRequests(feedFilter, 20, hasActivated);
    const myRequestsQuery = useMySupportRequests(20, hasActivated);
    useRefetchOnActiveIfStale(isActive && surface === 'feed', feedQuery);
    useRefetchOnActiveIfStale(isActive && surface === 'my_requests', myRequestsQuery);
    const scrollToTop = useScrollToTopButton({ threshold: 320 });

    const feedRequests = useMemo(
        () => dedupeById(feedQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [feedQuery.data],
    );
    const myRequests = useMemo(
        () => dedupeById(myRequestsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [myRequestsQuery.data],
    );
    const visibleMyRequests = useMemo(() => {
        const status = myScope === 'closed' ? 'closed' : myScope;
        return myRequests.filter((request) => request.status === status);
    }, [myRequests, myScope]);

    const invalidateSupport = useCallback(() => {
        void Promise.all([
            queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
            queryClient.invalidateQueries({ queryKey: ['support-offers'] }),
            queryClient.invalidateQueries({ queryKey: ['support-replies'] }),
            queryClient.invalidateQueries({ queryKey: ['chats'] }),
        ]);
    }, [queryClient]);

    const refreshFeed = useCallback(async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.supportRequests({ scope: 'open', filter: feedFilter, limit: 20 }));
        await feedQuery.refetch();
    }, [feedFilter, feedQuery, queryClient]);

    const refreshMine = useCallback(async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.supportRequests({ scope: 'mine', limit: 20 }));
        await myRequestsQuery.refetch();
    }, [myRequestsQuery, queryClient]);

    const loadDetail = useCallback(async (request: api.SupportRequest) => {
        setDetail({
            request,
            replies: [],
            offers: [],
            repliesCursor: undefined,
            repliesHasMore: false,
            offersPage: 1,
            offersHasMore: false,
            loading: true,
        });
        setReplyDraft('');
        try {
            const [repliesPage, offersPage] = await Promise.all([
                api.getSupportReplies(request.id, undefined, 30),
                request.is_own_request ? api.getSupportOffers(request.id, 1, 30) : Promise.resolve(null),
            ]);
            setDetail({
                request,
                replies: repliesPage.items ?? [],
                offers: offersPage?.items ?? [],
                repliesCursor: repliesPage.next_cursor,
                repliesHasMore: repliesPage.has_more,
                offersPage: 1,
                offersHasMore: offersPage?.has_more ?? false,
                loading: false,
            });
        } catch (e: unknown) {
            setDetail(null);
            Alert.alert('Could not load request', e instanceof Error ? e.message : 'Something went wrong.');
        }
    }, []);

    const handleLoadMore = useCallback(async () => {
        if (surface === 'feed') {
            if (feedQuery.isFetchingNextPage || feedQuery.isRefetching || !feedQuery.hasNextPage) return;
            await feedQuery.fetchNextPage();
        }
        if (surface === 'my_requests') {
            if (myRequestsQuery.isFetchingNextPage || myRequestsQuery.isRefetching || !myRequestsQuery.hasNextPage) return;
            await myRequestsQuery.fetchNextPage();
        }
    }, [feedQuery, myRequestsQuery, surface]);
    const pagination = useGuardedEndReached(handleLoadMore);

    const setPending = useCallback((id: string, value: boolean) => {
        setPendingIds((current) => {
            const next = new Set(current);
            if (value) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const handleReply = useCallback(async (request: api.SupportRequest, body: string) => {
        const trimmed = body.trim();
        if (!trimmed) return;
        setPending(request.id, true);
        try {
            const reply = await api.createSupportReply(request.id, { body: trimmed });
            setDetail((current) => current && current.request.id === request.id
                ? {
                    ...current,
                    replies: [...current.replies, reply],
                    request: {
                        ...current.request,
                        reply_count: current.request.reply_count + 1,
                        has_replied: true,
                    },
                }
                : current);
            setReplyDraft('');
            invalidateSupport();
        } catch (e: unknown) {
            Alert.alert('Could not reply', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPending(request.id, false);
        }
    }, [invalidateSupport, setPending]);

    const handleOffer = useCallback(async (request: api.SupportRequest) => {
        const offerType = getOfferType(request);
        setPending(request.id, true);
        try {
            await api.createSupportOffer(request.id, {
                offer_type: offerType,
                message: `I can help with ${SUPPORT_TYPE_LABELS[offerType].toLowerCase()} support.`,
            });
            Alert.alert('Offer sent', `${formatUsername(request.username)} can accept it if they want direct support.`);
            setDetail((current) => current && current.request.id === request.id
                ? {
                    ...current,
                    request: {
                        ...current.request,
                        offer_count: current.request.offer_count + 1,
                        has_offered: true,
                    },
                }
                : current);
            invalidateSupport();
        } catch (e: unknown) {
            Alert.alert('Could not send offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPending(request.id, false);
        }
    }, [invalidateSupport, setPending]);

    const handlePrimaryAction = useCallback((request: api.SupportRequest) => {
        if (request.is_own_request || request.support_type === 'general') {
            void loadDetail(request);
            return;
        }
        void handleOffer(request);
    }, [handleOffer, loadDetail]);

    const handleAcceptOffer = useCallback(async (offer: api.SupportOffer) => {
        if (!detail) return;
        setPending(offer.id, true);
        try {
            const accepted = await api.acceptSupportOffer(detail.request.id, offer.id);
            setDetail((current) => current ? { ...current, request: accepted } : current);
            invalidateSupport();
            if (accepted.chat_id) {
                const chat = await api.getChat(accepted.chat_id);
                onOpenChat(chat);
            }
        } catch (e: unknown) {
            Alert.alert('Could not accept offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPending(offer.id, false);
        }
    }, [detail, invalidateSupport, onOpenChat, setPending]);

    const handleDeclineOffer = useCallback(async (offer: api.SupportOffer) => {
        if (!detail) return;
        setPending(offer.id, true);
        try {
            await api.declineSupportOffer(detail.request.id, offer.id);
            setDetail((current) => current ? {
                ...current,
                offers: current.offers.map((item) => item.id === offer.id ? { ...item, status: 'not_selected' } : item),
            } : current);
            invalidateSupport();
        } catch (e: unknown) {
            Alert.alert('Could not decline offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPending(offer.id, false);
        }
    }, [detail, invalidateSupport, setPending]);

    const handleClose = useCallback(async (request: api.SupportRequest) => {
        setPending(request.id, true);
        try {
            const closed = await api.updateSupportRequest(request.id, { status: 'closed' });
            setDetail((current) => current && current.request.id === request.id ? { ...current, request: closed } : current);
            invalidateSupport();
        } catch (e: unknown) {
            Alert.alert('Could not close request', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPending(request.id, false);
        }
    }, [invalidateSupport, setPending]);

    const handleOpenChat = useCallback(async (request: api.SupportRequest) => {
        if (!request.chat_id) {
            Alert.alert('No chat yet', 'Accept an offer before opening a direct chat.');
            return;
        }
        setPending(request.id, true);
        try {
            const chat = await api.getChat(request.chat_id);
            onOpenChat(chat);
        } catch (e: unknown) {
            Alert.alert('Could not open chat', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPending(request.id, false);
        }
    }, [onOpenChat, setPending]);

    if (detail) {
        const request = detail.request;
        return (
            <View style={styles.container}>
                <ScrollView contentContainerStyle={[screenStandards.detailContent, screenStandards.scrollContent]}>
                    <SegmentedControl
                        activeKey="detail"
                        onChange={(key) => {
                            if (key === 'back') setDetail(null);
                        }}
                        tone="primary"
                        style={screenStandards.tabControl}
                        items={[
                            { key: 'back', label: 'Back' },
                            { key: 'detail', label: 'Request', flex: 2 },
                        ]}
                    />

                    <SupportRequestCard
                        request={request}
                        pending={pendingIds.has(request.id)}
                        onOpen={loadDetail}
                        onPrimaryAction={handlePrimaryAction}
                        onClose={handleClose}
                        onOpenChat={handleOpenChat}
                        onPressUser={(item) => onOpenUserProfile({
                            userId: item.requester_id,
                            username: item.username,
                            avatarUrl: item.avatar_url ?? undefined,
                        })}
                    />

                    {detail.loading ? (
                        <ActivityIndicator color={Colors.primary} />
                    ) : (
                        <>
                            {request.is_own_request ? (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Offers</Text>
                                    {detail.offers.length === 0 ? (
                                        <Text style={styles.mutedText}>No private offers yet.</Text>
                                    ) : detail.offers.map((offer) => (
                                        <View key={offer.id} style={styles.offerRow}>
                                            <Avatar username={offer.username} avatarUrl={offer.avatar_url ?? undefined} size={32} />
                                            <View style={styles.offerBody}>
                                                <Text style={styles.offerName}>{formatUsername(offer.username)}</Text>
                                                <Text style={styles.cardMeta}>
                                                    {SUPPORT_TYPE_LABELS[offer.offer_type]} · {timeAgo(offer.created_at)}
                                                </Text>
                                                {offer.message ? <Text style={styles.replyText}>{offer.message}</Text> : null}
                                            </View>
                                            {offer.status === 'pending' && request.status === 'open' ? (
                                                <View style={styles.offerActions}>
                                                    <TouchableOpacity
                                                        style={[styles.compactPrimary, pendingIds.has(offer.id) && styles.actionDisabled]}
                                                        onPress={() => void handleAcceptOffer(offer)}
                                                        disabled={pendingIds.has(offer.id)}
                                                    >
                                                        <Text style={styles.compactPrimaryText}>Accept</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.compactSecondary}
                                                        onPress={() => void handleDeclineOffer(offer)}
                                                    >
                                                        <Text style={styles.compactSecondaryText}>Pass</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <Text style={styles.offerStatus}>{offer.status === 'accepted' ? 'Accepted' : 'Passed'}</Text>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            ) : request.status === 'open' && request.support_type !== 'general' ? (
                                <PrimaryButton
                                    label={pendingIds.has(request.id) ? 'Sending...' : `Offer ${SUPPORT_TYPE_LABELS[getOfferType(request)].toLowerCase()}`}
                                    onPress={() => void handleOffer(request)}
                                    disabled={pendingIds.has(request.id) || request.has_offered}
                                    style={styles.detailButton}
                                />
                            ) : null}

                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Replies</Text>
                                {detail.replies.length === 0 ? (
                                    <Text style={styles.mutedText}>No public replies yet.</Text>
                                ) : detail.replies.map((reply) => (
                                    <View key={reply.id} style={styles.replyRow}>
                                        <Avatar username={reply.username} avatarUrl={reply.avatar_url ?? undefined} size={32} />
                                        <View style={styles.replyBody}>
                                            <Text style={styles.offerName}>{formatUsername(reply.username)}</Text>
                                            <Text style={styles.cardMeta}>{timeAgo(reply.created_at)}</Text>
                                            <Text style={styles.replyText}>{reply.body}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            {request.status !== 'closed' ? (
                                <View style={styles.replyComposer}>
                                    <TextField
                                        value={replyDraft}
                                        onChangeText={setReplyDraft}
                                        placeholder="Write a public reply"
                                        multiline
                                        style={styles.replyInput}
                                    />
                                    <PrimaryButton
                                        label={pendingIds.has(request.id) ? 'Posting...' : 'Reply'}
                                        onPress={() => void handleReply(request, replyDraft)}
                                        disabled={pendingIds.has(request.id) || replyDraft.trim().length === 0}
                                    />
                                </View>
                            ) : null}
                        </>
                    )}
                </ScrollView>
            </View>
        );
    }

    const primaryTabs = (
        <SegmentedControl
            activeKey={surface}
            onChange={(key) => setSurface(key as SupportSurface)}
            tone="primary"
            style={[screenStandards.tabControl, styles.supportTabs]}
            items={[
                { key: 'feed', label: 'Feed' },
                { key: 'my_requests', label: 'My Requests', flex: 1.2 },
                { key: 'meetings', label: 'Meetings' },
            ]}
        />
    );

    const renderCard = ({ item }: { item: api.SupportRequest }) => (
        <SupportRequestCard
            request={item}
            pending={pendingIds.has(item.id)}
            onOpen={loadDetail}
            onPrimaryAction={handlePrimaryAction}
            onClose={handleClose}
            onOpenChat={handleOpenChat}
            onPressUser={(request) => onOpenUserProfile({
                userId: request.requester_id,
                username: request.username,
                avatarUrl: request.avatar_url ?? undefined,
            })}
        />
    );

    if (surface === 'meetings') {
        return (
            <View style={styles.container}>
                {primaryTabs}
                <MeetingsView isActive={isActive} />
            </View>
        );
    }

    if (surface === 'my_requests') {
        return (
            <View style={styles.container}>
                {primaryTabs}
                <FlatList<api.SupportRequest>
                    ref={flatListRef}
                    data={visibleMyRequests}
                    keyExtractor={(item) => item.id}
                    {...listProps}
                    onEndReached={pagination.onEndReached}
                    onEndReachedThreshold={0.4}
                    onMomentumScrollBegin={pagination.onMomentumScrollBegin}
                    onScrollBeginDrag={pagination.onScrollBeginDrag}
                    onScroll={scrollToTop.onScroll}
                    scrollEventThrottle={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={myRequestsQuery.isRefetching && !myRequestsQuery.isFetchingNextPage}
                            onRefresh={() => void refreshMine()}
                            tintColor={Colors.primary}
                        />
                    }
                    contentContainerStyle={screenStandards.listContent}
                    ListHeaderComponent={
                        <>
                            {showMyRequestsNotice ? (
                                <InfoNoticeCard
                                    title="Your support requests"
                                    description="Track open requests, active support, and closed history."
                                    style={styles.headerCard}
                                    onDismiss={() => setShowMyRequestsNotice(false)}
                                />
                            ) : null}
                            <SegmentedControl
                                activeKey={myScope}
                                onChange={(key) => setMyScope(key as MyRequestScope)}
                                tone="warning"
                                style={styles.nestedTabs}
                                items={[
                                    { key: 'open', label: 'Open' },
                                    { key: 'active', label: 'Active' },
                                    { key: 'closed', label: 'Closed' },
                                ]}
                            />
                        </>
                    }
                    ListEmptyComponent={
                        <EmptyState
                            title={`No ${myScope} requests.`}
                            description="Create a request when you want support from the community."
                        />
                    }
                    ListFooterComponent={myRequestsQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                    ItemSeparatorComponent={SupportRequestSeparator}
                    renderItem={renderCard}
                />
                {isActive && scrollToTop.isVisible ? (
                    <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
                ) : null}
            </View>
        );
    }

    const loading = feedQuery.isLoading && feedRequests.length === 0;
    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            {primaryTabs}
            <FlatList<api.SupportRequest>
                ref={flatListRef}
                data={feedRequests}
                keyExtractor={(item) => item.id}
                {...listProps}
                onEndReached={pagination.onEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={pagination.onMomentumScrollBegin}
                onScrollBeginDrag={pagination.onScrollBeginDrag}
                onScroll={scrollToTop.onScroll}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
                        onRefresh={() => void refreshFeed()}
                        tintColor={Colors.primary}
                    />
                }
                contentContainerStyle={[screenStandards.listContent, styles.feedListContent]}
                ListHeaderComponent={
                    <>
                        {showFeedNotice ? (
                            <InfoNoticeCard
                                title="Support feed"
                                description="Find requests ranked by urgency, freshness, and response need."
                                style={styles.headerCard}
                                onDismiss={() => setShowFeedNotice(false)}
                            />
                        ) : null}
                        <SegmentedControl
                            activeKey={feedFilter}
                            onChange={(key) => setFeedFilter(key as api.SupportRequestFilter)}
                            tone="warning"
                            style={styles.nestedTabs}
                            items={[
                                { key: 'all', label: 'All' },
                                { key: 'urgent', label: 'Urgent' },
                                { key: 'unanswered', label: 'Unanswered', flex: 1.3 },
                            ]}
                        />
                    </>
                }
                ListEmptyComponent={
                    <EmptyState
                        title={feedFilter === 'urgent' ? 'No urgent requests right now.' : feedFilter === 'unanswered' ? 'No unanswered requests.' : 'No open requests right now.'}
                        description="Check back later or create a request if you need support."
                    />
                }
                ListFooterComponent={feedQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                ItemSeparatorComponent={SupportRequestSeparator}
                renderItem={renderCard}
            />
            {isActive && scrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
            <CreatePostFab
                visible={isActive}
                bottom={20}
                label="Request"
                onPress={onOpenCreateSupportRequest}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg.page },
    headerCard: { marginBottom: Spacing.md },
    supportTabs: { marginBottom: Spacing.sm },
    nestedTabs: { marginBottom: Spacing.md },
    feedListContent: { paddingBottom: ContentInsets.listBottom + ControlSizes.fabMinHeight },
    card: {
        backgroundColor: Colors.bg.page,
        padding: Spacing.md,
        marginHorizontal: -ContentInsets.screenHorizontal,
    },
    requestSeparator: {
        height: 1,
        backgroundColor: Colors.border.default,
        marginHorizontal: -ContentInsets.screenHorizontal,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    cardHeadBody: { flex: 1 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    cardName: { ...TextStyles.cardTitle },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
    badge: {
        backgroundColor: Colors.bg.page,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
    },
    badgeText: { ...TextStyles.caption, color: Colors.text.secondary },
    badgeUrgent: { backgroundColor: Colors.dangerSubtle, borderColor: Colors.dangerSubtle },
    badgeUrgentText: { color: Colors.danger },
    priorityBadge: {
        backgroundColor: Colors.primarySubtle,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
    },
    priorityBadgeText: { fontSize: TextStyles.caption.fontSize, fontWeight: TextStyles.caption.fontWeight, color: Colors.primary },
    cardMeta: { ...TextStyles.meta, marginTop: 2 },
    topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.md },
    topicChip: {
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.page,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
    },
    topicChipText: { ...TextStyles.caption, color: Colors.text.secondary },
    cardBody: {
        ...TextStyles.body,
        color: Colors.text.primary,
        marginTop: Spacing.md,
    },
    cardFooterText: {
        ...TextStyles.meta,
        marginTop: Spacing.md,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    actionPrimary: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.pill,
        minHeight: ControlSizes.chipMinHeight,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    actionPrimaryText: { ...TextStyles.button, fontSize: TextStyles.chip.fontSize },
    actionSecondary: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        minHeight: ControlSizes.chipMinHeight,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        backgroundColor: Colors.bg.surface,
    },
    actionSecondaryText: { ...TextStyles.chip, fontWeight: TextStyles.label.fontWeight },
    actionDisabled: { opacity: 0.6 },
    section: { marginTop: Spacing.md },
    sectionTitle: {
        ...TextStyles.sectionTitle,
        marginBottom: Spacing.sm,
    },
    mutedText: { ...TextStyles.secondary, color: Colors.text.muted },
    offerRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    offerBody: { flex: 1 },
    offerName: { ...TextStyles.label },
    offerActions: { gap: Spacing.xs, alignItems: 'flex-end' },
    offerStatus: { ...TextStyles.caption },
    compactPrimary: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.pill,
        minHeight: ControlSizes.chipMinHeight,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 7,
    },
    compactPrimaryText: { ...TextStyles.button, fontSize: TextStyles.caption.fontSize },
    compactSecondary: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        minHeight: ControlSizes.chipMinHeight,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 7,
    },
    compactSecondaryText: { ...TextStyles.caption, color: Colors.text.secondary },
    replyRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    replyBody: { flex: 1 },
    replyText: { ...TextStyles.secondary, color: Colors.text.primary, marginTop: 4 },
    replyComposer: { marginTop: Spacing.lg, gap: Spacing.sm },
    replyInput: { minHeight: 88, textAlignVertical: 'top' },
    detailButton: { marginTop: Spacing.md },
    footerLoader: { paddingVertical: Spacing.lg },
});
