import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ContentInsets, Radius, Spacing, TextStyles } from '../../theme';
import {
    RecoveryMeeting,
    formatDayTime,
    MEETING_FORMATS,
} from '../../screens/main/support/recoveryMeetingsMock';

interface RecoveryMeetingCardProps {
    meeting: RecoveryMeeting;
    onPress: (meeting: RecoveryMeeting) => void;
}

function formatLabel(format: RecoveryMeeting['format']): string {
    return MEETING_FORMATS.find((option) => option.value === format)?.label ?? format;
}

function formatIcon(format: RecoveryMeeting['format']): keyof typeof Ionicons.glyphMap {
    switch (format) {
        case 'online':
            return 'videocam-outline';
        case 'hybrid':
            return 'sync-outline';
        default:
            return 'location-outline';
    }
}

export const RecoveryMeetingCard = React.memo(function RecoveryMeetingCard({
    meeting,
    onPress,
}: RecoveryMeetingCardProps) {
    const dayTime = formatDayTime(meeting.day_of_week, meeting.start_time, meeting.duration_minutes);
    const locationLine = meeting.format === 'online'
        ? 'Online meeting'
        : meeting.venue
            ? `${meeting.venue} - ${meeting.city}`
            : `${meeting.city}, ${meeting.country}`;

    return (
        <TouchableOpacity style={styles.card} onPress={() => onPress(meeting)} activeOpacity={0.88}>
            <View style={styles.contentRow}>
                <View style={styles.body}>
                    <View style={styles.metaRow}>
                        <View style={styles.fellowshipPill}>
                            <Text style={styles.fellowshipPillText}>{meeting.fellowship}</Text>
                        </View>
                        <View style={styles.formatBadge}>
                            <Ionicons
                                name={formatIcon(meeting.format)}
                                size={12}
                                color={Colors.text.secondary}
                                style={styles.formatBadgeIcon}
                            />
                            <Text style={styles.formatBadgeText}>{formatLabel(meeting.format)}</Text>
                        </View>
                    </View>

                    <Text style={styles.title}>{meeting.name}</Text>
                    <Text style={styles.description} numberOfLines={2}>{meeting.description}</Text>

                    <Text style={styles.detailLine}>{dayTime}</Text>
                    <Text style={styles.detailLine}>{locationLine}</Text>

                    <View style={styles.tagRow}>
                        {meeting.meeting_types.slice(0, 4).map((tag) => (
                            <View key={tag} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                </View>
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
        color: Colors.primary,
        fontSize: TextStyles.caption.fontSize,
        fontWeight: TextStyles.caption.fontWeight,
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
        marginRight: 4,
    },
    formatBadgeText: {
        ...TextStyles.caption,
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
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
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
});
