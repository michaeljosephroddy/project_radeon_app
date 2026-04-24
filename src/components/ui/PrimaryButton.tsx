import React from 'react';
import {
    ActivityIndicator,
    View,
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
    variant?: 'primary' | 'success' | 'warning';
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    leftAdornment?: React.ReactNode;
    rightAdornment?: React.ReactNode;
}

export function PrimaryButton({
    label,
    onPress,
    disabled = false,
    loading = false,
    variant = 'primary',
    style,
    textStyle,
    leftAdornment,
    rightAdornment,
}: PrimaryButtonProps) {
    const isWarning = variant === 'warning';
    return (
        <TouchableOpacity
            style={[
                styles.base,
                variant === 'success' ? styles.success : isWarning ? styles.warning : styles.primary,
                (disabled || loading) && styles.disabled,
                style,
            ]}
            onPress={onPress}
            disabled={disabled || loading}
        >
            {loading ? (
                <ActivityIndicator color={isWarning ? Colors.textOn.warning : Colors.textOn.primary} />
            ) : (
                <View style={styles.content}>
                    {leftAdornment}
                    <Text style={[styles.text, isWarning && styles.warningText, textStyle]}>{label}</Text>
                    {rightAdornment}
                </View>
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
    warning: {
        backgroundColor: Colors.warning,
    },
    warningText: {
        color: Colors.textOn.warning,
    },
    disabled: {
        opacity: 0.6,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    text: {
        color: Colors.textOn.primary,
        fontWeight: '600',
        fontSize: Typography.sizes.md,
    },
});
