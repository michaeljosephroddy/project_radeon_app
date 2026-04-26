import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiscoverActiveChip } from '../../hooks/useDiscoverFilters';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';

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
        backgroundColor: Colors.primarySubtle,
        borderRadius: Radii.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        alignSelf: 'flex-start',
    },
    infoText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '500',
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
        borderRadius: Radii.pill,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    chipText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '500',
        color: Colors.primary,
    },
    clearAll: {
        justifyContent: 'center',
        paddingHorizontal: Spacing.sm,
    },
    clearAllText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
});
