import { appAlert } from '@/components/ui/appAlert';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { CreateFlowFrame } from '../../components/ui/CreateFlowFrame';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Radius, Spacing, TextStyles } from '../../theme';
import { getDeviceCoords, reverseGeocodePlace } from '../../utils/location';

interface CreateSupportRequestScreenProps {
    onBack: () => void;
    onCreated: (request: api.SupportRequest) => void;
}

const SUPPORT_TYPE_LABELS: Record<api.SupportType, string> = {
    chat: 'Chat',
    call: 'Call',
    meetup: 'Meetup',
};

const URGENCY_LABELS: Record<api.SupportUrgency, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

const TOPIC_LABELS: Record<api.SupportTopic, string> = {
    cravings: 'Cravings',
    relapse_risk: 'Relapse risk',
    mental_health: 'Mental health',
    loneliness: 'Loneliness',
    relationships: 'Relationships',
    practical_support: 'Practical support',
    anxiety: 'Mental health',
    depression: 'Mental health',
    family: 'Relationships',
    work: 'Practical support',
    sleep: 'Practical support',
    celebration: 'General support',
    general: 'General support',
};

const SUPPORT_TYPES: api.SupportType[] = ['chat', 'call', 'meetup'];
const URGENCIES: api.SupportUrgency[] = ['low', 'medium', 'high'];
const TOPICS: api.SupportTopic[] = [
    'cravings',
    'relapse_risk',
    'mental_health',
    'loneliness',
    'relationships',
    'practical_support',
];

function defaultSupportForm(city?: string | null): api.CreateSupportRequestInput {
    return {
        support_type: 'chat',
        message: '',
        urgency: 'low',
        topics: [],
        preferred_gender: null,
        location: city ? { city, visibility: 'city' } : null,
        privacy_level: 'standard',
    };
}

export function CreateSupportRequestScreen({
    onBack,
    onCreated,
}: CreateSupportRequestScreenProps): React.ReactElement {
    const { user, refreshUser } = useAuth();
    const queryClient = useQueryClient();
    const initialCity = user?.current_city ?? user?.city ?? null;
    const [form, setForm] = useState<api.CreateSupportRequestInput>(() => defaultSupportForm(initialCity));
    const [showNotice, setShowNotice] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const storedCity = user?.current_city ?? user?.city ?? null;
    const selectedLocationCity = form.location?.visibility === 'city' ? form.location.city ?? null : null;
    const locationCity = storedCity ?? selectedLocationCity;
    const includeCity = form.location?.visibility === 'city';
    const messageBody = form.message?.trim() ?? '';
    const defaultLocationCity = initialCity ?? null;
    const currentLocationCity = form.location?.visibility === 'city' ? form.location.city ?? null : null;
    const hasDraft = messageBody.length > 0
        || form.topics.length > 0
        || form.support_type !== 'chat'
        || form.urgency !== 'low'
        || form.preferred_gender !== null
        || currentLocationCity !== defaultLocationCity;
    const handleBack = useCallback((): void => {
        if (!hasDraft || submitting) {
            onBack();
            return;
        }

        appAlert.alert('Discard request?', 'Your current support request will be lost.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: onBack },
        ]);
    }, [hasDraft, onBack, submitting]);

    const toggleTopic = useCallback((topic: api.SupportTopic) => {
        setForm((current) => ({
            ...current,
            topics: current.topics.includes(topic)
                ? current.topics.filter((item) => item !== topic)
                : [...current.topics, topic],
        }));
    }, []);

    const handleUseCurrentLocation = useCallback(async (): Promise<void> => {
        if (detectingLocation) return;

        setDetectingLocation(true);
        try {
            const result = await getDeviceCoords();
            if (result.status !== 'available' || !result.coords) {
                const message = result.status === 'services_off'
                    ? 'Turn on location services, then try again.'
                    : result.status === 'denied'
                        ? 'Allow location access to use your current city.'
                        : 'We could not detect your location. Please try again.';
                appAlert.alert('Location unavailable', message);
                return;
            }

            const detectedPlace = await reverseGeocodePlace(result.coords.latitude, result.coords.longitude);
            if (!detectedPlace?.city || !detectedPlace.country) {
                appAlert.alert('Location unavailable', 'We could not identify your city from your current location.');
                return;
            }

            await api.updateMyCurrentLocation({
                lat: result.coords.latitude,
                lng: result.coords.longitude,
                city: detectedPlace.city,
                country: detectedPlace.country,
            });
            await refreshUser();
            setForm((current) => ({
                ...current,
                location: { city: detectedPlace.city, country: detectedPlace.country, visibility: 'city' },
            }));
        } catch (error: unknown) {
            appAlert.alert('Location unavailable', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setDetectingLocation(false);
        }
    }, [detectingLocation, refreshUser]);

    const handleSubmit = useCallback(async () => {
        const trimmedMessage = form.message?.trim() ?? '';
        if (!trimmedMessage) {
            setFormError('Please describe the support you need before posting.');
            return;
        }

        setFormError(null);
        setSubmitting(true);
        try {
            const payload: api.CreateSupportRequestInput = {
                ...form,
                message: trimmedMessage,
                topics: form.topics,
                location: form.location?.visibility === 'city' ? form.location : null,
            };
            const created = await api.createSupportRequest(payload);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
                queryClient.invalidateQueries({ queryKey: ['support-offers'] }),
                queryClient.invalidateQueries({ queryKey: ['support-replies'] }),
                queryClient.invalidateQueries({ queryKey: ['groups'] }),
                queryClient.invalidateQueries({ queryKey: ['chats'] }),
            ]);
            appAlert.alert('Request posted', 'Your support request is live.');
            onCreated(created);
        } catch (error: unknown) {
            appAlert.alert('Could not create support request', error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    }, [form, onCreated, queryClient]);

    return (
        <CreateFlowFrame
            title="Create support request"
            onBack={handleBack}
            footer={(
                <PrimaryButton
                    label={submitting ? 'Posting...' : 'Post request'}
                    onPress={() => void handleSubmit()}
                    loading={submitting}
                    disabled={submitting}
                />
            )}
        >
            {showNotice ? (
                <InfoNoticeCard
                    title="Create support request"
                    description="Tell the community what support you need and how people can respond."
                    style={styles.headerCard}
                    onDismiss={() => setShowNotice(false)}
                />
            ) : null}

            <Text style={styles.formLabel}>Support type</Text>
            <View style={styles.selectorWrap}>
                {SUPPORT_TYPES.map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={[styles.selectorChip, form.support_type === type && styles.selectorChipActive]}
                        onPress={() => setForm((current) => ({ ...current, support_type: type }))}
                    >
                        <Text style={[styles.selectorChipText, form.support_type === type && styles.selectorChipTextActive]}>
                            {SUPPORT_TYPE_LABELS[type]}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.formLabel}>Urgency</Text>
            <View style={styles.selectorWrap}>
                {URGENCIES.map((urgency) => (
                    <TouchableOpacity
                        key={urgency}
                        style={[styles.selectorChip, form.urgency === urgency && styles.selectorChipActive]}
                        onPress={() => setForm((current) => ({ ...current, urgency }))}
                    >
                        <Text style={[styles.selectorChipText, form.urgency === urgency && styles.selectorChipTextActive]}>
                            {URGENCY_LABELS[urgency]}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.formLabel}>Topics</Text>
            <View style={styles.selectorWrap}>
                {TOPICS.map((topic) => {
                    const active = form.topics.includes(topic);
                    return (
                        <TouchableOpacity
                            key={topic}
                            style={[styles.selectorChip, active && styles.selectorChipActive]}
                            onPress={() => toggleTopic(topic)}
                        >
                            <Text style={[styles.selectorChipText, active && styles.selectorChipTextActive]}>
                                {TOPIC_LABELS[topic]}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.formLabel}>Preferred gender</Text>
            <View style={styles.selectorWrap}>
                {(['no_preference', 'woman', 'man', 'non_binary'] as api.PreferredGender[]).map((gender) => {
                    const active = (form.preferred_gender ?? 'no_preference') === gender;
                    const label = gender === 'no_preference' ? 'No preference' : gender === 'non_binary' ? 'Non-binary' : gender[0].toUpperCase() + gender.slice(1);
                    return (
                        <TouchableOpacity
                            key={gender}
                            style={[styles.selectorChip, active && styles.selectorChipActive]}
                            onPress={() => setForm((current) => ({ ...current, preferred_gender: gender === 'no_preference' ? null : gender }))}
                        >
                            <Text style={[styles.selectorChipText, active && styles.selectorChipTextActive]}>{label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.formLabel}>Location</Text>
            <View style={styles.selectorWrap}>
                <TouchableOpacity
                    style={[styles.selectorChip, !includeCity && styles.selectorChipActive]}
                    onPress={() => setForm((current) => ({ ...current, location: null }))}
                >
                    <Text style={[styles.selectorChipText, !includeCity && styles.selectorChipTextActive]}>Hidden</Text>
                </TouchableOpacity>
                {locationCity ? (
                    <TouchableOpacity
                        style={[styles.selectorChip, includeCity && styles.selectorChipActive]}
                        onPress={() => setForm((current) => ({
                            ...current,
                            location: { city: locationCity, visibility: 'city' },
                        }))}
                    >
                        <Text style={[styles.selectorChipText, includeCity && styles.selectorChipTextActive]}>Use {locationCity}</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.selectorChip, detectingLocation && styles.selectorChipDisabled]}
                        onPress={() => void handleUseCurrentLocation()}
                        disabled={detectingLocation}
                    >
                        <Text style={styles.selectorChipText}>
                            {detectingLocation ? 'Detecting...' : 'Use current location'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <TextField
                value={form.message ?? ''}
                onChangeText={(message) => {
                    setForm((current) => ({ ...current, message }));
                    if (formError) setFormError(null);
                }}
                placeholder="What support do you need right now?"
                multiline
                style={[styles.formInput, styles.inputMultiline, formError && styles.inputError]}
            />
            {formError ? (
                <Text style={styles.errorText}>{formError}</Text>
            ) : null}
        </CreateFlowFrame>
    );
}

const styles = StyleSheet.create({
    headerCard: { marginBottom: Spacing.md },
    formLabel: {
        ...TextStyles.label,
        color: Colors.text.secondary,
        marginBottom: Spacing.sm,
        marginTop: Spacing.md,
    },
    selectorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    selectorChip: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
        backgroundColor: Colors.bg.surface,
    },
    selectorChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    selectorChipDisabled: { opacity: 0.6 },
    selectorChipText: { ...TextStyles.chip },
    selectorChipTextActive: { color: Colors.textOn.primary, fontWeight: '700' },
    formInput: { marginTop: Spacing.md },
    inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
    inputError: {
        borderColor: Colors.danger,
        borderWidth: 1,
    },
    errorText: {
        ...TextStyles.caption,
        color: Colors.danger,
        fontWeight: '700',
        marginTop: -Spacing.sm,
    },
});
