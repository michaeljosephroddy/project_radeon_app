import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { appAlert } from '../ui/appAlert';
import { PrimaryButton } from '../ui/PrimaryButton';
import {
    SOBERSPACE_PLUS_BENEFITS,
    SOBERSPACE_PLUS_DISCLAIMER,
    SOBERSPACE_PLUS_PLANS,
    SOBERSPACE_SPOTLIGHT_PRODUCTS,
    type PlusPlan,
    type PlusSource,
    type SpotlightProduct,
} from '../../utils/datingMonetization';

interface SoberSpacePlusScreenProps {
    source?: PlusSource;
    previewCount?: number;
    onBack: () => void;
}

export function SoberSpacePlusScreen({
    source = 'discover',
    previewCount = 0,
    onBack,
}: SoberSpacePlusScreenProps): React.ReactElement {
    const copy = getSourceCopy(source, previewCount);

    const handleSelectPlan = (plan: PlusPlan): void => {
        appAlert.alert(
            'Purchase setup needed',
            `${plan.durationLabel} is ready in the SoberSpace Plus catalogue. Connect the store product ${plan.id} to complete checkout.`,
        );
    };

    const handleSelectSpotlight = (product: SpotlightProduct): void => {
        appAlert.alert(
            'Purchase setup needed',
            `${product.title} is ready in the Spotlight catalogue. Connect the store product ${product.id} to complete checkout.`,
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.84} accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>SoberSpace Plus</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={styles.heroIcon}>
                        <Ionicons name="sparkles" size={26} color={Colors.textOn.warning} />
                    </View>
                    <Text style={styles.title}>{copy.title}</Text>
                    <Text style={styles.description}>{copy.description}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Plus benefits</Text>
                    <View style={styles.benefitsList}>
                        {SOBERSPACE_PLUS_BENEFITS.map((benefit) => (
                            <View key={benefit} style={styles.benefitRow}>
                                <View style={styles.checkIcon}>
                                    <Ionicons name="checkmark" size={16} color={Colors.textOn.primary} />
                                </View>
                                <Text style={styles.benefitText}>{benefit}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Choose a plan</Text>
                    <View style={styles.planGrid}>
                        {SOBERSPACE_PLUS_PLANS.map((plan) => (
                            <TouchableOpacity key={plan.id} style={styles.planCard} onPress={() => handleSelectPlan(plan)} activeOpacity={0.86}>
                                <View style={styles.planBadgeRow}>
                                    {plan.savingsLabel ? (
                                        <View style={styles.planSavingsBadge}>
                                            <Text style={styles.planSavingsText}>{plan.savingsLabel}</Text>
                                        </View>
                                    ) : null}
                                    {plan.badge ? (
                                        <View style={styles.planBadge}>
                                            <Text style={styles.planBadgeText}>{plan.badge}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                <Text style={styles.planDuration}>{plan.durationLabel}</Text>
                                <Text style={styles.planPrice}>{plan.priceLabel}</Text>
                                <Text style={styles.planCadence}>{plan.cadenceLabel}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.disclaimer}>{SOBERSPACE_PLUS_DISCLAIMER}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Spotlights</Text>
                    <Text style={styles.sectionDescription}>One-off boosts for busier Dating moments.</Text>
                    <View style={styles.spotlightList}>
                        {SOBERSPACE_SPOTLIGHT_PRODUCTS.map((product) => (
                            <TouchableOpacity key={product.id} style={styles.spotlightRow} onPress={() => handleSelectSpotlight(product)} activeOpacity={0.86}>
                                <View style={styles.spotlightIcon}>
                                    <Ionicons name={product.id.startsWith('super') ? 'flash' : 'radio'} size={20} color={Colors.primary} />
                                </View>
                                <View style={styles.spotlightCopy}>
                                    <Text style={styles.spotlightTitle}>{product.title}</Text>
                                    <Text style={styles.spotlightMeta}>{product.durationLabel}</Text>
                                </View>
                                <View style={styles.spotlightPriceWrap}>
                                    <Text style={styles.spotlightPrice}>{product.priceLabel}</Text>
                                    {product.unitLabel ? <Text style={styles.spotlightUnit}>{product.unitLabel}</Text> : null}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <PrimaryButton
                    label="Continue with Plus"
                    onPress={() => handleSelectPlan(SOBERSPACE_PLUS_PLANS[2])}
                    style={styles.primaryAction}
                    leftAdornment={<Ionicons name="sparkles" size={18} color={Colors.textOn.primary} />}
                />
            </ScrollView>
        </View>
    );
}

function getSourceCopy(source: PlusSource, previewCount: number): { title: string; description: string } {
    if (source === 'daily_like_limit') {
        return {
            title: 'Keep liking with Plus',
            description: 'You have reached today\'s free Dating like limit. Plus unlocks unlimited likes and deeper preferences.',
        };
    }
    if (source === 'likes') {
        return {
            title: previewCount > 0 ? `${previewCount} people liked you` : 'See who likes you',
            description: 'Open your incoming likes, match from one place, and sort attention faster with SoberSpace Plus.',
        };
    }
    if (source === 'profile_preferences') {
        return {
            title: 'Unlock more preferences',
            description: 'Filter for more compatibility signals while keeping the sober-first experience calm and focused.',
        };
    }
    return {
        title: 'Date with more control',
        description: 'Plus adds unlimited likes, incoming likes, richer preferences, and Spotlight options for Dating.',
    };
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    header: {
        minHeight: 56,
        paddingHorizontal: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border.subtle,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.surface,
    },
    headerTitle: {
        ...TextStyles.screenTitle,
    },
    headerSpacer: {
        width: 44,
    },
    content: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.xxl,
        gap: Spacing.xl,
    },
    hero: {
        alignItems: 'center',
        gap: Spacing.md,
    },
    heroIcon: {
        width: 58,
        height: 58,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.warning,
    },
    title: {
        ...TextStyles.displayTitle,
        textAlign: 'center',
    },
    description: {
        ...TextStyles.secondary,
        textAlign: 'center',
        maxWidth: 330,
    },
    section: {
        gap: Spacing.md,
    },
    sectionTitle: {
        ...TextStyles.sectionTitle,
        color: Colors.text.primary,
    },
    sectionDescription: {
        ...TextStyles.secondary,
    },
    benefitsList: {
        gap: Spacing.sm,
    },
    benefitRow: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
    },
    checkIcon: {
        width: 24,
        height: 24,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
    },
    benefitText: {
        ...TextStyles.bodyEmphasis,
        flex: 1,
    },
    planGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    planCard: {
        width: '47.8%',
        minHeight: 148,
        padding: Spacing.md,
        paddingTop: 48,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        justifyContent: 'flex-end',
        gap: Spacing.xs,
    },
    planBadgeRow: {
        position: 'absolute',
        top: Spacing.sm,
        left: Spacing.sm,
        right: Spacing.sm,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    planSavingsBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
    },
    planSavingsText: {
        ...TextStyles.badge,
        color: Colors.primary,
    },
    planBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.warningSubtle,
    },
    planBadgeText: {
        ...TextStyles.caption,
        color: Colors.warning,
        fontWeight: '800',
    },
    planDuration: {
        ...TextStyles.cardTitle,
    },
    planPrice: {
        fontSize: Typography.sizes.xl,
        lineHeight: 27,
        fontWeight: Typography.weights.bold,
        color: Colors.text.primary,
    },
    planCadence: {
        ...TextStyles.caption,
    },
    disclaimer: {
        ...TextStyles.caption,
        color: Colors.text.muted,
        lineHeight: 18,
    },
    spotlightList: {
        gap: Spacing.sm,
    },
    spotlightRow: {
        minHeight: 68,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
    },
    spotlightIcon: {
        width: 38,
        height: 38,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
    },
    spotlightCopy: {
        flex: 1,
        gap: 2,
    },
    spotlightTitle: {
        ...TextStyles.bodyEmphasis,
    },
    spotlightMeta: {
        ...TextStyles.caption,
    },
    spotlightPriceWrap: {
        alignItems: 'flex-end',
        gap: 2,
    },
    spotlightPrice: {
        ...TextStyles.bodyEmphasis,
    },
    spotlightUnit: {
        ...TextStyles.caption,
    },
    primaryAction: {
        marginTop: Spacing.sm,
    },
});
