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
    MEETUP_EVENT_TYPE_OPTIONS,
    MeetupDraftFilters,
} from '../../hooks/useMeetupFilters';
import { useMeetupLocationSuggestions } from '../../hooks/queries/useMeetups';
import { Colors, ControlSizes, Radius, Spacing, TextStyles } from '../../theme';
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

function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = React.useState(value);

    React.useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [delayMs, value]);

    return debounced;
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
    const debouncedLocationQuery = useDebouncedValue(draftFilters.locationQuery.trim(), 250);
    const locationSuggestionsQuery = useMeetupLocationSuggestions(
        debouncedLocationQuery,
        visible && debouncedLocationQuery.length >= 2,
    );
    const locationSuggestions = locationSuggestionsQuery.data ?? [];
    const selectedLocationLabel = draftFilters.locationCountry
        ? `${draftFilters.locationCity}, ${draftFilters.locationCountry}`
        : draftFilters.locationCity;
    const showLocationSuggestions = debouncedLocationQuery.length >= 2
        && selectedLocationLabel !== draftFilters.locationQuery.trim();

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
                            value={draftFilters.locationQuery}
                            onChangeText={(value) => onChangeFilters((current) => ({
                                ...current,
                                locationQuery: value,
                                locationCity: '',
                                locationCountry: null,
                            }))}
                            placeholder="City or area"
                            returnKeyType="search"
                        />
                        {showLocationSuggestions ? (
                            <View style={styles.suggestionList}>
                                {locationSuggestionsQuery.isFetching ? (
                                    <Text style={styles.suggestionMeta}>Searching...</Text>
                                ) : null}
                                {locationSuggestions.map((location) => (
                                    <TouchableOpacity
                                        key={`${location.city}-${location.country ?? ''}`}
                                        style={styles.suggestionItem}
                                        onPress={() => onChangeFilters((current) => ({
                                            ...current,
                                            locationQuery: location.label,
                                            locationCity: location.city,
                                            locationCountry: location.country ?? null,
                                        }))}
                                        activeOpacity={0.82}
                                    >
                                        <Text style={styles.suggestionTitle}>{location.label}</Text>
                                        <Text style={styles.suggestionSubtitle}>
                                            {location.meetup_count} meetup{location.meetup_count === 1 ? '' : 's'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                {!locationSuggestionsQuery.isFetching && locationSuggestions.length === 0 ? (
                                    <Text style={styles.suggestionMeta}>No meetup locations found</Text>
                                ) : null}
                            </View>
                        ) : null}
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
                                    onPress={() => onChangeFilters((current) => ({ ...current, datePreset: option.value }))}
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
                            trackColor={{ false: Colors.border.default, true: Colors.primary }}
                            thumbColor={Colors.bg.page}
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
        borderBottomColor: Colors.border.subtle,
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
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    switchCopy: {
        flex: 1,
        gap: 4,
    },
    switchTitle: {
        ...TextStyles.bodyEmphasis,
    },
    switchSubtitle: {
        ...TextStyles.secondary,
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
        fontSize: TextStyles.button.fontSize,
        fontWeight: TextStyles.button.fontWeight,
    },
    applyButton: {
        flex: 1,
    },
});
