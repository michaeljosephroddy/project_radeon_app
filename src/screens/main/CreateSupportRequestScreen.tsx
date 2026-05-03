import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { CreateSurfaceHeader, CREATE_SURFACE_HEADER_HEIGHT } from '../../components/ui/CreateSurfaceHeader';
import { InfoNoticeCard } from '../../components/ui/InfoNoticeCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../hooks/useAuth';
import { screenStandards } from '../../styles/screenStandards';
import { Colors, Radius, Spacing, TextStyles } from '../../theme';

interface CreateSupportRequestScreenProps {
    onBack: () => void;
    onCreated: (request: api.SupportRequest) => void;
}

const SUPPORT_TYPE_LABELS: Record<api.SupportType, string> = {
    chat: 'Chat',
    call: 'Call',
    meetup: 'Meetup',
    general: 'General',
};

const URGENCY_LABELS: Record<api.SupportUrgency, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

const TOPIC_LABELS: Record<api.SupportTopic, string> = {
    anxiety: 'Anxiety',
    relapse_risk: 'Relapse risk',
    loneliness: 'Loneliness',
    cravings: 'Cravings',
    depression: 'Depression',
    family: 'Family',
    work: 'Work',
    sleep: 'Sleep',
    celebration: 'Celebration',
    general: 'General',
};

const SUPPORT_TYPES: api.SupportType[] = ['chat', 'call', 'meetup', 'general'];
const URGENCIES: api.SupportUrgency[] = ['low', 'medium', 'high'];
const TOPICS: api.SupportTopic[] = [
    'anxiety',
    'relapse_risk',
    'loneliness',
    'cravings',
    'depression',
    'family',
    'work',
    'sleep',
    'celebration',
    'general',
];

function defaultSupportForm(): api.CreateSupportRequestInput {
    return {
        support_type: 'chat',
        message: '',
        urgency: 'low',
        topics: [],
        preferred_gender: null,
        location: null,
        privacy_level: 'standard',
    };
}

export function CreateSupportRequestScreen({
    onBack,
    onCreated,
}: CreateSupportRequestScreenProps): React.ReactElement {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [form, setForm] = useState<api.CreateSupportRequestInput>(defaultSupportForm);
    const [showNotice, setShowNotice] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const city = user?.current_city ?? user?.city ?? null;
    const includeCity = form.location?.visibility === 'city';

    const toggleTopic = useCallback((topic: api.SupportTopic) => {
        setForm((current) => ({
            ...current,
            topics: current.topics.includes(topic)
                ? current.topics.filter((item) => item !== topic)
                : [...current.topics, topic],
        }));
    }, []);

    const handleSubmit = useCallback(async () => {
        setSubmitting(true);
        try {
            const payload: api.CreateSupportRequestInput = {
                ...form,
                message: form.message?.trim() || null,
                topics: form.topics.length > 0 ? form.topics : ['general'],
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
            onCreated(created);
        } catch (error: unknown) {
            Alert.alert('Could not create support request', error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    }, [form, onCreated, queryClient]);

    return (
        <View style={styles.container}>
            <CreateSurfaceHeader onBack={onBack} title="Create support request" />
            <ScrollView contentContainerStyle={[screenStandards.detailContent, screenStandards.scrollContent, styles.content]}>
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

                {city ? (
                    <>
                        <Text style={styles.formLabel}>Location</Text>
                        <View style={styles.selectorWrap}>
                            <TouchableOpacity
                                style={[styles.selectorChip, !includeCity && styles.selectorChipActive]}
                                onPress={() => setForm((current) => ({ ...current, location: null }))}
                            >
                                <Text style={[styles.selectorChipText, !includeCity && styles.selectorChipTextActive]}>Hidden</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.selectorChip, includeCity && styles.selectorChipActive]}
                                onPress={() => setForm((current) => ({
                                    ...current,
                                    location: { city, visibility: 'city' },
                                }))}
                            >
                                <Text style={[styles.selectorChipText, includeCity && styles.selectorChipTextActive]}>{city}</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : null}

                <TextField
                    value={form.message ?? ''}
                    onChangeText={(message) => setForm((current) => ({ ...current, message }))}
                    placeholder="Optional note"
                    multiline
                    style={[styles.formInput, styles.inputMultiline]}
                />

                <PrimaryButton
                    label={submitting ? 'Posting...' : 'Post request'}
                    onPress={() => void handleSubmit()}
                    disabled={submitting}
                    style={styles.submitButton}
                />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    content: { paddingTop: CREATE_SURFACE_HEADER_HEIGHT + Spacing.sm },
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
    selectorChipText: { ...TextStyles.chip },
    selectorChipTextActive: { color: Colors.textOn.primary, fontWeight: '700' },
    formInput: { marginTop: Spacing.md },
    inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
    submitButton: { marginTop: Spacing.lg },
});
