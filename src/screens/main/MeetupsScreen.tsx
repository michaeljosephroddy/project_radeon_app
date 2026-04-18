import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

// Splits a meetup start date into compact parts used by the list badge.
function formatMeetupDate(dateStr: string) {
  // Split the date into badge-friendly parts so the list can emphasize day/month
  // without repeating heavy date formatting inside renderItem.
  const d = new Date(dateStr);
  return {
    day: d.getDate().toString(),
    month: d.toLocaleString('default', { month: 'short' }).toUpperCase(),
    time: d.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' }),
  };
}

interface MeetupCardProps {
  meetup: api.Meetup;
  onToggleRSVP: (id: string) => void;
}

// Renders a single meetup row with its RSVP action.
function MeetupCard({ meetup, onToggleRSVP }: MeetupCardProps) {
  const { day, month, time } = formatMeetupDate(meetup.starts_at);

  return (
    <View style={styles.card}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMon}>{month}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={1}>{meetup.title}</Text>
        <Text style={styles.sub}>
          {meetup.city} · {time}
          {meetup.capacity ? ` · ${meetup.attendee_count}/${meetup.capacity}` : ` · ${meetup.attendee_count} going`}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.rsvpPill, meetup.is_attending && styles.rsvpPillActive]}
        onPress={() => onToggleRSVP(meetup.id)}
      >
        <Text style={[styles.rsvpText, meetup.is_attending && styles.rsvpTextActive]}>
          {meetup.is_attending ? 'Going ✓' : 'Going?'}
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
  const [meetups, setMeetups] = useState<api.Meetup[]>([]);
  const [loading, setLoading] = useState(isActive);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const wasActiveRef = useRef(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);

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

  // Refreshes the meetup list for pull-to-refresh.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  // Toggles the current user's RSVP state for a meetup.
  const handleRSVP = async (id: string) => {
    try {
      const res = await api.rsvpMeetup(id);
      // Adjust attendance counts locally so the button feels instant and the user
      // sees the toggle reflected without waiting for another fetch.
      setMeetups(prev =>
        prev.map(meetup => meetup.id === id
          ? { ...meetup, is_attending: res.attending, attendee_count: meetup.attendee_count + (res.attending ? 1 : -1) }
          : meetup
        )
      );
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
  }

  return (
    <FlatList
      data={meetups}
      keyExtractor={meetup => meetup.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No upcoming meetups.</Text>
          <Text style={styles.emptySubtext}>Be the first to create one in your city.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <MeetupCard meetup={item} onToggleRSVP={handleRSVP} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, paddingBottom: 32 },

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
  title: { fontSize: Typography.sizes.base, fontWeight: '500', color: Colors.light.textPrimary },
  sub: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary, marginTop: 2 },
  rsvpPill: {
    backgroundColor: Colors.light.background,
    borderRadius: Radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: Colors.light.border,
  },
  rsvpPillActive: { backgroundColor: Colors.successSubtle, borderColor: Colors.success },
  rsvpText: { fontSize: Typography.sizes.xs, fontWeight: '500', color: Colors.light.textTertiary },
  rsvpTextActive: { color: Colors.success },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
  emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm, textAlign: 'center' },
});
