import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as api from '../../api/client';
import { Avatar } from '../Avatar';
import { MeetupEventTypeBadge } from './MeetupEventTypeBadge';
import { Colors, ContentInsets, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';

interface MeetupCardProps {
    meetup: api.Meetup;
    onPress: (meetup: api.Meetup) => void;
    onPrimaryAction?: (meetup: api.Meetup) => void;
    primaryLabel?: string;
    actionDisabled?: boolean;
}

function formatEventDate(dateString: string): { day: string; month: string; time: string; weekday: string; fullDate: string } {
    const date = new Date(dateString);
    return {
        day: `${date.getDate()}`,
        month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
        time: date.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' }),
        weekday: date.toLocaleDateString('default', { weekday: 'short' }),
        fullDate: date.toLocaleDateString('default', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        }),
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
            {meetup.cover_image_url ? (
                <Image source={{ uri: meetup.cover_image_url }} style={styles.coverImage} />
            ) : null}

            <View style={styles.contentRow}>
                <View style={styles.body}>
                    <View style={styles.metaRow}>
                        <View style={styles.pill}>
                            <Text style={styles.pillText}>{meetup.category_label}</Text>
                        </View>
                        <MeetupEventTypeBadge eventType={meetup.event_type} />
                    </View>

                    <Text style={styles.title}>{meetup.title}</Text>
                    {!!meetup.description && (
                        <Text style={styles.description} numberOfLines={2}>{meetup.description}</Text>
                    )}

                    <Text style={styles.detailLine}>
                        {date.fullDate} · {date.time}
                    </Text>
                    <Text style={styles.detailLine}>
                        {meetup.venue_name ?? meetup.city}
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
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
        marginHorizontal: -ContentInsets.screenHorizontal,
    },
    coverImage: {
        width: '100%',
        height: 132,
        backgroundColor: Colors.bg.page,
    },
    contentRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        padding: Spacing.md,
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
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    pillText: {
        color: Colors.primary,
        fontSize: TextStyles.caption.fontSize,
        fontWeight: TextStyles.caption.fontWeight,
    },
    title: {
        ...TextStyles.sectionTitle,
    },
    description: {
        ...TextStyles.secondary,
    },
    detailLine: {
        ...TextStyles.secondary,
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
        ...TextStyles.caption,
    },
    actionButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        minHeight: ControlSizes.chipMinHeight,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.bg.page,
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
        fontSize: TextStyles.chip.fontSize,
        fontWeight: TextStyles.label.fontWeight,
    },
    actionTextOnDark: {
        color: Colors.textOn.primary,
    },
});
