export type PlusSource = 'likes' | 'daily_like_limit' | 'profile_preferences' | 'discover';

export interface PlusPlan {
    id: string;
    durationLabel: string;
    priceLabel: string;
    cadenceLabel: string;
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
    },
    {
        id: 'soberspace_plus_monthly',
        durationLabel: '1 month',
        priceLabel: '€30.99',
        cadenceLabel: 'per month',
    },
    {
        id: 'soberspace_plus_3_month',
        durationLabel: '3 months',
        priceLabel: '€59.99',
        cadenceLabel: '€19.99 per month',
        badge: 'Best value',
    },
    {
        id: 'soberspace_plus_6_month',
        durationLabel: '6 months',
        priceLabel: '€89.99',
        cadenceLabel: '€14.99 per month',
    },
];

export const SOBERSPACE_PLUS_BENEFITS = [
    'Unlimited Dating likes',
    'See everyone who likes you',
    'More Dating preferences',
    'More standout profiles each day',
    'Sort incoming likes faster',
];

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

