import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../theme';

export const commonStyles = StyleSheet.create({
    card: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
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
