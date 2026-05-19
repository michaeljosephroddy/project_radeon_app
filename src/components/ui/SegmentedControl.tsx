import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Colors, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';

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
    layer?: 'page' | 'section' | 'form';
    tone?: 'primary' | 'success' | 'warning' | 'info' | 'secondary';
}

interface ToneStyles {
    activeBackground: string;
    activeBorder: string;
    activeText: string;
    activeSolidText: string;
}

function getToneStyles(tone: NonNullable<SegmentedControlProps['tone']>): ToneStyles {
    switch (tone) {
        case 'success':
            return {
                activeBackground: Colors.successSubtle,
                activeBorder: Colors.success,
                activeText: Colors.success,
                activeSolidText: Colors.textOn.success,
            };
        case 'warning':
            return {
                activeBackground: Colors.warningSubtle,
                activeBorder: Colors.warning,
                activeText: Colors.warning,
                activeSolidText: Colors.textOn.warning,
            };
        case 'info':
            return {
                activeBackground: Colors.infoSubtle,
                activeBorder: Colors.info,
                activeText: Colors.info,
                activeSolidText: Colors.textOn.info,
            };
        case 'secondary':
            return {
                activeBackground: Colors.secondarySubtle,
                activeBorder: Colors.secondary,
                activeText: Colors.text.secondary,
                activeSolidText: Colors.textOn.secondary,
            };
        default:
            return {
                activeBackground: Colors.primarySubtle,
                activeBorder: Colors.primary,
                activeText: Colors.primary,
                activeSolidText: Colors.textOn.primary,
            };
    }
}

function getLayerStyles(
    layer: NonNullable<SegmentedControlProps['layer']>,
    toneStyles: ToneStyles,
): {
    row: ViewStyle;
    button: ViewStyle;
    activeButton: ViewStyle;
    activeTextColor: string;
} {
    if (layer === 'page') {
        return {
            row: styles.pageRow,
            button: styles.pageButton,
            activeButton: {
                backgroundColor: toneStyles.activeBorder,
                borderColor: toneStyles.activeBorder,
            },
            activeTextColor: toneStyles.activeSolidText,
        };
    }

    if (layer === 'form') {
        return {
            row: styles.formRow,
            button: styles.formButton,
            activeButton: {
                backgroundColor: toneStyles.activeBackground,
                borderColor: toneStyles.activeBorder,
            },
            activeTextColor: toneStyles.activeText,
        };
    }

    return {
        row: styles.sectionRow,
        button: styles.sectionButton,
        activeButton: {
            backgroundColor: toneStyles.activeBackground,
            borderColor: toneStyles.activeBorder,
        },
        activeTextColor: toneStyles.activeText,
    };
}

export function SegmentedControl({ items, activeKey, onChange, style, layer = 'section', tone = 'primary' }: SegmentedControlProps) {
    const toneStyles = getToneStyles(tone);
    const layerStyles = getLayerStyles(layer, toneStyles);

    return (
        <View style={[styles.row, layerStyles.row, style]}>
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
                            layerStyles.button,
                            { flex: item.flex ?? 1 },
                            isActive && layerStyles.activeButton,
                        ]}
                        onPress={isDisabled ? undefined : () => onChange(item.key)}
                        disabled={isDisabled}
                    >
                        <View style={styles.content}>
                            <Text style={[styles.label, isActive && { color: layerStyles.activeTextColor }]}>
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
    pageRow: {
        padding: 3,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.raised,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    sectionRow: {},
    formRow: {
        gap: Spacing.xs,
    },
    button: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.pill,
        minHeight: ControlSizes.segmentMinHeight,
        paddingVertical: Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.surface,
    },
    pageButton: {
        borderColor: 'transparent',
        backgroundColor: 'transparent',
    },
    sectionButton: {},
    formButton: {
        minHeight: ControlSizes.segmentMinHeight - 4,
        paddingVertical: Spacing.xs,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    label: {
        fontSize: TextStyles.chip.fontSize,
        fontWeight: TextStyles.label.fontWeight,
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
