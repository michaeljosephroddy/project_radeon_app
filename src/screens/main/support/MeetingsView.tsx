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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RecoveryMeetingCard } from '../../../components/support/RecoveryMeetingCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { SearchBar } from '../../../components/ui/SearchBar';
import { ScrollToTopButton } from '../../../components/ui/ScrollToTopButton';
import { useGuardedEndReached } from '../../../hooks/useGuardedEndReached';
import { useAuth } from '../../../hooks/useAuth';
import { useRecoveryMeetings } from '../../../hooks/queries/useRecoveryMeetings';
import { useScrollToTopButton } from '../../../hooks/useScrollToTopButton';
import * as api from '../../../api/client';
import { screenStandards } from '../../../styles/screenStandards';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { getListPerformanceProps } from '../../../utils/listPerformance';
import { getDeviceCoords, getPlaceLocationCandidates, reverseGeocodePlace, type ReverseGeocodedPlace } from '../../../utils/location';
import { setRecoveryMeetingFiltersRouteState } from '../../../navigation/filterRouteStores';
import type { RootStackParamList } from '../../../navigation/types';
import {
    DEFAULT_LOCAL_FELLOWSHIPS,
    RecoveryMeeting,
} from './recoveryMeetings';
import { useRecoveryMeetingFilters } from './useRecoveryMeetingFilters';

interface MeetingsViewProps {
    isActive: boolean;
    onOpenMeeting?: (meeting: RecoveryMeeting) => void;
}

type LocalPlaceStatus = 'idle' | 'loading' | 'resolved' | 'unavailable';

interface LocalMeetingFallback {
    location?: string;
    region?: string;
    country?: string;
    label: string;
}

function normalizePlacePart(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function samePlace(a: string | null, b: string | null): boolean {
    if (!a && !b) return true;
    return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function formatLocalPlaceLabel(location?: string, region?: string, country?: string): string {
    return [location, region, country].filter(Boolean).join(', ');
}

function getFallbackSignature(fallbacks: LocalMeetingFallback[]): string {
    return fallbacks
        .map((fallback) => [fallback.location ?? '', fallback.region ?? '', fallback.country ?? ''].join('|'))
        .join('::');
}

function appendFallback(fallbacks: LocalMeetingFallback[], fallback: LocalMeetingFallback): void {
    const exists = fallbacks.some((item) => (
        samePlace(item.location ?? null, fallback.location ?? null)
        && samePlace(item.region ?? null, fallback.region ?? null)
        && samePlace(item.country ?? null, fallback.country ?? null)
    ));
    if (!exists) {
        fallbacks.push(fallback);
    }
}

function appendLocationFallback(
    fallbacks: LocalMeetingFallback[],
    location: string,
    region: string | null,
    country: string,
): void {
    appendFallback(fallbacks, {
        location,
        region: region ?? undefined,
        country,
        label: formatLocalPlaceLabel(location, region ?? undefined, country),
    });
}

function buildLocalFallbacks(place: ReverseGeocodedPlace | null): LocalMeetingFallback[] {
    if (!place) return [];

    const city = normalizePlacePart(place.city);
    const region = normalizePlacePart(place.region);
    const country = normalizePlacePart(place.country);
    const fallbacks: LocalMeetingFallback[] = [];

    if (!country) {
        return [];
    }

    const locationCandidates = place.locationCandidates?.length
        ? place.locationCandidates
        : [city].filter((candidate): candidate is string => Boolean(candidate));
    for (const location of locationCandidates) {
        appendLocationFallback(fallbacks, location, null, country);
    }
    if (region) {
        appendFallback(fallbacks, {
            region,
            country,
            label: formatLocalPlaceLabel(undefined, region, country),
        });
    }
    if (country) {
        appendFallback(fallbacks, { country, label: country });
    }
    return fallbacks;
}

export function MeetingsView({ isActive, onOpenMeeting }: MeetingsViewProps) {
    const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, refreshUser } = useAuth();
    const listRef = useRef<FlatList<RecoveryMeeting> | null>(null);
    const didRequestLocalPlace = useRef(false);
    const localPlaceRequestId = useRef(0);
    const profilePlace = useMemo<ReverseGeocodedPlace | null>(() => {
        const currentCity = normalizePlacePart(user?.current_city);
        const currentCountry = normalizePlacePart(user?.current_country);
        if (currentCity && currentCountry) {
            return {
                city: currentCity,
                region: null,
                country: currentCountry,
                locationCandidates: getPlaceLocationCandidates(currentCity),
            };
        }

        const profileCity = normalizePlacePart(user?.city);
        const profileCountry = normalizePlacePart(user?.country);
        if (!profileCity && !profileCountry) return null;
        return {
            city: profileCity,
            region: null,
            country: profileCountry,
            locationCandidates: getPlaceLocationCandidates(profileCity),
        };
    }, [user?.city, user?.country, user?.current_city, user?.current_country]);
    const {
        draftFilters,
        setDraftFilters,
        appliedFilters,
        apiFilters,
        activeFilterChips,
        filterOpen,
        setFilterOpen,
        hasManualFinderIntent,
        handleApplyFilters,
        handleResetFilters,
        clearAppliedFilter,
        removeActiveFilter,
    } = useRecoveryMeetingFilters();
    const [localPlaceStatus, setLocalPlaceStatus] = useState<LocalPlaceStatus>('idle');
    const [localPlace, setLocalPlace] = useState<ReverseGeocodedPlace | null>(null);
    const [localFallbackIndex, setLocalFallbackIndex] = useState(0);
    const listProps = getListPerformanceProps('detailList');
    const scrollToTop = useScrollToTopButton({ threshold: 320 });
    const localFallbacks = useMemo(() => buildLocalFallbacks(localPlace), [localPlace]);
    const localFallbackSignature = useMemo(() => getFallbackSignature(localFallbacks), [localFallbacks]);
    const canUseLocalMeetings = localPlaceStatus === 'resolved'
        && !hasManualFinderIntent
        && localFallbacks.length > 0;
    const activeLocalFallback = canUseLocalMeetings ? localFallbacks[localFallbackIndex] : undefined;
    const activeApiFilters = useMemo((): api.RecoveryMeetingFilters => {
        if (!canUseLocalMeetings || !activeLocalFallback) {
            return apiFilters;
        }
        return {
            fellowship: [...DEFAULT_LOCAL_FELLOWSHIPS],
            country: activeLocalFallback.country,
            region: activeLocalFallback.region,
            location: activeLocalFallback.location,
        };
    }, [activeLocalFallback, apiFilters, canUseLocalMeetings]);
    const shouldWaitForLocalPlace = !hasManualFinderIntent
        && (localPlaceStatus === 'idle' || localPlaceStatus === 'loading');
    const hasNoLocalPlace = !hasManualFinderIntent
        && (localPlaceStatus === 'unavailable' || (localPlaceStatus === 'resolved' && localFallbacks.length === 0));
    const recoveryMeetingsQuery = useRecoveryMeetings(
        { ...activeApiFilters, limit: 20 },
        isActive && !shouldWaitForLocalPlace && !hasNoLocalPlace && (!canUseLocalMeetings || Boolean(activeLocalFallback)),
    );

    const handleOpenFilters = useCallback((): void => {
        setFilterOpen(true);
        rootNavigation.navigate('RecoveryMeetingFilters');
    }, [rootNavigation, setFilterOpen]);

    const handleApplyFilterRoute = useCallback((): boolean => {
        handleApplyFilters();
        return true;
    }, [handleApplyFilters]);

    useEffect(() => {
        if (!filterOpen) {
            setRecoveryMeetingFiltersRouteState(null);
            return;
        }

        setRecoveryMeetingFiltersRouteState({
            draftFilters,
            onChangeFilters: setDraftFilters,
            onClose: () => setFilterOpen(false),
            onReset: handleResetFilters,
            onApply: handleApplyFilterRoute,
        });
    }, [
        draftFilters,
        filterOpen,
        handleApplyFilterRoute,
        handleResetFilters,
        setDraftFilters,
        setFilterOpen,
    ]);

    useEffect(() => {
        setLocalFallbackIndex(0);
    }, [localFallbackSignature]);

    const requestLocalPlace = useCallback(async (): Promise<void> => {
        const requestId = localPlaceRequestId.current + 1;
        localPlaceRequestId.current = requestId;
        const isCurrentRequest = (): boolean => localPlaceRequestId.current === requestId;
        setLocalPlaceStatus('loading');
        const location = await getDeviceCoords();
        if (!isCurrentRequest()) return;

        if (location.status !== 'available' || !location.coords) {
            if (profilePlace) {
                setLocalPlace(profilePlace);
                setLocalPlaceStatus('resolved');
                return;
            }
            setLocalPlace(null);
            setLocalPlaceStatus('unavailable');
            return;
        }

        const place = await reverseGeocodePlace(location.coords.latitude, location.coords.longitude);
        if (!isCurrentRequest()) return;
        if (place) {
            if (place.city && place.country) {
                void api.updateMyCurrentLocation({
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                    city: place.city,
                    country: place.country,
                })
                    .then(refreshUser)
                    .catch(() => undefined);
            }
            setLocalPlace(place);
            setLocalPlaceStatus('resolved');
            return;
        }

        if (profilePlace) {
            setLocalPlace(profilePlace);
            setLocalPlaceStatus('resolved');
            return;
        }
        setLocalPlace(null);
        setLocalPlaceStatus('unavailable');
    }, [profilePlace, refreshUser]);

    useEffect(() => {
        if (!isActive || didRequestLocalPlace.current) {
            return;
        }

        let cancelled = false;
        didRequestLocalPlace.current = true;
        void requestLocalPlace().catch(() => {
            if (cancelled) return;
            if (profilePlace) {
                setLocalPlace(profilePlace);
                setLocalPlaceStatus('resolved');
                return;
            }
            setLocalPlace(null);
            setLocalPlaceStatus('unavailable');
        });

        return () => {
            cancelled = true;
            localPlaceRequestId.current += 1;
        };
    }, [isActive, profilePlace, requestLocalPlace]);

    useEffect(() => {
        if (!canUseLocalMeetings || recoveryMeetingsQuery.isFetching || recoveryMeetingsQuery.isError) {
            return;
        }
        const firstPageItems = recoveryMeetingsQuery.data?.pages[0]?.items ?? [];
        if (recoveryMeetingsQuery.data && firstPageItems.length === 0 && localFallbackIndex < localFallbacks.length - 1) {
            setLocalFallbackIndex((current) => Math.min(current + 1, localFallbacks.length - 1));
        }
    }, [
        canUseLocalMeetings,
        localFallbackIndex,
        localFallbacks.length,
        recoveryMeetingsQuery.data,
        recoveryMeetingsQuery.isError,
        recoveryMeetingsQuery.isFetching,
    ]);

    const meetings = useMemo(() => (
        recoveryMeetingsQuery.data?.pages.flatMap((page) => page.items) ?? []
    ), [recoveryMeetingsQuery.data]);

    const localStatusText = useMemo(() => {
        if (hasManualFinderIntent) {
            return null;
        }
        if (localPlaceStatus === 'loading' || localPlaceStatus === 'idle') {
            return 'Finding meetings in your area';
        }
        if (localPlaceStatus === 'unavailable') {
            return 'Choose a location to find nearby AA, NA and CA meetings';
        }
        const localLabel = localFallbacks.find((fallback) => fallback.location || fallback.country)?.label;
        return localLabel ? `Local AA, CA and NA near ${localLabel}` : null;
    }, [hasManualFinderIntent, localFallbacks, localPlaceStatus]);

    const loadNextPage = useCallback(async (): Promise<void> => {
        if (!recoveryMeetingsQuery.hasNextPage || recoveryMeetingsQuery.isFetchingNextPage) {
            return;
        }
        await recoveryMeetingsQuery.fetchNextPage();
    }, [recoveryMeetingsQuery]);

    const pagination = useGuardedEndReached(loadNextPage);

    const isFindingLocalMeetings = isActive && shouldWaitForLocalPlace;
    const isLoadingMeetings = recoveryMeetingsQuery.isLoading;
    const isMeetingsError = recoveryMeetingsQuery.isError;
    const emptyTitle = isFindingLocalMeetings
        ? 'Finding local meetings'
        : hasNoLocalPlace
        ? 'Location needed'
        : isLoadingMeetings
        ? 'Loading recovery meetings'
        : isMeetingsError
            ? 'Could not load recovery meetings'
            : 'No meetings match those filters';
    const emptyDescription = isFindingLocalMeetings
        ? 'SoberSpace is checking your town, region, and country before loading the first page.'
        : hasNoLocalPlace
        ? 'Allow device location or choose a country, region, and town in filters.'
        : isLoadingMeetings
        ? 'Real meeting data is loading from SoberSpace.'
        : isMeetingsError
            ? 'Check your connection, then pull to refresh.'
            : 'Try a wider location, another day, or clearing fellowship and mode filters.';
    const showEmptyActions = !isFindingLocalMeetings && !isLoadingMeetings && !isMeetingsError;

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
                <TouchableOpacity style={styles.filterButton} onPress={handleOpenFilters} activeOpacity={0.86}>
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
                    {hasNoLocalPlace ? (
                        <PrimaryButton
                            label="Use device location"
                            onPress={() => void requestLocalPlace()}
                            style={styles.emptyResetButton}
                            textStyle={styles.emptyResetText}
                        />
                    ) : null}
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

    const listHeader = renderHeader();
    const emptyState = renderEmptyState();

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
                            recoveryMeetingsQuery.isRefetching && !recoveryMeetingsQuery.isFetchingNextPage
                        }
                        onRefresh={() => {
                            void recoveryMeetingsQuery.refetch();
                        }}
                        tintColor={Colors.primary}
                    />
                }
                contentContainerStyle={screenStandards.listContent}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={emptyState}
                ListFooterComponent={
                    recoveryMeetingsQuery.isFetchingNextPage ? (
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
