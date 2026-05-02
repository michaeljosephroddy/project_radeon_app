import React from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    TextInputProps,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { Colors, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { TextField } from './TextField';

interface SearchFieldConfig extends Omit<TextInputProps, 'style'> {
    flex?: number;
}

interface SearchBarProps {
    primaryField: SearchFieldConfig;
    secondaryField?: SearchFieldConfig;
    leading?: React.ReactNode;
    actionLabel?: string;
    onActionPress?: () => void;
    style?: StyleProp<ViewStyle>;
    variant?: 'compact' | 'pill';
}

export function SearchBar({
    primaryField,
    secondaryField,
    leading,
    actionLabel,
    onActionPress,
    style,
    variant = 'compact',
}: SearchBarProps) {
    const isPill = variant === 'pill';

    return (
        // The shared search bar covers the two patterns currently used in the
        // app: a compact single-field search row and a pill-shaped split search.
        <View style={[styles.base, isPill ? styles.pill : styles.compact, style]}>
            {leading ? <View style={styles.leading}>{leading}</View> : null}
            <TextField
                {...primaryField}
                style={[
                    styles.inputBase,
                    isPill ? styles.inputPill : styles.inputCompact,
                    { flex: primaryField.flex ?? 1 },
                ]}
            />
            {secondaryField ? (
                <>
                    <View style={styles.divider} />
                    <TextField
                        {...secondaryField}
                        style={[
                            styles.inputBase,
                            isPill ? styles.inputPill : styles.inputCompact,
                            { flex: secondaryField.flex ?? 1 },
                        ]}
                    />
                </>
            ) : null}
            {actionLabel && onActionPress ? (
                <TouchableOpacity
                    style={isPill ? styles.actionPill : styles.actionCompact}
                    onPress={onActionPress}
                >
                    <Text style={isPill ? styles.actionPillText : styles.actionCompactText}>
                        {actionLabel}
                    </Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    compact: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.md,
        gap: Spacing.sm,
        minHeight: ControlSizes.inputMinHeight,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    pill: {
        backgroundColor: Colors.bg.page,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        minHeight: ControlSizes.inputMinHeight,
        paddingLeft: Spacing.md,
        paddingRight: Spacing.xs,
        paddingVertical: 2,
    },
    leading: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputBase: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        paddingHorizontal: 0,
        marginTop: 0,
    },
    inputCompact: {
        paddingVertical: 0,
        fontSize: TextStyles.input.fontSize,
    },
    inputPill: {
        paddingVertical: Spacing.xs,
        fontSize: TextStyles.input.fontSize,
    },
    divider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: Colors.border.default,
        marginHorizontal: Spacing.sm,
    },
    actionCompact: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionCompactText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    actionPill: {
        width: ControlSizes.chipMinHeight,
        height: ControlSizes.chipMinHeight,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.text.primary,
        marginLeft: Spacing.sm,
    },
    actionPillText: {
        fontSize: Typography.sizes.lg,
        color: Colors.bg.page,
    },
});
