import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../theme';

// Styles shared across the reflection editor, review, and detail views — the
// pieces that frame each view's content (layout container, hero block, action
// dock, and dock buttons). View-specific styles live in their own file.
export const reflectionViewStyles = StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    hero: {
        gap: Spacing.sm,
    },
    dateLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
    prompt: {
        fontSize: Typography.sizes.xxl,
        lineHeight: 29,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    actionDock: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderTopWidth: 0.5,
        borderTopColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        gap: Spacing.sm,
    },
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    primaryButton: {
        flex: 1.3,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
        backgroundColor: Colors.primary,
    },
    primaryButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    secondaryButton: {
        flex: 1,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
    },
    secondaryButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.primary,
    },
    iconTextButton: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
    },
    deleteText: {
        color: Colors.danger,
    },
    buttonDisabled: {
        opacity: 0.45,
    },
});
