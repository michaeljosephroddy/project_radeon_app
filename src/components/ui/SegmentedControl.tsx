import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';

export interface SegmentedControlItem {
    key: string;
    label: string;
    flex?: number;
    disabled?: boolean;
    badgeLabel?: string;
}

interface SegmentedControlProps {
    items: SegmentedControlItem[];
    activeKey: string;
    onChange?: (key: string) => void;
    style?: StyleProp<ViewStyle>;
}

export function SegmentedControl({ items, activeKey, onChange, style }: SegmentedControlProps) {
    return (
        <View style={[styles.row, style]}>
            {items.map((item) => {
                const isActive = item.key === activeKey;
                const isDisabled = item.disabled || !onChange;

                return (
                    <TouchableOpacity
                        key={item.key}
                        // Keep the shared segmented control intentionally simple:
                        // selection state is controlled by the parent screen.
                        style={[
                            styles.button,
                            { flex: item.flex ?? 1 },
                            isActive && styles.buttonActive,
                        ]}
                        onPress={isDisabled ? undefined : () => onChange(item.key)}
                        disabled={isDisabled}
                    >
                        <View style={styles.content}>
                            <Text style={[styles.label, isActive && styles.labelActive]}>
                                {item.label}
                            </Text>
                            {item.badgeLabel ? (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{item.badgeLabel}</Text>
                                </View>
                            ) : null}
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    button: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.full,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: Colors.light.backgroundSecondary,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    buttonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    label: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
    labelActive: {
        color: Colors.textOn.primary,
    },
    badge: {
        backgroundColor: 'rgba(255,193,7,0.12)',
        borderRadius: Radii.pill,
        paddingHorizontal: Spacing.xs + 2,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,193,7,0.3)',
    },
    badgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.warning,
    },
});
