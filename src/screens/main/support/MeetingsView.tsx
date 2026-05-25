import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecoveryMeetingCard } from '../../../components/support/RecoveryMeetingCard';
import { RecoveryMeetingFilterSheet } from '../../../components/support/RecoveryMeetingFilterSheet';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { SearchBar } from '../../../components/ui/SearchBar';
import { ScrollToTopButton } from '../../../components/ui/ScrollToTopButton';
import { useGuardedEndReached } from '../../../hooks/useGuardedEndReached';
import { useLocalMixedRecoveryMeetings, useRecoveryMeetings } from '../../../hooks/queries/useRecoveryMeetings';
import { useScrollToTopButton } from '../../../hooks/useScrollToTopButton';
import { screenStandards } from '../../../styles/screenStandards';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { getListPerformanceProps } from '../../../utils/listPerformance';
import { getDeviceCoords, reverseGeocodePlace, type ReverseGeocodedPlace } from '../../../utils/location';
import {
    ActiveFilterChip,
    DEFAULT_MEETING_FILTERS,
    RecoveryMeeting,
    RecoveryMeetingFilters,
    cloneMeetingFilters,
    filtersToApiParams,
    getActiveFilterChips,
} from './recoveryMeetings';

interface MeetingsViewProps {
    isActive: boolean;
    onOpenMeeting?: (meeting: RecoveryMeeting) => void;
}

const SEARCH_DEBOUNCE_MS = 500;
const MIN_SEARCH_QUERY_LENGTH = 2;

function useDebounce<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}

function resetMeetingFilters(): RecoveryMeetingFilters {
    return cloneMeetingFilters(DEFAULT_MEETING_FILTERS);
}

function normalizeSearchQuery(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
        return '';
    }
    return trimmed;
}

type LocalPlaceStatus = 'idle' | 'loading' | 'resolved' | 'unavailable';

interface LocalMeetingFallback {
    location?: string;
    country?: string;
    label: string;
}

function normalizePlacePart(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function samePlace(a: string | null, b: string | null): boolean {
    return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function formatLocalPlaceLabel(location?: string, country?: string): string {
    return [location, country].filter(Boolean).join(', ');
}

function buildLocalFallbacks(place: ReverseGeocodedPlace | null): LocalMeetingFallback[] {
    if (!place) return [];

    const city = normalizePlacePart(place.city);
    const region = normalizePlacePart(place.region);
    const country = normalizePlacePart(place.country);
    const fallbacks: LocalMeetingFallback[] = [];

    if (city) {
        fallbacks.push({
            location: city,
            country: country ?? undefined,
            label: formatLocalPlaceLabel(city, country ?? undefined),
        });
    }
    if (region && !samePlace(region, city)) {
        fallbacks.push({
            location: region,
            country: country ?? undefined,
            label: formatLocalPlaceLabel(region, country ?? undefined),
        });
    }
    if (country) {
        fallbacks.push({ country, label: country });
    }

    fallbacks.push({ label: 'All meetings' });
    return fallbacks;
}

export function MeetingsView({ isActive, onOpenMeeting }: MeetingsViewProps) {
    const listRef = useRef<FlatList<RecoveryMeeting> | null>(null);
    const didRequestLocalPlace = useRef(false);
    const [draftFilters, setDraftFilters] = useState<RecoveryMeetingFilters>(() => resetMeetingFilters());
    const [appliedFilters, setAppliedFilters] = useState<RecoveryMeetingFilters>(() => resetMeetingFilters());
    const [filterOpen, setFilterOpen] = useState(false);
    const [localPlaceStatus, setLocalPlaceStatus] = useState<LocalPlaceStatus>('idle');
    const [localPlace, setLocalPlace] = useState<ReverseGeocodedPlace | null>(null);
    const debouncedQuery = useDebounce(draftFilters.query, SEARCH_DEBOUNCE_MS);
    const listProps = getListPerformanceProps('detailList');
    const scrollToTop = useScrollToTopButton({ threshold: 320 });
    const localFallbacks = useMemo(() => buildLocalFallbacks(localPlace), [localPlace]);
    const draftQuery = draftFilters.query.trim();
    const normalizedDraftQuery = normalizeSearchQuery(draftQuery);
    const isShortSearchQuery = draftQuery.length > 0 && draftQuery.length < MIN_SEARCH_QUERY_LENGTH;
    const isSearchDebouncing = normalizedDraftQuery !== appliedFilters.query;
    const hasManualFinderIntent = Boolean(
        draftQuery
        || appliedFilters.query.trim()
        || appliedFilters.location.trim()
        || appliedFilters.country.trim()
        || appliedFilters.fellowship
        || appliedFilters.meetingType
        || appliedFilters.dayOfWeek !== null
    );
    const canUseLocalMixed = localPlaceStatus === 'resolved'
        && !hasManualFinderIntent
        && localFallbacks.length > 0;
    const apiFilters = useMemo(() => {
        return filtersToApiParams(appliedFilters);
    }, [appliedFilters]);
    const shouldWaitForLocalPlace = !hasManualFinderIntent
        && (localPlaceStatus === 'idle' || localPlaceStatus === 'loading');
    const recoveryMeetingsQuery = useRecoveryMeetings(
        { ...apiFilters, limit: 20 },
        isActive && !shouldWaitForLocalPlace && !canUseLocalMixed && !isShortSearchQuery && !isSearchDebouncing,
    );
    const localMixedQuery = useLocalMixedRecoveryMeetings(localFallbacks, isActive && canUseLocalMixed, 20);

    useEffect(() => {
        const nextQuery = normalizeSearchQuery(debouncedQuery);
        setAppliedFilters((current) => (
            current.query === nextQuery ? current : { ...current, query: nextQuery }
        ));
    }, [debouncedQuery]);

    useEffect(() => {
        if (!isActive || didRequestLocalPlace.current) {
            return;
        }

        let cancelled = false;
        didRequestLocalPlace.current = true;
        setLocalPlaceStatus('loading');

        async function resolveLocalPlace(): Promise<void> {
            const location = await getDeviceCoords();
            if (cancelled) return;

            if (location.status !== 'available' || !location.coords) {
                setLocalPlaceStatus('unavailable');
                return;
            }

            const place = await reverseGeocodePlace(location.coords.latitude, location.coords.longitude);
            if (cancelled) return;

            if (place) {
                setLocalPlace(place);
                setLocalPlaceStatus('resolved');
            } else {
                setLocalPlaceStatus('unavailable');
            }
        }

        void resolveLocalPlace();

        return () => {
            cancelled = true;
        };
    }, [isActive]);

    const meetings = useMemo(() => (
        canUseLocalMixed
            ? localMixedQuery.data?.items ?? []
            : recoveryMeetingsQuery.data?.pages.flatMap((page) => page.items) ?? []
    ), [canUseLocalMixed, localMixedQuery.data?.items, recoveryMeetingsQuery.data]);

    const activeFilterChips = useMemo(
        () => getActiveFilterChips(appliedFilters),
        [appliedFilters],
    );
    const localStatusText = useMemo(() => {
        if (hasManualFinderIntent) {
            return null;
        }
        if (localPlaceStatus === 'loading' || localPlaceStatus === 'idle') {
            return 'Finding meetings in your area';
        }
        const localLabel = localFallbacks.find((fallback) => fallback.location || fallback.country)?.label;
        return localLabel ? `Local AA, CA and NA near ${localLabel}` : null;
    }, [hasManualFinderIntent, localFallbacks, localPlaceStatus]);

    const loadNextPage = useCallback(async (): Promise<void> => {
        if (canUseLocalMixed) {
            return;
        }
        if (!recoveryMeetingsQuery.hasNextPage || recoveryMeetingsQuery.isFetchingNextPage) {
            return;
        }
        await recoveryMeetingsQuery.fetchNextPage();
    }, [canUseLocalMixed, recoveryMeetingsQuery]);

    const pagination = useGuardedEndReached(loadNextPage);

    const handleApplyFilters = (): void => {
        setAppliedFilters(cloneMeetingFilters(draftFilters));
        setFilterOpen(false);
    };

    const handleResetFilters = (): void => {
        const reset = resetMeetingFilters();
        setDraftFilters(reset);
        setAppliedFilters(reset);
    };

    const clearAppliedFilter = (patch: Partial<RecoveryMeetingFilters>): void => {
        setAppliedFilters((current) => ({ ...current, ...patch }));
        setDraftFilters((current) => ({ ...current, ...patch }));
    };

    const removeActiveFilter = (chip: ActiveFilterChip): void => {
        const next = chip.remove(appliedFilters);
        setAppliedFilters(next);
        setDraftFilters(next);
    };

    const isFindingLocalMeetings = isActive && shouldWaitForLocalPlace;
    const isLoadingMeetings = canUseLocalMixed ? localMixedQuery.isLoading : recoveryMeetingsQuery.isLoading;
    const isMeetingsError = canUseLocalMixed ? localMixedQuery.isError : recoveryMeetingsQuery.isError;
    const emptyTitle = isShortSearchQuery
        ? 'Keep typing to search'
        : isFindingLocalMeetings
        ? 'Finding local meetings'
        : isLoadingMeetings
        ? 'Loading recovery meetings'
        : isMeetingsError
            ? 'Could not load recovery meetings'
            : 'No meetings match those filters';
    const emptyDescription = isShortSearchQuery
        ? 'Enter at least two characters to search meetings, places, or fellowships.'
        : isFindingLocalMeetings
        ? 'SoberSpace is checking your town, region, and country before loading the first page.'
        : isLoadingMeetings
        ? 'Real meeting data is loading from SoberSpace.'
        : isMeetingsError
            ? 'Check your connection, then pull to refresh.'
            : 'Try a wider location, another day, or clearing fellowship and mode filters.';
    const showEmptyActions = !isShortSearchQuery && !isFindingLocalMeetings && !isLoadingMeetings && !isMeetingsError;

    const renderHeader = (): React.ReactElement => (
        <View style={styles.header}>
            <View style={styles.searchRow}>
                <SearchBar
                    primaryField={{
                        value: draftFilters.query,
                        onChangeText: (value) => setDraftFilters((current) => ({ ...current, query: value })),
                        placeholder: 'Search meetings, places, tags',
                        returnKeyType: 'search',
                    }}
                    style={styles.searchBar}
                    leading={<Ionicons name="search-outline" size={18} color={Colors.text.muted} />}
                />
                <TouchableOpacity style={styles.filterButton} onPress={() => setFilterOpen(true)} activeOpacity={0.86}>
                    <Ionicons name="options-outline" size={20} color={Colors.text.primary} />
                    {activeFilterChips.length ? (
                        <View style={styles.filterBadge}>
                            <Text style={styles.filterBadgeText}>{activeFilterChips.length}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
            </View>
            {activeFilterChips.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChipRow}>
                    {activeFilterChips.map((chip) => (
                        <TouchableOpacity
                            key={chip.key}
                            style={styles.activeChip}
                            onPress={() => removeActiveFilter(chip)}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.activeChipText}>{chip.label}</Text>
                            <Ionicons name="close" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            ) : null}
            {localStatusText ? (
                <View style={styles.localStatusRow}>
                    <Ionicons name="navigate-outline" size={14} color={Colors.text.muted} />
                    <Text style={styles.localStatusText}>{localStatusText}</Text>
                </View>
            ) : null}
        </View>
    );

    const renderEmptyState = (): React.ReactElement => (
        <View style={styles.emptyState}>
            <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                compact
            />
            {showEmptyActions ? (
                <View style={styles.emptyActions}>
                    {appliedFilters.location.trim() ? (
                        <TouchableOpacity
                            style={styles.emptyAction}
                            onPress={() => clearAppliedFilter({ location: '' })}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.emptyActionText}>Clear location</Text>
                        </TouchableOpacity>
                    ) : null}
                    {appliedFilters.meetingType ? (
                        <TouchableOpacity
                            style={styles.emptyAction}
                            onPress={() => clearAppliedFilter({ meetingType: '' })}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.emptyActionText}>Clear mode</Text>
                        </TouchableOpacity>
                    ) : null}
                    <PrimaryButton
                        label="Reset all filters"
                        variant="secondary"
                        onPress={handleResetFilters}
                        style={styles.emptyResetButton}
                        textStyle={styles.emptyResetText}
                    />
                </View>
            ) : null}
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList<RecoveryMeeting>
                ref={listRef}
                data={meetings}
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
                        refreshing={
                            canUseLocalMixed
                                ? localMixedQuery.isRefetching
                                : recoveryMeetingsQuery.isRefetching && !recoveryMeetingsQuery.isFetchingNextPage
                        }
                        onRefresh={() => {
                            if (canUseLocalMixed) {
                                void localMixedQuery.refetch();
                                return;
                            }
                            void recoveryMeetingsQuery.refetch();
                        }}
                        tintColor={Colors.primary}
                    />
                }
                contentContainerStyle={screenStandards.listContent}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmptyState}
                ListFooterComponent={
                    !canUseLocalMixed && recoveryMeetingsQuery.isFetchingNextPage ? (
                        <View style={styles.footerLoading}>
                            <ActivityIndicator color={Colors.primary} />
                        </View>
                    ) : null
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => (
                    <RecoveryMeetingCard meeting={item} onPress={onOpenMeeting ?? (() => undefined)} />
                )}
            />

            <RecoveryMeetingFilterSheet
                visible={filterOpen}
                draftFilters={draftFilters}
                onChangeFilters={setDraftFilters}
                onClose={() => setFilterOpen(false)}
                onReset={handleResetFilters}
                onApply={handleApplyFilters}
            />

            {isActive && scrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    header: {
        gap: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    searchBar: {
        flex: 1,
    },
    filterButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    filterBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    filterBadgeText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
    },
    activeChipRow: {
        gap: Spacing.sm,
    },
    activeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: 9,
    },
    activeChipText: {
        color: Colors.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    localStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: Spacing.sm,
    },
    localStatusText: {
        color: Colors.text.secondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    separator: {
        height: Spacing.md,
    },
    emptyState: {
        marginTop: Spacing.xl,
        gap: Spacing.lg,
    },
    emptyActions: {
        alignItems: 'center',
        gap: Spacing.sm,
    },
    emptyAction: {
        minHeight: 38,
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    emptyActionText: {
        color: Colors.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    emptyResetButton: {
        minHeight: 38,
        paddingHorizontal: Spacing.lg,
        paddingVertical: 8,
    },
    emptyResetText: {
        fontSize: Typography.sizes.sm,
    },
    footerLoading: {
        paddingVertical: Spacing.lg,
    },
});
