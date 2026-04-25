import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Alert, ActivityIndicator, ScrollView, StyleProp, ViewStyle,
} from 'react-native';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as api from '../../api/client';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { Colors, Typography, Spacing, Radii, getAvatarColors } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';
import { useAuth } from '../../hooks/useAuth';
import { screenStandards } from '../../styles/screenStandards';

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
  onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

interface AttendeeProfileCardProps {
  attendee: api.MeetupAttendee;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

function AttendeeProfileCard({ attendee, label, onPress, style }: AttendeeProfileCardProps) {
  const avatarColors = getAvatarColors(attendee.username);

  return (
    <TouchableOpacity style={[styles.attendeeProfileCard, style]} activeOpacity={0.85} onPress={onPress}>
      {attendee.avatar_url ? (
        <Image source={{ uri: attendee.avatar_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: avatarColors.bg }]} />
      )}

      {!attendee.avatar_url && (
        <View style={styles.attendeeInitials}>
          <Text style={styles.attendeeInitialsText}>
            {attendee.username.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
        style={styles.attendeeCardScrim}
      />

      <View style={styles.attendeeCardFooter}>
        <View style={styles.attendeeCardPill}>
          <Text style={styles.attendeeCardPillText}>{label}</Text>
        </View>
        <Text style={styles.attendeeCardName} numberOfLines={1}>
          {formatUsername(attendee.username)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface AttendeeMosaicCardProps {
  attendees: api.MeetupAttendee[];
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

function AttendeeMosaicCard({ attendees, onPress, style }: AttendeeMosaicCardProps) {
  const previewAttendees = attendees.slice(0, 4);

  return (
    <TouchableOpacity style={[styles.attendeeProfileCard, styles.moreCard, style]} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.mosaicGrid}>
        {previewAttendees.map((attendee) => {
          const avatarColors = getAvatarColors(attendee.username);

          return (
            <View key={`mosaic-${attendee.id}`} style={styles.mosaicCell}>
              {attendee.avatar_url ? (
                <Image source={{ uri: attendee.avatar_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: avatarColors.bg }]} />
              )}

              {!attendee.avatar_url ? (
                <View style={styles.mosaicFallback}>
                  <Text style={styles.mosaicFallbackText}>
                    {attendee.username.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <LinearGradient
        colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.55)']}
        style={styles.mosaicOverlay}
      />
      <View style={styles.mosaicCountWrap}>
        <Text style={styles.mosaicCountText}>+{attendees.length} more</Text>
      </View>
    </TouchableOpacity>
  );
}

export function MeetupDetailScreen({
  meetup,
  onBack,
  onOpenUserProfile,
}: MeetupDetailScreenProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [attendees, setAttendees] = useState<api.MeetupAttendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(true);
  const [attendeesError, setAttendeesError] = useState('');
  const [attendeesExpanded, setAttendeesExpanded] = useState(false);
  const [rsvpPending, setRsvpPending] = useState(false);
  const [isAttending, setIsAttending] = useState(meetup.is_attending);
  const [attendeeCount, setAttendeeCount] = useState(meetup.attendee_count);
  const isOrganizer = !!user && user.id === meetup.organizer_id;
  const buttonLabel = isOrganizer && isAttending ? 'Hosting ✓' : isAttending ? 'Going ✓' : 'RSVP to this meetup';
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

  const handleToggleRSVP = async () => {
    setRsvpPending(true);
    try {
      const res = await api.rsvpMeetup(meetup.id);
      setIsAttending(res.attending);
      setAttendeeCount(prev => prev + (res.attending ? 1 : -1));

      const applyUpdate = (data: InfiniteData<api.PaginatedResponse<api.Meetup>> | undefined) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page, i) => ({
            ...page,
            items: i === 0
              ? (page.items ?? []).map(m => m.id === meetup.id
                  ? { ...m, is_attending: res.attending, attendee_count: m.attendee_count + (res.attending ? 1 : -1) }
                  : m)
              : (page.items ?? []),
          })),
        };
      };
      queryClient.setQueriesData<InfiniteData<api.PaginatedResponse<api.Meetup>>>(
        { queryKey: ['meetups'] }, applyUpdate,
      );
      queryClient.setQueriesData<InfiniteData<api.PaginatedResponse<api.Meetup>>>(
        { queryKey: ['my-meetups'] }, applyUpdate,
      );
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setRsvpPending(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack} title="Meetup Details" />

      <ScrollView contentContainerStyle={screenStandards.detailContent}>
        <SurfaceCard padding="lg" style={styles.eventCard}>
          <Text style={styles.eventEyebrow}>EVENT</Text>
          <Text style={styles.title}>{meetup.title}</Text>

          <View style={styles.eventDetails}>
            <View style={styles.eventDetailRow}>
              <Text style={styles.eventDetailLabel}>Date</Text>
              <Text style={styles.eventDetailValue}>{weekday}, {fullDate}</Text>
            </View>
            <View style={styles.eventDetailRow}>
              <Text style={styles.eventDetailLabel}>Time</Text>
              <Text style={styles.eventDetailValue}>{time}</Text>
            </View>
            <View style={styles.eventDetailRow}>
              <Text style={styles.eventDetailLabel}>Location</Text>
              <Text style={styles.eventDetailValue}>{meetup.city}</Text>
            </View>
            <View style={styles.eventDetailRow}>
              <Text style={styles.eventDetailLabel}>Attendance</Text>
              <Text style={styles.eventDetailValue}>
                {meetup.capacity ? `${attendeeCount}/${meetup.capacity} going` : `${attendeeCount} going`}
                {isAttending ? ' · You are attending' : ''}
              </Text>
            </View>
          </View>

          <PrimaryButton
            label={rsvpPending ? 'Updating...' : buttonLabel}
            onPress={handleToggleRSVP}
            disabled={rsvpPending}
            style={[
              styles.primaryButton,
              isAttending && styles.primaryButtonActive,
              rsvpPending && styles.primaryButtonDisabled,
            ]}
            textStyle={isAttending ? styles.primaryButtonTextActive : undefined}
          />
        </SurfaceCard>

        {!!meetup.description && (
          <>
            <SectionLabel style={styles.sectionLabel}>ABOUT</SectionLabel>
            <SurfaceCard style={styles.sectionCard}>
              <Text style={styles.bodyText}>{meetup.description}</Text>
            </SurfaceCard>
          </>
        )}

        <View style={styles.attendeesHeader}>
          <View style={styles.attendeesTitleRow}>
            <Text style={styles.sectionLabelInline}>Attendees</Text>
            <View style={styles.attendeeCountPill}>
              <Text style={styles.attendeeCountText}>{attendees.length || attendeeCount}</Text>
            </View>
          </View>
          {!loadingAttendees && attendees.length > 1 && (
            <TouchableOpacity onPress={() => setAttendeesExpanded(current => !current)}>
              <Text style={styles.attendeesToggleText}>
              {attendeesExpanded ? 'Hide' : 'See all'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View>
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
                  const remainingAttendees = attendees.filter(attendee => attendee.id !== featuredAttendee.id);

                  return (
                    <>
                      <AttendeeProfileCard
                        attendee={featuredAttendee}
                        label={isHost ? 'Organizer' : (featuredAttendee.city ?? 'Member')}
                        style={styles.attendeeCard}
                        onPress={() => onOpenUserProfile({
                          userId: featuredAttendee.id,
                          username: featuredAttendee.username,
                          avatarUrl: featuredAttendee.avatar_url ?? undefined,
                        })}
                      />

                      {remainingAttendees.length > 0 ? (
                        <AttendeeMosaicCard
                          attendees={remainingAttendees}
                          style={styles.attendeeCard}
                          onPress={() => setAttendeesExpanded(true)}
                        />
                      ) : null}
                    </>
                  );
                })()}
              </View>

              {attendeesExpanded && (
                <View style={styles.attendeeGrid}>
                  {attendees.map(attendee => (
                    <AttendeeProfileCard
                      key={`row-${attendee.id}`}
                      attendee={attendee}
                      label={attendee.id === meetup.organizer_id ? 'Organizer' : (attendee.city ?? 'Member')}
                      style={styles.attendeeGridCard}
                      onPress={() => onOpenUserProfile({
                        userId: attendee.id,
                        username: attendee.username,
                        avatarUrl: attendee.avatar_url ?? undefined,
                      })}
                    />
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
  eventCard: {
    gap: Spacing.md,
  },
  eventEyebrow: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  eventDetails: {
    gap: Spacing.sm,
  },
  eventDetailRow: {
    gap: 4,
  },
  eventDetailLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.light.textTertiary,
    letterSpacing: 0.6,
  },
  eventDetailValue: {
    fontSize: Typography.sizes.sm,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  primaryButton: {
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
  primaryButtonTextActive: {
    color: Colors.success,
  },
  sectionLabel: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  sectionLabelInline: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  sectionCard: { padding: Spacing.md },
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
    width: '48%',
    minHeight: 176,
    borderRadius: Radii.xl,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
  },
  attendeeCardName: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  moreCard: {
    position: 'relative',
  },
  attendeesToggleText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  attendeeGrid: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  attendeeGridCard: {
    width: '48%',
    backgroundColor: Colors.light.background,
    borderRadius: Radii.xl,
    minHeight: 164,
    overflow: 'hidden',
  },
  attendeeProfileCard: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  attendeeInitials: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeInitialsText: {
    fontSize: 34,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
  },
  attendeeCardScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '58%',
  },
  attendeeCardFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: 4,
    alignItems: 'center',
  },
  attendeeCardPill: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: Radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  attendeeCardPillText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: '#fff',
  },
  mosaicGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mosaicCell: {
    width: '50%',
    height: '50%',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  mosaicFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mosaicFallbackText: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 1,
  },
  mosaicOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  mosaicCountWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  mosaicCountText: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
});
