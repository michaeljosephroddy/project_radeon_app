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
import { HeroCard } from '../../components/ui/HeroCard';
import { PlusFeatureSheet } from '../../components/ui/PlusFeatureSheet';
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
import { useMySupportRequests, useSupportProfile, useSupportRequests } from '../../hooks/queries/useSupport';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';

type SupportType = api.SupportRequest['type'];
type SupportUrgency = api.SupportRequest['urgency'];
type SupportResponseType = api.SupportResponse['response_type'];
type SupportSubView = 'open' | 'mine' | 'create' | 'preview';

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

const PRIORITY_VISIBILITY_WINDOW_HOURS = 1;

const SUPPORT_PLUS_FEATURES: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; description: string }> = [
    { icon: 'flash-outline', label: 'Priority visibility', description: 'Show your request higher in the support feed for 1 hour.' },
    { icon: 'people-outline', label: 'Better reach', description: 'Give your request a temporary boost without blocking free posting.' },
    { icon: 'star-outline', label: 'SoberSpace Plus', description: 'Priority visibility is included with Plus.' },
];

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

function hasPlusAccess(user: api.User | null): boolean {
    if (!user) return false;
    if (user.is_plus) return true;
    return user.subscription_tier === 'plus';
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
    const isClosed = request.status !== 'open';
    const responseSummary = getSupportResponseSummary(responses);
    const canRespond = isAvailableToSupport && !responsePending && !request.has_responded && !isClosed;

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <TouchableOpacity onPress={request.is_own_request ? undefined : onPressUser} disabled={request.is_own_request}>
                    <Avatar username={request.username} avatarUrl={request.avatar_url ?? undefined} size={36} />
                </TouchableOpacity>
                <View style={styles.cardHeadBody}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.cardName}>{formatUsername(request.username)}</Text>
                        <View style={styles.cardTitleBadges}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>Needs Support</Text>
                            </View>
                            {request.urgency === 'right_now' ? (
                                <View style={styles.urgencyBadgeUrgent}>
                                    <Text style={styles.urgencyBadgeUrgentText}>Right now</Text>
                                </View>
                            ) : request.urgency === 'soon' ? (
                                <View style={styles.urgencyBadgeSoon}>
                                    <Text style={styles.urgencyBadgeSoonText}>Soon</Text>
                                </View>
                            ) : null}
                            {request.priority_visibility && request.priority_expires_at ? (
                                <View style={styles.priorityBadge}>
                                    <Ionicons name="flash" size={10} color={Colors.warning} />
                                    <Text style={styles.priorityBadgeText}>Priority</Text>
                                </View>
                            ) : null}
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
                {request.response_count} response{request.response_count === 1 ? '' : 's'}
                {request.has_responded ? ' · You responded' : ''}
                {isClosed ? ` · ${request.status}` : ''}
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
            ) : (
                <View style={styles.actions}>
                    {!isAvailableToSupport ? (
                        <TouchableOpacity
                            style={[styles.actionSecondary, styles.actionDisabled]}
                            disabled
                        >
                            <Text style={styles.actionSecondaryText}>Turn on availability to respond</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
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
                        </>
                    )}
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
    const flatListRef = useRef<FlatList<api.SupportRequest> | null>(null);
    const hasActivatedOpen = useLazyActivation(isActive);
    const [subView, setSubView] = useState<SupportSubView>('open');
    const [requests, setRequests] = useState<api.SupportRequest[]>([]);
    const [myRequests, setMyRequests] = useState<api.SupportRequest[]>([]);
    const [requestResponsesById, setRequestResponsesById] = useState<Record<string, api.SupportResponse[]>>({});
    const [expandedResponseRequestIds, setExpandedResponseRequestIds] = useState<Set<string>>(new Set());
    const [responseLoadingIds, setResponseLoadingIds] = useState<Set<string>>(new Set());
    const [responseChatPendingIds, setResponseChatPendingIds] = useState<Record<string, string | undefined>>({});
    const [isAvailableToSupport, setIsAvailableToSupport] = useState(false);
    const [openRequestCount, setOpenRequestCount] = useState(0);
    const [availableToSupportCount, setAvailableToSupportCount] = useState(0);
    const [openHasMore, setOpenHasMore] = useState(false);
    const [myHasMore, setMyHasMore] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showPriorityPaywall, setShowPriorityPaywall] = useState(false);
    const [availabilityUpdating, setAvailabilityUpdating] = useState(false);
    const [responsePendingIds, setResponsePendingIds] = useState<Set<string>>(new Set());
    const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
    const [pendingCheckInDraft, setPendingCheckInDraft] = useState<PendingCheckInDraft | null>(null);
    const [form, setForm] = useState({
        type: 'need_to_talk' as SupportType,
        message: '',
        urgency: 'when_you_can' as SupportUrgency,
    });
    const [hasActivatedMine, setHasActivatedMine] = useState(false);
    useEffect(() => {
        if (isActive && subView === 'mine') {
            setHasActivatedMine(true);
        }
    }, [isActive, subView]);
    const supportProfileQuery = useSupportProfile(hasActivatedOpen);
    const supportListProps = getListPerformanceProps('detailList');
    const openRequestsQuery = useSupportRequests(20, hasActivatedOpen);
    const myRequestsQuery = useMySupportRequests(20, hasActivatedMine);
    useRefetchOnActiveIfStale(isActive, supportProfileQuery);
    useRefetchOnActiveIfStale(isActive && subView === 'open', openRequestsQuery);
    useRefetchOnActiveIfStale(isActive && subView === 'mine', myRequestsQuery);
    const supportScrollToTop = useScrollToTopButton({ threshold: 320 });
    const openRequestItems = useMemo(
        () => openRequestsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [],
        [openRequestsQuery.data],
    );
    const myRequestItems = useMemo(
        () => myRequestsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [],
        [myRequestsQuery.data],
    );
    const canUsePriorityVisibility = hasPlusAccess(user);

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
        setAvailableToSupportCount((current) => {
            const next = openRequestsQuery.data?.pages[0]?.available_to_support_count ?? 0;
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

    useEffect(() => {
        if (!supportProfileQuery.data) return;
        setIsAvailableToSupport((current) => {
            const next = supportProfileQuery.data.is_available_to_support;
            return current === next ? current : next;
        });
    }, [supportProfileQuery.data]);

    const refreshOpen = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.supportRequests({ scope: 'open', limit: 20 }));
        await openRequestsQuery.refetch();
    };

    const refreshMine = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.supportRequests({ scope: 'mine', limit: 20 }));
        await myRequestsQuery.refetch();
    };

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
            setMyRequests(prev => prev.filter(item => item.id !== request.id));
            setExpandedResponseRequestIds(prev => {
                const next = new Set(prev);
                next.delete(request.id);
                return next;
            });
            void queryClient.invalidateQueries({ queryKey: ['support-requests'] });
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

    const handleCreate = async (withBoost: boolean) => {
        setSubmitting(true);
        try {
            const created = await api.createSupportRequest({
                type: form.type,
                message: form.message.trim() || null,
                urgency: form.urgency,
                priority_visibility: withBoost,
            });
            setMyRequests(prev => [created, ...prev.filter(item => item.id !== created.id)]);
            setSubView('mine');
            setForm({
                type: 'need_to_talk',
                message: '',
                urgency: 'when_you_can',
            });
            void queryClient.invalidateQueries({ queryKey: ['support-requests'] });
        } catch (e: unknown) {
            Alert.alert('Could not create support request', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePostWithBoost = () => {
        if (!canUsePriorityVisibility) {
            setShowPriorityPaywall(true);
            return;
        }
        void handleCreate(true);
    };

    const handlePostWithoutBoost = () => {
        void handleCreate(false);
    };

    const handleToggleAvailability = async () => {
        const next = !isAvailableToSupport;
        setIsAvailableToSupport(next);
        setAvailabilityUpdating(true);
        try {
            const profile = await api.updateMySupportProfile({ is_available_to_support: next });
            setIsAvailableToSupport(profile.is_available_to_support);
            queryClient.setQueryData(queryKeys.supportProfile(), profile);
        } catch (e: unknown) {
            setIsAvailableToSupport(!next);
            Alert.alert('Could not update support availability', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setAvailabilityUpdating(false);
        }
    };

    const handleLoadMore = async () => {
        if (subView === 'create') return;
        if (subView === 'mine') {
            if (myRequestsQuery.isFetchingNextPage || myRequestsQuery.isRefetching || !myHasMore) return;
            await myRequestsQuery.fetchNextPage();
            return;
        }

        if (openRequestsQuery.isFetchingNextPage || openRequestsQuery.isRefetching || !openHasMore) return;
        await openRequestsQuery.fetchNextPage();
    };
    const supportListPagination = useGuardedEndReached(handleLoadMore);

    const availabilityCard = (
        <View style={styles.availabilityCard}>
            <View style={styles.availabilityHeader}>
                <View style={styles.availabilityBody}>
                    <Text style={styles.availabilityTitle}>Available to support</Text>
                    <Text style={styles.availabilityText}>
                        Let people know you are open to showing up for someone today.
                    </Text>
                </View>
                <TouchableOpacity
                    style={[
                        styles.availabilityToggle,
                        isAvailableToSupport && styles.availabilityToggleActive,
                        availabilityUpdating && styles.actionDisabled,
                    ]}
                    onPress={handleToggleAvailability}
                    disabled={availabilityUpdating}
                >
                    <Text style={[
                        styles.availabilityToggleText,
                        isAvailableToSupport && styles.availabilityToggleTextActive,
                    ]}>
                        {availabilityUpdating ? 'Saving...' : isAvailableToSupport ? 'On' : 'Off'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const loading = (openRequestsQuery.isLoading && requests.length === 0)
        || (supportProfileQuery.isLoading && !supportProfileQuery.data);

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

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
            <ScrollView contentContainerStyle={styles.list}>
                <SegmentedControl
                    activeKey="check-in"
                    onChange={(key) => {
                        if (key === 'back') closeCheckInLaterComposer();
                    }}
                    items={[
                        { key: 'back', label: 'Back' },
                        { key: 'check-in', label: 'Check in later', flex: 2 },
                    ]}
                />

                <HeroCard
                    eyebrow="CHECK IN LATER"
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

    if (subView === 'preview') {
        return (
            <ScrollView contentContainerStyle={styles.list}>
                <PlusFeatureSheet
                    visible={showPriorityPaywall}
                    title="Boost request visibility"
                    items={SUPPORT_PLUS_FEATURES}
                    onClose={() => setShowPriorityPaywall(false)}
                />

                <View style={styles.previewHeader}>
                    <TouchableOpacity onPress={() => setSubView('create')} style={styles.previewBack}>
                        <Ionicons name="chevron-back" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.previewTitle}>Review your request</Text>
                    <View style={styles.previewBackSpacer} />
                </View>

                <View style={styles.previewCard}>
                    <View style={styles.previewTypeRow}>
                        <View style={[styles.selectorChip, styles.selectorChipActive]}>
                            <Text style={[styles.selectorChipText, styles.selectorChipTextActive]}>
                                {SUPPORT_TYPE_LABELS[form.type]}
                            </Text>
                        </View>
                    </View>
                    {!!form.message.trim() && (
                        <Text style={styles.previewMessage}>{form.message.trim()}</Text>
                    )}
                    <View style={styles.previewDivider} />
                    <View style={styles.previewStatRow}>
                        <View style={styles.previewStat}>
                            <Ionicons name="people-outline" size={15} color={Colors.light.textTertiary} />
                            <Text style={styles.previewStatLabel}>Visible to</Text>
                            <Text style={styles.previewStatValue}>Everyone</Text>
                        </View>
                        <View style={styles.previewStatSep} />
                        <View style={styles.previewStat}>
                            <Ionicons name="alert-circle-outline" size={15} color={Colors.light.textTertiary} />
                            <Text style={styles.previewStatLabel}>Urgency</Text>
                            <Text style={styles.previewStatValue}>
                                {SUPPORT_URGENCY_OPTIONS.find(o => o.value === form.urgency)?.label ?? form.urgency}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.previewActions}>
                    <TouchableOpacity
                        style={[styles.boostButton, submitting && styles.boostButtonDisabled]}
                        onPress={handlePostWithBoost}
                        disabled={submitting}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="star" size={16} color={Colors.textOn.warning} />
                        <Text style={styles.boostButtonText}>Post & boost visibility</Text>
                        <View style={styles.boostPlusBadge}>
                            <Text style={styles.boostPlusBadgeText}>Plus</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.freePostButton, submitting && styles.boostButtonDisabled]}
                        onPress={handlePostWithoutBoost}
                        disabled={submitting}
                        activeOpacity={0.85}
                    >
                        {submitting
                            ? <ActivityIndicator color={Colors.light.textSecondary} />
                            : <Text style={styles.freePostButtonText}>Post without boost</Text>
                        }
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }

    if (subView === 'create') {
        return (
            <ScrollView contentContainerStyle={styles.list}>
                <SegmentedControl
                    activeKey="create"
                    onChange={(key) => setSubView(key as SupportSubView)}
                    items={[
                        { key: 'open', label: 'Open' },
                        { key: 'mine', label: 'My requests' },
                        { key: 'create', label: 'Create' },
                    ]}
                />

                <View style={styles.screenNote}>
                    <Text style={styles.screenNoteTitle}>Ask the community for support.</Text>
                    <Text style={styles.screenNoteText}>Keep it short so people know how to show up for you.</Text>
                </View>

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
                    label="Review & post"
                    onPress={() => setSubView('preview')}
                    variant="success"
                    style={styles.submitButton}
                />
            </ScrollView>
        );
    }

    const isMineView = subView === 'mine';
    const data = isMineView ? myRequests : requests;

    return (
        <View style={styles.container}>
            <FlatList
            ref={flatListRef}
            data={data}
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
                    refreshing={isMineView
                        ? (myRequestsQuery.isRefetching && !myRequestsQuery.isFetchingNextPage)
                        : (openRequestsQuery.isRefetching && !openRequestsQuery.isFetchingNextPage)}
                    onRefresh={isMineView ? refreshMine : refreshOpen}
                    tintColor={Colors.primary}
                />
            }
            contentContainerStyle={styles.list}
            ListHeaderComponent={
                <>
                    <SegmentedControl
                        activeKey={isMineView ? 'mine' : 'open'}
                        onChange={(key) => setSubView(key as SupportSubView)}
                        items={[
                            { key: 'open', label: 'Open' },
                            { key: 'mine', label: 'My requests' },
                            { key: 'create', label: 'Create' },
                        ]}
                    />

                    <View style={styles.screenNote}>
                        <Text style={styles.screenNoteTitle}>
                            {isMineView ? 'Your Support Requests' : 'Support Requests'}
                        </Text>
                        <Text style={styles.screenNoteText}>
                            {isMineView
                                ? 'See how people responded, open a chat that fits, and close the request once you are okay.'
                                : 'Open requests from the community show up here so you can respond when you can genuinely help.'}
                        </Text>
                    </View>
                    {!isMineView ? (
                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{openRequestCount}</Text>
                                <Text style={styles.statLabel}>Open requests</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{availableToSupportCount}</Text>
                                <Text style={styles.statLabel}>Available to support</Text>
                            </View>
                        </View>
                    ) : null}
                    {!isMineView ? availabilityCard : null}
                </>
            }
            ListEmptyComponent={
                <EmptyState
                    title={isMineView ? 'No support requests yet.' : 'No open requests right now.'}
                    description={isMineView ? 'Create one when you need the community.' : 'Check back later or turn on availability in your profile.'}
                />
            }
            ListFooterComponent={(isMineView ? myRequestsQuery.isFetchingNextPage : openRequestsQuery.isFetchingNextPage) ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
            renderItem={({ item }) => (
                <SupportRequestCard
                    request={item}
                    isAvailableToSupport={isAvailableToSupport}
                    responsePending={responsePendingIds.has(item.id)}
                    closingPending={closingIds.has(item.id)}
                    responses={isMineView ? requestResponsesById[item.id] : undefined}
                    responsesExpanded={isMineView ? expandedResponseRequestIds.has(item.id) : undefined}
                    responsesLoading={isMineView ? responseLoadingIds.has(item.id) : undefined}
                    responseChatPendingId={isMineView ? responseChatPendingIds[item.id] : undefined}
                    onRespond={handleRespond}
                    onOpenCheckInLaterComposer={openCheckInLaterComposer}
                    onClose={handleClose}
                    onToggleResponses={isMineView ? toggleResponses : undefined}
                    onOpenResponseChat={isMineView ? handleOpenResponseChat : undefined}
                    onPressUser={() => onOpenUserProfile({
                        userId: item.requester_id,
                        username: item.username,
                        avatarUrl: item.avatar_url ?? undefined,
                    })}
                />
            )}
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
    list: { padding: Spacing.md, paddingBottom: 32 },
    headerCard: { marginBottom: Spacing.md },
    screenNote: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: 4,
        marginBottom: Spacing.md,
    },
    screenNoteTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    screenNoteText: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        lineHeight: 18,
    },
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
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    previewBack: {
        padding: 4,
    },
    previewBackSpacer: {
        width: 30,
    },
    previewTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: Typography.sizes.lg,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    previewCard: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
        gap: Spacing.sm,
    },
    previewTypeRow: {
        flexDirection: 'row',
    },
    previewMessage: {
        fontSize: Typography.sizes.lg,
        color: Colors.light.textPrimary,
        lineHeight: 24,
    },
    previewDivider: {
        height: 0.5,
        backgroundColor: Colors.light.border,
        marginTop: Spacing.sm,
    },
    previewStatRow: {
        flexDirection: 'row',
        paddingTop: Spacing.sm,
    },
    previewStat: {
        flex: 1,
        alignItems: 'center',
        gap: 3,
    },
    previewStatSep: {
        width: 0.5,
        backgroundColor: Colors.light.border,
    },
    previewStatLabel: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
    },
    previewStatValue: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    previewActions: {
        gap: Spacing.md,
    },
    boostButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.warning,
        borderRadius: Radii.md,
        paddingVertical: 14,
    },
    boostButtonDisabled: {
        opacity: 0.6,
    },
    boostButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.textOn.warning,
    },
    boostPlusBadge: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: Radii.pill,
        paddingHorizontal: Spacing.xs + 2,
        paddingVertical: 3,
    },
    boostPlusBadgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.textOn.warning,
    },
    freePostButton: {
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        paddingVertical: 14,
        alignItems: 'center',
    },
    freePostButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textSecondary,
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
    priorityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(255,193,7,0.14)',
        borderRadius: Radii.full,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,193,7,0.28)',
    },
    priorityBadgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.warning,
    },
    cardMeta: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary, marginTop: 4 },
    cardBody: { fontSize: Typography.sizes.base, lineHeight: 19, color: Colors.light.textSecondary, marginTop: Spacing.md },
    cardFooterText: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary, marginTop: Spacing.md },
    responseSummaryText: { fontSize: Typography.sizes.sm, color: Colors.primary, marginTop: Spacing.sm, fontWeight: '500' },
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
