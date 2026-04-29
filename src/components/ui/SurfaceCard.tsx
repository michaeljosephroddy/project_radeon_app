import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { commonStyles } from '../../styles/commonStyles';
import { Spacing } from '../../theme';

interface SurfaceCardProps {
    children: React.ReactNode;
    padding?: 'md' | 'lg';
    style?: StyleProp<ViewStyle>;
}

export function SurfaceCard({ children, padding = 'md', style }: SurfaceCardProps) {
    return (
        <View style={[commonStyles.card, padding === 'lg' ? styles.paddingLg : styles.paddingMd, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    paddingMd: {
        padding: Spacing.md,
    },
    paddingLg: {
        padding: Spacing.lg,
    },
});
