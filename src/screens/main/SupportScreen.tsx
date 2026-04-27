import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
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
    useRespondedSupportRequests,
    useSupportHome,
    useSupportQueue,
    useSupportRequests,
    useSupportResponderProfile,
    useSupportSessions,
} from '../../hooks/queries/useSupport';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { dedupeById } from '../../utils/list';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';
import { screenStandards } from '../../styles/screenStandards';

type SupportType = api.SupportRequest['type'];
type SupportUrgency = api.SupportRequest['urgency'];
type SupportResponseType = api.SupportResponse['response_type'];
type SupportSurface = 'immediate' | 'community' | 'my_requests' | 'create';
type SupportScope = 'open' | 'completed';
type SupportRequestChannel = 'immediate' | 'community';

interface PendingCheckInDraft {
    requestId: string;
    requesterName: string;
    scheduledFor: string;
    pickerMode: 'date' | 'time' | null;
}

interface SupportScreenProps {
    isActive: boolean;
    onOpenChat: (chat: api.Chat) => void;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

interface SupportRequestCardProps {
    request: api.SupportRequest;
    isAvailableToSupport: boolean;
    responsePending: boolean;
    closingPending: boolean;
    responses?: api.SupportResponse[];
    responsesExpanded?: boolean;
    responsesLoading?: boolean;
    responseChatPendingId?: string;
    onRespond: (request: api.SupportRequest, responseType: SupportResponseType) => void;
    onOpenCheckInLaterComposer?: (request: api.SupportRequest) => void;
    onClose: (request: api.SupportRequest) => void;
    onToggleResponses?: (request: api.SupportRequest) => void;
    onOpenResponseChat?: (request: api.SupportRequest, response: api.SupportResponse) => void;
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

function buildSupportChatContext(
    request: api.SupportRequest,
    responseType?: SupportResponseType,
): api.SupportChatContext {
    return {
        support_request_id: request.id,
        request_type: request.type,
        request_message: request.message,
        requester_id: request.requester_id,
        requester_username: request.username,
        responder_mode: responseType,
    };
}

function haveSameRequestIds(left: api.SupportRequest[], right: api.SupportRequest[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((item, index) => item.id === right[index]?.id);
}

function formatRoutingStatus(request?: api.SupportRequest | null): string {
    if (!request) return 'No active request';

    if (request.status === 'matched' || request.routing_status === 'matched') {
        return 'Matched with a supporter';
    }

    switch (request.routing_status) {
        case 'pending':
            return 'Finding supporters now';
        case 'offered':
            return 'Offers sent to supporters';
        case 'fallback':
            return 'No match yet, community fallback available';
        case 'closed':
            return 'Closed';
        default:
            return request.channel === 'immediate'
                ? 'Immediate support request is active'
                : 'Community support request is active';
    }
}

function formatRequestChannel(channel?: SupportRequestChannel): string {
    return channel === 'immediate' ? 'Immediate support' : 'Community support';
}

function getRequestChannel(request: Pick<api.SupportRequest, 'channel'>): SupportRequestChannel {
    return request.channel === 'immediate' ? 'immediate' : 'community';
}

function isOpenRequest(request: api.SupportRequest): boolean {
    return request.status === 'open' || request.status === 'matched';
}

function formatOfferExpiry(expiresAt: string): string {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expires now';
    const mins = Math.ceil(diffMs / 60000);
    if (mins <= 1) return 'Expires in under 1 minute';
    return `Expires in ${mins} minutes`;
}

interface SupportOfferCardProps {
    offer: api.SupportOffer;
    accepting: boolean;
    declining: boolean;
    onAccept: (offer: api.SupportOffer) => void;
    onDecline: (offer: api.SupportOffer) => void;
    onPressUser: () => void;
}

function SupportOfferCard({
    offer,
    accepting,
    declining,
    onAccept,
    onDecline,
    onPressUser,
}: SupportOfferCardProps) {
    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <TouchableOpacity onPress={onPressUser}>
                    <Avatar username={offer.requester_username} avatarUrl={offer.requester_avatar_url ?? undefined} size={44} />
                </TouchableOpacity>
                <View style={styles.cardHeadBody}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.cardName}>{formatUsername(offer.requester_username)}</Text>
                        <View style={styles.cardTitleBadges}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{formatRequestChannel(offer.request_channel)}</Text>
                            </View>
                            {offer.request_urgency === 'right_now' ? (
                                <View style={styles.urgencyBadgeUrgent}>
                                    <Text style={styles.urgencyBadgeUrgentText}>Right now</Text>
                                </View>
                            ) : offer.request_urgency === 'soon' ? (
                                <View style={styles.urgencyBadgeSoon}>
                                    <Text style={styles.urgencyBadgeSoonText}>Soon</Text>
                                </View>
                            ) : (
                                <View style={styles.urgencyBadgeWhenever}>
                                    <Text style={styles.urgencyBadgeWheneverText}>Whenever</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <Text style={styles.cardMeta}>
                        {SUPPORT_TYPE_LABELS[offer.request_type]} · {formatOfferExpiry(offer.expires_at)}
                    </Text>
                </View>
            </View>
            {offer.request_message ? (
                <Text style={styles.cardBody}>{offer.request_message}</Text>
            ) : null}
            {offer.fit_summary ? (
                <Text style={styles.responseSummaryText}>{offer.fit_summary}</Text>
            ) : null}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.actionSecondary, declining && styles.actionDisabled]}
                    onPress={() => onDecline(offer)}
                    disabled={accepting || declining}
                >
                    <Text style={styles.actionSecondaryText}>
                        {declining ? 'Declining...' : 'Pass'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionPrimary, accepting && styles.actionDisabled]}
                    onPress={() => onAccept(offer)}
                    disabled={accepting || declining}
                >
                    <Text style={styles.actionPrimaryText}>
                        {accepting ? 'Connecting...' : 'Accept support'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

interface SupportSessionCardProps {
    session: api.SupportSession;
    currentUserId?: string;
    opening: boolean;
    closing?: boolean;
    onOpenChat: (session: api.SupportSession) => void;
    onCloseSession?: (session: api.SupportSession) => void;
}

function SupportSessionCard({ session, currentUserId, opening, closing = false, onOpenChat, onCloseSession }: SupportSessionCardProps) {
    const otherUsername = session.requester_id === currentUserId ? session.responder_username : session.requester_username;
    const statusText = session.status === 'active'
        ? 'Active session'
        : session.status === 'pending'
        ? 'Pending session'
        : session.status === 'completed'
        ? 'Completed'
        : 'Cancelled';

    return (
        <View style={styles.sessionCard}>
            <View style={styles.sessionCardBody}>
                <Text style={styles.sessionCardTitle}>{formatUsername(otherUsername)}</Text>
                <Text style={styles.sessionCardMeta}>{statusText} · {timeAgo(session.created_at)}</Text>
            </View>
            <View style={styles.sessionCardActions}>
                <TouchableOpacity
                    style={[styles.sessionCardAction, (opening || !session.chat_id) && styles.actionDisabled]}
                    onPress={() => onOpenChat(session)}
                    disabled={opening || !session.chat_id}
                >
                    <Text style={styles.sessionCardActionText}>
                        {opening ? 'Opening...' : 'Open chat'}
                    </Text>
                </TouchableOpacity>
                {session.status === 'active' && onCloseSession ? (
                    <TouchableOpacity
                        style={[styles.sessionCardSecondaryAction, closing && styles.actionDisabled]}
                        onPress={() => onCloseSession(session)}
                        disabled={closing}
                    >
                        <Text style={styles.sessionCardSecondaryActionText}>
                            {closing ? 'Saving...' : 'Complete'}
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

function SupportRequestCard({
    request,
    isAvailableToSupport,
    responsePending,
    closingPending,
    responses,
    responsesExpanded = false,
    responsesLoading = false,
    responseChatPendingId,
    onRespond,
    onOpenCheckInLaterComposer,
    onClose,
    onToggleResponses,
    onOpenResponseChat,
    onPressUser,
}: SupportRequestCardProps) {
    const isClosed = request.status === 'closed';
    const responseSummary = getSupportResponseSummary(responses);
    const canRespond = isAvailableToSupport && !responsePending && !request.has_responded && !isClosed;
    const requestChannel = getRequestChannel(request);
    const statusSummary = request.is_own_request && requestChannel === 'immediate' && !isClosed
        ? formatRoutingStatus(request)
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

            {request.is_own_request ? (
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
                                {onOpenResponseChat ? (
                                    <TouchableOpacity
                                        style={[
                                            styles.responseChatButton,
                                            responseChatPendingId === response.id && styles.actionDisabled,
                                        ]}
                                        onPress={() => onOpenResponseChat(request, response)}
                                        disabled={responseChatPendingId === response.id}
                                    >
                                        <Text style={styles.responseChatButtonText}>
                                            {responseChatPendingId === response.id ? 'Opening...' : 'Open chat'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ))
                    ) : (
                        <Text style={styles.responsesEmptyText}>No responses yet.</Text>
                    )}
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
    const [immediateScope, setImmediateScope] = useState<SupportScope>('open');
    const [communityScope, setCommunityScope] = useState<SupportScope>('open');
    const [myRequestsScope, setMyRequestsScope] = useState<SupportScope>('open');
    const [requestChannel, setRequestChannel] = useState<SupportRequestChannel>('immediate');
    const [requests, setRequests] = useState<api.SupportRequest[]>([]);
    const [myRequests, setMyRequests] = useState<api.SupportRequest[]>([]);
    const [requestResponsesById, setRequestResponsesById] = useState<Record<string, api.SupportResponse[]>>({});
    const [expandedResponseRequestIds, setExpandedResponseRequestIds] = useState<Set<string>>(new Set());
    const [responseLoadingIds, setResponseLoadingIds] = useState<Set<string>>(new Set());
    const [responseChatPendingIds, setResponseChatPendingIds] = useState<Record<string, string | undefined>>({});
    const [offerAcceptingIds, setOfferAcceptingIds] = useState<Set<string>>(new Set());
    const [offerDecliningIds, setOfferDecliningIds] = useState<Set<string>>(new Set());
    const [sessionChatOpeningIds, setSessionChatOpeningIds] = useState<Set<string>>(new Set());
    const [sessionClosingIds, setSessionClosingIds] = useState<Set<string>>(new Set());
    const [openRequestCount, setOpenRequestCount] = useState(0);
    const [openHasMore, setOpenHasMore] = useState(false);
    const [myHasMore, setMyHasMore] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [availabilityUpdating, setAvailabilityUpdating] = useState(false);
    const [responsePendingIds, setResponsePendingIds] = useState<Set<string>>(new Set());
    const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
    const [pendingCheckInDraft, setPendingCheckInDraft] = useState<PendingCheckInDraft | null>(null);
    const [form, setForm] = useState({
        type: 'need_to_talk' as SupportType,
        message: '',
        urgency: 'when_you_can' as SupportUrgency,
    });
    const supportHomeQuery = useSupportHome(hasActivatedOpen);
    const responderProfileQuery = useSupportResponderProfile(hasActivatedOpen);
    const supportListProps = getListPerformanceProps('detailList');
    const openRequestsQuery = useSupportRequests(20, hasActivatedOpen);
    const myRequestsQuery = useMySupportRequests(20, hasActivatedOpen);
    const respondedRequestsQuery = useRespondedSupportRequests(20, hasActivatedOpen);
    const supportQueueQuery = useSupportQueue(20, hasActivatedOpen);
    const supportSessionsQuery = useSupportSessions(20, hasActivatedOpen);
    useRefetchOnActiveIfStale(isActive, supportHomeQuery);
    useRefetchOnActiveIfStale(isActive, responderProfileQuery);
    useRefetchOnActiveIfStale(isActive && surface === 'community', openRequestsQuery);
    useRefetchOnActiveIfStale(isActive && (surface === 'immediate' || surface === 'my_requests'), myRequestsQuery);
    useRefetchOnActiveIfStale(isActive && surface === 'community' && communityScope === 'completed', respondedRequestsQuery);
    useRefetchOnActiveIfStale(isActive && surface === 'immediate', supportQueueQuery);
    useRefetchOnActiveIfStale(isActive, supportSessionsQuery);
    const supportScrollToTop = useScrollToTopButton({ threshold: 320 });
    const openRequestItems = useMemo(
        () => dedupeById(openRequestsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [openRequestsQuery.data],
    );
    const myRequestItems = useMemo(
        () => dedupeById(myRequestsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [myRequestsQuery.data],
    );
    const respondedRequestItems = useMemo(
        () => dedupeById(respondedRequestsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [respondedRequestsQuery.data],
    );
    const supportQueueItems = useMemo(
        () => dedupeById(supportQueueQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [supportQueueQuery.data],
    );
    const supportSessionItems = useMemo(
        () => dedupeById(supportSessionsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [supportSessionsQuery.data],
    );
    useEffect(() => {
        setRequests((current) => haveSameRequestIds(current, openRequestItems) ? current : openRequestItems);
        setOpenHasMore((current) => {
            const next = openRequestsQuery.hasNextPage ?? false;
            return current === next ? current : next;
        });
        setOpenRequestCount((current) => {
            const next = openRequestsQuery.data?.pages[0]?.open_request_count ?? 0;
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

    const activeRequest = supportHomeQuery.data?.active_request ?? null;
    const responderProfile = responderProfileQuery.data ?? null;
    const activeSupportSessions = useMemo(
        () => supportSessionItems.filter((session) => session.status === 'active' || session.status === 'pending'),
        [supportSessionItems],
    );
    const completedSupportSessions = useMemo(
        () => supportSessionItems.filter((session) => session.status === 'completed' || session.status === 'cancelled'),
        [supportSessionItems],
    );
    const myOpenRequests = useMemo(
        () => myRequests
            .filter((request) => isOpenRequest(request))
            .slice()
            .sort((left, right) => {
                const leftChannel = getRequestChannel(left);
                const rightChannel = getRequestChannel(right);
                const leftImmediateRank = leftChannel === 'immediate'
                    ? left.status === 'matched' || left.routing_status === 'matched'
                        ? 0
                        : 1
                    : 2;
                const rightImmediateRank = rightChannel === 'immediate'
                    ? right.status === 'matched' || right.routing_status === 'matched'
                        ? 0
                        : 1
                    : 2;
                if (leftImmediateRank !== rightImmediateRank) {
                    return leftImmediateRank - rightImmediateRank;
                }
                return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
            }),
        [myRequests],
    );
    const myCompletedRequests = useMemo(
        () => myRequests.filter((request) => request.status === 'closed'),
        [myRequests],
    );
    const immediateOpenRequests = useMemo(() => {
        const base = myOpenRequests.filter((request) => getRequestChannel(request) === 'immediate');
        if (activeRequest && getRequestChannel(activeRequest) === 'immediate' && !base.some((request) => request.id === activeRequest.id)) {
            return [activeRequest, ...base];
        }
        return base;
    }, [activeRequest, myOpenRequests]);
    const immediateClosedRequests = useMemo(
        () => myCompletedRequests.filter((request) => getRequestChannel(request) === 'immediate'),
        [myCompletedRequests],
    );
    const communityOpenRequests = useMemo(
        () => requests.filter((request) => getRequestChannel(request) === 'community'),
        [requests],
    );
    const communityCompletedResponded = useMemo(
        () => respondedRequestItems.filter((request) => getRequestChannel(request) === 'community'),
        [respondedRequestItems],
    );

    const refreshOpen = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.supportRequests({ scope: 'open', limit: 20 }));
        await openRequestsQuery.refetch();
    };

    const refreshMine = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.supportRequests({ scope: 'mine', limit: 20 }));
        await myRequestsQuery.refetch();
    };

    const refreshResponded = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.supportRequests({ scope: 'responded', limit: 20 }));
        await respondedRequestsQuery.refetch();
    };

    const refreshSupportPlatform = async () => {
        await Promise.all([
            supportHomeQuery.refetch(),
            responderProfileQuery.refetch(),
            supportQueueQuery.refetch(),
            supportSessionsQuery.refetch(),
            myRequestsQuery.refetch(),
        ]);
    };

    const saveResponderProfile = useCallback(async (overrides: Partial<{
        is_available_for_immediate: boolean;
        is_available_for_community: boolean;
        supports_chat: boolean;
        supports_check_ins: boolean;
        supports_in_person: boolean;
        max_concurrent_sessions: number;
        languages: string[];
        available_now: boolean;
        is_active: boolean;
    }>) => {
        const baseline = responderProfile ?? {
            is_available_for_immediate: false,
            is_available_for_community: true,
            supports_chat: true,
            supports_check_ins: true,
            supports_in_person: false,
            max_concurrent_sessions: 2,
            languages: [] as string[],
            available_now: false,
            is_active: false,
        };

        const updated = await api.updateMySupportResponderProfile({
            is_available_for_immediate: overrides.is_available_for_immediate ?? baseline.is_available_for_immediate,
            is_available_for_community: overrides.is_available_for_community ?? baseline.is_available_for_community,
            supports_chat: overrides.supports_chat ?? baseline.supports_chat,
            supports_check_ins: overrides.supports_check_ins ?? baseline.supports_check_ins,
            supports_in_person: overrides.supports_in_person ?? baseline.supports_in_person,
            max_concurrent_sessions: overrides.max_concurrent_sessions ?? baseline.max_concurrent_sessions,
            languages: overrides.languages ?? baseline.languages,
            available_now: overrides.available_now ?? baseline.available_now,
            is_active: overrides.is_active ?? baseline.is_active,
        });

        queryClient.setQueryData(queryKeys.supportResponderProfile(), updated);
        queryClient.setQueryData(queryKeys.supportProfile(), {
            is_available_to_support: updated.is_available_for_immediate || updated.is_available_for_community,
            support_updated_at: updated.updated_at,
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.supportHome() });
        return updated;
    }, [queryClient, responderProfile]);

    const openSupportChat = useCallback(async (
        memberId: string,
        username: string,
        avatarUrl: string | undefined,
        supportContext: api.SupportChatContext,
        existingChat?: api.Chat,
    ) => {
        if (existingChat) {
            onOpenChat({
                ...existingChat,
                username: existingChat.username ?? username,
                avatar_url: existingChat.avatar_url ?? avatarUrl,
                support_context: {
                    ...supportContext,
                    ...existingChat.support_context,
                },
            });
            return;
        }

        const chat = await api.createChat([memberId]);
        onOpenChat({
            id: chat.id,
            is_group: false,
            username,
            avatar_url: avatarUrl,
            created_at: new Date().toISOString(),
            support_context: supportContext,
        });
    }, [onOpenChat]);

    const openChat = useCallback(async (
        request: api.SupportRequest,
        responseType?: SupportResponseType,
        existingChat?: api.Chat,
    ) => {
        try {
            await openSupportChat(
                request.requester_id,
                request.username,
                request.avatar_url ?? undefined,
                buildSupportChatContext(request, responseType),
                existingChat,
            );
        } catch (e: unknown) {
            Alert.alert('Could not open chat', e instanceof Error ? e.message : 'Something went wrong.');
        }
    }, [openSupportChat]);

    const loadResponses = useCallback(async (requestId: string) => {
        setResponseLoadingIds(prev => new Set(prev).add(requestId));
        try {
            const responses = await api.getSupportRequestResponses(requestId);
            setRequestResponsesById(prev => ({ ...prev, [requestId]: responses }));
        } catch (e: unknown) {
            Alert.alert('Could not load responses', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setResponseLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(requestId);
                return next;
            });
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
            void loadResponses(request.id);
        }
    }, [loadResponses, requestResponsesById]);

    const handleOpenResponseChat = useCallback(async (
        request: api.SupportRequest,
        response: api.SupportResponse,
    ) => {
        setResponseChatPendingIds(prev => ({ ...prev, [request.id]: response.id }));
        try {
            const existingChat = response.chat_id ? {
                id: response.chat_id,
                is_group: false,
                username: response.username,
                avatar_url: response.avatar_url ?? undefined,
                created_at: response.created_at,
                support_context: buildSupportChatContext(request, response.response_type),
            } satisfies api.Chat : undefined;

            await openSupportChat(
                response.responder_id,
                response.username,
                response.avatar_url ?? undefined,
                buildSupportChatContext(request, response.response_type),
                existingChat,
            );
        } catch (e: unknown) {
            Alert.alert('Could not open chat', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setResponseChatPendingIds(prev => ({ ...prev, [request.id]: undefined }));
        }
    }, [openSupportChat]);

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

            const result = await api.createSupportResponse(request.id, {
                response_type: responseType,
                scheduled_for: scheduledFor,
                message: responseMessage,
            });
            setRequests(prev => prev.map(item => item.id === request.id ? {
                ...item,
                has_responded: true,
                response_count: item.response_count + 1,
            } : item));

            if (responseType === 'can_chat') {
                await openChat(request, responseType, result.chat);
            } else {
                Alert.alert('Response sent', `${SUPPORT_RESPONSE_LABELS[responseType]} has been shared with ${formatUsername(request.username)}.`);
            }

            if (responseType === 'check_in_later') {
                setPendingCheckInDraft(null);
            }
            void queryClient.invalidateQueries({ queryKey: ['support-requests'] });
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
            await api.updateSupportRequest(request.id, { status: 'closed' });
            setMyRequests(prev => prev.map(item => item.id === request.id ? {
                ...item,
                status: 'closed',
                routing_status: 'closed',
            } : item));
            setExpandedResponseRequestIds(prev => {
                const next = new Set(prev);
                next.delete(request.id);
                return next;
            });
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportHome() }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportSessions({ limit: 20 }) }),
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
                priority_visibility: false,
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
                queryClient.invalidateQueries({ queryKey: queryKeys.supportHome() }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportQueue({ limit: 20 }) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportSessions({ limit: 20 }) }),
            ]);
        } catch (e: unknown) {
            Alert.alert('Could not create support request', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleImmediateAvailability = async () => {
        setAvailabilityUpdating(true);
        try {
            const next = !(responderProfile?.is_available_for_immediate ?? false);
            await saveResponderProfile({
                is_available_for_immediate: next,
                available_now: next,
                is_active: next,
            });
        } catch (e: unknown) {
            Alert.alert('Could not update immediate support availability', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setAvailabilityUpdating(false);
        }
    };

    const handleAcceptOffer = useCallback(async (offer: api.SupportOffer) => {
        setOfferAcceptingIds(prev => new Set(prev).add(offer.id));
        try {
            const session = await api.acceptSupportOffer(offer.id);
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.supportHome() }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportQueue({ limit: 20 }) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportSessions({ limit: 20 }) }),
                queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
            ]);
            if (session.chat_id) {
                const chat = await api.getChat(session.chat_id);
                onOpenChat(chat);
            } else {
                Alert.alert('Offer accepted', 'Support session is active.');
            }
        } catch (e: unknown) {
            Alert.alert('Could not accept support offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setOfferAcceptingIds(prev => {
                const next = new Set(prev);
                next.delete(offer.id);
                return next;
            });
        }
    }, [onOpenChat, queryClient]);

    const handleDeclineOffer = useCallback(async (offer: api.SupportOffer) => {
        setOfferDecliningIds(prev => new Set(prev).add(offer.id));
        try {
            await api.declineSupportOffer(offer.id);
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.supportHome() }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportQueue({ limit: 20 }) }),
            ]);
        } catch (e: unknown) {
            Alert.alert('Could not decline support offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setOfferDecliningIds(prev => {
                const next = new Set(prev);
                next.delete(offer.id);
                return next;
            });
        }
    }, [queryClient]);

    const handleOpenSessionChat = useCallback(async (session: api.SupportSession) => {
        if (!session.chat_id) return;
        setSessionChatOpeningIds(prev => new Set(prev).add(session.id));
        try {
            const chat = await api.getChat(session.chat_id);
            onOpenChat(chat);
        } catch (e: unknown) {
            Alert.alert('Could not open support chat', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSessionChatOpeningIds(prev => {
                const next = new Set(prev);
                next.delete(session.id);
                return next;
            });
        }
    }, [onOpenChat]);

    const handleCloseSession = useCallback(async (session: api.SupportSession) => {
        setSessionClosingIds(prev => new Set(prev).add(session.id));
        try {
            await api.closeSupportSession(session.id, 'completed');
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.supportHome() }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportSessions({ limit: 20 }) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportQueue({ limit: 20 }) }),
                queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
            ]);
        } catch (e: unknown) {
            Alert.alert('Could not complete support session', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSessionClosingIds(prev => {
                const next = new Set(prev);
                next.delete(session.id);
                return next;
            });
        }
    }, [queryClient]);

    const handleLoadMore = async () => {
        if (surface === 'create' || surface === 'immediate') return;
        if (surface === 'my_requests') {
            if (myRequestsQuery.isFetchingNextPage || myRequestsQuery.isRefetching || !myHasMore) return;
            await myRequestsQuery.fetchNextPage();
            return;
        }
        if (communityScope === 'completed') {
            if (respondedRequestsQuery.isFetchingNextPage || respondedRequestsQuery.isRefetching || !(respondedRequestsQuery.hasNextPage ?? false)) return;
            await respondedRequestsQuery.fetchNextPage();
            return;
        }
        if (openRequestsQuery.isFetchingNextPage || openRequestsQuery.isRefetching || !openHasMore) return;
        await openRequestsQuery.fetchNextPage();
    };
    const supportListPagination = useGuardedEndReached(handleLoadMore);

    const responderAvailabilityCard = (
        <View style={styles.availabilityCard}>
            <View style={styles.availabilityHeader}>
                <View style={styles.availabilityBody}>
                    <Text style={styles.availabilityTitle}>Available for immediate support</Text>
                    <Text style={styles.availabilityText}>
                        Turn this on to receive routed immediate support requests when someone needs help right now.
                    </Text>
                </View>
                <TouchableOpacity
                    style={[
                        styles.availabilityToggle,
                        responderProfile?.is_available_for_immediate && styles.availabilityToggleActive,
                        availabilityUpdating && styles.actionDisabled,
                    ]}
                    onPress={handleToggleImmediateAvailability}
                    disabled={availabilityUpdating}
                >
                    <Text style={[
                        styles.availabilityToggleText,
                        responderProfile?.is_available_for_immediate && styles.availabilityToggleTextActive,
                    ]}>
                        {availabilityUpdating ? 'Saving...' : responderProfile?.is_available_for_immediate ? 'On' : 'Off'}
                    </Text>
                </TouchableOpacity>
            </View>
            {responderProfile ? (
                <Text style={styles.availabilityFootnote}>
                    Active sessions {responderProfile.active_session_count}/{responderProfile.max_concurrent_sessions} ·
                    Acceptance {Math.round((responderProfile.acceptance_rate ?? 0) * 100)}%
                </Text>
            ) : null}
        </View>
    );

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
        ? ((supportHomeQuery.isLoading && !supportHomeQuery.data)
            || (responderProfileQuery.isLoading && !responderProfileQuery.data)
            || (supportSessionsQuery.isLoading && supportQueueQuery.isLoading && myRequestsQuery.isLoading
                && activeSupportSessions.length === 0
                && completedSupportSessions.length === 0
                && immediateOpenRequests.length === 0))
        : surface === 'community'
            ? communityScope === 'open'
                ? (openRequestsQuery.isLoading && communityOpenRequests.length === 0)
                : (respondedRequestsQuery.isLoading && communityCompletedResponded.length === 0)
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

    const renderOwnedRequestCard = (request: api.SupportRequest) => (
        <SupportRequestCard
            key={request.id}
            request={request}
            isAvailableToSupport
            responsePending={false}
            closingPending={closingIds.has(request.id)}
            responses={requestResponsesById[request.id]}
            responsesExpanded={expandedResponseRequestIds.has(request.id)}
            responsesLoading={responseLoadingIds.has(request.id)}
            responseChatPendingId={responseChatPendingIds[request.id]}
            onRespond={handleRespond}
            onOpenCheckInLaterComposer={openCheckInLaterComposer}
            onClose={handleClose}
            onToggleResponses={toggleResponses}
            onOpenResponseChat={handleOpenResponseChat}
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
            isAvailableToSupport
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

    if (surface === 'create') {
        return (
            <View style={styles.container}>
                {primaryTabs}
                <ScrollView contentContainerStyle={[screenStandards.detailContent, screenStandards.scrollContent]}>
                    <InfoNoticeCard
                        title={requestChannel === 'immediate' ? 'Request support right now' : 'Ask the community for support'}
                        description={requestChannel === 'immediate'
                            ? 'Immediate requests are routed privately to people who are available right now.'
                            : 'Community requests stay on the wider support board for asynchronous replies.'}
                        style={styles.headerCard}
                    />

                    <SegmentedControl
                        activeKey={requestChannel}
                        onChange={(key) => setRequestChannel(key as SupportRequestChannel)}
                        tone="secondary"
                        style={styles.nestedTabs}
                        items={[
                            { key: 'immediate', label: 'Immediate' },
                            { key: 'community', label: 'Community' },
                        ]}
                    />

                    <Text style={styles.formLabel}>What do you need?</Text>
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

                    <Text style={styles.formLabel}>How urgent is this?</Text>
                    <View style={styles.selectorWrap}>
                        {SUPPORT_URGENCY_OPTIONS.map(option => (
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

                    <PrimaryButton
                        label={submitting
                            ? 'Posting...'
                            : requestChannel === 'immediate'
                                ? 'Request immediate support'
                                : 'Post community request'}
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
                            refreshing={supportHomeQuery.isRefetching || supportQueueQuery.isRefetching || supportSessionsQuery.isRefetching || myRequestsQuery.isRefetching}
                            onRefresh={refreshSupportPlatform}
                            tintColor={Colors.primary}
                        />
                    }
                >
                    <InfoNoticeCard
                        title={immediateScope === 'open' ? 'Live support that needs attention now' : 'Resolved immediate support'}
                        description={immediateScope === 'open'
                            ? 'This is where routed offers, live immediate requests, and current support sessions stay visible.'
                            : 'Finished immediate sessions and closed immediate requests stay here for later reference.'}
                        style={styles.headerCard}
                    />

                    <SegmentedControl
                        activeKey={immediateScope}
                        onChange={(key) => setImmediateScope(key as SupportScope)}
                        tone="secondary"
                        style={styles.nestedTabs}
                        items={[
                            { key: 'open', label: 'Open' },
                            { key: 'completed', label: 'Completed' },
                        ]}
                    />

                    {responderAvailabilityCard}

                    {immediateScope === 'open' ? (
                        immediateOpenRequests.length === 0 && activeSupportSessions.length === 0 && supportQueueItems.length === 0 ? (
                            <EmptyState
                                title="Nothing open right now."
                                description="Your live immediate requests, active sessions, and routed offers will appear here."
                            />
                        ) : (
                        <>
                            {immediateOpenRequests.length > 0 ? (
                                <>
                                    <InfoNoticeCard
                                        title="Your immediate requests"
                                        description="Requests that are still routing or currently matched stay here."
                                        style={styles.screenNote}
                                    />
                                    {immediateOpenRequests.map(renderOwnedRequestCard)}
                                </>
                            ) : null}

                            {activeSupportSessions.length > 0 ? (
                                <View style={styles.sessionList}>
                                    {activeSupportSessions.map((session) => (
                                        <SupportSessionCard
                                            key={session.id}
                                            session={session}
                                            currentUserId={user?.id}
                                            opening={sessionChatOpeningIds.has(session.id)}
                                            closing={sessionClosingIds.has(session.id)}
                                            onOpenChat={(value) => void handleOpenSessionChat(value)}
                                            onCloseSession={(value) => void handleCloseSession(value)}
                                        />
                                    ))}
                                </View>
                            ) : null}

                            <InfoNoticeCard
                                title="Incoming routed offers"
                                description="These are the immediate requests the routing system thinks fit you best right now."
                                style={styles.screenNote}
                            />
                            {supportQueueItems.length === 0 ? (
                                <EmptyState
                                    title="No routed offers right now."
                                    description="Turn on immediate support and available-now status to receive more matches."
                                />
                            ) : (
                                supportQueueItems.map((offer) => (
                                    <SupportOfferCard
                                        key={offer.id}
                                        offer={offer}
                                        accepting={offerAcceptingIds.has(offer.id)}
                                        declining={offerDecliningIds.has(offer.id)}
                                        onAccept={(value) => void handleAcceptOffer(value)}
                                        onDecline={(value) => void handleDeclineOffer(value)}
                                        onPressUser={() => onOpenUserProfile({
                                            userId: offer.requester_id,
                                            username: offer.requester_username,
                                            avatarUrl: offer.requester_avatar_url ?? undefined,
                                        })}
                                    />
                                ))
                            )}
                        </>
                        )
                    ) : (
                        completedSupportSessions.length === 0 && immediateClosedRequests.length === 0 ? (
                            <EmptyState
                                title="No completed immediate support yet."
                                description="Finished immediate sessions and closed immediate requests will appear here."
                            />
                        ) : (
                        <>
                            {completedSupportSessions.length > 0 ? (
                                <View style={styles.sessionList}>
                                    {completedSupportSessions.map((session) => (
                                        <SupportSessionCard
                                            key={session.id}
                                            session={session}
                                            currentUserId={user?.id}
                                            opening={sessionChatOpeningIds.has(session.id)}
                                            onOpenChat={(value) => void handleOpenSessionChat(value)}
                                        />
                                    ))}
                                </View>
                            ) : null}

                            {immediateClosedRequests.length > 0 ? (
                                <>
                                    <InfoNoticeCard
                                        title="Closed immediate requests"
                                        description="Requests that were closed without an active session still stay visible here."
                                        style={styles.screenNote}
                                    />
                                    {immediateClosedRequests.map(renderOwnedRequestCard)}
                                </>
                            ) : null}
                        </>
                        )
                    )}
                </ScrollView>
            </View>
        );
    }

    if (surface === 'my_requests') {
        const visibleRequests = myRequestsScope === 'open' ? myOpenRequests : myCompletedRequests;

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
                                title={myRequestsScope === 'open' ? 'Everything you still need help with' : 'Requests you have already closed'}
                                description={myRequestsScope === 'open'
                                    ? 'Immediate and community requests stay together here so you always know where to manage them.'
                                    : 'Closed requests from both support lanes stay here for later reference.'}
                                style={styles.headerCard}
                            />
                            <SegmentedControl
                                activeKey={myRequestsScope}
                                onChange={(key) => setMyRequestsScope(key as SupportScope)}
                                tone="secondary"
                                style={styles.nestedTabs}
                                items={[
                                    { key: 'open', label: 'Open' },
                                    { key: 'completed', label: 'Completed' },
                                ]}
                            />
                        </>
                    }
                    ListEmptyComponent={
                        <EmptyState
                            title={myRequestsScope === 'open' ? 'No open requests.' : 'No completed requests yet.'}
                            description={myRequestsScope === 'open'
                                ? 'Create an immediate or community request when you need support.'
                                : 'Closed requests will appear here once you have completed them.'}
                        />
                    }
                    ListFooterComponent={myRequestsQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                    renderItem={({ item }) => renderOwnedRequestCard(item)}
                />
                {isActive && supportScrollToTop.isVisible ? (
                    <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
                ) : null}
            </View>
        );
    }

    const communityList = communityScope === 'open' ? communityOpenRequests : communityCompletedResponded;

    return (
        <View style={styles.container}>
            {primaryTabs}
            <FlatList<api.SupportRequest>
                ref={flatListRef}
                data={communityList}
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
                        refreshing={communityScope === 'open'
                            ? openRequestsQuery.isRefetching && !openRequestsQuery.isFetchingNextPage
                            : respondedRequestsQuery.isRefetching && !respondedRequestsQuery.isFetchingNextPage}
                        onRefresh={communityScope === 'open' ? refreshOpen : refreshResponded}
                        tintColor={Colors.primary}
                    />
                }
                contentContainerStyle={screenStandards.listContent}
                ListHeaderComponent={
                    <>
                        <InfoNoticeCard
                            title={communityScope === 'open' ? 'Open requests from the wider community' : 'Closed community requests you responded to'}
                            description={communityScope === 'open'
                                ? 'This is the asynchronous support board. Respond only when you can genuinely show up for someone.'
                                : 'This is where community requests you answered later appear once they have been closed.'}
                            style={styles.headerCard}
                        />
                        <SegmentedControl
                            activeKey={communityScope}
                            onChange={(key) => setCommunityScope(key as SupportScope)}
                            tone="secondary"
                            style={styles.nestedTabs}
                            items={[
                                { key: 'open', label: 'Open' },
                                { key: 'completed', label: 'Completed' },
                            ]}
                        />
                        {communityScope === 'open' ? (
                            <>
                                <View style={styles.statsRow}>
                                    <View style={styles.statCard}>
                                        <Text style={styles.statValue}>{openRequestCount}</Text>
                                        <Text style={styles.statLabel}>Open requests</Text>
                                    </View>
                                </View>
                            </>
                        ) : null}
                    </>
                }
                ListEmptyComponent={
                    <EmptyState
                        title={communityScope === 'open' ? 'No open community requests right now.' : 'No completed community requests yet.'}
                        description={communityScope === 'open'
                            ? 'Check back later for new requests from the community.'
                            : 'Closed community requests you responded to will appear here.'}
                    />
                }
                ListFooterComponent={
                    (communityScope === 'open' && openRequestsQuery.isFetchingNextPage)
                        || (communityScope === 'completed' && respondedRequestsQuery.isFetchingNextPage)
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
    container: { flex: 1, backgroundColor: Colors.light.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.background },
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
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Spacing.md,
    },
    statValue: {
        fontSize: Typography.sizes.xl,
        fontWeight: '700',
        color: Colors.light.textPrimary,
    },
    statLabel: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        marginTop: 4,
    },
    availabilityCard: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    availabilityHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    availabilityBody: { flex: 1 },
    availabilityTitle: { fontSize: Typography.sizes.md, fontWeight: '600', color: Colors.light.textPrimary, marginBottom: 4 },
    availabilityText: { fontSize: Typography.sizes.sm, color: Colors.light.textSecondary, lineHeight: 19 },
    availabilityFootnote: {
        marginTop: Spacing.sm,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    availabilityToggle: {
        minWidth: 72,
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: Colors.light.background,
    },
    availabilityToggleActive: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    availabilityToggleText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
    availabilityToggleTextActive: {
        color: Colors.textOn.primary,
    },
    formLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
        marginBottom: Spacing.sm,
        marginTop: Spacing.md,
    },
    selectorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    selectorChip: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    selectorChipActive: { backgroundColor: Colors.success, borderColor: Colors.success },
    selectorChipText: { fontSize: Typography.sizes.sm, color: Colors.light.textSecondary },
    selectorChipTextActive: { color: Colors.textOn.primary, fontWeight: '600' },
    datePickerCard: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.lg,
        backgroundColor: Colors.light.backgroundSecondary,
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
        borderColor: Colors.light.border,
        borderRadius: Radii.md,
        backgroundColor: Colors.light.background,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    dateTimeSummaryLabel: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
        marginBottom: 4,
    },
    dateTimeSummaryValue: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    inlinePickerWrap: {
        marginTop: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.md,
        backgroundColor: Colors.light.background,
        overflow: 'hidden',
    },
    inlinePickerTabs: {
        flexDirection: 'row',
        padding: Spacing.xs,
        gap: Spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.borderSecondary,
    },
    inlinePickerTab: {
        flex: 1,
        borderRadius: Radii.full,
        paddingVertical: 8,
        alignItems: 'center',
    },
    inlinePickerTabActive: {
        backgroundColor: Colors.primary,
    },
    inlinePickerTabText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
    inlinePickerTabTextActive: {
        color: Colors.textOn.primary,
    },
    formInput: { marginTop: Spacing.md },
    inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
    submitButton: { marginTop: Spacing.lg },
    card: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    cardHeadBody: { flex: 1 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    cardTitleBadges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
    cardName: { fontSize: Typography.sizes.md, fontWeight: '600', color: Colors.light.textPrimary },
    badge: { backgroundColor: Colors.successSubtle, borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: Typography.sizes.xs, fontWeight: '700', color: Colors.success },
    urgencyBadgeUrgent: {
        borderRadius: Radii.full,
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
        borderRadius: Radii.full,
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
        borderRadius: Radii.full,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(120,120,128,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(120,120,128,0.25)',
    },
    urgencyBadgeWheneverText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.light.textSecondary,
    },
    cardMeta: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary, marginTop: 4 },
    cardBody: { fontSize: Typography.sizes.base, lineHeight: 19, color: Colors.light.textSecondary, marginTop: Spacing.md },
    cardFooterText: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary, marginTop: Spacing.md },
    responseSummaryText: { fontSize: Typography.sizes.sm, color: Colors.primary, marginTop: Spacing.sm, fontWeight: '500' },
    sessionList: {
        marginBottom: Spacing.md,
    },
    sessionCard: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    sessionCardBody: {
        flex: 1,
    },
    sessionCardTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    sessionCardMeta: {
        marginTop: 4,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    sessionCardAction: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    sessionCardActionText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    sessionCardActions: {
        gap: Spacing.sm,
        alignItems: 'flex-end',
    },
    sessionCardSecondaryAction: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    sessionCardSecondaryActionText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    actionPrimary: { backgroundColor: Colors.success, borderRadius: Radii.full, paddingHorizontal: Spacing.md, paddingVertical: 10 },
    actionPrimaryText: { color: Colors.textOn.primary, fontSize: Typography.sizes.sm, fontWeight: '600' },
    actionSecondary: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    actionSecondaryText: { color: Colors.light.textSecondary, fontSize: Typography.sizes.sm, fontWeight: '600' },
    responsesSection: {
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
        gap: Spacing.sm,
    },
    responseRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        backgroundColor: Colors.light.background,
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Spacing.sm,
    },
    responseBody: { flex: 1 },
    responseName: { fontSize: Typography.sizes.sm, fontWeight: '600', color: Colors.light.textPrimary },
    responseMeta: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary, marginTop: 2 },
    responseMessage: { fontSize: Typography.sizes.sm, color: Colors.light.textSecondary, lineHeight: 18, marginTop: 6 },
    responseChatButton: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
    },
    responseChatButtonText: { color: Colors.textOn.primary, fontSize: Typography.sizes.sm, fontWeight: '600' },
    responsesEmptyText: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
    checkInInput: { minHeight: 92 },
    previewLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
        marginTop: Spacing.md,
    },
    previewText: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textPrimary,
        lineHeight: 19,
        marginTop: Spacing.xs,
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
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
