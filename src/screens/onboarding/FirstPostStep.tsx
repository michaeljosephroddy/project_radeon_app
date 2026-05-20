import React, { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { appAlert } from '../../components/ui/appAlert';
import { OnboardingProgressHeader } from '../../components/onboarding/OnboardingProgressHeader';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import * as api from '../../api/client';
import { Colors, Spacing, Typography } from '../../theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

const MIN_POST_LENGTH = 8;
const MAX_POST_LENGTH = 500;

type FirstPostStepProps = OnboardingStepProps;

export function FirstPostStep({ onNext, onBack, dotIndex, dotTotal }: FirstPostStepProps) {
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const trimmedBody = body.trim();
    const canContinue = trimmedBody.length >= MIN_POST_LENGTH && trimmedBody.length <= MAX_POST_LENGTH;

    const handleContinue = async (): Promise<void> => {
        if (!canContinue) return;
        Keyboard.dismiss();
        setSaving(true);
        try {
            const post = await api.createPost({ body: trimmedBody });
            await api.updateMe({ onboarding_first_post_id: post.id });
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

            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.title}>Make your first post</Text>
                    <Text style={styles.subtitle}>
                        Share a quick check-in, a goal for today, or what brought you here.
                    </Text>
                    <TextField
                        style={styles.input}
                        placeholder="Today I am checking in because..."
                        placeholderTextColor={Colors.text.muted}
                        multiline
                        maxLength={MAX_POST_LENGTH}
                        value={body}
                        onChangeText={setBody}
                    />
                    <Text style={[styles.count, body.length > MAX_POST_LENGTH && styles.countOver]}>
                        {body.length}/{MAX_POST_LENGTH}
                    </Text>
                </ScrollView>

                <View style={styles.footer}>
                    <PrimaryButton label="Post check-in" onPress={handleContinue} loading={saving} disabled={!canContinue || saving} />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    flex: { flex: 1 },
    content: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
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
        marginBottom: Spacing.xl,
    },
    input: {
        minHeight: 160,
        textAlignVertical: 'top',
    },
    count: {
        alignSelf: 'flex-end',
        marginTop: Spacing.sm,
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    countOver: { color: Colors.danger },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
});
