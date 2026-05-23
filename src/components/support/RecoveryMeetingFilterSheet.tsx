import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { screenStandards } from '../../styles/screenStandards';
import { PrimaryButton } from '../ui/PrimaryButton';
import { ScreenHeader } from '../ui/ScreenHeader';
import { TextField } from '../ui/TextField';
import {
    DAY_OPTIONS,
    FELLOWSHIPS,
    RECOVERY_MEETING_TYPES,
    RecoveryMeetingFilters,
} from '../../screens/main/support/recoveryMeetings';

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
    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScreenHeader onBack={onClose} title="Meeting filters" />

                <ScrollView contentContainerStyle={[screenStandards.sheetContent, styles.content]} showsVerticalScrollIndicator={false}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Fellowship</Text>
                        <View style={styles.wrap}>
                            <FilterChip
                                label="Any fellowship"
                                selected={!draftFilters.fellowship}
                                onPress={() => onChangeFilters((current) => ({ ...current, fellowship: '' }))}
                            />
                            {FELLOWSHIPS.map((fellowship) => (
                                <FilterChip
                                    key={fellowship.value}
                                    label={fellowship.label}
                                    selected={draftFilters.fellowship === fellowship.value}
                                    onPress={() => onChangeFilters((current) => ({ ...current, fellowship: fellowship.value }))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Country</Text>
                        <TextField
                            value={draftFilters.country}
                            onChangeText={(country) => onChangeFilters((current) => ({ ...current, country }))}
                            placeholder="Any country"
                            autoCapitalize="words"
                            returnKeyType="done"
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>City</Text>
                        <TextField
                            value={draftFilters.city}
                            onChangeText={(city) => onChangeFilters((current) => ({ ...current, city }))}
                            placeholder="Any city"
                            autoCapitalize="words"
                            returnKeyType="done"
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Day of week</Text>
                        <View style={styles.wrap}>
                            <FilterChip
                                label="Any day"
                                selected={draftFilters.dayOfWeek === null}
                                onPress={() => onChangeFilters((current) => ({ ...current, dayOfWeek: null }))}
                            />
                            {DAY_OPTIONS.map((option) => {
                                const selected = draftFilters.dayOfWeek === option.value;
                                return (
                                    <FilterChip
                                        key={option.value}
                                        label={option.short}
                                        selected={selected}
                                        onPress={() => onChangeFilters((current) => ({ ...current, dayOfWeek: option.value }))}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Meeting mode</Text>
                        <View style={styles.wrap}>
                            <FilterChip
                                label="Any mode"
                                selected={!draftFilters.meetingType}
                                onPress={() => onChangeFilters((current) => ({ ...current, meetingType: '' }))}
                            />
                            {RECOVERY_MEETING_TYPES.map((option) => (
                                <FilterChip
                                    key={option.value}
                                    label={option.label}
                                    selected={draftFilters.meetingType === option.value}
                                    onPress={() => onChangeFilters((current) => ({ ...current, meetingType: option.value }))}
                                />
                            ))}
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
        ...TextStyles.cardTitle,
    },
    wrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    chip: {
        minHeight: ControlSizes.chipMinHeight,
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
        ...TextStyles.chip,
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
        borderTopColor: Colors.border.emphasis,
    },
    resetButton: {
        paddingVertical: 12,
        paddingHorizontal: Spacing.sm,
    },
    resetText: {
        color: Colors.primary,
        fontSize: TextStyles.button.fontSize,
        fontWeight: TextStyles.button.fontWeight,
    },
    applyButton: {
        flex: 1,
    },
});
