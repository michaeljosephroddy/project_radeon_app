import React, { forwardRef } from 'react';
import {
    StyleProp,
    StyleSheet,
    TextInput,
    TextInputProps,
    TextStyle,
} from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';

export interface TextFieldProps extends TextInputProps {
    style?: StyleProp<TextStyle>;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
    { style, placeholderTextColor = Colors.light.textTertiary, ...props },
    ref,
) {
    // Centralize the app's default input chrome so screens only override layout
    // or behavior when they truly need a custom field.
    return (
        <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholderTextColor={placeholderTextColor}
            {...props}
        />
    );
});

const styles = StyleSheet.create({
    input: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
        fontSize: Typography.sizes.md,
        color: Colors.light.textPrimary,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
    },
});
