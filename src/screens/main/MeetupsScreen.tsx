import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import * as api from '../../api/client';
import { MeetupCard } from '../../components/events/MeetupCard';
import { MeetupFilterSheet } from '../../components/events/MeetupFilterSheet';
import { MeetupForm } from '../../components/events/MeetupForm';
import { MeetupFormValues } from '../../components/events/MeetupFormState';
import { EmptyState } from '../../components/ui/EmptyState';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { useAuth } from '../../hooks/useAuth';
import {
    DEFAULT_MEETUP_FILTERS,
    getMeetupFilterChips,
    MeetupDraftFilters,
    removeMeetupFilter,
    toMeetupQueryFilters,
} from '../../hooks/useMeetupFilters';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useFriends } from '../../hooks/queries/useFriends';
import { useMeetupCategories, useMeetups, useMyMeetups } from '../../hooks/queries/useMeetups';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { queryKeys } from '../../query/queryKeys';
import { MeetupReviewScreen } from './MeetupReviewScreen';
import { dedupeById } from '../../utils/list';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';
import { screenStandards } from '../../styles/screenStandards';

type MeetupPrimaryView = 'discover' | 'hosting' | 'going' | 'create';
type HostingScope = Extract<api.MyMeetupScope, 'upcoming' | 'drafts' | 'cancelled' | 'past'>;
type CreateStage = 'form' | 'review';

interface MeetupsScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onOpenMeetup: (meetup: api.Meetup) => void;
    onOpenPlus: () => void;
}

function hasPlusAccess(user: api.User | null): boolean {
    if (!user) return false;
    if (user.is_plus) return true;
    return user.subscription_tier === 'plus' && user.subscription_status === 'active';
}

function useDebounce<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}

function flattenCursorPages(
    data?: InfiniteData<api.CursorResponse<api.Meetup>>,
): api.Meetup[] {
    return dedupeById(data?.pages.flatMap((page) => page.items ?? []) ?? []);
}

function formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeInput(date: Date): string {
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
}

function buildStartsAt(dateInput: string, timeInput: string): string | null {
    const date = dateInput.trim();
    const time = timeInput.trim();
    if (!date || !time) return null;
    const parsed = new Date(`${date}T${time}:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

function parseOptionalCoordinate(
    value: string,
    label: 'Latitude' | 'Longitude',
    min: number,
    max: number,
): { value: number | null } | { error: string } {
    const trimmed = value.trim();
    if (!trimmed) {
        return { value: null };
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
        return { error: `${label} must be a valid number.` };
    }
    if (parsed < min || parsed > max) {
        return { error: `${label} must be between ${min} and ${max}.` };
    }

    return { value: parsed };
}

function defaultFormValues(user: api.User | null): MeetupFormValues {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    start.setHours(19, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return {
        title: '',
        description: '',
        category_slug: '',
        co_host_ids: [],
        event_type: 'in_person',
        visibility: 'public',
        city: user?.current_city ?? user?.city ?? '',
        country: user?.country ?? '',
        venue_name: '',
        address_line_1: '',
        address_line_2: '',
        how_to_find_us: '',
        online_url: '',
        cover_image_url: '',
        starts_on: formatDateInput(start),
        starts_at: formatTimeInput(start),
        ends_on: formatDateInput(end),
        ends_at: formatTimeInput(end),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        lat: '',
        lng: '',
        capacity: '',
        waitlist_enabled: true,
    };
}

function meetupToFormValues(meetup: api.Meetup): MeetupFormValues {
    const start = new Date(meetup.starts_at);
    const end = meetup.ends_at ? new Date(meetup.ends_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return {
        title: meetup.title,
        description: meetup.description ?? '',
        category_slug: meetup.category_slug,
        co_host_ids: meetup.hosts?.filter((host) => host.role !== 'organizer').map((host) => host.id) ?? [],
        event_type: meetup.event_type,
        visibility: meetup.visibility,
        city: meetup.city,
        country: meetup.country ?? '',
        venue_name: meetup.venue_name ?? '',
        address_line_1: meetup.address_line_1 ?? '',
        address_line_2: meetup.address_line_2 ?? '',
        how_to_find_us: meetup.how_to_find_us ?? '',
        online_url: meetup.online_url ?? '',
        cover_image_url: meetup.cover_image_url ?? '',
        starts_on: formatDateInput(start),
        starts_at: formatTimeInput(start),
        ends_on: formatDateInput(end),
        ends_at: formatTimeInput(end),
        timezone: meetup.timezone,
        lat: meetup.lat !== undefined && meetup.lat !== null ? String(meetup.lat) : '',
        lng: meetup.lng !== undefined && meetup.lng !== null ? String(meetup.lng) : '',
        capacity: meetup.capacity ? String(meetup.capacity) : '',
        waitlist_enabled: meetup.waitlist_enabled,
    };
}

function validateMeetupForm(form: MeetupFormValues, status: Extract<api.MeetupStatus, 'draft' | 'published'>): { error: string } | { values: api.MeetupUpsertInput } {
    const starts_at = buildStartsAt(form.starts_on, form.starts_at);
    const ends_at = buildStartsAt(form.ends_on, form.ends_at);
    if (!form.title.trim()) return { error: 'Title is required.' };
    if (!form.category_slug) return { error: 'Choose a category.' };
    if (!form.city.trim()) return { error: 'City is required.' };
    if (!starts_at) return { error: 'Enter a valid start date and time.' };
    if (form.ends_on.trim() || form.ends_at.trim()) {
        if (!ends_at) return { error: 'Enter a valid end date and time.' };
        if (new Date(ends_at) <= new Date(starts_at)) return { error: 'End time must be after the start time.' };
    }
    if (form.event_type === 'online' && !form.online_url.trim()) return { error: 'Online events need a link.' };
    if (form.capacity.trim()) {
        const capacity = Number(form.capacity);
        if (!Number.isFinite(capacity) || capacity < 1) {
            return { error: 'Capacity must be empty or greater than 0.' };
        }
    }
    const parsedLat = parseOptionalCoordinate(form.lat, 'Latitude', -90, 90);
    if ('error' in parsedLat) return { error: parsedLat.error };
    const parsedLng = parseOptionalCoordinate(form.lng, 'Longitude', -180, 180);
    if ('error' in parsedLng) return { error: parsedLng.error };
    if ((parsedLat.value === null) !== (parsedLng.value === null)) {
        return { error: 'Latitude and longitude must be provided together.' };
    }

    return {
        values: {
            title: form.title.trim(),
            description: form.description.trim() || null,
            category_slug: form.category_slug,
            co_host_ids: form.co_host_ids,
            event_type: form.event_type,
            status,
            visibility: form.visibility,
            city: form.city.trim(),
            country: form.country.trim() || null,
            venue_name: form.venue_name.trim() || null,
            address_line_1: form.address_line_1.trim() || null,
            address_line_2: form.address_line_2.trim() || null,
            how_to_find_us: form.how_to_find_us.trim() || null,
            online_url: form.online_url.trim() || null,
            cover_image_url: form.cover_image_url.trim() || null,
            starts_at,
            ends_at: ends_at ?? null,
            timezone: form.timezone.trim() || 'UTC',
            lat: parsedLat.value,
            lng: parsedLng.value,
            capacity: form.capacity.trim() ? Number(form.capacity) : null,
            waitlist_enabled: form.waitlist_enabled,
        },
    };
}

function getDiscoverActionLabel(meetup: api.Meetup): string {
    if (meetup.can_manage) return 'Manage';
    if (meetup.is_attending) return 'Going';
    if (meetup.is_waitlisted) return 'Waitlisted';
    if (meetup.waitlist_enabled && meetup.capacity && meetup.attendee_count >= meetup.capacity) return 'Waitlist';
    return 'RSVP';
}

function canDeleteMeetup(meetup: api.Meetup): boolean {
    if (meetup.status === 'draft') return true;
    return meetup.status === 'published' && meetup.attendee_count <= 1;
}

function getEditingHostingScope(meetup: api.Meetup | null): HostingScope {
    if (meetup?.status === 'draft') {
        return 'drafts';
    }
    return 'upcoming';
}

export function MeetupsScreen({ isActive, onOpenUserProfile, onOpenMeetup, onOpenPlus }: MeetupsScreenProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const listRef = useRef<FlatList<api.Meetup> | null>(null);
    const hasActivated = useLazyActivation(isActive);
    const [activeView, setActiveView] = useState<MeetupPrimaryView>('discover');
    const [hostingScope, setHostingScope] = useState<HostingScope>('upcoming');
    const [draftFilters, setDraftFilters] = useState<MeetupDraftFilters>(DEFAULT_MEETUP_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<MeetupDraftFilters>(DEFAULT_MEETUP_FILTERS);
    const [filterOpen, setFilterOpen] = useState(false);
    const [editingMeetup, setEditingMeetup] = useState<api.Meetup | null>(null);
    const [formValues, setFormValues] = useState<MeetupFormValues>(() => defaultFormValues(user));
    const [createStage, setCreateStage] = useState<CreateStage>('form');
    const [submitting, setSubmitting] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [localCoverPreviewUri, setLocalCoverPreviewUri] = useState<string | null>(null);
    const [formError, setFormError] = useState('');
    const [pendingMeetupIds, setPendingMeetupIds] = useState<Set<string>>(new Set());
    const canCreateMeetups = hasPlusAccess(user);
    const debouncedQuery = useDebounce(draftFilters.query, 350);

    const categoriesQuery = useMeetupCategories(hasActivated);
    const friendsQuery = useFriends(hasActivated && activeView === 'create', 100);
    const discoverQuery = useMeetups({
        ...toMeetupQueryFilters(appliedFilters),
        limit: 20,
    }, hasActivated);
    const hostingQuery = useMyMeetups(hostingScope, 20, hasActivated && activeView === 'hosting');
    const goingQuery = useMyMeetups('going', 20, hasActivated && activeView === 'going');

    useEffect(() => {
        setAppliedFilters((current) => (
            current.query === debouncedQuery ? current : { ...current, query: debouncedQuery }
        ));
    }, [debouncedQuery]);

    useRefetchOnActiveIfStale(isActive && activeView === 'discover', discoverQuery);
    useRefetchOnActiveIfStale(isActive && activeView === 'hosting', hostingQuery);
    useRefetchOnActiveIfStale(isActive && activeView === 'going', goingQuery);

    const discoverScroll = useScrollToTopButton({ threshold: 320 });
    const listProps = getListPerformanceProps('detailList');
    const categories = categoriesQuery.data ?? [];
    const friends = friendsQuery.data ?? [];
    const discoverItems = useMemo(() => flattenCursorPages(discoverQuery.data), [discoverQuery.data]);
    const hostingItems = useMemo(() => flattenCursorPages(hostingQuery.data), [hostingQuery.data]);
    const goingItems = useMemo(
        () => flattenCursorPages(goingQuery.data).filter(
            (meetup) => !meetup.can_manage && (meetup.is_attending || meetup.is_waitlisted),
        ),
        [goingQuery.data],
    );
    const activeFilterChips = useMemo(
        () => getMeetupFilterChips(appliedFilters, categories),
        [appliedFilters, categories],
    );
    const activeCoverPreviewUri = localCoverPreviewUri ?? formValues.cover_image_url;

    useEffect(() => {
        if (!editingMeetup) return;
        setFormValues(meetupToFormValues(editingMeetup));
        setLocalCoverPreviewUri(null);
        setFormError('');
        setCreateStage('form');
    }, [editingMeetup]);

    useEffect(() => {
        if (editingMeetup) return;
        setFormValues(defaultFormValues(user));
        setLocalCoverPreviewUri(null);
        setCreateStage('form');
    }, [user?.city, user?.country, user?.current_city, editingMeetup]);

    const invalidateMeetupQueries = (meetupId?: string) => {
        void queryClient.invalidateQueries({ queryKey: ['meetups'] });
        void queryClient.invalidateQueries({ queryKey: ['my-meetups'] });
        const detailMeetupId = meetupId ?? editingMeetup?.id;
        if (detailMeetupId) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.meetup(detailMeetupId) });
        }
    };

    const removeMeetupFromCaches = (meetupId: string) => {
        queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.Meetup>>>(
            { queryKey: ['meetups'] },
            (data) => data ? ({
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).filter((meetup) => meetup.id !== meetupId),
                })),
            }) : data,
        );
        queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.Meetup>>>(
            { queryKey: ['my-meetups'] },
            (data) => data ? ({
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).filter((meetup) => meetup.id !== meetupId),
                })),
            }) : data,
        );
    };

    const updateMeetupInCaches = (meetupId: string, updater: (meetup: api.Meetup) => api.Meetup) => {
        queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.Meetup>>>(
            { queryKey: ['meetups'] },
            (data) => data ? ({
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).map((meetup) => meetup.id === meetupId ? updater(meetup) : meetup),
                })),
            }) : data,
        );
        queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.Meetup>>>(
            { queryKey: ['my-meetups'] },
            (data) => data ? ({
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).map((meetup) => meetup.id === meetupId ? updater(meetup) : meetup),
                })),
            }) : data,
        );
        queryClient.setQueryData<api.Meetup | undefined>(
            queryKeys.meetup(meetupId),
            (data) => data ? updater(data) : data,
        );
    };

    const removeMeetupFromGoingCaches = (meetupId: string) => {
        const cachedQueries = queryClient.getQueriesData<InfiniteData<api.CursorResponse<api.Meetup>>>({
            queryKey: ['my-meetups'],
        });

        cachedQueries.forEach(([queryKey, data]) => {
            const params = Array.isArray(queryKey) ? queryKey[1] : undefined;
            const scope = typeof params === 'object' && params && 'scope' in params
                ? params.scope
                : undefined;

            if (scope !== 'going' || !data) {
                return;
            }

            queryClient.setQueryData<InfiniteData<api.CursorResponse<api.Meetup>>>(queryKey, {
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    items: (page.items ?? []).filter((item) => item.id !== meetupId),
                })),
            });
        });
    };

    const handleRSVP = async (meetup: api.Meetup) => {
        setPendingMeetupIds((current) => new Set(current).add(meetup.id));
        try {
            const result = await api.rsvpMeetup(meetup.id);
            updateMeetupInCaches(meetup.id, (item) => ({
                ...item,
                is_attending: result.attending,
                is_waitlisted: result.waitlisted,
                attendee_count: result.attendee_count,
                waitlist_count: result.waitlist_count,
            }));
            if (!result.attending && !result.waitlisted) {
                removeMeetupFromGoingCaches(meetup.id);
            }
            invalidateMeetupQueries(meetup.id);
            if (result.waitlisted) {
                Alert.alert('Added to waitlist', 'You will stay visible on the waitlist until a space opens or you leave.');
            }
        } catch (error: unknown) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setPendingMeetupIds((current) => {
                const next = new Set(current);
                next.delete(meetup.id);
                return next;
            });
        }
    };

    const handleManageAction = (meetup: api.Meetup) => {
        if (meetup.status !== 'draft' && meetup.status !== 'published') {
            onOpenMeetup(meetup);
            return;
        }
        setEditingMeetup(meetup);
        setCreateStage('form');
        setActiveView('create');
    };

    const handlePrimaryTabChange = (key: string) => {
        if (key === 'create' && !canCreateMeetups) {
            onOpenPlus();
            return;
        }
        if (key === 'create') {
            setCreateStage('form');
        }
        setActiveView(key as MeetupPrimaryView);
    };

    const handleChangeFormValue = (key: keyof MeetupFormValues, value: string | boolean | string[]) => {
        setFormValues((current) => ({ ...current, [key]: value } as MeetupFormValues));
        if (formError) setFormError('');
    };

    const handlePickCoverImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission required', 'Allow access to your photo library to upload a cover image.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.85,
        });
        if (result.canceled) return;

        const asset = result.assets[0];
        const previousPreview = localCoverPreviewUri;
        const previousCoverURL = formValues.cover_image_url;
        setLocalCoverPreviewUri(asset.uri);
        setUploadingCover(true);
        try {
            const { cover_image_url } = await api.uploadMeetupCoverImage({
                uri: asset.uri,
                mimeType: asset.mimeType ?? 'image/jpeg',
                fileName: asset.fileName ?? 'meetup-cover.jpg',
            });
            setFormValues((current) => ({ ...current, cover_image_url }));
        } catch (error: unknown) {
            setLocalCoverPreviewUri(previousPreview);
            setFormValues((current) => ({ ...current, cover_image_url: previousCoverURL }));
            Alert.alert('Upload failed', error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setUploadingCover(false);
        }
    };

    const handleRemoveCoverImage = () => {
        setLocalCoverPreviewUri(null);
        setFormValues((current) => ({ ...current, cover_image_url: '' }));
    };

    const submitMeetup = async (status: Extract<api.MeetupStatus, 'draft' | 'published'>) => {
        const nextStatus = editingMeetup?.status === 'published' ? 'published' : status;
        const validated = validateMeetupForm(formValues, nextStatus);
        if ('error' in validated) {
            setFormError(validated.error);
            return;
        }

        setSubmitting(true);
        try {
            if (editingMeetup) {
                await api.updateMeetup(editingMeetup.id, validated.values);
            } else {
                await api.createMeetup(validated.values);
            }
            invalidateMeetupQueries();
            setEditingMeetup(null);
            setFormValues(defaultFormValues(user));
            setLocalCoverPreviewUri(null);
            setFormError('');
            setCreateStage('form');
            setHostingScope(nextStatus === 'draft' ? 'drafts' : 'upcoming');
            setActiveView('hosting');
        } catch (error: unknown) {
            setFormError(error instanceof Error ? error.message : 'Unable to save this event right now.');
        } finally {
            setSubmitting(false);
        }
    };

    const resetEditingState = () => {
        setEditingMeetup(null);
        setFormValues(defaultFormValues(user));
        setLocalCoverPreviewUri(null);
        setFormError('');
        setCreateStage('form');
    };

    const closeCreateEditor = () => {
        setHostingScope(getEditingHostingScope(editingMeetup));
        resetEditingState();
        setActiveView('hosting');
    };

    const handleRemoveOrganizerMeetup = (meetup: api.Meetup) => {
        const destructiveLabel = meetup.status === 'draft' || canDeleteMeetup(meetup) ? 'Delete' : 'Cancel event';
        const message = meetup.status === 'draft'
            ? 'This draft will be permanently deleted.'
            : canDeleteMeetup(meetup)
                ? 'This event will be permanently deleted.'
                : 'This event will be cancelled and moved to Cancelled.';

        Alert.alert(`${destructiveLabel}?`, message, [
            { text: 'Keep it', style: 'cancel' },
            {
                text: destructiveLabel,
                style: 'destructive',
                onPress: async () => {
                    setPendingMeetupIds((current) => new Set(current).add(meetup.id));
                    try {
                        if (meetup.status === 'draft' || canDeleteMeetup(meetup)) {
                            await api.deleteMeetup(meetup.id);
                            removeMeetupFromCaches(meetup.id);
                        } else {
                            const updated = await api.cancelMeetup(meetup.id);
                            updateMeetupInCaches(meetup.id, () => updated);
                        }
                        invalidateMeetupQueries();
                    } catch (error: unknown) {
                        Alert.alert('Error', error instanceof Error ? error.message : 'Something went wrong.');
                    } finally {
                        setPendingMeetupIds((current) => {
                            const next = new Set(current);
                            next.delete(meetup.id);
                            return next;
                        });
                    }
                },
            },
        ]);
    };

    const handleDeleteDraftEdit = () => {
        if (!editingMeetup) return;
        Alert.alert('Delete this draft?', 'This draft will be permanently deleted.', [
            { text: 'Keep draft', style: 'cancel' },
            {
                text: 'Delete draft',
                style: 'destructive',
                onPress: async () => {
                    setSubmitting(true);
                    try {
                        await api.deleteMeetup(editingMeetup.id);
                        invalidateMeetupQueries();
                        resetEditingState();
                        setHostingScope('drafts');
                        setActiveView('hosting');
                    } catch (error: unknown) {
                        setFormError(error instanceof Error ? error.message : 'Unable to delete this draft right now.');
                    } finally {
                        setSubmitting(false);
                    }
                },
            },
        ]);
    };

    const handleCancelPublishedEdit = () => {
        if (!editingMeetup) return;
        Alert.alert('Cancel this event?', 'This will move the event out of Upcoming and into Cancelled.', [
            { text: 'Keep event', style: 'cancel' },
            {
                text: 'Cancel event',
                style: 'destructive',
                onPress: async () => {
                    setSubmitting(true);
                    try {
                        await api.cancelMeetup(editingMeetup.id);
                        invalidateMeetupQueries();
                        resetEditingState();
                        setHostingScope('cancelled');
                        setActiveView('hosting');
                    } catch (error: unknown) {
                        setFormError(error instanceof Error ? error.message : 'Unable to cancel this event right now.');
                    } finally {
                        setSubmitting(false);
                    }
                },
            },
        ]);
    };

    const handleApplyFilters = () => {
        setAppliedFilters(draftFilters);
        setFilterOpen(false);
    };

    const handleLoadMore = async () => {
        if (activeView === 'hosting') {
            if (hostingQuery.hasNextPage && !hostingQuery.isFetchingNextPage) {
                await hostingQuery.fetchNextPage();
            }
            return;
        }
        if (activeView === 'going') {
            if (goingQuery.hasNextPage && !goingQuery.isFetchingNextPage) {
                await goingQuery.fetchNextPage();
            }
            return;
        }
        if (discoverQuery.hasNextPage && !discoverQuery.isFetchingNextPage) {
            await discoverQuery.fetchNextPage();
        }
    };
    const guardedEndReached = useGuardedEndReached(handleLoadMore);

    const renderDiscoverHeader = () => (
        <View style={styles.discoverHeader}>
            <InfoNoticeCard
                title="Event discovery"
                description="Browse by category, distance, day of week, format, and availability without losing the flow of the feed."
            />
            <View style={styles.searchRow}>
                <SearchBar
                    primaryField={{
                        value: draftFilters.query,
                        onChangeText: (value) => {
                            setDraftFilters((current) => ({ ...current, query: value }));
                        },
                        placeholder: 'Search events, venues, hosts',
                        returnKeyType: 'search',
                    }}
                    style={styles.searchBar}
                    leading={<Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />}
                />
                <TouchableOpacity style={styles.filterButton} onPress={() => setFilterOpen(true)} activeOpacity={0.86}>
                    <Ionicons name="options-outline" size={20} color={Colors.light.textPrimary} />
                    {activeFilterChips.length ? (
                        <View style={styles.filterBadge}>
                            <Text style={styles.filterBadgeText}>{activeFilterChips.length}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
            </View>
            <View style={styles.quickCategoryHeader}>
                <Text style={styles.quickCategoryLabel}>Categories</Text>
                <View style={styles.quickCategoryHint}>
                    <Text style={styles.quickCategoryHintText}>Swipe to browse</Text>
                    <Ionicons name="arrow-forward" size={14} color={Colors.light.textTertiary} />
                </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCategoryRow}>
                <TouchableOpacity
                    style={[styles.quickCategoryChip, !appliedFilters.category && styles.quickCategoryChipActive]}
                    onPress={() => {
                        setDraftFilters((current) => ({ ...current, category: '' }));
                        setAppliedFilters((current) => ({ ...current, category: '' }));
                    }}
                >
                    <Text style={[styles.quickCategoryText, !appliedFilters.category && styles.quickCategoryTextActive]}>For you</Text>
                </TouchableOpacity>
                {categories.map((category) => (
                    <TouchableOpacity
                        key={category.slug}
                        style={[styles.quickCategoryChip, appliedFilters.category === category.slug && styles.quickCategoryChipActive]}
                        onPress={() => {
                            setDraftFilters((current) => ({ ...current, category: category.slug }));
                            setAppliedFilters((current) => ({ ...current, category: category.slug }));
                        }}
                    >
                        <Text style={[styles.quickCategoryText, appliedFilters.category === category.slug && styles.quickCategoryTextActive]}>
                            {category.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            {activeFilterChips.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChipRow}>
                    {activeFilterChips.map((chip) => (
                        <TouchableOpacity
                            key={chip.key}
                            style={styles.activeChip}
                            onPress={() => {
                                const nextFilters = removeMeetupFilter(appliedFilters, chip.key);
                                setAppliedFilters(nextFilters);
                                setDraftFilters(nextFilters);
                            }}
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

    const renderMyHeader = (title: string, body: string, showHostingScope = false) => (
        <View style={styles.sectionHeader}>
            <InfoNoticeCard title={title} description={body} />
            {showHostingScope ? (
                <SegmentedControl
                    items={[
                        { key: 'upcoming', label: 'Upcoming' },
                        { key: 'drafts', label: 'Drafts' },
                        { key: 'cancelled', label: 'Cancelled' },
                        { key: 'past', label: 'Past' },
                    ]}
                    activeKey={hostingScope}
                    onChange={(key) => setHostingScope(key as HostingScope)}
                    tone="secondary"
                    style={styles.scopeControl}
                />
            ) : null}
        </View>
    );

    const currentList = activeView === 'discover'
        ? discoverItems
        : activeView === 'hosting'
            ? hostingItems
            : goingItems;
    const currentQuery = activeView === 'discover'
        ? discoverQuery
        : activeView === 'hosting'
            ? hostingQuery
            : goingQuery;

    const listHeader = activeView === 'discover'
        ? renderDiscoverHeader()
        : activeView === 'hosting'
            ? renderMyHeader('Hosting', 'Manage upcoming, draft, cancelled, and past gatherings from one place.', true)
            : renderMyHeader('Going', 'Everything you are attending or queued for stays here.');

    const emptyState = activeView === 'discover'
        ? (
            <EmptyState
                title="No events match those filters"
                description="Try widening the distance, changing the category, or clearing the date filters."
                compact
                style={styles.emptyState}
            />
        )
        : activeView === 'hosting'
            ? (
                <EmptyState
                    title={
                        hostingScope === 'drafts'
                            ? 'No drafts yet'
                            : hostingScope === 'cancelled'
                                ? 'No cancelled events'
                                : hostingScope === 'past'
                                    ? 'No past events yet'
                                    : 'No upcoming events'
                    }
                    description={
                        hostingScope === 'drafts'
                            ? 'Save an event as a draft to polish it before publishing.'
                            : hostingScope === 'cancelled'
                                ? 'Cancelled events will land here instead of cluttering your active lineup.'
                                : 'Create your first event to build your local community.'
                    }
                    compact
                    style={styles.emptyState}
                />
            )
            : (
                <EmptyState
                    title="No events in your calendar"
                    description="RSVP to something interesting and it will appear here."
                compact
                style={styles.emptyState}
            />
            );

    const formMode = editingMeetup
        ? editingMeetup.status === 'published'
            ? 'published'
            : 'draft'
        : 'create';
    const formPrimaryActionLabel = formMode === 'published'
        ? 'Save changes'
        : 'Publish event';
    const formReviewActionLabel = formMode === 'published'
        ? 'Review changes'
        : 'Review';
    const formSecondaryActionLabel = formMode === 'published'
        ? undefined
        : 'Save draft';
    const formDestructiveActionLabel = formMode === 'published'
        ? 'Cancel event'
        : formMode === 'draft'
            ? 'Delete draft'
            : undefined;
    const canSwipeManageList = activeView === 'hosting' && (hostingScope === 'upcoming' || hostingScope === 'drafts');
    const getPrimaryAction = (meetup: api.Meetup) => {
        if (activeView === 'hosting') {
            return hostingScope === 'cancelled' ? undefined : handleManageAction;
        }
        if (activeView === 'going') {
            return meetup.can_manage ? handleManageAction : handleRSVP;
        }
        return meetup.can_manage ? handleManageAction : handleRSVP;
    };
    const getPrimaryLabel = (meetup: api.Meetup) => {
        if (activeView === 'hosting') {
            if (hostingScope === 'cancelled') return 'View';
            if (hostingScope === 'drafts') return 'Edit draft';
            if (hostingScope === 'past') return 'View';
            return 'Edit';
        }
        if (activeView === 'going') {
            return meetup.is_attending ? 'Leave' : meetup.is_waitlisted ? 'Leave waitlist' : meetup.can_manage ? 'Manage' : 'RSVP';
        }
        return getDiscoverActionLabel(meetup);
    };

    return (
        <View style={styles.container}>
            <SegmentedControl
                items={[
                    { key: 'discover', label: 'Discover' },
                    { key: 'hosting', label: 'Hosting' },
                    { key: 'going', label: 'Going' },
                    { key: 'create', label: 'Create', badgeLabel: canCreateMeetups ? undefined : 'Plus' },
                ]}
                activeKey={activeView}
                onChange={handlePrimaryTabChange}
                tone="primary"
                style={[screenStandards.tabControl, styles.primaryControl]}
            />

            {activeView === 'create' ? (
                <View style={[styles.createPane, createStage === 'review' && styles.createPaneReview]}>
                    {createStage === 'form' ? (
                        <MeetupForm
                            title={editingMeetup?.status === 'published' ? 'Refine your live event without taking it offline.' : editingMeetup ? 'Polish the draft until it is ready to go live.' : 'Build a polished meetup your community will actually want to join.'}
                            values={formValues}
                            categories={categories}
                            friends={friends}
                            mode={formMode}
                            loading={submitting}
                            coverUploading={uploadingCover}
                            coverPreviewUri={activeCoverPreviewUri}
                            error={formError}
                            primaryActionLabel={formReviewActionLabel}
                            primaryActionVariant={formMode === 'published' ? 'primary' : 'success'}
                            secondaryActionLabel={formSecondaryActionLabel}
                            destructiveActionLabel={formDestructiveActionLabel}
                            onChange={handleChangeFormValue}
                            onPickCover={handlePickCoverImage}
                            onRemoveCover={handleRemoveCoverImage}
                            onPrimaryAction={() => setCreateStage('review')}
                            onSecondaryAction={formSecondaryActionLabel ? () => void submitMeetup('draft') : undefined}
                            onDestructiveAction={formMode === 'published' ? handleCancelPublishedEdit : formMode === 'draft' ? handleDeleteDraftEdit : undefined}
                            onCancelEdit={editingMeetup ? closeCreateEditor : undefined}
                        />
                    ) : (
                        <MeetupReviewScreen
                            title={editingMeetup?.status === 'published' ? 'Your changes will apply directly to the live event.' : editingMeetup ? 'Check the draft carefully before you publish it.' : 'Review everything before this event goes live.'}
                            values={formValues}
                            categories={categories}
                            friends={friends}
                            coverPreviewUri={activeCoverPreviewUri}
                            loading={submitting}
                            error={formError}
                            primaryActionLabel={formPrimaryActionLabel}
                            primaryActionVariant={formMode === 'published' ? 'primary' : 'success'}
                            secondaryActionLabel={formSecondaryActionLabel}
                            destructiveActionLabel={formDestructiveActionLabel}
                            onBack={() => setCreateStage('form')}
                            onPrimaryAction={() => void submitMeetup('published')}
                            onSecondaryAction={formSecondaryActionLabel ? () => void submitMeetup('draft') : undefined}
                            onDestructiveAction={formMode === 'published' ? handleCancelPublishedEdit : formMode === 'draft' ? handleDeleteDraftEdit : undefined}
                        />
                    )}
                </View>
            ) : (
                <>
                    <FlatList
                        ref={listRef}
                        data={currentList}
                        style={styles.list}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => {
                            const card = (
                                <MeetupCard
                                    meetup={item}
                                    onPress={onOpenMeetup}
                                    onPrimaryAction={getPrimaryAction(item)}
                                    primaryLabel={getPrimaryLabel(item)}
                                    actionDisabled={pendingMeetupIds.has(item.id)}
                                />
                            );
                            if (!canSwipeManageList) {
                                return card;
                            }
                            const swipeLabel = item.status === 'draft' || canDeleteMeetup(item) ? 'Delete' : 'Cancel';
                            return (
                                <Swipeable
                                    overshootRight={false}
                                    renderRightActions={() => (
                                        <TouchableOpacity
                                            style={[styles.deleteAction, pendingMeetupIds.has(item.id) && styles.deleteActionDisabled]}
                                            onPress={() => handleRemoveOrganizerMeetup(item)}
                                            disabled={pendingMeetupIds.has(item.id)}
                                        >
                                            <Text style={styles.deleteActionText}>{pendingMeetupIds.has(item.id) ? '...' : swipeLabel}</Text>
                                        </TouchableOpacity>
                                    )}
                                >
                                    {card}
                                </Swipeable>
                            );
                        }}
                        ListHeaderComponent={listHeader}
                        ListEmptyComponent={!currentQuery.isLoading ? emptyState : null}
                        ListFooterComponent={currentQuery.isFetchingNextPage ? <Text style={styles.loadingMore}>Loading more events…</Text> : null}
                        refreshControl={undefined}
                        {...guardedEndReached}
                        onEndReachedThreshold={0.35}
                        onScroll={activeView === 'discover' ? discoverScroll.onScroll : undefined}
                        scrollEventThrottle={16}
                        contentContainerStyle={screenStandards.listContent}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                        {...listProps}
                    />
                    {activeView === 'discover' && discoverScroll.isVisible ? (
                        <ScrollToTopButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
                    ) : null}
                </>
            )}

            <MeetupFilterSheet
                visible={filterOpen}
                draftFilters={draftFilters}
                categories={categories}
                onChangeFilters={setDraftFilters}
                onClose={() => setFilterOpen(false)}
                onReset={() => setDraftFilters(DEFAULT_MEETUP_FILTERS)}
                onApply={handleApplyFilters}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    primaryControl: {
        marginBottom: 0,
    },
    list: {
        marginTop: Spacing.sm,
    },
    deleteAction: {
        width: 92,
        borderRadius: Radii.lg,
        backgroundColor: Colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: Spacing.sm,
        marginRight: Spacing.md,
    },
    deleteActionDisabled: {
        opacity: 0.55,
    },
    deleteActionText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    createPane: {
        flex: 1,
        paddingTop: Spacing.sm,
    },
    createPaneReview: {
        paddingTop: 0,
    },
    discoverHeader: {
        gap: Spacing.md,
        paddingTop: 0,
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
        borderRadius: Radii.full,
        backgroundColor: Colors.light.backgroundSecondary,
        borderWidth: 1,
        borderColor: Colors.light.borderSecondary,
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
    quickCategoryRow: {
        gap: Spacing.sm,
    },
    quickCategoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    quickCategoryLabel: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    quickCategoryHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    quickCategoryHintText: {
        color: Colors.light.textTertiary,
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
    },
    quickCategoryChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radii.full,
        backgroundColor: Colors.light.backgroundSecondary,
        borderWidth: 1,
        borderColor: Colors.light.borderSecondary,
    },
    quickCategoryChipActive: {
        backgroundColor: Colors.primarySubtle,
        borderColor: Colors.primary,
    },
    quickCategoryText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    quickCategoryTextActive: {
        color: Colors.primary,
    },
    activeChipRow: {
        gap: Spacing.sm,
    },
    activeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: Radii.full,
        backgroundColor: Colors.light.backgroundSecondary,
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
    sectionHeader: {
        gap: Spacing.sm,
        paddingTop: 0,
        paddingBottom: Spacing.md,
    },
    scopeControl: {
        marginTop: Spacing.sm,
        marginBottom: 0,
    },
    separator: {
        height: Spacing.md,
    },
    loadingMore: {
        textAlign: 'center',
        color: Colors.light.textSecondary,
        paddingVertical: Spacing.lg,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    emptyState: {
        marginTop: Spacing.xl,
    },
});
