import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React from 'react';
import { Image, Platform, StyleProp, StyleSheet, Switch, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as api from '../../api/client';
import { Colors, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { AppKeyboardAwareScrollView } from '../ui/AppKeyboardAwareScrollView';
import { KeyboardStickyFooter } from '../ui/KeyboardStickyFooter';
import { PrimaryButton } from '../ui/PrimaryButton';
import { TextField } from '../ui/TextField';
import { MeetupFormValues } from './MeetupFormState';

export type MeetupFormStep = 'essentials' | 'when_where' | 'attendance';

interface MeetupFormProps {
    title: string;
    values: MeetupFormValues;
    categories: api.MeetupCategory[];
    friends: api.FriendUser[];
    mode: 'create' | 'published';
    step: MeetupFormStep;
    stepIndex: number;
    stepTotal: number;
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
    onBackStep?: () => void;
    onSecondaryAction?: () => void;
    onDestructiveAction?: () => void;
    onCancelEdit?: () => void;
    contentStyle?: StyleProp<ViewStyle>;
}

type PickerField = 'starts_on' | 'starts_at' | 'ends_on' | 'ends_at' | null;

interface ChoiceChipProps {
    label: string;
    selected: boolean;
    onPress: () => void;
}

interface StepMeta {
    key: MeetupFormStep;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}

const STEPS: StepMeta[] = [
    { key: 'essentials', label: 'Essentials', icon: 'sparkles-outline' },
    { key: 'when_where', label: 'When & Where', icon: 'calendar-outline' },
    { key: 'attendance', label: 'Attendance', icon: 'people-outline' },
];
const CO_HOST_PREVIEW_LIMIT = 3;
const CO_HOST_SEARCH_LIMIT = 6;

function ChoiceChip({ label, selected, onPress }: ChoiceChipProps): React.ReactElement {
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

function EventTypeChoice({
    type,
    selected,
    onPress,
}: {
    type: api.MeetupEventType;
    selected: boolean;
    onPress: () => void;
}): React.ReactElement {
    const icon: keyof typeof Ionicons.glyphMap = type === 'online'
        ? 'videocam-outline'
        : type === 'hybrid'
            ? 'git-compare-outline'
            : 'location-outline';
    const label = type === 'in_person' ? 'In person' : type === 'online' ? 'Online' : 'Hybrid';

    return (
        <TouchableOpacity
            style={[styles.eventTypeCard, selected && styles.eventTypeCardSelected]}
            onPress={onPress}
            activeOpacity={0.86}
        >
            <View style={[styles.eventTypeIcon, selected && styles.eventTypeIconSelected]}>
                <Ionicons name={icon} size={19} color={selected ? Colors.textOn.primary : Colors.primary} />
            </View>
            <Text style={[styles.eventTypeLabel, selected && styles.eventTypeLabelSelected]}>{label}</Text>
        </TouchableOpacity>
    );
}

function ExpandableSection({
    title,
    summary,
    expanded,
    onToggle,
    children,
}: {
    title: string;
    summary: string;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}): React.ReactElement {
    return (
        <View style={styles.expandable}>
            <TouchableOpacity style={styles.expandableHeader} onPress={onToggle} activeOpacity={0.84}>
                <View style={styles.expandableCopy}>
                    <Text style={styles.expandableTitle}>{title}</Text>
                    <Text style={styles.expandableSummary}>{summary}</Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
            {expanded ? <View style={styles.expandableBody}>{children}</View> : null}
        </View>
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

function getStepSubtitle(step: MeetupFormStep, mode: 'create' | 'published'): string {
    if (step === 'essentials') {
        return mode === 'published' ? 'Update the public face of this meetup.' : 'Name the meetup and set its format.';
    }
    if (step === 'when_where') {
        return 'Set the schedule and joining details.';
    }
    return 'Set optional capacity, hosts, and visibility.';
}

function getCoHostSummary(values: MeetupFormValues, friends: api.FriendUser[]): string {
    const selected = friends.filter((friend) => values.co_host_ids.includes(friend.user_id));
    if (!selected.length) return 'No co-hosts selected';
    if (selected.length === 1) return selected[0].username;
    return `${selected.length} co-hosts selected`;
}

function getVisibilityLabel(visibility: api.MeetupVisibility): string {
    return visibility === 'public' ? 'Public' : 'Unlisted';
}

export function MeetupForm({
    title,
    values,
    categories,
    friends,
    mode,
    step,
    stepIndex,
    stepTotal,
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
    onBackStep,
    onSecondaryAction,
    onDestructiveAction,
    onCancelEdit,
    contentStyle,
}: MeetupFormProps): React.ReactElement {
    const [activePicker, setActivePicker] = React.useState<PickerField>(null);
    const [coHostQuery, setCoHostQuery] = React.useState('');
    const [locationAdvancedOpen, setLocationAdvancedOpen] = React.useState(false);
    const [coHostsOpen, setCoHostsOpen] = React.useState(values.co_host_ids.length > 0);
    const [visibilityOpen, setVisibilityOpen] = React.useState(false);
    const [footerHeight, setFooterHeight] = React.useState(0);
    const keyboardBottomOffset = footerHeight + Spacing.sm;
    const scrollContentStyle = React.useMemo(
        () => [
            styles.content,
            { paddingBottom: Spacing.md + footerHeight },
            contentStyle,
        ],
        [contentStyle, footerHeight],
    );
    const isOnline = values.event_type === 'online';
    const showLocationFields = values.event_type !== 'online';
    const selectedCoHosts = React.useMemo(
        () => friends.filter((friend) => values.co_host_ids.includes(friend.user_id)),
        [friends, values.co_host_ids],
    );
    const availableCoHosts = React.useMemo(() => {
        const query = coHostQuery.trim().toLowerCase();
        const unselectedFriends = friends.filter((friend) => !values.co_host_ids.includes(friend.user_id));
        if (!query) {
            return unselectedFriends.slice(0, CO_HOST_PREVIEW_LIMIT);
        }
        return unselectedFriends
            .filter((friend) => friend.username.toLowerCase().includes(query))
            .slice(0, CO_HOST_SEARCH_LIMIT);
    }, [coHostQuery, friends, values.co_host_ids]);
    const hasMoreCoHostsToSearch = !coHostQuery.trim() && friends.length - values.co_host_ids.length > CO_HOST_PREVIEW_LIMIT;
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

    const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date): void => {
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

    const toggleCoHost = (friend: api.FriendUser): void => {
        const next = values.co_host_ids.includes(friend.user_id)
            ? values.co_host_ids.filter((id) => id !== friend.user_id)
            : [...values.co_host_ids, friend.user_id];
        onChange('co_host_ids', next);
    };
    const footerBackAction = onBackStep ?? onCancelEdit;
    const footerBackLabel = onBackStep ? 'Back' : 'Cancel';
    const errorMessage = error ?? '';
    const titleHasError = errorMessage.includes('Title');
    const categoryHasError = errorMessage.includes('category');
    const cityHasError = errorMessage.includes('City');
    const onlineURLHasError = errorMessage.includes('Online');
    const capacityHasError = errorMessage.includes('Capacity');
    const latHasError = errorMessage.includes('Latitude');
    const lngHasError = errorMessage.includes('Longitude');

    const renderStepContent = (): React.ReactNode => {
        if (step === 'essentials') {
            return (
                <>
                    <View style={styles.coverSection}>
                        <TouchableOpacity style={styles.coverHero} onPress={onPickCover} activeOpacity={0.88} disabled={coverUploading}>
                            {coverPreviewUri ? (
                                <Image source={{ uri: coverPreviewUri }} style={styles.coverPreview} />
                            ) : (
                                <View style={styles.coverPlaceholder}>
                                    <Ionicons name="image-outline" size={28} color={Colors.primary} />
                                    <Text style={styles.coverPlaceholderTitle}>Add cover image</Text>
                                    <Text style={styles.coverPlaceholderText}>Choose a photo that represents the meetup.</Text>
                                </View>
                            )}
                            <View style={styles.coverOverlay}>
                                <Ionicons name={coverPreviewUri ? 'camera-outline' : 'add'} size={18} color={Colors.textOn.primary} />
                                <Text style={styles.coverOverlayText}>{coverUploading ? 'Uploading...' : coverPreviewUri ? 'Replace' : 'Upload'}</Text>
                            </View>
                        </TouchableOpacity>
                        {coverPreviewUri ? (
                            <TouchableOpacity style={styles.coverRemoveButton} onPress={onRemoveCover} activeOpacity={0.82} disabled={coverUploading}>
                                <Text style={styles.coverRemoveText}>Remove image</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Basics</Text>
                        <TextField
                            value={values.title}
                            onChangeText={(value) => onChange('title', value)}
                            placeholder="Event title"
                            style={titleHasError && styles.inputError}
                        />
                        <Text style={styles.fieldLabel}>Category</Text>
                        <View style={[styles.wrap, categoryHasError && styles.choiceError]}>
                            {categories.map((category) => (
                                <ChoiceChip
                                    key={category.slug}
                                    label={category.label}
                                    selected={values.category_slug === category.slug}
                                    onPress={() => onChange('category_slug', category.slug)}
                                />
                            ))}
                        </View>
                        <Text style={styles.fieldLabel}>Format</Text>
                        <View style={styles.eventTypeGrid}>
                            {(['in_person', 'online', 'hybrid'] as api.MeetupEventType[]).map((type) => (
                                <EventTypeChoice
                                    key={type}
                                    type={type}
                                    selected={values.event_type === type}
                                    onPress={() => onChange('event_type', type)}
                                />
                            ))}
                        </View>
                        <TextField
                            value={values.description}
                            onChangeText={(value) => onChange('description', value)}
                            placeholder="What should people expect?"
                            multiline
                            style={styles.multilineField}
                        />
                    </View>
                </>
            );
        }

        if (step === 'when_where') {
            return (
                <>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Schedule</Text>
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
                        <Text style={styles.sectionTitle}>{isOnline ? 'Online setup' : 'Location'}</Text>
                        <TextField
                            value={values.city}
                            onChangeText={(value) => onChange('city', value)}
                            placeholder="City"
                            style={cityHasError && styles.inputError}
                        />
                        <TextField value={values.country} onChangeText={(value) => onChange('country', value)} placeholder="Country" />
                        {showLocationFields ? (
                            <>
                                <TextField value={values.venue_name} onChangeText={(value) => onChange('venue_name', value)} placeholder="Venue name" />
                                <TextField value={values.address_line_1} onChangeText={(value) => onChange('address_line_1', value)} placeholder="Address line 1" />
                            </>
                        ) : null}
                        {(isOnline || values.event_type === 'hybrid') ? (
                            <TextField
                                value={values.online_url}
                                onChangeText={(value) => onChange('online_url', value)}
                                placeholder="Online event link"
                                autoCapitalize="none"
                                style={onlineURLHasError && styles.inputError}
                            />
                        ) : null}
                        <ExpandableSection
                            title="Advanced location"
                            summary="Directions, address line 2, and map coordinates"
                            expanded={locationAdvancedOpen}
                            onToggle={() => setLocationAdvancedOpen((current) => !current)}
                        >
                            {showLocationFields ? (
                                <>
                                    <TextField value={values.address_line_2} onChangeText={(value) => onChange('address_line_2', value)} placeholder="Address line 2" />
                                    <TextField value={values.how_to_find_us} onChangeText={(value) => onChange('how_to_find_us', value)} placeholder="How to find the group" />
                                </>
                            ) : null}
                            <View style={styles.row}>
                                <View style={styles.half}>
                                    <TextField
                                        value={values.lat}
                                        onChangeText={(value) => onChange('lat', value)}
                                        placeholder="Latitude"
                                        keyboardType="numbers-and-punctuation"
                                        autoCapitalize="none"
                                        style={latHasError && styles.inputError}
                                    />
                                </View>
                                <View style={styles.half}>
                                    <TextField
                                        value={values.lng}
                                        onChangeText={(value) => onChange('lng', value)}
                                        placeholder="Longitude"
                                        keyboardType="numbers-and-punctuation"
                                        autoCapitalize="none"
                                        style={lngHasError && styles.inputError}
                                    />
                                </View>
                            </View>
                        </ExpandableSection>
                    </View>
                </>
            );
        }

        return (
            <>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Attendance</Text>
                    <TextField
                        value={values.capacity}
                        onChangeText={(value) => onChange('capacity', value)}
                        placeholder="Capacity (optional)"
                        keyboardType="number-pad"
                        style={capacityHasError && styles.inputError}
                    />
                    <View style={styles.switchRow}>
                        <View style={styles.switchCopy}>
                            <Text style={styles.switchTitle}>Enable waitlist</Text>
                            <Text style={styles.switchSubtitle}>Let people join a queue if the event fills up.</Text>
                        </View>
                        <Switch
                            value={values.waitlist_enabled}
                            onValueChange={(value) => onChange('waitlist_enabled', value)}
                            trackColor={{ false: Colors.border.default, true: Colors.primary }}
                            thumbColor={Colors.bg.page}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Hosting</Text>
                    <ExpandableSection
                        title="Co-hosts"
                        summary={getCoHostSummary(values, friends)}
                        expanded={coHostsOpen}
                        onToggle={() => setCoHostsOpen((current) => !current)}
                    >
                        {friends.length ? (
                            <>
                                <TextField
                                    value={coHostQuery}
                                    onChangeText={setCoHostQuery}
                                    placeholder="Search friends by name"
                                    autoCapitalize="none"
                                />
                                {hasMoreCoHostsToSearch ? (
                                    <Text style={styles.coHostHint}>Showing a few friends. Search by name to find someone else.</Text>
                                ) : null}
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
                                        <Text style={styles.emptyText}>
                                            {coHostQuery.trim() ? 'No friends match that search.' : 'All available friends are selected.'}
                                        </Text>
                                    )}
                                </View>
                            </>
                        ) : (
                            <Text style={styles.emptyText}>Add friends first if you want co-host support on this event.</Text>
                        )}
                    </ExpandableSection>

                    <ExpandableSection
                        title="Visibility"
                        summary={getVisibilityLabel(values.visibility)}
                        expanded={visibilityOpen}
                        onToggle={() => setVisibilityOpen((current) => !current)}
                    >
                        <View style={styles.wrap}>
                            {(['public', 'unlisted'] as api.MeetupVisibility[]).map((visibility) => (
                                <ChoiceChip
                                    key={visibility}
                                    label={getVisibilityLabel(visibility)}
                                    selected={values.visibility === visibility}
                                    onPress={() => onChange('visibility', visibility)}
                                />
                            ))}
                        </View>
                    </ExpandableSection>
                </View>
            </>
        );
    };

    return (
        <View style={styles.container}>
            <AppKeyboardAwareScrollView
                contentContainerStyle={scrollContentStyle}
                bottomOffset={keyboardBottomOffset}
            >
                <View style={styles.progressBlock}>
                    <Text style={styles.progressText}>{`${STEPS[stepIndex]?.label ?? 'Step'} ${stepIndex + 1} of ${stepTotal}`}</Text>
                    <View style={styles.progressTrack}>
                        {STEPS.map((item, index) => (
                            <View
                                key={item.key}
                                style={[
                                    styles.progressSegment,
                                    index <= stepIndex && styles.progressSegmentActive,
                                ]}
                            />
                        ))}
                    </View>
                    <View style={styles.stepTitleRow}>
                        <View style={styles.stepIcon}>
                            <Ionicons name={STEPS[stepIndex]?.icon ?? 'sparkles-outline'} size={18} color={Colors.primary} />
                        </View>
                        <View style={styles.stepCopy}>
                            <Text style={styles.stepTitle}>{STEPS[stepIndex]?.label ?? title}</Text>
                            <Text style={styles.stepSubtitle}>{getStepSubtitle(step, mode)}</Text>
                        </View>
                    </View>
                </View>

                {!!error && (
                    <View style={styles.errorCard}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                <Animated.View
                    key={step}
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(100)}
                    style={styles.stepContent}
                >
                    {renderStepContent()}
                </Animated.View>
            </AppKeyboardAwareScrollView>

            <KeyboardStickyFooter contentStyle={styles.footer} onHeightChange={setFooterHeight}>
                <View style={styles.footerActionRow}>
                    {footerBackAction ? (
                        <TouchableOpacity style={styles.backStepButton} onPress={footerBackAction} activeOpacity={0.84} disabled={loading}>
                            {onBackStep ? <Ionicons name="chevron-back" size={18} color={Colors.primary} /> : null}
                            <Text style={styles.backStepText}>{footerBackLabel}</Text>
                        </TouchableOpacity>
                    ) : null}
                    <PrimaryButton
                        label={primaryActionLabel}
                        onPress={onPrimaryAction}
                        loading={loading}
                        variant={primaryActionVariant}
                        rightAdornment={<Ionicons name="chevron-forward" size={18} color={primaryActionVariant === 'warning' ? Colors.textOn.warning : Colors.textOn.primary} />}
                        style={styles.primaryAction}
                    />
                </View>
                {secondaryActionLabel && onSecondaryAction ? (
                    <View style={styles.footerSecondaryRow}>
                        <TouchableOpacity style={styles.secondaryAction} onPress={onSecondaryAction} activeOpacity={0.84} disabled={loading}>
                            <Text style={styles.secondaryActionText}>{secondaryActionLabel}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
                {destructiveActionLabel && onDestructiveAction ? (
                    <TouchableOpacity style={styles.destructiveAction} onPress={onDestructiveAction} activeOpacity={0.84} disabled={loading}>
                        <Text style={styles.destructiveActionText}>{destructiveActionLabel}</Text>
                    </TouchableOpacity>
                ) : null}
            </KeyboardStickyFooter>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: Spacing.md,
        gap: Spacing.lg,
    },
    progressBlock: {
        gap: Spacing.sm,
        paddingTop: Spacing.sm,
    },
    stepContent: {
        gap: Spacing.lg,
    },
    progressText: {
        ...TextStyles.caption,
        color: Colors.primary,
    },
    progressTrack: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    progressSegment: {
        flex: 1,
        height: 4,
        borderRadius: Radius.pill,
        backgroundColor: Colors.border.default,
    },
    progressSegmentActive: {
        backgroundColor: Colors.primary,
    },
    stepTitleRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        alignItems: 'center',
    },
    stepIcon: {
        width: 38,
        height: 38,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
    },
    stepCopy: {
        flex: 1,
        gap: 2,
    },
    stepTitle: {
        color: Colors.text.primary,
        fontSize: Typography.sizes.lg,
        fontWeight: '800',
    },
    stepSubtitle: {
        ...TextStyles.secondary,
    },
    errorCard: {
        borderRadius: Radius.lg,
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
    coverSection: {
        gap: Spacing.sm,
    },
    coverHero: {
        minHeight: 218,
        borderRadius: Radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
    },
    coverPreview: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    coverPlaceholder: {
        flex: 1,
        minHeight: 218,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        backgroundColor: Colors.bg.surface,
    },
    coverPlaceholderTitle: {
        color: Colors.text.primary,
        fontSize: Typography.sizes.md,
        fontWeight: '800',
    },
    coverPlaceholderText: {
        ...TextStyles.secondary,
        textAlign: 'center',
    },
    coverOverlay: {
        position: 'absolute',
        right: Spacing.md,
        bottom: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 9,
        backgroundColor: 'rgba(0,0,0,0.62)',
    },
    coverOverlayText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
    },
    coverRemoveButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: 9,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
    },
    coverRemoveText: {
        ...TextStyles.chip,
    },
    section: {
        gap: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.surface,
    },
    sectionTitle: {
        ...TextStyles.sectionTitle,
    },
    fieldLabel: {
        ...TextStyles.label,
    },
    wrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    chip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        minHeight: ControlSizes.chipMinHeight,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
    },
    chipSelected: {
        backgroundColor: Colors.primarySubtle,
        borderColor: Colors.primary,
    },
    chipText: {
        ...TextStyles.chip,
    },
    chipTextSelected: {
        color: Colors.primary,
    },
    eventTypeGrid: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    eventTypeCard: {
        flex: 1,
        minHeight: 88,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        padding: Spacing.sm,
    },
    eventTypeCardSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    eventTypeIcon: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
    },
    eventTypeIconSelected: {
        backgroundColor: Colors.primary,
    },
    eventTypeLabel: {
        ...TextStyles.caption,
        textAlign: 'center',
    },
    eventTypeLabelSelected: {
        color: Colors.primary,
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
    pickerButton: {
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
        minHeight: ControlSizes.inputMinHeight,
        borderWidth: 0.5,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
    },
    pickerButtonText: {
        ...TextStyles.input,
    },
    inlinePickerWrap: {
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.page,
        paddingHorizontal: Spacing.sm,
    },
    expandable: {
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        overflow: 'hidden',
    },
    expandableHeader: {
        minHeight: 58,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    expandableCopy: {
        flex: 1,
        gap: 2,
    },
    expandableTitle: {
        ...TextStyles.bodyEmphasis,
    },
    expandableSummary: {
        ...TextStyles.caption,
        color: Colors.text.secondary,
    },
    expandableBody: {
        gap: Spacing.sm,
        padding: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border.emphasis,
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
        ...TextStyles.bodyEmphasis,
    },
    switchSubtitle: {
        ...TextStyles.secondary,
    },
    coHostHint: {
        ...TextStyles.caption,
        color: Colors.text.secondary,
    },
    selectedHostChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radius.pill,
        backgroundColor: Colors.secondarySubtle,
        borderWidth: 1,
        borderColor: Colors.secondary,
    },
    selectedHostChipText: {
        ...TextStyles.label,
    },
    selectedHostChipRemove: {
        color: Colors.text.secondary,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        opacity: 0.84,
    },
    emptyText: {
        ...TextStyles.secondary,
    },
    inputError: {
        borderColor: Colors.danger,
        borderWidth: 1,
    },
    choiceError: {
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.danger,
        padding: Spacing.xs,
    },
    footer: {
        gap: Spacing.sm,
    },
    footerActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    backStepButton: {
        minHeight: ControlSizes.buttonMinHeight,
        minWidth: 92,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
    },
    backStepText: {
        color: Colors.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
    },
    footerSecondaryRow: {
        gap: Spacing.sm,
    },
    secondaryAction: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: ControlSizes.buttonMinHeight,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.md,
    },
    secondaryActionText: {
        color: Colors.primary,
        fontSize: TextStyles.button.fontSize,
        fontWeight: TextStyles.button.fontWeight,
    },
    primaryAction: {
        flex: 1,
    },
    destructiveAction: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: ControlSizes.buttonMinHeight,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.danger,
        backgroundColor: Colors.dangerSubtle,
        paddingHorizontal: Spacing.md,
    },
    destructiveActionText: {
        color: Colors.danger,
        fontSize: TextStyles.button.fontSize,
        fontWeight: TextStyles.button.fontWeight,
    },
});
