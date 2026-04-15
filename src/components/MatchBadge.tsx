import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Typography, Radii, Spacing } from '../utils/theme';

export function MatchBadge() {
    return (
        <View style={styles.badge}>
            <Text style={styles.text}>Match</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        backgroundColor: '#FCE4EC',
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.xs + 2,
        paddingVertical: 2,
    },
    text: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: '#C2185B',
    },
});
