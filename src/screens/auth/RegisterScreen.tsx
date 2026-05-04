import { appAlert } from '@/components/ui/appAlert';
import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ScrollView, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing } from '../../theme';
import { screenStandards } from '../../styles/screenStandards';

interface RegisterScreenProps {
    onGoToLogin: () => void;
}

// Renders the registration screen and submits the create-account form.
export function RegisterScreen({ onGoToLogin }: RegisterScreenProps) {
    const { register } = useAuth();
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);

    // Build small field setters on demand so each input can stay declarative without
    // duplicating object spread logic inline.
    // Builds a field-specific setter for the registration form object.
    const set = (key: keyof typeof form) => (val: string) =>
        setForm(prev => ({ ...prev, [key]: val }));

    // Validates and submits the registration form.
    const handleRegister = async () => {
        if (!form.username || !form.email || !form.password) {
            appAlert.alert('Missing fields', 'Please fill in your username, email and password.');
            return;
        }
        setLoading(true);
        try {
            await register({
                ...form,
                email: form.email.trim().toLowerCase(),
            });
        } catch (e: unknown) {
            appAlert.alert('Registration failed', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
            <ScrollView contentContainerStyle={screenStandards.authContent} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.wordmark}>
                        Sober<Text style={styles.wordmarkAccent}>Space</Text>
                    </Text>
                    <Text style={styles.tagline}>Choose a username you want people to see.</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Username</Text>
                    <TextField style={styles.input} placeholder="yourusername"
                        placeholderTextColor={Colors.text.muted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={form.username} onChangeText={set('username')} />

                    <Text style={styles.label}>Email</Text>
                    <TextField style={styles.input} placeholder="you@example.com"
                        placeholderTextColor={Colors.text.muted}
                        autoCapitalize="none" keyboardType="email-address"
                        value={form.email} onChangeText={set('email')} />

                    <Text style={styles.label}>Password</Text>
                    <TextField style={styles.input} placeholder="••••••••"
                        placeholderTextColor={Colors.text.muted}
                        secureTextEntry value={form.password} onChangeText={set('password')} />

                    <PrimaryButton
                        label="Create account"
                        onPress={handleRegister}
                        loading={loading}
                        disabled={loading}
                        variant="success"
                        style={styles.btn}
                    />

                    <TouchableOpacity style={styles.switchLink} onPress={onGoToLogin}>
                        <Text style={styles.switchText}>
                            Already have an account? <Text style={styles.switchAccent}>Sign in</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    flex: { flex: 1 },
    header: { marginBottom: 40 },
    wordmark: {
        ...Typography.h1,
        fontWeight: '600',
        color: Colors.text.primary,
        letterSpacing: -0.5,
    },
    wordmarkAccent: { color: Colors.primary },
    tagline: {
        fontSize: Typography.body.fontSize,
        lineHeight: Typography.body.lineHeight,
        color: Colors.text.muted,
        marginTop: Spacing.sm,
    },
    form: { gap: 4 },
    label: {
        ...Typography.formLabel,
        color: Colors.text.secondary,
        marginBottom: 4,
        marginTop: Spacing.sm,
    },
    input: { fontSize: Typography.sizes.md },
    btn: { marginTop: Spacing.lg },
    switchLink: { alignItems: 'center', marginTop: Spacing.lg },
    switchText: { fontSize: Typography.sizes.base, color: Colors.text.muted },
    switchAccent: { color: Colors.primary, fontWeight: '500' },
});
