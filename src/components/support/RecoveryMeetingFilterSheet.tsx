import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    StyleProp,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { screenStandards } from '../../styles/screenStandards';
import { useRecoveryMeetingCountrySuggestions, useRecoveryMeetingLocationSuggestions } from '../../hooks/queries/useRecoveryMeetings';
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
    style?: StyleProp<ViewStyle>;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = React.useState(value);

    React.useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [delayMs, value]);

    return debounced;
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
    visible,
    draftFilters,
    onChangeFilters,
    onClose,
    onReset,
    onApply,
}: RecoveryMeetingFilterSheetProps) {
    const debouncedLocationQuery = useDebouncedValue(draftFilters.location.trim(), 250);
    const debouncedCountryQuery = useDebouncedValue(draftFilters.country.trim(), 250);
    const locationSuggestionsQuery = useRecoveryMeetingLocationSuggestions(
        debouncedLocationQuery,
        {
            country: draftFilters.country.trim() || undefined,
            fellowship: draftFilters.fellowship || undefined,
        },
        visible && debouncedLocationQuery.length >= 2,
    );
    const countrySuggestionsQuery = useRecoveryMeetingCountrySuggestions(
        debouncedCountryQuery,
        { fellowship: draftFilters.fellowship || undefined },
        visible && debouncedCountryQuery.length >= 2,
    );
    const locationSuggestions = locationSuggestionsQuery.data ?? [];
    const countrySuggestions = countrySuggestionsQuery.data ?? [];
    const selectedLocation = locationSuggestions.some((suggestion) => (
        suggestion.location === draftFilters.location.trim()
        && (suggestion.country ?? '') === draftFilters.country.trim()
    ));
    const selectedCountry = countrySuggestions.some((suggestion) => suggestion.country === draftFilters.country.trim());
    const showLocationSuggestions = debouncedLocationQuery.length >= 2 && !selectedLocation;
    const showCountrySuggestions = debouncedCountryQuery.length >= 2 && !selectedCountry;

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
                        <Text style={styles.sectionTitle}>Location</Text>
                        <TextField
                            value={draftFilters.location}
                            onChangeText={(location) => onChangeFilters((current) => ({ ...current, location }))}
                            placeholder="City, county, venue, or postcode"
                            autoCapitalize="words"
                            returnKeyType="search"
                        />
                        {showLocationSuggestions ? (
                            <View style={styles.suggestionList}>
                                {locationSuggestionsQuery.isFetching ? (
                                    <Text style={styles.suggestionMeta}>Searching...</Text>
                                ) : null}
                                {locationSuggestions.map((location) => (
                                    <TouchableOpacity
                                        key={`${location.location}-${location.country ?? ''}`}
                                        style={styles.suggestionItem}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            location: location.location,
                                            country: location.country ?? current.country,
                                        }))}
                                        activeOpacity={0.82}
                                    >
                                        <Text style={styles.suggestionTitle}>{location.label}</Text>
                                        <Text style={styles.suggestionSubtitle}>
                                            {location.meeting_count} meeting{location.meeting_count === 1 ? '' : 's'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                {!locationSuggestionsQuery.isFetching && locationSuggestions.length === 0 ? (
                                    <Text style={styles.suggestionMeta}>No meeting locations found</Text>
                                ) : null}
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Country</Text>
                        <TextField
                            value={draftFilters.country}
                            onChangeText={(country) => onChangeFilters((current) => ({ ...current, country }))}
                            placeholder="Any country"
                            autoCapitalize="words"
                            returnKeyType="search"
                        />
                        {showCountrySuggestions ? (
                            <View style={styles.suggestionList}>
                                {countrySuggestionsQuery.isFetching ? (
                                    <Text style={styles.suggestionMeta}>Searching...</Text>
                                ) : null}
                                {countrySuggestions.map((country) => (
                                    <TouchableOpacity
                                        key={country.country}
                                        style={styles.suggestionItem}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            country: country.country,
                                        }))}
                                        activeOpacity={0.82}
                                    >
                                        <Text style={styles.suggestionTitle}>{country.label}</Text>
                                        <Text style={styles.suggestionSubtitle}>
                                            {country.meeting_count} meeting{country.meeting_count === 1 ? '' : 's'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                {!countrySuggestionsQuery.isFetching && countrySuggestions.length === 0 ? (
                                    <Text style={styles.suggestionMeta}>No meeting countries found</Text>
                                ) : null}
                            </View>
                        ) : null}
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
    suggestionList: {
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.surface,
        overflow: 'hidden',
    },
    suggestionItem: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
    },
    suggestionTitle: {
        ...TextStyles.bodyEmphasis,
    },
    suggestionSubtitle: {
        ...TextStyles.caption,
        color: Colors.text.secondary,
        marginTop: 2,
    },
    suggestionMeta: {
        ...TextStyles.secondary,
        color: Colors.text.secondary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
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
