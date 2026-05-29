import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, TextStyles } from '../theme';

interface InterestSelectorProps {
    options: string[];
    selected: string[];
    maxSelected: number;
    loading?: boolean;
    onToggle: (interest: string) => void;
}

export function InterestSelector({
    options,
    selected,
    maxSelected,
    loading = false,
    onToggle,
}: InterestSelectorProps): React.ReactElement {
    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.wrap}>
            {options.map((interest) => {
                const isSelected = selected.includes(interest);
                const isAtLimit = selected.length >= maxSelected;
                const disabled = !isSelected && isAtLimit;

                return (
                    <TouchableOpacity
                        key={interest}
                        style={[
                            styles.chip,
                            isSelected && styles.chipActive,
                            disabled && styles.chipDisabled,
                        ]}
                        onPress={() => onToggle(interest)}
                        disabled={disabled}
                        activeOpacity={0.84}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                isSelected && styles.chipTextActive,
                                disabled && styles.chipTextDisabled,
                            ]}
                        >
                            {interest}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    loading: {
        minHeight: 44,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    wrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    chip: {
        minHeight: 40,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.surface,
    },
    chipActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    chipDisabled: {
        opacity: 0.46,
    },
    chipText: {
        ...TextStyles.label,
        color: Colors.text.primary,
    },
    chipTextActive: {
        color: Colors.textOn.primary,
    },
    chipTextDisabled: {
        color: Colors.text.muted,
    },
});
