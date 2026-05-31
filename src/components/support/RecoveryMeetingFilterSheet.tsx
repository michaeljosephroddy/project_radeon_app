import React from 'react';
import {
    ScrollView,
    StyleSheet,
    StyleProp,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, ControlSizes, Radius, Spacing, TextStyles } from '../../theme';
import { screenStandards } from '../../styles/screenStandards';
import { PrimaryButton } from '../ui/PrimaryButton';
import { ScreenHeader } from '../ui/ScreenHeader';
import {
    DAY_OPTIONS,
    FELLOWSHIPS,
    RECOVERY_MEETING_TYPES,
    RecoveryMeetingFilters,
} from '../../screens/main/support/recoveryMeetings';

interface RecoveryMeetingFilterSheetProps {
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
    style?: StyleProp<ViewStyle>;
}

function FilterChip({ label, selected, onPress, style }: ChipProps) {
    return (
        <TouchableOpacity
            style={[styles.chip, style, selected && styles.chipSelected]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
        </TouchableOpacity>
    );
}

export function RecoveryMeetingFilterSheet({
    draftFilters,
    onChangeFilters,
    onClose,
    onReset,
    onApply,
}: RecoveryMeetingFilterSheetProps) {
    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader onBack={onClose} title="Meeting filters" />

            <ScrollView contentContainerStyle={[screenStandards.sheetContent, styles.content]} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Fellowship</Text>
                    <View style={styles.wrap}>
                        {FELLOWSHIPS.map((fellowship) => (
                            <FilterChip
                                key={fellowship.value}
                                label={fellowship.label}
                                selected={draftFilters.fellowships.length === 1 && draftFilters.fellowships[0] === fellowship.value}
                                onPress={() => onChangeFilters((current) => ({ ...current, fellowships: [fellowship.value] }))}
                            />
                        ))}
                    </View>
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
                    <View style={styles.modeGrid}>
                        <FilterChip
                            label="Any mode"
                            selected={!draftFilters.meetingType}
                            onPress={() => onChangeFilters((current) => ({ ...current, meetingType: '' }))}
                            style={styles.modeChipFull}
                        />
                        {RECOVERY_MEETING_TYPES.map((option) => (
                            <FilterChip
                                key={option.value}
                                label={option.label}
                                selected={draftFilters.meetingType === option.value}
                                onPress={() => onChangeFilters((current) => ({ ...current, meetingType: option.value }))}
                                style={styles.modeChip}
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
    modeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    modeChip: {
        flexGrow: 1,
        flexBasis: '47%',
        alignItems: 'center',
    },
    modeChipFull: {
        flexBasis: '100%',
        alignItems: 'center',
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
