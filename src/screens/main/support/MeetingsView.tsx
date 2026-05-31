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
import { usePlaceAutocomplete, useRecoveryMeetings } from '../../../hooks/queries/useRecoveryMeetings';
import { useScrollToTopButton } from '../../../hooks/useScrollToTopButton';
import * as api from '../../../api/client';
import { screenStandards } from '../../../styles/screenStandards';
import { Colors, IconSizes, Radius, Spacing, Typography } from '../../../theme';
import { getListPerformanceProps } from '../../../utils/listPerformance';
import { getDeviceCoords, getPlaceLocationCandidates, reverseGeocodePlace, type ReverseGeocodedPlace } from '../../../utils/location';
import { setRecoveryMeetingFiltersRouteState } from '../../../navigation/filterRouteStores';
import type { RootStackParamList } from '../../../navigation/types';
import {
    DEFAULT_LOCAL_FELLOWSHIPS,
    PlaceSuggestion,
    RecoveryMeeting,
    SelectedRecoveryPlace,
    getFellowshipSummary,
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

function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [delayMs, value]);

    return debounced;
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

function toSelectedRecoveryPlace(place: PlaceSuggestion): SelectedRecoveryPlace {
    return {
        id: place.id,
        label: place.label,
        name: place.name,
        country: place.country,
        countryCode: place.country_code,
        region: place.region,
        regionCode: place.region_code,
        latitude: place.latitude,
        longitude: place.longitude,
    };
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
        handleApplyFilters,
        handleResetFilters,
        applyFilterPatch,
        clearAppliedFilter,
        removeActiveFilter,
    } = useRecoveryMeetingFilters();
    const [localPlaceStatus, setLocalPlaceStatus] = useState<LocalPlaceStatus>(() => (
        profilePlace ? 'resolved' : 'idle'
    ));
    const [localPlace, setLocalPlace] = useState<ReverseGeocodedPlace | null>(() => profilePlace);
    const listProps = getListPerformanceProps('detailList');
    const scrollToTop = useScrollToTopButton({ threshold: 320 });
    const localFallbacks = useMemo(() => buildLocalFallbacks(localPlace), [localPlace]);
    const hasManualLocationIntent = Boolean(
        appliedFilters.selectedPlace
        || appliedFilters.location.trim()
        || appliedFilters.country.trim()
        || appliedFilters.region.trim()
    );
    const canUseLocalMeetings = localPlaceStatus === 'resolved'
        && !hasManualLocationIntent
        && localFallbacks.length > 0;
    const activeLocalFallback = canUseLocalMeetings ? localFallbacks[0] : undefined;
    const activeApiFilters = useMemo((): api.RecoveryMeetingFilters => {
        if (!hasManualLocationIntent && user?.current_place_id) {
            return {
                ...apiFilters,
                fellowship: apiFilters.fellowship ?? [...DEFAULT_LOCAL_FELLOWSHIPS],
                place_id: user.current_place_id,
                country: undefined,
                region: undefined,
                location: undefined,
            };
        }
        if (!canUseLocalMeetings || !activeLocalFallback) {
            return apiFilters;
        }
        return {
            ...apiFilters,
            fellowship: apiFilters.fellowship ?? [...DEFAULT_LOCAL_FELLOWSHIPS],
            country: activeLocalFallback.country,
            region: activeLocalFallback.region,
            location: activeLocalFallback.location,
        };
    }, [activeLocalFallback, apiFilters, canUseLocalMeetings, hasManualLocationIntent, user?.current_place_id]);
    const hasNoLocalPlace = !hasManualLocationIntent
        && (localPlaceStatus === 'unavailable' || (localPlaceStatus === 'resolved' && localFallbacks.length === 0));
    const recoveryMeetingsQuery = useRecoveryMeetings(
        { ...activeApiFilters, limit: 20 },
        isActive && (!canUseLocalMeetings || Boolean(activeLocalFallback)),
    );
    const debouncedLocationQuery = useDebouncedValue(draftFilters.location.trim(), 250);
    const selectedLocation = Boolean(
        draftFilters.selectedPlace
        && draftFilters.location.trim() === draftFilters.selectedPlace.label,
    );
    const placeSuggestionsQuery = usePlaceAutocomplete(
        debouncedLocationQuery,
        { country_code: draftFilters.countryCode ?? undefined, limit: 8 },
        isActive && debouncedLocationQuery.length >= 2 && !selectedLocation,
    );
    const placeSuggestions = placeSuggestionsQuery.data ?? [];
    const showLocationSuggestions = debouncedLocationQuery.length >= 2 && !selectedLocation;
    const secondaryActiveFilterChips = useMemo(() => (
        activeFilterChips.filter((chip) => !['selectedPlace', 'country', 'region', 'location'].includes(chip.key))
    ), [activeFilterChips]);

    const handleOpenFilters = useCallback((): void => {
        setFilterOpen(true);
        rootNavigation.navigate('RecoveryMeetingFilters');
    }, [rootNavigation, setFilterOpen]);

    const clearLocationPatch = useMemo(() => ({
        selectedPlace: null,
        location: '',
        country: '',
        countryCode: null,
        region: '',
        regionCode: null,
    }), []);

    const handleLocationTextChange = useCallback((location: string): void => {
        if (!location.trim()) {
            applyFilterPatch(clearLocationPatch);
            return;
        }
        setDraftFilters((current) => ({
            ...current,
            location,
            selectedPlace: null,
            country: '',
            countryCode: null,
            region: '',
            regionCode: null,
        }));
    }, [applyFilterPatch, clearLocationPatch, setDraftFilters]);

    const applyTypedLocation = useCallback((): void => {
        const location = draftFilters.location.trim();
        if (!location) {
            applyFilterPatch(clearLocationPatch);
            return;
        }
        applyFilterPatch({
            selectedPlace: null,
            location,
            country: '',
            countryCode: null,
            region: '',
            regionCode: null,
        });
    }, [applyFilterPatch, clearLocationPatch, draftFilters.location]);

    const handleSelectPlace = useCallback((place: PlaceSuggestion): void => {
        applyFilterPatch({
            selectedPlace: toSelectedRecoveryPlace(place),
            location: place.label,
            country: place.country,
            countryCode: place.country_code,
            region: place.region ?? '',
            regionCode: place.region_code ?? null,
        });
    }, [applyFilterPatch]);

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

    const requestLocalPlace = useCallback(async (): Promise<void> => {
        const requestId = localPlaceRequestId.current + 1;
        localPlaceRequestId.current = requestId;
        const isCurrentRequest = (): boolean => localPlaceRequestId.current === requestId;
        if (profilePlace) {
            setLocalPlace(profilePlace);
            setLocalPlaceStatus('resolved');
        } else {
            setLocalPlaceStatus('loading');
        }
        const location = await getDeviceCoords();
        if (!isCurrentRequest()) return;

        if (location.status !== 'available' || !location.coords) {
            if (profilePlace) {
                setLocalPlace(profilePlace);
                setLocalPlaceStatus('resolved');
                return;
            }
            if (!profilePlace) {
                setLocalPlace(null);
                setLocalPlaceStatus('unavailable');
            }
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
        if (!profilePlace) {
            setLocalPlace(null);
            setLocalPlaceStatus('unavailable');
        }
    }, [profilePlace, refreshUser]);

    useEffect(() => {
        if (profilePlace && !hasManualLocationIntent && (localPlaceStatus === 'idle' || localPlaceStatus === 'unavailable')) {
            setLocalPlace(profilePlace);
            setLocalPlaceStatus('resolved');
        }
    }, [hasManualLocationIntent, localPlaceStatus, profilePlace]);

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

    const meetings = useMemo(() => (
        recoveryMeetingsQuery.data?.pages.flatMap((page) => page.items) ?? []
    ), [recoveryMeetingsQuery.data]);

    const localStatusText = useMemo(() => {
        if (hasManualLocationIntent) {
            return null;
        }
        if ((localPlaceStatus === 'loading' || localPlaceStatus === 'idle') && meetings.length === 0) {
            return 'Finding meetings in your area';
        }
        if (localPlaceStatus === 'unavailable') {
            return 'Choose a location to find nearby AA, NA and CA meetings';
        }
        const localLabel = localFallbacks.find((fallback) => fallback.location || fallback.country)?.label;
        const fellowshipSummary = getFellowshipSummary(appliedFilters.fellowships.length ? appliedFilters.fellowships : DEFAULT_LOCAL_FELLOWSHIPS);
        return localLabel ? `Local ${fellowshipSummary} near ${localLabel}` : null;
    }, [appliedFilters.fellowships, hasManualLocationIntent, localFallbacks, localPlaceStatus, meetings.length]);

    const loadNextPage = useCallback(async (): Promise<void> => {
        if (!recoveryMeetingsQuery.hasNextPage || recoveryMeetingsQuery.isFetchingNextPage) {
            return;
        }
        await recoveryMeetingsQuery.fetchNextPage();
    }, [recoveryMeetingsQuery]);

    const pagination = useGuardedEndReached(loadNextPage);

    const isLoadingMeetings = recoveryMeetingsQuery.isLoading;
    const isMeetingsError = recoveryMeetingsQuery.isError;
    const emptyLocationLabel = appliedFilters.selectedPlace?.label
        || appliedFilters.location.trim()
        || activeLocalFallback?.label
        || null;
    const emptyFellowshipLabel = getFellowshipSummary(appliedFilters.fellowships.length ? appliedFilters.fellowships : DEFAULT_LOCAL_FELLOWSHIPS);
    const emptyTitle = hasNoLocalPlace
        ? 'Location needed'
        : isLoadingMeetings
        ? 'Loading recovery meetings'
        : isMeetingsError
            ? 'Could not load recovery meetings'
            : emptyLocationLabel
                ? `No ${emptyFellowshipLabel} meetings near ${emptyLocationLabel}`
                : `No ${emptyFellowshipLabel} meetings found`;
    const emptyDescription = hasNoLocalPlace
        ? 'Allow device location or choose a location in filters.'
        : isLoadingMeetings
        ? 'Real meeting data is loading from SoberSpace.'
        : isMeetingsError
        ? 'Check your connection, then pull to refresh.'
        : 'Try another location, day, or meeting mode.';
    const showEmptyActions = !isLoadingMeetings && !isMeetingsError;

    const renderHeader = (): React.ReactElement => (
        <View style={styles.header}>
            <View style={styles.searchRow}>
                <SearchBar
                    primaryField={{
                        value: draftFilters.location,
                        onChangeText: handleLocationTextChange,
                        onSubmitEditing: applyTypedLocation,
                        placeholder: 'City, neighbourhood, or postcode',
                        returnKeyType: 'search',
                        autoCapitalize: 'words',
                    }}
                    style={styles.searchBar}
                    leading={<Ionicons name="location-outline" size={IconSizes.row} color={Colors.text.muted} />}
                />
                <TouchableOpacity style={styles.filterButton} onPress={handleOpenFilters} activeOpacity={0.86}>
                    <Ionicons name="options-outline" size={IconSizes.tool} color={Colors.text.primary} />
                    {secondaryActiveFilterChips.length ? (
                        <View style={styles.filterBadge}>
                            <Text style={styles.filterBadgeText}>{secondaryActiveFilterChips.length}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
            </View>
            {showLocationSuggestions ? (
                <View style={styles.suggestionList}>
                    {placeSuggestionsQuery.isFetching ? (
                        <Text style={styles.suggestionMeta}>Searching...</Text>
                    ) : null}
                    {placeSuggestions.map((place) => (
                        <TouchableOpacity
                            key={place.id}
                            style={styles.suggestionItem}
                            onPress={() => handleSelectPlace(place)}
                            activeOpacity={0.82}
                        >
                            <Text style={styles.suggestionTitle}>{place.name}</Text>
                            <Text style={styles.suggestionSubtitle}>{[place.region, place.country].filter(Boolean).join(', ')}</Text>
                        </TouchableOpacity>
                    ))}
                    {!placeSuggestionsQuery.isFetching && placeSuggestions.length === 0 ? (
                        <Text style={styles.suggestionMeta}>No matching places found</Text>
                    ) : null}
                </View>
            ) : null}
            {secondaryActiveFilterChips.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChipRow}>
                    {secondaryActiveFilterChips.map((chip) => (
                        <TouchableOpacity
                            key={chip.key}
                            style={styles.activeChip}
                            onPress={() => removeActiveFilter(chip)}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.activeChipText}>{chip.label}</Text>
                            <Ionicons name="close" size={IconSizes.badge} color={Colors.primary} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            ) : null}
            {localStatusText ? (
                <View style={styles.localStatusRow}>
                    <Ionicons name="navigate-outline" size={IconSizes.badge} color={Colors.text.muted} />
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
                    {appliedFilters.selectedPlace || appliedFilters.location.trim() ? (
                        <TouchableOpacity
                            style={styles.emptyAction}
                            onPress={() => clearAppliedFilter(clearLocationPatch)}
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
    suggestionList: {
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.surface,
        overflow: 'hidden',
    },
    suggestionItem: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
    },
    suggestionTitle: {
        color: Colors.text.primary,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
    suggestionSubtitle: {
        color: Colors.text.secondary,
        fontSize: Typography.sizes.sm,
        marginTop: 2,
    },
    suggestionMeta: {
        color: Colors.text.secondary,
        fontSize: Typography.sizes.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
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
