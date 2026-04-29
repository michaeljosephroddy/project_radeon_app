import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { commonStyles } from '../../styles/commonStyles';
import { Colors, Spacing, Typography } from '../../theme';

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
        fontSize: Typography.sizes.lg,
        fontWeight: '500',
        color: Colors.text.primary,
        textAlign: 'center',
    },
    description: {
        fontSize: Typography.sizes.base,
        color: Colors.text.muted,
        marginTop: Spacing.sm,
        textAlign: 'center',
    },
});
