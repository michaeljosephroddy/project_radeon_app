import { appAlert } from '@/components/ui/appAlert';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Linking,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../../components/Avatar';
import { DiscoverActiveFiltersBar } from '../../components/discover/DiscoverActiveFiltersBar';
import { DiscoverEmptyState } from '../../components/discover/DiscoverEmptyState';
import { DiscoverFilterSheet } from '../../components/discover/DiscoverFilterSheet';
import { DatingDeck } from '../../components/discover/DatingDeck';
import { DatingLikesScreen } from '../../components/discover/DatingLikesScreen';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SearchBar } from '../../components/ui/SearchBar';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useInterests } from '../../hooks/queries/useInterests';
import { useDiscoverPreview } from '../../hooks/queries/useDiscoverPreview';
import { useDatingDiscoverPreview } from '../../hooks/queries/useDatingDiscoverPreview';
import { useDatingDiscoverResults } from '../../hooks/queries/useDatingDiscoverResults';
import { useDatingLikes } from '../../hooks/queries/useDatingLikes';
import { useDatingLikesPreview } from '../../hooks/queries/useDatingLikesPreview';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { useAuth } from '../../hooks/useAuth';
import {
    applyDiscoverPreviewEffectiveFilters,
    clearDiscoverChip,
    createDefaultDiscoverDraftFilters,
    createDiscoverDraftFromApplied,
    DISCOVER_DEFAULT_DISTANCE_KM,
    getDiscoverActiveChips,
    getDiscoverRelaxedCopy,
    hasNonDefaultDiscoverFilters,
    toDiscoverApiFilters,
    useDiscoverFilters,
    validateDiscoverDraft,
    type DiscoverAppliedFilters,
} from '../../hooks/useDiscoverFilters';
import { useDiscoverResults as useDiscoverResultsQuery } from '../../hooks/queries/useDiscoverResults';
import { getDeviceCoords } from '../../utils/location';
import type { Coords, DeviceLocationStatus } from '../../utils/location';
import { getRecoveryMilestone } from '../../utils/date';
import { formatUsername } from '../../utils/identity';
import { Colors, ControlSizes, Spacing, TextStyles, Typography, Radius, getAvatarColors } from '../../theme';
import { screenStandards } from '../../styles/screenStandards';
import { MeetingsView } from './support/MeetingsView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CARD_GAP = Spacing.md;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.md * 2 - CARD_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.34;

type DiscoverTab = 'friends' | 'meetings' | 'dating';

interface DiscoverScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onOpenChat: (chat: api.Chat) => void;
    onOpenRecoveryMeeting: (meeting: api.RecoveryMeeting) => void;
    onDatingLikesOpenChange?: (open: boolean) => void;
}

type DiscoverLocationState =
    | { status: 'loading' }
    | { status: 'available'; coords: Coords }
    | { status: Exclude<DeviceLocationStatus, 'available'> };

interface DiscoverCardProps {
    user: api.User;
    isFriended: boolean;
    onPress: () => void;
    onFriend: () => void;
}

interface SearchResultRowProps {
    user: api.User;
    isFriended: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onFriend: (id: string) => void;
}

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);

    return debounced;
}

const DiscoverCard = memo(function DiscoverCard({ user, isFriended, onPress, onFriend }: DiscoverCardProps) {
    const avatarColors = getAvatarColors(user.username);
    const milestone = getRecoveryMilestone(user.sober_since);

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
            {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: avatarColors.bg }]} />
            )}

            {!user.avatar_url ? (
                <View style={styles.cardInitials}>
                    <Text style={styles.cardInitialsText}>{user.username.slice(0, 2).toUpperCase()}</Text>
                </View>
            ) : null}

            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.cardScrim} />

            {user.friendship_status !== 'self' ? (
                <TouchableOpacity
                    style={[styles.cardAddBtn, isFriended && styles.cardAddBtnDone]}
                    onPress={(event) => {
                        event.stopPropagation();
                        if (!isFriended) onFriend();
                    }}
                    disabled={isFriended}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                    <Ionicons
                        name={isFriended ? 'checkmark' : 'person-add-outline'}
                        size={14}
                        color="#fff"
                    />
                </TouchableOpacity>
            ) : null}

            <View style={styles.cardFooter}>
                {milestone ? (
                    <View style={styles.cardMilestonePill}>
                        <Ionicons name="trophy-outline" size={10} color={Colors.textOn.warning} />
                        <Text style={styles.cardMilestoneText}>{milestone.currentLabel}</Text>
                    </View>
                ) : null}
                <Text style={styles.cardName} numberOfLines={1}>{formatUsername(user.username)}</Text>
            </View>
        </TouchableOpacity>
    );
});

const SearchResultRow = memo(function SearchResultRow({ user, isFriended, onOpenUserProfile, onFriend }: SearchResultRowProps) {
    const milestone = getRecoveryMilestone(user.sober_since);
    const locationLabel = user.city
        ? `${user.city}${user.country ? `, ${user.country}` : ''}`
        : user.country ?? null;

    return (
        <TouchableOpacity
            style={styles.resultRow}
            onPress={() => onOpenUserProfile({ userId: user.id, username: user.username, avatarUrl: user.avatar_url })}
            activeOpacity={0.8}
        >
            <Avatar username={user.username} avatarUrl={user.avatar_url} size={44} fontSize={16} />
            <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{formatUsername(user.username)}</Text>
                {(locationLabel || milestone) ? (
                    <Text style={styles.resultMeta} numberOfLines={1}>
                        {[milestone?.currentLabel, locationLabel].filter(Boolean).join(' · ')}
                    </Text>
                ) : null}
            </View>
            {user.friendship_status !== 'self' ? (
                <TouchableOpacity
                    style={[styles.resultFriendBtn, isFriended && styles.resultFriendBtnDone]}
                    onPress={() => {
                        if (!isFriended) onFriend(user.id);
                    }}
                    disabled={isFriended}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons
                        name={isFriended ? 'checkmark' : 'person-add-outline'}
                        size={16}
                        color={isFriended ? Colors.textOn.primary : Colors.primary}
                    />
                </TouchableOpacity>
            ) : null}
        </TouchableOpacity>
    );
});

function MatchModal({
    visible,
    match,
    openingChat,
    onClose,
    onOpenChat,
}: {
    visible: boolean;
    match: api.DatingMatch | null;
    openingChat: boolean;
    onClose: () => void;
    onOpenChat: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.matchModalBackdrop}>
                <View style={styles.matchModalCard}>
                    {match ? (
                        <Avatar
                            username={match.user.username}
                            avatarUrl={match.user.avatar_url}
                            size={82}
                            fontSize={28}
                        />
                    ) : null}
                    <Text style={styles.matchTitle}>It's a match</Text>
                    <Text style={styles.matchCopy}>
                        {match ? `You and ${formatUsername(match.user.username)} liked each other.` : 'You both liked each other.'}
                    </Text>
                    <PrimaryButton
                        label="Send message"
                        onPress={onOpenChat}
                        loading={openingChat}
                        leftAdornment={<Ionicons name="chatbubble-outline" size={16} color={Colors.textOn.primary} />}
                    />
                    <TouchableOpacity style={styles.keepBrowsingButton} onPress={onClose} activeOpacity={0.85}>
                        <Text style={styles.keepBrowsingText}>Keep browsing</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

function getResultsHeading(
    isSearching: boolean,
    hasFilters: boolean,
    broadened: boolean,
    isDatingTab: boolean,
): string {
    if (isSearching && hasFilters) {
        if (isDatingTab) {
            return broadened ? 'Close Dating matches in search' : 'Filtered Dating search results';
        }
        return broadened ? 'Close matches in search' : 'Filtered search results';
    }
    if (isSearching) {
        return isDatingTab ? 'Dating search results' : 'Search results';
    }
    if (hasFilters) {
        if (isDatingTab) {
            return broadened ? 'Close Dating matches' : 'Filtered Dating profiles';
        }
        return broadened ? 'Close matches' : 'Filtered people';
    }
    if (isDatingTab) {
        return 'Dating profiles';
    }
    return 'Suggested for you';
}

function getNoResultsCopy(
    isSearching: boolean,
    query: string,
    appliedFilters: DiscoverAppliedFilters,
    broadened: boolean,
    isDatingTab: boolean,
): { title: string; description: string } {
    const hasFilters = hasNonDefaultDiscoverFilters(appliedFilters);

    if (isSearching) {
        return {
            title: isDatingTab ? `No Dating profiles found for "${query}"` : `No people found for "${query}"`,
            description: hasFilters
                ? 'Try removing a filter or broadening your match pool.'
                : 'Try a shorter username or clear the search.',
        };
    }

    if (broadened) {
        return {
            title: isDatingTab ? 'No close Dating matches right now' : 'No close matches right now',
            description: 'Your broadened search still came up empty. Try clearing one or two filters and check back later.',
        };
    }

    if (hasFilters) {
        return {
            title: isDatingTab ? 'No Dating profiles match those filters' : 'No exact matches yet',
            description: isDatingTab
                ? 'Dating only includes people who also opted in. Try widening distance, easing your age range, or check back later.'
                : 'Try widening distance, easing your age range, or letting the app broaden results when inventory is low.',
        };
    }

    if (isDatingTab) {
        return {
            title: 'No Dating profiles nearby yet',
            description: 'Dating mode only includes people who also opted in. Try widening your filters or check back later.',
        };
    }

    return {
        title: 'No one here yet',
        description: 'Check back later for new members in the community.',
    };
}

function getDatingLocationCopy(status: DiscoverLocationState['status']): { title: string; description: string; primaryLabel: string } {
    if (status === 'services_off') {
        return {
            title: 'Turn on location services',
            description: 'Dating needs your location to apply distance filters. Turn on location services, or set distance to Anywhere.',
            primaryLabel: 'Open settings',
        };
    }

    if (status === 'denied') {
        return {
            title: 'Allow location',
            description: 'Dating needs location permission to show people within your selected distance. Allow location, or set distance to Anywhere.',
            primaryLabel: 'Allow location',
        };
    }

    return {
        title: 'Location needed',
        description: 'Dating needs your location to use distance filters. Try again, or set distance to Anywhere.',
        primaryLabel: 'Try again',
    };
}

function formatCompactCount(count: number): string {
    return count > 99 ? '99+' : String(count);
}

export function DiscoverScreen({ isActive, onOpenUserProfile, onOpenChat, onOpenRecoveryMeeting, onDatingLikesOpenChange }: DiscoverScreenProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const hasActivated = useLazyActivation(isActive);
    const [activeTab, setActiveTab] = useState<DiscoverTab>('friends');
    const [searchText, setSearchText] = useState('');
    const liveSearchText = searchText.trim();
    const debouncedQuery = useDebounce(liveSearchText, 400);
    const [filterSheetVisible, setFilterSheetVisible] = useState(false);
    const [showFilterNotice, setShowFilterNotice] = useState(true);
    const [locationState, setLocationState] = useState<DiscoverLocationState>({ status: 'loading' });
    const [friendedIds, setFriendedIds] = useState<Set<string>>(new Set());
    const [dismissedDatingIds, setDismissedDatingIds] = useState<Set<string>>(new Set());
    const [pendingDatingActionIds, setPendingDatingActionIds] = useState<Set<string>>(new Set());
    const [matchModal, setMatchModal] = useState<{ match: api.DatingMatch; chatId?: string | null } | null>(null);
    const [datingLikesOpen, setDatingLikesOpen] = useState(false);
    const [openingMatchChat, setOpeningMatchChat] = useState(false);
    const listRef = useRef<FlatList<api.User>>(null);
    const discoverScrollToTop = useScrollToTopButton({ threshold: 520 });
    const datingEnabled = user?.connection_intents?.includes('dating') ?? false;

    const {
        draftFilters,
        setDraftFilters,
        appliedState,
        setAppliedState,
        resetFilters,
        syncDraftToApplied,
    } = useDiscoverFilters();

    const refreshDeviceLocation = useCallback(async (): Promise<void> => {
        setLocationState({ status: 'loading' });
        const result = await getDeviceCoords();
        if (result.status === 'available' && result.coords) {
            setLocationState({ status: 'available', coords: result.coords });
            return;
        }
        if (result.status === 'denied' || result.status === 'services_off' || result.status === 'unavailable') {
            setLocationState({ status: result.status });
        }
    }, []);

    useEffect(() => {
        if (!hasActivated) return;
        void refreshDeviceLocation();
    }, [hasActivated, refreshDeviceLocation]);

    useEffect(() => {
        if (!datingEnabled && activeTab === 'dating') {
            setActiveTab('friends');
        }
    }, [activeTab, datingEnabled]);

    useEffect(() => {
        if (!isActive || activeTab !== 'dating') {
            setDatingLikesOpen(false);
        }
    }, [activeTab, isActive]);

    useEffect(() => {
        onDatingLikesOpenChange?.(isActive && activeTab === 'dating' && datingLikesOpen);
        return () => onDatingLikesOpenChange?.(false);
    }, [activeTab, datingLikesOpen, isActive, onDatingLikesOpenChange]);

    useEffect(() => {
        if (draftFilters.intent === 'dating') {
            setDraftFilters((current) => current.intent === 'dating'
                ? { ...current, intent: 'any' }
                : current);
        }

        if (appliedState.requested.intent === 'dating' || appliedState.effective.intent === 'dating') {
            setAppliedState((current) => {
                if (current.requested.intent !== 'dating' && current.effective.intent !== 'dating') {
                    return current;
                }

                return {
                    ...current,
                    requested: { ...current.requested, intent: 'any' },
                    effective: { ...current.effective, intent: 'any' },
                    broadened: false,
                    relaxedFields: current.relaxedFields.filter((field) => field !== 'intent'),
                };
            });
        }
    }, [
        appliedState.effective.intent,
        appliedState.requested.intent,
        draftFilters.intent,
        setAppliedState,
        setDraftFilters,
    ]);

    const coords = locationState.status === 'available' ? locationState.coords : null;
    const discoverLat = coords ? Math.round(coords.latitude * 100) / 100 : undefined;
    const discoverLng = coords ? Math.round(coords.longitude * 100) / 100 : undefined;
    const isDatingTab = activeTab === 'dating';
    const isFriendsTab = activeTab === 'friends';
    const isPeopleTab = isFriendsTab || isDatingTab;
    const isSearching = isFriendsTab && liveSearchText.length > 0;
    const hasCommittedSearch = isFriendsTab && debouncedQuery.length > 0;
    const isSearchPending = isSearching && liveSearchText !== debouncedQuery;
    const hasAppliedFilters = hasNonDefaultDiscoverFilters(appliedState.requested);
    const activeChips = useMemo(() => getDiscoverActiveChips(appliedState.requested), [appliedState.requested]);
    const broadenedCopy = appliedState.broadened ? getDiscoverRelaxedCopy(appliedState.relaxedFields) : null;
    const filterCount = activeChips.length;

    const validatedDraft = useMemo(() => validateDiscoverDraft(draftFilters), [draftFilters]);
    const peopleActive = isActive && isFriendsTab;
    const meetingsActive = isActive && activeTab === 'meetings';
    const tabIntent: api.ConnectionIntent | undefined = isDatingTab ? 'dating' : undefined;

    const draftApiFilters = useMemo(
        () => validatedDraft.normalized ? {
            ...toDiscoverApiFilters(validatedDraft.normalized),
            intent: tabIntent,
        } : undefined,
        [tabIntent, validatedDraft.normalized],
    );
    const datingDraftApiFilters = useMemo(() => {
        if (!validatedDraft.normalized) return undefined;
        const { intent: _intent, ...filters } = toDiscoverApiFilters(validatedDraft.normalized);
        return filters;
    }, [validatedDraft.normalized]);

    const interestOptionsQuery = useInterests(hasActivated && filterSheetVisible && isPeopleTab);

    const previewQuery = useDiscoverPreview({
        query: hasCommittedSearch ? debouncedQuery : undefined,
        ...draftApiFilters,
        lat: discoverLat,
        lng: discoverLng,
    }, Boolean(
        hasActivated
        && activeTab === 'friends'
        && filterSheetVisible
        && validatedDraft.normalized
        && hasNonDefaultDiscoverFilters(validatedDraft.normalized),
    ));
    const datingDraftDistanceKm = datingDraftApiFilters?.distanceKm ?? DISCOVER_DEFAULT_DISTANCE_KM;
    const datingPreviewNeedsLocation = datingDraftDistanceKm > 0;
    const datingPreviewQuery = useDatingDiscoverPreview({
        ...datingDraftApiFilters,
        lat: discoverLat,
        lng: discoverLng,
    }, Boolean(
        hasActivated
        && isDatingTab
        && filterSheetVisible
        && validatedDraft.normalized
        && hasNonDefaultDiscoverFilters(validatedDraft.normalized)
        && (!datingPreviewNeedsLocation || locationState.status === 'available')
    ));

    const effectiveApiFilters = useMemo(
        () => hasAppliedFilters ? toDiscoverApiFilters(appliedState.effective) : {},
        [appliedState.effective, hasAppliedFilters],
    );
    const datingEffectiveApiFilters = useMemo(() => {
        const { intent: _intent, ...filters } = toDiscoverApiFilters(appliedState.effective);
        return filters;
    }, [appliedState.effective]);
    const queryApiFilters = useMemo(
        () => ({
            ...effectiveApiFilters,
            intent: tabIntent,
        }),
        [effectiveApiFilters, tabIntent],
    );

    const discoverMode: 'suggested' | 'search' | 'filtered' = hasCommittedSearch
        ? 'search'
        : hasAppliedFilters || isDatingTab
            ? 'filtered'
            : 'suggested';

    const discoverQuery = useDiscoverResultsQuery({
        mode: discoverMode,
        query: hasCommittedSearch ? debouncedQuery : undefined,
        ...queryApiFilters,
        lat: discoverLat,
        lng: discoverLng,
        limit: 20,
    }, hasActivated && activeTab === 'friends');
    const datingQuery = useDatingDiscoverResults({
        ...datingEffectiveApiFilters,
        lat: discoverLat,
        lng: discoverLng,
        limit: 10,
    }, hasActivated && isDatingTab && (
        (datingEffectiveApiFilters.distanceKm ?? DISCOVER_DEFAULT_DISTANCE_KM) <= 0
        || locationState.status === 'available'
    ));
    const datingLikesQuery = useDatingLikes({ limit: 20 }, hasActivated && isDatingTab && datingEnabled);
    const datingLikesPreviewQuery = useDatingLikesPreview(hasActivated && isDatingTab && datingEnabled);
    const showSearchLoadingState = isSearchPending || (isSearching && hasCommittedSearch && discoverQuery.isLoading);
    const displayedUsers = isSearching
        ? (showSearchLoadingState ? [] : discoverQuery.users)
        : discoverQuery.users;
    const displayedDatingUsers = useMemo(
        () => datingQuery.users.filter((profile) => !dismissedDatingIds.has(profile.id)),
        [datingQuery.users, dismissedDatingIds],
    );
    const displayedDatingLikes = useMemo(
        () => datingLikesQuery.users.filter((profile) => !dismissedDatingIds.has(profile.id)),
        [datingLikesQuery.users, dismissedDatingIds],
    );
    const datingLikesCount = Math.max(
        datingLikesPreviewQuery.data?.exact_count ?? displayedDatingLikes.length,
        displayedDatingLikes.length,
    );

    const handleFriend = useCallback(async (id: string) => {
        setFriendedIds((current) => new Set([...current, id]));
        try {
            await api.sendFriendRequest(id);
        } catch (error) {
            setFriendedIds((current) => {
                const next = new Set(current);
                next.delete(id);
                return next;
            });
            appAlert.alert('Could not send request', error instanceof Error ? error.message : 'Please try again.');
        }
    }, []);

    const isFriendedFor = useCallback((profile: api.User) =>
        friendedIds.has(profile.id)
        || profile.friendship_status === 'outgoing'
        || profile.friendship_status === 'friends',
    [friendedIds]);

    const handleRefresh = useCallback(() => {
        void discoverQuery.refetch();
    }, [discoverQuery]);

    const handleLoadMore = useCallback(async () => {
        if (isSearchPending || !peopleActive || !discoverQuery.hasNextPage || discoverQuery.isFetchingNextPage || discoverQuery.isRefetching) {
            return;
        }
        await discoverQuery.fetchNextPage();
    }, [discoverQuery, isSearchPending, peopleActive]);
    const discoverListPagination = useGuardedEndReached(handleLoadMore);

    const handleOpenFilters = useCallback(() => {
        syncDraftToApplied();
        setFilterSheetVisible(true);
    }, [syncDraftToApplied]);

    const handleCloseFilters = useCallback(() => {
        setFilterSheetVisible(false);
    }, []);

    const handleApplyFilters = useCallback(() => {
        if (validatedDraft.error) {
            appAlert.alert('Invalid filters', validatedDraft.error);
            return;
        }

        if (!validatedDraft.normalized) {
            return;
        }

        const preview = isDatingTab ? datingPreviewQuery.data : previewQuery.data;
        const nextState = applyDiscoverPreviewEffectiveFilters(validatedDraft.normalized, preview);
        setAppliedState(nextState);
        setDraftFilters(createDiscoverDraftFromApplied(validatedDraft.normalized));
        setFilterSheetVisible(false);
    }, [datingPreviewQuery.data, isDatingTab, previewQuery.data, setAppliedState, setDraftFilters, validatedDraft]);

    const handleClearAllFilters = useCallback(() => {
        resetFilters();
    }, [resetFilters]);

    const handleClearChip = useCallback((chipKey: ReturnType<typeof getDiscoverActiveChips>[number]['key']) => {
        setAppliedState((current) => {
            const nextRequested = clearDiscoverChip(current.requested, chipKey);
            setDraftFilters(createDiscoverDraftFromApplied(nextRequested));
            return {
                requested: nextRequested,
                effective: nextRequested,
                broadened: false,
                relaxedFields: [],
            };
        });
    }, [setAppliedState, setDraftFilters]);

    const handleSetDatingDistanceAnywhere = useCallback((): void => {
        const requested = { ...appliedState.requested, distanceKm: 0 };
        const effective = { ...appliedState.effective, distanceKm: 0 };
        setAppliedState({
            requested,
            effective,
            broadened: false,
            relaxedFields: [],
        });
        setDraftFilters(createDiscoverDraftFromApplied(requested));
    }, [appliedState.effective, appliedState.requested, setAppliedState, setDraftFilters]);

    const handleOpenLocationSettings = useCallback((): void => {
        void Linking.openSettings().catch(() => {
            appAlert.alert('Could not open settings', 'Open your device settings and turn on location services for this app.');
        });
    }, []);

    const handleDatingAction = useCallback(async (profile: api.User, action: api.DatingAction): Promise<void> => {
        if (pendingDatingActionIds.has(profile.id)) return;

        setPendingDatingActionIds((current) => new Set([...current, profile.id]));
        setDismissedDatingIds((current) => new Set([...current, profile.id]));

        try {
            const result = await api.recordDatingAction(profile.id, action);
            if (result.matched && result.match) {
                setMatchModal({
                    match: result.match,
                    chatId: result.match.chat_id,
                });
                void queryClient.invalidateQueries({ queryKey: ['dating-matches'] });
                void queryClient.invalidateQueries({ queryKey: ['chats'] });
            }
            void queryClient.invalidateQueries({ queryKey: ['dating-likes'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-likes-preview'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-discover'] });
            if (displayedDatingUsers.length <= 3 && datingQuery.hasNextPage && !datingQuery.isFetchingNextPage) {
                void datingQuery.fetchNextPage();
            }
        } catch (error: unknown) {
            setDismissedDatingIds((current) => {
                const next = new Set(current);
                next.delete(profile.id);
                return next;
            });
            appAlert.alert(
                action === 'like' ? 'Could not like profile' : 'Could not pass profile',
                error instanceof Error ? error.message : 'Please try again.',
            );
        } finally {
            setPendingDatingActionIds((current) => {
                const next = new Set(current);
                next.delete(profile.id);
                return next;
            });
        }
    }, [
        datingQuery,
        displayedDatingUsers.length,
        pendingDatingActionIds,
        queryClient,
    ]);

    const handleOpenMatchChat = useCallback(async (): Promise<void> => {
        if (!matchModal?.chatId) {
            setMatchModal(null);
            return;
        }

        setOpeningMatchChat(true);
        try {
            const chat = await api.getChat(matchModal.chatId);
            setMatchModal(null);
            onOpenChat(chat);
        } catch (error: unknown) {
            appAlert.alert('Could not open chat', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setOpeningMatchChat(false);
        }
    }, [matchModal?.chatId, onOpenChat]);

    const resultsHeading = getResultsHeading(isSearching, hasAppliedFilters, appliedState.broadened, isDatingTab);
    const noResultsCopy = getNoResultsCopy(
        isSearching,
        debouncedQuery,
        appliedState.requested,
        appliedState.broadened,
        isDatingTab,
    );
    const showEmptyFilterAction = hasAppliedFilters || isDatingTab;
    const datingDistanceKm = datingEffectiveApiFilters.distanceKm ?? DISCOVER_DEFAULT_DISTANCE_KM;
    const datingNeedsLocation = datingDistanceKm > 0;
    const datingLocationBlocked = isDatingTab && datingNeedsLocation && locationState.status !== 'available';
    const datingLocationCopy = getDatingLocationCopy(locationState.status);
    const keyExtractor = useCallback((item: api.User) => item.id, []);
    const resultsHeader = useMemo(() => (
        <View style={styles.resultsHeader}>
            {showFilterNotice ? (
                <View style={styles.filterSummaryWrap}>
                    <InfoNoticeCard
                        title="Find people"
                        description="Search members and refine suggestions with filters."
                        onDismiss={() => setShowFilterNotice(false)}
                    />
                </View>
            ) : null}

            <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionHeading}>{resultsHeading}</Text>
                <Text style={styles.sectionCount}>
                    {displayedUsers.length}
                    {!showSearchLoadingState && discoverQuery.hasNextPage ? '+' : ''}
                </Text>
            </View>
        </View>
    ), [discoverQuery.hasNextPage, displayedUsers.length, resultsHeading, showFilterNotice, showSearchLoadingState]);
    const renderSearchItem = useCallback(({ item }: { item: api.User }) => (
        <SearchResultRow
            user={item}
            isFriended={isFriendedFor(item)}
            onOpenUserProfile={onOpenUserProfile}
            onFriend={handleFriend}
        />
    ), [handleFriend, isFriendedFor, onOpenUserProfile]);
    const renderGridItem = useCallback(({ item }: { item: api.User }) => (
        <DiscoverCard
            user={item}
            isFriended={isFriendedFor(item)}
            onPress={() => onOpenUserProfile({
                userId: item.id,
                username: item.username,
                avatarUrl: item.avatar_url,
            })}
            onFriend={() => handleFriend(item.id)}
        />
    ), [handleFriend, isFriendedFor, onOpenUserProfile]);

    const discoverTabs = useMemo(
        () => [
            { key: 'friends', label: 'Friends' },
            { key: 'meetings', label: 'Meetings' },
            ...(datingEnabled ? [{ key: 'dating', label: 'Dating' }] : []),
        ],
        [datingEnabled],
    );

    const surfaceTabs = (
        <View style={screenStandards.pageTabsWrap}>
            <SegmentedControl
                items={discoverTabs}
                activeKey={activeTab}
                onChange={(next) => setActiveTab(next as DiscoverTab)}
                layer="page"
                tone="primary"
                style={screenStandards.pageTabsControl}
            />
        </View>
    );

    if (activeTab === 'meetings') {
        return (
            <View style={styles.container}>
                {surfaceTabs}
                <MeetingsView isActive={meetingsActive} onOpenMeeting={onOpenRecoveryMeeting} />
            </View>
        );
    }

    if (isDatingTab && datingLikesOpen) {
        return (
            <View style={styles.container}>
                <DatingLikesScreen
                    likes={displayedDatingLikes}
                    loading={datingLikesQuery.isLoading}
                    fetchingNext={datingLikesQuery.isFetchingNextPage}
                    hasNextPage={Boolean(datingLikesQuery.hasNextPage)}
                    pendingActionIds={pendingDatingActionIds}
                    onBack={() => setDatingLikesOpen(false)}
                    onLike={(profile) => void handleDatingAction(profile, 'like')}
                    onPass={(profile) => void handleDatingAction(profile, 'pass')}
                    onOpenProfile={(profile) => {
                        setDatingLikesOpen(false);
                        onOpenUserProfile({
                            userId: profile.id,
                            username: profile.username,
                            avatarUrl: profile.avatar_url,
                        });
                    }}
                    onLoadMore={() => {
                        if (datingLikesQuery.hasNextPage && !datingLikesQuery.isFetchingNextPage) {
                            void datingLikesQuery.fetchNextPage();
                        }
                    }}
                />

                <MatchModal
                    visible={matchModal !== null}
                    match={matchModal?.match ?? null}
                    openingChat={openingMatchChat}
                    onClose={() => setMatchModal(null)}
                    onOpenChat={() => void handleOpenMatchChat()}
                />
            </View>
        );
    }

    if (isDatingTab) {
        const likesPreview = displayedDatingLikes.slice(0, 3);
        const datingControls = (
            <View style={styles.datingControlsRow}>
                <TouchableOpacity
                    style={styles.datingControlButton}
                    onPress={() => {
                        setFilterSheetVisible(false);
                        setDatingLikesOpen(true);
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Open people who liked you"
                >
                    <Ionicons name="heart-outline" size={20} color={Colors.text.primary} />
                    <View style={styles.likesPreviewBody}>
                        <Text style={styles.datingControlLabel}>Users who liked you</Text>
                        {likesPreview.length ? (
                            <View style={styles.likesPreviewRow}>
                                <View style={styles.likesPreviewCluster}>
                                    {likesPreview.map((profile, index) => (
                                        <View
                                            key={profile.id}
                                            style={[
                                                styles.likesPreviewAvatarWrap,
                                                { left: index * 16, zIndex: 10 - index },
                                            ]}
                                        >
                                            <Avatar
                                                username={profile.username}
                                                avatarUrl={profile.avatar_url ?? undefined}
                                                size={22}
                                                fontSize={9}
                                            />
                                        </View>
                                    ))}
                                </View>
                                <Text style={styles.likesPreviewCount}>
                                    {datingLikesCount > 3 ? `+${formatCompactCount(datingLikesCount - 3)} more` : formatCompactCount(datingLikesCount)}
                                </Text>
                            </View>
                        ) : datingLikesCount > 0 ? (
                            <Text style={styles.likesPreviewCount}>{formatCompactCount(datingLikesCount)}</Text>
                        ) : null}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.datingFilterButton}
                    onPress={handleOpenFilters}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Open dating filters"
                >
                    <View style={styles.datingFilterIconWrap}>
                        <Ionicons name="options-outline" size={20} color={Colors.text.primary} />
                        {filterCount > 0 ? (
                            <View style={styles.datingControlBadge}>
                                <Text style={styles.datingControlBadgeText}>{filterCount}</Text>
                            </View>
                        ) : null}
                    </View>
                    <Text style={styles.datingFilterLabel}>Filters</Text>
                </TouchableOpacity>
            </View>
        );

        return (
            <View style={styles.container}>
                {surfaceTabs}
                <View style={styles.datingControls}>
                    {datingControls}
                </View>
                {activeChips.length || broadenedCopy ? (
                    <View style={styles.datingFilterSummary}>
                        <DiscoverActiveFiltersBar
                            chips={activeChips}
                            broadenedCopy={broadenedCopy}
                            onRemoveChip={handleClearChip}
                            onClearAll={handleClearAllFilters}
                        />
                    </View>
                ) : null}

                {datingLocationBlocked ? (
                    locationState.status === 'loading' ? (
                        <View style={styles.center}>
                            <ActivityIndicator color={Colors.primary} size="large" />
                        </View>
                    ) : (
                        <DiscoverEmptyState
                            title={datingLocationCopy.title}
                            description={datingLocationCopy.description}
                            primaryLabel={datingLocationCopy.primaryLabel}
                            onPrimaryPress={locationState.status === 'services_off'
                                ? handleOpenLocationSettings
                                : () => void refreshDeviceLocation()}
                            secondaryLabel="Set distance to Anywhere"
                            onSecondaryPress={handleSetDatingDistanceAnywhere}
                        />
                    )
                ) : (
                    <DatingDeck
                        users={displayedDatingUsers}
                        loading={datingQuery.isLoading}
                        fetchingNext={datingQuery.isFetchingNextPage}
                        emptyTitle={noResultsCopy.title}
                        emptyDescription={noResultsCopy.description}
                        onLike={(profile) => void handleDatingAction(profile, 'like')}
                        onPass={(profile) => void handleDatingAction(profile, 'pass')}
                        onOpenProfile={(profile) => onOpenUserProfile({
                            userId: profile.id,
                            username: profile.username,
                            avatarUrl: profile.avatar_url,
                        })}
                        onLoadMore={() => {
                            if (datingQuery.hasNextPage && !datingQuery.isFetchingNextPage) {
                                void datingQuery.fetchNextPage();
                            }
                        }}
                    />
                )}

                <MatchModal
                    visible={matchModal !== null}
                    match={matchModal?.match ?? null}
                    openingChat={openingMatchChat}
                    onClose={() => setMatchModal(null)}
                    onOpenChat={() => void handleOpenMatchChat()}
                />

                <DiscoverFilterSheet
                    visible={filterSheetVisible}
                    draftFilters={draftFilters}
                    onChangeFilters={setDraftFilters}
                    preview={datingPreviewQuery.data}
                    previewLoading={datingPreviewQuery.isFetching}
                    validationError={validatedDraft.error}
                    interestOptions={interestOptionsQuery.data ?? []}
                    onClose={handleCloseFilters}
                    onReset={() => setDraftFilters(createDefaultDiscoverDraftFilters())}
                    onApply={handleApplyFilters}
                />
            </View>
        );
    }

    if (!isSearching && discoverQuery.isLoading && discoverQuery.users.length === 0) {
        return (
            <View style={styles.container}>
                {surfaceTabs}
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {surfaceTabs}
            <View style={styles.controls}>
                <View style={styles.searchRow}>
                    <SearchBar
                        style={styles.searchBar}
                        variant="pill"
                        leading={<Ionicons name="search-outline" size={18} color={Colors.text.muted} />}
                        primaryField={{
                            value: searchText,
                            onChangeText: setSearchText,
                            placeholder: 'Search by username...',
                            autoCapitalize: 'none',
                            autoCorrect: false,
                            returnKeyType: 'search',
                            clearButtonMode: 'while-editing',
                        }}
                    />

                    <TouchableOpacity style={styles.filterButton} onPress={handleOpenFilters} activeOpacity={0.85}>
                        <Ionicons name="options-outline" size={20} color={Colors.text.primary} />
                        {filterCount > 0 ? (
                            <View style={styles.filterBadge}>
                                <Text style={styles.filterBadgeText}>{filterCount}</Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                </View>

                <DiscoverActiveFiltersBar
                    chips={activeChips}
                    broadenedCopy={broadenedCopy}
                    onRemoveChip={handleClearChip}
                    onClearAll={handleClearAllFilters}
                />
            </View>

            {displayedUsers.length === 0 && !discoverQuery.isLoading && !showSearchLoadingState ? (
                <DiscoverEmptyState
                    title={noResultsCopy.title}
                    description={noResultsCopy.description}
                    primaryLabel={showEmptyFilterAction ? 'Edit filters' : undefined}
                    onPrimaryPress={showEmptyFilterAction ? handleOpenFilters : undefined}
                    secondaryLabel={hasAppliedFilters ? 'Clear filters' : undefined}
                    onSecondaryPress={hasAppliedFilters ? handleClearAllFilters : undefined}
                />
            ) : isSearching ? (
                <FlatList
                    ref={listRef}
                    key="discover-search-list"
                    data={displayedUsers}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.resultsContent}
                    refreshControl={(
                        <RefreshControl
                            refreshing={discoverQuery.isRefetching && !discoverQuery.isFetchingNextPage}
                            onRefresh={handleRefresh}
                            tintColor={Colors.primary}
                        />
                    )}
                    ListHeaderComponent={resultsHeader}
                    renderItem={renderSearchItem}
                    onEndReached={discoverListPagination.onEndReached}
                    onEndReachedThreshold={0.35}
                    onMomentumScrollBegin={discoverListPagination.onMomentumScrollBegin}
                    onScrollBeginDrag={discoverListPagination.onScrollBeginDrag}
                    onScroll={discoverScrollToTop.onScroll}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={10}
                    maxToRenderPerBatch={8}
                    windowSize={9}
                    ListEmptyComponent={showSearchLoadingState ? (
                        <View style={styles.searchStatusCard}>
                            <View style={styles.searchStatusRow}>
                                <ActivityIndicator size="small" color={Colors.primary} />
                                <Text style={styles.searchStatusText}>Searching people…</Text>
                            </View>
                        </View>
                    ) : null}
                    ListFooterComponent={discoverQuery.isFetchingNextPage
                        ? <ActivityIndicator color={Colors.primary} style={styles.listFooter} />
                        : null}
                />
            ) : (
                <FlatList
                    ref={listRef}
                    key="discover-grid-list"
                    data={displayedUsers}
                    keyExtractor={keyExtractor}
                    numColumns={2}
                    columnWrapperStyle={styles.gridRow}
                    contentContainerStyle={styles.gridContent}
                    refreshControl={(
                        <RefreshControl
                            refreshing={discoverQuery.isRefetching && !discoverQuery.isFetchingNextPage}
                            onRefresh={handleRefresh}
                            tintColor={Colors.primary}
                        />
                    )}
                    ListHeaderComponent={resultsHeader}
                    renderItem={renderGridItem}
                    initialNumToRender={8}
                    maxToRenderPerBatch={6}
                    windowSize={7}
                    onEndReached={discoverListPagination.onEndReached}
                    onEndReachedThreshold={0.4}
                    onMomentumScrollBegin={discoverListPagination.onMomentumScrollBegin}
                    onScrollBeginDrag={discoverListPagination.onScrollBeginDrag}
                    onScroll={discoverScrollToTop.onScroll}
                    scrollEventThrottle={16}
                    ListFooterComponent={discoverQuery.isFetchingNextPage
                        ? <ActivityIndicator color={Colors.primary} style={styles.listFooter} />
                        : null}
                />
            )}

            {peopleActive && discoverScrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}

            <DiscoverFilterSheet
                visible={filterSheetVisible}
                draftFilters={draftFilters}
                onChangeFilters={setDraftFilters}
                preview={previewQuery.data}
                previewLoading={previewQuery.isFetching}
                validationError={validatedDraft.error}
                interestOptions={interestOptionsQuery.data ?? []}
                onClose={handleCloseFilters}
                onReset={() => setDraftFilters(createDefaultDiscoverDraftFilters())}
                onApply={handleApplyFilters}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.page,
    },
    controls: {
        paddingHorizontal: Spacing.md,
        paddingTop: 0,
        paddingBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    datingFilterSummary: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    datingControls: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    datingControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    datingControlButton: {
        flex: 1,
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.sm,
    },
    likesPreviewBody: {
        flex: 1,
        minWidth: 0,
        gap: 3,
    },
    likesPreviewRow: {
        minHeight: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    likesPreviewCluster: {
        width: 56,
        height: 24,
    },
    likesPreviewAvatarWrap: {
        position: 'absolute',
        top: 0,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.bg.surface,
    },
    likesPreviewCount: {
        ...TextStyles.caption,
        color: Colors.text.secondary,
        fontWeight: '700',
    },
    datingFilterButton: {
        minHeight: 54,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.sm,
    },
    datingFilterIconWrap: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    datingControlBadge: {
        position: 'absolute',
        top: -8,
        right: -8,
        minWidth: 18,
        height: 18,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 5,
    },
    datingControlBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: Colors.textOn.primary,
    },
    datingControlLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    datingFilterLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    searchBar: {
        flex: 1,
        minHeight: 50,
    },
    searchStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    searchStatusCard: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    searchStatusText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    filterButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
    },
    filterBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    resultsHeader: {
        paddingTop: 0,
        gap: Spacing.sm,
    },
    filterSummaryWrap: {
        paddingHorizontal: Spacing.md,
    },
    sectionHeadingRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    sectionHeading: {
        flex: 1,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    sectionCount: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
    },
    resultsContent: {
        paddingTop: 0,
        paddingBottom: Spacing.xl,
    },
    gridContent: {
        paddingTop: 0,
        paddingBottom: Spacing.xl,
    },
    gridRow: {
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.md,
    },
    card: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: Radius.lg,
        overflow: 'hidden',
        backgroundColor: Colors.bg.surface,
    },
    cardInitials: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardInitialsText: {
        fontSize: Typography.sizes.xxxl,
        fontWeight: '700',
        color: Colors.textOn.primary,
        letterSpacing: 2,
    },
    cardScrim: {
        ...StyleSheet.absoluteFillObject,
    },
    cardAddBtn: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        width: ControlSizes.iconButton,
        height: ControlSizes.iconButton,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(13,110,253,0.92)',
    },
    cardAddBtnDone: {
        backgroundColor: 'rgba(25,135,84,0.95)',
    },
    cardFooter: {
        position: 'absolute',
        left: Spacing.sm,
        right: Spacing.sm,
        bottom: Spacing.sm,
        gap: Spacing.xs,
    },
    cardMilestonePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: Radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    cardMilestoneText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.textOn.warning,
    },
    cardName: {
        fontSize: TextStyles.cardTitle.fontSize,
        fontWeight: TextStyles.label.fontWeight,
        color: '#fff',
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
    },
    resultInfo: {
        flex: 1,
        gap: 2,
    },
    resultName: {
        ...TextStyles.bodyEmphasis,
    },
    resultMeta: {
        ...TextStyles.secondary,
    },
    resultFriendBtn: {
        width: ControlSizes.iconButton,
        height: ControlSizes.iconButton,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    resultFriendBtnDone: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    listFooter: {
        marginVertical: Spacing.lg,
    },
    matchModalBackdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.46)',
        padding: Spacing.xl,
    },
    matchModalCard: {
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        gap: Spacing.md,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        padding: Spacing.xl,
    },
    matchTitle: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '700',
        color: Colors.text.primary,
        textAlign: 'center',
    },
    matchCopy: {
        fontSize: Typography.sizes.base,
        lineHeight: 21,
        color: Colors.text.secondary,
        textAlign: 'center',
    },
    keepBrowsingButton: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    keepBrowsingText: {
        fontSize: Typography.sizes.base,
        fontWeight: '700',
        color: Colors.text.secondary,
    },
});
