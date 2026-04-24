import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useAuth } from '../../hooks/useAuth';
import { useInterests } from '../../hooks/queries/useInterests';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

const MAX_INTERESTS = 5;

type InterestsStepProps = OnboardingStepProps;

export function InterestsStep({ onNext, dotIndex, dotTotal }: InterestsStepProps) {
    const { user, refreshUser } = useAuth();
    const interestsQuery = useInterests(true);
    const availableInterests = interestsQuery.data ?? [];
    const [selected, setSelected] = useState<string[]>(user?.interests ?? []);
    const [saving, setSaving] = useState(false);

    const toggleInterest = (interest: string) => {
        const isSelected = selected.includes(interest);
        if (!isSelected && selected.length >= MAX_INTERESTS) {
            Alert.alert('Limit reached', `You can pick up to ${MAX_INTERESTS} interests.`);
            return;
        }
        setSelected(current =>
            isSelected
                ? current.filter(i => i !== interest)
                : [...current, interest].sort((a, b) => a.localeCompare(b))
        );
    };

    const handleContinue = async () => {
        setSaving(true);
        try {
            await api.updateMe({ interests: selected });
            await refreshUser();
            onNext();
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.topBar}>
                <View style={styles.dots}>
                    {Array.from({ length: dotTotal }).map((_, i) => (
                        <View key={i} style={[styles.dot, i === dotIndex && styles.dotActive]} />
                    ))}
                </View>
            </View>

            <View style={styles.header}>
                <Text style={styles.title}>What are you into?</Text>
                <Text style={styles.subtitle}>
                    Pick up to {MAX_INTERESTS} interests to personalise your experience.
                </Text>
                <Text style={styles.counter}>
                    {selected.length}/{MAX_INTERESTS} selected
                </Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.chipsWrap}
                keyboardShouldPersistTaps="handled"
            >
                {availableInterests.map(interest => {
                    const isSelected = selected.includes(interest);
                    return (
                        <TouchableOpacity
                            key={interest}
                            style={[styles.chip, isSelected && styles.chipActive]}
                            onPress={() => toggleInterest(interest)}
                        >
                            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                                {interest}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                <PrimaryButton label="Continue" onPress={handleContinue} loading={saving} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    topBar: {
        alignItems: 'center',
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    dots: { flexDirection: 'row', gap: Spacing.sm },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.light.border,
    },
    dotActive: { backgroundColor: Colors.primary },
    header: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.md,
    },
    title: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: Typography.sizes.lg,
        color: Colors.light.textSecondary,
        lineHeight: 22,
        marginBottom: Spacing.sm,
    },
    counter: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    chipsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    chip: {
        borderRadius: Radii.pill,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.backgroundSecondary,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    chipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        fontSize: Typography.sizes.md,
        color: Colors.light.textSecondary,
        fontWeight: '500',
    },
    chipTextActive: {
        color: Colors.textOn.primary,
        fontWeight: '600',
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
});
