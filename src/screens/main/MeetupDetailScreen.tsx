import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../../api/client';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';
import { screenStandards } from '../../styles/screenStandards';

interface MeetupDetailScreenProps {
    meetup: api.Meetup;
    onBack: () => void;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

function formatRange(startsAt: string, endsAt?: string | null): string {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    const startLabel = start.toLocaleString('default', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
    if (!end) return startLabel;
    const endLabel = end.toLocaleString('default', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
    return `${startLabel} — ${endLabel}`;
}

export function MeetupDetailScreen({
    meetup,
    onBack,
    onOpenUserProfile,
}: MeetupDetailScreenProps) {
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const [detail, setDetail] = useState<api.Meetup>(meetup);
    const [attendees, setAttendees] = useState<api.MeetupAttendee[]>([]);
    const [waitlist, setWaitlist] = useState<api.MeetupAttendee[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [loadedDetail, loadedAttendees] = await Promise.all([
                api.getMeetup(meetup.id),
                api.getMeetupAttendees(meetup.id),
            ]);
            setDetail(loadedDetail);
            setAttendees(loadedAttendees.items ?? []);
            if (loadedDetail.can_manage) {
                const loadedWaitlist = await api.getMeetupWaitlist(meetup.id);
                setWaitlist(loadedWaitlist.items ?? []);
            } else {
                setWaitlist([]);
            }
        } catch (nextError: unknown) {
            setError(nextError instanceof Error ? nextError.message : 'Unable to load this event.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, [meetup.id]);

    const primaryLabel = useMemo(() => {
        if (detail.can_manage) {
            if (detail.status === 'draft') return 'Publish draft';
            if (detail.status === 'published') return 'Cancel event';
            return 'Hosted event';
        }
        if (detail.is_attending) return 'Leave meetup';
        if (detail.is_waitlisted) return 'Leave waitlist';
        if (detail.waitlist_enabled && detail.capacity && detail.attendee_count >= detail.capacity) return 'Join waitlist';
        return 'RSVP now';
    }, [detail]);

    const secondaryMeta = [
        detail.category_label,
        detail.event_type.replace('_', ' '),
        detail.distance_km !== undefined && detail.distance_km !== null ? `${Math.round(detail.distance_km)} km away` : null,
    ].filter(Boolean).join(' · ');

    const handlePrimaryAction = async () => {
        setUpdating(true);
        try {
            if (detail.can_manage) {
                if (detail.status === 'draft') {
                    const updated = await api.publishMeetup(detail.id);
                    setDetail(updated);
                } else if (detail.status === 'published') {
                    const updated = await api.cancelMeetup(detail.id);
                    setDetail(updated);
                }
            } else {
                const result = await api.rsvpMeetup(detail.id);
                setDetail((current) => ({
                    ...current,
                    is_attending: result.attending,
                    is_waitlisted: result.waitlisted,
                    attendee_count: result.attendee_count,
                    waitlist_count: result.waitlist_count,
                }));
            }
            await queryClient.invalidateQueries({ queryKey: ['meetups'] });
            await queryClient.invalidateQueries({ queryKey: ['my-meetups'] });
            await queryClient.invalidateQueries({ queryKey: ['meetup', detail.id] });
            await load();
        } catch (nextError: unknown) {
            Alert.alert('Error', nextError instanceof Error ? nextError.message : 'Something went wrong.');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader onBack={onBack} title="Event details" />

            {loading ? (
                <View style={styles.centered}>
                    <Text style={styles.loadingText}>Loading event…</Text>
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <EmptyState title="Could not load this event" description={error} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[
                        screenStandards.detailContent,
                        { paddingBottom: Math.max(insets.bottom + Spacing.xs, Spacing.lg) },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.heroCard}>
                        {detail.cover_image_url ? (
                            <Image source={{ uri: detail.cover_image_url }} style={styles.coverImage} />
                        ) : (
                            <View style={styles.coverFallback}>
                                <Text style={styles.coverFallbackText}>{detail.category_label}</Text>
                            </View>
                        )}
                        <View style={styles.heroContent}>
                            <Text style={styles.heroTitle}>{detail.title}</Text>
                            <Text style={styles.heroMeta}>{secondaryMeta}</Text>
                            <Text style={styles.heroSchedule}>{formatRange(detail.starts_at, detail.ends_at)}</Text>
                            <Text style={styles.heroLocation}>
                                {detail.event_type === 'online' ? (detail.online_url ?? 'Online event') : `${detail.venue_name ?? detail.city}${detail.country ? `, ${detail.country}` : ''}`}
                            </Text>
                            {detail.status !== 'published' ? (
                                <View style={styles.statusPill}>
                                    <Text style={styles.statusPillText}>{detail.status.toUpperCase()}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    <PrimaryButton
                        label={primaryLabel}
                        onPress={handlePrimaryAction}
                        loading={updating}
                        disabled={detail.can_manage && detail.status !== 'draft' && detail.status !== 'published'}
                        variant={detail.can_manage && detail.status === 'published' ? 'warning' : detail.can_manage ? 'success' : 'primary'}
                    />

                    {!!detail.description && (
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>About</Text>
                            <Text style={styles.bodyText}>{detail.description}</Text>
                        </View>
                    )}

                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Hosts</Text>
                        <View style={styles.peopleColumn}>
                            {(detail.hosts?.length ? detail.hosts : [{
                                id: detail.organizer_id,
                                username: detail.organizer_username,
                                avatar_url: detail.organizer_avatar_url,
                                role: 'organizer',
                            }]).map((host) => (
                                <TouchableOpacity
                                    key={`${host.id}-${host.role}`}
                                    style={styles.personRow}
                                    onPress={() => onOpenUserProfile({ userId: host.id, username: host.username, avatarUrl: host.avatar_url ?? undefined })}
                                >
                                    <Avatar username={host.username} avatarUrl={host.avatar_url ?? undefined} size={40} fontSize={14} />
                                    <View style={styles.personCopy}>
                                        <Text style={styles.personName}>{host.username}</Text>
                                        <Text style={styles.personMeta}>{host.role.replace('_', ' ')}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Venue</Text>
                        <Text style={styles.bodyText}>{detail.venue_name ?? detail.city}</Text>
                        {detail.address_line_1 ? <Text style={styles.subtleText}>{detail.address_line_1}</Text> : null}
                        {detail.address_line_2 ? <Text style={styles.subtleText}>{detail.address_line_2}</Text> : null}
                        {detail.how_to_find_us ? <Text style={styles.subtleText}>{detail.how_to_find_us}</Text> : null}
                        {detail.online_url ? <Text style={styles.subtleText}>{detail.online_url}</Text> : null}
                    </View>

                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Attendance</Text>
                        <Text style={styles.bodyText}>
                            {detail.capacity ? `${detail.attendee_count}/${detail.capacity} going` : `${detail.attendee_count} going`}
                            {detail.waitlist_count > 0 ? ` · ${detail.waitlist_count} waitlist` : ''}
                        </Text>
                        <View style={styles.peopleColumn}>
                            {attendees.length ? attendees.map((attendee) => (
                                <TouchableOpacity
                                    key={attendee.id}
                                    style={styles.personRow}
                                    onPress={() => onOpenUserProfile({ userId: attendee.id, username: attendee.username, avatarUrl: attendee.avatar_url ?? undefined })}
                                >
                                    <Avatar username={attendee.username} avatarUrl={attendee.avatar_url ?? undefined} size={36} fontSize={12} />
                                    <View style={styles.personCopy}>
                                        <Text style={styles.personName}>{attendee.username}</Text>
                                        <Text style={styles.personMeta}>{attendee.city ?? 'Community member'}</Text>
                                    </View>
                                </TouchableOpacity>
                            )) : (
                                <EmptyState title="No attendees yet" description="Be the first one to show up." compact />
                            )}
                        </View>
                    </View>

                    {detail.can_manage ? (
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Waitlist</Text>
                            {waitlist.length ? (
                                <View style={styles.peopleColumn}>
                                    {waitlist.map((attendee) => (
                                        <TouchableOpacity
                                            key={attendee.id}
                                            style={styles.personRow}
                                            onPress={() => onOpenUserProfile({ userId: attendee.id, username: attendee.username, avatarUrl: attendee.avatar_url ?? undefined })}
                                        >
                                            <Avatar username={attendee.username} avatarUrl={attendee.avatar_url ?? undefined} size={36} fontSize={12} />
                                            <View style={styles.personCopy}>
                                                <Text style={styles.personName}>{attendee.username}</Text>
                                                <Text style={styles.personMeta}>Joined waitlist {new Date(attendee.rsvp_at).toLocaleDateString()}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : (
                                <EmptyState title="No waitlist yet" description="If the event fills up, queued members will appear here." compact />
                            )}
                        </View>
                    ) : null}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    loadingText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.md,
        fontWeight: '600',
    },
    heroCard: {
        borderRadius: Radii.xl,
        overflow: 'hidden',
        backgroundColor: Colors.light.backgroundSecondary,
        borderWidth: 1,
        borderColor: Colors.light.borderSecondary,
        marginBottom: Spacing.md,
    },
    coverImage: {
        width: '100%',
        height: 190,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    coverFallback: {
        height: 170,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
    },
    coverFallbackText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.xxl,
        fontWeight: '800',
    },
    heroContent: {
        padding: Spacing.lg,
        gap: 6,
    },
    heroTitle: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.xxl,
        fontWeight: '800',
    },
    heroMeta: {
        color: Colors.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    heroSchedule: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        lineHeight: 20,
    },
    heroLocation: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.md,
        fontWeight: '600',
    },
    statusPill: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.warning,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        marginTop: 4,
    },
    statusPillText: {
        color: Colors.textOn.warning,
        fontSize: Typography.sizes.xs,
        fontWeight: '800',
    },
    sectionCard: {
        marginTop: Spacing.md,
        borderRadius: Radii.xl,
        backgroundColor: Colors.light.backgroundSecondary,
        borderWidth: 1,
        borderColor: Colors.light.borderSecondary,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    sectionTitle: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.lg,
        fontWeight: '700',
    },
    bodyText: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.md,
        lineHeight: 22,
    },
    subtleText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        lineHeight: 19,
    },
    peopleColumn: {
        gap: Spacing.sm,
    },
    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: 4,
    },
    personCopy: {
        flex: 1,
        gap: 2,
    },
    personName: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
    personMeta: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
    },
});
