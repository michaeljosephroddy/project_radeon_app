import { appAlert } from '@/components/ui/appAlert';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { OnboardingProgressHeader } from '../../components/onboarding/OnboardingProgressHeader';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../api/client';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';
import { CONNECTION_INTENT_OPTIONS, normalizeConnectionIntents } from '../../utils/connectionIntents';

type IntentStepProps = OnboardingStepProps;

export function IntentStep({ onNext, onBack, dotIndex, dotTotal }: IntentStepProps) {
    const { user, refreshUser } = useAuth();
    const [selected, setSelected] = useState<api.ConnectionIntent[]>(normalizeConnectionIntents(user?.connection_intents));
    const [saving, setSaving] = useState(false);

    const toggleIntent = (intent: api.ConnectionIntent): void => {
        if (intent === 'friends') return;

        setSelected((current) => {
            const isSelected = current.includes(intent);
            return isSelected
                ? ['friends']
                : ['friends', intent];
        });
    };

    const handleContinue = async (): Promise<void> => {
        setSaving(true);
        try {
            await api.updateMe({ connection_intents: selected });
            await refreshUser();
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
                <Text style={styles.title}>Why are you here?</Text>
                <Text style={styles.subtitle}>
                    SoberSpace is recovery-first. Choose how you want to connect. You can change this anytime in Settings.
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.options} keyboardShouldPersistTaps="handled">
                {CONNECTION_INTENT_OPTIONS.map((option) => {
                    const isSelected = selected.includes(option.value);
                    return (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.option,
                                isSelected && styles.optionActive,
                                option.value === 'friends' && styles.optionLocked,
                            ]}
                            onPress={() => toggleIntent(option.value)}
                            disabled={option.value === 'friends'}
                            activeOpacity={0.86}
                        >
                            <Text style={[styles.optionTitle, isSelected && styles.optionTitleActive]}>{option.label}</Text>
                            <Text style={[styles.optionDescription, isSelected && styles.optionDescriptionActive]}>
                                {option.description}
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
    container: { flex: 1, backgroundColor: Colors.bg.page },
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
        backgroundColor: Colors.border.default,
    },
    dotActive: { backgroundColor: Colors.primary },
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
    options: {
        gap: Spacing.md,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    option: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.lg,
    },
    optionActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    optionLocked: {
        opacity: 0.82,
    },
    optionTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    optionTitleActive: {
        color: Colors.primary,
    },
    optionDescription: {
        marginTop: Spacing.xs,
        fontSize: Typography.sizes.sm,
        lineHeight: 18,
        color: Colors.text.secondary,
    },
    optionDescriptionActive: {
        color: Colors.text.primary,
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
    },
});
