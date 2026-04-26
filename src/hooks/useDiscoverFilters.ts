import { useCallback, useState } from 'react';
import type * as api from '../api/client';

export const DISCOVER_DEFAULT_DISTANCE_KM = 50;

export const DISCOVER_GENDER_OPTIONS = [
    { value: 'any', label: 'Any' },
    { value: 'woman', label: 'Women' },
    { value: 'man', label: 'Men' },
    { value: 'non_binary', label: 'Non-binary' },
] as const;

export const DISCOVER_SOBRIETY_OPTIONS = [
    { value: 'any', label: 'Any' },
    { value: 'days_30', label: '30+ days' },
    { value: 'days_90', label: '90+ days' },
    { value: 'years_1', label: '1+ year' },
    { value: 'years_5', label: '5+ years' },
] as const;

export type DiscoverGenderValue = typeof DISCOVER_GENDER_OPTIONS[number]['value'];
export type DiscoverSobrietyValue = typeof DISCOVER_SOBRIETY_OPTIONS[number]['value'];
export type DiscoverChipKey =
    | 'gender'
    | 'age'
    | 'distance'
    | 'sobriety'
    | `interest:${string}`;

export interface DiscoverDraftFilters {
    gender: DiscoverGenderValue;
    ageMin: string;
    ageMax: string;
    distanceKm: number;
    sobriety: DiscoverSobrietyValue;
    interests: string[];
    broadenIfFewExact: boolean;
}

export interface DiscoverAppliedFilters {
    gender: DiscoverGenderValue;
    ageMin: number | null;
    ageMax: number | null;
    distanceKm: number;
    sobriety: DiscoverSobrietyValue;
    interests: string[];
    broadenIfFewExact: boolean;
}

export interface DiscoverAppliedState {
    requested: DiscoverAppliedFilters;
    effective: DiscoverAppliedFilters;
    broadened: boolean;
    relaxedFields: api.DiscoverRelaxedField[];
    exactCount?: number;
    broadenedCount?: number;
}

export interface DiscoverActiveChip {
    key: DiscoverChipKey;
    label: string;
}

export function createDefaultDiscoverDraftFilters(): DiscoverDraftFilters {
    return {
        gender: 'any',
        ageMin: '',
        ageMax: '',
        distanceKm: DISCOVER_DEFAULT_DISTANCE_KM,
        sobriety: 'any',
        interests: [],
        broadenIfFewExact: true,
    };
}

export function createDefaultDiscoverAppliedFilters(): DiscoverAppliedFilters {
    return {
        gender: 'any',
        ageMin: null,
        ageMax: null,
        distanceKm: DISCOVER_DEFAULT_DISTANCE_KM,
        sobriety: 'any',
        interests: [],
        broadenIfFewExact: true,
    };
}

export function createDefaultDiscoverAppliedState(): DiscoverAppliedState {
    const filters = createDefaultDiscoverAppliedFilters();
    return {
        requested: filters,
        effective: filters,
        broadened: false,
        relaxedFields: [],
    };
}

export function hasNonDefaultDiscoverFilters(filters: DiscoverAppliedFilters): boolean {
    return filters.gender !== 'any'
        || filters.ageMin !== null
        || filters.ageMax !== null
        || filters.distanceKm !== DISCOVER_DEFAULT_DISTANCE_KM
        || filters.sobriety !== 'any'
        || filters.interests.length > 0;
}

export function getDiscoverDistanceLabel(distanceKm: number): string {
    if (distanceKm === 0) return 'Anywhere';
    return `Within ${distanceKm} km`;
}

export function getDiscoverGenderLabel(gender: DiscoverGenderValue): string | null {
    return DISCOVER_GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? null;
}

export function getDiscoverSobrietyLabel(sobriety: DiscoverSobrietyValue): string | null {
    return DISCOVER_SOBRIETY_OPTIONS.find((option) => option.value === sobriety)?.label ?? null;
}

export function getDiscoverFiltersSummary(filters: DiscoverAppliedFilters): string {
    const parts = [
        filters.gender !== 'any' ? getDiscoverGenderLabel(filters.gender) : null,
        filters.ageMin !== null || filters.ageMax !== null
            ? `Age ${filters.ageMin ?? 18}-${filters.ageMax ?? 99}`
            : null,
        filters.distanceKm !== DISCOVER_DEFAULT_DISTANCE_KM ? getDiscoverDistanceLabel(filters.distanceKm) : null,
        filters.sobriety !== 'any' ? getDiscoverSobrietyLabel(filters.sobriety) : null,
        filters.interests.length > 0 ? `${filters.interests.length} interests` : null,
    ].filter(Boolean);

    return parts.join(' · ') || 'Suggestions tuned for you';
}

export function getDiscoverActiveChips(filters: DiscoverAppliedFilters): DiscoverActiveChip[] {
    const chips: DiscoverActiveChip[] = [];

    if (filters.gender !== 'any') {
        chips.push({
            key: 'gender',
            label: getDiscoverGenderLabel(filters.gender) ?? 'Gender',
        });
    }

    if (filters.ageMin !== null || filters.ageMax !== null) {
        chips.push({
            key: 'age',
            label: `Age ${filters.ageMin ?? 18}-${filters.ageMax ?? 99}`,
        });
    }

    if (filters.distanceKm !== DISCOVER_DEFAULT_DISTANCE_KM) {
        chips.push({
            key: 'distance',
            label: getDiscoverDistanceLabel(filters.distanceKm),
        });
    }

    if (filters.sobriety !== 'any') {
        chips.push({
            key: 'sobriety',
            label: getDiscoverSobrietyLabel(filters.sobriety) ?? 'Sobriety',
        });
    }

    for (const interest of filters.interests) {
        chips.push({
            key: `interest:${interest}`,
            label: interest,
        });
    }

    return chips;
}

export function createDiscoverDraftFromApplied(filters: DiscoverAppliedFilters): DiscoverDraftFilters {
    return {
        gender: filters.gender,
        ageMin: filters.ageMin === null ? '' : String(filters.ageMin),
        ageMax: filters.ageMax === null ? '' : String(filters.ageMax),
        distanceKm: filters.distanceKm,
        sobriety: filters.sobriety,
        interests: [...filters.interests],
        broadenIfFewExact: filters.broadenIfFewExact,
    };
}

export function validateDiscoverDraft(filters: DiscoverDraftFilters): { normalized?: DiscoverAppliedFilters; error?: string } {
    const ageMin = filters.ageMin.trim() ? Number(filters.ageMin.trim()) : null;
    const ageMax = filters.ageMax.trim() ? Number(filters.ageMax.trim()) : null;

    if ((ageMin !== null && Number.isNaN(ageMin)) || (ageMax !== null && Number.isNaN(ageMax))) {
        return { error: 'Age values must be valid numbers.' };
    }

    if (ageMin !== null && ageMax !== null && ageMin > ageMax) {
        return { error: 'Minimum age cannot be greater than maximum age.' };
    }

    return {
        normalized: {
            gender: filters.gender,
            ageMin,
            ageMax,
            distanceKm: filters.distanceKm,
            sobriety: filters.sobriety,
            interests: [...filters.interests],
            broadenIfFewExact: filters.broadenIfFewExact,
        },
    };
}

export function toDiscoverApiFilters(filters: DiscoverAppliedFilters): api.DiscoverFiltersPayload {
    return {
        gender: filters.gender === 'any' ? undefined : filters.gender,
        ageMin: filters.ageMin ?? undefined,
        ageMax: filters.ageMax ?? undefined,
        distanceKm: filters.distanceKm,
        sobriety: filters.sobriety === 'any' ? undefined : filters.sobriety,
        interests: filters.interests.length > 0 ? filters.interests : undefined,
    };
}

export function applyDiscoverPreviewEffectiveFilters(
    requested: DiscoverAppliedFilters,
    preview: api.DiscoverPreviewResponse | undefined,
): DiscoverAppliedState {
    if (
        !preview
        || preview.exact_count > 0
        || !requested.broadenIfFewExact
        || !preview.broadened_available
        || !preview.relaxed_filters?.length
    ) {
        return {
            requested,
            effective: requested,
            broadened: false,
            relaxedFields: [],
            exactCount: preview?.exact_count,
            broadenedCount: preview?.broadened_count,
        };
    }

    const effective: DiscoverAppliedFilters = {
        ...requested,
        gender: (preview.effective_filters.gender ?? requested.gender) as DiscoverGenderValue,
        ageMin: preview.effective_filters.age_min ?? requested.ageMin,
        ageMax: preview.effective_filters.age_max ?? requested.ageMax,
        distanceKm: preview.effective_filters.distance_km ?? requested.distanceKm,
        sobriety: (preview.effective_filters.sobriety ?? requested.sobriety) as DiscoverSobrietyValue,
        interests: [...(preview.effective_filters.interests ?? requested.interests)],
    };

    return {
        requested,
        effective,
        broadened: true,
        relaxedFields: [...(preview.relaxed_filters ?? [])],
        exactCount: preview.exact_count,
        broadenedCount: preview.broadened_count,
    };
}

export function clearDiscoverChip(filters: DiscoverAppliedFilters, chipKey: DiscoverChipKey): DiscoverAppliedFilters {
    if (chipKey === 'gender') {
        return { ...filters, gender: 'any' };
    }
    if (chipKey === 'age') {
        return { ...filters, ageMin: null, ageMax: null };
    }
    if (chipKey === 'distance') {
        return { ...filters, distanceKm: DISCOVER_DEFAULT_DISTANCE_KM };
    }
    if (chipKey === 'sobriety') {
        return { ...filters, sobriety: 'any' };
    }
    if (chipKey.startsWith('interest:')) {
        const interest = chipKey.slice('interest:'.length);
        return {
            ...filters,
            interests: filters.interests.filter((item) => item !== interest),
        };
    }
    return filters;
}

export function getDiscoverRelaxedCopy(relaxedFields: api.DiscoverRelaxedField[]): string {
    if (relaxedFields.length === 0) return 'Showing exact matches';

    const labels = relaxedFields.map((field) => {
        switch (field) {
        case 'distance':
            return 'distance';
        case 'age':
            return 'age range';
        case 'interests':
            return 'shared interests';
        case 'sobriety':
            return 'sobriety';
        }
    });

    return `Broadened by ${labels.join(', ')}`;
}

export function useDiscoverFilters() {
    const [draftFilters, setDraftFilters] = useState<DiscoverDraftFilters>(createDefaultDiscoverDraftFilters);
    const [appliedState, setAppliedState] = useState<DiscoverAppliedState>(createDefaultDiscoverAppliedState);

    const resetFilters = useCallback(() => {
        const nextDraft = createDefaultDiscoverDraftFilters();
        setDraftFilters(nextDraft);
        setAppliedState(createDefaultDiscoverAppliedState());
    }, []);

    const syncDraftToApplied = useCallback(() => {
        setDraftFilters(createDiscoverDraftFromApplied(appliedState.requested));
    }, [appliedState.requested]);

    const applyDraft = useCallback((preview?: api.DiscoverPreviewResponse) => {
        const validated = validateDiscoverDraft(draftFilters);
        if (!validated.normalized) {
            return { error: validated.error };
        }

        const nextState = applyDiscoverPreviewEffectiveFilters(validated.normalized, preview);
        setAppliedState(nextState);
        setDraftFilters(createDiscoverDraftFromApplied(validated.normalized));
        return { nextState };
    }, [draftFilters]);

    const clearChip = useCallback((chipKey: DiscoverChipKey) => {
        setAppliedState((current) => {
            const nextRequested = clearDiscoverChip(current.requested, chipKey);
            const nextState: DiscoverAppliedState = {
                requested: nextRequested,
                effective: nextRequested,
                broadened: false,
                relaxedFields: [],
            };
            setDraftFilters(createDiscoverDraftFromApplied(nextRequested));
            return nextState;
        });
    }, []);

    return {
        draftFilters,
        setDraftFilters,
        appliedState,
        setAppliedState,
        resetFilters,
        syncDraftToApplied,
        applyDraft,
        clearChip,
    };
}
