import { StyleSheet } from 'react-native';
import { Colors, Radii, Spacing } from '../utils/theme';

export const commonStyles = StyleSheet.create({
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centeredOnPage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.background,
    },
    card: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: Spacing.lg,
    },
    emptyStateCompact: {
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: Spacing.lg,
    },
});
