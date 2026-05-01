import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme';

interface SurfaceCardProps {
    children: React.ReactNode;
    padding?: 'md' | 'lg';
    style?: StyleProp<ViewStyle>;
}

export function SurfaceCard({ children, padding = 'md', style }: SurfaceCardProps) {
    return (
        <View style={[styles.card, padding === 'lg' ? styles.paddingLg : styles.paddingMd, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
    },
    paddingMd: {
        padding: Spacing.md,
    },
    paddingLg: {
        padding: Spacing.lg,
    },
});
