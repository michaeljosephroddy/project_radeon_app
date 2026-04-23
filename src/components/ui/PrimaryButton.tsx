import React from 'react';
import {
    ActivityIndicator,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    ViewStyle,
} from 'react-native';
import { Colors, Radii, Typography } from '../../utils/theme';

interface PrimaryButtonProps {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'primary' | 'success';
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
}

export function PrimaryButton({
    label,
    onPress,
    disabled = false,
    loading = false,
    variant = 'primary',
    style,
    textStyle,
}: PrimaryButtonProps) {
    return (
        <TouchableOpacity
            style={[
                styles.base,
                variant === 'success' ? styles.success : styles.primary,
                (disabled || loading) && styles.disabled,
                style,
            ]}
            onPress={onPress}
            disabled={disabled || loading}
        >
            {loading ? (
                <ActivityIndicator color={Colors.textOn.primary} />
            ) : (
                <Text style={[styles.text, textStyle]}>{label}</Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: Radii.md,
        paddingVertical: 14,
        alignItems: 'center',
    },
    primary: {
        backgroundColor: Colors.primary,
    },
    success: {
        backgroundColor: Colors.success,
    },
    disabled: {
        opacity: 0.6,
    },
    text: {
        color: Colors.textOn.primary,
        fontWeight: '600',
        fontSize: Typography.sizes.md,
    },
});
