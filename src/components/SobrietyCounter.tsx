import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Spacing, Typography } from '../theme';
import { formatSoberCounter, formatSoberSinceLine } from '../utils/date';

interface SobrietyCounterProps {
    soberSince?: string | null;
    style?: StyleProp<ViewStyle>;
    compact?: boolean;
}

export function SobrietyCounter({ soberSince, style, compact = false }: SobrietyCounterProps) {
    const counter = formatSoberCounter(soberSince ?? undefined);
    const sinceLine = formatSoberSinceLine(soberSince ?? undefined);

    if (!counter) return null;

    return (
        <View style={[styles.container, compact && styles.compact, style]}>
            <Text style={styles.label}>Sober for</Text>
            <Text style={[styles.value, compact && styles.compactValue]}>{counter}</Text>
            {sinceLine ? <Text style={styles.since}>{sinceLine}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        gap: 3,
    },
    compact: {
        paddingVertical: 12,
    },
    label: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 0,
    },
    value: {
        fontSize: Typography.sizes.xl,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    compactValue: {
        fontSize: Typography.sizes.lg,
    },
    since: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
    },
});
