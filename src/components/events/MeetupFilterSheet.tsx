import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../../api/client';
import {
    MEETUP_DATE_PRESET_OPTIONS,
    MEETUP_DAY_OPTIONS,
    MEETUP_DISTANCE_OPTIONS,
    MEETUP_EVENT_TYPE_OPTIONS,
    MeetupDraftFilters,
    MEETUP_SORT_OPTIONS,
    MEETUP_TIME_OPTIONS,
} from '../../hooks/useMeetupFilters';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';
import { screenStandards } from '../../styles/screenStandards';
import { PrimaryButton } from '../ui/PrimaryButton';
import { ScreenHeader } from '../ui/ScreenHeader';
import { TextField } from '../ui/TextField';

interface MeetupFilterSheetProps {
    visible: boolean;
    draftFilters: MeetupDraftFilters;
    categories: api.MeetupCategory[];
    onChangeFilters: React.Dispatch<React.SetStateAction<MeetupDraftFilters>>;
    onClose: () => void;
    onReset: () => void;
    onApply: () => void;
}

function FilterChip({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
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

export function MeetupFilterSheet({
    visible,
    draftFilters,
    categories,
    onChangeFilters,
    onClose,
    onReset,
    onApply,
}: MeetupFilterSheetProps) {
    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScreenHeader onBack={onClose} title="Event filters" />

                <ScrollView contentContainerStyle={[screenStandards.sheetContent, styles.content]} showsVerticalScrollIndicator={false}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Category</Text>
                        <View style={styles.wrap}>
                            <FilterChip
                                label="All categories"
                                selected={!draftFilters.category}
                                onPress={() => onChangeFilters((current) => ({ ...current, category: '' }))}
                            />
                            {categories.map((category) => (
                                <FilterChip
                                    key={category.slug}
                                    label={category.label}
                                    selected={draftFilters.category === category.slug}
                                    onPress={() => onChangeFilters((current) => ({ ...current, category: category.slug }))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Location</Text>
                        <TextField
                            value={draftFilters.city}
                            onChangeText={(value) => onChangeFilters((current) => ({ ...current, city: value }))}
                            placeholder="City or venue area"
                        />
                        <View style={[styles.wrap, styles.spacingTop]}>
                            {MEETUP_DISTANCE_OPTIONS.map((option) => (
                                <FilterChip
                                    key={option.label}
                                    label={option.label}
                                    selected={draftFilters.distanceKm === option.value}
                                    onPress={() => onChangeFilters((current) => ({ ...current, distanceKm: option.value }))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Format</Text>
                        <View style={styles.wrap}>
                            {MEETUP_EVENT_TYPE_OPTIONS.map((option) => (
                                <FilterChip
                                    key={option.label}
                                    label={option.label}
                                    selected={draftFilters.eventType === option.value}
                                    onPress={() => onChangeFilters((current) => ({ ...current, eventType: option.value }))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Date</Text>
                        <View style={styles.wrap}>
                            {MEETUP_DATE_PRESET_OPTIONS.map((option) => (
                                <FilterChip
                                    key={option.label}
                                    label={option.label}
                                    selected={draftFilters.datePreset === option.value}
                                    onPress={() => onChangeFilters((current) => ({
                                        ...current,
                                        datePreset: option.value,
                                        dateFrom: option.value === 'custom' ? current.dateFrom : '',
                                        dateTo: option.value === 'custom' ? current.dateTo : '',
                                    }))}
                                />
                            ))}
                        </View>
                        {draftFilters.datePreset === 'custom' ? (
                            <View style={styles.dateRow}>
                                <View style={styles.dateField}>
                                    <Text style={styles.fieldLabel}>From</Text>
                                    <TextField
                                        value={draftFilters.dateFrom}
                                        onChangeText={(value) => onChangeFilters((current) => ({ ...current, dateFrom: value }))}
                                        placeholder="2026-05-01"
                                    />
                                </View>
                                <View style={styles.dateField}>
                                    <Text style={styles.fieldLabel}>To</Text>
                                    <TextField
                                        value={draftFilters.dateTo}
                                        onChangeText={(value) => onChangeFilters((current) => ({ ...current, dateTo: value }))}
                                        placeholder="2026-05-31"
                                    />
                                </View>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Day of week</Text>
                        <View style={styles.wrap}>
                            {MEETUP_DAY_OPTIONS.map((option) => {
                                const selected = draftFilters.dayOfWeek.includes(option.value);
                                return (
                                    <FilterChip
                                        key={option.value}
                                        label={option.label}
                                        selected={selected}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            dayOfWeek: selected
                                                ? current.dayOfWeek.filter((value) => value !== option.value)
                                                : [...current.dayOfWeek, option.value].sort((left, right) => left - right),
                                        }))}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Time of day</Text>
                        <View style={styles.wrap}>
                            {MEETUP_TIME_OPTIONS.map((option) => {
                                const selected = draftFilters.timeOfDay.includes(option.value);
                                return (
                                    <FilterChip
                                        key={option.value}
                                        label={option.label}
                                        selected={selected}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            timeOfDay: selected
                                                ? current.timeOfDay.filter((value) => value !== option.value)
                                                : [...current.timeOfDay, option.value],
                                        }))}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Sort</Text>
                        <View style={styles.wrap}>
                            {MEETUP_SORT_OPTIONS.map((option) => (
                                <FilterChip
                                    key={option.value}
                                    label={option.label}
                                    selected={draftFilters.sort === option.value}
                                    onPress={() => onChangeFilters((current) => ({ ...current, sort: option.value }))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.switchRow}>
                        <View style={styles.switchCopy}>
                            <Text style={styles.switchTitle}>Open spots only</Text>
                            <Text style={styles.switchSubtitle}>Hide full events unless there is an immediate place available.</Text>
                        </View>
                        <Switch
                            value={draftFilters.openSpotsOnly}
                            onValueChange={(value) => onChangeFilters((current) => ({ ...current, openSpotsOnly: value }))}
                            trackColor={{ false: Colors.light.border, true: Colors.primary }}
                            thumbColor={Colors.light.background}
                        />
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
        backgroundColor: Colors.light.background,
    },
    content: {
        gap: Spacing.lg,
    },
    section: {
        gap: Spacing.sm,
    },
    sectionTitle: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
    wrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    spacingTop: {
        marginTop: Spacing.sm,
    },
    chip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    chipSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: Colors.textOn.primary,
    },
    dateRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    dateField: {
        flex: 1,
        gap: Spacing.xs,
    },
    fieldLabel: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: Radii.lg,
        backgroundColor: Colors.light.backgroundSecondary,
        borderWidth: 1,
        borderColor: Colors.light.borderSecondary,
    },
    switchCopy: {
        flex: 1,
        gap: 4,
    },
    switchTitle: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
    switchSubtitle: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        lineHeight: 18,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.light.borderSecondary,
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
