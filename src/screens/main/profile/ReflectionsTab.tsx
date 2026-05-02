import React, { useMemo } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../../api/client';
import { ProfileEmptyTabState } from '../../../components/profile/ProfileEmptyTabState';
import { useReflectionHistory } from '../../../hooks/queries/useReflections';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { formatSobrietyDate } from '../../../utils/date';
import { getReflectionAnswerEntries } from '../../../utils/reflections';

interface ReflectionsTabProps {
    isActive: boolean;
    username: string;
    onOpenReflection: (reflectionId: string) => void;
}

export function ReflectionsTab({
    isActive,
    username,
    onOpenReflection,
}: ReflectionsTabProps): React.ReactElement {
    const reflectionsQuery = useReflectionHistory(20, isActive);
    const reflections = useMemo(
        () => (reflectionsQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [reflectionsQuery.data?.pages],
    );

    if (reflectionsQuery.isLoading) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    if (reflections.length === 0) {
        return <ProfileEmptyTabState tab="reflections" username={username} />;
    }

    return (
        <View style={styles.container}>
            {reflections.map((reflection) => (
                <ReflectionRow
                    key={reflection.id}
                    reflection={reflection}
                    onOpenReflection={onOpenReflection}
                />
            ))}
            {reflectionsQuery.hasNextPage ? (
                <TouchableOpacity
                    style={styles.loadMore}
                    onPress={() => reflectionsQuery.fetchNextPage()}
                    disabled={reflectionsQuery.isFetchingNextPage}
                    accessibilityRole="button"
                    accessibilityLabel="Load more reflections"
                >
                    {reflectionsQuery.isFetchingNextPage ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                        <Text style={styles.loadMoreText}>Load more</Text>
                    )}
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

interface ReflectionRowProps {
    reflection: api.DailyReflection;
    onOpenReflection: (reflectionId: string) => void;
}

function ReflectionRow({
    reflection,
    onOpenReflection,
}: ReflectionRowProps): React.ReactElement {
    const preview = getReflectionPreview(reflection);

    return (
        <TouchableOpacity
            style={styles.row}
            onPress={() => onOpenReflection(reflection.id)}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`Open reflection from ${formatSobrietyDate(reflection.reflection_date)}`}
        >
            <View style={styles.rowHeader}>
                <Text style={styles.date}>{formatSobrietyDate(reflection.reflection_date)}</Text>
            </View>
            <Text style={styles.question} numberOfLines={1}>
                {preview.question}
            </Text>
            <Text style={styles.answer} numberOfLines={2}>
                {preview.answer}
            </Text>
            <View style={styles.metaRow}>
                <Ionicons name="lock-closed-outline" size={12} color={Colors.text.muted} />
                <Text style={styles.meta}>Private reflection</Text>
            </View>
        </TouchableOpacity>
    );
}

interface ReflectionPreview {
    question: string;
    answer: string;
}

function getReflectionPreview(reflection: api.DailyReflection): ReflectionPreview {
    const entries = getReflectionAnswerEntries(reflection);
    const firstAnswered = entries.find(entry => entry.answer.trim().length > 0);
    if (firstAnswered) {
        return {
            question: firstAnswered.question,
            answer: firstAnswered.answer.trim(),
        };
    }
    return {
        question: reflection.prompt_text ?? 'Daily reflection',
        answer: reflection.body,
    };
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: -Spacing.md,
        marginBottom: Spacing.md,
    },
    loader: {
        paddingVertical: Spacing.xl,
    },
    row: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
        gap: Spacing.xs,
        backgroundColor: Colors.bg.page,
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    date: {
        flex: 1,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
    question: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    answer: {
        fontSize: Typography.sizes.base,
        lineHeight: 20,
        color: Colors.text.secondary,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    meta: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
        fontWeight: '600',
    },
    loadMore: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: Spacing.md,
        marginTop: Spacing.md,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
    },
    loadMoreText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
});
