import React from 'react';
import * as api from '../../../api/client';
import {
    ActiveFilterChip,
    DEFAULT_MEETING_FILTERS,
    RecoveryMeetingFilters,
    cloneMeetingFilters,
    filtersToApiParams,
    getActiveFilterChips,
} from './recoveryMeetings';

const SEARCH_DEBOUNCE_MS = 350;

interface UseRecoveryMeetingFiltersResult {
    draftFilters: RecoveryMeetingFilters;
    setDraftFilters: React.Dispatch<React.SetStateAction<RecoveryMeetingFilters>>;
    appliedFilters: RecoveryMeetingFilters;
    apiFilters: api.RecoveryMeetingFilters;
    activeFilterChips: ActiveFilterChip[];
    filterOpen: boolean;
    setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
    hasManualFinderIntent: boolean;
    handleApplyFilters: () => void;
    handleResetFilters: () => void;
    clearAppliedFilter: (patch: Partial<RecoveryMeetingFilters>) => void;
    removeActiveFilter: (chip: ActiveFilterChip) => void;
}

function useDebounce<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = React.useState(value);

    React.useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}

function resetMeetingFilters(): RecoveryMeetingFilters {
    return cloneMeetingFilters(DEFAULT_MEETING_FILTERS);
}

function normalizeSearchQuery(value: string): string {
    return value.trim();
}

export function useRecoveryMeetingFilters(): UseRecoveryMeetingFiltersResult {
    const [draftFilters, setDraftFilters] = React.useState<RecoveryMeetingFilters>(() => resetMeetingFilters());
    const [appliedFilters, setAppliedFilters] = React.useState<RecoveryMeetingFilters>(() => resetMeetingFilters());
    const [filterOpen, setFilterOpen] = React.useState(false);
    const debouncedQuery = useDebounce(draftFilters.query, SEARCH_DEBOUNCE_MS);

    React.useEffect(() => {
        const nextQuery = normalizeSearchQuery(debouncedQuery);
        setAppliedFilters((current) => (
            current.query === nextQuery ? current : { ...current, query: nextQuery }
        ));
    }, [debouncedQuery]);

    const apiFilters = React.useMemo(() => filtersToApiParams(appliedFilters), [appliedFilters]);
    const activeFilterChips = React.useMemo(
        () => getActiveFilterChips(appliedFilters),
        [appliedFilters],
    );
    const hasManualFinderIntent = Boolean(
        appliedFilters.query.trim()
        || appliedFilters.location.trim()
        || appliedFilters.country.trim()
        || appliedFilters.region.trim()
        || appliedFilters.fellowships.length
        || appliedFilters.meetingType
        || appliedFilters.dayOfWeek !== null
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

    const clearAppliedFilter = (patch: Partial<RecoveryMeetingFilters>): void => {
        setAppliedFilters((current) => ({ ...current, ...patch }));
        setDraftFilters((current) => ({ ...current, ...patch }));
    };

    const removeActiveFilter = (chip: ActiveFilterChip): void => {
        const next = chip.remove(appliedFilters);
        setAppliedFilters(next);
        setDraftFilters(next);
    };

    return {
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
    };
}
