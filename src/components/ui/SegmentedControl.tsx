import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../theme';

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
    tone?: 'primary' | 'success' | 'warning' | 'info' | 'secondary';
}

function getToneStyles(tone: NonNullable<SegmentedControlProps['tone']>) {
    switch (tone) {
        case 'success':
            return {
                activeBackground: Colors.successSubtle,
                activeBorder: Colors.success,
                activeText: Colors.success,
            };
        case 'warning':
            return {
                activeBackground: Colors.warningSubtle,
                activeBorder: Colors.warning,
                activeText: Colors.warning,
            };
        case 'info':
            return {
                activeBackground: Colors.primarySubtle,
                activeBorder: Colors.primary,
                activeText: Colors.primary,
            };
        case 'secondary':
            return {
                activeBackground: Colors.secondarySubtle,
                activeBorder: Colors.secondary,
                activeText: Colors.text.secondary,
            };
        default:
            return {
                activeBackground: Colors.primarySubtle,
                activeBorder: Colors.primary,
                activeText: Colors.primary,
            };
    }
}

export function SegmentedControl({ items, activeKey, onChange, style, tone = 'primary' }: SegmentedControlProps) {
    const toneStyles = getToneStyles(tone);
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
                            isActive && {
                                backgroundColor: toneStyles.activeBackground,
                                borderColor: toneStyles.activeBorder,
                            },
                        ]}
                        onPress={isDisabled ? undefined : () => onChange(item.key)}
                        disabled={isDisabled}
                    >
                        <View style={styles.content}>
                            <Text style={[styles.label, isActive && { color: toneStyles.activeText }]}>
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
        borderColor: Colors.border.default,
        borderRadius: Radius.pill,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: Colors.bg.surface,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    label: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    badge: {
        backgroundColor: Colors.warningSubtle,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.xs + 2,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: Colors.warning,
    },
    badgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.warning,
    },
});
