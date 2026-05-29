export interface LegalLink {
    label: string;
    url: string;
}

export const LEGAL_LINKS = {
    terms: {
        label: 'Terms of Use',
        url: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://soberspace.app/terms',
    },
    privacy: {
        label: 'Privacy Policy',
        url: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://soberspace.app/privacy',
    },
    guidelines: {
        label: 'Community Guidelines',
        url: process.env.EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL ?? 'https://soberspace.app/community-guidelines',
    },
    support: {
        label: 'Contact Support',
        url: process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://soberspace.app/support',
    },
} satisfies Record<string, LegalLink>;
