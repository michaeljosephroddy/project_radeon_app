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
import { Colors, Typography, Spacing } from '../../utils/theme';
import { screenStandards } from '../../styles/screenStandards';

interface LoginScreenProps {
    onGoToRegister: () => void;
}

// Renders the sign-in screen and submits login credentials through auth context.
export function LoginScreen({ onGoToRegister }: LoginScreenProps) {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Validates and submits the login form.
    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Missing fields', 'Please enter your email and password.');
            return;
        }
        setLoading(true);
        try {
            // Normalize the email client-side so sign-in is resilient to user casing/spacing.
            await login(email.trim().toLowerCase(), password);
        } catch (e: unknown) {
            Alert.alert('Login failed', e instanceof Error ? e.message : 'Invalid credentials.');
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
                    <Text style={styles.tagline}>A social life worth staying sober for.</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Email</Text>
                    <TextField
                        style={styles.input}
                        placeholder="you@example.com"
                        placeholderTextColor={Colors.light.textTertiary}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextField
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={Colors.light.textTertiary}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    <PrimaryButton
                        label="Sign in"
                        onPress={handleLogin}
                        loading={loading}
                        disabled={loading}
                        variant="success"
                        style={styles.btn}
                    />

                    <TouchableOpacity style={styles.switchLink} onPress={onGoToRegister}>
                        <Text style={styles.switchText}>
                            New here? <Text style={styles.switchAccent}>Create an account</Text>
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
    header: { marginBottom: 40 },
    wordmark: {
        ...Typography.h1,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        letterSpacing: -0.5,
    },
    wordmarkAccent: { color: Colors.primary },
    tagline: {
        fontSize: Typography.body.fontSize,
        lineHeight: Typography.body.lineHeight,
        color: Colors.light.textTertiary,
        marginTop: Spacing.sm,
    },
    form: { gap: Spacing.sm },
    label: {
        ...Typography.formLabel,
        color: Colors.light.textSecondary,
        marginBottom: 2,
        marginTop: Spacing.sm,
    },
    input: { fontSize: Typography.sizes.md },
    btn: { marginTop: Spacing.md },
    switchLink: { alignItems: 'center', marginTop: Spacing.lg },
    switchText: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary },
    switchAccent: { color: Colors.primary, fontWeight: '500' },
});
