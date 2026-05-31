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

interface UseRecoveryMeetingFiltersResult {
    draftFilters: RecoveryMeetingFilters;
    setDraftFilters: React.Dispatch<React.SetStateAction<RecoveryMeetingFilters>>;
    appliedFilters: RecoveryMeetingFilters;
    apiFilters: api.RecoveryMeetingFilters;
    activeFilterChips: ActiveFilterChip[];
    filterOpen: boolean;
    setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
    handleApplyFilters: () => void;
    handleResetFilters: () => void;
    applyFilterPatch: (patch: Partial<RecoveryMeetingFilters>) => void;
    clearAppliedFilter: (patch: Partial<RecoveryMeetingFilters>) => void;
    removeActiveFilter: (chip: ActiveFilterChip) => void;
}

function resetMeetingFilters(): RecoveryMeetingFilters {
    return cloneMeetingFilters(DEFAULT_MEETING_FILTERS);
}

export function useRecoveryMeetingFilters(): UseRecoveryMeetingFiltersResult {
    const [draftFilters, setDraftFilters] = React.useState<RecoveryMeetingFilters>(() => resetMeetingFilters());
    const [appliedFilters, setAppliedFilters] = React.useState<RecoveryMeetingFilters>(() => resetMeetingFilters());
    const [filterOpen, setFilterOpen] = React.useState(false);

    const apiFilters = React.useMemo(() => filtersToApiParams(appliedFilters), [appliedFilters]);
    const activeFilterChips = React.useMemo(
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

    const applyFilterPatch = (patch: Partial<RecoveryMeetingFilters>): void => {
        setAppliedFilters((current) => ({ ...current, ...patch }));
        setDraftFilters((current) => ({ ...current, ...patch }));
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
        handleApplyFilters,
        handleResetFilters,
        applyFilterPatch,
        clearAppliedFilter,
        removeActiveFilter,
    };
}
