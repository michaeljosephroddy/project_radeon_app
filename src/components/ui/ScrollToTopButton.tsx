import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ControlSizes, Radius, Spacing, TextStyles } from '../../theme';

interface ScrollToTopButtonProps {
    onPress: () => void;
}

// Shared floating action used by long lists to quickly return to the top
// without coupling that interaction to any refresh side effects.
export function ScrollToTopButton({ onPress }: ScrollToTopButtonProps) {
    return (
        <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.9}>
            <Ionicons name="arrow-up" size={16} color={Colors.textOn.primary} />
            <Text style={styles.label}>Top</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        position: 'absolute',
        right: Spacing.md,
        bottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.primary,
        borderRadius: Radius.pill,
        minHeight: ControlSizes.iconButton,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    label: {
        ...TextStyles.button,
        fontSize: TextStyles.chip.fontSize,
    },
});
