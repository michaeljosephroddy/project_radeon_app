import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { DiscoverActiveFiltersBar } from '../../components/discover/DiscoverActiveFiltersBar';
import { DiscoverEmptyState } from '../../components/discover/DiscoverEmptyState';
import { DiscoverFilterSheet } from '../../components/discover/DiscoverFilterSheet';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useInterests } from '../../hooks/queries/useInterests';
import { useDiscoverPreview } from '../../hooks/queries/useDiscoverPreview';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import {
    applyDiscoverPreviewEffectiveFilters,
    clearDiscoverChip,
    createDefaultDiscoverDraftFilters,
    createDiscoverDraftFromApplied,
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
import { getRecoveryMilestone } from '../../utils/date';
import { formatUsername } from '../../utils/identity';
import { getConnectionIntentLabel, normalizeConnectionIntents } from '../../utils/connectionIntents';
import { Colors, ControlSizes, Spacing, TextStyles, Typography, Radius, getAvatarColors } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CARD_GAP = Spacing.md;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.md * 2 - CARD_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.34;

interface DiscoverScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onOpenPlus: () => void;
}

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

function hasPlusAccess(user: api.User | null): boolean {
    if (!user) return false;
    if (user.is_plus) return true;
    return user.subscription_tier === 'plus' && user.subscription_status === 'active';
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
                <View style={styles.cardIntentRow}>
                    {normalizeConnectionIntents(user.connection_intents).slice(0, 2).map((intent) => (
                        <View key={intent} style={styles.cardIntentPill}>
                            <Text style={styles.cardIntentText} numberOfLines={1}>{getConnectionIntentLabel(intent)}</Text>
                        </View>
                    ))}
                </View>
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
                <View style={styles.resultIntentRow}>
                    {normalizeConnectionIntents(user.connection_intents).slice(0, 2).map((intent) => (
                        <View key={intent} style={styles.resultIntentPill}>
                            <Text style={styles.resultIntentText} numberOfLines={1}>{getConnectionIntentLabel(intent)}</Text>
                        </View>
                    ))}
                </View>
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

function getResultsHeading(isSearching: boolean, hasFilters: boolean, broadened: boolean): string {
    if (isSearching && hasFilters) {
        return broadened ? 'Close matches in search' : 'Filtered search results';
    }
    if (isSearching) {
        return 'Search results';
    }
    if (hasFilters) {
        return broadened ? 'Close matches' : 'Filtered people';
    }
    return 'Suggested for you';
}

function getNoResultsCopy(
    isSearching: boolean,
    query: string,
    appliedFilters: DiscoverAppliedFilters,
    broadened: boolean,
): { title: string; description: string } {
    if (isSearching) {
        return {
            title: `No people found for "${query}"`,
            description: hasNonDefaultDiscoverFilters(appliedFilters)
                ? 'Try removing a filter or broadening your match pool.'
                : 'Try a shorter username or clear the search.',
        };
    }

    if (broadened) {
        return {
            title: 'No close matches right now',
            description: 'Your broadened search still came up empty. Try clearing one or two filters and check back later.',
        };
    }

    if (hasNonDefaultDiscoverFilters(appliedFilters)) {
        return {
            title: 'No exact matches yet',
            description: 'Try widening distance, easing your age range, or letting the app broaden results when inventory is low.',
        };
    }

    return {
        title: 'No one here yet',
        description: 'Check back later for new members in the community.',
    };
}

export function DiscoverScreen({ isActive, onOpenUserProfile, onOpenPlus }: DiscoverScreenProps) {
    const hasActivated = useLazyActivation(isActive);
    const { user } = useAuth();
    const [searchText, setSearchText] = useState('');
    const liveSearchText = searchText.trim();
    const debouncedQuery = useDebounce(liveSearchText, 400);
    const [filterSheetVisible, setFilterSheetVisible] = useState(false);
    const [showFilterNotice, setShowFilterNotice] = useState(true);
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [friendedIds, setFriendedIds] = useState<Set<string>>(new Set());
    const listRef = useRef<FlatList<api.User>>(null);
    const canUseAdvancedFilters = hasPlusAccess(user);
    const discoverScrollToTop = useScrollToTopButton({ threshold: 520 });

    const {
        draftFilters,
        setDraftFilters,
        appliedState,
        setAppliedState,
        resetFilters,
        syncDraftToApplied,
    } = useDiscoverFilters();

    useEffect(() => {
        if (!hasActivated) return;
        getDeviceCoords().then(setCoords);
    }, [hasActivated]);

    const discoverLat = coords ? Math.round(coords.latitude * 100) / 100 : undefined;
    const discoverLng = coords ? Math.round(coords.longitude * 100) / 100 : undefined;
    const isSearching = liveSearchText.length > 0;
    const hasCommittedSearch = debouncedQuery.length > 0;
    const isSearchPending = isSearching && liveSearchText !== debouncedQuery;
    const hasAppliedFilters = hasNonDefaultDiscoverFilters(appliedState.requested);
    const activeChips = useMemo(() => getDiscoverActiveChips(appliedState.requested), [appliedState.requested]);
    const broadenedCopy = appliedState.broadened ? getDiscoverRelaxedCopy(appliedState.relaxedFields) : null;
    const filterCount = activeChips.length;

    const validatedDraft = useMemo(() => validateDiscoverDraft(draftFilters), [draftFilters]);
    const draftApiFilters = useMemo(
        () => validatedDraft.normalized ? toDiscoverApiFilters(validatedDraft.normalized) : undefined,
        [validatedDraft.normalized],
    );

    const interestOptionsQuery = useInterests(hasActivated && filterSheetVisible);

    const previewQuery = useDiscoverPreview({
        query: hasCommittedSearch ? debouncedQuery : undefined,
        ...draftApiFilters,
        lat: discoverLat,
        lng: discoverLng,
    }, Boolean(
        hasActivated
        && filterSheetVisible
        && canUseAdvancedFilters
        && validatedDraft.normalized
        && hasNonDefaultDiscoverFilters(validatedDraft.normalized),
    ));

    const effectiveApiFilters = useMemo(
        () => hasAppliedFilters ? toDiscoverApiFilters(appliedState.effective) : {},
        [appliedState.effective, hasAppliedFilters],
    );

    const discoverMode: 'suggested' | 'search' | 'filtered' = hasCommittedSearch
        ? 'search'
        : hasAppliedFilters
            ? 'filtered'
            : 'suggested';

    const discoverQuery = useDiscoverResultsQuery({
        mode: discoverMode,
        query: hasCommittedSearch ? debouncedQuery : undefined,
        ...effectiveApiFilters,
        lat: discoverLat,
        lng: discoverLng,
        limit: 20,
    }, hasActivated);
    const showSearchLoadingState = isSearchPending || (isSearching && hasCommittedSearch && discoverQuery.isLoading);
    const displayedUsers = isSearching
        ? (showSearchLoadingState ? [] : discoverQuery.users)
        : discoverQuery.users;

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
            Alert.alert('Could not send request', error instanceof Error ? error.message : 'Please try again.');
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
        if (isSearchPending || !isActive || !discoverQuery.hasNextPage || discoverQuery.isFetchingNextPage || discoverQuery.isRefetching) {
            return;
        }
        await discoverQuery.fetchNextPage();
    }, [discoverQuery, isActive, isSearchPending]);
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
            Alert.alert('Invalid filters', validatedDraft.error);
            return;
        }

        if (!canUseAdvancedFilters) {
            onOpenPlus();
            return;
        }

        if (!validatedDraft.normalized) {
            return;
        }

        const nextState = applyDiscoverPreviewEffectiveFilters(validatedDraft.normalized, previewQuery.data);
        setAppliedState(nextState);
        setDraftFilters(createDiscoverDraftFromApplied(validatedDraft.normalized));
        setFilterSheetVisible(false);
    }, [canUseAdvancedFilters, onOpenPlus, previewQuery.data, setAppliedState, setDraftFilters, validatedDraft]);

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

    const resultsHeading = getResultsHeading(isSearching, hasAppliedFilters, appliedState.broadened);
    const noResultsCopy = getNoResultsCopy(isSearching, debouncedQuery, appliedState.requested, appliedState.broadened);
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

    if (!isSearching && discoverQuery.isLoading && discoverQuery.users.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={Colors.primary} size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
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
                    primaryLabel={hasAppliedFilters ? 'Edit filters' : undefined}
                    onPrimaryPress={hasAppliedFilters ? handleOpenFilters : undefined}
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

            {isActive && discoverScrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}

            <DiscoverFilterSheet
                visible={filterSheetVisible}
                canUseAdvancedFilters={canUseAdvancedFilters}
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
        paddingTop: Spacing.xs,
        paddingBottom: Spacing.sm,
        gap: Spacing.sm,
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
        paddingTop: Spacing.xs,
        paddingBottom: Spacing.xl,
    },
    gridContent: {
        paddingTop: Spacing.xs,
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
    cardIntentRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    cardIntentPill: {
        maxWidth: '100%',
        borderRadius: Radius.pill,
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    cardIntentText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
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
    resultIntentRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        marginTop: 3,
    },
    resultIntentPill: {
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    resultIntentText: {
        ...TextStyles.badge,
        color: Colors.primary,
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
});
