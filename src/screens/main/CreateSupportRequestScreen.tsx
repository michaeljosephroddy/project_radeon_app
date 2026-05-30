import { appAlert } from '@/components/ui/appAlert';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as api from '../../api/client';
import { CreateFlowFrame } from '../../components/ui/CreateFlowFrame';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../hooks/useAuth';
import { Colors, ContentInsets, ControlSizes, Radius, Spacing, TextStyles } from '../../theme';
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

type SupportCreateStep = 'need' | 'message' | 'preferences' | 'review';

interface SupportCreateStepMeta {
    key: SupportCreateStep;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}

const SUPPORT_CREATE_STEPS: SupportCreateStepMeta[] = [
    { key: 'need', label: 'Need', icon: 'heart-outline' },
    { key: 'message', label: 'Message', icon: 'chatbubble-ellipses-outline' },
    { key: 'preferences', label: 'Preferences', icon: 'options-outline' },
    { key: 'review', label: 'Review', icon: 'checkmark-circle-outline' },
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
    const [currentStep, setCurrentStep] = useState<SupportCreateStep>('need');
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
    const currentStepIndex = SUPPORT_CREATE_STEPS.findIndex((step) => step.key === currentStep);
    const safeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
    const isReviewStep = currentStep === 'review';
    const selectedTopicLabels = useMemo(
        () => form.topics.map((topic) => TOPIC_LABELS[topic]).filter((label, index, labels) => labels.indexOf(label) === index),
        [form.topics],
    );
    const preferredGenderLabel = useMemo(() => {
        const preferredGender = form.preferred_gender ?? 'no_preference';
        if (preferredGender === 'no_preference') return 'No preference';
        if (preferredGender === 'non_binary') return 'Non-binary';
        return preferredGender[0].toUpperCase() + preferredGender.slice(1);
    }, [form.preferred_gender]);
    const locationLabel = includeCity && locationCity ? locationCity : 'Hidden';

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

    const handleBackStep = useCallback((): void => {
        if (safeStepIndex <= 0) {
            handleBack();
            return;
        }
        setCurrentStep(SUPPORT_CREATE_STEPS[safeStepIndex - 1]?.key ?? 'need');
    }, [handleBack, safeStepIndex]);

    const handleNextStep = useCallback((): void => {
        if (currentStep === 'message' && !messageBody) {
            setFormError('Please describe the support you need before continuing.');
            return;
        }
        setFormError(null);
        setCurrentStep(SUPPORT_CREATE_STEPS[Math.min(safeStepIndex + 1, SUPPORT_CREATE_STEPS.length - 1)]?.key ?? 'review');
    }, [currentStep, messageBody, safeStepIndex]);

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

    const renderStepContent = (): React.ReactNode => {
        if (currentStep === 'need') {
            return (
                <>
                    <FormSection label="Support type">
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
                    </FormSection>

                    <FormSection label="Urgency">
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
                    </FormSection>

                    <FormSection label="Topics">
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
                    </FormSection>
                </>
            );
        }

        if (currentStep === 'message') {
            return (
                <FormSection label="What support do you need?">
                    <TextField
                        value={form.message ?? ''}
                        onChangeText={(message) => {
                            setForm((current) => ({ ...current, message }));
                            if (formError) setFormError(null);
                        }}
                        placeholder="Share what is happening and what kind of support would help."
                        multiline
                        style={[styles.formInput, styles.inputMultiline, formError && styles.inputError]}
                    />
                    {formError ? (
                        <Text style={styles.errorText}>{formError}</Text>
                    ) : null}
                </FormSection>
            );
        }

        if (currentStep === 'preferences') {
            return (
                <>
                    <FormSection label="Preferred gender">
                        <View style={styles.selectorWrap}>
                            {(['no_preference', 'woman', 'man', 'non_binary'] as api.PreferredGender[]).map((gender) => {
                                const active = (form.preferred_gender ?? 'no_preference') === gender;
                                const label = gender === 'no_preference'
                                    ? 'No preference'
                                    : gender === 'non_binary'
                                        ? 'Non-binary'
                                        : gender[0].toUpperCase() + gender.slice(1);
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
                    </FormSection>

                    <FormSection label="Location">
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
                    </FormSection>
                </>
            );
        }

        return (
            <View style={styles.reviewSection}>
                <ReviewRow label="Type" value={SUPPORT_TYPE_LABELS[form.support_type]} />
                <ReviewRow label="Urgency" value={URGENCY_LABELS[form.urgency]} />
                <ReviewRow label="Topics" value={selectedTopicLabels.join(', ') || 'No topics selected'} />
                <ReviewRow label="Preferred gender" value={preferredGenderLabel} />
                <ReviewRow label="Location" value={locationLabel} />
                <ReviewRow label="Message" value={messageBody || 'No message added'} last />
            </View>
        );
    };

    return (
        <CreateFlowFrame
            title="Create support request"
            onBack={handleBack}
            footer={(
                <View style={styles.footerActionRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={safeStepIndex > 0 ? handleBackStep : handleBack}
                        activeOpacity={0.84}
                        disabled={submitting}
                    >
                        {safeStepIndex > 0 ? <Ionicons name="chevron-back" size={18} color={Colors.primary} /> : null}
                        <Text style={styles.backButtonText}>{safeStepIndex > 0 ? 'Back' : 'Cancel'}</Text>
                    </TouchableOpacity>
                    <PrimaryButton
                        label={isReviewStep ? 'Post request' : 'Next'}
                        onPress={isReviewStep ? () => void handleSubmit() : handleNextStep}
                        loading={submitting}
                        disabled={submitting}
                        style={styles.primaryAction}
                        rightAdornment={!isReviewStep ? <Ionicons name="chevron-forward" size={18} color={Colors.textOn.primary} /> : null}
                    />
                </View>
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

            <View style={styles.progressBlock}>
                <Text style={styles.progressText}>{`${SUPPORT_CREATE_STEPS[safeStepIndex]?.label ?? 'Step'} ${safeStepIndex + 1} of ${SUPPORT_CREATE_STEPS.length}`}</Text>
                <View style={styles.progressTrack}>
                    {SUPPORT_CREATE_STEPS.map((item, index) => (
                        <View
                            key={item.key}
                            style={[
                                styles.progressSegment,
                                index <= safeStepIndex && styles.progressSegmentActive,
                            ]}
                        />
                    ))}
                </View>
                <View style={styles.stepTitleRow}>
                    <View style={styles.stepIcon}>
                        <Ionicons name={SUPPORT_CREATE_STEPS[safeStepIndex]?.icon ?? 'heart-outline'} size={18} color={Colors.primary} />
                    </View>
                    <View style={styles.stepCopy}>
                        <Text style={styles.stepTitle}>{SUPPORT_CREATE_STEPS[safeStepIndex]?.label ?? 'Support'}</Text>
                        <Text style={styles.stepSubtitle}>{getStepSubtitle(currentStep)}</Text>
                    </View>
                </View>
            </View>

            <Animated.View
                key={currentStep}
                entering={FadeIn.duration(160)}
                exiting={FadeOut.duration(100)}
                style={styles.stepContent}
            >
                {renderStepContent()}
            </Animated.View>
        </CreateFlowFrame>
    );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
    return (
        <View style={styles.formSection}>
            <Text style={styles.formLabel}>{label}</Text>
            {children}
        </View>
    );
}

function ReviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }): React.ReactElement {
    return (
        <View style={[styles.reviewRow, last && styles.reviewRowLast]}>
            <Text style={styles.reviewLabel}>{label}</Text>
            <Text style={styles.reviewValue}>{value}</Text>
        </View>
    );
}

function getStepSubtitle(step: SupportCreateStep): string {
    switch (step) {
        case 'need':
            return 'Choose the kind of support and how urgent it feels.';
        case 'message':
            return 'Write a clear request so people know how to help.';
        case 'preferences':
            return 'Set who can respond and whether to show your city.';
        case 'review':
            return 'Check everything before posting it to the community.';
    }
}

const styles = StyleSheet.create({
    headerCard: {},
    progressBlock: {
        gap: Spacing.sm,
    },
    stepContent: {
        gap: Spacing.md,
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
        alignItems: 'center',
        gap: Spacing.md,
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
        ...TextStyles.sectionTitle,
    },
    stepSubtitle: {
        ...TextStyles.secondary,
    },
    formSection: {
        gap: Spacing.sm,
    },
    formLabel: {
        ...TextStyles.label,
        color: Colors.text.secondary,
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
    formInput: {},
    inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
    inputError: {
        borderColor: Colors.danger,
        borderWidth: 1,
    },
    errorText: {
        ...TextStyles.caption,
        color: Colors.danger,
        fontWeight: '700',
    },
    footerActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    backButton: {
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
    backButtonText: {
        color: Colors.primary,
        fontSize: TextStyles.button.fontSize,
        fontWeight: TextStyles.button.fontWeight,
    },
    primaryAction: {
        flex: 1,
    },
    reviewSection: {
        marginHorizontal: -ContentInsets.screenHorizontal,
        borderTopWidth: 1,
        borderTopColor: Colors.border.emphasis,
    },
    reviewRow: {
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
        gap: Spacing.xs,
    },
    reviewRowLast: {
        borderBottomWidth: 0,
    },
    reviewLabel: {
        ...TextStyles.caption,
        color: Colors.text.muted,
        textTransform: 'uppercase',
    },
    reviewValue: {
        ...TextStyles.body,
        color: Colors.text.primary,
    },
});
