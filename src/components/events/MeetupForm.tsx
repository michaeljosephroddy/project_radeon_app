import React from 'react';
import { Image } from 'react-native';
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as api from '../../api/client';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';
import { PrimaryButton } from '../ui/PrimaryButton';
import { TextField } from '../ui/TextField';

interface MeetupFormValues {
    title: string;
    description: string;
    category_slug: string;
    event_type: api.MeetupEventType;
    visibility: api.MeetupVisibility;
    city: string;
    country: string;
    venue_name: string;
    address_line_1: string;
    address_line_2: string;
    how_to_find_us: string;
    online_url: string;
    cover_image_url: string;
    starts_on: string;
    starts_at: string;
    ends_on: string;
    ends_at: string;
    timezone: string;
    capacity: string;
    waitlist_enabled: boolean;
}

interface MeetupFormProps {
    title: string;
    values: MeetupFormValues;
    categories: api.MeetupCategory[];
    editing: boolean;
    loading: boolean;
    coverUploading: boolean;
    coverPreviewUri?: string | null;
    error?: string;
    onChange: (key: keyof MeetupFormValues, value: string | boolean) => void;
    onPickCover: () => void;
    onRemoveCover: () => void;
    onSaveDraft: () => void;
    onPublish: () => void;
    onCancelEdit?: () => void;
}

type PickerField = 'starts_on' | 'starts_at' | 'ends_on' | 'ends_at' | null;

function ChoiceChip({
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

function formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeInput(date: Date): string {
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
}

function parseDateTime(dateInput: string, timeInput: string, fallback: Date): Date {
    const parsed = new Date(`${dateInput.trim()}T${timeInput.trim() || '00:00'}:00`);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function formatDateLabel(value: string): string {
    const parsed = new Date(`${value.trim()}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return value || 'Select date';
    return parsed.toLocaleDateString('default', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatTimeLabel(value: string): string {
    const parsed = new Date(`2000-01-01T${value.trim() || '00:00'}:00`);
    if (Number.isNaN(parsed.getTime())) return value || 'Select time';
    return parsed.toLocaleTimeString('default', {
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function MeetupForm({
    title,
    values,
    categories,
    editing,
    loading,
    coverUploading,
    coverPreviewUri,
    error,
    onChange,
    onPickCover,
    onRemoveCover,
    onSaveDraft,
    onPublish,
    onCancelEdit,
}: MeetupFormProps) {
    const [activePicker, setActivePicker] = React.useState<PickerField>(null);
    const isOnline = values.event_type === 'online';
    const showLocationFields = values.event_type !== 'online';
    const defaultStart = React.useMemo(() => {
        const start = new Date();
        start.setDate(start.getDate() + 7);
        start.setHours(19, 0, 0, 0);
        return start;
    }, []);
    const pickerValue = React.useMemo(() => {
        const endFallback = new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000);
        switch (activePicker) {
            case 'starts_on':
            case 'starts_at':
                return parseDateTime(values.starts_on, values.starts_at, defaultStart);
            case 'ends_on':
            case 'ends_at':
                return parseDateTime(values.ends_on, values.ends_at, endFallback);
            default:
                return defaultStart;
        }
    }, [activePicker, defaultStart, values.ends_at, values.ends_on, values.starts_at, values.starts_on]);

    const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        const field = activePicker;
        if (Platform.OS !== 'ios') {
            setActivePicker(null);
        }
        if (!field || event.type === 'dismissed' || !selectedDate) {
            return;
        }
        if (field === 'starts_on' || field === 'ends_on') {
            onChange(field, formatDateInput(selectedDate));
            return;
        }
        onChange(field, formatTimeInput(selectedDate));
    };

    const openPicker = (field: PickerField) => {
        setActivePicker(field);
    };

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
                <Text style={styles.heroEyebrow}>{editing ? 'EDIT EVENT' : 'CREATE EVENT'}</Text>
                <Text style={styles.heroTitle}>{title}</Text>
                <Text style={styles.heroText}>Build a polished event with format, category, venue, schedule, and attendee rules.</Text>
            </View>

            {!!error && (
                <View style={styles.errorCard}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Basics</Text>
                <TextField value={values.title} onChangeText={(value) => onChange('title', value)} placeholder="Event title" />
                <TextField
                    value={values.description}
                    onChangeText={(value) => onChange('description', value)}
                    placeholder="What should people expect?"
                    multiline
                    style={styles.multilineField}
                />
                <View style={styles.wrap}>
                    {categories.map((category) => (
                        <ChoiceChip
                            key={category.slug}
                            label={category.label}
                            selected={values.category_slug === category.slug}
                            onPress={() => onChange('category_slug', category.slug)}
                        />
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Format</Text>
                <View style={styles.wrap}>
                    {(['in_person', 'online', 'hybrid'] as api.MeetupEventType[]).map((type) => (
                        <ChoiceChip
                            key={type}
                            label={type.replace('_', ' ')}
                            selected={values.event_type === type}
                            onPress={() => onChange('event_type', type)}
                        />
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Timing</Text>
                <View style={styles.row}>
                    <View style={styles.half}>
                        <Text style={styles.fieldLabel}>Start date</Text>
                        <TouchableOpacity style={styles.pickerButton} onPress={() => openPicker('starts_on')} activeOpacity={0.82}>
                            <Text style={styles.pickerButtonText}>{formatDateLabel(values.starts_on)}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.half}>
                        <Text style={styles.fieldLabel}>Start time</Text>
                        <TouchableOpacity style={styles.pickerButton} onPress={() => openPicker('starts_at')} activeOpacity={0.82}>
                            <Text style={styles.pickerButtonText}>{formatTimeLabel(values.starts_at)}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.row}>
                    <View style={styles.half}>
                        <Text style={styles.fieldLabel}>End date</Text>
                        <TouchableOpacity style={styles.pickerButton} onPress={() => openPicker('ends_on')} activeOpacity={0.82}>
                            <Text style={styles.pickerButtonText}>{formatDateLabel(values.ends_on)}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.half}>
                        <Text style={styles.fieldLabel}>End time</Text>
                        <TouchableOpacity style={styles.pickerButton} onPress={() => openPicker('ends_at')} activeOpacity={0.82}>
                            <Text style={styles.pickerButtonText}>{formatTimeLabel(values.ends_at)}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                {activePicker ? (
                    Platform.OS === 'ios' ? (
                        <View style={styles.inlinePickerWrap}>
                            <DateTimePicker
                                value={pickerValue}
                                mode={activePicker === 'starts_on' || activePicker === 'ends_on' ? 'date' : 'time'}
                                display="spinner"
                                onChange={handlePickerChange}
                            />
                        </View>
                    ) : (
                        <DateTimePicker
                            value={pickerValue}
                            mode={activePicker === 'starts_on' || activePicker === 'ends_on' ? 'date' : 'time'}
                            display="default"
                            onChange={handlePickerChange}
                        />
                    )
                ) : null}
                <TextField value={values.timezone} onChangeText={(value) => onChange('timezone', value)} placeholder="Timezone (e.g. Europe/Dublin)" />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{isOnline ? 'Online setup' : 'Venue and location'}</Text>
                <TextField value={values.city} onChangeText={(value) => onChange('city', value)} placeholder="City" />
                <TextField value={values.country} onChangeText={(value) => onChange('country', value)} placeholder="Country" />
                {showLocationFields ? (
                    <>
                        <TextField value={values.venue_name} onChangeText={(value) => onChange('venue_name', value)} placeholder="Venue name" />
                        <TextField value={values.address_line_1} onChangeText={(value) => onChange('address_line_1', value)} placeholder="Address line 1" />
                        <TextField value={values.address_line_2} onChangeText={(value) => onChange('address_line_2', value)} placeholder="Address line 2" />
                        <TextField value={values.how_to_find_us} onChangeText={(value) => onChange('how_to_find_us', value)} placeholder="How to find the group" />
                    </>
                ) : null}
                {(isOnline || values.event_type === 'hybrid') ? (
                    <TextField value={values.online_url} onChangeText={(value) => onChange('online_url', value)} placeholder="Online event link" autoCapitalize="none" />
                ) : null}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Attendance</Text>
                <TextField value={values.capacity} onChangeText={(value) => onChange('capacity', value)} placeholder="Capacity" keyboardType="number-pad" />
                <View style={styles.switchRow}>
                    <View style={styles.switchCopy}>
                        <Text style={styles.switchTitle}>Enable waitlist</Text>
                        <Text style={styles.switchSubtitle}>Let people join a queue if the event fills up.</Text>
                    </View>
                    <Switch
                        value={values.waitlist_enabled}
                        onValueChange={(value) => onChange('waitlist_enabled', value)}
                        trackColor={{ false: Colors.light.border, true: Colors.primary }}
                        thumbColor={Colors.light.background}
                    />
                </View>
                <View style={styles.coverSection}>
                    <Text style={styles.fieldLabel}>Cover image</Text>
                    {coverPreviewUri ? (
                        <Image source={{ uri: coverPreviewUri }} style={styles.coverPreview} />
                    ) : (
                        <View style={styles.coverPlaceholder}>
                            <Text style={styles.coverPlaceholderText}>Add a cover image to make the event card stand out.</Text>
                        </View>
                    )}
                    <View style={styles.coverActions}>
                        <TouchableOpacity style={styles.coverActionButton} onPress={onPickCover} activeOpacity={0.82} disabled={coverUploading}>
                            <Text style={styles.coverActionText}>{coverUploading ? 'Uploading…' : coverPreviewUri ? 'Replace image' : 'Upload image'}</Text>
                        </TouchableOpacity>
                        {coverPreviewUri ? (
                            <TouchableOpacity style={styles.coverSecondaryAction} onPress={onRemoveCover} activeOpacity={0.82} disabled={coverUploading}>
                                <Text style={styles.coverSecondaryActionText}>Remove</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            </View>

            <View style={styles.footerActions}>
                {onCancelEdit ? (
                    <TouchableOpacity style={styles.secondaryAction} onPress={onCancelEdit} activeOpacity={0.8}>
                        <Text style={styles.secondaryActionText}>Cancel editing</Text>
                    </TouchableOpacity>
                ) : null}
                <PrimaryButton label={editing ? 'Save draft changes' : 'Save draft'} onPress={onSaveDraft} loading={loading} style={styles.primaryAction} />
                <PrimaryButton label={editing ? 'Update and publish' : 'Publish event'} onPress={onPublish} loading={loading} variant="success" style={styles.primaryAction} />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: Spacing.md,
        gap: Spacing.lg,
    },
    hero: {
        borderRadius: Radii.xl,
        backgroundColor: Colors.primary,
        padding: Spacing.lg,
        gap: 6,
    },
    heroEyebrow: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.xs,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    heroTitle: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.xxl,
        fontWeight: '800',
    },
    heroText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.sm,
        lineHeight: 20,
        opacity: 0.94,
    },
    errorCard: {
        borderRadius: Radii.lg,
        backgroundColor: Colors.dangerSubtle,
        borderWidth: 1,
        borderColor: Colors.danger,
        padding: Spacing.md,
    },
    errorText: {
        color: Colors.danger,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    section: {
        gap: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radii.xl,
        borderWidth: 1,
        borderColor: Colors.light.borderSecondary,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    sectionTitle: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.lg,
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
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.background,
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
    multilineField: {
        minHeight: 110,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    pickerButton: {
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    pickerButtonText: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.md,
    },
    inlinePickerWrap: {
        borderRadius: Radii.lg,
        backgroundColor: Colors.light.background,
        paddingHorizontal: Spacing.sm,
    },
    coverSection: {
        gap: Spacing.sm,
    },
    coverPreview: {
        width: '100%',
        height: 180,
        borderRadius: Radii.lg,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    coverPlaceholder: {
        minHeight: 120,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderStyle: 'dashed',
        backgroundColor: Colors.light.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    coverPlaceholderText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        lineHeight: 20,
        textAlign: 'center',
    },
    coverActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
        alignItems: 'center',
    },
    coverActionButton: {
        flex: 1,
        minHeight: 44,
        borderRadius: Radii.md,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
    },
    coverActionText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    coverSecondaryAction: {
        minHeight: 44,
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.light.background,
    },
    coverSecondaryActionText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    half: {
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
        borderRadius: Radii.lg,
        backgroundColor: Colors.light.background,
        padding: Spacing.md,
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
    footerActions: {
        gap: Spacing.md,
        paddingBottom: Spacing.xl,
    },
    secondaryAction: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    secondaryActionText: {
        color: Colors.primary,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
    primaryAction: {
        width: '100%',
    },
});
