import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { appAlert } from '../../components/ui/appAlert';
import { Avatar } from '../../components/Avatar';
import { OnboardingProgressHeader } from '../../components/onboarding/OnboardingProgressHeader';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import * as api from '../../api/client';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

type FirstFriendStepProps = OnboardingStepProps;

export function FirstFriendStep({ onNext, onBack, dotIndex, dotTotal }: FirstFriendStepProps) {
    const [people, setPeople] = useState<api.User[]>([]);
    const [selectedUserID, setSelectedUserID] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async (): Promise<void> => {
            try {
                const response = await api.discoverUsers({ limit: 8, intent: 'friends' });
                if (!cancelled) setPeople(response.items);
            } catch {
                if (!cancelled) setPeople([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleContinue = async (): Promise<void> => {
        if (!selectedUserID) return;
        setSaving(true);
        try {
            await api.sendFriendRequest(selectedUserID);
            await api.updateMe({ onboarding_first_friend_user_id: selectedUserID });
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
                <Text style={styles.title}>Add your first friend</Text>
                <Text style={styles.subtitle}>Choose someone to connect with so your community starts taking shape.</Text>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
                    {people.map((person) => {
                        const selected = selectedUserID === person.id;
                        return (
                            <TouchableOpacity
                                key={person.id}
                                style={[styles.personRow, selected && styles.personRowSelected]}
                                onPress={() => setSelectedUserID(person.id)}
                                activeOpacity={0.86}
                            >
                                {person.avatar_url ? (
                                    <Image source={{ uri: person.avatar_url }} style={styles.avatarImage} />
                                ) : (
                                    <Avatar username={person.username} size={48} fontSize={16} />
                                )}
                                <View style={styles.personBody}>
                                    <Text style={styles.personName}>@{person.username}</Text>
                                    <Text style={styles.personMeta}>{[person.city, person.country].filter(Boolean).join(', ') || 'SoberSpace member'}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    {people.length === 0 ? (
                        <Text style={styles.emptyText}>No friend suggestions are available right now. Try again shortly.</Text>
                    ) : null}
                </ScrollView>
            )}

            <View style={styles.footer}>
                <PrimaryButton label="Send request" onPress={handleContinue} loading={saving} disabled={!selectedUserID || saving} />
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
    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    personRowSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    avatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    personBody: { flex: 1 },
    personName: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    personMeta: {
        marginTop: Spacing.xs,
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
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
