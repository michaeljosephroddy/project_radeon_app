import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    type LayoutChangeEvent,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import * as api from '../../api/client';
import { useInterests } from '../../hooks/queries/useInterests';
import { screenStandards } from '../../styles/screenStandards';
import { Colors, ContentInsets, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { formatUsername } from '../../utils/identity';
import { DatingPhotoCarousel } from './DatingPhotoCarousel';
import { DatingSortablePhotoGrid } from './DatingSortablePhotoGrid';
import { InterestSelector } from '../InterestSelector';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ScreenHeader } from '../ui/ScreenHeader';
import { TextField } from '../ui/TextField';

interface DatingProfileEditorScreenProps {
    profile: api.DatingProfile | null;
    loading: boolean;
    saving: boolean;
    uploading: boolean;
    reorderingPhotos: boolean;
    deletingPhotoIds: Set<string>;
    saveSuccessMessage?: string | null;
    onBack?: () => void;
    onSave: (input: api.UpdateDatingProfileInput) => void;
    onPickPhoto: () => void;
    onDeletePhoto: (photoId: string) => void;
    onReorderPhotos: (photoIds: string[]) => void;
}

const DATING_GOAL_OPTIONS: { value: api.DatingRelationshipGoal; label: string }[] = [
    { value: 'long_term', label: 'Long-term' },
    { value: 'life_partner', label: 'Life partner' },
    { value: 'casual', label: 'Casual' },
    { value: 'open_to_explore', label: 'Open to explore' },
];

const DATING_GENDER_OPTIONS: { value: api.UserGender; label: string }[] = [
    { value: 'woman', label: 'Women' },
    { value: 'man', label: 'Men' },
    { value: 'non_binary', label: 'Non-binary' },
];

const DATING_KIDS_OPTIONS: { value: api.DatingKidsStatus; label: string }[] = [
    { value: 'have_kids', label: 'Have kids' },
    { value: 'dont_have_kids', label: "Don't have kids" },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

type DatingProfileEditorTab = 'edit' | 'preview';
type RequiredDatingProfileField = 'photos' | 'bio' | 'interests' | 'goal' | 'interested';

const MAX_DATING_INTERESTS = 5;
const MAX_DATING_PROMPTS = 3;
const PROMPT_CATEGORY_TAB_MIN_WIDTH = 112;
const REQUIRED_DATING_PROFILE_FIELDS: RequiredDatingProfileField[] = ['photos', 'bio', 'interests', 'goal', 'interested'];

interface DatingPromptOption {
    key: string;
    label: string;
}

interface DatingPromptCategory {
    key: string;
    label: string;
    prompts: DatingPromptOption[];
}

const DATING_PROMPT_CATEGORIES: DatingPromptCategory[] = [
    {
        key: 'personal',
        label: 'Personal',
        prompts: [
            { key: 'small_thing_about_me', label: 'A small thing that says a lot about me' },
            { key: 'friends_describe_me', label: 'My friends would describe me as' },
            { key: 'proud_of', label: "One thing I'm proud of" },
            { key: 'happiest_when', label: "I'm happiest when" },
            { key: 'simple_pleasure', label: 'A simple pleasure I never get tired of' },
        ],
    },
    {
        key: 'sober_life',
        label: 'Sober life',
        prompts: [
            { key: 'recovery_lifestyle', label: 'My sober life looks like' },
            { key: 'best_part_sobriety', label: 'The best part of sobriety is' },
            { key: 'ideal_sober_date', label: 'My ideal alcohol-free night out' },
            { key: 'sober_win', label: "A sober win I'm proud of" },
            { key: 'how_i_reset', label: 'How I like to reset' },
        ],
    },
    {
        key: 'dating',
        label: 'Dating',
        prompts: [
            { key: 'looking_for', label: "I'm looking for someone who" },
            { key: 'green_flag', label: 'The green flag I notice first' },
            { key: 'great_first_date', label: 'A great first date would be' },
            { key: 'chemistry_when', label: "I know there's chemistry when" },
            { key: 'dating_intention', label: 'My dating intention is' },
        ],
    },
    {
        key: 'values',
        label: 'Values',
        prompts: [
            { key: 'make_time_for', label: 'Something I will always make time for' },
            { key: 'value_i_live_by', label: 'A value I live by' },
            { key: 'matters_most', label: 'What matters most to me right now' },
            { key: 'feel_connected_when', label: 'I feel most connected when' },
            { key: 'relationship_works_when', label: 'A relationship works best when' },
        ],
    },
    {
        key: 'weekends',
        label: 'Weekends',
        prompts: [
            { key: 'perfect_sunday', label: 'My perfect Sunday' },
            { key: 'usually_find_me', label: "You'll usually find me" },
            { key: 'sober_weekend', label: "A weekend plan I'll always say yes to" },
            { key: 'recharge', label: 'My favourite way to recharge' },
            { key: 'next_adventure', label: 'The next little adventure I want' },
        ],
    },
    {
        key: 'conversation',
        label: 'Conversation',
        prompts: [
            { key: 'ask_me_about', label: 'Ask me about' },
            { key: 'teach_me_about', label: 'Teach me something about' },
            { key: 'lets_debate', label: "Let's debate" },
            { key: 'make_me_laugh', label: 'The quickest way to make me laugh' },
            { key: 'voice_note_includes', label: 'A voice note from me probably includes' },
        ],
    },
];

const DATING_PROFILE_TABS: { key: DatingProfileEditorTab; label: string }[] = [
    { key: 'edit', label: 'Edit' },
    { key: 'preview', label: 'Preview' },
];

const DATING_PROMPT_OPTIONS = DATING_PROMPT_CATEGORIES.flatMap((category) => category.prompts);

export function DatingProfileEditorScreen({
    profile,
    loading,
    saving,
    uploading,
    reorderingPhotos,
    deletingPhotoIds,
    saveSuccessMessage,
    onBack,
    onSave,
    onPickPhoto,
    onDeletePhoto,
    onReorderPhotos,
}: DatingProfileEditorScreenProps) {
    const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
    const requiredSectionY = useRef<Partial<Record<RequiredDatingProfileField, number>>>({});
    const [activeTab, setActiveTab] = useState<DatingProfileEditorTab>('edit');
    const [validationAttempted, setValidationAttempted] = useState(false);
    const [bio, setBio] = useState(profile?.bio ?? '');
    const [goal, setGoal] = useState<api.DatingRelationshipGoal>(profile?.relationship_goal || 'long_term');
    const [interested, setInterested] = useState<api.UserGender[]>(profile?.interested_in_genders?.length ? profile.interested_in_genders : ['woman']);
    const [selectedInterests, setSelectedInterests] = useState<string[]>(profile?.interests ?? []);
    const [heightCm, setHeightCm] = useState(profile?.height_cm ? String(profile.height_cm) : '');
    const [jobTitle, setJobTitle] = useState(getInitialJobTitle(profile));
    const [company, setCompany] = useState(getInitialCompany(profile));
    const [school, setSchool] = useState(getInitialSchool(profile));
    const [course, setCourse] = useState(getInitialCourse(profile));
    const [kidsStatus, setKidsStatus] = useState<api.DatingKidsStatus>(profile?.kids_status ?? '');
    const [selectedPromptKeys, setSelectedPromptKeys] = useState<string[]>(() => createPromptKeyList(profile?.prompt_answers ?? []));
    const [promptAnswers, setPromptAnswers] = useState<Record<string, string>>(() => createPromptAnswerMap(profile?.prompt_answers ?? []));
    const [editingPromptKey, setEditingPromptKey] = useState<string | null>(null);
    const [promptPickerVisible, setPromptPickerVisible] = useState(false);
    const [activePromptCategory, setActivePromptCategory] = useState(DATING_PROMPT_CATEGORIES[0].key);
    const interestsQuery = useInterests(!loading);
    const interestOptions = Array.from(new Set([...(interestsQuery.data ?? []), ...selectedInterests])).sort((a, b) => a.localeCompare(b));
    const isComplete = Boolean(profile?.completed_at);
    const completionErrors: Record<RequiredDatingProfileField, string | null> = {
        photos: (profile?.photos ?? []).length === 0 ? 'Add at least one photo.' : null,
        bio: bio.trim().length === 0 ? 'Add a Dating bio.' : null,
        interests: selectedInterests.length === 0 ? 'Pick at least one interest.' : null,
        goal: goal === '' ? 'Choose a relationship goal.' : null,
        interested: interested.length === 0 ? 'Choose who you are interested in.' : null,
    };
    const missingCompletionItems = REQUIRED_DATING_PROFILE_FIELDS
        .map((field) => ({ field, message: completionErrors[field] }))
        .filter((item): item is { field: RequiredDatingProfileField; message: string } => item.message !== null);
    const showCompletionErrors = validationAttempted;
    const photos = [...(profile?.photos ?? [])].sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return a.created_at.localeCompare(b.created_at);
    });

    useEffect(() => {
        setBio(profile?.bio ?? '');
        setGoal(profile?.relationship_goal || 'long_term');
        setInterested(profile?.interested_in_genders?.length ? profile.interested_in_genders : ['woman']);
        setSelectedInterests(profile?.interests ?? []);
        setHeightCm(profile?.height_cm ? String(profile.height_cm) : '');
        setJobTitle(getInitialJobTitle(profile));
        setCompany(getInitialCompany(profile));
        setSchool(getInitialSchool(profile));
        setCourse(getInitialCourse(profile));
        setKidsStatus(profile?.kids_status ?? '');
        setSelectedPromptKeys(createPromptKeyList(profile?.prompt_answers ?? []));
        setPromptAnswers(createPromptAnswerMap(profile?.prompt_answers ?? []));
        setEditingPromptKey(null);
    }, [profile]);

    const toggleInterested = (gender: api.UserGender): void => {
        setInterested((current) => current.includes(gender)
            ? current.filter((item) => item !== gender)
            : [...current, gender]);
    };

    const toggleInterest = (interest: string): void => {
        setSelectedInterests((current) => current.includes(interest)
            ? current.filter((item) => item !== interest)
            : [...current, interest].sort((a, b) => a.localeCompare(b)));
    };

    const ensureFocusedInputVisible = useCallback((): void => {
        requestAnimationFrame(() => {
            scrollRef.current?.assureFocusedInputVisible();
        });
    }, []);

    const recordRequiredSectionLayout = (field: RequiredDatingProfileField) => (event: LayoutChangeEvent): void => {
        requiredSectionY.current[field] = event.nativeEvent.layout.y;
    };

    const scrollToRequiredSection = (field: RequiredDatingProfileField): void => {
        const y = requiredSectionY.current[field] ?? 0;
        requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: Math.max(y - Spacing.md, 0), animated: true });
        });
    };

    const updatePromptAnswer = (promptKey: string, value: string): void => {
        setPromptAnswers((current) => ({
            ...current,
            [promptKey]: value.slice(0, 220),
        }));
    };

    const addPrompt = (promptKey: string): void => {
        setSelectedPromptKeys((current) => {
            if (current.includes(promptKey) || current.length >= MAX_DATING_PROMPTS) return current;
            return [...current, promptKey];
        });
        setPromptAnswers((current) => ({ ...current, [promptKey]: current[promptKey] ?? '' }));
        setEditingPromptKey(promptKey);
        setPromptPickerVisible(false);
    };

    const removePrompt = (promptKey: string): void => {
        setSelectedPromptKeys((current) => current.filter((key) => key !== promptKey));
        setPromptAnswers((current) => {
            const next = { ...current };
            delete next[promptKey];
            return next;
        });
        setEditingPromptKey((current) => current === promptKey ? null : current);
    };

    const savePromptDraft = (promptKey: string): void => {
        if ((promptAnswers[promptKey] ?? '').trim().length === 0) {
            Alert.alert('Add an answer', 'Write a short answer before saving this prompt.');
            return;
        }
        setEditingPromptKey(null);
    };

    const save = (complete: boolean): void => {
        const trimmedHeight = heightCm.trim();
        const parsedHeight = trimmedHeight ? Number.parseInt(trimmedHeight, 10) : null;
        const nextPromptAnswers = selectedPromptKeys
            .map((promptKey) => ({
                prompt_key: promptKey,
                answer: (promptAnswers[promptKey] ?? '').trim(),
            }))
            .filter((answer) => answer.answer.length > 0)
            .slice(0, MAX_DATING_PROMPTS);
        onSave({
            bio: bio.trim(),
            relationship_goal: goal,
            interested_in_genders: interested,
            interests: selectedInterests,
            prompt_answers: nextPromptAnswers,
            height_cm: Number.isFinite(parsedHeight) ? parsedHeight : null,
            job_title: jobTitle.trim(),
            company: company.trim(),
            school: school.trim(),
            course: course.trim(),
            kids_status: kidsStatus,
            complete,
        });
    };

    const handlePrimarySave = (): void => {
        if (missingCompletionItems.length > 0) {
            setValidationAttempted(true);
            scrollToRequiredSection(missingCompletionItems[0].field);
            return;
        }
        setValidationAttempted(false);
        save(!isComplete);
    };

    const togglePause = (): void => {
        if (!profile) return;
        onSave({ paused: !profile.paused });
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {onBack ? <ScreenHeader title={isComplete ? 'Dating profile' : 'Set up Dating'} onBack={onBack} /> : null}

            <View style={styles.keyboardWrap}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={Colors.primary} size="large" />
                    </View>
                ) : (
                    <>
                        <View style={screenStandards.pageTabsWrap}>
                            <SegmentedControl
                                items={DATING_PROFILE_TABS}
                                activeKey={activeTab}
                                onChange={(next) => setActiveTab(next as DatingProfileEditorTab)}
                                layer="page"
                                tone="primary"
                                style={screenStandards.pageTabsControl}
                            />
                        </View>

                        {activeTab === 'edit' ? (
                            <KeyboardAwareScrollView
                                ref={scrollRef}
                                bottomOffset={Spacing.xl}
                                contentContainerStyle={styles.content}
                                extraKeyboardSpace={Spacing.xl}
                                keyboardDismissMode="interactive"
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                            <View style={styles.header}>
                                <Text style={styles.subtitle}>
                                    {isComplete ? 'Edit the profile people see in Dating.' : 'Complete this profile before you appear in Dating.'}
                                </Text>
                            </View>

                            <View
                                style={[styles.section, showCompletionErrors && completionErrors.photos && styles.sectionInvalid]}
                                onLayout={recordRequiredSectionLayout('photos')}
                            >
                                <Text style={[styles.sectionLabel, showCompletionErrors && completionErrors.photos && styles.sectionLabelInvalid]}>Photos</Text>
                                <DatingSortablePhotoGrid
                                    photos={photos}
                                    uploading={uploading}
                                    reordering={reorderingPhotos}
                                    deletingPhotoIds={deletingPhotoIds}
                                    onPickPhoto={onPickPhoto}
                                    onDeletePhoto={onDeletePhoto}
                                    onReorderPhotos={onReorderPhotos}
                                />
                                {showCompletionErrors && completionErrors.photos ? <Text style={styles.sectionErrorText}>{completionErrors.photos}</Text> : null}
                            </View>

                            <View
                                style={[styles.section, showCompletionErrors && completionErrors.bio && styles.sectionInvalid]}
                                onLayout={recordRequiredSectionLayout('bio')}
                            >
                                <Text style={[styles.sectionLabel, showCompletionErrors && completionErrors.bio && styles.sectionLabelInvalid]}>Dating bio</Text>
                                <TextField
                                    style={styles.bioInput}
                                    value={bio}
                                    onChangeText={setBio}
                                    onFocus={ensureFocusedInputVisible}
                                    multiline
                                    textAlignVertical="top"
                                    placeholder="What should someone know before they say hello?"
                                    placeholderTextColor={Colors.text.muted}
                                />
                                {showCompletionErrors && completionErrors.bio ? <Text style={styles.sectionErrorText}>{completionErrors.bio}</Text> : null}
                            </View>

                            <View
                                style={[styles.section, showCompletionErrors && completionErrors.interests && styles.sectionInvalid]}
                                onLayout={recordRequiredSectionLayout('interests')}
                            >
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={[styles.sectionLabel, showCompletionErrors && completionErrors.interests && styles.sectionLabelInvalid]}>Interests</Text>
                                    <Text style={styles.sectionCount}>{selectedInterests.length}/{MAX_DATING_INTERESTS}</Text>
                                </View>
                                <InterestSelector
                                    options={interestOptions}
                                    selected={selectedInterests}
                                    maxSelected={MAX_DATING_INTERESTS}
                                    loading={interestsQuery.isLoading}
                                    onToggle={toggleInterest}
                                />
                                {showCompletionErrors && completionErrors.interests ? <Text style={styles.sectionErrorText}>{completionErrors.interests}</Text> : null}
                            </View>

                            <View
                                style={[styles.section, showCompletionErrors && completionErrors.goal && styles.sectionInvalid]}
                                onLayout={recordRequiredSectionLayout('goal')}
                            >
                                <Text style={[styles.sectionLabel, showCompletionErrors && completionErrors.goal && styles.sectionLabelInvalid]}>Relationship goal</Text>
                                <View style={styles.chipWrap}>
                                    {DATING_GOAL_OPTIONS.map((option) => (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[styles.chip, goal === option.value && styles.chipActive]}
                                            onPress={() => setGoal(option.value)}
                                        >
                                            <Text style={[styles.chipText, goal === option.value && styles.chipTextActive]}>{option.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {showCompletionErrors && completionErrors.goal ? <Text style={styles.sectionErrorText}>{completionErrors.goal}</Text> : null}
                            </View>

                            <View style={styles.section}>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionLabel}>Prompts</Text>
                                    <Text style={styles.sectionCount}>{selectedPromptKeys.length}/{MAX_DATING_PROMPTS}</Text>
                                </View>
                                <View style={styles.promptStack}>
                                    {selectedPromptKeys.length === 0 ? (
                                        <Text style={styles.promptEmpty}>Add up to three prompts to make your profile easier to start a conversation with.</Text>
                                    ) : null}
                                    {selectedPromptKeys.map((promptKey) => {
                                        const prompt = getDatingPromptOption(promptKey);
                                        const answer = promptAnswers[prompt.key] ?? '';
                                        const isEditing = editingPromptKey === prompt.key;
                                        const canSavePrompt = answer.trim().length > 0;
                                        return (
                                            <View key={prompt.key} style={styles.promptField}>
                                                <View style={styles.promptCardHeader}>
                                                    <Text style={styles.promptLabel}>{prompt.label}</Text>
                                                    {isEditing ? (
                                                        <TouchableOpacity
                                                            style={[styles.promptSaveButton, !canSavePrompt && styles.promptSaveButtonDisabled]}
                                                            onPress={() => savePromptDraft(prompt.key)}
                                                            disabled={!canSavePrompt}
                                                            activeOpacity={0.85}
                                                            accessibilityRole="button"
                                                            accessibilityState={{ disabled: !canSavePrompt }}
                                                            accessibilityLabel={`Save ${prompt.label}`}
                                                        >
                                                            <Text style={[styles.promptSaveText, !canSavePrompt && styles.promptSaveTextDisabled]}>Save</Text>
                                                        </TouchableOpacity>
                                                    ) : (
                                                        <TouchableOpacity
                                                            style={styles.promptIconButton}
                                                            onPress={() => setEditingPromptKey(prompt.key)}
                                                            accessibilityRole="button"
                                                            accessibilityLabel={`Edit ${prompt.label}`}
                                                        >
                                                            <Ionicons name="pencil" size={15} color={Colors.text.secondary} />
                                                        </TouchableOpacity>
                                                    )}
                                                    <TouchableOpacity
                                                        style={styles.promptIconButton}
                                                        onPress={() => removePrompt(prompt.key)}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Remove ${prompt.label}`}
                                                    >
                                                        <Ionicons name="close" size={16} color={Colors.text.secondary} />
                                                    </TouchableOpacity>
                                                </View>
                                                {isEditing ? (
                                                    <TextField
                                                        value={answer}
                                                        onChangeText={(value) => updatePromptAnswer(prompt.key, value)}
                                                        onFocus={ensureFocusedInputVisible}
                                                        multiline
                                                        textAlignVertical="top"
                                                        placeholder="Add a short answer"
                                                        placeholderTextColor={Colors.text.muted}
                                                    />
                                                ) : (
                                                    <TouchableOpacity
                                                        style={styles.promptSavedAnswer}
                                                        onPress={() => setEditingPromptKey(prompt.key)}
                                                        activeOpacity={0.85}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Edit answer for ${prompt.label}`}
                                                    >
                                                        <Text style={styles.promptSavedAnswerText}>{answer.trim()}</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        );
                                    })}
                                    {selectedPromptKeys.length < MAX_DATING_PROMPTS && editingPromptKey === null ? (
                                        <TouchableOpacity
                                            style={styles.addPromptButton}
                                            onPress={() => setPromptPickerVisible(true)}
                                            activeOpacity={0.85}
                                            accessibilityRole="button"
                                            accessibilityLabel="Add prompt"
                                        >
                                            <Ionicons name="add" size={18} color={Colors.primary} />
                                            <Text style={styles.addPromptText}>Add prompt</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Height</Text>
                                <TextField
                                    value={heightCm}
                                    onChangeText={(value) => setHeightCm(value.replace(/[^0-9]/g, '').slice(0, 3))}
                                    onFocus={ensureFocusedInputVisible}
                                    keyboardType="number-pad"
                                    placeholder="Height in cm"
                                    placeholderTextColor={Colors.text.muted}
                                />
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Work</Text>
                                <TextField
                                    value={jobTitle}
                                    onChangeText={(value) => setJobTitle(value.slice(0, 80))}
                                    onFocus={ensureFocusedInputVisible}
                                    placeholder="Software developer"
                                    placeholderTextColor={Colors.text.muted}
                                />
                                <TextField
                                    value={company}
                                    onChangeText={(value) => setCompany(value.slice(0, 80))}
                                    onFocus={ensureFocusedInputVisible}
                                    placeholder="Company"
                                    placeholderTextColor={Colors.text.muted}
                                />
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Education</Text>
                                <TextField
                                    value={course}
                                    onChangeText={(value) => setCourse(value.slice(0, 80))}
                                    onFocus={ensureFocusedInputVisible}
                                    placeholder="Course"
                                    placeholderTextColor={Colors.text.muted}
                                />
                                <TextField
                                    value={school}
                                    onChangeText={(value) => setSchool(value.slice(0, 80))}
                                    onFocus={ensureFocusedInputVisible}
                                    placeholder="School"
                                    placeholderTextColor={Colors.text.muted}
                                />
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Kids</Text>
                                <View style={styles.chipWrap}>
                                    {DATING_KIDS_OPTIONS.map((option) => (
                                        <TouchableOpacity
                                            key={option.value || 'skip'}
                                            style={[styles.chip, kidsStatus === option.value && styles.chipActive]}
                                            onPress={() => setKidsStatus(option.value)}
                                        >
                                            <Text style={[styles.chipText, kidsStatus === option.value && styles.chipTextActive]}>{option.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View
                                style={[styles.section, showCompletionErrors && completionErrors.interested && styles.sectionInvalid]}
                                onLayout={recordRequiredSectionLayout('interested')}
                            >
                                <Text style={[styles.sectionLabel, showCompletionErrors && completionErrors.interested && styles.sectionLabelInvalid]}>Interested in</Text>
                                <View style={styles.chipWrap}>
                                    {DATING_GENDER_OPTIONS.map((option) => {
                                        const active = interested.includes(option.value);
                                        return (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[styles.chip, active && styles.chipActive]}
                                                onPress={() => toggleInterested(option.value)}
                                            >
                                                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                {showCompletionErrors && completionErrors.interested ? <Text style={styles.sectionErrorText}>{completionErrors.interested}</Text> : null}
                            </View>

                            <PrimaryButton
                                label={isComplete ? 'Save profile' : 'Complete profile'}
                                onPress={handlePrimarySave}
                                loading={saving}
                                disabled={saving}
                            />
                            {saveSuccessMessage ? (
                                <View style={styles.saveSuccessCard}>
                                    <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                                    <Text style={styles.saveSuccessText}>{saveSuccessMessage}</Text>
                                </View>
                            ) : null}
                            {isComplete ? (
                                <TouchableOpacity style={styles.pauseButton} onPress={togglePause} disabled={saving}>
                                    <Text style={styles.pauseText}>{profile?.paused ? 'Resume dating profile' : 'Pause dating profile'}</Text>
                                </TouchableOpacity>
                            ) : null}
                            </KeyboardAwareScrollView>
                        ) : (
                            <DatingProfilePreview
                                profile={profile}
                                bio={bio}
                                goal={goal}
                                interests={selectedInterests}
                                selectedPromptKeys={selectedPromptKeys}
                                promptAnswers={promptAnswers}
                                heightCm={heightCm}
                                jobTitle={jobTitle}
                                company={company}
                                school={school}
                                course={course}
                                kidsStatus={kidsStatus}
                            />
                        )}
                    </>
                )}
            </View>
            <PromptPickerModal
                visible={promptPickerVisible}
                activeCategory={activePromptCategory}
                selectedPromptKeys={selectedPromptKeys}
                onChangeCategory={setActivePromptCategory}
                onSelectPrompt={addPrompt}
                onClose={() => setPromptPickerVisible(false)}
            />
        </SafeAreaView>
    );
}

interface PromptPickerModalProps {
    visible: boolean;
    activeCategory: string;
    selectedPromptKeys: string[];
    onChangeCategory: (categoryKey: string) => void;
    onSelectPrompt: (promptKey: string) => void;
    onClose: () => void;
}

function PromptPickerModal({
    visible,
    activeCategory,
    selectedPromptKeys,
    onChangeCategory,
    onSelectPrompt,
    onClose,
}: PromptPickerModalProps): React.ReactElement {
    const selectedSet = new Set(selectedPromptKeys);
    const category = DATING_PROMPT_CATEGORIES.find((item) => item.key === activeCategory) ?? DATING_PROMPT_CATEGORIES[0];
    const atLimit = selectedPromptKeys.length >= MAX_DATING_PROMPTS;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={styles.promptPickerContainer} edges={['top', 'bottom']}>
                <View style={styles.promptPickerHeader}>
                    <Text style={styles.promptPickerTitle}>Add prompt</Text>
                    <TouchableOpacity style={styles.promptPickerClose} onPress={onClose} activeOpacity={0.85}>
                        <Ionicons name="close" size={22} color={Colors.text.primary} />
                    </TouchableOpacity>
                </View>

                <View style={[screenStandards.pageTabsWrap, styles.promptCategoryTabsWrap]}>
                    <View style={styles.promptCategoryHintRow}>
                        <Text style={styles.promptCategoryHintText}>Scroll for more</Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.text.muted} />
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.promptCategoryTabsContent}
                    >
                        <SegmentedControl
                            items={DATING_PROMPT_CATEGORIES.map((item) => ({ key: item.key, label: item.label }))}
                            activeKey={category.key}
                            onChange={onChangeCategory}
                            layer="page"
                            tone="primary"
                            style={[screenStandards.pageTabsControl, styles.promptCategoryControl]}
                        />
                    </ScrollView>
                </View>

                <ScrollView contentContainerStyle={styles.promptPickerList} showsVerticalScrollIndicator={false}>
                    {category.prompts.map((prompt) => {
                        const selected = selectedSet.has(prompt.key);
                        const disabled = selected || atLimit;
                        return (
                            <TouchableOpacity
                                key={prompt.key}
                                style={[styles.promptPickerRow, selected && styles.promptPickerRowSelected]}
                                onPress={() => onSelectPrompt(prompt.key)}
                                disabled={disabled}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityState={{ disabled, selected }}
                            >
                                <Text style={[styles.promptPickerRowText, selected && styles.promptPickerRowTextSelected]}>{prompt.label}</Text>
                                {selected ? (
                                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                                ) : (
                                    <Ionicons name="add-circle-outline" size={20} color={atLimit ? Colors.text.disabled : Colors.primary} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}

interface DatingProfilePreviewProps {
    profile: api.DatingProfile | null;
    bio: string;
    goal: api.DatingRelationshipGoal;
    interests: string[];
    selectedPromptKeys: string[];
    promptAnswers: Record<string, string>;
    heightCm: string;
    jobTitle: string;
    company: string;
    school: string;
    course: string;
    kidsStatus: api.DatingKidsStatus;
}

function DatingProfilePreview({
    profile,
    bio,
    goal,
    interests,
    selectedPromptKeys,
    promptAnswers,
    heightCm,
    jobTitle,
    company,
    school,
    course,
    kidsStatus,
}: DatingProfilePreviewProps): React.ReactElement {
    const username = profile?.username ?? 'Your profile';
    const displayName = profile?.age ? `${formatUsername(profile.username)}, ${profile.age}` : formatUsername(profile?.username);
    const locationLabel = profile?.city
        ? `${profile.city}${profile.country ? `, ${profile.country}` : ''}`
        : profile?.country ?? null;
    const goalLabel = relationshipGoalLabel(goal);
    const previewBio = bio.trim();
    const visiblePromptAnswers = selectedPromptKeys
        .map((promptKey) => {
            const prompt = getDatingPromptOption(promptKey);
            return { ...prompt, answer: (promptAnswers[prompt.key] ?? '').trim() };
        })
        .filter((prompt) => prompt.answer.length > 0)
        .slice(0, MAX_DATING_PROMPTS);
    const detailRows = [
        { icon: 'resize-outline' as const, label: 'Height', value: formatHeight(heightCm) },
        { icon: 'briefcase-outline' as const, label: 'Work', value: formatWork(jobTitle, company) },
        { icon: 'school-outline' as const, label: 'Education', value: formatEducation(course, school) },
        { icon: 'people-outline' as const, label: 'Kids', value: kidsStatusLabel(kidsStatus) },
    ].filter((detail): detail is { icon: 'resize-outline' | 'briefcase-outline' | 'school-outline' | 'people-outline'; label: string; value: string } => Boolean(detail.value));

    return (
        <ScrollView contentContainerStyle={styles.previewContent} showsVerticalScrollIndicator={false}>
            <View style={styles.previewPhoto}>
                <DatingPhotoCarousel
                    username={username}
                    photos={profile?.photos ?? []}
                    avatarSize={112}
                    style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.84)']}
                    locations={[0, 0.5, 1]}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />
                <View style={styles.previewHeroText} pointerEvents="none">
                    <Text style={styles.previewName}>{displayName}</Text>
                    {locationLabel ? <Text style={styles.previewMeta}>{locationLabel}</Text> : null}
                </View>
            </View>
            <View style={styles.previewBody}>
                <View style={styles.previewSection}>
                    <Text style={styles.previewSectionLabel}>Looking for</Text>
                    {goalLabel ? (
                        <View style={styles.previewGoalPill}>
                            <Ionicons name="heart-outline" size={16} color={Colors.primary} />
                            <Text style={styles.previewGoalText}>{goalLabel}</Text>
                        </View>
                    ) : (
                        <Text style={styles.previewPlaceholder}>Choose a relationship goal.</Text>
                    )}
                </View>
                <View style={styles.previewSection}>
                    <Text style={styles.previewSectionLabel}>About</Text>
                    {previewBio ? (
                        <Text style={styles.previewBio}>{previewBio}</Text>
                    ) : (
                        <Text style={styles.previewPlaceholder}>Add a Dating bio to preview how your profile will read.</Text>
                    )}
                </View>
                {interests.length > 0 ? (
                    <View style={styles.previewSection}>
                        <Text style={styles.previewSectionLabel}>Interests</Text>
                        <View style={styles.previewChipWrap}>
                            {interests.map((interest) => (
                                <View key={interest} style={styles.previewChip}>
                                    <Text style={styles.previewChipText}>{interest}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}
                {detailRows.length > 0 ? (
                    <View style={styles.previewSection}>
                        <Text style={styles.previewSectionLabel}>Basics</Text>
                        <View style={styles.previewDetails}>
                            {detailRows.map((detail) => (
                                <View key={detail.label} style={styles.previewDetailRow}>
                                    <Ionicons name={detail.icon} size={17} color={Colors.text.secondary} />
                                    <Text style={styles.previewDetailText}>{detail.value}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}
                {visiblePromptAnswers.length > 0 ? (
                    <View style={[styles.previewSection, styles.previewSectionLast]}>
                        <Text style={styles.previewSectionLabel}>Prompts</Text>
                        <View style={styles.previewPrompts}>
                            {visiblePromptAnswers.map((prompt, index) => (
                                <View key={prompt.key} style={[styles.previewPrompt, index > 0 && styles.previewPromptWithSeparator]}>
                                    <Text style={styles.previewPromptLabel}>{prompt.label}</Text>
                                    <Text style={styles.previewPromptAnswer}>{prompt.answer}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}
            </View>
        </ScrollView>
    );
}

function relationshipGoalLabel(goal: api.DatingRelationshipGoal): string | null {
    return DATING_GOAL_OPTIONS.find((option) => option.value === goal)?.label ?? null;
}

function kidsStatusLabel(status: api.DatingKidsStatus): string | null {
    return DATING_KIDS_OPTIONS.find((option) => option.value === status && option.value !== '')?.label ?? null;
}

function getInitialJobTitle(profile: api.DatingProfile | null): string {
    if (profile?.job_title) return profile.job_title;
    return splitLegacyWork(profile?.work).jobTitle;
}

function getInitialCompany(profile: api.DatingProfile | null): string {
    if (profile?.company) return profile.company;
    return splitLegacyWork(profile?.work).company;
}

function getInitialSchool(profile: api.DatingProfile | null): string {
    if (profile?.school) return profile.school;
    return splitLegacyEducation(profile?.education).school;
}

function getInitialCourse(profile: api.DatingProfile | null): string {
    if (profile?.course) return profile.course;
    return splitLegacyEducation(profile?.education).course;
}

function splitLegacyWork(work?: string | null): { jobTitle: string; company: string } {
    const value = work?.trim() ?? '';
    if (!value) return { jobTitle: '', company: '' };
    const [jobTitle, ...companyParts] = value.split(/\s+@\s+/);
    return {
        jobTitle: jobTitle.trim(),
        company: companyParts.join(' @ ').trim(),
    };
}

function splitLegacyEducation(education?: string | null): { course: string; school: string } {
    const value = education?.trim() ?? '';
    if (!value) return { course: '', school: '' };
    const [course, ...schoolParts] = value.split(/\s+@\s+/);
    return {
        course: course.trim(),
        school: schoolParts.join(' @ ').trim(),
    };
}

function formatWork(jobTitle: string, company: string): string | null {
    const trimmedTitle = jobTitle.trim();
    const trimmedCompany = company.trim();
    if (trimmedTitle && trimmedCompany) return `${trimmedTitle} @ ${trimmedCompany}`;
    return trimmedTitle || trimmedCompany || null;
}

function formatEducation(course: string, school: string): string | null {
    const trimmedCourse = course.trim();
    const trimmedSchool = school.trim();
    if (trimmedCourse && trimmedSchool) return `${trimmedCourse} @ ${trimmedSchool}`;
    return trimmedCourse || trimmedSchool || null;
}

function createPromptAnswerMap(answers: api.DatingPromptAnswer[]): Record<string, string> {
    return answers.reduce<Record<string, string>>((acc, answer) => {
        acc[answer.prompt_key] = answer.answer;
        return acc;
    }, {});
}

function createPromptKeyList(answers: api.DatingPromptAnswer[]): string[] {
    return answers
        .map((answer) => answer.prompt_key)
        .filter((promptKey, index, allKeys) => promptKey.length > 0 && allKeys.indexOf(promptKey) === index)
        .slice(0, MAX_DATING_PROMPTS);
}

function getDatingPromptOption(promptKey: string): DatingPromptOption {
    return DATING_PROMPT_OPTIONS.find((prompt) => prompt.key === promptKey) ?? {
        key: promptKey,
        label: 'Prompt',
    };
}

function formatHeight(rawHeightCm: string): string | null {
    const heightCm = Number.parseInt(rawHeightCm.trim(), 10);
    if (!Number.isFinite(heightCm) || heightCm <= 0) return null;
    return `${heightCm} cm`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    keyboardWrap: {
        flex: 1,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingTop: Spacing.sm,
        paddingBottom: ContentInsets.listBottom,
        gap: Spacing.lg,
    },
    header: {
        gap: Spacing.xs,
    },
    subtitle: {
        ...TextStyles.secondary,
        color: Colors.text.secondary,
    },
    section: {
        gap: Spacing.sm,
    },
    sectionInvalid: {
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.danger,
        backgroundColor: Colors.dangerSubtle,
        padding: Spacing.sm,
    },
    sectionLabel: {
        ...TextStyles.label,
        color: Colors.text.primary,
    },
    sectionLabelInvalid: {
        color: Colors.danger,
    },
    sectionErrorText: {
        ...TextStyles.caption,
        color: Colors.danger,
        fontWeight: '700',
    },
    saveSuccessCard: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.success,
        backgroundColor: Colors.successSubtle,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    saveSuccessText: {
        ...TextStyles.label,
        color: Colors.success,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    sectionCount: {
        ...TextStyles.caption,
        color: Colors.text.muted,
    },
    bioInput: {
        minHeight: 96,
    },
    promptStack: {
        gap: Spacing.sm,
    },
    promptField: {
        gap: Spacing.sm,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.sm,
    },
    promptCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    promptLabel: {
        flex: 1,
        ...TextStyles.caption,
        color: Colors.text.secondary,
        fontWeight: '700',
    },
    promptIconButton: {
        width: 30,
        height: 30,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.raised,
    },
    promptSaveButton: {
        minHeight: 30,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.primary,
    },
    promptSaveButtonDisabled: {
        backgroundColor: Colors.bg.raised,
    },
    promptSaveText: {
        ...TextStyles.caption,
        color: Colors.textOn.primary,
        fontWeight: '800',
    },
    promptSaveTextDisabled: {
        color: Colors.text.disabled,
    },
    promptSavedAnswer: {
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.raised,
        padding: Spacing.md,
    },
    promptSavedAnswerText: {
        ...TextStyles.body,
        color: Colors.text.primary,
        lineHeight: 21,
    },
    promptEmpty: {
        ...TextStyles.secondary,
        color: Colors.text.secondary,
    },
    addPromptButton: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    addPromptText: {
        ...TextStyles.label,
        color: Colors.primary,
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    chip: {
        minHeight: 40,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.surface,
    },
    chipActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    chipText: {
        ...TextStyles.label,
        color: Colors.text.primary,
    },
    chipTextActive: {
        color: Colors.textOn.primary,
    },
    pauseButton: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pauseText: {
        ...TextStyles.label,
        color: Colors.primary,
    },
    previewContent: {
        paddingTop: Spacing.sm,
        paddingBottom: ContentInsets.listBottom,
    },
    previewPhoto: {
        width: '100%',
        aspectRatio: 0.76,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.surface,
    },
    previewHeroText: {
        position: 'absolute',
        left: ContentInsets.screenHorizontal,
        right: ContentInsets.screenHorizontal,
        bottom: Spacing.lg,
        gap: 4,
    },
    previewBody: {
        paddingHorizontal: ContentInsets.screenHorizontal,
    },
    previewName: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        color: Colors.textOn.primary,
    },
    previewMeta: {
        ...TextStyles.secondary,
        color: Colors.textOn.primary,
        opacity: 0.88,
    },
    previewSection: {
        paddingVertical: Spacing.lg,
        gap: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
    },
    previewSectionLast: {
        borderBottomWidth: 0,
    },
    previewSectionLabel: {
        ...TextStyles.caption,
        color: Colors.text.primary,
        textTransform: 'uppercase',
        fontWeight: '800',
    },
    previewGoalPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        alignSelf: 'flex-start',
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.emphasis,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.bg.page,
    },
    previewGoalText: {
        ...TextStyles.label,
        color: Colors.text.secondary,
    },
    previewChipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    previewChip: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.emphasis,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.bg.page,
    },
    previewChipText: {
        ...TextStyles.caption,
        color: Colors.text.secondary,
        fontWeight: '700',
    },
    previewDetails: {
        gap: Spacing.md,
    },
    previewPrompts: {
        gap: Spacing.md,
    },
    previewPrompt: {
        gap: Spacing.xs,
    },
    previewPromptWithSeparator: {
        borderTopWidth: 1,
        borderTopColor: Colors.border.emphasis,
        paddingTop: Spacing.md,
    },
    previewPromptLabel: {
        ...TextStyles.caption,
        color: Colors.text.primary,
        fontWeight: '800',
    },
    previewPromptAnswer: {
        ...TextStyles.body,
        color: Colors.text.secondary,
        lineHeight: 21,
    },
    previewDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    previewDetailText: {
        ...TextStyles.secondary,
        color: Colors.text.secondary,
    },
    previewBio: {
        ...TextStyles.body,
        color: Colors.text.secondary,
        lineHeight: 22,
    },
    previewPlaceholder: {
        ...TextStyles.secondary,
        color: Colors.text.muted,
        lineHeight: 21,
    },
    promptPickerContainer: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    promptPickerHeader: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    promptPickerTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    promptPickerClose: {
        width: 40,
        height: 40,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.surface,
    },
    promptCategoryTabsWrap: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    promptCategoryHintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        gap: 2,
        marginBottom: Spacing.xs,
    },
    promptCategoryHintText: {
        ...TextStyles.caption,
        color: Colors.text.muted,
    },
    promptCategoryTabsContent: {
        flexGrow: 1,
    },
    promptCategoryControl: {
        minWidth: DATING_PROMPT_CATEGORIES.length * PROMPT_CATEGORY_TAB_MIN_WIDTH,
    },
    promptPickerList: {
        paddingHorizontal: Spacing.md,
        paddingBottom: ContentInsets.listBottom,
        gap: Spacing.sm,
    },
    promptPickerRow: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    promptPickerRowSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    promptPickerRowText: {
        flex: 1,
        ...TextStyles.body,
        color: Colors.text.primary,
    },
    promptPickerRowTextSelected: {
        color: Colors.primary,
        fontWeight: '700',
    },
});
