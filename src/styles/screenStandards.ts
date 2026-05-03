import { StyleSheet } from 'react-native';
import { ContentInsets, Spacing, TextStyles } from '../theme';

export const screenStandards = StyleSheet.create({
    tabControl: {
        paddingHorizontal: ContentInsets.screenHorizontal,
        marginTop: Spacing.xs,
    },
    listContent: {
        padding: ContentInsets.screenHorizontal,
        paddingBottom: ContentInsets.listBottom,
    },
    detailContent: {
        padding: ContentInsets.screenHorizontal,
        paddingBottom: ContentInsets.detailBottom,
    },
    sheetContent: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.lg,
    },
    scrollContent: {
        flexGrow: 1,
        paddingTop: Spacing.md,
    },
    authContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: ContentInsets.authHorizontal,
    },
    authFooter: {
        paddingHorizontal: ContentInsets.authHorizontal,
        paddingBottom: Spacing.lg,
    },
    wideHorizontal: {
        paddingHorizontal: ContentInsets.authHorizontal,
    },
    sectionLabelText: {
        ...TextStyles.caption,
        textTransform: 'uppercase',
    },
    sectionLabelBlock: {
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    sectionLabelBlockTight: {
        marginBottom: Spacing.sm,
    },
});
