import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { commonStyles } from '../../styles/commonStyles';
import { Spacing, TextStyles } from '../../theme';

interface EmptyStateProps {
    title: string;
    description?: string;
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
    descriptionStyle?: StyleProp<TextStyle>;
}

export function EmptyState({
    title,
    description,
    compact = false,
    style,
    titleStyle,
    descriptionStyle,
}: EmptyStateProps) {
    return (
        <View style={[compact ? commonStyles.emptyStateCompact : commonStyles.emptyState, style]}>
            <Text style={[styles.title, titleStyle]}>{title}</Text>
            {description ? <Text style={[styles.description, descriptionStyle]}>{description}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    title: {
        ...TextStyles.sectionTitle,
        fontWeight: '600',
        textAlign: 'center',
    },
    description: {
        ...TextStyles.secondary,
        color: TextStyles.meta.color,
        marginTop: Spacing.sm,
        textAlign: 'center',
    },
});
