import { StyleSheet } from 'react-native';
import { Colors, Radii, Spacing } from '../utils/theme';

export const commonStyles = StyleSheet.create({
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
