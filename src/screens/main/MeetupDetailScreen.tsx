import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import * as api from '../../api/client';
import { Avatar } from '../../components/Avatar';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

function formatMeetupDate(dateStr: string) {
  const date = new Date(dateStr);

  return {
    weekday: date.toLocaleDateString('default', { weekday: 'long' }),
    fullDate: date.toLocaleDateString('default', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('default', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}

interface MeetupDetailScreenProps {
  meetup: api.Meetup;
  onBack: () => void;
  onToggleRSVP: (id: string) => void;
  rsvpPending?: boolean;
  actionLabel?: string;
}

export function MeetupDetailScreen({
  meetup,
  onBack,
  onToggleRSVP,
  rsvpPending = false,
  actionLabel,
}: MeetupDetailScreenProps) {
  const [attendees, setAttendees] = useState<api.MeetupAttendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(true);
  const [attendeesError, setAttendeesError] = useState('');
  const [attendeesExpanded, setAttendeesExpanded] = useState(false);
  const buttonLabel = actionLabel ?? (meetup.is_attending ? 'Going ✓' : 'RSVP to this meetup');
  const { weekday, fullDate, time } = formatMeetupDate(meetup.starts_at);

  useEffect(() => {
    let active = true;

    setLoadingAttendees(true);
    setAttendeesError('');

    api.getMeetupAttendees(meetup.id)
      .then(page => {
        if (!active) return;
        setAttendees(page.items ?? []);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAttendeesError(error instanceof Error ? error.message : 'Unable to load attendees.');
      })
      .finally(() => {
        if (!active) return;
        setLoadingAttendees(false);
      });

    return () => {
      active = false;
    };
  }, [meetup.id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerSide}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meetup Details</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>EVENT</Text>
          <Text style={styles.title}>{meetup.title}</Text>
          <Text style={styles.meta}>{weekday}, {fullDate}</Text>
          <Text style={styles.meta}>{time} · {meetup.city}</Text>
          <Text style={styles.meta}>
            {meetup.capacity ? `${meetup.attendee_count}/${meetup.capacity} going` : `${meetup.attendee_count} going`}
            {meetup.is_attending ? ' · You are attending' : ''}
          </Text>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              meetup.is_attending && styles.primaryButtonActive,
              rsvpPending && styles.primaryButtonDisabled,
            ]}
            onPress={() => onToggleRSVP(meetup.id)}
            disabled={rsvpPending}
          >
            <Text style={[styles.primaryButtonText, meetup.is_attending && styles.primaryButtonTextActive]}>
              {rsvpPending ? 'Updating...' : buttonLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {!!meetup.description && (
          <>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.bodyText}>{meetup.description}</Text>
            </View>
          </>
        )}

        <View style={styles.attendeesHeader}>
          <View style={styles.attendeesTitleRow}>
            <Text style={styles.sectionLabelInline}>Attendees</Text>
            <View style={styles.attendeeCountPill}>
              <Text style={styles.attendeeCountText}>{attendees.length || meetup.attendee_count}</Text>
            </View>
          </View>
          {!loadingAttendees && attendees.length > 0 && (
            <TouchableOpacity onPress={() => setAttendeesExpanded(current => !current)}>
              <Text style={styles.attendeesToggleText}>
              {attendeesExpanded ? 'Hide' : 'See all'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.sectionCard}>
          {loadingAttendees ? (
            <ActivityIndicator color={Colors.primary} />
          ) : attendeesError ? (
            <Text style={styles.helperText}>{attendeesError}</Text>
          ) : attendees.length === 0 ? (
            <Text style={styles.helperText}>No attendees yet.</Text>
          ) : (
            <>
              <View style={styles.attendeePreviewRow}>
                {(() => {
                  const featuredAttendee = attendees.find(attendee => attendee.id === meetup.organizer_id) ?? attendees[0];
                  const isHost = featuredAttendee.id === meetup.organizer_id;

                  return (
                    <View style={styles.attendeeCard}>
                      <Avatar
                        username={featuredAttendee.username}
                        avatarUrl={featuredAttendee.avatar_url ?? undefined}
                        size={56}
                        fontSize={18}
                      />
                      {isHost && (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeText}>Host</Text>
                        </View>
                      )}
                      <Text style={styles.attendeeCardName} numberOfLines={1}>{featuredAttendee.username}</Text>
                      <Text style={styles.attendeeCardMeta}>{isHost ? 'Organizer' : 'Member'}</Text>
                    </View>
                  );
                })()}

                {attendees.length > 1 && (
                  <TouchableOpacity
                    style={[styles.attendeeCard, styles.moreCard]}
                    onPress={() => setAttendeesExpanded(true)}
                  >
                    <View style={styles.moreAvatarCluster}>
                      {attendees.slice(0, 4).map(attendee => (
                        <View key={`cluster-${attendee.id}`} style={styles.moreAvatar}>
                          <Avatar
                            username={attendee.username}
                            avatarUrl={attendee.avatar_url ?? undefined}
                            size={34}
                            fontSize={11}
                          />
                        </View>
                      ))}
                    </View>
                    <Text style={styles.moreCardText}>+{attendees.length - 1} more</Text>
                  </TouchableOpacity>
                )}
              </View>

              {attendeesExpanded && (
                <View style={styles.attendeeGrid}>
                  {attendees.map(attendee => (
                    <View key={`row-${attendee.id}`} style={styles.attendeeGridCard}>
                      <Avatar
                        username={attendee.username}
                        avatarUrl={attendee.avatar_url ?? undefined}
                        size={40}
                        fontSize={14}
                      />
                      <Text style={styles.attendeeGridName} numberOfLines={1}>{attendee.username}</Text>
                      <Text style={styles.attendeeGridMeta}>
                        {attendee.id === meetup.organizer_id ? 'Organizer' : (attendee.city ?? 'Member')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.light.border,
  },
  headerSide: { width: 40 },
  backIcon: { fontSize: 20, color: Colors.primary },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.lg,
  },
  eyebrow: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  meta: {
    fontSize: Typography.sizes.sm,
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  primaryButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonActive: {
    backgroundColor: Colors.successSubtle,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.textOn.primary,
  },
  primaryButtonTextActive: {
    color: Colors.success,
  },
  sectionLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.light.textTertiary,
    letterSpacing: 0.8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionLabelInline: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  sectionCard: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
  },
  bodyText: {
    fontSize: Typography.sizes.base,
    lineHeight: 22,
    color: Colors.light.textSecondary,
  },
  helperText: {
    fontSize: Typography.sizes.sm,
    color: Colors.light.textTertiary,
  },
  attendeesHeader: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendeesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  attendeeCountPill: {
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  attendeeCountText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  attendeePreviewRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  attendeeCard: {
    flex: 1,
    minHeight: 154,
    borderRadius: Radii.lg,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  hostBadge: {
    marginTop: -10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    backgroundColor: Colors.successSubtle,
  },
  hostBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.success,
  },
  attendeeCardName: {
    marginTop: Spacing.sm,
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  attendeeCardMeta: {
    fontSize: Typography.sizes.sm,
    color: Colors.light.textTertiary,
    marginTop: 4,
  },
  moreCard: {
    justifyContent: 'center',
  },
  attendeesToggleText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  moreAvatarCluster: {
    width: 76,
    height: 76,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
    marginBottom: Spacing.md,
  },
  moreAvatar: {
    width: 34,
    height: 34,
  },
  moreCardText: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  attendeeGrid: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  attendeeGridCard: {
    width: '48%',
    backgroundColor: Colors.light.background,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  attendeeGridName: {
    marginTop: Spacing.sm,
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  attendeeGridMeta: {
    fontSize: Typography.sizes.sm,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
});
