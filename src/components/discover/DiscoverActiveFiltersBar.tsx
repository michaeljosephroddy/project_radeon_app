import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiscoverActiveChip } from '../../hooks/useDiscoverFilters';
import { Colors, ControlSizes, Radius, Spacing, TextStyles } from '../../theme';

interface DiscoverActiveFiltersBarProps {
    chips: DiscoverActiveChip[];
    broadenedCopy?: string | null;
    onRemoveChip: (key: DiscoverActiveChip['key']) => void;
    onClearAll: () => void;
}

export function DiscoverActiveFiltersBar({
    chips,
    broadenedCopy,
    onRemoveChip,
    onClearAll,
}: DiscoverActiveFiltersBarProps) {
    if (chips.length === 0 && !broadenedCopy) {
        return null;
    }

    return (
        <View style={styles.container}>
            {broadenedCopy ? (
                <View style={styles.infoPill}>
                    <Ionicons name="sparkles-outline" size={14} color={Colors.primary} />
                    <Text style={styles.infoText}>{broadenedCopy}</Text>
                </View>
            ) : null}

            {chips.length > 0 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {chips.map((chip) => (
                        <TouchableOpacity
                            key={chip.key}
                            style={styles.chip}
                            onPress={() => onRemoveChip(chip.key)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.chipText}>{chip.label}</Text>
                            <Ionicons name="close" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity style={styles.clearAll} onPress={onClearAll} activeOpacity={0.8}>
                        <Text style={styles.clearAllText}>Clear all</Text>
                    </TouchableOpacity>
                </ScrollView>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: Spacing.sm,
    },
    infoPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        minHeight: ControlSizes.chipMinHeight,
        backgroundColor: Colors.primarySubtle,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        alignSelf: 'flex-start',
    },
    infoText: {
        fontSize: TextStyles.chip.fontSize,
        fontWeight: TextStyles.chip.fontWeight,
        color: Colors.primary,
    },
    scrollContent: {
        gap: Spacing.sm,
        paddingRight: Spacing.md,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        minHeight: ControlSizes.chipMinHeight,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    chipText: {
        fontSize: TextStyles.chip.fontSize,
        fontWeight: TextStyles.chip.fontWeight,
        color: Colors.primary,
    },
    clearAll: {
        justifyContent: 'center',
        paddingHorizontal: Spacing.sm,
    },
    clearAllText: {
        ...TextStyles.chip,
        color: Colors.text.secondary,
    },
});
