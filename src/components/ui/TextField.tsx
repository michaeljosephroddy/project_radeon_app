import React, { forwardRef } from 'react';
import {
    StyleProp,
    StyleSheet,
    TextInput,
    TextInputProps,
    TextStyle,
} from 'react-native';
import { Colors, ControlSizes, Radius, Spacing, TextStyles } from '../../theme';

export interface TextFieldProps extends TextInputProps {
    style?: StyleProp<TextStyle>;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
    { style, placeholderTextColor = Colors.text.muted, ...props },
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
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.md,
        minHeight: ControlSizes.inputMinHeight,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        ...TextStyles.input,
        borderWidth: 0.5,
        borderColor: Colors.border.default,
    },
});
