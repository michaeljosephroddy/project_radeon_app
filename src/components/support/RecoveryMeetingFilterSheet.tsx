import React, { useMemo } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import { screenStandards } from '../../styles/screenStandards';
import { PrimaryButton } from '../ui/PrimaryButton';
import { ScreenHeader } from '../ui/ScreenHeader';
import {
    DAY_OPTIONS,
    FELLOWSHIPS,
    MEETING_FORMATS,
    MEETING_TYPES,
    RecoveryMeetingFilters,
    TIME_BUCKETS,
    listCitiesForCountry,
    listCountries,
} from '../../screens/main/support/recoveryMeetingsMock';

interface RecoveryMeetingFilterSheetProps {
    visible: boolean;
    draftFilters: RecoveryMeetingFilters;
    onChangeFilters: React.Dispatch<React.SetStateAction<RecoveryMeetingFilters>>;
    onClose: () => void;
    onReset: () => void;
    onApply: () => void;
}

interface ChipProps {
    label: string;
    selected: boolean;
    onPress: () => void;
}

function FilterChip({ label, selected, onPress }: ChipProps) {
    return (
        <TouchableOpacity
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
        </TouchableOpacity>
    );
}

export function RecoveryMeetingFilterSheet({
    visible,
    draftFilters,
    onChangeFilters,
    onClose,
    onReset,
    onApply,
}: RecoveryMeetingFilterSheetProps) {
    const countries = useMemo(() => listCountries(), []);
    const cities = useMemo(() => listCitiesForCountry(draftFilters.country), [draftFilters.country]);

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScreenHeader onBack={onClose} title="Meeting filters" />

                <ScrollView contentContainerStyle={[screenStandards.sheetContent, styles.content]} showsVerticalScrollIndicator={false}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Fellowship</Text>
                        <View style={styles.wrap}>
                            {FELLOWSHIPS.map((fellowship) => {
                                const selected = draftFilters.fellowships.includes(fellowship);
                                return (
                                    <FilterChip
                                        key={fellowship}
                                        label={fellowship}
                                        selected={selected}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            fellowships: selected
                                                ? current.fellowships.filter((f) => f !== fellowship)
                                                : [...current.fellowships, fellowship],
                                        }))}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Country</Text>
                        <View style={styles.wrap}>
                            <FilterChip
                                label="Any country"
                                selected={!draftFilters.country}
                                onPress={() => onChangeFilters((current) => ({ ...current, country: '', city: '' }))}
                            />
                            {countries.map((country) => (
                                <FilterChip
                                    key={country}
                                    label={country}
                                    selected={draftFilters.country === country}
                                    onPress={() => onChangeFilters((current) => ({
                                        ...current,
                                        country,
                                        city: current.country === country ? current.city : '',
                                    }))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>City</Text>
                        <View style={styles.wrap}>
                            <FilterChip
                                label="Any city"
                                selected={!draftFilters.city}
                                onPress={() => onChangeFilters((current) => ({ ...current, city: '' }))}
                            />
                            {cities.map((city) => (
                                <FilterChip
                                    key={city}
                                    label={city}
                                    selected={draftFilters.city === city}
                                    onPress={() => onChangeFilters((current) => ({ ...current, city }))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Day of week</Text>
                        <View style={styles.wrap}>
                            {DAY_OPTIONS.map((option) => {
                                const selected = draftFilters.daysOfWeek.includes(option.value);
                                return (
                                    <FilterChip
                                        key={option.value}
                                        label={option.short}
                                        selected={selected}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            daysOfWeek: selected
                                                ? current.daysOfWeek.filter((d) => d !== option.value)
                                                : [...current.daysOfWeek, option.value].sort((a, b) => a - b),
                                        }))}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Time of day</Text>
                        <View style={styles.wrap}>
                            {TIME_BUCKETS.map((option) => {
                                const selected = draftFilters.timeBuckets.includes(option.value);
                                return (
                                    <FilterChip
                                        key={option.value}
                                        label={`${option.label} - ${option.range}`}
                                        selected={selected}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            timeBuckets: selected
                                                ? current.timeBuckets.filter((t) => t !== option.value)
                                                : [...current.timeBuckets, option.value],
                                        }))}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Format</Text>
                        <View style={styles.wrap}>
                            <FilterChip
                                label="Any format"
                                selected={!draftFilters.format}
                                onPress={() => onChangeFilters((current) => ({ ...current, format: '' }))}
                            />
                            {MEETING_FORMATS.map((option) => (
                                <FilterChip
                                    key={option.value}
                                    label={option.label}
                                    selected={draftFilters.format === option.value}
                                    onPress={() => onChangeFilters((current) => ({ ...current, format: option.value }))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Meeting type</Text>
                        <View style={styles.wrap}>
                            {MEETING_TYPES.map((type) => {
                                const selected = draftFilters.meetingTypes.includes(type);
                                return (
                                    <FilterChip
                                        key={type}
                                        label={type}
                                        selected={selected}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            meetingTypes: selected
                                                ? current.meetingTypes.filter((t) => t !== type)
                                                : [...current.meetingTypes, type],
                                        }))}
                                    />
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity onPress={onReset} style={styles.resetButton} activeOpacity={0.8}>
                        <Text style={styles.resetText}>Reset</Text>
                    </TouchableOpacity>
                    <PrimaryButton label="Apply filters" onPress={onApply} style={styles.applyButton} />
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    content: {
        gap: Spacing.lg,
    },
    section: {
        gap: Spacing.sm,
    },
    sectionTitle: {
        color: Colors.text.primary,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
    wrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    chip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
    },
    chipSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        color: Colors.text.secondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: Colors.textOn.primary,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
    },
    resetButton: {
        paddingVertical: 12,
        paddingHorizontal: Spacing.sm,
    },
    resetText: {
        color: Colors.primary,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
    applyButton: {
        flex: 1,
    },
});
