import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

interface LoginScreenProps {
    onGoToRegister: () => void;
}

export function LoginScreen({ onGoToRegister }: LoginScreenProps) {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Missing fields', 'Please enter your email and password.');
            return;
        }
        setLoading(true);
        try {
            await login(email.trim().toLowerCase(), password);
        } catch (e: unknown) {
            Alert.alert('Login failed', e instanceof Error ? e.message : 'Invalid credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.wordmark}>
                        Sober<Text style={styles.wordmarkAccent}>Space</Text>
                    </Text>
                    <Text style={styles.tagline}>A social life worth staying sober for.</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="you@example.com"
                        placeholderTextColor={Colors.light.textTertiary}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={Colors.light.textTertiary}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color={Colors.textOn.primary} />
                            : <Text style={styles.btnText}>Sign in</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.switchLink} onPress={onGoToRegister}>
                        <Text style={styles.switchText}>
                            New here? <Text style={styles.switchAccent}>Create an account</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    inner: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
    header: { marginBottom: 40 },
    wordmark: {
        fontSize: 28,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        letterSpacing: -0.5,
    },
    wordmarkAccent: { color: Colors.primary },
    tagline: {
        fontSize: Typography.sizes.md,
        color: Colors.light.textTertiary,
        marginTop: Spacing.sm,
    },
    form: { gap: Spacing.sm },
    label: {
        fontSize: Typography.sizes.sm,
        fontWeight: '500',
        color: Colors.light.textSecondary,
        marginBottom: 2,
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
        marginTop: Spacing.md,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: Colors.textOn.primary, fontWeight: '600', fontSize: Typography.sizes.md },
    switchLink: { alignItems: 'center', marginTop: Spacing.lg },
    switchText: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary },
    switchAccent: { color: Colors.primary, fontWeight: '500' },
});
