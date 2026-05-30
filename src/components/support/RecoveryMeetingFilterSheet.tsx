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
import { useRecoveryMeetingFilterOptions } from '../../hooks/queries/useRecoveryMeetings';
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
    active: boolean;
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

function getRegionFieldLabel(country: string): string {
    const normalized = country.trim().toLowerCase();
    if (normalized === 'ireland') return 'County';
    if (normalized === 'united states' || normalized === 'usa' || normalized === 'us') return 'State';
    if (normalized === 'canada') return 'Province';
    return 'Region';
}

function toggleFellowship(current: RecoveryMeetingFilters, value: string): RecoveryMeetingFilters {
    const isSelected = current.fellowships.includes(value);
    return {
        ...current,
        fellowships: isSelected
            ? current.fellowships.filter((item) => item !== value)
            : [...current.fellowships, value],
    };
}

export function RecoveryMeetingFilterSheet({
    active,
    draftFilters,
    onChangeFilters,
    onClose,
    onReset,
    onApply,
}: RecoveryMeetingFilterSheetProps) {
    const debouncedLocationQuery = useDebouncedValue(draftFilters.location.trim(), 250);
    const debouncedRegionQuery = useDebouncedValue(draftFilters.region.trim(), 250);
    const debouncedCountryQuery = useDebouncedValue(draftFilters.country.trim(), 250);
    const selectedCountryValue = draftFilters.country.trim();
    const selectedRegionValue = draftFilters.region.trim();
    const regionLabel = getRegionFieldLabel(selectedCountryValue);
    const suggestionFellowship = draftFilters.fellowships.length ? draftFilters.fellowships : undefined;
    const locationSuggestionsQuery = useRecoveryMeetingFilterOptions(
        {
            level: 'locality',
            q: debouncedLocationQuery,
            country: selectedCountryValue || undefined,
            region: selectedRegionValue || undefined,
            fellowship: suggestionFellowship,
        },
        active && selectedCountryValue.length > 0 && debouncedLocationQuery.length >= 2,
    );
    const regionSuggestionsQuery = useRecoveryMeetingFilterOptions(
        {
            level: 'region',
            q: debouncedRegionQuery,
            country: selectedCountryValue || undefined,
            fellowship: suggestionFellowship,
        },
        active && selectedCountryValue.length > 0 && debouncedRegionQuery.length >= 2,
    );
    const countrySuggestionsQuery = useRecoveryMeetingFilterOptions(
        {
            level: 'country',
            q: debouncedCountryQuery,
            fellowship: suggestionFellowship,
        },
        active && debouncedCountryQuery.length >= 2,
    );
    const locationSuggestions = locationSuggestionsQuery.data ?? [];
    const regionSuggestions = regionSuggestionsQuery.data ?? [];
    const countrySuggestions = countrySuggestionsQuery.data ?? [];
    const selectedLocation = locationSuggestions.some((suggestion) => (
        suggestion.locality === draftFilters.location.trim()
        && (suggestion.region ?? '') === selectedRegionValue
        && (suggestion.country ?? '') === selectedCountryValue
    ));
    const selectedRegion = regionSuggestions.some((suggestion) => (
        suggestion.region === selectedRegionValue
        && suggestion.country === selectedCountryValue
    ));
    const canChooseLocation = selectedCountryValue.length > 0;
    const showLocationSuggestions = canChooseLocation && debouncedLocationQuery.length >= 2 && !selectedLocation;
    const showRegionSuggestions = selectedCountryValue.length > 0 && debouncedRegionQuery.length >= 2 && !selectedRegion;
    const showCountrySuggestions = debouncedCountryQuery.length >= 2;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader onBack={onClose} title="Meeting filters" />

            <ScrollView contentContainerStyle={[screenStandards.sheetContent, styles.content]} showsVerticalScrollIndicator={false}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Fellowship</Text>
                        <View style={styles.wrap}>
                            <FilterChip
                                label="Any fellowship"
                                selected={draftFilters.fellowships.length === 0}
                                onPress={() => onChangeFilters((current) => ({ ...current, fellowships: [] }))}
                            />
                            {FELLOWSHIPS.map((fellowship) => (
                                <FilterChip
                                    key={fellowship.value}
                                    label={fellowship.label}
                                    selected={draftFilters.fellowships.includes(fellowship.value)}
                                    onPress={() => onChangeFilters((current) => toggleFellowship(current, fellowship.value))}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Country</Text>
                        <TextField
                            value={draftFilters.country}
                            onChangeText={(country) => onChangeFilters((current) => ({
                                ...current,
                                country,
                                countryCode: null,
                                region: '',
                                regionCode: null,
                                location: '',
                            }))}
                            placeholder="Choose country first"
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
                                        key={`${country.country ?? ''}-${country.country_code ?? ''}`}
                                        style={styles.suggestionItem}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            country: country.country ?? current.country,
                                            countryCode: country.country_code ?? null,
                                            region: '',
                                            regionCode: null,
                                            location: '',
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
                        <Text style={styles.sectionTitle}>Region / county / state</Text>
                        <TextField
                            value={draftFilters.region}
                            onChangeText={(region) => onChangeFilters((current) => ({
                                ...current,
                                region,
                                regionCode: null,
                                location: '',
                            }))}
                            placeholder={selectedCountryValue ? `Choose ${regionLabel.toLowerCase()}` : 'Select a country first'}
                            autoCapitalize="words"
                            returnKeyType="search"
                            editable={selectedCountryValue.length > 0}
                            style={!selectedCountryValue && styles.disabledField}
                        />
                        {showRegionSuggestions ? (
                            <View style={styles.suggestionList}>
                                {regionSuggestionsQuery.isFetching ? (
                                    <Text style={styles.suggestionMeta}>Searching...</Text>
                                ) : null}
                                {regionSuggestions.map((region) => (
                                    <TouchableOpacity
                                        key={`${region.region ?? ''}-${region.country ?? ''}`}
                                        style={styles.suggestionItem}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            region: region.region ?? current.region,
                                            regionCode: region.region_code ?? null,
                                            country: region.country ?? current.country,
                                            countryCode: region.country_code ?? current.countryCode,
                                            location: '',
                                        }))}
                                        activeOpacity={0.82}
                                    >
                                        <Text style={styles.suggestionTitle}>{region.label}</Text>
                                        <Text style={styles.suggestionSubtitle}>
                                            {region.meeting_count} meeting{region.meeting_count === 1 ? '' : 's'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                {!regionSuggestionsQuery.isFetching && regionSuggestions.length === 0 ? (
                                    <Text style={styles.suggestionMeta}>No meeting {regionLabel.toLowerCase()} found</Text>
                                ) : null}
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Town / city</Text>
                        <TextField
                            value={draftFilters.location}
                            onChangeText={(location) => onChangeFilters((current) => ({ ...current, location }))}
                            placeholder={canChooseLocation ? 'Choose town or city' : 'Select a country first'}
                            autoCapitalize="words"
                            returnKeyType="search"
                            editable={canChooseLocation}
                            style={!canChooseLocation && styles.disabledField}
                        />
                        {showLocationSuggestions ? (
                            <View style={styles.suggestionList}>
                                {locationSuggestionsQuery.isFetching ? (
                                    <Text style={styles.suggestionMeta}>Searching...</Text>
                                ) : null}
                                {locationSuggestions.map((location) => (
                                    <TouchableOpacity
                                        key={`${location.locality ?? ''}-${location.region ?? ''}-${location.country ?? ''}`}
                                        style={styles.suggestionItem}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            location: location.locality ?? current.location,
                                            region: location.region ?? current.region,
                                            regionCode: location.region_code ?? current.regionCode,
                                            country: location.country ?? current.country,
                                            countryCode: location.country_code ?? current.countryCode,
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
                                    <Text style={styles.suggestionMeta}>No meeting towns or cities found</Text>
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
    disabledField: {
        opacity: 0.55,
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
