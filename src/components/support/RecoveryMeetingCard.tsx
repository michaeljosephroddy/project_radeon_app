import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ContentInsets, Radius, Spacing, TextStyles } from '../../theme';
import {
    RecoveryMeeting,
    formatAddressLine,
    formatLocationLine,
    formatOccurrence,
    getFellowshipLabel,
    getMeetingTypeLabel,
    getPrimaryOccurrence,
    hasOnlineDetails,
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
    const scheduleLine = formatOccurrence(occurrence);
    const locationLine = formatLocationLine(meeting);
    const addressLine = formatAddressLine(meeting);
    const onlineDetailsVisible = hasOnlineDetails(meeting);

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
                                size={12}
                                color={Colors.text.secondary}
                                style={styles.formatBadgeIcon}
                            />
                            <Text style={styles.formatBadgeText}>{getMeetingTypeLabel(meeting.meeting_type)}</Text>
                        </View>
                    </View>

                    <Text style={styles.title}>{meeting.name}</Text>

                    <Text style={styles.detailLine}>{scheduleLine}</Text>
                    <Text style={styles.detailLine}>{locationLine}</Text>
                    {addressLine ? <Text style={styles.detailLine}>{addressLine}</Text> : null}

                    <View style={styles.tagRow}>
                        {meeting.formats.slice(0, 4).map((tag) => (
                            <View key={tag} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>

                    {onlineDetailsVisible ? (
                        <View style={styles.connectionBox}>
                            {meeting.online_url ? (
                                <Text style={styles.connectionLine} numberOfLines={2}>
                                    {meeting.online_url}
                                </Text>
                            ) : null}
                            {meeting.phone_join_info ? (
                                <Text style={styles.connectionLine} numberOfLines={3}>
                                    {meeting.phone_join_info}
                                </Text>
                            ) : null}
                        </View>
                    ) : null}
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
    connectionBox: {
        gap: 4,
        marginTop: 4,
        padding: Spacing.sm,
        borderRadius: Radius.md,
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    connectionLine: {
        ...TextStyles.caption,
        color: Colors.text.primary,
    },
});
