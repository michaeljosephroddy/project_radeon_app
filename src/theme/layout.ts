export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const Radius  = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 };

export const IconSizes = {
    badge: 12,
    inline: 16,
    row: 18,
    tool: 20,
    header: 24,
    hero: 28,
    primaryAction: 30,
    brand: 52,
};

export const Header = {
    paddingVertical: 6,
    iconSize: IconSizes.header,
    sideWidth: 44,
};

export const ControlHeights = {
    compact: 36,
    default: 44,
    large: 48,
    icon: 40,
    iconLarge: 44,
};

export const ControlSizes = {
    chipMinHeight: ControlHeights.compact,
    segmentMinHeight: ControlHeights.compact + Spacing.xs,
    buttonMinHeight: ControlHeights.default,
    inputMinHeight: ControlHeights.default,
    iconButton: ControlHeights.icon,
    iconButtonLarge: ControlHeights.iconLarge,
    fabMinHeight: ControlHeights.large,
    listRowMinHeight: 52,
};

export const TargetSizes = {
    compact: ControlHeights.compact,
    minimum: ControlHeights.default,
    comfortable: ControlHeights.large,
};

export const AvatarSizes = {
    stack: 22,
    tiny: 30,
    mini: 32,
    comment: 34,
    compact: 36,
    medium: 40,
    list: 44,
    feature: 58,
    hero: 88,
    profilePhoto: 112,
    onboarding: 120,
};

export const ContentInsets = {
    screenHorizontal: Spacing.md,
    authHorizontal: Spacing.xl,
    listBottom: 32,
    detailBottom: 40,
};

export const Composer = {
    minHeight: ControlHeights.default,
    maxHeight: 120,
    rowHorizontal: Spacing.sm,
    rowVertical: Spacing.sm,
    inputHorizontal: Spacing.md,
    inputVertical: Spacing.sm,
    sendButtonSize: ControlHeights.icon,
    iconButtonSize: ControlHeights.icon,
};
