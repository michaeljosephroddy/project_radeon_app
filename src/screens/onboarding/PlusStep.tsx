import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

const FEATURES = [
{ icon: 'trophy' as const, label: 'Advanced milestone tracking & badges' },
    { icon: 'people' as const, label: 'Greater visibility for support requests' },
    { icon: 'options' as const, label: 'Advanced filters for people discovery' },
    { icon: 'ban' as const, label: 'Ad-free experience' },
];

type PlusStepProps = OnboardingStepProps;

export function PlusStep({ onNext, onSkip, dotIndex, dotTotal }: PlusStepProps) {
    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.topBar}>
                <View style={styles.dots}>
                    {Array.from({ length: dotTotal }).map((_, i) => (
                        <View key={i} style={[styles.dot, i === dotIndex && styles.dotActive]} />
                    ))}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
                <View style={styles.iconWrap}>
                    <Ionicons name="star" size={40} color={Colors.warning} />
                </View>

                <Text style={styles.badge}>SoberSpace Plus</Text>
                <Text style={styles.title}>Upgrade to SoberSpace Plus</Text>
                <Text style={styles.subtitle}>
                    Join thousands of members who've unlocked the full SoberSpace experience.
                </Text>

                <View style={styles.featureList}>
                    {FEATURES.map(({ icon, label }) => (
                        <View key={label} style={styles.featureRow}>
                            <View style={styles.featureIcon}>
                                <Ionicons name={icon} size={18} color={Colors.warning} />
                            </View>
                            <Text style={styles.featureLabel}>{label}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.priceWrap}>
                    <Text style={styles.priceFree}>Free for 14 days</Text>
                    <Text style={styles.priceSub}>then €8.99 / month — cancel any time</Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <PrimaryButton
                    label="Start 14-day free trial"
                    onPress={onNext}
                    style={styles.trialBtn}
                />
                <TouchableOpacity style={styles.freeBtn} onPress={onSkip}>
                    <Text style={styles.freeBtnText}>Continue for free</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    dots: { flexDirection: 'row', gap: Spacing.sm },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.light.border,
    },
    dotActive: { backgroundColor: Colors.primary },
    inner: {
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xl,
    },
    iconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 193, 7, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 193, 7, 0.25)',
    },
    badge: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.warning,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: Spacing.sm,
    },
    title: {
        fontSize: Typography.sizes.xxxl,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        lineHeight: 36,
        marginBottom: Spacing.md,
    },
    subtitle: {
        fontSize: Typography.sizes.lg,
        color: Colors.light.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: Spacing.xl,
    },
    featureList: {
        width: '100%',
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    featureIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureLabel: {
        flex: 1,
        fontSize: Typography.sizes.lg,
        color: Colors.light.textPrimary,
        fontWeight: '500',
    },
    priceWrap: { alignItems: 'center', gap: 4 },
    priceFree: {
        fontSize: Typography.sizes.xl,
        fontWeight: '700',
        color: Colors.warning,
    },
    priceSub: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textTertiary,
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
        gap: Spacing.sm,
    },
    trialBtn: {
        backgroundColor: Colors.warning,
    },
    freeBtn: {
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        paddingVertical: 14,
        alignItems: 'center',
    },
    freeBtnText: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
});
