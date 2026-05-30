import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, IconSizes, Spacing } from '../../theme';

interface OnboardingProgressHeaderProps {
    dotIndex: number;
    dotTotal: number;
    onBack?: () => void;
}

export function OnboardingProgressHeader({ dotIndex, dotTotal, onBack }: OnboardingProgressHeaderProps) {
    return (
        <View style={styles.topBar}>
            <View style={styles.side}>
                {onBack ? (
                    <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityLabel="Go back">
                        <Ionicons name="chevron-back" size={IconSizes.tool} color={Colors.text.primary} />
                    </TouchableOpacity>
                ) : null}
            </View>
            <View style={styles.dots}>
                {Array.from({ length: dotTotal }).map((_, index) => (
                    <View key={index} style={[styles.dot, index === dotIndex && styles.dotActive]} />
                ))}
            </View>
            <View style={styles.side} />
        </View>
    );
}

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
    side: {
        width: 40,
        alignItems: 'flex-start',
    },
    backButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dots: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.border.default,
    },
    dotActive: { backgroundColor: Colors.primary },
});
