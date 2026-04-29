import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity,
    StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../api/client';
import { formatSobrietyDate } from '../../utils/date';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

const MAX_BIO = 160;

type SobrietyStepProps = OnboardingStepProps;

export function SobrietyStep({ onNext, dotIndex, dotTotal }: SobrietyStepProps) {
    const { user, refreshUser } = useAuth();
    const [soberSince, setSoberSince] = useState(user?.sober_since ?? '');
    const [bio, setBio] = useState(user?.bio ?? '');
    const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
    const [saving, setSaving] = useState(false);

    const pickerValue = soberSince ? new Date(`${soberSince}T12:00:00Z`) : new Date();
    const formattedDate = formatSobrietyDate(soberSince);

    const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
            if (event.type === 'dismissed' || !selectedDate) return;
        }
        if (!selectedDate) return;
        setSoberSince([
            selectedDate.getFullYear(),
            String(selectedDate.getMonth() + 1).padStart(2, '0'),
            String(selectedDate.getDate()).padStart(2, '0'),
        ].join('-'));
    };

    const handleContinue = async () => {
        if (bio.length > MAX_BIO) {
            Alert.alert('Bio too long', `Keep your bio under ${MAX_BIO} characters.`);
            return;
        }
        Keyboard.dismiss();
        setSaving(true);
        try {
            await api.updateMe({
                sober_since: soberSince || undefined,
                bio: bio.trim() || null,
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
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.iconWrap}>
                        <Ionicons name="leaf-outline" size={32} color={Colors.primary} />
                    </View>
                    <Text style={styles.title}>Your story</Text>
                    <Text style={styles.subtitle}>Share when your journey began and a little about yourself.</Text>

                    <View style={styles.section}>
                        <Text style={styles.label}>Sober since</Text>
                        {Platform.OS === 'android' ? (
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setShowPicker(true)}
                            >
                                <Text style={[styles.dateButtonText, !soberSince && styles.dateButtonPlaceholder]}>
                                    {formattedDate || 'Select a date'}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.dateDisplayRow}>
                                <Text style={[styles.dateDisplay, !soberSince && styles.dateDisplayPlaceholder]}>
                                    {formattedDate || 'Select a date'}
                                </Text>
                            </View>
                        )}

                        {showPicker && (
                            <DateTimePicker
                                value={pickerValue}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                maximumDate={new Date()}
                                onChange={handleDateChange}
                                themeVariant="dark"
                            />
                        )}
                    </View>

                    <View style={styles.section}>
                        <View style={styles.labelRow}>
                            <Text style={styles.label}>Bio</Text>
                            <Text style={[styles.charCount, bio.length > MAX_BIO && styles.charCountOver]}>
                                {bio.length}/{MAX_BIO}
                            </Text>
                        </View>
                        <TextField
                            style={styles.bioInput}
                            placeholder="Tell the community a bit about yourself…"
                            placeholderTextColor={Colors.text.muted}
                            multiline
                            maxLength={MAX_BIO + 10}
                            value={bio}
                            onChangeText={setBio}
                        />
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <PrimaryButton label="Continue" onPress={handleContinue} loading={saving} />
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
    scrollContent: {
        padding: Spacing.xl,
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
    section: { marginBottom: Spacing.xl },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    label: {
        ...Typography.formLabel,
        color: Colors.text.secondary,
        marginBottom: Spacing.sm,
    },
    charCount: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    charCountOver: { color: Colors.danger },
    dateButton: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.md,
        borderWidth: 0.5,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
    },
    dateButtonText: {
        fontSize: Typography.sizes.lg,
        color: Colors.text.primary,
        fontWeight: '500',
    },
    dateButtonPlaceholder: { color: Colors.text.muted },
    dateDisplayRow: {
        paddingVertical: Spacing.sm,
    },
    dateDisplay: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    dateDisplayPlaceholder: { color: Colors.text.muted },
    bioInput: {
        fontSize: Typography.sizes.lg,
        color: Colors.text.primary,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
});
