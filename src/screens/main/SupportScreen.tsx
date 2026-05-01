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
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { useMySupportRequests, useSupportRequests } from '../../hooks/queries/useSupport';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { screenStandards } from '../../styles/screenStandards';
import { Colors, ContentInsets, Radius, Spacing, Typography } from '../../theme';
import { formatUsername } from '../../utils/identity';
import { dedupeById } from '../../utils/list';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { MeetingsView } from './support/MeetingsView';

type SupportSurface = 'feed' | 'my_requests' | 'meetings' | 'create';
type MyRequestScope = 'open' | 'active' | 'closed';

interface SupportScreenProps {
    isActive: boolean;
    onOpenChat: (chat: api.Chat) => void;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
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

const SUPPORT_TYPES: api.SupportType[] = ['chat', 'call', 'meetup', 'general'];
const URGENCIES: api.SupportUrgency[] = ['low', 'medium', 'high'];
const TOPICS: api.SupportTopic[] = [
    'anxiety',
    'relapse_risk',
    'loneliness',
    'cravings',
    'depression',
    'family',
    'work',
    'sleep',
    'celebration',
    'general',
];

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

export function SupportScreen({ isActive, onOpenChat, onOpenUserProfile }: SupportScreenProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const flatListRef = useRef<FlatList<api.SupportRequest> | null>(null);
    const hasActivated = useLazyActivation(isActive);
    const [surface, setSurface] = useState<SupportSurface>('feed');
    const [feedFilter, setFeedFilter] = useState<api.SupportRequestFilter>('all');
    const [myScope, setMyScope] = useState<MyRequestScope>('open');
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
    const [detail, setDetail] = useState<DetailState | null>(null);
    const [replyDraft, setReplyDraft] = useState('');
    const [form, setForm] = useState<api.CreateSupportRequestInput>({
        support_type: 'chat',
        message: '',
        urgency: 'low',
        topics: [],
        preferred_gender: null,
        location: null,
        privacy_level: 'standard',
    });

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

    const handleCreate = useCallback(async () => {
        setPending('create', true);
        try {
            const payload: api.CreateSupportRequestInput = {
                ...form,
                message: form.message?.trim() || null,
                topics: form.topics.length > 0 ? form.topics : ['general'],
                location: form.location?.visibility === 'city' ? form.location : null,
            };
            const created = await api.createSupportRequest(payload);
            setForm({
                support_type: 'chat',
                message: '',
                urgency: 'low',
                topics: [],
                preferred_gender: null,
                location: null,
                privacy_level: 'standard',
            });
            setSurface('my_requests');
            setMyScope('open');
            invalidateSupport();
            void loadDetail(created);
        } catch (e: unknown) {
            Alert.alert('Could not create support request', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPending('create', false);
        }
    }, [form, invalidateSupport, loadDetail, setPending]);

    const toggleTopic = useCallback((topic: api.SupportTopic) => {
        setForm((current) => ({
            ...current,
            topics: current.topics.includes(topic)
                ? current.topics.filter((item) => item !== topic)
                : [...current.topics, topic],
        }));
    }, []);

    useEffect(() => {
        if (form.location?.visibility === 'city') return;
        const city = user?.current_city ?? user?.city ?? null;
        if (!city) return;
        setForm((current) => current.location ? current : {
            ...current,
            location: null,
        });
    }, [form.location?.visibility, user?.city, user?.current_city]);

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
                { key: 'my_requests', label: 'My requests', flex: 1.2 },
                { key: 'meetings', label: 'Meetings' },
                { key: 'create', label: 'Create' },
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

    if (surface === 'create') {
        const city = user?.current_city ?? user?.city ?? null;
        const includeCity = form.location?.visibility === 'city';
        return (
            <View style={styles.container}>
                {primaryTabs}
                <ScrollView contentContainerStyle={[screenStandards.detailContent, screenStandards.scrollContent]}>
                    <InfoNoticeCard
                        title="Create support request"
                        description="Tell the community what support you need and how people can respond."
                        style={styles.headerCard}
                    />

                    <Text style={styles.formLabel}>Support type</Text>
                    <View style={styles.selectorWrap}>
                        {SUPPORT_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.selectorChip, form.support_type === type && styles.selectorChipActive]}
                                onPress={() => setForm((current) => ({ ...current, support_type: type }))}
                            >
                                <Text style={[styles.selectorChipText, form.support_type === type && styles.selectorChipTextActive]}>
                                    {SUPPORT_TYPE_LABELS[type]}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.formLabel}>Urgency</Text>
                    <View style={styles.selectorWrap}>
                        {URGENCIES.map((urgency) => (
                            <TouchableOpacity
                                key={urgency}
                                style={[styles.selectorChip, form.urgency === urgency && styles.selectorChipActive]}
                                onPress={() => setForm((current) => ({ ...current, urgency }))}
                            >
                                <Text style={[styles.selectorChipText, form.urgency === urgency && styles.selectorChipTextActive]}>
                                    {URGENCY_LABELS[urgency]}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.formLabel}>Topics</Text>
                    <View style={styles.selectorWrap}>
                        {TOPICS.map((topic) => {
                            const active = form.topics.includes(topic);
                            return (
                                <TouchableOpacity
                                    key={topic}
                                    style={[styles.selectorChip, active && styles.selectorChipActive]}
                                    onPress={() => toggleTopic(topic)}
                                >
                                    <Text style={[styles.selectorChipText, active && styles.selectorChipTextActive]}>
                                        {TOPIC_LABELS[topic]}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={styles.formLabel}>Preferred gender</Text>
                    <View style={styles.selectorWrap}>
                        {(['no_preference', 'woman', 'man', 'non_binary'] as api.PreferredGender[]).map((gender) => {
                            const active = (form.preferred_gender ?? 'no_preference') === gender;
                            const label = gender === 'no_preference' ? 'No preference' : gender === 'non_binary' ? 'Non-binary' : gender[0].toUpperCase() + gender.slice(1);
                            return (
                                <TouchableOpacity
                                    key={gender}
                                    style={[styles.selectorChip, active && styles.selectorChipActive]}
                                    onPress={() => setForm((current) => ({ ...current, preferred_gender: gender === 'no_preference' ? null : gender }))}
                                >
                                    <Text style={[styles.selectorChipText, active && styles.selectorChipTextActive]}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {city ? (
                        <>
                            <Text style={styles.formLabel}>Location</Text>
                            <View style={styles.selectorWrap}>
                                <TouchableOpacity
                                    style={[styles.selectorChip, !includeCity && styles.selectorChipActive]}
                                    onPress={() => setForm((current) => ({ ...current, location: null }))}
                                >
                                    <Text style={[styles.selectorChipText, !includeCity && styles.selectorChipTextActive]}>Hidden</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.selectorChip, includeCity && styles.selectorChipActive]}
                                    onPress={() => setForm((current) => ({
                                        ...current,
                                        location: { city, visibility: 'city' },
                                    }))}
                                >
                                    <Text style={[styles.selectorChipText, includeCity && styles.selectorChipTextActive]}>{city}</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : null}

                    <TextField
                        value={form.message ?? ''}
                        onChangeText={(message) => setForm((current) => ({ ...current, message }))}
                        placeholder="Optional note"
                        multiline
                        style={[styles.formInput, styles.inputMultiline]}
                    />

                    <PrimaryButton
                        label={pendingIds.has('create') ? 'Posting...' : 'Post request'}
                        onPress={() => void handleCreate()}
                        disabled={pendingIds.has('create')}
                        style={styles.submitButton}
                    />
                </ScrollView>
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
                            <InfoNoticeCard
                                title="Your support requests"
                                description="Track open requests, active support, and closed history."
                                style={styles.headerCard}
                            />
                            <SegmentedControl
                                activeKey={myScope}
                                onChange={(key) => setMyScope(key as MyRequestScope)}
                                tone="secondary"
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
                contentContainerStyle={screenStandards.listContent}
                ListHeaderComponent={
                    <>
                        <InfoNoticeCard
                            title="Support feed"
                            description="Find requests ranked by urgency, freshness, and response need."
                            style={styles.headerCard}
                        />
                        <SegmentedControl
                            activeKey={feedFilter}
                            onChange={(key) => setFeedFilter(key as api.SupportRequestFilter)}
                            tone="secondary"
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg.page },
    headerCard: { marginBottom: Spacing.md },
    supportTabs: { marginBottom: Spacing.sm },
    nestedTabs: { marginBottom: Spacing.md },
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
    cardName: { fontSize: Typography.sizes.md, fontWeight: '600', color: Colors.text.primary },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
    badge: {
        backgroundColor: Colors.bg.page,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
    },
    badgeText: { fontSize: Typography.sizes.xs, fontWeight: '700', color: Colors.text.secondary },
    badgeUrgent: { backgroundColor: Colors.dangerSubtle, borderColor: Colors.dangerSubtle },
    badgeUrgentText: { color: Colors.danger },
    priorityBadge: {
        backgroundColor: Colors.primarySubtle,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
    },
    priorityBadgeText: { fontSize: Typography.sizes.xs, fontWeight: '700', color: Colors.primary },
    cardMeta: { fontSize: Typography.sizes.sm, color: Colors.text.muted, marginTop: 2 },
    topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.md },
    topicChip: {
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.page,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
    },
    topicChipText: { fontSize: Typography.sizes.xs, color: Colors.text.secondary, fontWeight: '600' },
    cardBody: {
        fontSize: Typography.sizes.md,
        color: Colors.text.primary,
        lineHeight: 22,
        marginTop: Spacing.md,
    },
    cardFooterText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
        marginTop: Spacing.md,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    actionPrimary: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    actionPrimaryText: { color: Colors.textOn.primary, fontWeight: '700', fontSize: Typography.sizes.sm },
    actionSecondary: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        backgroundColor: Colors.bg.surface,
    },
    actionSecondaryText: { color: Colors.text.secondary, fontWeight: '700', fontSize: Typography.sizes.sm },
    actionDisabled: { opacity: 0.6 },
    section: { marginTop: Spacing.md },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: Spacing.sm,
    },
    mutedText: { color: Colors.text.muted, fontSize: Typography.sizes.sm },
    offerRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    offerBody: { flex: 1 },
    offerName: { fontSize: Typography.sizes.sm, fontWeight: '700', color: Colors.text.primary },
    offerActions: { gap: Spacing.xs, alignItems: 'flex-end' },
    offerStatus: { color: Colors.text.muted, fontSize: Typography.sizes.xs, fontWeight: '700' },
    compactPrimary: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 7,
    },
    compactPrimaryText: { color: Colors.textOn.primary, fontWeight: '700', fontSize: Typography.sizes.xs },
    compactSecondary: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 7,
    },
    compactSecondaryText: { color: Colors.text.secondary, fontWeight: '700', fontSize: Typography.sizes.xs },
    replyRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    replyBody: { flex: 1 },
    replyText: { color: Colors.text.primary, fontSize: Typography.sizes.sm, lineHeight: 20, marginTop: 4 },
    replyComposer: { marginTop: Spacing.lg, gap: Spacing.sm },
    replyInput: { minHeight: 88, textAlignVertical: 'top' },
    detailButton: { marginTop: Spacing.md },
    formLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.secondary,
        marginBottom: Spacing.sm,
        marginTop: Spacing.md,
    },
    selectorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    selectorChip: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
        backgroundColor: Colors.bg.surface,
    },
    selectorChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    selectorChipText: { fontSize: Typography.sizes.sm, color: Colors.text.secondary },
    selectorChipTextActive: { color: Colors.textOn.primary, fontWeight: '700' },
    formInput: { marginTop: Spacing.md },
    inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
    submitButton: { marginTop: Spacing.lg },
    footerLoader: { paddingVertical: Spacing.lg },
});
