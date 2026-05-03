import React from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import { Colors, Radius, TextStyles } from '../../theme';
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
        backgroundColor: 'rgba(13,110,253,0.18)',
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(13,110,253,0.38)',
    },
    content: {
        gap: 4,
    },
    title: {
        fontSize: TextStyles.cardTitle.fontSize,
        fontWeight: TextStyles.cardTitle.fontWeight,
        color: Colors.primary,
    },
    description: {
        ...TextStyles.secondary,
        color: Colors.text.secondary,
    },
});
