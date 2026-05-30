import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ContentInsets, IconSizes, Radius, Spacing, TextStyles } from '../../theme';
import {
    RecoveryMeeting,
    formatAddressLine,
    formatLocationLine,
    formatOccurrenceDay,
    formatOccurrenceTime,
    getConnectionSummary,
    getFellowshipLabel,
    getMeetingTypeLabel,
    getPrimaryOccurrence,
} from '../../screens/main/support/recoveryMeetings';

interface RecoveryMeetingCardProps {
    meeting: RecoveryMeeting;
    onPress: (meeting: RecoveryMeeting) => void;
}

function formatIcon(format: RecoveryMeeting['meeting_type']): keyof typeof Ionicons.glyphMap {
    switch (format) {
        case 'online':
            return 'videocam-outline';
        case 'hybrid':
            return 'sync-outline';
        case 'phone':
            return 'call-outline';
        default:
            return 'location-outline';
    }
}

export const RecoveryMeetingCard = React.memo(function RecoveryMeetingCard({
    meeting,
    onPress,
}: RecoveryMeetingCardProps) {
    const occurrence = getPrimaryOccurrence(meeting);
    const dayLine = formatOccurrenceDay(occurrence);
    const timeLine = formatOccurrenceTime(occurrence);
    const locationLine = formatLocationLine(meeting);
    const addressLine = formatAddressLine(meeting);
    const connectionLine = getConnectionSummary(meeting);

    return (
        <TouchableOpacity style={styles.card} onPress={() => onPress(meeting)} activeOpacity={0.88}>
            <View style={styles.contentRow}>
                <View style={styles.body}>
                    <View style={styles.metaRow}>
                        <View style={styles.fellowshipPill}>
                            <Text style={styles.fellowshipPillText}>{getFellowshipLabel(meeting.fellowship)}</Text>
                        </View>
                        <View style={styles.formatBadge}>
                            <Ionicons
                                name={formatIcon(meeting.meeting_type)}
                                size={IconSizes.badge}
                                color={Colors.text.secondary}
                                style={styles.formatBadgeIcon}
                            />
                            <Text style={styles.formatBadgeText}>{getMeetingTypeLabel(meeting.meeting_type)}</Text>
                        </View>
                    </View>

                    <Text style={styles.title} numberOfLines={2}>{meeting.name}</Text>

                    <View style={styles.detailGrid}>
                        <View style={styles.detailRow}>
                            <Ionicons name="calendar-outline" size={IconSizes.inline} color={Colors.text.muted} />
                            <Text style={styles.detailLine} numberOfLines={1}>{dayLine}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Ionicons name="time-outline" size={IconSizes.inline} color={Colors.text.muted} />
                            <Text style={styles.detailLine} numberOfLines={1}>{timeLine}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Ionicons name={meeting.meeting_type === 'online' ? 'videocam-outline' : 'business-outline'} size={IconSizes.inline} color={Colors.text.muted} />
                            <Text style={styles.detailLine} numberOfLines={1}>{locationLine}</Text>
                        </View>
                        {addressLine ? (
                            <View style={styles.detailRow}>
                                <Ionicons name="map-outline" size={IconSizes.inline} color={Colors.text.muted} />
                                <Text style={styles.detailLine} numberOfLines={1}>{addressLine}</Text>
                            </View>
                        ) : null}
                        {connectionLine ? (
                            <View style={styles.detailRow}>
                                <Ionicons name="key-outline" size={IconSizes.inline} color={Colors.text.muted} />
                                <Text style={styles.detailLine} numberOfLines={2}>{connectionLine}</Text>
                            </View>
                        ) : null}
                    </View>

                    {meeting.formats.length ? (
                        <View style={styles.tagRow}>
                            {meeting.formats.slice(0, 3).map((tag) => (
                                <View key={tag} style={styles.tag}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </View>
                <View style={styles.actionColumn}>
                    <Ionicons name="chevron-forward" size={IconSizes.row} color={Colors.text.muted} />
                </View>
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
        marginHorizontal: -ContentInsets.screenHorizontal,
    },
    contentRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        padding: Spacing.md,
        alignItems: 'center',
    },
    body: {
        flex: 1,
        gap: Spacing.xs,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        flexWrap: 'wrap',
    },
    fellowshipPill: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    fellowshipPillText: {
        ...TextStyles.caption,
        color: Colors.primary,
    },
    formatBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.raised,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    formatBadgeIcon: {
        marginRight: Spacing.xs,
    },
    formatBadgeText: {
        ...TextStyles.caption,
    },
    title: {
        ...TextStyles.sectionTitle,
    },
    detailGrid: {
        gap: Spacing.xs,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.xs,
    },
    detailLine: {
        ...TextStyles.secondary,
        flex: 1,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        marginTop: 4,
    },
    tag: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.raised,
    },
    tagText: {
        ...TextStyles.caption,
    },
    actionColumn: {
        width: 24,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
});
