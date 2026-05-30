import { appAlert } from '@/components/ui/appAlert';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as api from '../../api/client';
import { MeetupCard } from '../../components/events/MeetupCard';
import { EmptyState } from '../../components/ui/EmptyState';
import type { CardActionMenuAction } from '../../components/ui/CardActionMenu';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import {
    DEFAULT_MEETUP_FILTERS,
    getMeetupFilterChips,
    MeetupDraftFilters,
    removeMeetupFilter,
    toMeetupQueryFilters,
} from '../../hooks/useMeetupFilters';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useMeetupCategories, useMeetups, useMyMeetups } from '../../hooks/queries/useMeetups';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { setMeetupFiltersRouteState } from '../../navigation/filterRouteStores';
import type { RootStackParamList } from '../../navigation/types';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { queryKeys } from '../../query/queryKeys';
import { dedupeById } from '../../utils/list';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, ContentInsets, IconSizes, Radius, Spacing, Typography } from '../../theme';
import { screenStandards } from '../../styles/screenStandards';

type MeetupPrimaryView = 'discover' | 'hosting' | 'going';
type HostingScope = Extract<api.MyMeetupScope, 'upcoming' | 'cancelled' | 'past'>;

interface MeetupsScreenProps {
    isActive: boolean;
    onOpenMeetup: (meetup: api.Meetup) => void;
    onOpenManageMeetup: (meetup: api.Meetup) => void;
    onRsvpComplete?: (meetup: api.Meetup, result: api.MeetupRsvpResult) => void;
}

function useDebounce<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}

function flattenCursorPages(
    data?: InfiniteData<api.CursorResponse<api.Meetup>>,
): api.Meetup[] {
    return dedupeById(data?.pages.flatMap((page) => page.items ?? []) ?? []);
}

function getDiscoverActionLabel(meetup: api.Meetup): string {
    if (meetup.can_manage) return 'Manage';
    if (meetup.is_attending) return 'Going';
    if (meetup.is_waitlisted) return 'Waitlisted';
    if (meetup.waitlist_enabled && meetup.capacity && meetup.attendee_count >= meetup.capacity) return 'Waitlist';
    return 'RSVP';
}

function canDeleteMeetup(meetup: api.Meetup): boolean {
    return meetup.status === 'published' && meetup.attendee_count <= 1;
}

export function MeetupsScreen({
    isActive,
    onOpenMeetup,
    onOpenManageMeetup,
    onRsvpComplete,
}: MeetupsScreenProps) {
    const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const queryClient = useQueryClient();
    const listRef = useRef<FlatList<api.Meetup> | null>(null);
    const hasActivated = useLazyActivation(isActive);
    const [activeView, setActiveView] = useState<MeetupPrimaryView>('discover');
    const [hostingScope, setHostingScope] = useState<HostingScope>('upcoming');
    const [draftFilters, setDraftFilters] = useState<MeetupDraftFilters>(DEFAULT_MEETUP_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<MeetupDraftFilters>(DEFAULT_MEETUP_FILTERS);
    const [filterOpen, setFilterOpen] = useState(false);
    const [pendingMeetupIds, setPendingMeetupIds] = useState<Set<string>>(new Set());
    const [showDiscoverNotice, setShowDiscoverNotice] = useState(true);
    const [showHostingNotice, setShowHostingNotice] = useState(true);
    const [showGoingNotice, setShowGoingNotice] = useState(true);
    const debouncedQuery = useDebounce(draftFilters.query, 350);

    const categoriesQuery = useMeetupCategories(hasActivated);
    const discoverQuery = useMeetups({
        ...toMeetupQueryFilters(appliedFilters),
        limit: 20,
    }, hasActivated);
    const hostingQuery = useMyMeetups(hostingScope, 20, hasActivated && activeView === 'hosting');
    const goingQuery = useMyMeetups('going', 20, hasActivated && activeView === 'going');

    useEffect(() => {
        setAppliedFilters((current) => (
            current.query === debouncedQuery ? current : { ...current, query: debouncedQuery }
        ));
    }, [debouncedQuery]);

    useRefetchOnActiveIfStale(isActive && activeView === 'discover', discoverQuery);
    useRefetchOnActiveIfStale(isActive && activeView === 'hosting', hostingQuery);
    useRefetchOnActiveIfStale(isActive && activeView === 'going', goingQuery);

    const discoverScroll = useScrollToTopButton({ threshold: 320 });
    const listProps = getListPerformanceProps('detailList');
    const categories = categoriesQuery.data ?? [];
    const discoverItems = useMemo(() => flattenCursorPages(discoverQuery.data), [discoverQuery.data]);
    const hostingItems = useMemo(() => flattenCursorPages(hostingQuery.data), [hostingQuery.data]);
    const goingItems = useMemo(
        () => flattenCursorPages(goingQuery.data).filter(
            (meetup) => !meetup.can_manage && (meetup.is_attending || meetup.is_waitlisted),
        ),
        [goingQuery.data],
    );
    const activeFilterChips = useMemo(
        () => getMeetupFilterChips(appliedFilters, categories),
        [appliedFilters, categories],
    );
    const invalidateMeetupQueries = (meetupId?: string) => {
        void queryClient.invalidateQueries({ queryKey: ['meetups'] });
        void queryClient.invalidateQueries({ queryKey: ['my-meetups'] });
        if (meetupId) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.meetup(meetupId) });
        }
    };

    const removeMeetupFromCaches = (meetupId: string) => {
        queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.Meetup>>>(
            { queryKey: ['meetups'] },
            (data) => data ? ({
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).filter((meetup) => meetup.id !== meetupId),
                })),
            }) : data,
        );
        queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.Meetup>>>(
            { queryKey: ['my-meetups'] },
            (data) => data ? ({
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).filter((meetup) => meetup.id !== meetupId),
                })),
            }) : data,
        );
    };

    const updateMeetupInCaches = (meetupId: string, updater: (meetup: api.Meetup) => api.Meetup) => {
        queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.Meetup>>>(
            { queryKey: ['meetups'] },
            (data) => data ? ({
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).map((meetup) => meetup.id === meetupId ? updater(meetup) : meetup),
                })),
            }) : data,
        );
        queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.Meetup>>>(
            { queryKey: ['my-meetups'] },
            (data) => data ? ({
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).map((meetup) => meetup.id === meetupId ? updater(meetup) : meetup),
                })),
            }) : data,
        );
        queryClient.setQueryData<api.Meetup | undefined>(
            queryKeys.meetup(meetupId),
            (data) => data ? updater(data) : data,
        );
    };

    const removeMeetupFromGoingCaches = (meetupId: string) => {
        const cachedQueries = queryClient.getQueriesData<InfiniteData<api.CursorResponse<api.Meetup>>>({
            queryKey: ['my-meetups'],
        });

        cachedQueries.forEach(([queryKey, data]) => {
            const params = Array.isArray(queryKey) ? queryKey[1] : undefined;
            const scope = typeof params === 'object' && params && 'scope' in params
                ? params.scope
                : undefined;

            if (scope !== 'going' || !data) {
                return;
            }

            queryClient.setQueryData<InfiniteData<api.CursorResponse<api.Meetup>>>(queryKey, {
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).filter((item) => item.id !== meetupId),
                })),
            });
        });
    };

    const handleRSVP = async (meetup: api.Meetup) => {
        setPendingMeetupIds((current) => new Set(current).add(meetup.id));
        try {
            const result = await api.rsvpMeetup(meetup.id);
            updateMeetupInCaches(meetup.id, (item) => ({
                ...item,
                is_attending: result.attending,
                is_waitlisted: result.waitlisted,
                attendee_count: result.attendee_count,
                waitlist_count: result.waitlist_count,
            }));
            if (!result.attending && !result.waitlisted) {
                removeMeetupFromGoingCaches(meetup.id);
            }
            invalidateMeetupQueries(meetup.id);
            if (result.waitlisted) {
                appAlert.alert('Added to waitlist', 'You will stay visible on the waitlist until a space opens or you leave.');
            }
            onRsvpComplete?.(meetup, result);
        } catch (error: unknown) {
            appAlert.alert('Error', error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setPendingMeetupIds((current) => {
                const next = new Set(current);
                next.delete(meetup.id);
                return next;
            });
        }
    };

    const handleManageAction = (meetup: api.Meetup) => {
        if (meetup.status !== 'published') {
            onOpenMeetup(meetup);
            return;
        }
        onOpenManageMeetup(meetup);
    };

    const handlePrimaryTabChange = (key: string): void => {
        setActiveView(key as MeetupPrimaryView);
    };

    const handleRemoveOrganizerMeetup = (meetup: api.Meetup) => {
        const destructiveLabel = canDeleteMeetup(meetup) ? 'Delete' : 'Cancel event';
        const message = canDeleteMeetup(meetup)
                ? 'This event will be permanently deleted.'
                : 'This event will be cancelled and moved to Cancelled.';

        appAlert.alert(`${destructiveLabel}?`, message, [
            { text: 'Keep it', style: 'cancel' },
            {
                text: destructiveLabel,
                style: 'destructive',
                onPress: async () => {
                    setPendingMeetupIds((current) => new Set(current).add(meetup.id));
                    try {
                        if (canDeleteMeetup(meetup)) {
                            await api.deleteMeetup(meetup.id);
                            removeMeetupFromCaches(meetup.id);
                        } else {
                            const updated = await api.cancelMeetup(meetup.id);
                            updateMeetupInCaches(meetup.id, () => updated);
                        }
                        invalidateMeetupQueries();
                    } catch (error: unknown) {
                        appAlert.alert('Error', error instanceof Error ? error.message : 'Something went wrong.');
                    } finally {
                        setPendingMeetupIds((current) => {
                            const next = new Set(current);
                            next.delete(meetup.id);
                            return next;
                        });
                    }
                },
            },
        ]);
    };

    const handleOpenFilters = (): void => {
        setFilterOpen(true);
        rootNavigation.navigate('MeetupFilters');
    };

    const handleApplyFilters = (): boolean => {
        setAppliedFilters(draftFilters);
        setFilterOpen(false);
        return true;
    };

    useEffect(() => {
        if (!filterOpen) {
            setMeetupFiltersRouteState(null);
            return;
        }

        setMeetupFiltersRouteState({
            draftFilters,
            categories,
            onChangeFilters: setDraftFilters,
            onClose: () => setFilterOpen(false),
            onReset: () => setDraftFilters(DEFAULT_MEETUP_FILTERS),
            onApply: handleApplyFilters,
        });
    }, [categories, draftFilters, filterOpen]);

    const handleLoadMore = async () => {
        if (activeView === 'hosting') {
            if (hostingQuery.hasNextPage && !hostingQuery.isFetchingNextPage) {
                await hostingQuery.fetchNextPage();
            }
            return;
        }
        if (activeView === 'going') {
            if (goingQuery.hasNextPage && !goingQuery.isFetchingNextPage) {
                await goingQuery.fetchNextPage();
            }
            return;
        }
        if (discoverQuery.hasNextPage && !discoverQuery.isFetchingNextPage) {
            await discoverQuery.fetchNextPage();
        }
    };
    const guardedEndReached = useGuardedEndReached(handleLoadMore);

    const renderDiscoverHeader = () => (
        <View style={styles.discoverHeader}>
            {showDiscoverNotice ? (
                <InfoNoticeCard
                    title="Find meetups"
                    description="Browse upcoming sober events by category, location, date, format, and availability."
                    onDismiss={() => setShowDiscoverNotice(false)}
                />
            ) : null}
            <View style={styles.searchRow}>
                <SearchBar
                    primaryField={{
                        value: draftFilters.query,
                        onChangeText: (value) => {
                            setDraftFilters((current) => ({ ...current, query: value }));
                        },
                        placeholder: 'Search events, venues, hosts',
                        returnKeyType: 'search',
                    }}
                    style={styles.searchBar}
                    leading={<Ionicons name="search-outline" size={IconSizes.row} color={Colors.text.muted} />}
                />
                <TouchableOpacity style={styles.filterButton} onPress={handleOpenFilters} activeOpacity={0.86}>
                    <Ionicons name="options-outline" size={IconSizes.tool} color={Colors.text.primary} />
                    {activeFilterChips.length ? (
                        <View style={styles.filterBadge}>
                            <Text style={styles.filterBadgeText}>{activeFilterChips.length}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
            </View>
            <View style={styles.quickCategoryHeader}>
                <Text style={styles.quickCategoryLabel}>Categories</Text>
                <View style={styles.quickCategoryHint}>
                    <Text style={styles.quickCategoryHintText}>Swipe to browse</Text>
                    <Ionicons name="arrow-forward" size={IconSizes.badge} color={Colors.text.muted} />
                </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCategoryRow}>
                <TouchableOpacity
                    style={[styles.quickCategoryChip, !appliedFilters.category && styles.quickCategoryChipActive]}
                    onPress={() => {
                        setDraftFilters((current) => ({ ...current, category: '' }));
                        setAppliedFilters((current) => ({ ...current, category: '' }));
                    }}
                >
                    <Text style={[styles.quickCategoryText, !appliedFilters.category && styles.quickCategoryTextActive]}>For you</Text>
                </TouchableOpacity>
                {categories.map((category) => (
                    <TouchableOpacity
                        key={category.slug}
                        style={[styles.quickCategoryChip, appliedFilters.category === category.slug && styles.quickCategoryChipActive]}
                        onPress={() => {
                            setDraftFilters((current) => ({ ...current, category: category.slug }));
                            setAppliedFilters((current) => ({ ...current, category: category.slug }));
                        }}
                    >
                        <Text style={[styles.quickCategoryText, appliedFilters.category === category.slug && styles.quickCategoryTextActive]}>
                            {category.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            {activeFilterChips.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChipRow}>
                    {activeFilterChips.map((chip) => (
                        <TouchableOpacity
                            key={chip.key}
                            style={styles.activeChip}
                            onPress={() => {
                                const nextFilters = removeMeetupFilter(appliedFilters, chip.key);
                                setAppliedFilters(nextFilters);
                                setDraftFilters(nextFilters);
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.activeChipText}>{chip.label}</Text>
                            <Ionicons name="close" size={IconSizes.badge} color={Colors.primary} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            ) : null}
        </View>
    );

    const renderMyHeader = (title: string, body: string, showHostingScope = false) => (
        <View style={styles.sectionHeader}>
            {(showHostingScope ? showHostingNotice : showGoingNotice) ? (
                <InfoNoticeCard
                    title={title}
                    description={body}
                    onDismiss={() => {
                        if (showHostingScope) {
                            setShowHostingNotice(false);
                            return;
                        }
                        setShowGoingNotice(false);
                    }}
                />
            ) : null}
            {showHostingScope ? (
                <SegmentedControl
                    items={[
                        { key: 'upcoming', label: 'Upcoming' },
                        { key: 'cancelled', label: 'Cancelled' },
                        { key: 'past', label: 'Past' },
                    ]}
                    activeKey={hostingScope}
                    onChange={(key) => setHostingScope(key as HostingScope)}
                    layer="section"
                    tone="secondary"
                    style={styles.scopeControl}
                />
            ) : null}
        </View>
    );

    const currentList = activeView === 'discover'
        ? discoverItems
        : activeView === 'hosting'
            ? hostingItems
            : goingItems;
    const currentQuery = activeView === 'discover'
        ? discoverQuery
        : activeView === 'hosting'
            ? hostingQuery
            : goingQuery;
    const isRefreshing = currentQuery.isRefetching && !currentQuery.isFetchingNextPage;

    const handleRefresh = async () => {
        if (activeView === 'discover') {
            await Promise.all([
                discoverQuery.refetch(),
                categoriesQuery.refetch(),
            ]);
            return;
        }
        if (activeView === 'hosting') {
            await hostingQuery.refetch();
            return;
        }
        await goingQuery.refetch();
    };

    const listHeader = activeView === 'discover'
        ? renderDiscoverHeader()
        : activeView === 'hosting'
            ? renderMyHeader('Your hosted meetups', 'Manage upcoming, cancelled, and past meetups.', true)
            : renderMyHeader('Your meetup plans', 'Meetups you are attending or waitlisted for appear here.');

    const emptyState = activeView === 'discover'
        ? (
            <EmptyState
                title="No events match those filters"
                description="Try another location, category, date, or format."
                compact
                style={styles.emptyState}
            />
        )
        : activeView === 'hosting'
            ? (
                <EmptyState
                    title={
                        hostingScope === 'cancelled'
                                ? 'No cancelled events'
                                : hostingScope === 'past'
                                    ? 'No past events yet'
                                    : 'No upcoming events'
                    }
                    description={
                        hostingScope === 'cancelled'
                                ? 'Cancelled events will land here instead of cluttering your active lineup.'
                                : 'Create your first event to build your local community.'
                    }
                    compact
                    style={styles.emptyState}
                />
            )
            : (
                <EmptyState
                    title="No events in your calendar"
                    description="RSVP to something interesting and it will appear here."
                compact
                style={styles.emptyState}
            />
            );

    const canSwipeManageList = activeView === 'hosting' && hostingScope === 'upcoming';
    const getPrimaryAction = (meetup: api.Meetup) => {
        if (meetup.can_manage) return undefined;
        if (activeView === 'hosting') {
            return undefined;
        }
        if (activeView === 'going') {
            return handleRSVP;
        }
        return handleRSVP;
    };
    const getPrimaryLabel = (meetup: api.Meetup) => {
        if (activeView === 'hosting') {
            return undefined;
        }
        if (activeView === 'going') {
            return meetup.is_attending ? 'Leave' : meetup.is_waitlisted ? 'Leave waitlist' : 'RSVP';
        }
        return meetup.can_manage ? undefined : getDiscoverActionLabel(meetup);
    };
    const getMeetupCardActions = (meetup: api.Meetup): CardActionMenuAction[] | undefined => {
        if (!meetup.can_manage) return undefined;

        const actions: CardActionMenuAction[] = [
            { label: 'View details', onPress: () => onOpenMeetup(meetup) },
        ];
        if (meetup.status === 'published') {
            actions.push({
                label: 'Manage',
                onPress: () => handleManageAction(meetup),
            });
        }
        if (meetup.status === 'published') {
            actions.push({
                label: canDeleteMeetup(meetup) ? 'Delete' : 'Cancel event',
                destructive: true,
                onPress: () => handleRemoveOrganizerMeetup(meetup),
            });
        }
        return actions;
    };
    const renderMeetupSeparator = (): React.ReactElement => <View style={styles.meetupSeparator} />;

    return (
        <View style={styles.container}>
            <View style={screenStandards.sectionTabsWrap}>
                <SegmentedControl
                    items={[
                        { key: 'discover', label: 'Discover' },
                        { key: 'hosting', label: 'Hosting' },
                        { key: 'going', label: 'Going' },
                    ]}
                    activeKey={activeView}
                    onChange={handlePrimaryTabChange}
                    layer="section"
                    tone="secondary"
                    style={screenStandards.sectionTabsControl}
                />
            </View>

            <FlatList
                ref={listRef}
                data={currentList}
                style={styles.list}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const card = (
                        <MeetupCard
                            meetup={item}
                            onPress={onOpenMeetup}
                            onPrimaryAction={getPrimaryAction(item)}
                            primaryLabel={getPrimaryLabel(item)}
                            actionDisabled={pendingMeetupIds.has(item.id)}
                            actions={getMeetupCardActions(item)}
                        />
                    );
                    if (!canSwipeManageList) {
                        return card;
                    }
                    const swipeLabel = canDeleteMeetup(item) ? 'Delete' : 'Cancel';
                    return (
                        <Swipeable
                            containerStyle={styles.swipeableMeetupRow}
                            childrenContainerStyle={styles.swipeableMeetupContent}
                            overshootRight={false}
                            renderRightActions={() => (
                                <TouchableOpacity
                                    style={[styles.deleteAction, pendingMeetupIds.has(item.id) && styles.deleteActionDisabled]}
                                    onPress={() => handleRemoveOrganizerMeetup(item)}
                                    disabled={pendingMeetupIds.has(item.id)}
                                >
                                    <Text style={styles.deleteActionText}>{pendingMeetupIds.has(item.id) ? '...' : swipeLabel}</Text>
                                </TouchableOpacity>
                            )}
                        >
                            {card}
                        </Swipeable>
                    );
                }}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={!currentQuery.isLoading ? emptyState : null}
                ItemSeparatorComponent={renderMeetupSeparator}
                ListFooterComponent={currentQuery.isFetchingNextPage ? <Text style={styles.loadingMore}>Loading more events...</Text> : null}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => void handleRefresh()}
                        tintColor={Colors.primary}
                    />
                }
                {...guardedEndReached}
                onEndReachedThreshold={0.35}
                onScroll={activeView === 'discover' ? discoverScroll.onScroll : undefined}
                scrollEventThrottle={16}
                contentContainerStyle={[
                    screenStandards.listContent,
                ]}
                {...listProps}
            />
            {activeView === 'discover' && discoverScroll.isVisible ? (
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
    list: {
        marginTop: 0,
    },
    deleteAction: {
        width: 92,
        borderRadius: Radius.lg,
        backgroundColor: Colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: Spacing.sm,
        marginRight: Spacing.md,
    },
    deleteActionDisabled: {
        opacity: 0.55,
    },
    deleteActionText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    swipeableMeetupRow: {
        marginHorizontal: -ContentInsets.screenHorizontal,
    },
    swipeableMeetupContent: {
        paddingHorizontal: ContentInsets.screenHorizontal,
    },
    meetupSeparator: {
        height: 1,
        marginHorizontal: -ContentInsets.screenHorizontal,
        backgroundColor: Colors.border.emphasis,
    },
    discoverHeader: {
        gap: Spacing.sm,
        paddingTop: 0,
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
    quickCategoryRow: {
        gap: Spacing.sm,
    },
    quickCategoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    quickCategoryLabel: {
        color: Colors.text.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    quickCategoryHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    quickCategoryHintText: {
        color: Colors.text.muted,
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
    },
    quickCategoryChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    quickCategoryChipActive: {
        backgroundColor: Colors.primarySubtle,
        borderColor: Colors.primary,
    },
    quickCategoryText: {
        color: Colors.text.secondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    quickCategoryTextActive: {
        color: Colors.primary,
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
    sectionHeader: {
        gap: Spacing.sm,
        paddingTop: 0,
        paddingBottom: Spacing.md,
    },
    scopeControl: {
        marginTop: Spacing.sm,
        marginBottom: 0,
    },
    loadingMore: {
        textAlign: 'center',
        color: Colors.text.secondary,
        paddingVertical: Spacing.lg,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    emptyState: {
        marginTop: Spacing.xl,
    },
});
