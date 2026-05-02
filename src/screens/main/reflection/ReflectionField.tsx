import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../theme';

interface ReflectionFieldProps {
    label: string;
    value: string;
    placeholder: string;
    onChangeText: (value: string) => void;
}

export function ReflectionField({
    label,
    value,
    placeholder,
    onChangeText,
}: ReflectionFieldProps): React.ReactElement {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                multiline
                maxLength={600}
                textAlignVertical="top"
                placeholder={placeholder}
                placeholderTextColor={Colors.text.muted}
                style={styles.input}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    field: {
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.default,
        overflow: 'hidden',
    },
    label: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    input: {
        minHeight: 92,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.lg,
        fontSize: Typography.sizes.base,
        lineHeight: 21,
        includeFontPadding: false,
        color: Colors.text.primary,
    },
});
