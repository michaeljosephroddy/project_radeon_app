import { StyleSheet } from 'react-native';
import { Colors, Composer, Radius, Spacing, TextStyles } from '../theme';

export const composerStandards = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
        paddingHorizontal: Composer.rowHorizontal,
        paddingTop: Composer.rowVertical,
        paddingBottom: Composer.rowVertical,
        borderTopWidth: 0.5,
        borderTopColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
    },
    input: {
        flex: 1,
        minHeight: Composer.minHeight,
        maxHeight: Composer.maxHeight,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
        borderWidth: 0.5,
        borderColor: Colors.border.default,
        ...TextStyles.input,
        paddingHorizontal: Composer.inputHorizontal,
        paddingTop: Composer.inputVertical,
        paddingBottom: Composer.inputVertical,
        textAlignVertical: 'top',
    },
    sendButton: {
        width: Composer.sendButtonSize,
        height: Composer.sendButtonSize,
        borderRadius: Radius.pill,
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
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.page,
        borderWidth: 0.5,
        borderColor: Colors.border.default,
    },
    actionButton: {
        minHeight: Composer.sendButtonSize,
        borderRadius: Radius.md,
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
        ...TextStyles.button,
    },
    disabled: {
        opacity: 0.6,
    },
});
