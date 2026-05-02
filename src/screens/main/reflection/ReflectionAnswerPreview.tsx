import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../theme';

interface ReflectionAnswerPreviewProps {
    question: string;
    answer: string;
}

export function ReflectionAnswerPreview({
    question,
    answer,
}: ReflectionAnswerPreviewProps): React.ReactElement | null {
    const trimmed = answer.trim();
    if (!trimmed) return null;
    return (
        <View style={styles.container}>
            <Text style={styles.question}>{question}</Text>
            <Text style={styles.answer}>{trimmed}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.default,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    question: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    answer: {
        fontSize: Typography.sizes.base,
        lineHeight: 21,
        color: Colors.text.secondary,
    },
});
