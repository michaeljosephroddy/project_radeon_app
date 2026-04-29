import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import { PrimaryButton } from '../ui/PrimaryButton';

interface DiscoverEmptyStateProps {
    title: string;
    description: string;
    primaryLabel?: string;
    secondaryLabel?: string;
    onPrimaryPress?: () => void;
    onSecondaryPress?: () => void;
}

export function DiscoverEmptyState({
    title,
    description,
    primaryLabel,
    secondaryLabel,
    onPrimaryPress,
    onSecondaryPress,
}: DiscoverEmptyStateProps) {
    return (
        <View style={styles.container}>
            <View style={styles.iconWrap}>
                <Ionicons name="people-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
            {primaryLabel && onPrimaryPress ? (
                <PrimaryButton label={primaryLabel} onPress={onPrimaryPress} style={styles.primaryButton} />
            ) : null}
            {secondaryLabel && onSecondaryPress ? (
                <TouchableOpacity style={styles.secondaryButton} onPress={onSecondaryPress} activeOpacity={0.8}>
                    <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xl,
        gap: Spacing.md,
    },
    iconWrap: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1,
        borderColor: Colors.border.default,
    },
    title: {
        fontSize: Typography.sizes.xl,
        fontWeight: '700',
        color: Colors.text.primary,
        textAlign: 'center',
    },
    description: {
        fontSize: Typography.sizes.base,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    primaryButton: {
        alignSelf: 'stretch',
        marginTop: Spacing.sm,
    },
    secondaryButton: {
        paddingVertical: Spacing.sm,
    },
    secondaryButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
});
