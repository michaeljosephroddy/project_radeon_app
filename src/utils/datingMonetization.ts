export type PlusSource = 'likes' | 'daily_like_limit' | 'profile_preferences' | 'discover';

export interface PlusPlan {
    id: string;
    durationLabel: string;
    priceLabel: string;
    cadenceLabel: string;
    savingsLabel?: string;
    badge?: string;
}

export interface SpotlightProduct {
    id: string;
    title: string;
    durationLabel: string;
    priceLabel: string;
    unitLabel?: string;
}

export const SOBERSPACE_PLUS_PLANS: PlusPlan[] = [
    {
        id: 'soberspace_plus_weekly',
        durationLabel: '1 week',
        priceLabel: '€17.99',
        cadenceLabel: 'per week',
        savingsLabel: 'New',
    },
    {
        id: 'soberspace_plus_monthly',
        durationLabel: '1 month',
        priceLabel: '€30.99',
        cadenceLabel: 'per month',
        savingsLabel: 'Save 60%',
    },
    {
        id: 'soberspace_plus_3_month',
        durationLabel: '3 months',
        priceLabel: '€59.99',
        cadenceLabel: '€19.99 per month',
        savingsLabel: 'Save 74%',
        badge: 'Best value',
    },
    {
        id: 'soberspace_plus_6_month',
        durationLabel: '6 months',
        priceLabel: '€89.99',
        cadenceLabel: '€14.99 per month',
        savingsLabel: 'Save 81%',
    },
];

export const SOBERSPACE_PLUS_BENEFITS = [
    'Unlimited Dating likes',
    'See everyone who likes you',
    'More Dating preferences',
    'More compatible profiles each day',
    'Sort incoming likes faster',
];

export const SOBERSPACE_PLUS_DISCLAIMER = 'Unlimited Dating likes may still require you to reply to or close conversations where it is your turn. Subscriptions renew automatically for the same price and package length until cancelled through your App Store or Google Play settings. By subscribing, you agree to the SoberSpace Terms.';

export const SOBERSPACE_SPOTLIGHT_PRODUCTS: SpotlightProduct[] = [
    {
        id: 'spotlight_1',
        title: 'Spotlight',
        durationLabel: '1 hour',
        priceLabel: '€8.49',
    },
    {
        id: 'spotlight_3',
        title: '3 Spotlights',
        durationLabel: '1 hour each',
        priceLabel: '€24.99',
        unitLabel: '€8.33 each',
    },
    {
        id: 'super_spotlight_1',
        title: 'Super Spotlight',
        durationLabel: '24 hours',
        priceLabel: '€26.99',
    },
    {
        id: 'super_spotlight_2',
        title: '2 Super Spotlights',
        durationLabel: '24 hours each',
        priceLabel: '€37.99',
        unitLabel: '€18.99 each',
    },
];
