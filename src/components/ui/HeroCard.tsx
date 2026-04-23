import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { SurfaceCard } from './SurfaceCard';
import { Colors, Spacing, Typography } from '../../utils/theme';

interface HeroCardProps {
    eyebrow: string;
    title: string;
    description: string;
    style?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
}

export function HeroCard({ eyebrow, title, description, style, titleStyle }: HeroCardProps) {
    return (
        <SurfaceCard padding="lg" style={style}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={[styles.title, titleStyle]}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
        </SurfaceCard>
    );
}

const styles = StyleSheet.create({
    eyebrow: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.primary,
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    title: {
        fontSize: Typography.sizes.xl,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    description: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        lineHeight: 19,
        marginTop: Spacing.sm,
    },
});
