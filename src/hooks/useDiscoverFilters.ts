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

export const DISCOVER_DATING_GOAL_OPTIONS: { value: Exclude<api.DatingRelationshipGoal, ''>; label: string }[] = [
    { value: 'long_term', label: 'Long-term relationship' },
    { value: 'life_partner', label: 'Life partner' },
    { value: 'short_term_open_to_long_term', label: 'Short-term, open to long-term' },
    { value: 'still_figuring_it_out', label: 'Still figuring it out' },
    { value: 'new_sober_connections', label: 'New sober connections' },
];

export const DISCOVER_FAMILY_PLANS_OPTIONS: { value: Exclude<api.DatingFamilyPlans, ''>; label: string }[] = [
    { value: 'want_children', label: 'Want children' },
    { value: 'dont_want_children', label: 'Do not want children' },
    { value: 'open_to_children', label: 'Open to children' },
    { value: 'not_sure', label: 'Not sure' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const DISCOVER_VICE_OPTIONS: { value: Exclude<api.DatingViceStatus, ''>; label: string }[] = [
    { value: 'yes', label: 'Yes' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'no', label: 'No' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const DISCOVER_SOBER_LIFESTYLE_OPTIONS: { value: Exclude<api.DatingSoberLifestyle, ''>; label: string }[] = [
    { value: 'sober', label: 'Sober' },
    { value: 'sober_curious', label: 'Sober curious' },
    { value: 'in_recovery', label: 'In recovery' },
    { value: 'supportive_ally', label: 'Supportive ally' },
];

export const DISCOVER_RECOVERY_APPROACH_OPTIONS: { value: Exclude<api.DatingRecoveryApproach, ''>; label: string }[] = [
    { value: 'meetings', label: 'Meetings' },
    { value: 'therapy', label: 'Therapy' },
    { value: 'community', label: 'Community' },
    { value: 'private', label: 'Private' },
    { value: 'spiritual', label: 'Spiritual' },
    { value: 'self_guided', label: 'Self-guided' },
];

export const DISCOVER_NIGHTLIFE_OPTIONS: { value: Exclude<api.DatingNightlifeComfort, ''>; label: string }[] = [
    { value: 'dry_spaces_only', label: 'Dry spaces only' },
    { value: 'calm_venues', label: 'Calm venues' },
    { value: 'okay_with_bars', label: 'Okay with bars' },
    { value: 'depends_on_company', label: 'Depends on company' },
    { value: 'prefer_daytime', label: 'Prefer daytime' },
];

export const DISCOVER_BOUNDARY_OPTIONS: { value: Exclude<api.DatingSubstanceBoundaries, ''>; label: string }[] = [
    { value: 'no_substances_around_me', label: 'No substances around me' },
    { value: 'no_drugs', label: 'No drugs' },
    { value: 'no_smoking', label: 'No smoking' },
    { value: 'ask_me_first', label: 'Ask me first' },
    { value: 'flexible', label: 'Flexible' },
];

export type DiscoverGenderValue = typeof DISCOVER_GENDER_OPTIONS[number]['value'];
export type DiscoverSobrietyValue = typeof DISCOVER_SOBRIETY_OPTIONS[number]['value'];
export type DiscoverChipKey =
    | 'gender'
    | 'age'
    | 'distance'
    | 'sobriety'
    | 'relationship_goal'
    | 'height'
    | 'family_plans'
    | 'drinking_status'
    | 'smoking_status'
    | 'drug_use_status'
    | 'sober_lifestyle'
    | 'recovery_approach'
    | 'nightlife_comfort'
    | 'substance_boundary'
    | `interest:${string}`;

export interface DiscoverDraftFilters {
    gender: DiscoverGenderValue;
    ageMin: string;
    ageMax: string;
    distanceKm: number;
    sobriety: DiscoverSobrietyValue;
    interests: string[];
    relationshipGoal: api.DatingRelationshipGoal;
    heightMinCm: string;
    heightMaxCm: string;
    familyPlans: api.DatingFamilyPlans;
    drinkingStatus: api.DatingViceStatus;
    smokingStatus: api.DatingViceStatus;
    drugUseStatus: api.DatingViceStatus;
    soberLifestyle: api.DatingSoberLifestyle;
    recoveryApproach: api.DatingRecoveryApproach;
    nightlifeComfort: api.DatingNightlifeComfort;
    substanceBoundary: api.DatingSubstanceBoundaries;
    broadenIfFewExact: boolean;
}

export interface DiscoverAppliedFilters {
    gender: DiscoverGenderValue;
    ageMin: number | null;
    ageMax: number | null;
    distanceKm: number;
    sobriety: DiscoverSobrietyValue;
    interests: string[];
    relationshipGoal: api.DatingRelationshipGoal;
    heightMinCm: number | null;
    heightMaxCm: number | null;
    familyPlans: api.DatingFamilyPlans;
    drinkingStatus: api.DatingViceStatus;
    smokingStatus: api.DatingViceStatus;
    drugUseStatus: api.DatingViceStatus;
    soberLifestyle: api.DatingSoberLifestyle;
    recoveryApproach: api.DatingRecoveryApproach;
    nightlifeComfort: api.DatingNightlifeComfort;
    substanceBoundary: api.DatingSubstanceBoundaries;
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

interface DiscoverFilterContextOptions {
    includeDatingFields?: boolean;
}

export function createDefaultDiscoverDraftFilters(): DiscoverDraftFilters {
    return {
        gender: 'any',
        ageMin: '',
        ageMax: '',
        distanceKm: DISCOVER_DEFAULT_DISTANCE_KM,
        sobriety: 'any',
        interests: [],
        relationshipGoal: '',
        heightMinCm: '',
        heightMaxCm: '',
        familyPlans: '',
        drinkingStatus: '',
        smokingStatus: '',
        drugUseStatus: '',
        soberLifestyle: '',
        recoveryApproach: '',
        nightlifeComfort: '',
        substanceBoundary: '',
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
        relationshipGoal: '',
        heightMinCm: null,
        heightMaxCm: null,
        familyPlans: '',
        drinkingStatus: '',
        smokingStatus: '',
        drugUseStatus: '',
        soberLifestyle: '',
        recoveryApproach: '',
        nightlifeComfort: '',
        substanceBoundary: '',
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

export function hasNonDefaultDiscoverFilters(filters: DiscoverAppliedFilters, options: DiscoverFilterContextOptions = {}): boolean {
    const includeDatingFields = options.includeDatingFields ?? true;

    return (includeDatingFields && filters.gender !== 'any')
        || (includeDatingFields && filters.ageMin !== null)
        || (includeDatingFields && filters.ageMax !== null)
        || filters.distanceKm !== DISCOVER_DEFAULT_DISTANCE_KM
        || filters.sobriety !== 'any'
        || (filters.interests ?? []).length > 0
        || (includeDatingFields && hasPlusDatingFilters(filters));
}

export function hasPlusDatingFilters(filters: DiscoverAppliedFilters): boolean {
    return filters.relationshipGoal !== ''
        || filters.heightMinCm !== null
        || filters.heightMaxCm !== null
        || filters.familyPlans !== ''
        || filters.drinkingStatus !== ''
        || filters.smokingStatus !== ''
        || filters.drugUseStatus !== ''
        || filters.soberLifestyle !== ''
        || filters.recoveryApproach !== ''
        || filters.nightlifeComfort !== ''
        || filters.substanceBoundary !== '';
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

function optionLabel<T extends string>(options: { value: T; label: string }[], value: T | ''): string | null {
    if (!value) return null;
    return options.find((option) => option.value === value)?.label ?? null;
}

export function getDiscoverFiltersSummary(filters: DiscoverAppliedFilters, options: DiscoverFilterContextOptions = {}): string {
    const includeDatingFields = options.includeDatingFields ?? true;
    const parts = [
        includeDatingFields && filters.gender !== 'any' ? getDiscoverGenderLabel(filters.gender) : null,
        includeDatingFields && (filters.ageMin !== null || filters.ageMax !== null)
            ? `Age ${filters.ageMin ?? 18}-${filters.ageMax ?? 99}`
            : null,
        filters.distanceKm !== DISCOVER_DEFAULT_DISTANCE_KM ? getDiscoverDistanceLabel(filters.distanceKm) : null,
        filters.sobriety !== 'any' ? getDiscoverSobrietyLabel(filters.sobriety) : null,
        (filters.interests ?? []).length > 0 ? `${(filters.interests ?? []).length} interests` : null,
        includeDatingFields && hasPlusDatingFilters(filters) ? 'Plus filters' : null,
    ].filter(Boolean);

    return parts.join(' · ') || 'Suggestions tuned for you';
}

export function getDiscoverActiveChips(filters: DiscoverAppliedFilters, options: DiscoverFilterContextOptions = {}): DiscoverActiveChip[] {
    const includeDatingFields = options.includeDatingFields ?? true;
    const chips: DiscoverActiveChip[] = [];

    if (includeDatingFields && filters.gender !== 'any') {
        chips.push({
            key: 'gender',
            label: getDiscoverGenderLabel(filters.gender) ?? 'Gender',
        });
    }

    if (includeDatingFields && (filters.ageMin !== null || filters.ageMax !== null)) {
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

    for (const interest of filters.interests ?? []) {
        chips.push({
            key: `interest:${interest}`,
            label: interest,
        });
    }

    if (!includeDatingFields) {
        return chips;
    }

    if (filters.relationshipGoal) {
        chips.push({ key: 'relationship_goal', label: optionLabel(DISCOVER_DATING_GOAL_OPTIONS, filters.relationshipGoal) ?? 'Dating intentions' });
    }

    if (filters.heightMinCm !== null || filters.heightMaxCm !== null) {
        chips.push({ key: 'height', label: `Height ${filters.heightMinCm ?? 90}-${filters.heightMaxCm ?? 230} cm` });
    }

    if (filters.familyPlans) {
        chips.push({ key: 'family_plans', label: optionLabel(DISCOVER_FAMILY_PLANS_OPTIONS, filters.familyPlans) ?? 'Family plans' });
    }

    if (filters.drinkingStatus) {
        chips.push({ key: 'drinking_status', label: `Drinking: ${optionLabel(DISCOVER_VICE_OPTIONS, filters.drinkingStatus) ?? filters.drinkingStatus}` });
    }

    if (filters.smokingStatus) {
        chips.push({ key: 'smoking_status', label: `Smoking: ${optionLabel(DISCOVER_VICE_OPTIONS, filters.smokingStatus) ?? filters.smokingStatus}` });
    }

    if (filters.drugUseStatus) {
        chips.push({ key: 'drug_use_status', label: `Drug use: ${optionLabel(DISCOVER_VICE_OPTIONS, filters.drugUseStatus) ?? filters.drugUseStatus}` });
    }

    if (filters.soberLifestyle) {
        chips.push({ key: 'sober_lifestyle', label: optionLabel(DISCOVER_SOBER_LIFESTYLE_OPTIONS, filters.soberLifestyle) ?? 'Sober lifestyle' });
    }

    if (filters.recoveryApproach) {
        chips.push({ key: 'recovery_approach', label: optionLabel(DISCOVER_RECOVERY_APPROACH_OPTIONS, filters.recoveryApproach) ?? 'Recovery approach' });
    }

    if (filters.nightlifeComfort) {
        chips.push({ key: 'nightlife_comfort', label: optionLabel(DISCOVER_NIGHTLIFE_OPTIONS, filters.nightlifeComfort) ?? 'Nightlife comfort' });
    }

    if (filters.substanceBoundary) {
        chips.push({ key: 'substance_boundary', label: optionLabel(DISCOVER_BOUNDARY_OPTIONS, filters.substanceBoundary) ?? 'Substance boundary' });
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
        interests: [...(filters.interests ?? [])],
        relationshipGoal: filters.relationshipGoal,
        heightMinCm: filters.heightMinCm === null ? '' : String(filters.heightMinCm),
        heightMaxCm: filters.heightMaxCm === null ? '' : String(filters.heightMaxCm),
        familyPlans: filters.familyPlans,
        drinkingStatus: filters.drinkingStatus,
        smokingStatus: filters.smokingStatus,
        drugUseStatus: filters.drugUseStatus,
        soberLifestyle: filters.soberLifestyle,
        recoveryApproach: filters.recoveryApproach,
        nightlifeComfort: filters.nightlifeComfort,
        substanceBoundary: filters.substanceBoundary,
        broadenIfFewExact: filters.broadenIfFewExact,
    };
}

export function validateDiscoverDraft(
    filters: DiscoverDraftFilters,
    options: DiscoverFilterContextOptions = {},
): { normalized?: DiscoverAppliedFilters; error?: string } {
    const includeDatingFields = options.includeDatingFields ?? true;
    const ageMin = filters.ageMin.trim() ? Number(filters.ageMin.trim()) : null;
    const ageMax = filters.ageMax.trim() ? Number(filters.ageMax.trim()) : null;
    const heightMinCm = filters.heightMinCm.trim() ? Number(filters.heightMinCm.trim()) : null;
    const heightMaxCm = filters.heightMaxCm.trim() ? Number(filters.heightMaxCm.trim()) : null;

    if (includeDatingFields && [ageMin, ageMax, heightMinCm, heightMaxCm].some((value) => value !== null && Number.isNaN(value))) {
        return { error: 'Age and height values must be valid numbers.' };
    }

    if (includeDatingFields && ageMin !== null && ageMax !== null && ageMin > ageMax) {
        return { error: 'Minimum age cannot be greater than maximum age.' };
    }

    if (includeDatingFields && heightMinCm !== null && heightMaxCm !== null && heightMinCm > heightMaxCm) {
        return { error: 'Minimum height cannot be greater than maximum height.' };
    }

    if (includeDatingFields && ((heightMinCm !== null && (heightMinCm < 90 || heightMinCm > 230)) || (heightMaxCm !== null && (heightMaxCm < 90 || heightMaxCm > 230)))) {
        return { error: 'Height must be between 90 cm and 230 cm.' };
    }

    return {
        normalized: {
            gender: includeDatingFields ? filters.gender : 'any',
            ageMin: includeDatingFields ? ageMin : null,
            ageMax: includeDatingFields ? ageMax : null,
            distanceKm: filters.distanceKm,
            sobriety: filters.sobriety,
            interests: [...(filters.interests ?? [])],
            relationshipGoal: includeDatingFields ? filters.relationshipGoal : '',
            heightMinCm: includeDatingFields ? heightMinCm : null,
            heightMaxCm: includeDatingFields ? heightMaxCm : null,
            familyPlans: includeDatingFields ? filters.familyPlans : '',
            drinkingStatus: includeDatingFields ? filters.drinkingStatus : '',
            smokingStatus: includeDatingFields ? filters.smokingStatus : '',
            drugUseStatus: includeDatingFields ? filters.drugUseStatus : '',
            soberLifestyle: includeDatingFields ? filters.soberLifestyle : '',
            recoveryApproach: includeDatingFields ? filters.recoveryApproach : '',
            nightlifeComfort: includeDatingFields ? filters.nightlifeComfort : '',
            substanceBoundary: includeDatingFields ? filters.substanceBoundary : '',
            broadenIfFewExact: filters.broadenIfFewExact,
        },
    };
}

export function toDiscoverApiFilters(filters: DiscoverAppliedFilters, options: DiscoverFilterContextOptions = {}): api.DiscoverFiltersPayload {
    const includeDatingFields = options.includeDatingFields ?? true;

    return {
        gender: includeDatingFields && filters.gender !== 'any' ? filters.gender : undefined,
        ageMin: includeDatingFields ? filters.ageMin ?? undefined : undefined,
        ageMax: includeDatingFields ? filters.ageMax ?? undefined : undefined,
        distanceKm: filters.distanceKm,
        sobriety: filters.sobriety === 'any' ? undefined : filters.sobriety,
        interests: (filters.interests ?? []).length > 0 ? filters.interests : undefined,
        relationshipGoal: includeDatingFields ? filters.relationshipGoal || undefined : undefined,
        heightMinCm: includeDatingFields ? filters.heightMinCm ?? undefined : undefined,
        heightMaxCm: includeDatingFields ? filters.heightMaxCm ?? undefined : undefined,
        familyPlans: includeDatingFields ? filters.familyPlans || undefined : undefined,
        drinkingStatus: includeDatingFields ? filters.drinkingStatus || undefined : undefined,
        smokingStatus: includeDatingFields ? filters.smokingStatus || undefined : undefined,
        drugUseStatus: includeDatingFields ? filters.drugUseStatus || undefined : undefined,
        soberLifestyle: includeDatingFields ? filters.soberLifestyle || undefined : undefined,
        recoveryApproach: includeDatingFields ? filters.recoveryApproach || undefined : undefined,
        nightlifeComfort: includeDatingFields ? filters.nightlifeComfort || undefined : undefined,
        substanceBoundary: includeDatingFields ? filters.substanceBoundary || undefined : undefined,
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

    const effectiveFilters = preview.effective_filters ?? {};
    const effective: DiscoverAppliedFilters = {
        ...requested,
        gender: (effectiveFilters.gender ?? requested.gender) as DiscoverGenderValue,
        ageMin: effectiveFilters.age_min ?? requested.ageMin,
        ageMax: effectiveFilters.age_max ?? requested.ageMax,
        distanceKm: effectiveFilters.distance_km ?? requested.distanceKm,
        sobriety: (effectiveFilters.sobriety ?? requested.sobriety) as DiscoverSobrietyValue,
        interests: [...(effectiveFilters.interests ?? requested.interests ?? [])],
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
            interests: (filters.interests ?? []).filter((item) => item !== interest),
        };
    }
    if (chipKey === 'relationship_goal') return { ...filters, relationshipGoal: '' };
    if (chipKey === 'height') return { ...filters, heightMinCm: null, heightMaxCm: null };
    if (chipKey === 'family_plans') return { ...filters, familyPlans: '' };
    if (chipKey === 'drinking_status') return { ...filters, drinkingStatus: '' };
    if (chipKey === 'smoking_status') return { ...filters, smokingStatus: '' };
    if (chipKey === 'drug_use_status') return { ...filters, drugUseStatus: '' };
    if (chipKey === 'sober_lifestyle') return { ...filters, soberLifestyle: '' };
    if (chipKey === 'recovery_approach') return { ...filters, recoveryApproach: '' };
    if (chipKey === 'nightlife_comfort') return { ...filters, nightlifeComfort: '' };
    if (chipKey === 'substance_boundary') return { ...filters, substanceBoundary: '' };
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
