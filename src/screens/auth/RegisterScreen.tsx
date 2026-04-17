import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

interface RegisterScreenProps {
  onGoToLogin: () => void;
}

export function RegisterScreen({ onGoToLogin }: RegisterScreenProps) {
  const { register } = useAuth();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    city: '',
    sober_since: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleRegister = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      Alert.alert('Missing fields', 'Please fill in your name, email and password.');
      return;
    }
    setLoading(true);
    try {
      await register({
        ...form,
        email: form.email.trim().toLowerCase(),
        sober_since: form.sober_since || undefined,
        city: form.city || undefined,
      });
    } catch (e: unknown) {
      Alert.alert('Registration failed', e instanceof Error ? e.message : 'Something went wrong.');
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
            project<Text style={styles.wordmarkAccent}>_radeon</Text>
          </Text>
          <Text style={styles.tagline}>Use your real name — this is a real community.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>First name</Text>
              <TextInput style={styles.input} placeholder="Michael"
                placeholderTextColor={Colors.light.textTertiary}
                value={form.first_name} onChangeText={set('first_name')} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Last name</Text>
              <TextInput style={styles.input} placeholder="Roddy"
                placeholderTextColor={Colors.light.textTertiary}
                value={form.last_name} onChangeText={set('last_name')} />
            </View>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="you@example.com"
            placeholderTextColor={Colors.light.textTertiary}
            autoCapitalize="none" keyboardType="email-address"
            value={form.email} onChangeText={set('email')} />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} placeholder="••••••••"
            placeholderTextColor={Colors.light.textTertiary}
            secureTextEntry value={form.password} onChangeText={set('password')} />

          <Text style={styles.label}>City <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput style={styles.input} placeholder="Dublin"
            placeholderTextColor={Colors.light.textTertiary}
            value={form.city} onChangeText={set('city')} />

          <Text style={styles.label}>
            Sober since <Text style={styles.optional}>(optional — YYYY-MM-DD)</Text>
          </Text>
          <TextInput style={styles.input} placeholder="2024-01-01"
            placeholderTextColor={Colors.light.textTertiary}
            value={form.sober_since} onChangeText={set('sober_since')} />

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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  inner: { flexGrow: 1, padding: Spacing.xl, paddingTop: 60 },
  header: { marginBottom: 32 },
  wordmark: { fontSize: 26, fontWeight: '600', color: Colors.light.textPrimary, letterSpacing: -0.5 },
  wordmarkAccent: { color: Colors.primary },
  tagline: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm },
  form: { gap: 4 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    marginBottom: 4,
    marginTop: Spacing.sm,
  },
  optional: { fontWeight: '400', color: Colors.light.textTertiary },
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
