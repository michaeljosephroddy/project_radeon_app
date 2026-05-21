import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './ui/PrimaryButton';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface SubscriptionPlan {
    id: 'yearly' | 'six_months' | 'three_months' | 'monthly';
    title: string;
    price: string;
    cadence: string;
    monthlyEquivalent: string;
    badge?: string;
}

export interface PlusActivitySummaryItem {
    key: string;
    label: string;
    completed: boolean;
}

const PLANS: SubscriptionPlan[] = [
    {
        id: 'yearly',
        title: '1 Year',
        price: '€119.88',
        cadence: 'per year',
        monthlyEquivalent: '€9.99 / month',
        badge: 'Best value',
    },
    {
        id: 'six_months',
        title: '6 Months',
        price: '€65.94',
        cadence: 'every 6 months',
        monthlyEquivalent: '€10.99 / month',
        badge: 'Popular',
    },
    {
        id: 'three_months',
        title: '3 Months',
        price: '€35.97',
        cadence: 'every 3 months',
        monthlyEquivalent: '€11.99 / month',
    },
    {
        id: 'monthly',
        title: '1 Month',
        price: '€12.99',
        cadence: 'per month',
        monthlyEquivalent: 'Flexible monthly access',
    },
];

const FEATURES = [
    { icon: 'people' as const, label: 'Recovery-first community access' },
    { icon: 'shield-checkmark' as const, label: 'Verified member experience' },
    { icon: 'calendar' as const, label: 'Groups, meetups, chats, and support tools' },
    { icon: 'heart' as const, label: 'Dating and friendship discovery' },
];

interface PlusUpsellScreenProps {
    onPrimary: () => void;
    onDismiss?: () => void;
    onBack?: () => void;
    primaryLabel?: string;
    dismissLabel?: string;
    activitySummary?: PlusActivitySummaryItem[];
    dotIndex?: number;
    dotTotal?: number;
}

export function PlusUpsellScreen({
    onPrimary,
    onDismiss,
    onBack,
    primaryLabel = 'Continue',
    dismissLabel = 'Not now',
    activitySummary,
    dotIndex,
    dotTotal,
}: PlusUpsellScreenProps) {
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan['id']>('yearly');
    const showDots = typeof dotIndex === 'number' && typeof dotTotal === 'number' && dotTotal > 0;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            {showDots ? (
                <View style={styles.topBar}>
                    <View style={styles.topBarSide}>
                        {onBack ? (
                            <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityLabel="Go back">
                                <Ionicons name="chevron-back" size={22} color={Colors.text.primary} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    <View style={styles.dots}>
                        {Array.from({ length: dotTotal }).map((_, index) => (
                            <View key={index} style={[styles.dot, index === dotIndex && styles.dotActive]} />
                        ))}
                    </View>
                    <View style={styles.topBarSide} />
                </View>
            ) : null}

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.heroIcon}>
                    <Ionicons name="sparkles" size={32} color={Colors.warning} />
                </View>
                <Text style={styles.kicker}>SoberSpace Plus</Text>
                <Text style={styles.title}>{activitySummary?.length ? 'Your SoberSpace is ready' : 'Join the community'}</Text>
                <Text style={styles.subtitle}>
                    {activitySummary?.length
                        ? 'Subscribe to view your activity, keep connecting, and continue using the community.'
                        : 'Membership is required to keep SoberSpace focused, safer, and free from bots. Cancel anytime.'}
                </Text>

                {activitySummary?.length ? (
                    <View style={styles.summaryCard}>
                        {activitySummary.map((item) => (
                            <View key={item.key} style={styles.summaryRow}>
                                <Ionicons
                                    name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={18}
                                    color={item.completed ? Colors.success : Colors.text.muted}
                                />
                                <Text style={styles.summaryText}>{item.label}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                <View style={styles.planList}>
                    {PLANS.map((plan) => {
                        const isSelected = selectedPlan === plan.id;
                        return (
                            <TouchableOpacity
                                key={plan.id}
                                style={[styles.planCard, isSelected && styles.planCardSelected]}
                                onPress={() => setSelectedPlan(plan.id)}
                                activeOpacity={0.86}
                            >
                                <View style={styles.planHeader}>
                                    <View style={styles.planTitleWrap}>
                                        <Text style={styles.planTitle}>{plan.title}</Text>
                                        {plan.badge ? (
                                            <View style={styles.planBadge}>
                                                <Text style={styles.planBadgeText}>{plan.badge}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                                        {isSelected ? <View style={styles.radioDot} /> : null}
                                    </View>
                                </View>
                                <View style={styles.priceRow}>
                                    <Text style={styles.planPrice}>{plan.price}</Text>
                                    <Text style={styles.planCadence}>{plan.cadence}</Text>
                                </View>
                                <Text style={styles.monthlyEquivalent}>{plan.monthlyEquivalent}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.featureList}>
                    {FEATURES.map((feature) => (
                        <View key={feature.label} style={styles.featureRow}>
                            <Ionicons name={feature.icon} size={18} color={Colors.primary} />
                            <Text style={styles.featureLabel}>{feature.label}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <PrimaryButton label={primaryLabel} onPress={onPrimary} variant="warning" />
                <Text style={styles.cancelText}>Cancel anytime from your app store subscription settings.</Text>
                {onDismiss ? (
                    <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
                        <Text style={styles.dismissText}>{dismissLabel}</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
    topBarSide: {
        width: 40,
    },
    backButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.border.default,
    },
    dotActive: { backgroundColor: Colors.primary },
    content: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xl,
    },
    heroIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.warningSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.warning,
    },
    kicker: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.warning,
        textTransform: 'uppercase',
        marginBottom: Spacing.xs,
    },
    title: {
        fontSize: Typography.sizes.xxxl,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: Typography.sizes.md,
        color: Colors.text.secondary,
        lineHeight: 21,
        marginBottom: Spacing.lg,
    },
    summaryCard: {
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    summaryText: {
        flex: 1,
        fontSize: Typography.sizes.sm,
        lineHeight: 19,
        color: Colors.text.primary,
    },
    planList: {
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    planCard: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    planCardSelected: {
        borderColor: Colors.warning,
        backgroundColor: Colors.warningSubtle,
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
        marginBottom: Spacing.sm,
    },
    planTitleWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    planTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    planBadge: {
        borderRadius: Radius.pill,
        backgroundColor: Colors.warning,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    planBadgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.textOn.warning,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: Colors.border.emphasis,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: {
        borderColor: Colors.warning,
    },
    radioDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.warning,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
    },
    planPrice: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    planCadence: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
        marginBottom: 3,
    },
    monthlyEquivalent: {
        marginTop: Spacing.xs,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.warning,
    },
    featureList: {
        gap: Spacing.sm,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    featureLabel: {
        flex: 1,
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
        lineHeight: 18,
    },
    footer: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
        backgroundColor: Colors.bg.page,
        gap: Spacing.sm,
    },
    cancelText: {
        fontSize: Typography.sizes.xs,
        lineHeight: 16,
        color: Colors.text.muted,
        textAlign: 'center',
    },
    dismissButton: {
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    dismissText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
});
