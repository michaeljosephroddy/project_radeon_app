import { appAlert } from '@/components/ui/appAlert';
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
import { InfoNoticeCard } from '../../../components/ui/InfoNoticeCard';
import { SearchBar } from '../../../components/ui/SearchBar';
import { ScrollToTopButton } from '../../../components/ui/ScrollToTopButton';
import { useGuardedEndReached } from '../../../hooks/useGuardedEndReached';
import { useRecoveryMeetings } from '../../../hooks/queries/useRecoveryMeetings';
import { useScrollToTopButton } from '../../../hooks/useScrollToTopButton';
import { screenStandards } from '../../../styles/screenStandards';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { getListPerformanceProps } from '../../../utils/listPerformance';
import {
    ActiveFilterChip,
    DEFAULT_MEETING_FILTERS,
    RecoveryMeeting,
    RecoveryMeetingFilters,
    cloneMeetingFilters,
    filtersToApiParams,
    formatAddressLine,
    formatLocationLine,
    formatOccurrence,
    getActiveFilterChips,
    getPrimaryOccurrence,
} from './recoveryMeetings';

interface MeetingsViewProps {
    isActive: boolean;
}

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

function showMeetingDetails(meeting: RecoveryMeeting): void {
    const schedule = formatOccurrence(getPrimaryOccurrence(meeting));
    const location = formatLocationLine(meeting);
    const address = formatAddressLine(meeting);
    const online = meeting.online_url ? `\n\nOnline link:\n${meeting.online_url}` : '';
    const phone = meeting.phone_join_info ? `\n\nCredentials:\n${meeting.phone_join_info}` : '';
    const source = meeting.source_url ? `\n\nSource:\n${meeting.source_url}` : '';
    appAlert.alert(
        meeting.name,
        `${schedule}\n${location}${address ? `\n${address}` : ''}${online}${phone}${source}`,
    );
}

export function MeetingsView({ isActive }: MeetingsViewProps) {
    const listRef = useRef<FlatList<RecoveryMeeting> | null>(null);
    const [draftFilters, setDraftFilters] = useState<RecoveryMeetingFilters>(() => resetMeetingFilters());
    const [appliedFilters, setAppliedFilters] = useState<RecoveryMeetingFilters>(() => resetMeetingFilters());
    const [filterOpen, setFilterOpen] = useState(false);
    const [showHeaderNotice, setShowHeaderNotice] = useState(true);
    const debouncedQuery = useDebounce(draftFilters.query, 300);
    const listProps = getListPerformanceProps('detailList');
    const scrollToTop = useScrollToTopButton({ threshold: 320 });
    const apiFilters = useMemo(() => filtersToApiParams(appliedFilters), [appliedFilters]);
    const recoveryMeetingsQuery = useRecoveryMeetings({ ...apiFilters, limit: 20 }, isActive);

    useEffect(() => {
        setAppliedFilters((current) => (
            current.query === debouncedQuery ? current : { ...current, query: debouncedQuery }
        ));
    }, [debouncedQuery]);

    const meetings = useMemo(() => (
        recoveryMeetingsQuery.data?.pages.flatMap((page) => page.items) ?? []
    ), [recoveryMeetingsQuery.data]);

    const activeFilterChips = useMemo(
        () => getActiveFilterChips(appliedFilters),
        [appliedFilters],
    );

    const loadNextPage = useCallback(async (): Promise<void> => {
        if (!recoveryMeetingsQuery.hasNextPage || recoveryMeetingsQuery.isFetchingNextPage) {
            return;
        }
        await recoveryMeetingsQuery.fetchNextPage();
    }, [recoveryMeetingsQuery]);

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

    const removeActiveFilter = (chip: ActiveFilterChip): void => {
        const next = chip.remove(appliedFilters);
        setAppliedFilters(next);
        setDraftFilters(next);
    };

    const emptyTitle = recoveryMeetingsQuery.isLoading
        ? 'Loading recovery meetings'
        : recoveryMeetingsQuery.isError
            ? 'Could not load recovery meetings'
            : 'No meetings match those filters';
    const emptyDescription = recoveryMeetingsQuery.isLoading
        ? 'Real meeting data is loading from SoberSpace.'
        : recoveryMeetingsQuery.isError
            ? 'Check your connection, then pull to refresh.'
            : 'Try a wider location, another day, or clearing fellowship and mode filters.';

    const renderHeader = (): React.ReactElement => (
        <View style={styles.header}>
            {showHeaderNotice ? (
                <InfoNoticeCard
                    title="Find recovery meetings"
                    description="Browse imported peer support meetings by fellowship, location, day, and mode."
                    onDismiss={() => setShowHeaderNotice(false)}
                />
            ) : null}
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
                        refreshing={recoveryMeetingsQuery.isRefetching && !recoveryMeetingsQuery.isFetchingNextPage}
                        onRefresh={() => void recoveryMeetingsQuery.refetch()}
                        tintColor={Colors.primary}
                    />
                }
                contentContainerStyle={screenStandards.listContent}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={
                    <EmptyState
                        title={emptyTitle}
                        description={emptyDescription}
                        style={styles.emptyState}
                    />
                }
                ListFooterComponent={
                    recoveryMeetingsQuery.isFetchingNextPage ? (
                        <View style={styles.footerLoading}>
                            <ActivityIndicator color={Colors.primary} />
                        </View>
                    ) : null
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => (
                    <RecoveryMeetingCard meeting={item} onPress={showMeetingDetails} />
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
    separator: {
        height: Spacing.md,
    },
    emptyState: {
        marginTop: Spacing.xl,
    },
    footerLoading: {
        paddingVertical: Spacing.lg,
    },
});
