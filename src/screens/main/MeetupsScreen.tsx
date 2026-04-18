import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

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

// Converts the date input into the RFC3339 string expected by the backend.
function toStartsAtValue(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

// Validates the create meetup form and returns normalized values when valid.
function validateMeetupForm(form: {
  title: string;
  description: string;
  city: string;
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
  const startsAt = toStartsAtValue(form.startsAt);
  const description = form.description.trim();
  const capacityText = form.capacity.trim();

  if (!title) return { error: 'Title is required.' };
  if (!city) return { error: 'City is required.' };
  if (!form.startsAt.trim()) return { error: 'Start date and time are required.' };
  if (!startsAt) return { error: 'Enter a valid start date/time. Use a full ISO value or something like 2026-05-01T19:30.' };

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
  onToggleRSVP: (id: string) => void;
  rsvpPending?: boolean;
  actionLabel?: string;
  actionDisabled?: boolean;
}

// Renders a single meetup row with its RSVP action.
function MeetupCard({ meetup, onToggleRSVP, rsvpPending = false, actionLabel, actionDisabled = false }: MeetupCardProps) {
  const { day, month, dateTime } = formatMeetupDate(meetup.starts_at);
  const buttonLabel = actionLabel ?? (meetup.is_attending ? 'Going ✓' : 'Going?');

  return (
    <View style={styles.card}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMon}>{month}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title}>{meetup.title}</Text>
        {!!meetup.description && (
          <Text style={styles.description}>{meetup.description}</Text>
        )}
        <Text style={styles.sub}>
          {meetup.city} · {dateTime}
        </Text>
        <Text style={styles.sub}>
          {meetup.capacity ? `${meetup.attendee_count}/${meetup.capacity} going` : `${meetup.attendee_count} going`}
          {meetup.is_attending ? ' · You are attending' : ''}
        </Text>
      </View>
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
}

// Renders the meetups tab and keeps RSVP state in sync with the list.
export function MeetupsScreen({ isActive }: MeetupsScreenProps) {
  const [subView, setSubView] = useState<MeetupsSubView>('browse');
  const [meetups, setMeetups] = useState<api.Meetup[]>([]);
  const [myMeetups, setMyMeetups] = useState<api.Meetup[]>([]);
  const [loading, setLoading] = useState(isActive);
  const [refreshing, setRefreshing] = useState(false);
  const [myMeetupsLoading, setMyMeetupsLoading] = useState(false);
  const [myMeetupsRefreshing, setMyMeetupsRefreshing] = useState(false);
  const [rsvpPendingIds, setRsvpPendingIds] = useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    city: '',
    startsAt: '',
    capacity: '',
  });
  const hasLoadedRef = useRef(false);
  const wasActiveRef = useRef(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const myMeetupsLoadedRef = useRef(false);
  const myMeetupsLoadInFlightRef = useRef<Promise<void> | null>(null);

  // Builds a field-specific setter for the create meetup form.
  const setField = (key: keyof typeof form) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSubmitError('');
    if (successMessage) setSuccessMessage('');
  };

  const load = useCallback(async () => {
    if (loadInFlightRef.current) return loadInFlightRef.current;

    // Reuse the same request for mount and pull-to-refresh callers that overlap.
    const request = (async () => {
      try {
        const data = await api.getMeetups();
        setMeetups(data ?? []);
      } catch {}
    })();

    loadInFlightRef.current = request;

    try {
      await request;
    } finally {
      loadInFlightRef.current = null;
    }
  }, []);

  // Loads the authenticated user's own created meetups.
  const loadMyMeetups = useCallback(async () => {
    if (myMeetupsLoadInFlightRef.current) return myMeetupsLoadInFlightRef.current;

    const request = (async () => {
      try {
        const data = await api.getMyMeetups();
        setMyMeetups(data ?? []);
      } catch {
        setMyMeetups([]);
      }
    })();

    myMeetupsLoadInFlightRef.current = request;

    try {
      await request;
    } finally {
      myMeetupsLoadInFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    const becameActive = isActive && !wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (!becameActive) return;

    const isFirstLoad = !hasLoadedRef.current;
    if (isFirstLoad) setLoading(true);

    load().finally(() => {
      hasLoadedRef.current = true;
      if (isFirstLoad) setLoading(false);
    });
  }, [isActive, load]);

  useEffect(() => {
    if (!isActive || subView !== 'my' || myMeetupsLoadedRef.current) return;

    setMyMeetupsLoading(true);
    loadMyMeetups().finally(() => {
      myMeetupsLoadedRef.current = true;
      setMyMeetupsLoading(false);
    });
  }, [isActive, subView, loadMyMeetups]);

  // Refreshes the meetup list for pull-to-refresh.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  // Refreshes the current user's meetup list.
  const onRefreshMyMeetups = async () => {
    setMyMeetupsRefreshing(true);
    try {
      await loadMyMeetups();
    } finally {
      setMyMeetupsRefreshing(false);
    }
  };

  // Toggles the current user's RSVP state for a meetup.
  const handleRSVP = async (id: string) => {
    setRsvpPendingIds(prev => new Set(prev).add(id));
    try {
      const res = await api.rsvpMeetup(id);
      // Adjust attendance counts locally so the button feels instant and the user
      // sees the toggle reflected without waiting for another fetch.
      const applyRsvp = (items: api.Meetup[]) =>
        items.map(meetup => meetup.id === id
          ? {
              ...meetup,
              is_attending: res.attending,
              attendee_count: meetup.attendee_count + (res.attending ? 1 : -1),
            }
          : meetup
        );

      setMeetups(prev => applyRsvp(prev));
      setMyMeetups(prev => applyRsvp(prev));
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
      setMeetups(prev => [createdMeetup, ...prev.filter(item => item.id !== createdMeetup.id)]);
      setMyMeetups(prev => [createdMeetup, ...prev.filter(item => item.id !== createdMeetup.id)]);
      myMeetupsLoadedRef.current = true;
      setForm({
        title: '',
        description: '',
        city: '',
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
  }

  if (subView === 'create') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <View style={styles.segmentRow}>
            <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('browse')}>
              <Text style={styles.segmentLabel}>Browse</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('my')}>
              <Text style={styles.segmentLabel}>My Meetups</Text>
            </TouchableOpacity>
            <View style={[styles.segmentButton, styles.segmentButtonActive]}>
              <Text style={[styles.segmentLabel, styles.segmentLabelActive]}>Create</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>CREATE</Text>
            <Text style={styles.heroTitle}>Start a meetup in your city.</Text>
            <Text style={styles.heroText}>
              Enter a local date/time like 2026-05-01T19:30 or a full ISO 8601 value. It will be sent to the API in RFC3339 format.
            </Text>
          </View>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={setField('title')}
            placeholder="Friday coffee meetup"
            placeholderTextColor={Colors.light.textTertiary}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={form.description}
            onChangeText={setField('description')}
            placeholder="Optional details about the meetup"
            placeholderTextColor={Colors.light.textTertiary}
            multiline
          />

          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={form.city}
            onChangeText={setField('city')}
            placeholder="Dublin"
            placeholderTextColor={Colors.light.textTertiary}
          />

          <Text style={styles.label}>Starts At</Text>
          <TextInput
            style={styles.input}
            value={form.startsAt}
            onChangeText={setField('startsAt')}
            placeholder="2026-05-01T19:30"
            placeholderTextColor={Colors.light.textTertiary}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Capacity</Text>
          <TextInput
            style={styles.input}
            value={form.capacity}
            onChangeText={setField('capacity')}
            placeholder="Optional"
            placeholderTextColor={Colors.light.textTertiary}
            keyboardType="number-pad"
          />

          {!!submitError && <Text style={styles.errorText}>{submitError}</Text>}
          {!!successMessage && <Text style={styles.successText}>{successMessage}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleCreateMeetup}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color={Colors.textOn.primary} />
              : <Text style={styles.primaryButtonText}>Create Meetup</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (subView === 'my') {
    return (
      <FlatList
        data={myMeetups}
        keyExtractor={meetup => meetup.id}
        refreshControl={<RefreshControl refreshing={myMeetupsRefreshing} onRefresh={onRefreshMyMeetups} tintColor={Colors.primary} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <View style={styles.segmentRow}>
              <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('browse')}>
                <Text style={styles.segmentLabel}>Browse</Text>
              </TouchableOpacity>
              <View style={[styles.segmentButton, styles.segmentButtonActive]}>
                <Text style={[styles.segmentLabel, styles.segmentLabelActive]}>My Meetups</Text>
              </View>
              <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('create')}>
                <Text style={styles.segmentLabel}>Create</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>HOSTING</Text>
              <Text style={styles.heroTitle}>Meetups you've created.</Text>
              <Text style={styles.heroText}>
                New meetups appear here immediately after creation and stay in sync with the public list.
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
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No meetups created yet.</Text>
              <Text style={styles.emptySubtext}>Create one to see it here right away.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <MeetupCard
            meetup={item}
            onToggleRSVP={handleRSVP}
            rsvpPending={rsvpPendingIds.has(item.id)}
            actionLabel={item.is_attending ? 'Hosting ✓' : 'RSVP'}
          />
        )}
      />
    );
  }

  return (
    <FlatList
      data={meetups}
      keyExtractor={meetup => meetup.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <>
          <View style={styles.segmentRow}>
            <View style={[styles.segmentButton, styles.segmentButtonActive]}>
              <Text style={[styles.segmentLabel, styles.segmentLabelActive]}>Browse</Text>
            </View>
            <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('my')}>
              <Text style={styles.segmentLabel}>My Meetups</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('create')}>
              <Text style={styles.segmentLabel}>Create</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>MEETUPS</Text>
            <Text style={styles.heroTitle}>Find local sober events.</Text>
            <Text style={styles.heroText}>
              Browse public meetups, RSVP from the list, or create your own without leaving this tab.
            </Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No upcoming meetups.</Text>
          <Text style={styles.emptySubtext}>Be the first to create one in your city.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <MeetupCard
          meetup={item}
          onToggleRSVP={handleRSVP}
          rsvpPending={rsvpPendingIds.has(item.id)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, paddingBottom: 32 },
  formContent: { padding: Spacing.md, paddingBottom: 40 },

  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.full,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
  },
  segmentButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  segmentLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  segmentLabelActive: { color: Colors.textOn.primary },

  heroCard: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heroEyebrow: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  heroText: {
    fontSize: Typography.sizes.sm,
    color: Colors.light.textSecondary,
    lineHeight: 19,
    marginTop: Spacing.sm,
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
  input: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontSize: Typography.sizes.md,
    color: Colors.light.textPrimary,
    borderWidth: 0.5,
    borderColor: Colors.light.border,
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: 'top',
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
  primaryButton: {
    backgroundColor: Colors.success,
    borderRadius: Radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  primaryButtonText: {
    color: Colors.textOn.primary,
    fontWeight: '600',
    fontSize: Typography.sizes.md,
  },
  buttonDisabled: { opacity: 0.6 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
  emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm, textAlign: 'center' },
});
