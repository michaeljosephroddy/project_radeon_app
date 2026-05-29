import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    type LayoutChangeEvent,
    Modal,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
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
import { Colors, ContentInsets, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { formatUsername } from '../../utils/identity';
import { DatingPhotoCarousel } from './DatingPhotoCarousel';
import { DatingSortablePhotoGrid } from './DatingSortablePhotoGrid';
import { InterestSelector } from '../InterestSelector';
import { InfoNoticeCard } from '../ui/InfoNoticeCard';
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
    { value: 'long_term', label: 'Long-term relationship' },
    { value: 'life_partner', label: 'Life partner' },
    { value: 'short_term_open_to_long_term', label: 'Short-term, open to long-term' },
    { value: 'still_figuring_it_out', label: 'Still figuring it out' },
    { value: 'new_sober_connections', label: 'New sober connections' },
];

const DATING_GENDER_OPTIONS: { value: api.UserGender; label: string }[] = [
    { value: 'woman', label: 'Women' },
    { value: 'man', label: 'Men' },
];

const DATING_INTERESTED_OPTIONS: { value: 'men' | 'women' | 'everyone'; label: string; genders: api.UserGender[] }[] = [
    { value: 'men', label: 'Men', genders: ['man'] },
    { value: 'women', label: 'Women', genders: ['woman'] },
    { value: 'everyone', label: 'Everyone', genders: ['woman', 'man', 'non_binary'] },
];

interface DatingOption<T extends string> {
    value: T;
    label: string;
}

const RELATIONSHIP_TYPE_OPTIONS: DatingOption<api.DatingRelationshipType>[] = [
    { value: 'monogamous', label: 'Monogamous' },
    { value: 'open_relationship', label: 'Open relationship' },
    { value: 'other', label: 'Other' },
];

const PROFILE_GENDER_OPTIONS: DatingOption<api.DatingProfileGender>[] = [
    { value: 'woman', label: 'Woman' },
    { value: 'man', label: 'Man' },
    { value: 'non_binary', label: 'Non-binary' },
    { value: 'other', label: 'Other' },
];

const SEXUALITY_OPTIONS: DatingOption<api.DatingSexuality>[] = [
    { value: 'straight', label: 'Straight' },
    { value: 'gay', label: 'Gay' },
    { value: 'lesbian', label: 'Lesbian' },
    { value: 'bisexual', label: 'Bisexual' },
    { value: 'other', label: 'Other' },
];

const PRONOUNS_OPTIONS: DatingOption<api.DatingPronouns>[] = [
    { value: 'she_her', label: 'She/her' },
    { value: 'he_him', label: 'He/him' },
    { value: 'they_them', label: 'They/them' },
    { value: 'other', label: 'Other' },
];

const ETHNICITY_OPTIONS: DatingOption<api.DatingEthnicity>[] = [
    { value: 'asian', label: 'Asian' },
    { value: 'black', label: 'Black' },
    { value: 'hispanic_latino', label: 'Hispanic / Latino' },
    { value: 'middle_eastern', label: 'Middle Eastern' },
    { value: 'mixed', label: 'Mixed' },
    { value: 'native_indigenous', label: 'Native / Indigenous' },
    { value: 'white', label: 'White' },
    { value: 'other', label: 'Other' },
];

const CHILDREN_OPTIONS: DatingOption<api.DatingChildrenStatus>[] = [
    { value: 'have_children', label: 'Have children' },
    { value: 'have_children_want_more', label: 'Have children and want more' },
    { value: 'have_children_dont_want_more', label: 'Have children and do not want more' },
    { value: 'want_children', label: 'Want children' },
    { value: 'dont_want_children', label: 'Do not want children' },
    { value: 'open_to_children', label: 'Open to children' },
    { value: 'not_sure', label: 'Not sure' },
];

const PETS_OPTIONS: DatingOption<api.DatingPetsStatus>[] = [
    { value: 'have_pets', label: 'Have pets' },
    { value: 'want_pets', label: 'Want pets' },
    { value: 'like_pets', label: 'Like pets' },
    { value: 'allergic_to_pets', label: 'Allergic to pets' },
    { value: 'not_a_pet_person', label: 'Not a pet person' },
];

const RELIGIOUS_BELIEF_OPTIONS: DatingOption<api.DatingReligiousBelief>[] = [
    { value: 'agnostic', label: 'Agnostic' },
    { value: 'atheist', label: 'Atheist' },
    { value: 'buddhist', label: 'Buddhist' },
    { value: 'christian', label: 'Christian' },
    { value: 'hindu', label: 'Hindu' },
    { value: 'jewish', label: 'Jewish' },
    { value: 'muslim', label: 'Muslim' },
    { value: 'sikh', label: 'Sikh' },
    { value: 'spiritual', label: 'Spiritual' },
    { value: 'other', label: 'Other' },
];

const POLITICAL_VIEW_OPTIONS: DatingOption<api.DatingPoliticalView>[] = [
    { value: 'liberal', label: 'Liberal' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'conservative', label: 'Conservative' },
    { value: 'not_political', label: 'Not political' },
    { value: 'other', label: 'Other' },
];

const LANGUAGE_OPTIONS: DatingOption<string>[] = [
    'English', 'Irish', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch',
    'Polish', 'Romanian', 'Lithuanian', 'Latvian', 'Estonian', 'Russian', 'Ukrainian',
    'Czech', 'Slovak', 'Hungarian', 'Greek', 'Turkish', 'Arabic', 'Hebrew',
    'Persian / Farsi', 'Hindi', 'Urdu', 'Punjabi', 'Bengali', 'Gujarati', 'Tamil',
    'Telugu', 'Malayalam', 'Marathi', 'Nepali', 'Mandarin', 'Cantonese', 'Japanese',
    'Korean', 'Vietnamese', 'Thai', 'Indonesian', 'Malay', 'Filipino / Tagalog',
    'Swahili', 'Yoruba', 'Igbo', 'Amharic', 'Somali', 'Afrikaans', 'Other',
].map((label) => ({ label, value: label.toLowerCase().replace(/ \/ /g, '_').replace(/\s+/g, '_') }));

type DatingEditSection =
    | 'bio'
    | 'interests'
    | 'goal'
    | 'relationship_type'
    | 'interested'
    | 'gender'
    | 'sexuality'
    | 'pronouns'
    | 'ethnicity'
    | 'children'
    | 'pets'
    | 'religion'
    | 'languages'
    | 'politics'
    | 'height'
    | 'work'
    | 'education'
    | 'prompts';

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
    const editScrollY = useRef(0);
    const shouldRestoreEditScroll = useRef(false);
    const [activeTab, setActiveTab] = useState<DatingProfileEditorTab>('edit');
    const [editingSection, setEditingSection] = useState<DatingEditSection | null>(null);
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
    const [childrenStatus, setChildrenStatus] = useState<api.DatingChildrenStatus>(profile?.children_status ?? '');
    const [relationshipType, setRelationshipType] = useState<api.DatingRelationshipType>(profile?.relationship_type ?? '');
    const [profileGender, setProfileGender] = useState<api.DatingProfileGender>(profile?.gender ?? '');
    const [sexuality, setSexuality] = useState<api.DatingSexuality>(profile?.sexuality ?? '');
    const [pronouns, setPronouns] = useState<api.DatingPronouns>(profile?.pronouns ?? '');
    const [ethnicity, setEthnicity] = useState<api.DatingEthnicity>(profile?.ethnicity ?? '');
    const [pets, setPets] = useState<api.DatingPetsStatus>(profile?.pets ?? '');
    const [religiousBelief, setReligiousBelief] = useState<api.DatingReligiousBelief>(profile?.religious_belief ?? '');
    const [languagesSpoken, setLanguagesSpoken] = useState<string[]>(profile?.languages_spoken ?? []);
    const [politicalView, setPoliticalView] = useState<api.DatingPoliticalView>(profile?.political_view ?? '');
    const [selectedPromptKeys, setSelectedPromptKeys] = useState<string[]>(() => createPromptKeyList(profile?.prompt_answers ?? []));
    const [promptAnswers, setPromptAnswers] = useState<Record<string, string>>(() => createPromptAnswerMap(profile?.prompt_answers ?? []));
    const [editingPromptKey, setEditingPromptKey] = useState<string | null>(null);
    const [promptPickerVisible, setPromptPickerVisible] = useState(false);
    const [activePromptCategory, setActivePromptCategory] = useState(DATING_PROMPT_CATEGORIES[0].key);
    const [showProfileNotice, setShowProfileNotice] = useState(true);
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
        setChildrenStatus(profile?.children_status ?? '');
        setRelationshipType(profile?.relationship_type ?? '');
        setProfileGender(profile?.gender ?? '');
        setSexuality(profile?.sexuality ?? '');
        setPronouns(profile?.pronouns ?? '');
        setEthnicity(profile?.ethnicity ?? '');
        setPets(profile?.pets ?? '');
        setReligiousBelief(profile?.religious_belief ?? '');
        setLanguagesSpoken(profile?.languages_spoken ?? []);
        setPoliticalView(profile?.political_view ?? '');
        setSelectedPromptKeys(createPromptKeyList(profile?.prompt_answers ?? []));
        setPromptAnswers(createPromptAnswerMap(profile?.prompt_answers ?? []));
        setEditingPromptKey(null);
    }, [profile]);

    const toggleInterest = (interest: string): void => {
        setSelectedInterests((current) => current.includes(interest)
            ? current.filter((item) => item !== interest)
            : [...current, interest].sort((a, b) => a.localeCompare(b)));
    };

    const toggleLanguage = (language: string): void => {
        setLanguagesSpoken((current) => {
            if (current.includes(language)) {
                return current.filter((item) => item !== language);
            }
            if (current.length >= 5) {
                Alert.alert('Language limit', 'Choose up to five languages.');
                return current;
            }
            return [...current, language].sort((a, b) => (labelForOption(LANGUAGE_OPTIONS, a) ?? a).localeCompare(labelForOption(LANGUAGE_OPTIONS, b) ?? b));
        });
    };

    const setInterestedOption = (option: typeof DATING_INTERESTED_OPTIONS[number]): void => {
        setInterested(option.genders);
    };

    const handleEditScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
        editScrollY.current = event.nativeEvent.contentOffset.y;
    }, []);

    const closeEditingSection = useCallback((): void => {
        shouldRestoreEditScroll.current = true;
        setEditingSection(null);
    }, []);

    useEffect(() => {
        if (activeTab !== 'edit' || editingSection !== null || !shouldRestoreEditScroll.current) {
            return;
        }
        shouldRestoreEditScroll.current = false;
        requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: editScrollY.current, animated: false });
        });
    }, [activeTab, editingSection]);

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
            children_status: childrenStatus,
            relationship_type: relationshipType,
            gender: profileGender,
            sexuality,
            pronouns,
            ethnicity,
            pets,
            religious_belief: religiousBelief,
            languages_spoken: languagesSpoken,
            political_view: politicalView,
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

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {onBack ? (
                <ScreenHeader
                    title={editingSection ? sectionTitle(editingSection) : isComplete ? 'Dating profile' : 'Set up Dating'}
                    onBack={editingSection ? closeEditingSection : onBack}
                />
            ) : null}

            <View style={styles.keyboardWrap}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={Colors.primary} size="large" />
                    </View>
                ) : (
                    <>
                        {editingSection ? null : (
                            <View style={screenStandards.pageTabsWrap}>
                                <SegmentedControl
                                    items={DATING_PROFILE_TABS}
                                    activeKey={activeTab}
                                    onChange={(next) => {
                                        setEditingSection(null);
                                        setActiveTab(next as DatingProfileEditorTab);
                                    }}
                                    layer="page"
                                    tone="primary"
                                    style={screenStandards.pageTabsControl}
                                />
                            </View>
                        )}

                        {activeTab === 'edit' ? editingSection ? (
                            <DatingSectionEditor
                                section={editingSection}
                                bio={bio}
                                setBio={setBio}
                                interestOptions={interestOptions}
                                selectedInterests={selectedInterests}
                                toggleInterest={toggleInterest}
                                interestsLoading={interestsQuery.isLoading}
                                goal={goal}
                                setGoal={setGoal}
                                relationshipType={relationshipType}
                                setRelationshipType={setRelationshipType}
                                interested={interested}
                                setInterestedOption={setInterestedOption}
                                profileGender={profileGender}
                                setProfileGender={setProfileGender}
                                sexuality={sexuality}
                                setSexuality={setSexuality}
                                pronouns={pronouns}
                                setPronouns={setPronouns}
                                ethnicity={ethnicity}
                                setEthnicity={setEthnicity}
                                childrenStatus={childrenStatus}
                                setChildrenStatus={setChildrenStatus}
                                pets={pets}
                                setPets={setPets}
                                religiousBelief={religiousBelief}
                                setReligiousBelief={setReligiousBelief}
                                languagesSpoken={languagesSpoken}
                                toggleLanguage={toggleLanguage}
                                politicalView={politicalView}
                                setPoliticalView={setPoliticalView}
                                heightCm={heightCm}
                                setHeightCm={setHeightCm}
                                jobTitle={jobTitle}
                                setJobTitle={setJobTitle}
                                company={company}
                                setCompany={setCompany}
                                school={school}
                                setSchool={setSchool}
                                course={course}
                                setCourse={setCourse}
                                selectedPromptKeys={selectedPromptKeys}
                                promptAnswers={promptAnswers}
                                editingPromptKey={editingPromptKey}
                                setEditingPromptKey={setEditingPromptKey}
                                updatePromptAnswer={updatePromptAnswer}
                                savePromptDraft={savePromptDraft}
                                removePrompt={removePrompt}
                                setPromptPickerVisible={setPromptPickerVisible}
                                ensureFocusedInputVisible={ensureFocusedInputVisible}
                            />
                        ) : (
                            <KeyboardAwareScrollView
                                ref={scrollRef}
                                bottomOffset={Spacing.xl}
                                contentContainerStyle={styles.content}
                                extraKeyboardSpace={Spacing.xl}
                                keyboardDismissMode="interactive"
                                keyboardShouldPersistTaps="handled"
                                onScroll={handleEditScroll}
                                scrollEventThrottle={16}
                                showsVerticalScrollIndicator={false}
                            >
                            {showProfileNotice ? (
                                <View style={styles.header}>
                                    <InfoNoticeCard
                                        title={isComplete ? 'Dating profile' : 'Set up Dating'}
                                        description={isComplete ? 'Edit the profile people see in Dating.' : 'Complete this profile before you appear in Dating.'}
                                        onDismiss={() => setShowProfileNotice(false)}
                                    />
                                </View>
                            ) : null}

                            <View
                                style={[styles.section, styles.firstSection, showCompletionErrors && completionErrors.photos && styles.sectionInvalid]}
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

                            <ProfileEditRows
                                showCompletionErrors={showCompletionErrors}
                                completionErrors={completionErrors}
                                recordRequiredSectionLayout={recordRequiredSectionLayout}
                                onOpenSection={setEditingSection}
                                bio={bio}
                                selectedInterests={selectedInterests}
                                goal={goal}
                                relationshipType={relationshipType}
                                interested={interested}
                                profileGender={profileGender}
                                sexuality={sexuality}
                                pronouns={pronouns}
                                ethnicity={ethnicity}
                                childrenStatus={childrenStatus}
                                pets={pets}
                                religiousBelief={religiousBelief}
                                languagesSpoken={languagesSpoken}
                                politicalView={politicalView}
                                heightCm={heightCm}
                                jobTitle={jobTitle}
                                company={company}
                                school={school}
                                course={course}
                                selectedPromptKeys={selectedPromptKeys}
                            />

                            <View style={styles.saveActions}>
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
                            </View>
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
                                childrenStatus={childrenStatus}
                                relationshipType={relationshipType}
                                profileGender={profileGender}
                                sexuality={sexuality}
                                pronouns={pronouns}
                                ethnicity={ethnicity}
                                pets={pets}
                                religiousBelief={religiousBelief}
                                languagesSpoken={languagesSpoken}
                                politicalView={politicalView}
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

interface ProfileEditRowsProps {
    showCompletionErrors: boolean;
    completionErrors: Record<RequiredDatingProfileField, string | null>;
    recordRequiredSectionLayout: (field: RequiredDatingProfileField) => (event: LayoutChangeEvent) => void;
    onOpenSection: (section: DatingEditSection) => void;
    bio: string;
    selectedInterests: string[];
    goal: api.DatingRelationshipGoal;
    relationshipType: api.DatingRelationshipType;
    interested: api.UserGender[];
    profileGender: api.DatingProfileGender;
    sexuality: api.DatingSexuality;
    pronouns: api.DatingPronouns;
    ethnicity: api.DatingEthnicity;
    childrenStatus: api.DatingChildrenStatus;
    pets: api.DatingPetsStatus;
    religiousBelief: api.DatingReligiousBelief;
    languagesSpoken: string[];
    politicalView: api.DatingPoliticalView;
    heightCm: string;
    jobTitle: string;
    company: string;
    school: string;
    course: string;
    selectedPromptKeys: string[];
}

function ProfileEditRows({
    showCompletionErrors,
    completionErrors,
    recordRequiredSectionLayout,
    onOpenSection,
    bio,
    selectedInterests,
    goal,
    relationshipType,
    interested,
    profileGender,
    sexuality,
    pronouns,
    ethnicity,
    childrenStatus,
    pets,
    religiousBelief,
    languagesSpoken,
    politicalView,
    heightCm,
    jobTitle,
    company,
    school,
    course,
    selectedPromptKeys,
}: ProfileEditRowsProps): React.ReactElement {
    return (
        <View style={styles.editRows}>
            <EditSummaryRow
                title="Bio"
                value={bio.trim() || 'Add'}
                invalid={showCompletionErrors && Boolean(completionErrors.bio)}
                error={showCompletionErrors ? completionErrors.bio : null}
                onPress={() => onOpenSection('bio')}
                onLayout={recordRequiredSectionLayout('bio')}
            />
            <EditSummaryRow
                title="Interests"
                value={selectedInterests.length > 0 ? `${selectedInterests.length}/${MAX_DATING_INTERESTS} selected` : 'Add'}
                invalid={showCompletionErrors && Boolean(completionErrors.interests)}
                error={showCompletionErrors ? completionErrors.interests : null}
                onPress={() => onOpenSection('interests')}
                onLayout={recordRequiredSectionLayout('interests')}
            />
            <EditSummaryRow
                title="Dating intentions"
                value={relationshipGoalLabel(goal) ?? 'Add'}
                invalid={showCompletionErrors && Boolean(completionErrors.goal)}
                error={showCompletionErrors ? completionErrors.goal : null}
                onPress={() => onOpenSection('goal')}
                onLayout={recordRequiredSectionLayout('goal')}
            />
            <EditSummaryRow title="Relationship type" value={labelForOption(RELATIONSHIP_TYPE_OPTIONS, relationshipType) || 'Add'} onPress={() => onOpenSection('relationship_type')} />
            <EditSummaryRow
                title="Interested in"
                value={interestedInLabel(interested) || 'Add'}
                invalid={showCompletionErrors && Boolean(completionErrors.interested)}
                error={showCompletionErrors ? completionErrors.interested : null}
                onPress={() => onOpenSection('interested')}
                onLayout={recordRequiredSectionLayout('interested')}
            />
            <EditSummaryRow title="Gender" value={labelForOption(PROFILE_GENDER_OPTIONS, profileGender) || 'Add'} onPress={() => onOpenSection('gender')} />
            <EditSummaryRow title="Sexuality" value={labelForOption(SEXUALITY_OPTIONS, sexuality) || 'Add'} onPress={() => onOpenSection('sexuality')} />
            <EditSummaryRow title="Pronouns" value={labelForOption(PRONOUNS_OPTIONS, pronouns) || 'Add'} onPress={() => onOpenSection('pronouns')} />
            <EditSummaryRow title="Ethnicity" value={labelForOption(ETHNICITY_OPTIONS, ethnicity) || 'Add'} onPress={() => onOpenSection('ethnicity')} />
            <EditSummaryRow title="Children" value={labelForOption(CHILDREN_OPTIONS, childrenStatus) || 'Add'} onPress={() => onOpenSection('children')} />
            <EditSummaryRow title="Pets" value={labelForOption(PETS_OPTIONS, pets) || 'Add'} onPress={() => onOpenSection('pets')} />
            <EditSummaryRow title="Religious beliefs" value={labelForOption(RELIGIOUS_BELIEF_OPTIONS, religiousBelief) || 'Add'} onPress={() => onOpenSection('religion')} />
            <EditSummaryRow title="Languages spoken" value={languageListLabel(languagesSpoken) || 'Add'} onPress={() => onOpenSection('languages')} />
            <EditSummaryRow title="Political view" value={labelForOption(POLITICAL_VIEW_OPTIONS, politicalView) || 'Add'} onPress={() => onOpenSection('politics')} />
            <EditSummaryRow title="Height" value={formatHeight(heightCm) || 'Add'} onPress={() => onOpenSection('height')} />
            <EditSummaryRow title="Work" value={formatWork(jobTitle, company) || 'Add'} onPress={() => onOpenSection('work')} />
            <EditSummaryRow title="Education" value={formatEducation(course, school) || 'Add'} onPress={() => onOpenSection('education')} />
            <EditSummaryRow title="Prompts" value={selectedPromptKeys.length > 0 ? `${selectedPromptKeys.length}/${MAX_DATING_PROMPTS} added` : 'Add'} onPress={() => onOpenSection('prompts')} />
        </View>
    );
}

function EditSummaryRow({
    title,
    value,
    invalid = false,
    error,
    onPress,
    onLayout,
}: {
    title: string;
    value: string;
    invalid?: boolean;
    error?: string | null;
    onPress: () => void;
    onLayout?: (event: LayoutChangeEvent) => void;
}): React.ReactElement {
    return (
        <View onLayout={onLayout}>
            <TouchableOpacity
                style={[styles.editRow, invalid && styles.editRowInvalid]}
                onPress={onPress}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${title}`}
            >
                <View style={styles.editRowCopy}>
                    <Text style={[styles.editRowTitle, invalid && styles.sectionLabelInvalid]}>{title}</Text>
                    <Text style={styles.editRowValue} numberOfLines={1}>{value}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.text.muted} />
            </TouchableOpacity>
            {error ? <Text style={styles.sectionErrorText}>{error}</Text> : null}
        </View>
    );
}

interface DatingSectionEditorProps {
    section: DatingEditSection;
    bio: string;
    setBio: (value: string) => void;
    interestOptions: string[];
    selectedInterests: string[];
    toggleInterest: (interest: string) => void;
    interestsLoading: boolean;
    goal: api.DatingRelationshipGoal;
    setGoal: (value: api.DatingRelationshipGoal) => void;
    relationshipType: api.DatingRelationshipType;
    setRelationshipType: (value: api.DatingRelationshipType) => void;
    interested: api.UserGender[];
    setInterestedOption: (option: typeof DATING_INTERESTED_OPTIONS[number]) => void;
    profileGender: api.DatingProfileGender;
    setProfileGender: (value: api.DatingProfileGender) => void;
    sexuality: api.DatingSexuality;
    setSexuality: (value: api.DatingSexuality) => void;
    pronouns: api.DatingPronouns;
    setPronouns: (value: api.DatingPronouns) => void;
    ethnicity: api.DatingEthnicity;
    setEthnicity: (value: api.DatingEthnicity) => void;
    childrenStatus: api.DatingChildrenStatus;
    setChildrenStatus: (value: api.DatingChildrenStatus) => void;
    pets: api.DatingPetsStatus;
    setPets: (value: api.DatingPetsStatus) => void;
    religiousBelief: api.DatingReligiousBelief;
    setReligiousBelief: (value: api.DatingReligiousBelief) => void;
    languagesSpoken: string[];
    toggleLanguage: (value: string) => void;
    politicalView: api.DatingPoliticalView;
    setPoliticalView: (value: api.DatingPoliticalView) => void;
    heightCm: string;
    setHeightCm: (value: string) => void;
    jobTitle: string;
    setJobTitle: (value: string) => void;
    company: string;
    setCompany: (value: string) => void;
    school: string;
    setSchool: (value: string) => void;
    course: string;
    setCourse: (value: string) => void;
    selectedPromptKeys: string[];
    promptAnswers: Record<string, string>;
    editingPromptKey: string | null;
    setEditingPromptKey: (value: string | null) => void;
    updatePromptAnswer: (promptKey: string, value: string) => void;
    savePromptDraft: (promptKey: string) => void;
    removePrompt: (promptKey: string) => void;
    setPromptPickerVisible: (value: boolean) => void;
    ensureFocusedInputVisible: () => void;
}

function DatingSectionEditor(props: DatingSectionEditorProps): React.ReactElement {
    return (
        <KeyboardAwareScrollView
            bottomOffset={Spacing.xl}
            contentContainerStyle={styles.focusedContent}
            extraKeyboardSpace={Spacing.xl}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            {renderSectionEditorContent(props)}
        </KeyboardAwareScrollView>
    );
}

function renderSectionEditorContent(props: DatingSectionEditorProps): React.ReactElement {
    switch (props.section) {
        case 'bio':
            return (
                <View style={styles.section}>
                    <TextField
                        style={styles.bioInput}
                        value={props.bio}
                        onChangeText={props.setBio}
                        onFocus={props.ensureFocusedInputVisible}
                        multiline
                        textAlignVertical="top"
                        placeholder="What should someone know before they say hello?"
                        placeholderTextColor={Colors.text.muted}
                    />
                </View>
            );
        case 'interests':
            return (
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionCount}>{props.selectedInterests.length}/{MAX_DATING_INTERESTS}</Text>
                    </View>
                    <InterestSelector
                        options={props.interestOptions}
                        selected={props.selectedInterests}
                        maxSelected={MAX_DATING_INTERESTS}
                        loading={props.interestsLoading}
                        onToggle={props.toggleInterest}
                    />
                </View>
            );
        case 'goal':
            return <SingleChoice options={DATING_GOAL_OPTIONS} value={props.goal} onChange={props.setGoal} />;
        case 'relationship_type':
            return <SingleChoice options={RELATIONSHIP_TYPE_OPTIONS} value={props.relationshipType} onChange={props.setRelationshipType} allowClear />;
        case 'interested':
            return <InterestedChoice interested={props.interested} onChange={props.setInterestedOption} />;
        case 'gender':
            return <SingleChoice options={PROFILE_GENDER_OPTIONS} value={props.profileGender} onChange={props.setProfileGender} allowClear />;
        case 'sexuality':
            return <SingleChoice options={SEXUALITY_OPTIONS} value={props.sexuality} onChange={props.setSexuality} allowClear />;
        case 'pronouns':
            return <SingleChoice options={PRONOUNS_OPTIONS} value={props.pronouns} onChange={props.setPronouns} allowClear />;
        case 'ethnicity':
            return <SingleChoice options={ETHNICITY_OPTIONS} value={props.ethnicity} onChange={props.setEthnicity} allowClear />;
        case 'children':
            return <SingleChoice options={CHILDREN_OPTIONS} value={props.childrenStatus} onChange={props.setChildrenStatus} allowClear />;
        case 'pets':
            return <SingleChoice options={PETS_OPTIONS} value={props.pets} onChange={props.setPets} allowClear />;
        case 'religion':
            return <SingleChoice options={RELIGIOUS_BELIEF_OPTIONS} value={props.religiousBelief} onChange={props.setReligiousBelief} allowClear />;
        case 'languages':
            return <MultiChoice options={LANGUAGE_OPTIONS} values={props.languagesSpoken} onToggle={props.toggleLanguage} maxSelected={5} />;
        case 'politics':
            return <SingleChoice options={POLITICAL_VIEW_OPTIONS} value={props.politicalView} onChange={props.setPoliticalView} allowClear />;
        case 'height':
            return (
                <View style={styles.section}>
                    <TextField
                        value={props.heightCm}
                        onChangeText={(value) => props.setHeightCm(value.replace(/[^0-9]/g, '').slice(0, 3))}
                        onFocus={props.ensureFocusedInputVisible}
                        keyboardType="number-pad"
                        placeholder="Height in cm"
                        placeholderTextColor={Colors.text.muted}
                    />
                </View>
            );
        case 'work':
            return (
                <View style={styles.section}>
                    <TextField value={props.jobTitle} onChangeText={(value) => props.setJobTitle(value.slice(0, 80))} onFocus={props.ensureFocusedInputVisible} placeholder="Software developer" placeholderTextColor={Colors.text.muted} />
                    <TextField value={props.company} onChangeText={(value) => props.setCompany(value.slice(0, 80))} onFocus={props.ensureFocusedInputVisible} placeholder="Company" placeholderTextColor={Colors.text.muted} />
                </View>
            );
        case 'education':
            return (
                <View style={styles.section}>
                    <TextField value={props.course} onChangeText={(value) => props.setCourse(value.slice(0, 80))} onFocus={props.ensureFocusedInputVisible} placeholder="Course" placeholderTextColor={Colors.text.muted} />
                    <TextField value={props.school} onChangeText={(value) => props.setSchool(value.slice(0, 80))} onFocus={props.ensureFocusedInputVisible} placeholder="School" placeholderTextColor={Colors.text.muted} />
                </View>
            );
        case 'prompts':
            return (
                <View style={styles.section}>
                    <PromptEditor
                        selectedPromptKeys={props.selectedPromptKeys}
                        promptAnswers={props.promptAnswers}
                        editingPromptKey={props.editingPromptKey}
                        setEditingPromptKey={props.setEditingPromptKey}
                        updatePromptAnswer={props.updatePromptAnswer}
                        savePromptDraft={props.savePromptDraft}
                        removePrompt={props.removePrompt}
                        setPromptPickerVisible={props.setPromptPickerVisible}
                        ensureFocusedInputVisible={props.ensureFocusedInputVisible}
                    />
                </View>
            );
        default:
            return <View />;
    }
}

function SingleChoice<T extends string>({ options, value, onChange, allowClear = false }: { options: DatingOption<T>[]; value: T; onChange: (value: T) => void; allowClear?: boolean }): React.ReactElement {
    return (
        <View style={styles.section}>
            <View style={styles.chipWrap}>
                {allowClear ? <ChoiceChip label="Skip" active={value === ''} onPress={() => onChange('' as T)} /> : null}
                {options.map((option) => (
                    <ChoiceChip key={option.value} label={option.label} active={value === option.value} onPress={() => onChange(option.value)} />
                ))}
            </View>
        </View>
    );
}

function InterestedChoice({ interested, onChange }: { interested: api.UserGender[]; onChange: (option: typeof DATING_INTERESTED_OPTIONS[number]) => void }): React.ReactElement {
    return (
        <View style={styles.section}>
            <View style={styles.chipWrap}>
                {DATING_INTERESTED_OPTIONS.map((option) => (
                    <ChoiceChip key={option.value} label={option.label} active={arraysEqual(interested, option.genders)} onPress={() => onChange(option)} />
                ))}
            </View>
        </View>
    );
}

function MultiChoice({ options, values, onToggle, maxSelected }: { options: DatingOption<string>[]; values: string[]; onToggle: (value: string) => void; maxSelected: number }): React.ReactElement {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionCount}>{values.length}/{maxSelected}</Text>
            <View style={styles.chipWrap}>
                {options.map((option) => (
                    <ChoiceChip key={option.value} label={option.label} active={values.includes(option.value)} onPress={() => onToggle(option.value)} />
                ))}
            </View>
        </View>
    );
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }): React.ReactElement {
    return (
        <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.84}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

function PromptEditor({
    selectedPromptKeys,
    promptAnswers,
    editingPromptKey,
    setEditingPromptKey,
    updatePromptAnswer,
    savePromptDraft,
    removePrompt,
    setPromptPickerVisible,
    ensureFocusedInputVisible,
}: {
    selectedPromptKeys: string[];
    promptAnswers: Record<string, string>;
    editingPromptKey: string | null;
    setEditingPromptKey: (value: string | null) => void;
    updatePromptAnswer: (promptKey: string, value: string) => void;
    savePromptDraft: (promptKey: string) => void;
    removePrompt: (promptKey: string) => void;
    setPromptPickerVisible: (value: boolean) => void;
    ensureFocusedInputVisible: () => void;
}): React.ReactElement {
    return (
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
                                >
                                    <Text style={[styles.promptSaveText, !canSavePrompt && styles.promptSaveTextDisabled]}>Save</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.promptIconButton} onPress={() => setEditingPromptKey(prompt.key)}>
                                    <Ionicons name="pencil" size={15} color={Colors.text.secondary} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.promptIconButton} onPress={() => removePrompt(prompt.key)}>
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
                            <TouchableOpacity style={styles.promptSavedAnswer} onPress={() => setEditingPromptKey(prompt.key)} activeOpacity={0.85}>
                                <Text style={styles.promptSavedAnswerText}>{answer.trim()}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                );
            })}
            {selectedPromptKeys.length < MAX_DATING_PROMPTS && editingPromptKey === null ? (
                <TouchableOpacity style={styles.addPromptButton} onPress={() => setPromptPickerVisible(true)} activeOpacity={0.85}>
                    <Ionicons name="add" size={18} color={Colors.primary} />
                    <Text style={styles.addPromptText}>Add prompt</Text>
                </TouchableOpacity>
            ) : null}
        </View>
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
    childrenStatus: api.DatingChildrenStatus;
    relationshipType: api.DatingRelationshipType;
    profileGender: api.DatingProfileGender;
    sexuality: api.DatingSexuality;
    pronouns: api.DatingPronouns;
    ethnicity: api.DatingEthnicity;
    pets: api.DatingPetsStatus;
    religiousBelief: api.DatingReligiousBelief;
    languagesSpoken: string[];
    politicalView: api.DatingPoliticalView;
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
    childrenStatus,
    relationshipType,
    profileGender,
    sexuality,
    pronouns,
    ethnicity,
    pets,
    religiousBelief,
    languagesSpoken,
    politicalView,
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
    const detailRows: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null }> = [
        { icon: 'heart-outline' as const, label: 'Relationship type', value: labelForOption(RELATIONSHIP_TYPE_OPTIONS, relationshipType) },
        { icon: 'person-outline' as const, label: 'Gender', value: labelForOption(PROFILE_GENDER_OPTIONS, profileGender) },
        { icon: 'sparkles-outline' as const, label: 'Sexuality', value: labelForOption(SEXUALITY_OPTIONS, sexuality) },
        { icon: 'chatbubble-outline' as const, label: 'Pronouns', value: labelForOption(PRONOUNS_OPTIONS, pronouns) },
        { icon: 'people-circle-outline' as const, label: 'Ethnicity', value: labelForOption(ETHNICITY_OPTIONS, ethnicity) },
        { icon: 'people-outline' as const, label: 'Children', value: labelForOption(CHILDREN_OPTIONS, childrenStatus) },
        { icon: 'paw-outline' as const, label: 'Pets', value: labelForOption(PETS_OPTIONS, pets) },
        { icon: 'leaf-outline' as const, label: 'Religion', value: labelForOption(RELIGIOUS_BELIEF_OPTIONS, religiousBelief) },
        { icon: 'language-outline' as const, label: 'Languages', value: languageListLabel(languagesSpoken) },
        { icon: 'newspaper-outline' as const, label: 'Politics', value: labelForOption(POLITICAL_VIEW_OPTIONS, politicalView) },
        { icon: 'resize-outline' as const, label: 'Height', value: formatHeight(heightCm) },
        { icon: 'briefcase-outline' as const, label: 'Work', value: formatWork(jobTitle, company) },
        { icon: 'school-outline' as const, label: 'Education', value: formatEducation(course, school) },
    ];
    const visibleDetailRows = detailRows.filter((detail): detail is { icon: keyof typeof Ionicons.glyphMap; label: string; value: string } => Boolean(detail.value));

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
                                    <Text style={styles.previewChipText} numberOfLines={1}>{interest}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}
                {visibleDetailRows.length > 0 ? (
                    <View style={styles.previewSection}>
                        <Text style={styles.previewSectionLabel}>Basics</Text>
                        <View style={styles.previewDetails}>
                            {visibleDetailRows.map((detail) => (
                                <View key={detail.label} style={styles.previewDetailRow}>
                                    <Ionicons name={detail.icon} size={17} color={Colors.text.secondary} />
                                    <Text style={styles.previewDetailText}>{detail.value}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}
                {visiblePromptAnswers.length > 0 ? (
                    <View style={styles.previewSection}>
                        <Text style={styles.previewSectionLabel}>Prompts</Text>
                        <View style={styles.previewPrompts}>
                            {visiblePromptAnswers.map((prompt) => (
                                <View key={prompt.key} style={styles.previewPrompt}>
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

function labelForOption<T extends string>(options: DatingOption<T>[], value: T | string): string | null {
    if (!value) return null;
    return options.find((option) => option.value === value)?.label ?? null;
}

function languageListLabel(values: string[]): string | null {
    if (values.length === 0) return null;
    return values.map((value) => labelForOption(LANGUAGE_OPTIONS, value) ?? value).join(', ');
}

function interestedInLabel(values: api.UserGender[]): string | null {
    const match = DATING_INTERESTED_OPTIONS.find((option) => arraysEqual(values, option.genders));
    if (match) return match.label;
    return values.map((value) => DATING_GENDER_OPTIONS.find((option) => option.value === value)?.label ?? value).join(', ');
}

function arraysEqual(first: string[], second: string[]): boolean {
    if (first.length !== second.length) return false;
    const normalizedFirst = [...first].sort();
    const normalizedSecond = [...second].sort();
    return normalizedFirst.every((value, index) => value === normalizedSecond[index]);
}

function sectionTitle(section: DatingEditSection): string {
    switch (section) {
        case 'bio': return 'Bio';
        case 'interests': return 'Interests';
        case 'goal': return 'Dating intentions';
        case 'relationship_type': return 'Relationship type';
        case 'interested': return 'Interested in';
        case 'gender': return 'Gender';
        case 'sexuality': return 'Sexuality';
        case 'pronouns': return 'Pronouns';
        case 'ethnicity': return 'Ethnicity';
        case 'children': return 'Children';
        case 'pets': return 'Pets';
        case 'religion': return 'Religious beliefs';
        case 'languages': return 'Languages spoken';
        case 'politics': return 'Political view';
        case 'height': return 'Height';
        case 'work': return 'Work';
        case 'education': return 'Education';
        case 'prompts': return 'Prompts';
    }
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
        paddingTop: 0,
        paddingBottom: ContentInsets.listBottom,
        gap: Spacing.lg,
    },
    header: {
        gap: Spacing.xs,
        paddingBottom: 0,
    },
    section: {
        marginHorizontal: -ContentInsets.screenHorizontal,
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingVertical: 0,
        gap: Spacing.sm,
    },
    firstSection: {
        paddingTop: 0,
    },
    sectionInvalid: {
        borderLeftWidth: 2,
        borderColor: Colors.danger,
    },
    sectionLabel: {
        ...TextStyles.cardTitle,
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
    saveActions: {
        gap: Spacing.sm,
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
    editRows: {
        marginHorizontal: -ContentInsets.screenHorizontal,
        borderTopWidth: 1,
        borderTopColor: Colors.border.emphasis,
    },
    editRow: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
        backgroundColor: Colors.bg.page,
    },
    editRowInvalid: {
        borderLeftWidth: 2,
        borderLeftColor: Colors.danger,
    },
    editRowCopy: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    editRowTitle: {
        ...TextStyles.label,
        color: Colors.text.primary,
    },
    editRowValue: {
        ...TextStyles.secondary,
        color: Colors.text.secondary,
    },
    focusedContent: {
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingTop: Spacing.sm,
        paddingBottom: ContentInsets.listBottom,
        gap: Spacing.lg,
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
    },
    promptCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    promptLabel: {
        flex: 1,
        ...TextStyles.cardTitle,
        color: Colors.text.primary,
        fontWeight: '800',
    },
    promptIconButton: {
        width: 30,
        height: 30,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border.emphasis,
        backgroundColor: Colors.bg.page,
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
        borderWidth: 1,
        borderColor: Colors.border.emphasis,
        backgroundColor: Colors.bg.page,
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
        paddingTop: Spacing.xs,
    },
    promptSavedAnswerText: {
        ...TextStyles.body,
        color: Colors.text.secondary,
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
        borderColor: Colors.border.emphasis,
        backgroundColor: Colors.bg.page,
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
        borderColor: Colors.border.emphasis,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.page,
    },
    chipActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    chipText: {
        ...TextStyles.label,
        color: Colors.text.secondary,
    },
    chipTextActive: {
        color: Colors.textOn.primary,
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
        paddingHorizontal: 0,
        paddingTop: Spacing.lg,
        gap: Spacing.lg,
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
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingVertical: 0,
        gap: Spacing.sm,
    },
    previewSectionLabel: {
        ...TextStyles.label,
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
        borderColor: Colors.border.default,
        minHeight: ControlSizes.chipMinHeight,
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.bg.surface,
    },
    previewChipText: {
        ...TextStyles.label,
        color: Colors.text.primary,
    },
    previewDetails: {
        gap: Spacing.md,
    },
    previewPrompts: {
        marginHorizontal: -ContentInsets.screenHorizontal,
        borderTopWidth: 1,
        borderTopColor: Colors.border.emphasis,
    },
    previewPrompt: {
        gap: Spacing.xs,
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
    },
    previewPromptLabel: {
        ...TextStyles.label,
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
