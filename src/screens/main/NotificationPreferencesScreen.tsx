import { appAlert } from '@/components/ui/appAlert';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../../api/client';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { queryKeys } from '../../query/queryKeys';
import { screenStandards } from '../../styles/screenStandards';
import { Colors, Radius, Spacing, Typography } from '../../theme';

type NotificationPreferenceKey = keyof api.NotificationPreferences;

interface NotificationPreferencesScreenProps {
    onBack: () => void;
}

interface PreferenceRow {
    key: NotificationPreferenceKey;
    label: string;
    description: string;
}

interface UpdateVariables {
    key: NotificationPreferenceKey;
    input: Partial<api.NotificationPreferences>;
}

interface UpdateContext {
    previous?: api.NotificationPreferences;
}

const PREFERENCE_ROWS: PreferenceRow[] = [
    {
        key: 'chat_messages',
        label: 'Chat messages',
        description: 'Receive notifications when someone sends you a direct or group message.',
    },
    {
        key: 'comment_mentions',
        label: 'Comment mentions',
        description: 'Receive notifications when someone mentions you in a comment.',
    },
    {
        key: 'reach_out_alerts',
        label: 'Reach Out alerts',
        description: 'Receive alerts when a friend asks for immediate sober support.',
    },
    {
        key: 'reach_out_helper_alerts',
        label: 'Helper alerts',
        description: 'Opt in to Reach Out alerts from people who are not already friends.',
    },
];

const SWITCH_TRACK_COLORS = {
    false: Colors.border.default,
    true: Colors.primarySubtle,
};

export function NotificationPreferencesScreen({ onBack }: NotificationPreferencesScreenProps) {
    const queryClient = useQueryClient();
    const queryKey = queryKeys.notificationPreferences();
    const [pendingKeys, setPendingKeys] = useState<Set<NotificationPreferenceKey>>(new Set());

    const preferencesQuery = useQuery({
        queryKey,
        queryFn: api.getNotificationPreferences,
    });

    const updateMutation = useMutation<api.NotificationPreferences, Error, UpdateVariables, UpdateContext>({
        mutationFn: ({ input }) => api.updateNotificationPreferences(input),
        onMutate: async ({ input }): Promise<UpdateContext> => {
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<api.NotificationPreferences>(queryKey);
            queryClient.setQueryData<api.NotificationPreferences>(queryKey, (current) => ({
                chat_messages: current?.chat_messages ?? true,
                comment_mentions: current?.comment_mentions ?? true,
                reach_out_alerts: current?.reach_out_alerts ?? true,
                reach_out_helper_alerts: current?.reach_out_helper_alerts ?? false,
                ...input,
            }));
            return { previous };
        },
        onError: (error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKey, context.previous);
            }
            appAlert.alert('Could not update notifications', error.message || 'Please try again.');
        },
        onSuccess: (updated) => {
            queryClient.setQueryData(queryKey, updated);
        },
        onSettled: (_data, _error, variables) => {
            setPendingKeys((current) => {
                const next = new Set(current);
                next.delete(variables.key);
                return next;
            });
        },
    });

    const handleToggle = useCallback((key: NotificationPreferenceKey, value: boolean): void => {
        if (pendingKeys.has(key)) return;

        setPendingKeys((current) => new Set(current).add(key));
        updateMutation.mutate({
            key,
            input: { [key]: value },
        });
    }, [pendingKeys, updateMutation]);

    if (preferencesQuery.isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <ScreenHeader onBack={onBack} title="Notifications" />
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (preferencesQuery.isError || !preferencesQuery.data) {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <ScreenHeader onBack={onBack} title="Notifications" />
                <View style={styles.center}>
                    <Text style={styles.errorText}>Could not load notification preferences.</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => preferencesQuery.refetch()}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader onBack={onBack} title="Notifications" />
            <ScrollView style={styles.scroll} contentContainerStyle={screenStandards.detailContent}>
                <View style={screenStandards.sectionLabelBlockTight}>
                    <SectionLabel>PREFERENCES</SectionLabel>
                </View>
                <View style={styles.group}>
                    {PREFERENCE_ROWS.map((row, index) => {
                        const enabled = preferencesQuery.data[row.key];
                        const isPending = pendingKeys.has(row.key);
                        return (
                            <View key={row.key}>
                                {index > 0 ? <View style={styles.divider} /> : null}
                                <View style={styles.row}>
                                    <View style={styles.rowCopy}>
                                        <Text style={styles.rowText}>{row.label}</Text>
                                        <Text style={styles.rowDescription}>{row.description}</Text>
                                    </View>
                                    <Switch
                                        value={enabled}
                                        onValueChange={(nextValue) => handleToggle(row.key, nextValue)}
                                        disabled={isPending}
                                        trackColor={SWITCH_TRACK_COLORS}
                                        thumbColor={enabled ? Colors.primary : Colors.bg.surface}
                                        ios_backgroundColor={Colors.border.default}
                                    />
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    scroll: { flex: 1 },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    errorText: {
        fontSize: Typography.sizes.base,
        color: Colors.text.secondary,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    retryButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
    group: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.lg,
        overflow: 'hidden',
    },
    row: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    rowCopy: {
        flex: 1,
        minWidth: 0,
    },
    rowText: {
        fontSize: Typography.sizes.base,
        color: Colors.text.primary,
        fontWeight: '600',
    },
    rowDescription: {
        marginTop: Spacing.xs,
        fontSize: Typography.sizes.sm,
        lineHeight: 18,
        color: Colors.text.secondary,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.border.default,
    },
});
