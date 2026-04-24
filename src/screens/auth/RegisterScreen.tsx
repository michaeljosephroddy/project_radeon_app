import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

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
            Alert.alert('Missing fields', 'Please fill in your username, email and password.');
            return;
        }
        setLoading(true);
        try {
            await register({
                ...form,
                email: form.email.trim().toLowerCase(),
            });
        } catch (e: unknown) {
            Alert.alert('Registration failed', e instanceof Error ? e.message : 'Something went wrong.');
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
            <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.wordmark}>
                        Sober<Text style={styles.wordmarkAccent}>Space</Text>
                    </Text>
                    <Text style={styles.tagline}>Choose a username you want people to see.</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput style={styles.input} placeholder="yourusername"
                        placeholderTextColor={Colors.light.textTertiary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={form.username} onChangeText={set('username')} />

                    <Text style={styles.label}>Email</Text>
                    <TextInput style={styles.input} placeholder="you@example.com"
                        placeholderTextColor={Colors.light.textTertiary}
                        autoCapitalize="none" keyboardType="email-address"
                        value={form.email} onChangeText={set('email')} />

                    <Text style={styles.label}>Password</Text>
                    <TextInput style={styles.input} placeholder="••••••••"
                        placeholderTextColor={Colors.light.textTertiary}
                        secureTextEntry value={form.password} onChangeText={set('password')} />

                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color={Colors.textOn.primary} />
                            : <Text style={styles.btnText}>Create account</Text>
                        }
                    </TouchableOpacity>

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
    container: { flex: 1, backgroundColor: Colors.light.background },
    flex: { flex: 1 },
    inner: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
    header: { marginBottom: 40 },
    wordmark: { fontSize: 26, fontWeight: '600', color: Colors.light.textPrimary, letterSpacing: -0.5 },
    wordmarkAccent: { color: Colors.primary },
    tagline: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm },
    form: { gap: 4 },
    label: {
        fontSize: Typography.sizes.sm,
        fontWeight: '500',
        color: Colors.light.textSecondary,
        marginBottom: 4,
        marginTop: Spacing.sm,
    },
    input: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
        fontSize: Typography.sizes.md,
        color: Colors.light.textPrimary,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
    },
    btn: {
        backgroundColor: Colors.success,
        borderRadius: Radii.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: Colors.textOn.primary, fontWeight: '600', fontSize: Typography.sizes.md },
    switchLink: { alignItems: 'center', marginTop: Spacing.lg },
    switchText: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary },
    switchAccent: { color: Colors.primary, fontWeight: '500' },
});
