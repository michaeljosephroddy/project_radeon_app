import * as api from '../api/client';

export interface MeetupDraftFilters {
    query: string;
    category: string;
    city: string;
    distanceKm?: number;
    eventType: '' | api.MeetupEventType;
    datePreset: '' | api.MeetupDatePreset;
    dateFrom: string;
    dateTo: string;
    dayOfWeek: number[];
    timeOfDay: api.MeetupTimeOfDay[];
    openSpotsOnly: boolean;
    sort: api.MeetupSort;
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

export const MEETUP_DATE_PRESET_OPTIONS: Array<{ value: '' | api.MeetupDatePreset; label: string }> = [
    { value: '', label: 'Any date' },
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'this_week', label: 'This week' },
    { value: 'this_weekend', label: 'Weekend' },
    { value: 'custom', label: 'Custom' },
];

export const MEETUP_SORT_OPTIONS: Array<{ value: api.MeetupSort; label: string }> = [
    { value: 'recommended', label: 'Recommended' },
    { value: 'soonest', label: 'Soonest' },
    { value: 'distance', label: 'Distance' },
    { value: 'popular', label: 'Popular' },
    { value: 'newest', label: 'Newest' },
];

export const MEETUP_DISTANCE_OPTIONS: Array<{ value?: number; label: string }> = [
    { value: undefined, label: 'Anywhere' },
    { value: 10, label: '10 km' },
    { value: 25, label: '25 km' },
    { value: 50, label: '50 km' },
    { value: 100, label: '100 km' },
];

export const MEETUP_DAY_OPTIONS: Array<{ value: number; label: string }> = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];

export const MEETUP_TIME_OPTIONS: Array<{ value: api.MeetupTimeOfDay; label: string }> = [
    { value: 'morning', label: 'Morning' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'evening', label: 'Evening' },
    { value: 'night', label: 'Night' },
];

export const DEFAULT_MEETUP_FILTERS: MeetupDraftFilters = {
    query: '',
    category: '',
    city: '',
    distanceKm: undefined,
    eventType: '',
    datePreset: '',
    dateFrom: '',
    dateTo: '',
    dayOfWeek: [],
    timeOfDay: [],
    openSpotsOnly: false,
    sort: 'recommended',
};

export function toMeetupQueryFilters(filters: MeetupDraftFilters): api.MeetupFilters {
    return {
        q: filters.query.trim() || undefined,
        category: filters.category || undefined,
        city: filters.city.trim() || undefined,
        distance_km: filters.distanceKm,
        event_type: filters.eventType || undefined,
        date_preset: filters.datePreset || undefined,
        date_from: filters.dateFrom.trim() || undefined,
        date_to: filters.dateTo.trim() || undefined,
        day_of_week: filters.dayOfWeek.length ? filters.dayOfWeek : undefined,
        time_of_day: filters.timeOfDay.length ? filters.timeOfDay : undefined,
        open_spots_only: filters.openSpotsOnly || undefined,
        sort: filters.sort,
    };
}

export function hasMeetupFilters(filters: MeetupDraftFilters): boolean {
    return Boolean(
        filters.category
        || filters.city.trim()
        || filters.distanceKm !== undefined
        || filters.eventType
        || filters.datePreset
        || filters.dateFrom.trim()
        || filters.dateTo.trim()
        || filters.dayOfWeek.length
        || filters.timeOfDay.length
        || filters.openSpotsOnly
        || filters.sort !== 'recommended',
    );
}

export function getMeetupFilterChips(
    filters: MeetupDraftFilters,
    categories: api.MeetupCategory[],
): MeetupFilterChip[] {
    const chips: MeetupFilterChip[] = [];
    const categoryLabel = categories.find((category) => category.slug === filters.category)?.label;
    if (categoryLabel) chips.push({ key: 'category', label: categoryLabel });
    if (filters.city.trim()) chips.push({ key: 'city', label: filters.city.trim() });
    if (filters.distanceKm !== undefined) chips.push({ key: 'distanceKm', label: `${filters.distanceKm} km` });
    if (filters.eventType) {
        const match = MEETUP_EVENT_TYPE_OPTIONS.find((option) => option.value === filters.eventType);
        if (match) chips.push({ key: 'eventType', label: match.label });
    }
    if (filters.datePreset) {
        const match = MEETUP_DATE_PRESET_OPTIONS.find((option) => option.value === filters.datePreset);
        if (match) chips.push({ key: 'datePreset', label: match.label });
    }
    if (filters.dateFrom.trim()) chips.push({ key: 'dateFrom', label: `From ${filters.dateFrom.trim()}` });
    if (filters.dateTo.trim()) chips.push({ key: 'dateTo', label: `To ${filters.dateTo.trim()}` });
    if (filters.dayOfWeek.length) {
        const labels = MEETUP_DAY_OPTIONS
            .filter((option) => filters.dayOfWeek.includes(option.value))
            .map((option) => option.label)
            .join(', ');
        if (labels) chips.push({ key: 'dayOfWeek', label: labels });
    }
    if (filters.timeOfDay.length) {
        const labels = MEETUP_TIME_OPTIONS
            .filter((option) => filters.timeOfDay.includes(option.value))
            .map((option) => option.label)
            .join(', ');
        if (labels) chips.push({ key: 'timeOfDay', label: labels });
    }
    if (filters.openSpotsOnly) chips.push({ key: 'openSpotsOnly', label: 'Open spots' });
    if (filters.sort !== 'recommended') {
        const match = MEETUP_SORT_OPTIONS.find((option) => option.value === filters.sort);
        if (match) chips.push({ key: 'sort', label: match.label });
    }
    return chips;
}

export function removeMeetupFilter(filters: MeetupDraftFilters, key: string): MeetupDraftFilters {
    switch (key) {
        case 'category':
            return { ...filters, category: '' };
        case 'city':
            return { ...filters, city: '' };
        case 'distanceKm':
            return { ...filters, distanceKm: undefined };
        case 'eventType':
            return { ...filters, eventType: '' };
        case 'datePreset':
            return { ...filters, datePreset: '' };
        case 'dateFrom':
            return { ...filters, dateFrom: '' };
        case 'dateTo':
            return { ...filters, dateTo: '' };
        case 'dayOfWeek':
            return { ...filters, dayOfWeek: [] };
        case 'timeOfDay':
            return { ...filters, timeOfDay: [] };
        case 'openSpotsOnly':
            return { ...filters, openSpotsOnly: false };
        case 'sort':
            return { ...filters, sort: 'recommended' };
        default:
            return filters;
    }
}
