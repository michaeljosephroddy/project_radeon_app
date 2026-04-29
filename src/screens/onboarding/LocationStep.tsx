import React, { useState, useEffect } from 'react';
import {
    View, Text,
    StyleSheet, KeyboardAvoidingView, Platform, Alert, Keyboard, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../api/client';
import { Colors, Typography, Spacing } from '../../theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

type LocationStepProps = OnboardingStepProps;

export function LocationStep({ onNext, dotIndex, dotTotal }: LocationStepProps) {
    const { user, refreshUser } = useAuth();
    const [city, setCity] = useState(user?.city ?? '');
    const [country, setCountry] = useState(user?.country ?? '');
    const [detecting, setDetecting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (user?.city) return;
        void detectLocation();
    }, []);

    const detectLocation = async () => {
        setDetecting(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const [place] = await Location.reverseGeocodeAsync(position.coords);

            setDetectedCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
            if (place?.city) setCity(place.city);
            if (place?.country) setCountry(place.country);
        } catch {
            // Silent — user can fill in manually
        } finally {
            setDetecting(false);
        }
    };

    const handleContinue = async () => {
        Keyboard.dismiss();
        setSaving(true);
        try {
            await api.updateMe({
                city: city.trim() || undefined,
                country: country.trim() || undefined,
                lat: detectedCoords?.lat,
                lng: detectedCoords?.lng,
            });
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

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.inner}>
                    <View style={styles.iconWrap}>
                        {detecting
                            ? <ActivityIndicator color={Colors.primary} />
                            : <Ionicons name="location" size={32} color={Colors.primary} />
                        }
                    </View>
                    <Text style={styles.title}>Where are you based?</Text>
                    <Text style={styles.subtitle}>
                        {detecting
                            ? 'Detecting your location…'
                            : 'Helps you find people and meetups near you.'}
                    </Text>

                    <View style={styles.form}>
                        <Text style={styles.label}>City</Text>
                        <TextField
                            style={styles.input}
                            placeholder="Dublin"
                            placeholderTextColor={Colors.text.muted}
                            value={city}
                            onChangeText={setCity}
                            autoCapitalize="words"
                            returnKeyType="next"
                            editable={!detecting}
                        />

                        <Text style={styles.label}>Country</Text>
                        <TextField
                            style={styles.input}
                            placeholder="Ireland"
                            placeholderTextColor={Colors.text.muted}
                            value={country}
                            onChangeText={setCountry}
                            autoCapitalize="words"
                            returnKeyType="done"
                            onSubmitEditing={handleContinue}
                            editable={!detecting}
                        />
                    </View>
                </View>

                <View style={styles.footer}>
                    <PrimaryButton label="Continue" onPress={handleContinue} loading={saving} disabled={detecting} />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    flex: { flex: 1 },
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
    inner: {
        flex: 1,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
    },
    iconWrap: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.bg.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
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
        marginBottom: Spacing.xl,
        lineHeight: 22,
    },
    form: { gap: Spacing.xs },
    label: {
        ...Typography.formLabel,
        color: Colors.text.secondary,
        marginBottom: 4,
        marginTop: Spacing.sm,
    },
    input: { fontSize: Typography.sizes.lg },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
});
