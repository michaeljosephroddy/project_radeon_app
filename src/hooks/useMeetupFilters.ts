import * as api from '../api/client';

export interface MeetupDraftFilters {
    query: string;
    category: string;
    locationQuery: string;
    locationCity: string;
    locationCountry?: string | null;
    eventType: '' | api.MeetupEventType;
    datePreset: '' | Exclude<api.MeetupDatePreset, 'custom'>;
    openSpotsOnly: boolean;
}

export interface MeetupFilterChip {
    key: string;
    label: string;
}

export const MEETUP_EVENT_TYPE_OPTIONS: Array<{ value: '' | api.MeetupEventType; label: string }> = [
    { value: '', label: 'All formats' },
    { value: 'in_person', label: 'In person' },
    { value: 'online', label: 'Online' },
    { value: 'hybrid', label: 'Hybrid' },
];

export const MEETUP_DATE_PRESET_OPTIONS: Array<{ value: MeetupDraftFilters['datePreset']; label: string }> = [
    { value: '', label: 'Any date' },
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'this_week', label: 'This week' },
    { value: 'this_weekend', label: 'Weekend' },
];

export const DEFAULT_MEETUP_FILTERS: MeetupDraftFilters = {
    query: '',
    category: '',
    locationQuery: '',
    locationCity: '',
    locationCountry: null,
    eventType: '',
    datePreset: '',
    openSpotsOnly: false,
};

export function toMeetupQueryFilters(filters: MeetupDraftFilters): api.MeetupFilters {
    return {
        q: filters.query.trim() || undefined,
        category: filters.category || undefined,
        city: filters.locationCity || filters.locationQuery.trim() || undefined,
        country: filters.locationCity ? filters.locationCountry ?? undefined : undefined,
        event_type: filters.eventType || undefined,
        date_preset: filters.datePreset || undefined,
        open_spots_only: filters.openSpotsOnly || undefined,
        sort: 'recommended',
    };
}

export function hasMeetupFilters(filters: MeetupDraftFilters): boolean {
    return Boolean(
        filters.category
        || filters.locationCity
        || filters.locationQuery.trim()
        || filters.eventType
        || filters.datePreset
        || filters.openSpotsOnly,
    );
}

export function getMeetupFilterChips(
    filters: MeetupDraftFilters,
    categories: api.MeetupCategory[],
): MeetupFilterChip[] {
    const chips: MeetupFilterChip[] = [];
    const categoryLabel = categories.find((category) => category.slug === filters.category)?.label;
    if (categoryLabel) chips.push({ key: 'category', label: categoryLabel });
    const locationLabel = getMeetupLocationFilterLabel(filters);
    if (locationLabel) chips.push({ key: 'location', label: locationLabel });
    if (filters.eventType) {
        const match = MEETUP_EVENT_TYPE_OPTIONS.find((option) => option.value === filters.eventType);
        if (match) chips.push({ key: 'eventType', label: match.label });
    }
    if (filters.datePreset) {
        const match = MEETUP_DATE_PRESET_OPTIONS.find((option) => option.value === filters.datePreset);
        if (match) chips.push({ key: 'datePreset', label: match.label });
    }
    if (filters.openSpotsOnly) chips.push({ key: 'openSpotsOnly', label: 'Open spots' });
    return chips;
}

export function getMeetupLocationFilterLabel(filters: MeetupDraftFilters): string | null {
    const city = filters.locationCity || filters.locationQuery.trim();
    if (!city) return null;
    return filters.locationCountry ? `${city}, ${filters.locationCountry}` : city;
}

export function removeMeetupFilter(filters: MeetupDraftFilters, key: string): MeetupDraftFilters {
    switch (key) {
        case 'category':
            return { ...filters, category: '' };
        case 'location':
            return { ...filters, locationQuery: '', locationCity: '', locationCountry: null };
        case 'eventType':
            return { ...filters, eventType: '' };
        case 'datePreset':
            return { ...filters, datePreset: '' };
        case 'openSpotsOnly':
            return { ...filters, openSpotsOnly: false };
        default:
            return filters;
    }
}
