import { StyleSheet } from 'react-native';
import { ContentInsets, Spacing, Typography } from '../utils/theme';

export const screenStandards = StyleSheet.create({
    listContent: {
        padding: ContentInsets.screenHorizontal,
        paddingBottom: ContentInsets.listBottom,
    },
    detailContent: {
        padding: ContentInsets.screenHorizontal,
        paddingBottom: ContentInsets.detailBottom,
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
        ...Typography.sectionLabel,
    },
    sectionLabelBlock: {
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    sectionLabelBlockTight: {
        marginBottom: Spacing.sm,
    },
});
