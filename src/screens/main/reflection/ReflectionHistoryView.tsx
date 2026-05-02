import React from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../../../api/client';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { formatSobrietyDate } from '../../../utils/date';
import { reflectionViewStyles } from './styles';
import type { GroupedReflections } from './utils';

interface ReflectionHistoryViewProps {
    groupedHistory: GroupedReflections[];
    isLoading: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
    onFetchNextPage: () => void;
    onOpenReflection: (reflection: api.DailyReflection) => void;
}

export function ReflectionHistoryView({
    groupedHistory,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    onFetchNextPage,
    onOpenReflection,
}: ReflectionHistoryViewProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const isEmpty = groupedHistory.every(group => group.items.length === 0);

    return (
        <ScrollView
            style={reflectionViewStyles.scroll}
            contentContainerStyle={[
                styles.content,
                { paddingBottom: Spacing.xl + insets.bottom },
            ]}
        >
            {isLoading ? (
                <View style={styles.loading}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : null}
            {!isLoading && isEmpty ? (
                <View style={styles.emptyState}>
                    <Ionicons name="journal-outline" size={28} color={Colors.text.muted} />
                    <Text style={styles.emptyTitle}>No reflections yet</Text>
                </View>
            ) : null}
            {groupedHistory.map(group => (
                <View key={group.monthKey} style={styles.group}>
                    <Text style={styles.monthLabel}>{group.monthLabel}</Text>
                    {group.items.map(reflection => (
                        <TouchableOpacity
                            key={reflection.id}
                            style={styles.item}
                            activeOpacity={0.82}
                            onPress={() => onOpenReflection(reflection)}
                        >
                            <View style={styles.itemHead}>
                                <Text style={styles.itemDate}>
                                    {formatSobrietyDate(reflection.reflection_date)}
                                </Text>
                                {reflection.shared_post_id ? (
                                    <View style={styles.inlinePill}>
                                        <Text style={styles.inlinePillText}>Shared</Text>
                                    </View>
                                ) : null}
                            </View>
                            <Text style={styles.itemBody} numberOfLines={3}>
                                {reflection.body}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ))}
            {hasNextPage ? (
                <TouchableOpacity
                    style={styles.loadMore}
                    onPress={onFetchNextPage}
                    disabled={isFetchingNextPage}
                >
                    {isFetchingNextPage ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                        <Text style={styles.loadMoreText}>Load more</Text>
                    )}
                </TouchableOpacity>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        gap: Spacing.xl,
    },
    loading: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 72,
        gap: Spacing.sm,
    },
    emptyTitle: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.text.muted,
    },
    group: {
        gap: Spacing.sm,
    },
    monthLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.muted,
        paddingHorizontal: 2,
    },
    item: {
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        marginHorizontal: -Spacing.md,
        gap: Spacing.sm,
    },
    itemHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    itemDate: {
        flex: 1,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    inlinePill: {
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        backgroundColor: Colors.successSubtle,
    },
    inlinePillText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    itemBody: {
        fontSize: Typography.sizes.base,
        lineHeight: 20,
        color: Colors.text.secondary,
    },
    loadMore: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
    },
    loadMoreText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
});
