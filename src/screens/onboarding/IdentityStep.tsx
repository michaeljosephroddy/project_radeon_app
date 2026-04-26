import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../api/client';
import { formatBirthDateValue, GENDER_SEGMENTS } from '../../utils/profileIdentity';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

type EditableGender = api.UserGender | '';
type IdentityStepProps = OnboardingStepProps;

export function IdentityStep({ onNext, dotIndex, dotTotal }: IdentityStepProps) {
    const { user, refreshUser } = useAuth();
    const [gender, setGender] = useState<EditableGender>(user?.gender ?? '');
    const [birthDate, setBirthDate] = useState(user?.birth_date ?? '');
    const [showBirthDatePicker, setShowBirthDatePicker] = useState(Platform.OS === 'ios');
    const [saving, setSaving] = useState(false);

    const birthDatePickerValue = birthDate ? new Date(`${birthDate}T12:00:00Z`) : new Date('1990-01-01T12:00:00Z');
    const formattedBirthDate = formatBirthDateValue(birthDate);

    const handleBirthDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowBirthDatePicker(false);
            if (event.type === 'dismissed' || !selectedDate) return;
        }
        if (!selectedDate) return;
        setBirthDate([
            selectedDate.getFullYear(),
            String(selectedDate.getMonth() + 1).padStart(2, '0'),
            String(selectedDate.getDate()).padStart(2, '0'),
        ].join('-'));
    };

    const handleContinue = async () => {
        setSaving(true);
        try {
            await api.updateMe({
                gender,
                birth_date: birthDate || '',
            });
            await refreshUser();
            onNext();
        } catch (error: unknown) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.topBar}>
                <View style={styles.dots}>
                    {Array.from({ length: dotTotal }).map((_, index) => (
                        <View key={index} style={[styles.dot, index === dotIndex && styles.dotActive]} />
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
                        <Ionicons name="person-outline" size={32} color={Colors.primary} />
                    </View>
                    <Text style={styles.title}>A bit about you</Text>
                    <Text style={styles.subtitle}>
                        Add the basics now so profile setup and discovery feel more complete later. You can edit these any time.
                    </Text>

                    <View style={styles.section}>
                        <Text style={styles.label}>Gender</Text>
                        <SegmentedControl
                            items={GENDER_SEGMENTS.map((item) => ({
                                key: item.key,
                                label: item.label,
                            }))}
                            activeKey={gender || 'none'}
                            onChange={(value) => setGender(value as EditableGender)}
                            tone="secondary"
                            style={styles.segmentedControl}
                        />
                        {gender ? (
                            <TouchableOpacity onPress={() => setGender('')}>
                                <Text style={styles.clearText}>Clear gender</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={styles.helperText}>Optional. Leave blank if you do not want to set this yet.</Text>
                        )}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.label}>Birth date</Text>
                        {Platform.OS === 'android' ? (
                            <TouchableOpacity style={styles.dateButton} onPress={() => setShowBirthDatePicker(true)}>
                                <Text style={[styles.dateButtonText, !birthDate && styles.dateButtonPlaceholder]}>
                                    {formattedBirthDate}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.dateDisplayRow}>
                                <Text style={[styles.dateDisplay, !birthDate && styles.dateDisplayPlaceholder]}>
                                    {formattedBirthDate}
                                </Text>
                            </View>
                        )}

                        {birthDate ? (
                            <TouchableOpacity onPress={() => setBirthDate('')}>
                                <Text style={styles.clearText}>Clear birth date</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={styles.helperText}>Used for age-based discovery and shown on your profile only where the app already uses age data.</Text>
                        )}

                        {showBirthDatePicker ? (
                            <DateTimePicker
                                value={birthDatePickerValue}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                maximumDate={new Date()}
                                onChange={handleBirthDateChange}
                                themeVariant="dark"
                            />
                        ) : null}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <PrimaryButton label="Continue" onPress={handleContinue} loading={saving} disabled={saving} />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
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
        backgroundColor: Colors.light.border,
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
        backgroundColor: Colors.light.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
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
        marginBottom: Spacing.xl,
        lineHeight: 22,
    },
    section: { marginBottom: Spacing.xl },
    label: {
        ...Typography.formLabel,
        color: Colors.light.textSecondary,
        marginBottom: Spacing.sm,
    },
    segmentedControl: {
        marginBottom: Spacing.sm,
    },
    helperText: {
        fontSize: Typography.sizes.sm,
        lineHeight: 18,
        color: Colors.light.textTertiary,
    },
    clearText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    dateButton: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
    },
    dateButtonText: {
        fontSize: Typography.sizes.lg,
        color: Colors.light.textPrimary,
        fontWeight: '500',
    },
    dateButtonPlaceholder: { color: Colors.light.textTertiary },
    dateDisplayRow: {
        paddingVertical: Spacing.sm,
    },
    dateDisplay: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    dateDisplayPlaceholder: { color: Colors.light.textTertiary },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
});
