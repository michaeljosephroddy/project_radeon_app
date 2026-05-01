import { StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

const dataCardSeparator = {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
};

export const commonStyles = StyleSheet.create({
    card: {
        backgroundColor: Colors.bg.page,
        ...dataCardSeparator,
    },
    dataCard: {
        backgroundColor: Colors.bg.page,
        ...dataCardSeparator,
    },
    dataSeparator: {
        height: 1,
        backgroundColor: Colors.border.default,
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
