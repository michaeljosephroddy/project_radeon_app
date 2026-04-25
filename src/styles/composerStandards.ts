import { StyleSheet } from 'react-native';
import { Colors, Composer, Radii, Spacing, Typography } from '../utils/theme';

export const composerStandards = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
        paddingHorizontal: Composer.rowHorizontal,
        paddingTop: Composer.rowVertical,
        paddingBottom: Composer.rowVertical,
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        backgroundColor: Colors.light.background,
    },
    input: {
        flex: 1,
        minHeight: Composer.minHeight,
        maxHeight: Composer.maxHeight,
        borderRadius: Radii.pill,
        backgroundColor: Colors.light.backgroundSecondary,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        color: Colors.light.textPrimary,
        fontSize: Typography.body.fontSize,
        lineHeight: 20,
        paddingHorizontal: Composer.inputHorizontal,
        paddingTop: Composer.inputVertical,
        paddingBottom: Composer.inputVertical,
        textAlignVertical: 'top',
    },
    sendButton: {
        width: Composer.sendButtonSize,
        height: Composer.sendButtonSize,
        borderRadius: Radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
    },
    sendButtonDisabled: {
        backgroundColor: Colors.secondary,
    },
    iconButton: {
        width: Composer.iconButtonSize,
        height: Composer.iconButtonSize,
        borderRadius: Radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.background,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
    },
    actionButton: {
        minHeight: Composer.sendButtonSize,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonPrimary: {
        backgroundColor: Colors.primary,
    },
    actionButtonSuccess: {
        backgroundColor: Colors.success,
    },
    actionButtonText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    disabled: {
        opacity: 0.6,
    },
});
