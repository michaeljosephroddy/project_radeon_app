import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';

interface GuidedOnboardingBannerProps {
    title: string;
    description: string;
    progressLabel: string;
    onBack?: () => void;
}

export function GuidedOnboardingBanner({
    title,
    description,
    progressLabel,
    onBack,
}: GuidedOnboardingBannerProps): React.ReactElement {
    return (
        <View style={styles.wrap}>
            <View style={styles.headerRow}>
                {onBack ? (
                    <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityLabel="Go back">
                        <Ionicons name="chevron-back" size={20} color={Colors.text.primary} />
                    </TouchableOpacity>
                ) : null}
                <Text style={styles.progress}>{progressLabel}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginHorizontal: Spacing.md,
        marginTop: Spacing.sm,
        marginBottom: Spacing.sm,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
    },
    headerRow: {
        minHeight: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    backButton: {
        width: 32,
        height: 28,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    progress: {
        ...TextStyles.caption,
        color: Colors.primary,
        marginLeft: 'auto',
    },
    title: {
        fontSize: Typography.sizes.lg,
        lineHeight: 24,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: Spacing.xs,
    },
    description: {
        fontSize: Typography.sizes.sm,
        lineHeight: 19,
        color: Colors.text.secondary,
    },
});
