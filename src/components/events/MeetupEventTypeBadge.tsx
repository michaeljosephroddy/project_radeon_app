import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as api from '../../api/client';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';

interface MeetupEventTypeBadgeProps {
    eventType: api.MeetupEventType;
}

export function formatMeetupEventTypeLabel(eventType: api.MeetupEventType): string {
    switch (eventType) {
        case 'in_person':
            return 'In person';
        case 'online':
            return 'Online';
        case 'hybrid':
            return 'Hybrid';
        default:
            return eventType;
    }
}

export function MeetupEventTypeBadge({ eventType }: MeetupEventTypeBadgeProps) {
    const toneStyle = eventType === 'in_person'
        ? styles.successTone
        : eventType === 'online'
            ? styles.infoTone
            : styles.warningTone;
    const textToneStyle = eventType === 'in_person'
        ? styles.successToneText
        : eventType === 'online'
            ? styles.infoToneText
            : styles.warningToneText;

    return (
        <View style={[styles.badge, toneStyle]}>
            <Text style={[styles.badgeText, textToneStyle]}>{formatMeetupEventTypeLabel(eventType)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radii.full,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
    },
    successTone: {
        backgroundColor: Colors.successSubtle,
        borderColor: Colors.success,
    },
    successToneText: {
        color: Colors.success,
    },
    infoTone: {
        backgroundColor: Colors.infoSubtle,
        borderColor: Colors.info,
    },
    infoToneText: {
        color: Colors.info,
    },
    warningTone: {
        backgroundColor: Colors.warningSubtle,
        borderColor: Colors.warning,
    },
    warningToneText: {
        color: Colors.warning,
    },
});
