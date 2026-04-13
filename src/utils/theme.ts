export const Colors = {
    primary: '#7F77DD',
    primaryLight: '#EEEDFE',
    primaryDark: '#3C3489',
    primaryMid: '#534AB7',
    primarySubtle: '#CECBF6',

    // Avatar palette from design
    avatarGreen: { bg: '#E1F5EE', text: '#085041' },
    avatarAmber: { bg: '#FAEEDA', text: '#633806' },
    avatarCoral: { bg: '#FAECE7', text: '#712B13' },
    avatarPurple: { bg: '#EEEDFE', text: '#3C3489' },

    light: {
        background: '#FFFFFF',
        backgroundSecondary: '#F5F4F0',
        textPrimary: '#1A1A1A',
        textSecondary: '#4A4A4A',
        textTertiary: '#9A9A9A',
        border: '#E8E8E4',
        borderSecondary: '#D0CFC9',
    },

    dark: {
        background: '#0F0F0F',
        backgroundSecondary: '#1A1A1A',
        textPrimary: '#F0F0F0',
        textSecondary: '#B0B0B0',
        textTertiary: '#666666',
        border: '#2A2A2A',
        borderSecondary: '#333333',
    },
};

export const Typography = {
    // Using system fonts that feel native and clean
    sizes: {
        xs: 10,
        sm: 11,
        base: 12,
        md: 13,
        lg: 15,
        xl: 17,
        xxl: 22,
        xxxl: 28,
    },
    weights: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
    },
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
};

export const Radii = {
    sm: 8,
    md: 12,
    lg: 14,
    xl: 20,
    full: 9999,
};

// Avatar colour cycling based on name
export function getAvatarColors(name: string) {
    const palettes = [
        Colors.avatarPurple,
        Colors.avatarGreen,
        Colors.avatarAmber,
        Colors.avatarCoral,
    ];
    const idx = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % palettes.length;
    return palettes[idx];
}

export function getInitials(firstName: string, lastName: string) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
