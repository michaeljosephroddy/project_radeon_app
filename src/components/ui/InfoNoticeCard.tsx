import React from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import { Colors, Typography } from '../../utils/theme';
import { SurfaceCard } from './SurfaceCard';

export interface InfoNoticeCardProps {
    title: string;
    description: string;
    style?: StyleProp<ViewStyle>;
}

export function InfoNoticeCard({ title, description, style }: InfoNoticeCardProps) {
    return (
        <SurfaceCard style={style}>
            <View style={styles.content}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.description}>{description}</Text>
            </View>
        </SurfaceCard>
    );
}

const styles = StyleSheet.create({
    content: {
        gap: 4,
    },
    title: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    description: {
        ...Typography.meta,
        color: Colors.light.textTertiary,
    },
});
