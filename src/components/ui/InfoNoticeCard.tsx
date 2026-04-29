import React from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import { Colors, Typography } from '../../theme';
import { SurfaceCard } from './SurfaceCard';

export interface InfoNoticeCardProps {
    title: string;
    description: string;
    style?: StyleProp<ViewStyle>;
}

export function InfoNoticeCard({ title, description, style }: InfoNoticeCardProps) {
    return (
        <SurfaceCard style={[styles.card, style]}>
            <View style={styles.content}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.description}>{description}</Text>
            </View>
        </SurfaceCard>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.primarySubtle,
        borderColor: 'rgba(13,110,253,0.24)',
    },
    content: {
        gap: 4,
    },
    title: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    description: {
        ...Typography.meta,
        color: Colors.text.muted,
    },
});
