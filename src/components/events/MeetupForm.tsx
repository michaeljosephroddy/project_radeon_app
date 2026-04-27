import React from 'react';
import { Image } from 'react-native';
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as api from '../../api/client';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';
import { InfoNoticeCard } from '../ui/InfoNoticeCard';
import { PrimaryButton } from '../ui/PrimaryButton';
import { TextField } from '../ui/TextField';
import { MeetupFormValues } from './MeetupFormState';

interface MeetupFormProps {
    title: string;
    values: MeetupFormValues;
    categories: api.MeetupCategory[];
    friends: api.FriendUser[];
    mode: 'create' | 'draft' | 'published';
    loading: boolean;
    coverUploading: boolean;
    coverPreviewUri?: string | null;
    error?: string;
    primaryActionLabel: string;
    primaryActionVariant?: 'primary' | 'success' | 'warning';
    secondaryActionLabel?: string;
    destructiveActionLabel?: string;
    onChange: (key: keyof MeetupFormValues, value: string | boolean | string[]) => void;
    onPickCover: () => void;
    onRemoveCover: () => void;
    onPrimaryAction: () => void;
    onSecondaryAction?: () => void;
    onDestructiveAction?: () => void;
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
    friends,
    mode,
    loading,
    coverUploading,
    coverPreviewUri,
    error,
    primaryActionLabel,
    primaryActionVariant = 'success',
    secondaryActionLabel,
    destructiveActionLabel,
    onChange,
    onPickCover,
    onRemoveCover,
    onPrimaryAction,
    onSecondaryAction,
    onDestructiveAction,
    onCancelEdit,
}: MeetupFormProps) {
    const [activePicker, setActivePicker] = React.useState<PickerField>(null);
    const [coHostQuery, setCoHostQuery] = React.useState('');
    const isOnline = values.event_type === 'online';
    const showLocationFields = values.event_type !== 'online';
    const selectedCoHosts = React.useMemo(
        () => friends.filter((friend) => values.co_host_ids.includes(friend.user_id)),
        [friends, values.co_host_ids],
    );
    const availableCoHosts = React.useMemo(() => {
        const query = coHostQuery.trim().toLowerCase();
        return friends
            .filter((friend) => !values.co_host_ids.includes(friend.user_id))
            .filter((friend) => !query || friend.username.toLowerCase().includes(query))
            .slice(0, 10);
    }, [coHostQuery, friends, values.co_host_ids]);
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

    const toggleCoHost = (friend: api.FriendUser) => {
        const next = values.co_host_ids.includes(friend.user_id)
            ? values.co_host_ids.filter((id) => id !== friend.user_id)
            : [...values.co_host_ids, friend.user_id];
        onChange('co_host_ids', next);
    };

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <InfoNoticeCard
                title={mode === 'published' ? 'Manage live event' : mode === 'draft' ? 'Edit draft' : 'Create event'}
                description={title}
            />

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
                <Text style={styles.fieldLabel}>Categories</Text>
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
                        <TouchableOpacity style={styles.pickerButton} onPress={() => setActivePicker('starts_on')} activeOpacity={0.82}>
                            <Text style={styles.pickerButtonText}>{formatDateLabel(values.starts_on)}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.half}>
                        <Text style={styles.fieldLabel}>Start time</Text>
                        <TouchableOpacity style={styles.pickerButton} onPress={() => setActivePicker('starts_at')} activeOpacity={0.82}>
                            <Text style={styles.pickerButtonText}>{formatTimeLabel(values.starts_at)}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.row}>
                    <View style={styles.half}>
                        <Text style={styles.fieldLabel}>End date</Text>
                        <TouchableOpacity style={styles.pickerButton} onPress={() => setActivePicker('ends_on')} activeOpacity={0.82}>
                            <Text style={styles.pickerButtonText}>{formatDateLabel(values.ends_on)}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.half}>
                        <Text style={styles.fieldLabel}>End time</Text>
                        <TouchableOpacity style={styles.pickerButton} onPress={() => setActivePicker('ends_at')} activeOpacity={0.82}>
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
                <Text style={styles.sectionTitle}>Co-hosts</Text>
                <Text style={styles.helperText}>Invite trusted friends to help host the meetup. Organizers stay in full control.</Text>
                {friends.length ? (
                    <>
                        <TextField
                            value={coHostQuery}
                            onChangeText={setCoHostQuery}
                            placeholder="Search your friends"
                            autoCapitalize="none"
                        />
                        {selectedCoHosts.length ? (
                            <View style={styles.wrap}>
                                {selectedCoHosts.map((friend) => (
                                    <TouchableOpacity
                                        key={friend.user_id}
                                        style={styles.selectedHostChip}
                                        onPress={() => toggleCoHost(friend)}
                                        activeOpacity={0.82}
                                    >
                                        <Text style={styles.selectedHostChipText}>{friend.username}</Text>
                                        <Text style={styles.selectedHostChipRemove}>Remove</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}
                        <View style={styles.wrap}>
                            {availableCoHosts.length ? availableCoHosts.map((friend) => (
                                <ChoiceChip
                                    key={friend.user_id}
                                    label={friend.username}
                                    selected={false}
                                    onPress={() => toggleCoHost(friend)}
                                />
                            )) : (
                                <Text style={styles.emptyHostsText}>
                                    {coHostQuery.trim() ? 'No friends match that search.' : 'All available friends are already selected.'}
                                </Text>
                            )}
                        </View>
                    </>
                ) : (
                    <Text style={styles.emptyHostsText}>Add friends first if you want co-host support on this event.</Text>
                )}
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
                <Text style={styles.fieldLabel}>Coordinates</Text>
                <Text style={styles.helperText}>Optional, but useful if you want map placement to be precise.</Text>
                <View style={styles.row}>
                    <View style={styles.half}>
                        <TextField
                            value={values.lat}
                            onChangeText={(value) => onChange('lat', value)}
                            placeholder="Latitude"
                            keyboardType="numbers-and-punctuation"
                            autoCapitalize="none"
                        />
                    </View>
                    <View style={styles.half}>
                        <TextField
                            value={values.lng}
                            onChangeText={(value) => onChange('lng', value)}
                            placeholder="Longitude"
                            keyboardType="numbers-and-punctuation"
                            autoCapitalize="none"
                        />
                    </View>
                </View>
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
                {secondaryActionLabel && onSecondaryAction ? (
                    <TouchableOpacity style={styles.secondaryAction} onPress={onSecondaryAction} activeOpacity={0.8} disabled={loading}>
                        <Text style={styles.secondaryActionText}>{secondaryActionLabel}</Text>
                    </TouchableOpacity>
                ) : null}
                <PrimaryButton
                    label={primaryActionLabel}
                    onPress={onPrimaryAction}
                    loading={loading}
                    variant={primaryActionVariant}
                    style={styles.primaryAction}
                />
                {destructiveActionLabel && onDestructiveAction ? (
                    <TouchableOpacity
                        style={styles.destructiveAction}
                        onPress={onDestructiveAction}
                        activeOpacity={0.8}
                        disabled={loading}
                    >
                        <Text style={styles.destructiveActionText}>{destructiveActionLabel}</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: Spacing.md,
        gap: Spacing.lg,
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
    helperText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        lineHeight: 20,
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
        backgroundColor: Colors.primarySubtle,
        borderColor: Colors.primary,
    },
    chipText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: Colors.primary,
    },
    selectedHostChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radii.full,
        backgroundColor: Colors.secondarySubtle,
        borderWidth: 1,
        borderColor: Colors.secondary,
    },
    selectedHostChipText: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    selectedHostChipRemove: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        opacity: 0.84,
    },
    emptyHostsText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        lineHeight: 20,
    },
    multilineField: {
        minHeight: 110,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    half: {
        flex: 1,
        gap: Spacing.xs,
    },
    fieldLabel: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
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
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    switchCopy: {
        flex: 1,
        gap: 3,
    },
    switchTitle: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
    switchSubtitle: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        lineHeight: 19,
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
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radii.full,
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    coverActionText: {
        color: Colors.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    coverSecondaryAction: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radii.full,
        backgroundColor: Colors.light.background,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    coverSecondaryActionText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    footerActions: {
        gap: Spacing.sm,
        paddingBottom: Spacing.xl,
    },
    secondaryAction: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.md,
    },
    secondaryActionText: {
        color: Colors.primary,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
    primaryAction: {
        width: '100%',
    },
    destructiveAction: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.danger,
        backgroundColor: Colors.dangerSubtle,
        paddingHorizontal: Spacing.md,
    },
    destructiveActionText: {
        color: Colors.danger,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
});
