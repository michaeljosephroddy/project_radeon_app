import * as api from '../../../api/client';

export type RecoveryMeeting = api.RecoveryMeeting;
export type RecoveryMeetingType = api.RecoveryMeetingType;
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RecoveryMeetingFilters {
    query: string;
    fellowship: string;
    country: string;
    location: string;
    dayOfWeek: DayOfWeek | null;
    meetingType: RecoveryMeetingType | '';
}

export interface FilterOption<T extends string | number> {
    value: T;
    label: string;
}

export interface ActiveFilterChip {
    key: string;
    label: string;
    remove: (filters: RecoveryMeetingFilters) => RecoveryMeetingFilters;
}

export const DEFAULT_MEETING_FILTERS: RecoveryMeetingFilters = {
    query: '',
    fellowship: '',
    country: '',
    location: '',
    dayOfWeek: null,
    meetingType: '',
};

export const FELLOWSHIPS: FilterOption<string>[] = [
    { value: 'aa', label: 'AA' },
    { value: 'ca', label: 'CA' },
    { value: 'na', label: 'NA' },
];

export const RECOVERY_MEETING_TYPES: FilterOption<RecoveryMeetingType>[] = [
    { value: 'in_person', label: 'In person' },
    { value: 'online', label: 'Online' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'phone', label: 'Phone' },
];

export const DAY_OPTIONS: Array<FilterOption<DayOfWeek> & { short: string; long: string }> = [
    { value: 0, short: 'Sun', long: 'Sunday', label: 'Sunday' },
    { value: 1, short: 'Mon', long: 'Monday', label: 'Monday' },
    { value: 2, short: 'Tue', long: 'Tuesday', label: 'Tuesday' },
    { value: 3, short: 'Wed', long: 'Wednesday', label: 'Wednesday' },
    { value: 4, short: 'Thu', long: 'Thursday', label: 'Thursday' },
    { value: 5, short: 'Fri', long: 'Friday', label: 'Friday' },
    { value: 6, short: 'Sat', long: 'Saturday', label: 'Saturday' },
];

export function cloneMeetingFilters(filters: RecoveryMeetingFilters): RecoveryMeetingFilters {
    return { ...filters };
}

export function filtersToApiParams(filters: RecoveryMeetingFilters): api.RecoveryMeetingFilters {
    return {
        q: filters.query.trim() || undefined,
        fellowship: filters.fellowship || undefined,
        country: filters.country.trim() || undefined,
        location: filters.location.trim() || undefined,
        day_of_week: filters.dayOfWeek ?? undefined,
        meeting_type: filters.meetingType || undefined,
    };
}

export function getActiveFilterChips(filters: RecoveryMeetingFilters): ActiveFilterChip[] {
    const chips: ActiveFilterChip[] = [];
    if (filters.fellowship) {
        chips.push({
            key: 'fellowship',
            label: getFellowshipLabel(filters.fellowship),
            remove: (current) => ({ ...current, fellowship: '' }),
        });
    }
    if (filters.country.trim()) {
        chips.push({
            key: 'country',
            label: filters.country.trim(),
            remove: (current) => ({ ...current, country: '' }),
        });
    }
    if (filters.location.trim()) {
        chips.push({
            key: 'location',
            label: `Location: ${filters.location.trim()}`,
            remove: (current) => ({ ...current, location: '' }),
        });
    }
    if (filters.dayOfWeek !== null) {
        chips.push({
            key: 'day',
            label: DAY_OPTIONS.find((option) => option.value === filters.dayOfWeek)?.short ?? 'Day',
            remove: (current) => ({ ...current, dayOfWeek: null }),
        });
    }
    if (filters.meetingType) {
        chips.push({
            key: 'meetingType',
            label: getMeetingTypeLabel(filters.meetingType),
            remove: (current) => ({ ...current, meetingType: '' }),
        });
    }
    return chips;
}

export function getFellowshipLabel(value: string): string {
    return FELLOWSHIPS.find((option) => option.value === value.toLowerCase())?.label ?? value.toUpperCase();
}

export function getMeetingTypeLabel(value: RecoveryMeetingType): string {
    return RECOVERY_MEETING_TYPES.find((option) => option.value === value)?.label ?? value.replace(/_/g, ' ');
}

export function getPrimaryOccurrence(meeting: RecoveryMeeting): api.RecoveryMeetingOccurrence | null {
    return meeting.occurrences[0] ?? null;
}

export function formatOccurrence(occurrence: api.RecoveryMeetingOccurrence | null): string {
    if (!occurrence) {
        return 'Schedule not listed';
    }
    return `${formatOccurrenceDay(occurrence)} - ${formatOccurrenceTime(occurrence)}`;
}

export function formatOccurrenceDay(occurrence: api.RecoveryMeetingOccurrence | null): string {
    if (!occurrence) {
        return 'Day not listed';
    }
    return DAY_OPTIONS.find((option) => option.value === occurrence.day_of_week)?.long ?? 'Scheduled';
}

export function formatOccurrenceTime(occurrence: api.RecoveryMeetingOccurrence | null): string {
    if (!occurrence) {
        return 'Time not listed';
    }
    const start = formatClockTime(occurrence.start_time_local);
    const end = occurrence.end_time_local ? formatClockTime(occurrence.end_time_local) : null;
    const time = end ? `${start} - ${end}` : start;
    return `${time} ${occurrence.timezone}`;
}

export function formatLocationLine(meeting: RecoveryMeeting): string {
    if (meeting.meeting_type === 'online') {
        return 'Online meeting';
    }
    const cityCountry = [meeting.city, meeting.country].filter(Boolean).join(', ');
    if (meeting.venue_name && cityCountry) {
        return `${meeting.venue_name} - ${cityCountry}`;
    }
    return meeting.venue_name ?? (cityCountry || 'Location not listed');
}

export function formatAddressLine(meeting: RecoveryMeeting): string | null {
    const parts = [
        meeting.address_line1,
        meeting.address_line2,
        meeting.city,
        meeting.region,
        meeting.postal_code,
        meeting.country,
    ].filter((part): part is string => Boolean(part?.trim()));
    return parts.length ? parts.join(', ') : null;
}

export function getConnectionSummary(meeting: RecoveryMeeting): string | null {
    const credentials = meeting.phone_join_info?.trim();
    if (credentials) {
        return credentials;
    }
    if (meeting.online_url?.trim()) {
        return 'Online link available';
    }
    return null;
}

function formatClockTime(value: string): string {
    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return value;
    }
    const date = new Date(2000, 0, 1, hour, minute);
    return date.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' });
}
