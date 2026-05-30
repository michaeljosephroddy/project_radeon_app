import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, IconSizes, Spacing, TextStyles } from '../../theme';
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
                <Ionicons name="people-outline" size={IconSizes.hero} color={Colors.primary} />
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
        ...TextStyles.sectionTitle,
        color: Colors.text.primary,
        textAlign: 'center',
    },
    description: {
        ...TextStyles.body,
        textAlign: 'center',
    },
    primaryButton: {
        alignSelf: 'stretch',
        marginTop: Spacing.sm,
    },
    secondaryButton: {
        paddingVertical: Spacing.sm,
    },
    secondaryButtonText: {
        ...TextStyles.label,
        color: Colors.text.secondary,
    },
});
