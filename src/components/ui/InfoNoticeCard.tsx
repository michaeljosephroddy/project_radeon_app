import React from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ControlSizes, Radius, Spacing, TextStyles } from '../../theme';
import { SurfaceCard } from './SurfaceCard';

export interface InfoNoticeCardProps {
    title: string;
    description: string;
    style?: StyleProp<ViewStyle>;
    onDismiss?: () => void;
}

export function InfoNoticeCard({ title, description, style, onDismiss }: InfoNoticeCardProps) {
    return (
        <SurfaceCard style={[styles.card, style]}>
            <View style={[styles.content, onDismiss ? styles.dismissibleContent : null]}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.description}>{description}</Text>
            </View>
            {onDismiss ? (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss info card"
                    hitSlop={Spacing.sm}
                    style={styles.dismissButton}
                    onPress={onDismiss}
                    activeOpacity={0.72}
                >
                    <Ionicons name="close" size={18} color={Colors.primary} />
                </TouchableOpacity>
            ) : null}
        </SurfaceCard>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(13,110,253,0.18)',
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(13,110,253,0.38)',
        position: 'relative',
    },
    content: {
        gap: 4,
    },
    dismissibleContent: {
        paddingRight: ControlSizes.iconButton,
    },
    dismissButton: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        width: ControlSizes.iconButton,
        height: ControlSizes.iconButton,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
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
