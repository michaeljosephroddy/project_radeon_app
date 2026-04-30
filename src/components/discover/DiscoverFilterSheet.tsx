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
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../api/client';
import {
    DISCOVER_GENDER_OPTIONS,
    DISCOVER_SOBRIETY_OPTIONS,
    DiscoverDraftFilters,
    getDiscoverDistanceLabel,
} from '../../hooks/useDiscoverFilters';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import { screenStandards } from '../../styles/screenStandards';
import { PrimaryButton } from '../ui/PrimaryButton';
import { ScreenHeader } from '../ui/ScreenHeader';
import { TextField } from '../ui/TextField';

interface DiscoverFilterSheetProps {
    visible: boolean;
    canUseAdvancedFilters: boolean;
    draftFilters: DiscoverDraftFilters;
    onChangeFilters: React.Dispatch<React.SetStateAction<DiscoverDraftFilters>>;
    preview?: api.DiscoverPreviewResponse;
    previewLoading: boolean;
    validationError?: string;
    interestOptions: string[];
    onClose: () => void;
    onReset: () => void;
    onApply: () => void;
}

function FilterOptionChip({
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
            style={[styles.optionChip, selected && styles.optionChipSelected]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{label}</Text>
        </TouchableOpacity>
    );
}

function getPrimaryLabel(
    canUseAdvancedFilters: boolean,
    preview: api.DiscoverPreviewResponse | undefined,
    previewLoading: boolean,
    validationError?: string,
): string {
    if (!canUseAdvancedFilters) {
        return 'Unlock Plus filters';
    }
    if (validationError) {
        return 'Fix age range';
    }
    if (previewLoading) {
        return 'Checking matches...';
    }
    if (preview?.exact_count && preview.exact_count > 0) {
        return `Show ${preview.exact_count} people`;
    }
    if (preview?.broadened_available && preview.broadened_count) {
        return `Show ${preview.broadened_count} close matches`;
    }
    return 'Apply filters';
}

function getPreviewCopy(
    canUseAdvancedFilters: boolean,
    preview: api.DiscoverPreviewResponse | undefined,
    previewLoading: boolean,
    validationError?: string,
): string {
    if (!canUseAdvancedFilters) {
        return 'Plus lets members refine discovery by age, distance, sobriety, and shared interests.';
    }
    if (validationError) {
        return validationError;
    }
    if (previewLoading) {
        return 'Previewing your match pool...';
    }
    if (!preview) {
        return 'Adjust your filters, then apply them in one step.';
    }
    if (preview.exact_count > 0) {
        return `${preview.exact_count} exact matches currently fit this filter set.`;
    }
    if (preview.broadened_available && preview.broadened_count) {
        return `No exact matches right now. Broadening can surface ${preview.broadened_count} close matches.`;
    }
    return 'No exact matches yet. Try widening distance, age range, or interests.';
}

export function DiscoverFilterSheet({
    visible,
    canUseAdvancedFilters,
    draftFilters,
    onChangeFilters,
    preview,
    previewLoading,
    validationError,
    interestOptions,
    onClose,
    onReset,
    onApply,
}: DiscoverFilterSheetProps) {
    const primaryLabel = getPrimaryLabel(canUseAdvancedFilters, preview, previewLoading, validationError);
    const previewCopy = getPreviewCopy(canUseAdvancedFilters, preview, previewLoading, validationError);

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScreenHeader onBack={onClose} title="Advanced filters" />

                <ScrollView contentContainerStyle={[screenStandards.sheetContent, styles.content]} showsVerticalScrollIndicator={false}>
                    <View style={styles.previewCard}>
                        <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
                        <Text style={styles.previewText}>{previewCopy}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Gender</Text>
                        <View style={styles.optionWrap}>
                            {DISCOVER_GENDER_OPTIONS.map((option) => (
                                <FilterOptionChip
                                    key={option.value}
                                    label={option.label}
                                    selected={draftFilters.gender === option.value}
                                    onPress={() => onChangeFilters((current) => ({ ...current, gender: option.value }))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Age range</Text>
                        <View style={styles.ageRow}>
                            <View style={styles.ageField}>
                                <Text style={styles.fieldLabel}>Min</Text>
                                <TextField
                                    value={draftFilters.ageMin}
                                    onChangeText={(value) => onChangeFilters((current) => ({
                                        ...current,
                                        ageMin: value.replace(/[^0-9]/g, ''),
                                    }))}
                                    placeholder="18"
                                    keyboardType="number-pad"
                                />
                            </View>
                            <View style={styles.ageField}>
                                <Text style={styles.fieldLabel}>Max</Text>
                                <TextField
                                    value={draftFilters.ageMax}
                                    onChangeText={(value) => onChangeFilters((current) => ({
                                        ...current,
                                        ageMax: value.replace(/[^0-9]/g, ''),
                                    }))}
                                    placeholder="99"
                                    keyboardType="number-pad"
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionRow}>
                            <Text style={styles.sectionTitle}>Distance</Text>
                            <Text style={styles.distanceValue}>{getDiscoverDistanceLabel(draftFilters.distanceKm)}</Text>
                        </View>
                        <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={200}
                            step={10}
                            minimumTrackTintColor={Colors.primary}
                            maximumTrackTintColor={Colors.border.default}
                            thumbTintColor={Colors.primary}
                            value={draftFilters.distanceKm}
                            onValueChange={(value) => onChangeFilters((current) => ({ ...current, distanceKm: value }))}
                        />
                        <View style={styles.sliderMarks}>
                            <Text style={styles.sliderMarkText}>Anywhere</Text>
                            <Text style={styles.sliderMarkText}>100 km</Text>
                            <Text style={styles.sliderMarkText}>200 km</Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Sobriety</Text>
                        <View style={styles.optionWrap}>
                            {DISCOVER_SOBRIETY_OPTIONS.map((option) => (
                                <FilterOptionChip
                                    key={option.value}
                                    label={option.label}
                                    selected={draftFilters.sobriety === option.value}
                                    onPress={() => onChangeFilters((current) => ({ ...current, sobriety: option.value }))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionRow}>
                            <Text style={styles.sectionTitle}>Shared interests</Text>
                            <Text style={styles.sectionHint}>Any selected interest</Text>
                        </View>
                        <View style={styles.optionWrap}>
                            {interestOptions.map((interest) => {
                                const selected = draftFilters.interests.includes(interest);
                                return (
                                    <FilterOptionChip
                                        key={interest}
                                        label={interest}
                                        selected={selected}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            interests: selected
                                                ? current.interests.filter((item) => item !== interest)
                                                : [...current.interests, interest],
                                        }))}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.toggleRow}
                        onPress={() => onChangeFilters((current) => ({
                            ...current,
                            broadenIfFewExact: !current.broadenIfFewExact,
                        }))}
                        activeOpacity={0.85}
                    >
                        <View style={styles.toggleCopy}>
                            <Text style={styles.toggleTitle}>Broaden only if there are no exact matches</Text>
                            <Text style={styles.toggleSubtitle}>If your exact filter set returns zero people, the app can relax distance, age, interests, and sobriety while keeping gender strict.</Text>
                        </View>
                        <View style={[styles.checkbox, draftFilters.broadenIfFewExact && styles.checkboxChecked]}>
                            {draftFilters.broadenIfFewExact ? (
                                <Ionicons name="checkmark" size={16} color={Colors.textOn.primary} />
                            ) : null}
                        </View>
                    </TouchableOpacity>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.resetButton} onPress={onReset} activeOpacity={0.8}>
                        <Text style={styles.resetButtonText}>Reset</Text>
                    </TouchableOpacity>
                    <PrimaryButton
                        label={primaryLabel}
                        onPress={onApply}
                        variant={canUseAdvancedFilters ? 'primary' : 'warning'}
                        style={styles.applyButton}
                        leftAdornment={
                            <Ionicons
                                name={canUseAdvancedFilters ? 'options-outline' : 'star'}
                                size={16}
                                color={canUseAdvancedFilters ? Colors.textOn.primary : Colors.textOn.warning}
                            />
                        }
                        loading={canUseAdvancedFilters && previewLoading}
                    />
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
    previewCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        backgroundColor: 'rgba(13,110,253,0.18)',
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(13,110,253,0.38)',
        padding: Spacing.md,
    },
    previewText: {
        flex: 1,
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
        lineHeight: 20,
    },
    section: {
        gap: Spacing.sm,
    },
    sectionRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: Spacing.md,
    },
    sectionTitle: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    sectionHint: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    optionWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    optionChip: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    optionChipSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    optionChipText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '500',
        color: Colors.text.secondary,
    },
    optionChipTextSelected: {
        color: Colors.primary,
    },
    ageRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    ageField: {
        flex: 1,
    },
    fieldLabel: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
        marginBottom: Spacing.xs,
    },
    slider: {
        width: '100%',
        height: 36,
    },
    distanceValue: {
        fontSize: Typography.sizes.sm,
        color: Colors.primary,
        fontWeight: '600',
    },
    sliderMarks: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sliderMarkText: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
        padding: Spacing.md,
    },
    toggleCopy: {
        flex: 1,
        gap: 4,
    },
    toggleTitle: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    toggleSubtitle: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
        lineHeight: 19,
    },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.page,
    },
    checkboxChecked: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    footer: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border.default,
        gap: Spacing.sm,
    },
    resetButton: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingVertical: 14,
    },
    resetButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    applyButton: {
        minHeight: 52,
    },
});
