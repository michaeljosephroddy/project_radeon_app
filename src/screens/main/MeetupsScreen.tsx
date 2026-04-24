import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, RefreshControl, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../api/client';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { HeroCard } from '../../components/ui/HeroCard';
import { PlusFeatureSheet } from '../../components/ui/PlusFeatureSheet';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SearchBar } from '../../components/ui/SearchBar';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { TextField } from '../../components/ui/TextField';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { useAuth } from '../../hooks/useAuth';
import { useMeetups, useMyMeetups } from '../../hooks/queries/useMeetups';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { dedupeById } from '../../utils/list';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

type MeetupsSubView = 'browse' | 'my' | 'create' | 'preview';
type MeetupFieldKey = 'title' | 'description' | 'city' | 'capacity';

// Splits a meetup start date into compact parts used by the list badge.
function formatMeetupDate(dateStr: string) {
    // Split the date into badge-friendly parts so the list can emphasize day/month
    // without repeating heavy date formatting inside renderItem.
    const d = new Date(dateStr);
    return {
        day: d.getDate().toString(),
        month: d.toLocaleString('default', { month: 'short' }).toUpperCase(),
        dateTime: d.toLocaleString('default', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }),
    };
}

function parseMeetupDateInput(dateInput: string): { year: number; month: number; day: number } | null {
    const date = dateInput.trim();
    if (!date) return null;

    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!dateMatch) return null;

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return { year, month, day };
}

function parseMeetupTimeInput(timeInput: string): { hours: number; minutes: number } | null {
    const time = timeInput.trim();
    if (!time) return null;

    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!timeMatch) return null;

    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    if (hours > 23 || minutes > 59) return null;

    return { hours, minutes };
}

function buildMeetupStartsAtDate(dateInput: string, timeInput: string): Date | null {
    const dateParts = parseMeetupDateInput(dateInput);
    const timeParts = parseMeetupTimeInput(timeInput);
    if (!dateParts || !timeParts) return null;

    const parsed = new Date(
        dateParts.year,
        dateParts.month - 1,
        dateParts.day,
        timeParts.hours,
        timeParts.minutes,
    );

    if (Number.isNaN(parsed.getTime())) return null;
    if (
        parsed.getFullYear() !== dateParts.year ||
        parsed.getMonth() !== dateParts.month - 1 ||
        parsed.getDate() !== dateParts.day ||
        parsed.getHours() !== timeParts.hours ||
        parsed.getMinutes() !== timeParts.minutes
    ) {
        return null;
    }

    return parsed;
}

// Combines separate local date/time inputs into the RFC3339 value expected by the backend.
function toStartsAtValue(dateInput: string, timeInput: string): string | null {
    return buildMeetupStartsAtDate(dateInput, timeInput)?.toISOString() ?? null;
}

function formatMeetupDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatMeetupTimeInput(date: Date): string {
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
}

function getMeetupPickerValue(dateInput: string, timeInput: string): Date {
    const parsed = buildMeetupStartsAtDate(dateInput, timeInput);
    if (parsed) return parsed;

    const next = new Date();
    next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0);
    return next;
}

// Validates the create meetup form and returns normalized values when valid.
function validateMeetupForm(form: {
    title: string;
    description: string;
    city: string;
    startsOn: string;
    startsAt: string;
    capacity: string;
}): { error: string } | {
    values: {
        title: string;
        description: string | null;
        city: string;
        starts_at: string;
        capacity: number | null;
    };
} {
    const title = form.title.trim();
    const city = form.city.trim();
    const startsAt = toStartsAtValue(form.startsOn, form.startsAt);
    const description = form.description.trim();
    const capacityText = form.capacity.trim();

    if (!title) return { error: 'Title is required.' };
    if (!city) return { error: 'City is required.' };
    if (!form.startsOn.trim()) return { error: 'Start date is required.' };
    if (!form.startsAt.trim()) return { error: 'Start time is required.' };
    if (!startsAt) return { error: 'Enter a valid date and time, like 2026-05-01 and 19:30.' };

    let capacity: number | null = null;
    if (capacityText) {
        const parsedCapacity = Number(capacityText);
        if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
            return { error: 'Capacity must be empty or greater than 0.' };
        }
        capacity = Math.floor(parsedCapacity);
    }

    return {
        values: {
            title,
            city,
            starts_at: startsAt,
            description: description || null,
            capacity,
        },
    };
}

interface MeetupCardProps {
    meetup: api.Meetup;
    onPress: (meetup: api.Meetup) => void;
    onToggleRSVP: (id: string) => void;
    rsvpPending?: boolean;
    actionLabel?: string;
    actionDisabled?: boolean;
}

// Renders a single meetup row with its RSVP action.
function MeetupCard({ meetup, onPress, onToggleRSVP, rsvpPending = false, actionLabel, actionDisabled = false }: MeetupCardProps) {
    const { day, month, dateTime } = formatMeetupDate(meetup.starts_at);
    const buttonLabel = actionLabel ?? (meetup.is_attending ? 'Going ✓' : 'Going?');
    const attendeePreview = meetup.attendee_preview ?? [];

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.cardMain} onPress={() => onPress(meetup)} activeOpacity={0.85}>
                <View style={styles.dateBadge}>
                    <Text style={styles.dateDay}>{day}</Text>
                    <Text style={styles.dateMon}>{month}</Text>
                </View>
                <View style={styles.cardBody}>
                    <Text style={styles.title}>{meetup.title}</Text>
                    {!!meetup.description && (
                        <Text style={styles.description} numberOfLines={2}>{meetup.description}</Text>
                    )}
                    <Text style={styles.sub}>
                        {meetup.city} · {dateTime}
                    </Text>
                    <Text style={styles.sub}>
                        {meetup.capacity ? `${meetup.attendee_count}/${meetup.capacity} going` : `${meetup.attendee_count} going`}
                        {meetup.is_attending ? ' · You are attending' : ''}
                    </Text>
                    {meetup.attendee_count > 0 && (
                        <View style={styles.attendeeBubbleRow}>
                            <View style={styles.attendeeBubbleCluster}>
                                {attendeePreview.map((attendee, index) => (
                                    <View
                                        key={attendee.id}
                                        style={[
                                            styles.attendeeAvatarWrap,
                                            { left: index * 16, zIndex: attendeePreview.length - index },
                                        ]}
                                    >
                                        <Avatar
                                            username={attendee.username}
                                            avatarUrl={attendee.avatar_url ?? undefined}
                                            size={20}
                                            fontSize={8}
                                        />
                                    </View>
                                ))}
                            </View>
                            <Text style={styles.attendeeBubbleText}>
                                {meetup.attendee_count > attendeePreview.length
                                    ? `+${meetup.attendee_count - attendeePreview.length} more`
                                    : `${meetup.attendee_count} going`}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.rsvpPill,
                    meetup.is_attending && styles.rsvpPillActive,
                    (rsvpPending || actionDisabled) && styles.rsvpPillDisabled,
                ]}
                onPress={() => onToggleRSVP(meetup.id)}
                disabled={rsvpPending || actionDisabled}
            >
                <Text style={[styles.rsvpText, meetup.is_attending && styles.rsvpTextActive]}>
                    {rsvpPending ? '...' : buttonLabel}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

interface MeetupsScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onOpenMeetup: (meetup: api.Meetup) => void;
}

const CREATE_PLUS_FEATURES: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; description: string }> = [
    { icon: 'calendar-outline', label: 'Host meetups', description: 'Create events for your city and recovery circle.' },
    { icon: 'people-outline', label: 'Manage attendees', description: 'Keep your guest list and meetup hosting tools in one place.' },
    { icon: 'star-outline', label: 'Organizer access', description: 'Unlock meetup creation with SoberSpace Plus.' },
];

function hasPlusAccess(user: api.User | null): boolean {
    if (!user) return false;
    if (user.is_plus) return true;
    return user.subscription_tier === 'plus';
}

function PlusButtonBadge() {
    return (
        <View style={styles.buttonPlusBadge}>
            <Text style={styles.buttonPlusBadgeText}>Plus</Text>
        </View>
    );
}

function getBestCity(user: api.User | null): string {
    if (!user) return '';
    if (user.current_city && user.location_updated_at) {
        const fresh = Date.now() - new Date(user.location_updated_at).getTime() < 24 * 60 * 60 * 1000;
        if (fresh) return user.current_city;
    }
    return user.city ?? '';
}

function flattenMeetupPages(data?: InfiniteData<api.PaginatedResponse<api.Meetup>>): api.Meetup[] {
    return dedupeById(data?.pages.flatMap((page) => page.items ?? []) ?? []);
}

function updateMeetupPages(
    data: InfiniteData<api.PaginatedResponse<api.Meetup>> | undefined,
    updater: (items: api.Meetup[]) => api.Meetup[],
): InfiniteData<api.PaginatedResponse<api.Meetup>> | undefined {
    if (!data) return data;

    return {
        ...data,
        pages: data.pages.map((page, index) => ({
            ...page,
            items: index === 0 ? updater(page.items ?? []) : (page.items ?? []),
        })),
    };
}

// Renders the meetups tab and keeps RSVP state in sync with the list.
export function MeetupsScreen({ isActive, onOpenUserProfile, onOpenMeetup }: MeetupsScreenProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const flatListRef = useRef<FlatList<api.Meetup> | null>(null);
    const createFormRef = useRef<ScrollView | null>(null);
    const createFieldPositionsRef = useRef<Partial<Record<MeetupFieldKey, number>>>({});
    const hasActivatedBrowse = useLazyActivation(isActive);
    const [subView, setSubView] = useState<MeetupsSubView>('browse');
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [cityFilter, setCityFilter] = useState(() => getBestCity(user));
    const [debouncedCityFilter, setDebouncedCityFilter] = useState(() => getBestCity(user).trim());
    const [cityHydrated, setCityHydrated] = useState(() => !!getBestCity(user));
    const [rsvpPendingIds, setRsvpPendingIds] = useState<Set<string>>(new Set());
    const [showCreatePaywall, setShowCreatePaywall] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [createPickerMode, setCreatePickerMode] = useState<'date' | 'time' | null>(null);
    const [form, setForm] = useState({
        title: '',
        description: '',
        city: '',
        startsOn: '',
        startsAt: '',
        capacity: '',
    });
    const [hasActivatedMyMeetups, setHasActivatedMyMeetups] = useState(false);
    useEffect(() => {
        if (isActive && subView === 'my') {
            setHasActivatedMyMeetups(true);
        }
    }, [isActive, subView]);
    const meetupsListProps = getListPerformanceProps('detailList');
    const meetupsQuery = useMeetups({
        q: debouncedQuery || undefined,
        city: debouncedCityFilter || undefined,
        limit: 20,
    }, hasActivatedBrowse && cityHydrated);
    const myMeetupsQuery = useMyMeetups(20, hasActivatedMyMeetups);
    useRefetchOnActiveIfStale(isActive && subView === 'browse', meetupsQuery);
    useRefetchOnActiveIfStale(isActive && subView === 'my', myMeetupsQuery);
    const meetupsScrollToTop = useScrollToTopButton({ threshold: 320 });
    const meetups = useMemo(
        () => flattenMeetupPages(meetupsQuery.data),
        [meetupsQuery.data],
    );
    const myMeetups = useMemo(
        () => flattenMeetupPages(myMeetupsQuery.data),
        [myMeetupsQuery.data],
    );
    const canCreateMeetups = hasPlusAccess(user);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedCityFilter(cityFilter.trim()), 250);
        return () => clearTimeout(timer);
    }, [cityFilter]);

    useEffect(() => {
        const best = getBestCity(user);
        if (best && !cityHydrated) {
            setCityFilter(best);
            setDebouncedCityFilter(best.trim());
            setCityHydrated(true);
        }
    }, [user?.city, user?.current_city, user?.location_updated_at, cityHydrated]);

    useEffect(() => {
        if (cityHydrated || getBestCity(user)) return;

        let active = true;
        (async () => {
            try {
                const permission = await Location.requestForegroundPermissionsAsync();
                if (!active || permission.status !== 'granted') {
                    if (active) setCityHydrated(true);
                    return;
                }

                const position = await Location.getCurrentPositionAsync({});
                const [place] = await Location.reverseGeocodeAsync(position.coords);
                const nextCity = place?.city ?? place?.subregion ?? place?.district ?? '';
                if (active) {
                    setCityFilter(nextCity);
                    setDebouncedCityFilter(nextCity.trim());
                    setCityHydrated(true);
                }
            } catch {
                if (active) setCityHydrated(true);
            }
        })();

        return () => {
            active = false;
        };
    }, [cityHydrated, user?.city]);

    // Builds a field-specific setter for the create meetup form.
    const setField = (key: keyof typeof form) => (value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setSubmitError('');
        if (successMessage) setSuccessMessage('');
    };

    const handleCreateFieldLayout = useCallback((field: MeetupFieldKey, y: number) => {
        createFieldPositionsRef.current[field] = y;
    }, []);

    const handleCreateFieldFocus = useCallback((field: MeetupFieldKey) => {
        const y = createFieldPositionsRef.current[field];
        if (typeof y !== 'number') return;

        requestAnimationFrame(() => {
            createFormRef.current?.scrollTo({
                y: Math.max(y - 24, 0),
                animated: true,
            });
        });
    }, []);

    const handleCreatePickerChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            if (event.type === 'dismissed') {
                setCreatePickerMode(null);
                return;
            }
            setCreatePickerMode(null);
        }

        if (!selectedDate) return;

        setForm(prev => ({
            ...prev,
            startsOn: createPickerMode === 'time' ? prev.startsOn : formatMeetupDateInput(selectedDate),
            startsAt: createPickerMode === 'time' ? formatMeetupTimeInput(selectedDate) : prev.startsAt,
        }));
        setSubmitError('');
        if (successMessage) setSuccessMessage('');
    }, [createPickerMode, successMessage]);

    // Refreshes the meetup list for pull-to-refresh.
    const onRefresh = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.meetups({
            q: debouncedQuery || undefined,
            city: debouncedCityFilter || undefined,
            limit: 20,
        }));
        await meetupsQuery.refetch();
    };

    // Refreshes the current user's meetup list.
    const onRefreshMyMeetups = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.myMeetups({ limit: 20 }));
        await myMeetupsQuery.refetch();
    };

    // The active subview decides which meetup list advances when the user nears
    // the end of the current FlatList.
    const handleLoadMore = async () => {
        if (subView === 'my') {
            if (!isActive || myMeetupsQuery.isFetchingNextPage || myMeetupsQuery.isRefetching || !myMeetupsQuery.hasNextPage) return;
            await myMeetupsQuery.fetchNextPage();
            return;
        }

        if (!isActive || meetupsQuery.isFetchingNextPage || meetupsQuery.isRefetching || !meetupsQuery.hasNextPage) return;
        await meetupsQuery.fetchNextPage();
    };
    const meetupsListPagination = useGuardedEndReached(handleLoadMore);

    // Toggles the current user's RSVP state for a meetup.
    const handleRSVP = async (id: string) => {
        setRsvpPendingIds(prev => new Set(prev).add(id));
        try {
            const res = await api.rsvpMeetup(id);
            const applyRsvp = (items: api.Meetup[]) => items.map((meetup) => (
                meetup.id === id
                    ? {
                        ...meetup,
                        is_attending: res.attending,
                        attendee_count: meetup.attendee_count + (res.attending ? 1 : -1),
                    }
                    : meetup
            ));

            queryClient.setQueriesData<InfiniteData<api.PaginatedResponse<api.Meetup>>>(
                { queryKey: ['meetups'] },
                (data) => updateMeetupPages(data, applyRsvp),
            );
            queryClient.setQueriesData<InfiniteData<api.PaginatedResponse<api.Meetup>>>(
                { queryKey: ['my-meetups'] },
                (data) => updateMeetupPages(data, applyRsvp),
            );
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setRsvpPendingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    // Persists a new meetup and updates both the public and personal meetup lists.
    const handleCreateMeetup = async () => {
        if (!canCreateMeetups) {
            setShowCreatePaywall(true);
            return;
        }

        const result = validateMeetupForm(form);
        if ('error' in result) {
            setSubmitError(result.error);
            setSuccessMessage('');
            return;
        }

        setSubmitting(true);
        setSubmitError('');
        setSuccessMessage('');

        try {
            const createdMeetup = await api.createMeetup(result.values);
            const prependMeetup = (items: api.Meetup[]) => [
                createdMeetup,
                ...items.filter((item) => item.id !== createdMeetup.id),
            ];

            queryClient.setQueriesData<InfiniteData<api.PaginatedResponse<api.Meetup>>>(
                { queryKey: ['meetups'] },
                (data) => updateMeetupPages(data, prependMeetup),
            );
            queryClient.setQueriesData<InfiniteData<api.PaginatedResponse<api.Meetup>>>(
                { queryKey: ['my-meetups'] },
                (data) => updateMeetupPages(data, prependMeetup),
            );
            void myMeetupsQuery.refetch();
            setForm({
                title: '',
                description: '',
                city: '',
                startsOn: '',
                startsAt: '',
                capacity: '',
            });
            setCreatePickerMode(null);
            setSuccessMessage('Meetup created successfully.');
            setSubView('my');
        } catch (e: unknown) {
            setSubmitError(e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReviewPress = () => {
        const result = validateMeetupForm(form);
        if ('error' in result) {
            setSubmitError(result.error);
            setSuccessMessage('');
            return;
        }
        setSubmitError('');
        setSubView('preview');
    };

    const handleSubViewChange = useCallback((key: string) => {
        setSubView(key as MeetupsSubView);
    }, []);

    const handleApplySearch = useCallback(() => {
        setDebouncedQuery(query.trim());
        setDebouncedCityFilter(cityFilter.trim());

        if (subView !== 'browse') {
            setSubView('browse');
            return;
        }
        void meetupsQuery.refetch();
    }, [cityFilter, meetupsQuery, query, subView]);

    const loading = !cityHydrated && meetups.length === 0;
    const myMeetupsLoading = subView === 'my' && myMeetupsQuery.isLoading && myMeetups.length === 0;

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    if (subView === 'preview') {
        const startsAtIso = toStartsAtValue(form.startsOn, form.startsAt);
        const { day, month, dateTime: formattedDateTime } = startsAtIso
            ? formatMeetupDate(startsAtIso)
            : { day: '--', month: '---', dateTime: `${form.startsOn} ${form.startsAt}` };

        return (
            <ScrollView contentContainerStyle={styles.formContent}>
                <PlusFeatureSheet
                    visible={showCreatePaywall}
                    title="Create Meetups"
                    items={CREATE_PLUS_FEATURES}
                    onClose={() => setShowCreatePaywall(false)}
                />

                <View style={styles.previewHeader}>
                    <TouchableOpacity onPress={() => setSubView('create')} style={styles.previewBack}>
                        <Ionicons name="chevron-back" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.previewTitle}>Review your meetup</Text>
                    <View style={styles.previewBackSpacer} />
                </View>

                <View style={styles.previewCard}>
                    <View style={styles.previewCardTop}>
                        <View style={styles.previewDateBadge}>
                            <Text style={styles.previewDateDay}>{day}</Text>
                            <Text style={styles.previewDateMon}>{month}</Text>
                        </View>
                        <View style={styles.previewCardBody}>
                            <Text style={styles.previewCardTitle}>{form.title.trim()}</Text>
                            {!!form.description.trim() && (
                                <Text style={styles.previewCardDescription}>{form.description.trim()}</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.previewDivider} />

                    <View style={styles.previewDetailRow}>
                        <Ionicons name="location-outline" size={15} color={Colors.light.textTertiary} />
                        <View style={styles.previewDetailBody}>
                            <Text style={styles.previewDetailLabel}>Location</Text>
                            <Text style={styles.previewDetailValue}>{form.city.trim()}</Text>
                        </View>
                    </View>
                    <View style={styles.previewDetailRow}>
                        <Ionicons name="calendar-outline" size={15} color={Colors.light.textTertiary} />
                        <View style={styles.previewDetailBody}>
                            <Text style={styles.previewDetailLabel}>Date & time</Text>
                            <Text style={styles.previewDetailValue}>{formattedDateTime}</Text>
                        </View>
                    </View>
                    {!!form.capacity.trim() && (
                        <View style={styles.previewDetailRow}>
                            <Ionicons name="people-outline" size={15} color={Colors.light.textTertiary} />
                            <View style={styles.previewDetailBody}>
                                <Text style={styles.previewDetailLabel}>Capacity</Text>
                                <Text style={styles.previewDetailValue}>{form.capacity.trim()} spots</Text>
                            </View>
                        </View>
                    )}
                </View>

                <PrimaryButton
                    label="Create Meetup"
                    onPress={handleCreateMeetup}
                    disabled={submitting}
                    loading={submitting}
                    variant="warning"
                    style={styles.primaryButton}
                    leftAdornment={<Ionicons name="star" size={15} color={Colors.textOn.warning} />}
                    rightAdornment={<PlusButtonBadge />}
                />
            </ScrollView>
        );
    }

    if (subView === 'create') {
        const createPickerValue = getMeetupPickerValue(form.startsOn, form.startsAt);

        return (
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <PlusFeatureSheet
                    visible={showCreatePaywall}
                    title="Create Meetups"
                    items={CREATE_PLUS_FEATURES}
                    onClose={() => setShowCreatePaywall(false)}
                />
                <ScrollView
                    ref={createFormRef}
                    contentContainerStyle={styles.formContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                >
                    <SegmentedControl
                        activeKey="create"
                        onChange={handleSubViewChange}
                        items={[
                            { key: 'browse', label: 'Browse' },
                            { key: 'my', label: 'My Meetups' },
                            { key: 'create', label: 'Create' },
                        ]}
                    />

                    <HeroCard
                        eyebrow="CREATE"
                        title="Start a meetup in your city."
                        description="Add the essentials so people know what to expect."
                        style={styles.headerCard}
                    />

                    <Text style={styles.label}>Title</Text>
                    <View onLayout={(event) => handleCreateFieldLayout('title', event.nativeEvent.layout.y)}>
                        <TextField
                            value={form.title}
                            onChangeText={setField('title')}
                            placeholder="Friday coffee meetup"
                            onFocus={() => handleCreateFieldFocus('title')}
                            returnKeyType="next"
                        />
                    </View>

                    <Text style={styles.label}>Description</Text>
                    <View onLayout={(event) => handleCreateFieldLayout('description', event.nativeEvent.layout.y)}>
                        <TextField
                            style={styles.inputMultiline}
                            value={form.description}
                            onChangeText={setField('description')}
                            placeholder="Optional details about the meetup"
                            multiline
                            onFocus={() => handleCreateFieldFocus('description')}
                        />
                    </View>

                    <Text style={styles.label}>City</Text>
                    <View onLayout={(event) => handleCreateFieldLayout('city', event.nativeEvent.layout.y)}>
                        <TextField
                            value={form.city}
                            onChangeText={setField('city')}
                            placeholder="Dublin"
                            onFocus={() => handleCreateFieldFocus('city')}
                            returnKeyType="next"
                        />
                    </View>

                    <Text style={styles.label}>Starts</Text>
                    <View style={styles.dateTimeRow}>
                        <View style={styles.dateTimeField}>
                            <Text style={styles.fieldHint}>Date</Text>
                            <TouchableOpacity
                                style={styles.dateFieldButton}
                                onPress={() => setCreatePickerMode('date')}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.dateFieldText, !form.startsOn && styles.dateFieldPlaceholder]}>
                                    {form.startsOn || 'Pick a date'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.dateTimeField}>
                            <Text style={styles.fieldHint}>Time (24hr local time)</Text>
                            <TouchableOpacity
                                style={styles.dateFieldButton}
                                onPress={() => setCreatePickerMode('time')}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.dateFieldText, !form.startsAt && styles.dateFieldPlaceholder]}>
                                    {form.startsAt || 'Pick a time'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    {Platform.OS === 'ios' ? (
                        createPickerMode ? (
                            <View style={styles.inlinePickerWrap}>
                                <View style={styles.inlinePickerTabs}>
                                    <TouchableOpacity
                                        style={[
                                            styles.inlinePickerTab,
                                            createPickerMode === 'date' && styles.inlinePickerTabActive,
                                        ]}
                                        onPress={() => setCreatePickerMode('date')}
                                    >
                                        <Text
                                            style={[
                                                styles.inlinePickerTabText,
                                                createPickerMode === 'date' && styles.inlinePickerTabTextActive,
                                            ]}
                                        >
                                            Date
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.inlinePickerTab,
                                            createPickerMode === 'time' && styles.inlinePickerTabActive,
                                        ]}
                                        onPress={() => setCreatePickerMode('time')}
                                    >
                                        <Text
                                            style={[
                                                styles.inlinePickerTabText,
                                                createPickerMode === 'time' && styles.inlinePickerTabTextActive,
                                            ]}
                                        >
                                            Time
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <DateTimePicker
                                    value={createPickerValue}
                                    mode={createPickerMode}
                                    display="spinner"
                                    minuteInterval={15}
                                    is24Hour
                                    onChange={handleCreatePickerChange}
                                />
                            </View>
                        ) : null
                    ) : createPickerMode ? (
                        <DateTimePicker
                            value={createPickerValue}
                            mode={createPickerMode}
                            display="default"
                            minuteInterval={15}
                            is24Hour
                            onChange={handleCreatePickerChange}
                        />
                    ) : null}
                    <Text style={styles.label}>Capacity</Text>
                    <View onLayout={(event) => handleCreateFieldLayout('capacity', event.nativeEvent.layout.y)}>
                        <TextField
                            value={form.capacity}
                            onChangeText={setField('capacity')}
                            placeholder="Optional"
                            keyboardType="number-pad"
                            onFocus={() => handleCreateFieldFocus('capacity')}
                            returnKeyType="done"
                        />
                    </View>

                    {!!submitError && <Text style={styles.errorText}>{submitError}</Text>}

                    <PrimaryButton
                        label="Review & create"
                        onPress={handleReviewPress}
                        variant="success"
                        style={styles.primaryButton}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    if (subView === 'my') {
        return (
            <View style={styles.container}>
                <PlusFeatureSheet
                    visible={showCreatePaywall}
                    title="Create Meetups"
                    items={CREATE_PLUS_FEATURES}
                    onClose={() => setShowCreatePaywall(false)}
                />
                <FlatList
                ref={flatListRef}
                data={myMeetups}
                keyExtractor={meetup => meetup.id}
                {...meetupsListProps}
                onEndReached={meetupsListPagination.onEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={meetupsListPagination.onMomentumScrollBegin}
                onScrollBeginDrag={meetupsListPagination.onScrollBeginDrag}
                onScroll={meetupsScrollToTop.onScroll}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={myMeetupsQuery.isRefetching && !myMeetupsQuery.isFetchingNextPage}
                        onRefresh={onRefreshMyMeetups}
                        tintColor={Colors.primary}
                    />
                }
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <>
                        <SegmentedControl
                            activeKey="my"
                            onChange={handleSubViewChange}
                            items={[
                                { key: 'browse', label: 'Browse' },
                                { key: 'my', label: 'My Meetups' },
                                { key: 'create', label: 'Create' },
                            ]}
                        />

                        <View style={styles.screenNote}>
                            <Text style={styles.screenNoteTitle}>Your Meetups</Text>
                            <Text style={styles.screenNoteText}>
                                Meetups you create appear here right away and stay in sync with the public list.
                            </Text>
                        </View>

                        {!!successMessage && <Text style={styles.successTextInline}>{successMessage}</Text>}
                    </>
                }
                ListEmptyComponent={
                    myMeetupsLoading ? (
                        <View style={styles.center}>
                            <ActivityIndicator color={Colors.primary} />
                        </View>
                    ) : (
                        <EmptyState
                            title="No meetups created yet."
                            description="Create one to see it here right away."
                        />
                    )
                }
                renderItem={({ item }) => (
                    <MeetupCard
                        meetup={item}
                        onPress={onOpenMeetup}
                        onToggleRSVP={handleRSVP}
                        rsvpPending={rsvpPendingIds.has(item.id)}
                        actionLabel={item.is_attending ? 'Hosting ✓' : 'RSVP'}
                    />
                )}
                ListFooterComponent={myMeetupsQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                />
                {isActive && meetupsScrollToTop.isVisible ? (
                    <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
                ) : null}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <PlusFeatureSheet
                visible={showCreatePaywall}
                title="Create Meetups"
                items={CREATE_PLUS_FEATURES}
                onClose={() => setShowCreatePaywall(false)}
            />
            <FlatList
            ref={flatListRef}
            data={meetups}
            keyExtractor={meetup => meetup.id}
            {...meetupsListProps}
            onEndReached={meetupsListPagination.onEndReached}
            onEndReachedThreshold={0.4}
            onMomentumScrollBegin={meetupsListPagination.onMomentumScrollBegin}
            onScrollBeginDrag={meetupsListPagination.onScrollBeginDrag}
            onScroll={meetupsScrollToTop.onScroll}
            scrollEventThrottle={16}
            refreshControl={
                <RefreshControl
                    refreshing={meetupsQuery.isRefetching && !meetupsQuery.isFetchingNextPage}
                    onRefresh={onRefresh}
                    tintColor={Colors.primary}
                />
            }
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
                <>
                    <SegmentedControl
                        activeKey="browse"
                        onChange={handleSubViewChange}
                        items={[
                            { key: 'browse', label: 'Browse' },
                            { key: 'my', label: 'My Meetups' },
                            { key: 'create', label: 'Create' },
                        ]}
                    />

                    <View style={styles.screenNote}>
                        <Text style={styles.screenNoteTitle}>Meetups</Text>
                        <Text style={styles.screenNoteText}>
                            Browse public sober meetups, RSVP from the list, or create one in your city.
                        </Text>
                    </View>

                    <SearchBar
                        style={styles.searchBar}
                        variant="pill"
                        primaryField={{
                            value: query,
                            onChangeText: setQuery,
                            placeholder: 'Search events...',
                            returnKeyType: 'search',
                            onSubmitEditing: handleApplySearch,
                            flex: 1.2,
                        }}
                        secondaryField={{
                            value: cityFilter,
                            onChangeText: setCityFilter,
                            placeholder: 'Your town',
                            returnKeyType: 'search',
                            onSubmitEditing: handleApplySearch,
                            flex: 1,
                        }}
                        actionLabel="⌕"
                        onActionPress={handleApplySearch}
                    />
                </>
            }
            ListEmptyComponent={
                meetupsQuery.isLoading || meetupsQuery.isFetching ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={Colors.primary} />
                    </View>
                ) : (
                    <EmptyState
                        title="No upcoming meetups."
                        description="Be the first to create one in your city."
                    />
                )
            }
            renderItem={({ item }) => (
                <MeetupCard
                    meetup={item}
                    onPress={onOpenMeetup}
                    onToggleRSVP={handleRSVP}
                    rsvpPending={rsvpPendingIds.has(item.id)}
                />
            )}
            ListFooterComponent={meetupsQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
            />
            {isActive && meetupsScrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.md, paddingBottom: 32 },
    footerLoader: { paddingVertical: Spacing.md },
    formContent: { padding: Spacing.md, paddingBottom: 40 },
    headerCard: { marginBottom: Spacing.md },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    previewBack: { padding: 4 },
    previewBackSpacer: { width: 30 },
    previewTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: Typography.sizes.lg,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    previewCard: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
        gap: Spacing.md,
    },
    previewCardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
    },
    previewDateBadge: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.sm,
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    previewDateDay: {
        fontSize: Typography.sizes.xl,
        fontWeight: '700',
        color: Colors.textOn.primary,
        lineHeight: 24,
    },
    previewDateMon: {
        fontSize: Typography.sizes.xs,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.5,
    },
    previewCardBody: { flex: 1 },
    previewCardTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '700',
        color: Colors.light.textPrimary,
        lineHeight: 22,
        marginBottom: 4,
    },
    previewCardDescription: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        lineHeight: 20,
    },
    previewDivider: {
        height: 0.5,
        backgroundColor: Colors.light.border,
    },
    previewDetailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        paddingTop: 2,
    },
    previewDetailBody: { flex: 1 },
    previewDetailLabel: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
        marginBottom: 2,
    },
    previewDetailValue: {
        fontSize: Typography.sizes.md,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },
    buttonPlusBadge: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: Radii.pill,
        paddingHorizontal: Spacing.xs + 2,
        paddingVertical: 3,
    },
    buttonPlusBadgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.textOn.warning,
    },
    screenNote: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: 4,
        marginBottom: Spacing.md,
    },
    screenNoteTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    screenNoteText: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        lineHeight: 18,
    },
    searchBar: {
        marginBottom: Spacing.md,
    },

    cardBody: { flex: 1 },
    card: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    cardMain: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dateBadge: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.sm,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    dateDay: { fontSize: 14, fontWeight: '500', color: Colors.textOn.primary, lineHeight: 16 },
    dateMon: { fontSize: 9, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.4 },
    title: { fontSize: Typography.sizes.base, fontWeight: '600', color: Colors.light.textPrimary },
    description: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        marginTop: 4,
        lineHeight: 18,
    },
    sub: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary, marginTop: 4 },
    attendeeBubbleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.sm,
        minHeight: 22,
    },
    attendeeBubbleCluster: {
        width: 20 + 16 * 2,
        height: 20,
        position: 'relative',
        marginRight: Spacing.sm,
    },
    attendeeAvatarWrap: {
        position: 'absolute',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: Colors.light.backgroundSecondary,
        overflow: 'hidden',
    },
    attendeeBubbleText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
    rsvpPill: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
    },
    rsvpPillActive: { backgroundColor: Colors.successSubtle, borderColor: Colors.success },
    rsvpPillDisabled: { opacity: 0.6 },
    rsvpText: { fontSize: Typography.sizes.xs, fontWeight: '500', color: Colors.light.textTertiary },
    rsvpTextActive: { color: Colors.success },

    label: {
        fontSize: Typography.sizes.sm,
        fontWeight: '500',
        color: Colors.light.textSecondary,
        marginBottom: 4,
        marginTop: Spacing.sm,
    },
    dateTimeRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    dateTimeField: {
        flex: 1,
    },
    fieldHint: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
        marginBottom: 6,
    },
    dateFieldButton: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
    },
    dateFieldText: {
        fontSize: Typography.sizes.md,
        color: Colors.light.textPrimary,
    },
    dateFieldPlaceholder: {
        color: Colors.light.textTertiary,
    },
    inlinePickerWrap: {
        marginTop: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.md,
        backgroundColor: Colors.light.backgroundSecondary,
        overflow: 'hidden',
    },
    inlinePickerTabs: {
        flexDirection: 'row',
        padding: Spacing.xs,
        gap: Spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    inlinePickerTab: {
        flex: 1,
        borderRadius: Radii.full,
        paddingVertical: 8,
        alignItems: 'center',
    },
    inlinePickerTabActive: {
        backgroundColor: Colors.primary,
    },
    inlinePickerTabText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
    inlinePickerTabTextActive: {
        color: Colors.textOn.primary,
    },
    inputMultiline: {
        minHeight: 110,
        textAlignVertical: 'top',
    },
    helperText: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
        marginTop: 6,
    },
    errorText: {
        color: Colors.danger,
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.md,
    },
    successText: {
        color: Colors.success,
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.md,
    },
    successTextInline: {
        color: Colors.success,
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.md,
    },
    primaryButton: { marginTop: Spacing.lg },
});
