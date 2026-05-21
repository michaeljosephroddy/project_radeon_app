import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { appAlert } from '../../components/ui/appAlert';
import { OnboardingProgressHeader } from '../../components/onboarding/OnboardingProgressHeader';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

type IdentityVerificationStepProps = OnboardingStepProps;

export function IdentityVerificationStep({ onNext, onBack, dotIndex, dotTotal }: IdentityVerificationStepProps) {
    const [acknowledged, setAcknowledged] = useState(false);

    const handlePress = (): void => {
        if (acknowledged) {
            onNext();
            return;
        }

        setAcknowledged(true);
        appAlert.alert(
            'Verification coming soon',
            'ID verification will open here once the verification provider is connected.',
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <OnboardingProgressHeader dotIndex={dotIndex} dotTotal={dotTotal} onBack={onBack} />

            <View style={styles.content}>
                <View style={styles.iconWrap}>
                    <Ionicons name="shield-checkmark-outline" size={34} color={Colors.primary} />
                </View>

                <Text style={styles.title}>Verify your identity</Text>
                <Text style={styles.subtitle}>
                    SoberSpace will use ID verification to help keep bots and fake accounts out of the community.
                </Text>

                <View style={styles.card}>
                    <View style={styles.row}>
                        <Ionicons name="id-card-outline" size={20} color={Colors.primary} />
                        <Text style={styles.rowText}>Confirm you are a real person</Text>
                    </View>
                    <View style={styles.row}>
                        <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} />
                        <Text style={styles.rowText}>Verification documents stay with the verification provider</Text>
                    </View>
                    <View style={styles.row}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primary} />
                        <Text style={styles.rowText}>Your profile will show as verified once approved</Text>
                    </View>
                </View>

                <Text style={styles.placeholderText}>
                    Placeholder step: provider connection is not live yet.
                </Text>
            </View>

            <View style={styles.footer}>
                <PrimaryButton
                    label={acknowledged ? 'Continue' : 'Start verification'}
                    onPress={handlePress}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primarySubtle,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    title: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: Typography.sizes.lg,
        color: Colors.text.secondary,
        lineHeight: 22,
        marginBottom: Spacing.xl,
    },
    card: {
        gap: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    rowText: {
        flex: 1,
        fontSize: Typography.sizes.md,
        lineHeight: 21,
        color: Colors.text.primary,
    },
    placeholderText: {
        fontSize: Typography.sizes.sm,
        lineHeight: 19,
        color: Colors.text.muted,
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
});
