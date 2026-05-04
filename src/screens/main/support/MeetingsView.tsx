import { appAlert } from '@/components/ui/appAlert';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
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
import { useScrollToTopButton } from '../../../hooks/useScrollToTopButton';
import { screenStandards } from '../../../styles/screenStandards';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { getListPerformanceProps } from '../../../utils/listPerformance';
import {
    ActiveFilterChip,
    DEFAULT_MEETING_FILTERS,
    RECOVERY_MEETINGS,
    RecoveryMeeting,
    RecoveryMeetingFilters,
    applyMeetingFilters,
    getActiveFilterChips,
} from './recoveryMeetingsMock';

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

function cloneMeetingFilters(filters: RecoveryMeetingFilters): RecoveryMeetingFilters {
    return {
        ...filters,
        fellowships: [...filters.fellowships],
        daysOfWeek: [...filters.daysOfWeek],
        timeBuckets: [...filters.timeBuckets],
        meetingTypes: [...filters.meetingTypes],
    };
}

function resetMeetingFilters(): RecoveryMeetingFilters {
    return cloneMeetingFilters(DEFAULT_MEETING_FILTERS);
}

function showMeetingPlaceholder(meeting: RecoveryMeeting): void {
    appAlert.alert(
        'Coming soon',
        `${meeting.name} details will be available here soon.`,
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

    useEffect(() => {
        setAppliedFilters((current) => (
            current.query === debouncedQuery ? current : { ...current, query: debouncedQuery }
        ));
    }, [debouncedQuery]);

    const meetings = useMemo(
        () => applyMeetingFilters(RECOVERY_MEETINGS, appliedFilters),
        [appliedFilters],
    );

    const activeFilterChips = useMemo(
        () => getActiveFilterChips(appliedFilters),
        [appliedFilters],
    );

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

    const renderHeader = (): React.ReactElement => (
        <View style={styles.header}>
            {showHeaderNotice ? (
                <InfoNoticeCard
                    title="Find recovery meetings"
                    description="Browse peer support meetings by fellowship, country, city, day, time, and format."
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
                onScroll={scrollToTop.onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={screenStandards.listContent}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={
                    <EmptyState
                        title="No meetings match those filters"
                        description="Try a wider location, another day, or clearing the fellowship and format filters."
                        style={styles.emptyState}
                    />
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => (
                    <RecoveryMeetingCard meeting={item} onPress={showMeetingPlaceholder} />
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
        gap: Spacing.md,
        paddingBottom: Spacing.md,
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
});
