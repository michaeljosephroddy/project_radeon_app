import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, RefreshControl, ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { TextField } from '../../components/ui/TextField';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useAuth } from '../../hooks/useAuth';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import {
    useMySupportRequests,
    useSupportRequests,
} from '../../hooks/queries/useSupport';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { dedupeById } from '../../utils/list';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { formatUsername } from '../../utils/identity';
import { screenStandards } from '../../styles/screenStandards';

type SupportType = api.SupportRequest['type'];
type SupportUrgency = api.SupportRequest['urgency'];
type SupportResponseType = api.SupportResponse['response_type'];
type SupportSurface = 'immediate' | 'community' | 'my_requests' | 'create';
type SupportScope = 'open' | 'active' | 'completed';
type SupportRequestChannel = 'immediate' | 'community';

interface PendingCheckInDraft {
    requestId: string;
    requesterName: string;
    scheduledFor: string;
    pickerMode: 'date' | 'time' | null;
}

interface LoadedSupportResponses {
    items: api.SupportResponse[];
    page: number;
    hasMore: boolean;
}

interface SupportScreenProps {
    isActive: boolean;
    onOpenChat: (chat: api.Chat) => void;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

interface SupportStatCard {
    key: string;
    label: string;
    value: number;
}

interface SupportRequestCardProps {
    request: api.SupportRequest;
    responsePending: boolean;
    closingPending: boolean;
    responses?: api.SupportResponse[];
    responsesExpanded?: boolean;
    responsesLoading?: boolean;
    responsesLoadingMore?: boolean;
    responsesHasMore?: boolean;
    acceptingResponseId?: string;
    requestChatOpening?: boolean;
    onRespond: (request: api.SupportRequest, responseType: SupportResponseType) => void;
    onOpenCheckInLaterComposer?: (request: api.SupportRequest) => void;
    onClose: (request: api.SupportRequest) => void;
    onToggleResponses?: (request: api.SupportRequest) => void;
    onAcceptResponse?: (request: api.SupportRequest, response: api.SupportResponse) => void;
    onLoadMoreResponses?: (request: api.SupportRequest) => void;
    onOpenRequestChat?: (request: api.SupportRequest) => void;
    onPressUser: () => void;
}

const SUPPORT_TYPE_LABELS: Record<SupportType, string> = {
    need_to_talk: 'Need to talk',
    need_distraction: 'Need distraction',
    need_encouragement: 'Need encouragement',
    need_in_person_help: 'Need in-person help',
};

const SUPPORT_URGENCY_OPTIONS: Array<{ value: SupportUrgency; label: string }> = [
    { value: 'when_you_can', label: 'Whenever you can' },
    { value: 'soon', label: 'Soon' },
    { value: 'right_now', label: 'Right now' },
];

const SUPPORT_RESPONSE_LABELS: Record<SupportResponseType, string> = {
    can_chat: 'Can chat now',
    check_in_later: 'Check in later',
    can_meet: 'I can meet up',
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

function getDefaultCheckInDate(): Date {
    return new Date();
}

function getTodayStart(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function formatScheduledForDisplay(scheduledFor: string): string {
    return new Date(scheduledFor).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function buildCanChatMessage(): string {
    return "Hey, I saw your support request — I'm here and happy to chat right now if you'd like to talk.";
}

function isLocationFresh(updatedAt: string | null | undefined): boolean {
    if (!updatedAt) return false;
    return Date.now() - new Date(updatedAt).getTime() < 24 * 60 * 60 * 1000;
}

function buildCanMeetMessage(city: string | null | undefined): string {
    const location = city ? `I'm currently in ${city}` : "I'm close by";
    return `Hey, I saw your support request. ${location} and happy to meet up in person if that would help.`;
}

function buildCheckInLaterMessage(scheduledFor: string): string {
    return `Hey, I saw your support request. I can't chat right now but I'd love to check in with you on ${formatScheduledForDisplay(scheduledFor)}.`;
}

function getSupportResponseSummary(responses?: api.SupportResponse[]): string | null {
    if (!Array.isArray(responses) || responses.length === 0) return null;

    const canChatCount = responses.filter(response => response.response_type === 'can_chat').length;
    const checkInLaterCount = responses.filter(response => response.response_type === 'check_in_later').length;
    const canMeetCount = responses.filter(response => response.response_type === 'can_meet').length;
    const parts: string[] = [];

    if (canChatCount > 0) parts.push(`${canChatCount} can chat now`);
    if (checkInLaterCount > 0) parts.push(`${checkInLaterCount} can check in later`);
    if (canMeetCount > 0) parts.push(`${canMeetCount} can meet up`);

    return parts.length > 0 ? parts.join(' · ') : null;
}

function haveSameRequestIds(left: api.SupportRequest[], right: api.SupportRequest[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((item, index) => item.id === right[index]?.id);
}

function formatRequestChannel(channel?: SupportRequestChannel): string {
    return channel === 'immediate' ? 'Immediate support' : 'Community support';
}

function getRequestChannel(request: Pick<api.SupportRequest, 'channel'>): SupportRequestChannel {
    return request.channel === 'immediate' ? 'immediate' : 'community';
}

function isOpenRequest(request: api.SupportRequest): boolean {
    return request.status === 'open';
}

function sortRequestsNewestFirst<T extends { created_at: string }>(left: T, right: T): number {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
}

function SupportRequestCard({
    request,
    responsePending,
    closingPending,
    responses,
    responsesExpanded = false,
    responsesLoading = false,
    responsesLoadingMore = false,
    responsesHasMore = false,
    acceptingResponseId,
    requestChatOpening = false,
    onRespond,
    onOpenCheckInLaterComposer,
    onClose,
    onToggleResponses,
    onAcceptResponse,
    onLoadMoreResponses,
    onOpenRequestChat,
    onPressUser,
}: SupportRequestCardProps) {
    const isClosed = request.status === 'closed';
    const isActive = request.status === 'active';
    const responseSummary = getSupportResponseSummary(responses);
    const canRespond = !responsePending && !request.has_responded && !isClosed && !isActive;
    const requestChannel = getRequestChannel(request);
    const canOpenActiveChat = Boolean(onOpenRequestChat && request.chat_id && isActive);
    const statusSummary = isActive
        ? (request.is_own_request ? 'Support is active' : 'Supporting now')
        : isClosed
            ? 'Closed'
            : `${request.response_count} response${request.response_count === 1 ? '' : 's'}`;

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <TouchableOpacity onPress={request.is_own_request ? undefined : onPressUser} disabled={request.is_own_request}>
                    <Avatar username={request.username} avatarUrl={request.avatar_url ?? undefined} size={44} />
                </TouchableOpacity>
                <View style={styles.cardHeadBody}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.cardName}>{formatUsername(request.username)}</Text>
                        <View style={styles.cardTitleBadges}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{formatRequestChannel(requestChannel)}</Text>
                            </View>
                            {request.urgency === 'right_now' ? (
                                <View style={styles.urgencyBadgeUrgent}>
                                    <Text style={styles.urgencyBadgeUrgentText}>Right now</Text>
                                </View>
                            ) : request.urgency === 'soon' ? (
                                <View style={styles.urgencyBadgeSoon}>
                                    <Text style={styles.urgencyBadgeSoonText}>Soon</Text>
                                </View>
                            ) : (
                                <View style={styles.urgencyBadgeWhenever}>
                                    <Text style={styles.urgencyBadgeWheneverText}>Whenever you can</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <Text style={styles.cardMeta}>
                        {SUPPORT_TYPE_LABELS[request.type]} · {timeAgo(request.created_at)}
                    </Text>
                </View>
            </View>

            {!!request.message && (
                <Text style={styles.cardBody}>{request.message}</Text>
            )}

            <Text style={styles.cardFooterText}>
                {request.city ? `${request.city} · ` : ''}
                {statusSummary}
                {request.has_responded ? ' · You responded' : ''}
            </Text>

            {responseSummary ? (
                <Text style={styles.responseSummaryText}>{responseSummary}</Text>
            ) : null}

            {request.is_own_request && isActive ? (
                <View style={styles.actions}>
                    {canOpenActiveChat ? (
                        <TouchableOpacity
                            style={[styles.actionPrimary, requestChatOpening && styles.actionDisabled]}
                            onPress={() => onOpenRequestChat?.(request)}
                            disabled={requestChatOpening}
                        >
                            <Text style={styles.actionPrimaryText}>
                                {requestChatOpening ? 'Opening...' : 'Open'}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    {request.response_count > 0 && onToggleResponses ? (
                        <TouchableOpacity style={styles.actionSecondary} onPress={() => onToggleResponses(request)}>
                            <Text style={styles.actionSecondaryText}>
                                {responsesExpanded ? 'Hide responses' : 'View responses'}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        style={[styles.actionSecondary, closingPending && styles.actionDisabled]}
                        onPress={() => onClose(request)}
                        disabled={closingPending || isClosed}
                    >
                        <Text style={styles.actionSecondaryText}>
                            {closingPending ? 'Closing...' : isClosed ? 'Closed' : 'Complete'}
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : request.is_own_request ? (
                <View style={styles.actions}>
                    {request.response_count > 0 && onToggleResponses ? (
                        <TouchableOpacity style={styles.actionSecondary} onPress={() => onToggleResponses(request)}>
                            <Text style={styles.actionSecondaryText}>
                                {responsesExpanded ? 'Hide responses' : 'View responses'}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        style={[styles.actionSecondary, closingPending && styles.actionDisabled]}
                        onPress={() => onClose(request)}
                        disabled={closingPending || isClosed}
                    >
                        <Text style={styles.actionSecondaryText}>
                            {closingPending ? 'Closing...' : isClosed ? 'Closed' : 'Close request'}
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : isClosed ? null : (
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionPrimary, !canRespond && styles.actionDisabled]}
                        onPress={() => onRespond(request, 'can_chat')}
                        disabled={!canRespond}
                    >
                        <Text style={styles.actionPrimaryText}>I can chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionSecondary, !canRespond && styles.actionDisabled]}
                        onPress={() => onOpenCheckInLaterComposer?.(request)}
                        disabled={!canRespond}
                    >
                        <Text style={styles.actionSecondaryText}>Check in later</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionSecondary, !canRespond && styles.actionDisabled]}
                        onPress={() => onRespond(request, 'can_meet')}
                        disabled={!canRespond}
                    >
                        <Text style={styles.actionSecondaryText}>I can meet up</Text>
                    </TouchableOpacity>
                </View>
            )}

            {request.is_own_request && responsesExpanded ? (
                <View style={styles.responsesSection}>
                    {responsesLoading ? (
                        <ActivityIndicator color={Colors.primary} size="small" />
                    ) : Array.isArray(responses) && responses.length > 0 ? (
                        responses.map((response) => (
                            <View key={response.id} style={styles.responseRow}>
                                <Avatar username={response.username} avatarUrl={response.avatar_url ?? undefined} size={32} />
                                <View style={styles.responseBody}>
                                    <Text style={styles.responseName}>{formatUsername(response.username)}</Text>
                            <Text style={styles.responseMeta}>
                                {SUPPORT_RESPONSE_LABELS[response.response_type]} · {timeAgo(response.created_at)}
                            </Text>
                            {response.message ? (
                                <Text style={styles.responseMessage}>{response.message}</Text>
                            ) : null}
                        </View>
                                {request.status === 'open' && response.status === 'pending' && onAcceptResponse ? (
                                    <TouchableOpacity
                                        style={[
                                            styles.responseChatButton,
                                            acceptingResponseId === response.id && styles.actionDisabled,
                                        ]}
                                        onPress={() => onAcceptResponse(request, response)}
                                        disabled={acceptingResponseId === response.id}
                                    >
                                        <Text style={styles.responseChatButtonText}>
                                            {acceptingResponseId === response.id ? 'Accepting...' : 'Accept'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : response.status === 'accepted' ? (
                                    <View style={styles.responseAcceptedBadge}>
                                        <Text style={styles.responseAcceptedBadgeText}>Accepted</Text>
                                    </View>
                                ) : response.status === 'not_selected' ? (
                                    <View style={styles.responseMutedBadge}>
                                        <Text style={styles.responseMutedBadgeText}>Passed</Text>
                                    </View>
                                ) : null}
                            </View>
                        ))
                    ) : (
                        <Text style={styles.responsesEmptyText}>No responses yet.</Text>
                    )}
                    {responsesHasMore ? (
                        <TouchableOpacity
                            style={[styles.responsesLoadMoreButton, responsesLoadingMore && styles.actionDisabled]}
                            onPress={() => onLoadMoreResponses?.(request)}
                            disabled={responsesLoadingMore}
                        >
                            <Text style={styles.responsesLoadMoreText}>
                                {responsesLoadingMore ? 'Loading...' : 'Load more responses'}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

export function SupportScreen({ isActive, onOpenChat, onOpenUserProfile }: SupportScreenProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const flatListRef = useRef<FlatList<any> | null>(null);
    const hasActivatedOpen = useLazyActivation(isActive);
    const [surface, setSurface] = useState<SupportSurface>('immediate');
    const [myRequestsScope, setMyRequestsScope] = useState<SupportScope>('open');
    const [requestChannel, setRequestChannel] = useState<SupportRequestChannel>('community');
    const [requests, setRequests] = useState<api.SupportRequest[]>([]);
    const [myRequests, setMyRequests] = useState<api.SupportRequest[]>([]);
    const [requestResponsesById, setRequestResponsesById] = useState<Record<string, LoadedSupportResponses>>({});
    const [expandedResponseRequestIds, setExpandedResponseRequestIds] = useState<Set<string>>(new Set());
    const [responseLoadingIds, setResponseLoadingIds] = useState<Set<string>>(new Set());
    const [responseLoadingMoreIds, setResponseLoadingMoreIds] = useState<Set<string>>(new Set());
    const [responseAcceptingIds, setResponseAcceptingIds] = useState<Record<string, string | undefined>>({});
    const [requestChatOpeningIds, setRequestChatOpeningIds] = useState<Set<string>>(new Set());
    const [openHasMore, setOpenHasMore] = useState(false);
    const [myHasMore, setMyHasMore] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [responsePendingIds, setResponsePendingIds] = useState<Set<string>>(new Set());
    const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
    const [pendingCheckInDraft, setPendingCheckInDraft] = useState<PendingCheckInDraft | null>(null);
    const [form, setForm] = useState({
        type: 'need_to_talk' as SupportType,
        message: '',
        urgency: 'when_you_can' as SupportUrgency,
    });
    const createUrgencyOptions = useMemo(
        () => SUPPORT_URGENCY_OPTIONS.filter((option) => option.value !== 'right_now'),
        [],
    );
    const supportListProps = getListPerformanceProps('detailList');
    const openQueueChannel: SupportRequestChannel = surface === 'community' ? 'community' : 'immediate';
    const openRequestsQuery = useSupportRequests(openQueueChannel, 20, hasActivatedOpen);
    const myRequestsQuery = useMySupportRequests(20, hasActivatedOpen);
    useRefetchOnActiveIfStale(isActive && (surface === 'immediate' || surface === 'community'), openRequestsQuery);
    useRefetchOnActiveIfStale(isActive && surface === 'my_requests', myRequestsQuery);
    const supportScrollToTop = useScrollToTopButton({ threshold: 320 });
    const openRequestItems = useMemo(
        () => dedupeById(openRequestsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [openRequestsQuery.data],
    );
    const myRequestItems = useMemo(
        () => dedupeById(myRequestsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [myRequestsQuery.data],
    );
    useEffect(() => {
        setRequests((current) => haveSameRequestIds(current, openRequestItems) ? current : openRequestItems);
        setOpenHasMore((current) => {
            const next = openRequestsQuery.hasNextPage ?? false;
            return current === next ? current : next;
        });
    }, [openRequestItems, openRequestsQuery.data, openRequestsQuery.hasNextPage]);

    useEffect(() => {
        setMyRequests((current) => haveSameRequestIds(current, myRequestItems) ? current : myRequestItems);
        setMyHasMore((current) => {
            const next = myRequestsQuery.hasNextPage ?? false;
            return current === next ? current : next;
        });
    }, [myRequestItems, myRequestsQuery.hasNextPage]);
    const myOpenRequests = useMemo(
        () => myRequests
            .filter((request) => isOpenRequest(request))
            .slice()
            .sort(sortRequestsNewestFirst),
        [myRequests],
    );
    const myCompletedRequests = useMemo(
        () => myRequests.filter((request) => request.status === 'closed' && Boolean(request.accepted_response_id)),
        [myRequests],
    );
    const myActiveRequests = useMemo(
        () => myRequests
            .filter((request) => request.status === 'active')
            .slice()
            .sort(sortRequestsNewestFirst),
        [myRequests],
    );
    const openRequestStats = useMemo<SupportStatCard[]>(
        () => [{ key: 'requests', label: 'Requests', value: requests.length }],
        [requests.length],
    );
    const myOpenStats = useMemo<SupportStatCard[]>(
        () => [{ key: 'open', label: 'Open', value: myOpenRequests.length }],
        [myOpenRequests.length],
    );
    const myActiveStats = useMemo<SupportStatCard[]>(
        () => [{ key: 'active', label: 'Active', value: myActiveRequests.length }],
        [myActiveRequests.length],
    );
    const myCompletedStats = useMemo<SupportStatCard[]>(
        () => [{ key: 'completed', label: 'Completed', value: myCompletedRequests.length }],
        [myCompletedRequests.length],
    );

    const refreshOpen = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.supportRequests({ scope: 'open', channel: openQueueChannel, limit: 20 }));
        await openRequestsQuery.refetch();
    };

    const refreshMine = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.supportRequests({ scope: 'mine', limit: 20 }));
        await myRequestsQuery.refetch();
    };

    const loadResponses = useCallback(async (requestId: string, page = 1, append = false) => {
        if (append) {
            setResponseLoadingMoreIds(prev => new Set(prev).add(requestId));
        } else {
            setResponseLoadingIds(prev => new Set(prev).add(requestId));
        }
        try {
            const responsePage = await api.getSupportRequestResponses(requestId, page, 20);
            setRequestResponsesById(prev => ({
                ...prev,
                [requestId]: {
                    items: append
                        ? [...(prev[requestId]?.items ?? []), ...(responsePage.items ?? [])]
                        : (responsePage.items ?? []),
                    page: responsePage.page,
                    hasMore: responsePage.has_more,
                },
            }));
        } catch (e: unknown) {
            Alert.alert('Could not load responses', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            if (append) {
                setResponseLoadingMoreIds(prev => {
                    const next = new Set(prev);
                    next.delete(requestId);
                    return next;
                });
            } else {
                setResponseLoadingIds(prev => {
                    const next = new Set(prev);
                    next.delete(requestId);
                    return next;
                });
            }
        }
    }, []);

    const toggleResponses = useCallback((request: api.SupportRequest) => {
        setExpandedResponseRequestIds(prev => {
            const next = new Set(prev);
            if (next.has(request.id)) {
                next.delete(request.id);
            } else {
                next.add(request.id);
            }
            return next;
        });

        if (!requestResponsesById[request.id]) {
            void loadResponses(request.id, 1, false);
        }
    }, [loadResponses, requestResponsesById]);

    const openCheckInLaterComposer = useCallback((request: api.SupportRequest) => {
        setPendingCheckInDraft({
            requestId: request.id,
            requesterName: request.username,
            scheduledFor: getDefaultCheckInDate().toISOString(),
            pickerMode: null,
        });
    }, []);

    const closeCheckInLaterComposer = useCallback(() => {
        setPendingCheckInDraft(null);
    }, []);

    const handleLoadMoreResponses = useCallback((request: api.SupportRequest) => {
        const current = requestResponsesById[request.id];
        if (!current?.hasMore || responseLoadingMoreIds.has(request.id)) return;
        void loadResponses(request.id, current.page + 1, true);
    }, [loadResponses, requestResponsesById, responseLoadingMoreIds]);

    const handleRespond = async (request: api.SupportRequest, responseType: SupportResponseType) => {
        setResponsePendingIds(prev => new Set(prev).add(request.id));
        try {
            const scheduledFor = responseType === 'check_in_later' && pendingCheckInDraft?.requestId === request.id
                ? pendingCheckInDraft.scheduledFor
                : undefined;
            const responseMessage = responseType === 'check_in_later' && scheduledFor
                ? buildCheckInLaterMessage(scheduledFor)
                : responseType === 'can_meet'
                ? buildCanMeetMessage(
                    isLocationFresh(user?.location_updated_at) && user?.current_city
                        ? user.current_city
                        : user?.city
                  )
                : buildCanChatMessage();

            await api.createSupportResponse(request.id, {
                response_type: responseType,
                scheduled_for: scheduledFor,
                message: responseMessage,
            });
            setRequests(prev => prev.map(item => item.id === request.id ? {
                ...item,
                has_responded: true,
                response_count: item.response_count + 1,
            } : item));
            Alert.alert('Response sent', `${SUPPORT_RESPONSE_LABELS[responseType]} has been shared with ${formatUsername(request.username)}.`);

            if (responseType === 'check_in_later') {
                setPendingCheckInDraft(null);
            }
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportResponses(request.id) }),
            ]);
        } catch (e: unknown) {
            Alert.alert('Could not respond', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setResponsePendingIds(prev => {
                const next = new Set(prev);
                next.delete(request.id);
                return next;
            });
        }
    };

    const handleAcceptResponse = useCallback(async (
        request: api.SupportRequest,
        response: api.SupportResponse,
    ) => {
        setResponseAcceptingIds(prev => ({ ...prev, [request.id]: response.id }));
        try {
            const acceptedRequest = await api.acceptSupportResponse(request.id, response.id);
            setMyRequests(prev => prev.map(item => item.id === request.id ? acceptedRequest : item));
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportResponses(request.id) }),
                queryClient.invalidateQueries({ queryKey: ['chats'] }),
            ]);
            await loadResponses(request.id, 1, false);
            if (acceptedRequest.chat_id) {
                const chat = await api.getChat(acceptedRequest.chat_id);
                onOpenChat(chat);
            } else {
                Alert.alert('Response accepted', 'Support is now active.');
            }
        } catch (e: unknown) {
            Alert.alert('Could not accept response', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setResponseAcceptingIds(prev => ({ ...prev, [request.id]: undefined }));
        }
    }, [loadResponses, onOpenChat, queryClient]);

    const submitCheckInLater = useCallback(() => {
        if (!pendingCheckInDraft) return;

        const request = requests.find(item => item.id === pendingCheckInDraft.requestId);
        if (!request) {
            setPendingCheckInDraft(null);
            return;
        }

        void handleRespond(request, 'check_in_later');
    }, [handleRespond, pendingCheckInDraft, requests]);

    const handleClose = async (request: api.SupportRequest) => {
        setClosingIds(prev => new Set(prev).add(request.id));
        try {
            const closedRequest = await api.updateSupportRequest(request.id, { status: 'closed' });
            setMyRequests(prev => prev.map(item => item.id === request.id ? closedRequest : item));
            setExpandedResponseRequestIds(prev => {
                const next = new Set(prev);
                next.delete(request.id);
                return next;
            });
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
                queryClient.invalidateQueries({ queryKey: ['chats'] }),
                ...(request.chat_id ? [queryClient.invalidateQueries({ queryKey: queryKeys.chat(request.chat_id) })] : []),
                ...(request.chat_id ? [queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(request.chat_id) })] : []),
            ]);
        } catch (e: unknown) {
            Alert.alert('Could not close request', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setClosingIds(prev => {
                const next = new Set(prev);
                next.delete(request.id);
                return next;
            });
        }
    };

    const handleCreate = async () => {
        setSubmitting(true);
        try {
            const payload = {
                type: form.type,
                message: form.message.trim() || null,
                urgency: form.urgency,
                privacy_level: 'standard' as const,
            };
            const created = requestChannel === 'immediate'
                ? await api.createImmediateSupportRequest(payload)
                : await api.createCommunitySupportRequest(payload);
            setMyRequests(prev => [created, ...prev.filter(item => item.id !== created.id)]);
            setSurface('my_requests');
            setMyRequestsScope('open');
            setForm({
                type: 'need_to_talk',
                message: '',
                urgency: 'when_you_can',
            });
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
            ]);
        } catch (e: unknown) {
            Alert.alert('Could not create support request', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenRequestChat = useCallback(async (request: api.SupportRequest) => {
        if (!request.chat_id) {
            Alert.alert('Could not open support chat', 'This request is not connected to a chat yet.');
            return;
        }

        setRequestChatOpeningIds(prev => new Set(prev).add(request.id));
        try {
            const chat = await api.getChat(request.chat_id);
            onOpenChat(chat);
        } catch (e: unknown) {
            Alert.alert('Could not open support chat', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setRequestChatOpeningIds(prev => {
                const next = new Set(prev);
                next.delete(request.id);
                return next;
            });
        }
    }, [onOpenChat]);

    const handleLoadMore = async () => {
        if (surface === 'create') return;
        if (surface === 'my_requests') {
            if (myRequestsQuery.isFetchingNextPage || myRequestsQuery.isRefetching || !myHasMore) return;
            await myRequestsQuery.fetchNextPage();
            return;
        }
        if (openRequestsQuery.isFetchingNextPage || openRequestsQuery.isRefetching || !openHasMore) return;
        await openRequestsQuery.fetchNextPage();
    };
    const supportListPagination = useGuardedEndReached(handleLoadMore);

    const handleRequestChannelChange = useCallback((channel: SupportRequestChannel) => {
        setRequestChannel(channel);
        setForm((prev) => {
            if (channel === 'immediate') {
                return { ...prev, urgency: 'right_now' };
            }
            return prev.urgency === 'right_now'
                ? { ...prev, urgency: 'when_you_can' }
                : prev;
        });
    }, []);

    if (pendingCheckInDraft) {
        const sendingCheckIn = responsePendingIds.has(pendingCheckInDraft.requestId);
        const scheduledDate = new Date(pendingCheckInDraft.scheduledFor);
        const minimumCheckInDate = getTodayStart();
        const handleCheckInPickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
            if (Platform.OS === 'android') {
                if (event.type === 'dismissed') {
                    setPendingCheckInDraft((current) => current ? { ...current, pickerMode: null } : current);
                    return;
                }
                setPendingCheckInDraft((current) => current ? {
                    ...current,
                    scheduledFor: (selectedDate ?? scheduledDate).toISOString(),
                    pickerMode: null,
                } : current);
                return;
            }

            if (selectedDate) {
                setPendingCheckInDraft((current) => current ? {
                    ...current,
                    scheduledFor: selectedDate.toISOString(),
                } : current);
            }
        };

        return (
            <ScrollView contentContainerStyle={[screenStandards.detailContent, screenStandards.scrollContent]}>
                <SegmentedControl
                    activeKey="check-in"
                    onChange={(key) => {
                        if (key === 'back') closeCheckInLaterComposer();
                    }}
                    tone="primary"
                    style={screenStandards.tabControl}
                    items={[
                        { key: 'back', label: 'Back' },
                        { key: 'check-in', label: 'Check in later', flex: 2 },
                    ]}
                />

                <InfoNoticeCard
                    title={`Follow up with ${formatUsername(pendingCheckInDraft.requesterName)}`}
                    description="Choose the date and time and the app will send a formatted check-in message for you."
                    style={styles.headerCard}
                />

                <Text style={styles.formLabel}>Choose date and time</Text>
                <View style={styles.datePickerCard}>
                    <View style={styles.dateTimeSummaryRow}>
                        <TouchableOpacity
                            style={styles.dateTimeSummaryCard}
                            onPress={() => setPendingCheckInDraft((current) => current ? { ...current, pickerMode: 'date' } : current)}
                        >
                            <Text style={styles.dateTimeSummaryLabel}>Date</Text>
                            <Text style={styles.dateTimeSummaryValue}>
                                {scheduledDate.toLocaleDateString([], {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.dateTimeSummaryCard}
                            onPress={() => setPendingCheckInDraft((current) => current ? { ...current, pickerMode: 'time' } : current)}
                        >
                            <Text style={styles.dateTimeSummaryLabel}>Time</Text>
                            <Text style={styles.dateTimeSummaryValue}>
                                {scheduledDate.toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                })}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {Platform.OS === 'ios' ? (
                        <View style={styles.inlinePickerWrap}>
                            <View style={styles.inlinePickerTabs}>
                                <TouchableOpacity
                                    style={[
                                        styles.inlinePickerTab,
                                        pendingCheckInDraft.pickerMode !== 'time' && styles.inlinePickerTabActive,
                                    ]}
                                    onPress={() => setPendingCheckInDraft((current) => current ? { ...current, pickerMode: 'date' } : current)}
                                >
                                    <Text
                                        style={[
                                            styles.inlinePickerTabText,
                                            pendingCheckInDraft.pickerMode !== 'time' && styles.inlinePickerTabTextActive,
                                        ]}
                                    >
                                        Date
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.inlinePickerTab,
                                        pendingCheckInDraft.pickerMode === 'time' && styles.inlinePickerTabActive,
                                    ]}
                                    onPress={() => setPendingCheckInDraft((current) => current ? { ...current, pickerMode: 'time' } : current)}
                                >
                                    <Text
                                        style={[
                                            styles.inlinePickerTabText,
                                            pendingCheckInDraft.pickerMode === 'time' && styles.inlinePickerTabTextActive,
                                        ]}
                                    >
                                        Time
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={scheduledDate}
                                mode={pendingCheckInDraft.pickerMode === 'time' ? 'time' : 'date'}
                                display="spinner"
                                minimumDate={pendingCheckInDraft.pickerMode === 'time' ? undefined : minimumCheckInDate}
                                minuteInterval={30}
                                onChange={handleCheckInPickerChange}
                            />
                        </View>
                    ) : pendingCheckInDraft.pickerMode ? (
                        <DateTimePicker
                            value={scheduledDate}
                            mode={pendingCheckInDraft.pickerMode}
                            display="default"
                            minimumDate={pendingCheckInDraft.pickerMode === 'date' ? minimumCheckInDate : undefined}
                            is24Hour={false}
                            onChange={handleCheckInPickerChange}
                        />
                    ) : null}
                </View>

                <Text style={styles.previewLabel}>They will see</Text>
                <Text style={styles.previewText}>
                    {buildCheckInLaterMessage(pendingCheckInDraft.scheduledFor)}
                </Text>

                <View style={styles.fullScreenActions}>
                    <TouchableOpacity style={styles.actionSecondary} onPress={closeCheckInLaterComposer}>
                        <Text style={styles.actionSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionPrimary, sendingCheckIn && styles.actionDisabled]}
                        onPress={submitCheckInLater}
                        disabled={sendingCheckIn}
                    >
                        <Text style={styles.actionPrimaryText}>
                            {sendingCheckIn ? 'Sending...' : 'Send check-in plan'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }

    const loading = surface === 'immediate'
        ? (openRequestsQuery.isLoading && requests.length === 0)
        : surface === 'community'
            ? (openRequestsQuery.isLoading && requests.length === 0)
            : surface === 'my_requests'
                ? (myRequestsQuery.isLoading && myRequests.length === 0)
                : false;

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    const primaryTabs = (
        <SegmentedControl
            activeKey={surface}
            onChange={(key) => setSurface(key as SupportSurface)}
            tone="primary"
            style={[screenStandards.tabControl, styles.supportTabs]}
            items={[
                { key: 'immediate', label: 'Immediate' },
                { key: 'community', label: 'Community' },
                { key: 'my_requests', label: 'My requests' },
                { key: 'create', label: 'Create' },
            ]}
        />
    );

    const renderManagedRequestCard = (request: api.SupportRequest) => (
        <SupportRequestCard
            key={request.id}
            request={request}
            responsePending={false}
            closingPending={closingIds.has(request.id)}
            responses={requestResponsesById[request.id]?.items}
            responsesExpanded={expandedResponseRequestIds.has(request.id)}
            responsesLoading={responseLoadingIds.has(request.id)}
            responsesLoadingMore={responseLoadingMoreIds.has(request.id)}
            responsesHasMore={requestResponsesById[request.id]?.hasMore ?? false}
            acceptingResponseId={responseAcceptingIds[request.id]}
            requestChatOpening={requestChatOpeningIds.has(request.id)}
            onRespond={handleRespond}
            onOpenCheckInLaterComposer={openCheckInLaterComposer}
            onClose={handleClose}
            onToggleResponses={toggleResponses}
            onAcceptResponse={(managedRequest, response) => void handleAcceptResponse(managedRequest, response)}
            onLoadMoreResponses={(managedRequest) => handleLoadMoreResponses(managedRequest)}
            onOpenRequestChat={(value) => void handleOpenRequestChat(value)}
            onPressUser={() => onOpenUserProfile({
                userId: request.requester_id,
                username: request.username,
                avatarUrl: request.avatar_url ?? undefined,
            })}
        />
    );

    const renderCommunityRequestCard = (request: api.SupportRequest) => (
        <SupportRequestCard
            key={request.id}
            request={request}
            responsePending={responsePendingIds.has(request.id)}
            closingPending={false}
            onRespond={handleRespond}
            onOpenCheckInLaterComposer={openCheckInLaterComposer}
            onClose={handleClose}
            onPressUser={() => onOpenUserProfile({
                userId: request.requester_id,
                username: request.username,
                avatarUrl: request.avatar_url ?? undefined,
            })}
        />
    );

    const renderStatsRow = (stats: SupportStatCard[]) => (
        <View style={styles.statsRow}>
            {stats.map((stat) => (
                <View key={stat.key} style={styles.statCard}>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
            ))}
        </View>
    );

    if (surface === 'create') {
        return (
            <View style={styles.container}>
                {primaryTabs}
                <ScrollView contentContainerStyle={[screenStandards.detailContent, screenStandards.scrollContent]}>
                    <InfoNoticeCard
                        title={requestChannel === 'immediate' ? 'Request immediate support' : 'Ask the community for support'}
                        description={requestChannel === 'immediate'
                            ? 'Immediate requests appear in the urgent support lane so the community can respond quickly.'
                            : 'Community requests stay on the wider support board for asynchronous replies.'}
                        style={styles.headerCard}
                    />

                    <Text style={styles.formLabel}>What type of support do you need?</Text>
                    <View style={[styles.selectorWrap, styles.channelSelectorWrap]}>
                        {(['community', 'immediate'] as SupportRequestChannel[]).map((channel) => (
                            <TouchableOpacity
                                key={channel}
                                style={[styles.selectorChip, requestChannel === channel && styles.selectorChipActive]}
                                onPress={() => handleRequestChannelChange(channel)}
                            >
                                <Text style={[styles.selectorChipText, requestChannel === channel && styles.selectorChipTextActive]}>
                                    {channel === 'community' ? 'Community' : 'Immediate'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.formLabel}>What kind of help do you need?</Text>
                    <View style={styles.selectorWrap}>
                        {(Object.keys(SUPPORT_TYPE_LABELS) as SupportType[]).map(type => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.selectorChip, form.type === type && styles.selectorChipActive]}
                                onPress={() => setForm(prev => ({ ...prev, type }))}
                            >
                                <Text style={[styles.selectorChipText, form.type === type && styles.selectorChipTextActive]}>
                                    {SUPPORT_TYPE_LABELS[type]}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TextField
                        style={[styles.formInput, styles.inputMultiline]}
                        value={form.message}
                        onChangeText={message => setForm(prev => ({ ...prev, message }))}
                        placeholder="Optional note"
                        multiline
                    />

                    {requestChannel === 'immediate' ? (
                        <>
                            <Text style={styles.formLabel}>How urgent is this?</Text>
                            <View style={styles.selectorWrap}>
                                <View style={[styles.selectorChip, styles.selectorChipActive]}>
                                    <Text style={[styles.selectorChipText, styles.selectorChipTextActive]}>
                                        Right now
                                    </Text>
                                </View>
                            </View>
                        </>
                    ) : (
                        <>
                            <Text style={styles.formLabel}>How urgent is this?</Text>
                            <View style={styles.selectorWrap}>
                                {createUrgencyOptions.map(option => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[styles.selectorChip, form.urgency === option.value && styles.selectorChipActive]}
                                        onPress={() => setForm(prev => ({ ...prev, urgency: option.value }))}
                                    >
                                        <Text style={[styles.selectorChipText, form.urgency === option.value && styles.selectorChipTextActive]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    )}

                    <PrimaryButton
                        label={submitting
                            ? 'Posting...'
                            : requestChannel === 'immediate'
                                ? 'Request immediate support'
                                : 'Post general request'}
                        onPress={() => void handleCreate()}
                        disabled={submitting}
                        variant="success"
                        style={styles.submitButton}
                    />
                </ScrollView>
            </View>
        );
    }

    if (surface === 'immediate') {
        return (
            <View style={styles.container}>
                {primaryTabs}
                <ScrollView
                    contentContainerStyle={[screenStandards.detailContent, screenStandards.scrollContent]}
                    onScroll={supportScrollToTop.onScroll}
                    scrollEventThrottle={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={openRequestsQuery.isRefetching && !openRequestsQuery.isFetchingNextPage}
                            onRefresh={refreshOpen}
                            tintColor={Colors.primary}
                        />
                    }
                >
                    <InfoNoticeCard
                        title="Open immediate support"
                        description="This is the urgent support queue. Respond only if you can genuinely show up right now."
                        style={styles.headerCard}
                    />
                    {requests.length === 0 ? (
                        <>
                            {renderStatsRow(openRequestStats)}
                            <EmptyState
                                title="No open immediate requests right now."
                                description="Check back later for urgent requests from the community."
                            />
                        </>
                    ) : (
                        <>
                            {renderStatsRow(openRequestStats)}
                            {requests.map(renderCommunityRequestCard)}
                        </>
                    )}
                </ScrollView>
            </View>
        );
    }

    if (surface === 'my_requests') {
        const visibleRequests = myRequestsScope === 'open'
            ? myOpenRequests
            : myRequestsScope === 'active'
                ? myActiveRequests
                : myCompletedRequests;

        return (
            <View style={styles.container}>
                {primaryTabs}
                <FlatList<api.SupportRequest>
                    ref={flatListRef}
                    data={visibleRequests}
                    keyExtractor={(item) => item.id}
                    {...supportListProps}
                    onEndReached={supportListPagination.onEndReached}
                    onEndReachedThreshold={0.4}
                    onMomentumScrollBegin={supportListPagination.onMomentumScrollBegin}
                    onScrollBeginDrag={supportListPagination.onScrollBeginDrag}
                    onScroll={supportScrollToTop.onScroll}
                    scrollEventThrottle={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={myRequestsQuery.isRefetching && !myRequestsQuery.isFetchingNextPage}
                            onRefresh={refreshMine}
                            tintColor={Colors.primary}
                        />
                    }
                    contentContainerStyle={screenStandards.listContent}
                    ListHeaderComponent={
                        <>
                            <InfoNoticeCard
                                title={myRequestsScope === 'open'
                                    ? 'Open requests you are still waiting on'
                                    : myRequestsScope === 'active'
                                        ? 'Accepted support that is currently in progress'
                                        : 'Requests you have already completed'}
                                description={myRequestsScope === 'open'
                                    ? 'Immediate and general requests stay together here so you always know what still needs responses.'
                                    : myRequestsScope === 'active'
                                        ? 'Once you accept a response, the request moves here until you complete it.'
                                        : 'Completed requests from both support lanes stay here for later reference.'}
                                style={styles.headerCard}
                            />
                            {myRequestsScope === 'open'
                                ? renderStatsRow(myOpenStats)
                                : myRequestsScope === 'active'
                                    ? renderStatsRow(myActiveStats)
                                    : renderStatsRow(myCompletedStats)}
                            <SegmentedControl
                                activeKey={myRequestsScope}
                                onChange={(key) => setMyRequestsScope(key as SupportScope)}
                                tone="secondary"
                                style={styles.nestedTabs}
                                items={[
                                    { key: 'open', label: 'Open' },
                                    { key: 'active', label: 'Active' },
                                    { key: 'completed', label: 'Completed' },
                                ]}
                            />
                        </>
                    }
                    ListEmptyComponent={
                        <EmptyState
                            title={myRequestsScope === 'open'
                                ? 'No open requests.'
                                : myRequestsScope === 'active'
                                    ? 'No active requests.'
                                    : 'No completed requests yet.'}
                            description={myRequestsScope === 'open'
                                ? 'Create an immediate or general request when you need support.'
                                : myRequestsScope === 'active'
                                    ? 'Accepted support requests will appear here while they are still active.'
                                    : 'Closed requests will appear here once you have completed them.'}
                        />
                    }
                    ListFooterComponent={myRequestsQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                    renderItem={({ item }) => renderManagedRequestCard(item)}
                />
                {isActive && supportScrollToTop.isVisible ? (
                    <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
                ) : null}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {primaryTabs}
            <FlatList<api.SupportRequest>
                ref={flatListRef}
                data={requests}
                keyExtractor={item => item.id}
                {...supportListProps}
                onEndReached={supportListPagination.onEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={supportListPagination.onMomentumScrollBegin}
                onScrollBeginDrag={supportListPagination.onScrollBeginDrag}
                onScroll={supportScrollToTop.onScroll}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={openRequestsQuery.isRefetching && !openRequestsQuery.isFetchingNextPage}
                        onRefresh={refreshOpen}
                        tintColor={Colors.primary}
                    />
                }
                contentContainerStyle={screenStandards.listContent}
                ListHeaderComponent={
                    <>
                        <InfoNoticeCard
                            title="Open community support requests"
                            description="This is the asynchronous support queue. Respond only when you can genuinely show up for someone."
                            style={styles.headerCard}
                        />
                        {renderStatsRow(openRequestStats)}
                    </>
                }
                ListEmptyComponent={
                    <EmptyState
                        title="No open community requests right now."
                        description="Check back later for new support requests from the community."
                    />
                }
                ListFooterComponent={
                    openRequestsQuery.isFetchingNextPage
                        ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} />
                        : null
                }
                renderItem={({ item }) => renderCommunityRequestCard(item)}
            />
            {isActive && supportScrollToTop.isVisible ? (
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
    screenNote: { marginBottom: Spacing.md },
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    statCard: {
        flex: 1,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
        padding: Spacing.md,
    },
    statValue: {
        fontSize: Typography.sizes.xl,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    statLabel: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
        marginTop: 4,
    },
    availabilityCard: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    availabilityHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    availabilityBody: { flex: 1 },
    availabilityTitle: { fontSize: Typography.sizes.md, fontWeight: '600', color: Colors.text.primary, marginBottom: 4 },
    availabilityText: { fontSize: Typography.sizes.sm, color: Colors.text.secondary, lineHeight: 19 },
    availabilityFootnote: {
        marginTop: Spacing.sm,
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    availabilityToggle: {
        minWidth: 72,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: Colors.bg.page,
    },
    availabilityToggleActive: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    availabilityToggleText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    availabilityToggleTextActive: {
        color: Colors.textOn.primary,
    },
    formLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
        marginBottom: Spacing.sm,
        marginTop: Spacing.md,
    },
    selectorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    channelSelectorWrap: { marginBottom: Spacing.sm },
    selectorChip: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
        backgroundColor: Colors.bg.surface,
    },
    selectorChipActive: { backgroundColor: Colors.success, borderColor: Colors.success },
    selectorChipText: { fontSize: Typography.sizes.sm, color: Colors.text.secondary },
    selectorChipTextActive: { color: Colors.textOn.primary, fontWeight: '600' },
    datePickerCard: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.sm,
        overflow: 'hidden',
    },
    dateTimeSummaryRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    dateTimeSummaryCard: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.page,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    dateTimeSummaryLabel: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
        marginBottom: 4,
    },
    dateTimeSummaryValue: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    inlinePickerWrap: {
        marginTop: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.page,
        overflow: 'hidden',
    },
    inlinePickerTabs: {
        flexDirection: 'row',
        padding: Spacing.xs,
        gap: Spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    inlinePickerTab: {
        flex: 1,
        borderRadius: Radius.pill,
        paddingVertical: 8,
        alignItems: 'center',
    },
    inlinePickerTabActive: {
        backgroundColor: Colors.primary,
    },
    inlinePickerTabText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    inlinePickerTabTextActive: {
        color: Colors.textOn.primary,
    },
    formInput: { marginTop: Spacing.md },
    inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
    submitButton: { marginTop: Spacing.lg },
    card: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    cardHeadBody: { flex: 1 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    cardTitleBadges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
    cardName: { fontSize: Typography.sizes.md, fontWeight: '600', color: Colors.text.primary },
    badge: { backgroundColor: Colors.successSubtle, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: Typography.sizes.xs, fontWeight: '700', color: Colors.success },
    urgencyBadgeUrgent: {
        borderRadius: Radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(220,38,38,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(220,38,38,0.25)',
    },
    urgencyBadgeUrgentText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.danger,
    },
    urgencyBadgeSoon: {
        borderRadius: Radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,193,7,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,193,7,0.28)',
    },
    urgencyBadgeSoonText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.warning,
    },
    urgencyBadgeWhenever: {
        borderRadius: Radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(120,120,128,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(120,120,128,0.25)',
    },
    urgencyBadgeWheneverText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.secondary,
    },
    cardMeta: { fontSize: Typography.sizes.sm, color: Colors.text.muted, marginTop: 4 },
    cardBody: { fontSize: Typography.sizes.base, lineHeight: 19, color: Colors.text.secondary, marginTop: Spacing.md },
    cardFooterText: { fontSize: Typography.sizes.sm, color: Colors.text.muted, marginTop: Spacing.md },
    responseSummaryText: { fontSize: Typography.sizes.sm, color: Colors.primary, marginTop: Spacing.sm, fontWeight: '500' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    actionPrimary: { backgroundColor: Colors.success, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 10 },
    actionPrimaryText: { color: Colors.textOn.primary, fontSize: Typography.sizes.sm, fontWeight: '600' },
    actionSecondary: {
        backgroundColor: Colors.bg.page,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: Colors.border.default,
    },
    actionSecondaryText: { color: Colors.text.secondary, fontSize: Typography.sizes.sm, fontWeight: '600' },
    responsesSection: {
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border.default,
        gap: Spacing.sm,
    },
    responseRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        backgroundColor: Colors.bg.page,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        padding: Spacing.sm,
    },
    responseBody: { flex: 1 },
    responseName: { fontSize: Typography.sizes.sm, fontWeight: '600', color: Colors.text.primary },
    responseMeta: { fontSize: Typography.sizes.sm, color: Colors.text.muted, marginTop: 2 },
    responseMessage: { fontSize: Typography.sizes.sm, color: Colors.text.secondary, lineHeight: 18, marginTop: 6 },
    responseChatButton: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
    },
    responseChatButtonText: { color: Colors.textOn.primary, fontSize: Typography.sizes.sm, fontWeight: '600' },
    responseAcceptedBadge: {
        backgroundColor: Colors.successSubtle,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
    },
    responseAcceptedBadgeText: {
        color: Colors.success,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    responseMutedBadge: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: Colors.border.default,
    },
    responseMutedBadgeText: {
        color: Colors.text.muted,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    responsesEmptyText: { fontSize: Typography.sizes.sm, color: Colors.text.muted },
    responsesLoadMoreButton: {
        alignSelf: 'flex-start',
        paddingVertical: Spacing.xs,
    },
    responsesLoadMoreText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    checkInInput: { minHeight: 92 },
    previewLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
        marginTop: Spacing.md,
    },
    previewText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.primary,
        lineHeight: 19,
        marginTop: Spacing.xs,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        padding: Spacing.md,
    },
    fullScreenActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
        marginTop: Spacing.lg,
    },
    actionDisabled: { opacity: 0.6 },
    footerLoader: { paddingVertical: Spacing.md },
});
