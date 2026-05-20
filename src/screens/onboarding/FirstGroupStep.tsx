import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { appAlert } from '../../components/ui/appAlert';
import { OnboardingProgressHeader } from '../../components/onboarding/OnboardingProgressHeader';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import * as api from '../../api/client';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

type FirstGroupStepProps = OnboardingStepProps;

export function FirstGroupStep({ onNext, onBack, dotIndex, dotTotal }: FirstGroupStepProps) {
    const [groups, setGroups] = useState<api.Group[]>([]);
    const [selectedGroupID, setSelectedGroupID] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async (): Promise<void> => {
            try {
                const response = await api.listGroups({ limit: 8, member_scope: 'discover' });
                if (!cancelled) setGroups(response.items);
            } catch {
                if (!cancelled) setGroups([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleContinue = async (): Promise<void> => {
        if (!selectedGroupID) return;
        setSaving(true);
        try {
            await api.joinGroup(selectedGroupID);
            await api.updateMe({ onboarding_first_group_id: selectedGroupID });
            onNext();
        } catch (error: unknown) {
            appAlert.alert('Error', error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <OnboardingProgressHeader dotIndex={dotIndex} dotTotal={dotTotal} onBack={onBack} />

            <View style={styles.header}>
                <Text style={styles.title}>Join your first group</Text>
                <Text style={styles.subtitle}>Pick a space that feels useful today. You can join more later.</Text>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
                    {groups.map((group) => {
                        const selected = selectedGroupID === group.id;
                        return (
                            <TouchableOpacity
                                key={group.id}
                                style={[styles.groupCard, selected && styles.groupCardSelected]}
                                onPress={() => setSelectedGroupID(group.id)}
                                activeOpacity={0.86}
                            >
                                <Text style={styles.groupName}>{group.name}</Text>
                                {group.description ? (
                                    <Text style={styles.groupDescription} numberOfLines={2}>{group.description}</Text>
                                ) : null}
                                <Text style={styles.groupMeta}>{group.member_count} members</Text>
                            </TouchableOpacity>
                        );
                    })}
                    {groups.length === 0 ? (
                        <Text style={styles.emptyText}>No group suggestions are available right now. Try again shortly.</Text>
                    ) : null}
                </ScrollView>
            )}

            <View style={styles.footer}>
                <PrimaryButton label="Join group" onPress={handleContinue} loading={saving} disabled={!selectedGroupID || saving} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    header: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.md,
    },
    title: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: Typography.sizes.lg,
        color: Colors.text.secondary,
        lineHeight: 22,
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        gap: Spacing.sm,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    groupCard: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    groupCardSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    groupName: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    groupDescription: {
        marginTop: Spacing.xs,
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
        lineHeight: 19,
    },
    groupMeta: {
        marginTop: Spacing.sm,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.muted,
    },
    emptyText: {
        fontSize: Typography.sizes.md,
        color: Colors.text.secondary,
        lineHeight: 22,
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
});
