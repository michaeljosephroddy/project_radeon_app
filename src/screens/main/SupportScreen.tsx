import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, RefreshControl, ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useMySupportRequests, useSupportProfile, useSupportRequests } from '../../hooks/queries/useSupport';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';

type SupportType = api.SupportRequest['type'];
type SupportAudience = api.SupportRequest['audience'];
type SupportResponseType = api.SupportResponse['response_type'];
type SupportSubView = 'open' | 'mine' | 'create';
type SupportMode = SupportResponseType;

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
    supportModes: SupportMode[];
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
    need_company: 'Need company',
};

const SUPPORT_AUDIENCE_LABELS: Record<SupportAudience, string> = {
    friends: 'Friends',
    city: 'My city',
    community: 'Community',
};

const SUPPORT_RESPONSE_LABELS: Record<SupportResponseType, string> = {
    can_chat: 'Can chat now',
    check_in_later: 'Check in later',
    nearby: 'Nearby',
};

const SUPPORT_DURATION_OPTIONS = [
    { label: '2h', hours: 2 },
    { label: '6h', hours: 6 },
    { label: '12h', hours: 12 },
];

const DEFAULT_SUPPORT_MODES: SupportMode[] = ['can_chat', 'check_in_later', 'nearby'];

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

function expiryFromHours(hours: number): string {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
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

function buildCheckInLaterMessage(scheduledFor: string): string {
    return `Busy at the moment but I can check in at ${formatScheduledForDisplay(scheduledFor)}.`;
}

function getSupportResponseSummary(responses?: api.SupportResponse[]): string | null {
    if (!Array.isArray(responses) || responses.length === 0) return null;

    const canChatCount = responses.filter(response => response.response_type === 'can_chat').length;
    const checkInLaterCount = responses.filter(response => response.response_type === 'check_in_later').length;
    const nearbyCount = responses.filter(response => response.response_type === 'nearby').length;
    const parts: string[] = [];

    if (canChatCount > 0) parts.push(`${canChatCount} can chat now`);
    if (checkInLaterCount > 0) parts.push(`${checkInLaterCount} can check in later`);
    if (nearbyCount > 0) parts.push(`${nearbyCount} nearby`);

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

function normalizeSupportModes(modes?: string[] | null): SupportMode[] {
    const validModes = (modes ?? []).filter((mode): mode is SupportMode => (
        mode === 'can_chat' || mode === 'check_in_later' || mode === 'nearby'
    ));

    return validModes.length > 0 ? validModes : [...DEFAULT_SUPPORT_MODES];
}

function getSupportModeLabel(mode: SupportMode): string {
    switch (mode) {
    case 'can_chat':
        return 'Can chat now';
    case 'check_in_later':
        return 'Check in later';
    case 'nearby':
        return 'Nearby';
    default:
        return mode;
    }
}

function haveSameRequestIds(left: api.SupportRequest[], right: api.SupportRequest[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((item, index) => item.id === right[index]?.id);
}

function haveSameModes(left: SupportMode[], right: SupportMode[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((item, index) => item === right[index]);
}

function SupportRequestCard({
    request,
    isAvailableToSupport,
    supportModes,
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
    const canOfferNearby = request.type === 'need_company' && !!request.city;
    const responseSummary = getSupportResponseSummary(responses);
    const canRespond = isAvailableToSupport && !responsePending && !request.has_responded && !isClosed;
    const canChatEnabled = supportModes.includes('can_chat');
    const checkInLaterEnabled = supportModes.includes('check_in_later');
    const nearbyEnabled = canOfferNearby && supportModes.includes('nearby');

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <TouchableOpacity onPress={request.is_own_request ? undefined : onPressUser} disabled={request.is_own_request}>
                    <Avatar username={request.username} avatarUrl={request.avatar_url ?? undefined} size={36} />
                </TouchableOpacity>
                <View style={styles.cardHeadBody}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.cardName}>{formatUsername(request.username)}</Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>Needs Support</Text>
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
                            {canChatEnabled ? (
                                <TouchableOpacity
                                    style={[styles.actionPrimary, !canRespond && styles.actionDisabled]}
                                    onPress={() => onRespond(request, 'can_chat')}
                                    disabled={!canRespond}
                                >
                                    <Text style={styles.actionPrimaryText}>I can chat</Text>
                                </TouchableOpacity>
                            ) : null}
                            {checkInLaterEnabled ? (
                                <TouchableOpacity
                                    style={[styles.actionSecondary, !canRespond && styles.actionDisabled]}
                                    onPress={() => onOpenCheckInLaterComposer?.(request)}
                                    disabled={!canRespond}
                                >
                                    <Text style={styles.actionSecondaryText}>Check in later</Text>
                                </TouchableOpacity>
                            ) : null}
                            {nearbyEnabled ? (
                                <TouchableOpacity
                                    style={[styles.actionSecondary, !canRespond && styles.actionDisabled]}
                                    onPress={() => onRespond(request, 'nearby')}
                                    disabled={!canRespond}
                                >
                                    <Text style={styles.actionSecondaryText}>Nearby</Text>
                                </TouchableOpacity>
                            ) : null}
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
    const [supportModes, setSupportModes] = useState<SupportMode[]>([...DEFAULT_SUPPORT_MODES]);
    const [openRequestCount, setOpenRequestCount] = useState(0);
    const [availableToSupportCount, setAvailableToSupportCount] = useState(0);
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
        audience: 'community' as SupportAudience,
        durationHours: 6,
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
    const openRequestItems = useMemo(
        () => openRequestsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [],
        [openRequestsQuery.data],
    );
    const myRequestItems = useMemo(
        () => myRequestsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [],
        [myRequestsQuery.data],
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
        setSupportModes((current) => {
            const next = normalizeSupportModes(supportProfileQuery.data.support_modes);
            return haveSameModes(current, next) ? current : next;
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
            const responseMessage = scheduledFor ? buildCheckInLaterMessage(scheduledFor) : undefined;

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

    const handleCreate = async () => {
        setSubmitting(true);
        try {
            const created = await api.createSupportRequest({
                type: form.type,
                message: form.message.trim() || null,
                audience: form.audience,
                expires_at: expiryFromHours(form.durationHours),
            });
            setMyRequests(prev => [created, ...prev.filter(item => item.id !== created.id)]);
            setSubView('mine');
            setForm({
                type: 'need_to_talk',
                message: '',
                audience: 'community',
                durationHours: 6,
            });
            void queryClient.invalidateQueries({ queryKey: ['support-requests'] });
        } catch (e: unknown) {
            Alert.alert('Could not create support request', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleAvailability = async () => {
        const next = !isAvailableToSupport;
        const previousModes = supportModes;
        const nextModes = next ? normalizeSupportModes(supportModes) : supportModes;
        setIsAvailableToSupport(next);
        setSupportModes(nextModes);
        setAvailabilityUpdating(true);
        try {
            const profile = await api.updateMySupportProfile({
                is_available_to_support: next,
                support_modes: nextModes,
            });
            setIsAvailableToSupport(profile.is_available_to_support);
            setSupportModes(normalizeSupportModes(profile.support_modes));
            queryClient.setQueryData(queryKeys.supportProfile(), profile);
        } catch (e: unknown) {
            setIsAvailableToSupport(!next);
            setSupportModes(previousModes);
            Alert.alert('Could not update support availability', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setAvailabilityUpdating(false);
        }
    };

    const handleToggleSupportMode = async (mode: SupportMode) => {
        if (availabilityUpdating) return;

        const isEnabled = supportModes.includes(mode);
        if (isEnabled && supportModes.length === 1) {
            Alert.alert('Keep one support option', 'Choose at least one way you are available to support before removing this option.');
            return;
        }

        const previousModes = supportModes;
        const nextModes = isEnabled
            ? supportModes.filter((item) => item !== mode)
            : [...supportModes, mode];
        const normalizedNextModes = normalizeSupportModes(nextModes);

        setSupportModes(normalizedNextModes);
        setAvailabilityUpdating(true);
        try {
            const profile = await api.updateMySupportProfile({
                is_available_to_support: isAvailableToSupport,
                support_modes: normalizedNextModes,
            });
            setIsAvailableToSupport(profile.is_available_to_support);
            setSupportModes(normalizeSupportModes(profile.support_modes));
            queryClient.setQueryData(queryKeys.supportProfile(), profile);
        } catch (e: unknown) {
            setSupportModes(previousModes);
            Alert.alert('Could not update support options', e instanceof Error ? e.message : 'Something went wrong.');
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
                        Let people know you are open to chatting or showing up for someone today.
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
            <Text style={styles.availabilityModesLabel}>How you can help</Text>
            <View style={styles.selectorWrap}>
                {DEFAULT_SUPPORT_MODES.map((mode) => {
                    const enabled = supportModes.includes(mode);
                    return (
                        <TouchableOpacity
                            key={mode}
                            style={[
                                styles.selectorChip,
                                enabled && styles.selectorChipActive,
                                !isAvailableToSupport && styles.availabilityModeChipMuted,
                            ]}
                            onPress={() => handleToggleSupportMode(mode)}
                            disabled={availabilityUpdating || !isAvailableToSupport}
                        >
                            <Text
                                style={[
                                    styles.selectorChipText,
                                    enabled && styles.selectorChipTextActive,
                                    !isAvailableToSupport && styles.availabilityModeChipTextMuted,
                                ]}
                            >
                                {getSupportModeLabel(mode)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            <Text style={styles.availabilityModesHint}>
                {isAvailableToSupport
                    ? 'These options control which support responses you can send.'
                    : 'Choose your support options now. They will be used the next time you turn availability on.'}
            </Text>
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
                <View style={styles.segmentRow}>
                    <TouchableOpacity style={styles.segmentButton} onPress={closeCheckInLaterComposer}>
                        <Text style={styles.segmentLabel}>Back</Text>
                    </TouchableOpacity>
                    <View style={[styles.segmentButton, styles.segmentButtonActive, styles.fullWidthSegment]}>
                        <Text style={[styles.segmentLabel, styles.segmentLabelActive]}>Check in later</Text>
                    </View>
                </View>

                <View style={styles.heroCard}>
                    <Text style={styles.heroEyebrow}>CHECK IN LATER</Text>
                    <Text style={styles.heroTitle}>
                        Follow up with {formatUsername(pendingCheckInDraft.requesterName)}
                    </Text>
                    <Text style={styles.heroText}>
                        Choose the date and time and the app will send a formatted check-in message for you.
                    </Text>
                </View>

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

    if (subView === 'create') {
        return (
            <ScrollView contentContainerStyle={styles.list}>
                <View style={styles.segmentRow}>
                    <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('open')}>
                        <Text style={styles.segmentLabel}>Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('mine')}>
                        <Text style={styles.segmentLabel}>My requests</Text>
                    </TouchableOpacity>
                    <View style={[styles.segmentButton, styles.segmentButtonActive]}>
                        <Text style={[styles.segmentLabel, styles.segmentLabelActive]}>Create</Text>
                    </View>
                </View>

                <View style={styles.heroCard}>
                    <Text style={styles.heroEyebrow}>SUPPORT</Text>
                    <Text style={styles.heroTitle}>Ask the community for support.</Text>
                    <Text style={styles.heroText}>Keep it short so people know how to show up for you.</Text>
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

                <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={form.message}
                    onChangeText={message => setForm(prev => ({ ...prev, message }))}
                    placeholder="Optional note"
                    placeholderTextColor={Colors.light.textTertiary}
                    multiline
                />

                <Text style={styles.formLabel}>Who should see this?</Text>
                <View style={styles.selectorWrap}>
                    {(Object.keys(SUPPORT_AUDIENCE_LABELS) as SupportAudience[]).map(audience => (
                        <TouchableOpacity
                            key={audience}
                            style={[styles.selectorChip, form.audience === audience && styles.selectorChipActive]}
                            onPress={() => setForm(prev => ({ ...prev, audience }))}
                        >
                            <Text style={[styles.selectorChipText, form.audience === audience && styles.selectorChipTextActive]}>
                                {SUPPORT_AUDIENCE_LABELS[audience]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.formLabel}>How long should it stay open?</Text>
                <View style={styles.selectorWrap}>
                    {SUPPORT_DURATION_OPTIONS.map(option => (
                        <TouchableOpacity
                            key={option.hours}
                            style={[styles.selectorChip, form.durationHours === option.hours && styles.selectorChipActive]}
                            onPress={() => setForm(prev => ({ ...prev, durationHours: option.hours }))}
                        >
                            <Text style={[styles.selectorChipText, form.durationHours === option.hours && styles.selectorChipTextActive]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={[styles.submitButton, submitting && styles.actionDisabled]} onPress={handleCreate} disabled={submitting}>
                    {submitting ? <ActivityIndicator color={Colors.textOn.primary} /> : <Text style={styles.submitButtonText}>Post support request</Text>}
                </TouchableOpacity>
            </ScrollView>
        );
    }

    const isMineView = subView === 'mine';
    const data = isMineView ? myRequests : requests;

    return (
        <FlatList
            ref={flatListRef}
            data={data}
            keyExtractor={item => item.id}
            {...supportListProps}
            onEndReached={supportListPagination.onEndReached}
            onEndReachedThreshold={0.4}
            onMomentumScrollBegin={supportListPagination.onMomentumScrollBegin}
            onScrollBeginDrag={supportListPagination.onScrollBeginDrag}
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
                    <View style={styles.segmentRow}>
                        <TouchableOpacity style={[styles.segmentButton, !isMineView && styles.segmentButtonActive]} onPress={() => setSubView('open')}>
                            <Text style={[styles.segmentLabel, !isMineView && styles.segmentLabelActive]}>Open</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.segmentButton, isMineView && styles.segmentButtonActive]} onPress={() => setSubView('mine')}>
                            <Text style={[styles.segmentLabel, isMineView && styles.segmentLabelActive]}>My requests</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('create')}>
                            <Text style={styles.segmentLabel}>Create</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.heroCard}>
                        <Text style={styles.heroEyebrow}>SUPPORT</Text>
                        <Text style={styles.heroTitle}>{isMineView ? 'Requests you created.' : 'Open support requests from the community.'}</Text>
                        <Text style={styles.heroText}>
                            {isMineView
                                ? 'See how people responded, open a chat that fits, and close the request once you are okay.'
                                : 'Respond quickly when you can genuinely show up for someone.'}
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
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>{isMineView ? 'No support requests yet.' : 'No open requests right now.'}</Text>
                    <Text style={styles.emptySubtext}>{isMineView ? 'Create one when you need the community.' : 'Check back later or turn on availability in your profile.'}</Text>
                </View>
            }
            ListFooterComponent={(isMineView ? myRequestsQuery.isFetchingNextPage : openRequestsQuery.isFetchingNextPage) ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
            renderItem={({ item }) => (
                <SupportRequestCard
                    request={item}
                    isAvailableToSupport={isAvailableToSupport}
                    supportModes={supportModes}
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
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.background },
    list: { padding: Spacing.md, paddingBottom: 32 },
    segmentRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    segmentButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.full,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: Colors.light.backgroundSecondary,
    },
    segmentButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    fullWidthSegment: { flex: 2 },
    segmentLabel: { fontSize: Typography.sizes.sm, fontWeight: '600', color: Colors.light.textSecondary },
    segmentLabelActive: { color: Colors.textOn.primary },
    heroCard: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
    },
    heroEyebrow: { fontSize: Typography.sizes.xs, fontWeight: '700', color: Colors.primary, letterSpacing: 0.8, marginBottom: 6 },
    heroTitle: { fontSize: Typography.sizes.xl, fontWeight: '600', color: Colors.light.textPrimary },
    heroText: { fontSize: Typography.sizes.sm, color: Colors.light.textSecondary, lineHeight: 19, marginTop: Spacing.sm },
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
    availabilityModesLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    availabilityModesHint: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        lineHeight: 18,
        marginTop: Spacing.sm,
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
    availabilityModeChipMuted: { opacity: 0.6 },
    availabilityModeChipTextMuted: { color: Colors.light.textTertiary },
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
    input: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
        fontSize: Typography.sizes.md,
        color: Colors.light.textPrimary,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        marginTop: Spacing.md,
    },
    inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
    submitButton: {
        backgroundColor: Colors.success,
        borderRadius: Radii.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    submitButtonText: { color: Colors.textOn.primary, fontWeight: '600', fontSize: Typography.sizes.md },
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
    cardName: { fontSize: Typography.sizes.md, fontWeight: '600', color: Colors.light.textPrimary },
    badge: { backgroundColor: Colors.successSubtle, borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: Typography.sizes.xs, fontWeight: '700', color: Colors.success },
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
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
    emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm, textAlign: 'center' },
    footerLoader: { paddingVertical: Spacing.md },
});
