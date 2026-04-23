import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, RefreshControl, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as api from '../../api/client';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { HeroCard } from '../../components/ui/HeroCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SearchBar } from '../../components/ui/SearchBar';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useAuth } from '../../hooks/useAuth';
import { useMeetups, useMyMeetups } from '../../hooks/queries/useMeetups';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { MeetupDetailScreen } from './MeetupDetailScreen';

type MeetupsSubView = 'browse' | 'my' | 'create';

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

// Combines separate local date/time inputs into the RFC3339 value expected by the backend.
function toStartsAtValue(dateInput: string, timeInput: string): string | null {
    const date = dateInput.trim();
    const time = timeInput.trim();
    if (!date || !time) return null;

    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!dateMatch || !timeMatch) return null;

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);

    if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) {
        return null;
    }

    const parsed = new Date(year, month - 1, day, hours, minutes);
    if (Number.isNaN(parsed.getTime())) return null;
    if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day ||
        parsed.getHours() !== hours ||
        parsed.getMinutes() !== minutes
    ) {
        return null;
    }

    return parsed.toISOString();
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
}

function flattenMeetupPages(data?: InfiniteData<api.PaginatedResponse<api.Meetup>>): api.Meetup[] {
    return data?.pages.flatMap((page) => page.items ?? []) ?? [];
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
export function MeetupsScreen({ isActive, onOpenUserProfile }: MeetupsScreenProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const flatListRef = useRef<FlatList<api.Meetup> | null>(null);
    const hasActivatedBrowse = useLazyActivation(isActive);
    const [subView, setSubView] = useState<MeetupsSubView>('browse');
    const [selectedMeetupId, setSelectedMeetupId] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [cityFilter, setCityFilter] = useState(user?.city ?? '');
    const [debouncedCityFilter, setDebouncedCityFilter] = useState((user?.city ?? '').trim());
    const [cityHydrated, setCityHydrated] = useState(!!user?.city);
    const [rsvpPendingIds, setRsvpPendingIds] = useState<Set<string>>(new Set());
    const [submitError, setSubmitError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
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
    const meetups = useMemo(
        () => flattenMeetupPages(meetupsQuery.data),
        [meetupsQuery.data],
    );
    const myMeetups = useMemo(
        () => flattenMeetupPages(myMeetupsQuery.data),
        [myMeetupsQuery.data],
    );
    const selectedMeetup = meetups.find(item => item.id === selectedMeetupId)
        ?? myMeetups.find(item => item.id === selectedMeetupId)
        ?? null;

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedCityFilter(cityFilter.trim()), 250);
        return () => clearTimeout(timer);
    }, [cityFilter]);

    useEffect(() => {
        if (user?.city && !cityHydrated) {
            setCityFilter(user.city);
            setDebouncedCityFilter(user.city.trim());
            setCityHydrated(true);
        }
    }, [user?.city, cityHydrated]);

    useEffect(() => {
        if (cityHydrated || user?.city) return;

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
            setSuccessMessage('Meetup created successfully.');
            setSubView('my');
        } catch (e: unknown) {
            setSubmitError(e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    };

    const openMeetupDetails = useCallback((meetup: api.Meetup) => {
        setSelectedMeetupId(meetup.id);
    }, []);

    const closeMeetupDetails = useCallback(() => {
        setSelectedMeetupId(null);
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

    if (selectedMeetup) {
        return (
      <MeetupDetailScreen
        meetup={selectedMeetup}
        onBack={closeMeetupDetails}
        onToggleRSVP={handleRSVP}
        onOpenUserProfile={onOpenUserProfile}
        rsvpPending={rsvpPendingIds.has(selectedMeetup.id)}
        actionLabel={subView === 'my' && selectedMeetup.is_attending ? 'Hosting ✓' : undefined}
      />
        );
    }

    if (subView === 'create') {
        return (
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
                    <SegmentedControl
                        activeKey="create"
                        onChange={(key) => setSubView(key as MeetupsSubView)}
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
                    <TextField
                        value={form.title}
                        onChangeText={setField('title')}
                        placeholder="Friday coffee meetup"
                    />

                    <Text style={styles.label}>Description</Text>
                    <TextField
                        style={styles.inputMultiline}
                        value={form.description}
                        onChangeText={setField('description')}
                        placeholder="Optional details about the meetup"
                        multiline
                    />

                    <Text style={styles.label}>City</Text>
                    <TextField
                        value={form.city}
                        onChangeText={setField('city')}
                        placeholder="Dublin"
                    />

                    <Text style={styles.label}>Starts</Text>
                    <View style={styles.dateTimeRow}>
                        <View style={styles.dateTimeField}>
                            <Text style={styles.fieldHint}>Date</Text>
                            <TextField
                                value={form.startsOn}
                                onChangeText={setField('startsOn')}
                                placeholder="2026-05-01"
                                keyboardType="numbers-and-punctuation"
                            />
                        </View>
                        <View style={styles.dateTimeField}>
                            <Text style={styles.fieldHint}>Time (24hr local time)</Text>
                            <TextField
                                value={form.startsAt}
                                onChangeText={setField('startsAt')}
                                placeholder="19:30"
                                keyboardType="numbers-and-punctuation"
                            />
                        </View>
                    </View>
                    <Text style={styles.label}>Capacity</Text>
                    <TextField
                        value={form.capacity}
                        onChangeText={setField('capacity')}
                        placeholder="Optional"
                        keyboardType="number-pad"
                    />

                    {!!submitError && <Text style={styles.errorText}>{submitError}</Text>}
                    {!!successMessage && <Text style={styles.successText}>{successMessage}</Text>}

                    <PrimaryButton
                        label="Create Meetup"
                        onPress={handleCreateMeetup}
                        disabled={submitting}
                        loading={submitting}
                        variant="success"
                        style={styles.primaryButton}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    if (subView === 'my') {
        return (
            <FlatList
                ref={flatListRef}
                data={myMeetups}
                keyExtractor={meetup => meetup.id}
                {...meetupsListProps}
                onEndReached={meetupsListPagination.onEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={meetupsListPagination.onMomentumScrollBegin}
                onScrollBeginDrag={meetupsListPagination.onScrollBeginDrag}
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
                            onChange={(key) => setSubView(key as MeetupsSubView)}
                            items={[
                                { key: 'browse', label: 'Browse' },
                                { key: 'my', label: 'My Meetups' },
                                { key: 'create', label: 'Create' },
                            ]}
                        />

                        <HeroCard
                            eyebrow="HOSTING"
                            title="Meetups you've created."
                            description="New meetups appear here immediately after creation and stay in sync with the public list."
                            style={styles.headerCard}
                        />

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
                        onPress={openMeetupDetails}
                        onToggleRSVP={handleRSVP}
                        rsvpPending={rsvpPendingIds.has(item.id)}
                        actionLabel={item.is_attending ? 'Hosting ✓' : 'RSVP'}
                    />
                )}
                ListFooterComponent={myMeetupsQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
            />
        );
    }

    return (
        <FlatList
            ref={flatListRef}
            data={meetups}
            keyExtractor={meetup => meetup.id}
            {...meetupsListProps}
            onEndReached={meetupsListPagination.onEndReached}
            onEndReachedThreshold={0.4}
            onMomentumScrollBegin={meetupsListPagination.onMomentumScrollBegin}
            onScrollBeginDrag={meetupsListPagination.onScrollBeginDrag}
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
                        onChange={(key) => setSubView(key as MeetupsSubView)}
                        items={[
                            { key: 'browse', label: 'Browse' },
                            { key: 'my', label: 'My Meetups' },
                            { key: 'create', label: 'Create' },
                        ]}
                    />

                    <HeroCard
                        eyebrow="MEETUPS"
                        title="Find local sober events."
                        description="Browse public meetups, RSVP from the list, or create your own."
                        style={styles.headerCard}
                    />

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
                    onPress={openMeetupDetails}
                    onToggleRSVP={handleRSVP}
                    rsvpPending={rsvpPendingIds.has(item.id)}
                />
            )}
            ListFooterComponent={meetupsQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
        />
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.md, paddingBottom: 32 },
    footerLoader: { paddingVertical: Spacing.md },
    formContent: { padding: Spacing.md, paddingBottom: 40 },
    headerCard: { marginBottom: Spacing.md },
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
