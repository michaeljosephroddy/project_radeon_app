import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as api from '../../api/client';
import { Avatar } from '../Avatar';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';

interface MeetupCardProps {
    meetup: api.Meetup;
    onPress: (meetup: api.Meetup) => void;
    onPrimaryAction?: (meetup: api.Meetup) => void;
    primaryLabel?: string;
    actionDisabled?: boolean;
}

function formatEventDate(dateString: string): { day: string; month: string; time: string; weekday: string } {
    const date = new Date(dateString);
    return {
        day: `${date.getDate()}`,
        month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
        time: date.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' }),
        weekday: date.toLocaleDateString('default', { weekday: 'short' }),
    };
}

export const MeetupCard = React.memo(function MeetupCard({
    meetup,
    onPress,
    onPrimaryAction,
    primaryLabel,
    actionDisabled = false,
}: MeetupCardProps) {
    const date = formatEventDate(meetup.starts_at);
    const actionText = primaryLabel
        ?? (meetup.can_manage
            ? meetup.status === 'draft' ? 'Draft' : meetup.status === 'cancelled' ? 'Cancelled' : 'Manage'
            : meetup.is_attending
                ? 'Going'
                : meetup.is_waitlisted
                    ? 'Waitlisted'
                    : meetup.waitlist_enabled && meetup.capacity && meetup.attendee_count >= meetup.capacity
                        ? 'Waitlist'
                        : 'RSVP');

    return (
        <TouchableOpacity style={styles.card} onPress={() => onPress(meetup)} activeOpacity={0.88}>
            <View style={styles.dateBadge}>
                <Text style={styles.dateDay}>{date.day}</Text>
                <Text style={styles.dateMonth}>{date.month}</Text>
            </View>

            <View style={styles.body}>
                <View style={styles.metaRow}>
                    <View style={styles.pill}>
                        <Text style={styles.pillText}>{meetup.category_label}</Text>
                    </View>
                    <View style={styles.pillMuted}>
                        <Text style={styles.pillMutedText}>{meetup.event_type.replace('_', ' ')}</Text>
                    </View>
                </View>

                <Text style={styles.title}>{meetup.title}</Text>
                {!!meetup.description && (
                    <Text style={styles.description} numberOfLines={2}>{meetup.description}</Text>
                )}

                <Text style={styles.detailLine}>
                    {date.weekday} · {date.time} · {meetup.venue_name ?? meetup.city}
                    {meetup.distance_km !== undefined && meetup.distance_km !== null ? ` · ${Math.round(meetup.distance_km)} km` : ''}
                </Text>
                <Text style={styles.detailLine}>
                    Hosted by {meetup.organizer_username}
                    {meetup.capacity ? ` · ${meetup.attendee_count}/${meetup.capacity} going` : ` · ${meetup.attendee_count} going`}
                    {meetup.waitlist_count > 0 ? ` · ${meetup.waitlist_count} waitlist` : ''}
                </Text>

                {meetup.attendee_preview?.length ? (
                    <View style={styles.previewRow}>
                        <View style={styles.previewCluster}>
                            {meetup.attendee_preview.slice(0, 3).map((attendee, index) => (
                                <View
                                    key={attendee.id}
                                    style={[
                                        styles.previewAvatarWrap,
                                        { left: index * 16, zIndex: 10 - index },
                                    ]}
                                >
                                    <Avatar
                                        username={attendee.username}
                                        avatarUrl={attendee.avatar_url ?? undefined}
                                        size={22}
                                        fontSize={9}
                                    />
                                </View>
                            ))}
                        </View>
                        <Text style={styles.previewLabel}>
                            {meetup.attendee_count > 3 ? `+${meetup.attendee_count - 3} more` : `${meetup.attendee_count} going`}
                        </Text>
                    </View>
                ) : null}
            </View>

            {onPrimaryAction ? (
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        meetup.is_attending && styles.actionButtonActive,
                        meetup.is_waitlisted && styles.actionButtonWaitlist,
                        meetup.can_manage && styles.actionButtonManage,
                        actionDisabled && styles.actionButtonDisabled,
                    ]}
                    onPress={() => onPrimaryAction(meetup)}
                    disabled={actionDisabled}
                >
                    <Text style={[
                        styles.actionText,
                        (meetup.is_attending || meetup.is_waitlisted || meetup.can_manage) && styles.actionTextOnDark,
                    ]}>
                        {actionText}
                    </Text>
                </TouchableOpacity>
            ) : null}
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        gap: Spacing.md,
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.light.borderSecondary,
    },
    dateBadge: {
        width: 56,
        borderRadius: Radii.md,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        gap: 2,
    },
    dateDay: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.xl,
        fontWeight: '700',
    },
    dateMonth: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        letterSpacing: 1,
    },
    body: {
        flex: 1,
        gap: 6,
    },
    metaRow: {
        flexDirection: 'row',
        gap: Spacing.xs,
        flexWrap: 'wrap',
    },
    pill: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radii.full,
        backgroundColor: Colors.primary,
    },
    pillText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
    },
    pillMuted: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radii.full,
        backgroundColor: Colors.light.background,
        borderWidth: 1,
        borderColor: Colors.light.borderSecondary,
    },
    pillMutedText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
    },
    title: {
        fontSize: Typography.sizes.lg,
        fontWeight: '700',
        color: Colors.light.textPrimary,
    },
    description: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        lineHeight: 20,
    },
    detailLine: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
    },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: 2,
    },
    previewCluster: {
        width: 56,
        height: 24,
    },
    previewAvatarWrap: {
        position: 'absolute',
        top: 0,
    },
    previewLabel: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
    },
    actionButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.light.background,
    },
    actionButtonActive: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    actionButtonWaitlist: {
        backgroundColor: Colors.warning,
        borderColor: Colors.warning,
    },
    actionButtonManage: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    actionButtonDisabled: {
        opacity: 0.55,
    },
    actionText: {
        color: Colors.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    actionTextOnDark: {
        color: Colors.textOn.primary,
    },
});
