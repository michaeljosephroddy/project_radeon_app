import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
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
import { Avatar } from '../Avatar';
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
    deletingPhotoIds: Set<string>;
    onBack?: () => void;
    onSave: (input: api.UpdateDatingProfileInput) => void;
    onPickPhoto: () => void;
    onDeletePhoto: (photoId: string) => void;
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

const MAX_DATING_INTERESTS = 5;

const DATING_PROFILE_TABS: { key: DatingProfileEditorTab; label: string }[] = [
    { key: 'edit', label: 'Edit' },
    { key: 'preview', label: 'Preview' },
];

export function DatingProfileEditorScreen({
    profile,
    loading,
    saving,
    uploading,
    deletingPhotoIds,
    onBack,
    onSave,
    onPickPhoto,
    onDeletePhoto,
}: DatingProfileEditorScreenProps) {
    const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
    const [activeTab, setActiveTab] = useState<DatingProfileEditorTab>('edit');
    const [bio, setBio] = useState(profile?.bio ?? '');
    const [goal, setGoal] = useState<api.DatingRelationshipGoal>(profile?.relationship_goal || 'long_term');
    const [interested, setInterested] = useState<api.UserGender[]>(profile?.interested_in_genders?.length ? profile.interested_in_genders : ['woman']);
    const [selectedInterests, setSelectedInterests] = useState<string[]>(profile?.interests ?? []);
    const [heightCm, setHeightCm] = useState(profile?.height_cm ? String(profile.height_cm) : '');
    const [work, setWork] = useState(profile?.work ?? '');
    const [education, setEducation] = useState(profile?.education ?? '');
    const [kidsStatus, setKidsStatus] = useState<api.DatingKidsStatus>(profile?.kids_status ?? '');
    const interestsQuery = useInterests(!loading);
    const interestOptions = Array.from(new Set([...(interestsQuery.data ?? []), ...selectedInterests])).sort((a, b) => a.localeCompare(b));
    const isComplete = Boolean(profile?.completed_at);
    const missingCompletionItems = [
        (profile?.photos ?? []).length === 0 ? 'Add at least one photo' : null,
        bio.trim().length === 0 ? 'Add a Dating bio' : null,
        goal === '' ? 'Choose a relationship goal' : null,
        selectedInterests.length === 0 ? 'Pick at least one interest' : null,
        interested.length === 0 ? 'Choose who you are interested in' : null,
    ].filter((item): item is string => Boolean(item));

    useEffect(() => {
        setBio(profile?.bio ?? '');
        setGoal(profile?.relationship_goal || 'long_term');
        setInterested(profile?.interested_in_genders?.length ? profile.interested_in_genders : ['woman']);
        setSelectedInterests(profile?.interests ?? []);
        setHeightCm(profile?.height_cm ? String(profile.height_cm) : '');
        setWork(profile?.work ?? '');
        setEducation(profile?.education ?? '');
        setKidsStatus(profile?.kids_status ?? '');
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

    const save = (complete: boolean): void => {
        const trimmedHeight = heightCm.trim();
        const parsedHeight = trimmedHeight ? Number.parseInt(trimmedHeight, 10) : null;
        onSave({
            bio: bio.trim(),
            relationship_goal: goal,
            interested_in_genders: interested,
            interests: selectedInterests,
            height_cm: Number.isFinite(parsedHeight) ? parsedHeight : null,
            work: work.trim(),
            education: education.trim(),
            kids_status: kidsStatus,
            complete,
        });
    };

    const handlePrimarySave = (): void => {
        if (!isComplete && missingCompletionItems.length > 0) {
            Alert.alert('Complete your profile', missingCompletionItems.join('\n'));
            return;
        }
        save(!isComplete);
    };

    const togglePause = (): void => {
        if (!profile) return;
        onSave({ paused: !profile.paused });
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title={isComplete ? 'Dating profile' : 'Set up Dating'} onBack={onBack} />

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

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Photos</Text>
                                <View style={styles.photoGrid}>
                                    {(profile?.photos ?? []).map((photo) => (
                                        <View key={photo.id} style={styles.photoTile}>
                                            <Image source={{ uri: photo.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                                            <TouchableOpacity
                                                style={styles.photoRemove}
                                                onPress={() => onDeletePhoto(photo.id)}
                                                disabled={deletingPhotoIds.has(photo.id)}
                                            >
                                                {deletingPhotoIds.has(photo.id)
                                                    ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                                    : <Ionicons name="close" size={16} color={Colors.textOn.primary} />}
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    {(profile?.photos ?? []).length < 6 ? (
                                        <TouchableOpacity style={styles.photoAdd} onPress={onPickPhoto} disabled={uploading}>
                                            {uploading
                                                ? <ActivityIndicator color={Colors.primary} />
                                                : <Ionicons name="add" size={26} color={Colors.primary} />}
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Dating bio</Text>
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
                            </View>

                            <View style={styles.section}>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionLabel}>Interests</Text>
                                    <Text style={styles.sectionCount}>{selectedInterests.length}/{MAX_DATING_INTERESTS}</Text>
                                </View>
                                <InterestSelector
                                    options={interestOptions}
                                    selected={selectedInterests}
                                    maxSelected={MAX_DATING_INTERESTS}
                                    loading={interestsQuery.isLoading}
                                    onToggle={toggleInterest}
                                />
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Relationship goal</Text>
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
                                    value={work}
                                    onChangeText={(value) => setWork(value.slice(0, 80))}
                                    onFocus={ensureFocusedInputVisible}
                                    placeholder="What do you do?"
                                    placeholderTextColor={Colors.text.muted}
                                />
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Education</Text>
                                <TextField
                                    value={education}
                                    onChangeText={(value) => setEducation(value.slice(0, 80))}
                                    onFocus={ensureFocusedInputVisible}
                                    placeholder="School, university, or qualification"
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

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Interested in</Text>
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
                            </View>

                            <PrimaryButton
                                label={isComplete ? 'Save profile' : 'Complete profile'}
                                onPress={handlePrimarySave}
                                loading={saving}
                                disabled={saving}
                            />
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
                                heightCm={heightCm}
                                work={work}
                                education={education}
                                kidsStatus={kidsStatus}
                            />
                        )}
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

interface DatingProfilePreviewProps {
    profile: api.DatingProfile | null;
    bio: string;
    goal: api.DatingRelationshipGoal;
    interests: string[];
    heightCm: string;
    work: string;
    education: string;
    kidsStatus: api.DatingKidsStatus;
}

function DatingProfilePreview({
    profile,
    bio,
    goal,
    interests,
    heightCm,
    work,
    education,
    kidsStatus,
}: DatingProfilePreviewProps): React.ReactElement {
    const primaryPhoto = (profile?.photos ?? [])[0]?.image_url;
    const username = profile?.username ?? 'Your profile';
    const displayName = profile?.age ? `${formatUsername(profile.username)}, ${profile.age}` : formatUsername(profile?.username);
    const locationLabel = profile?.city
        ? `${profile.city}${profile.country ? `, ${profile.country}` : ''}`
        : profile?.country ?? null;
    const goalLabel = relationshipGoalLabel(goal);
    const previewBio = bio.trim();
    const detailRows = [
        { icon: 'resize-outline' as const, label: 'Height', value: formatHeight(heightCm) },
        { icon: 'briefcase-outline' as const, label: 'Work', value: work.trim() },
        { icon: 'school-outline' as const, label: 'Education', value: education.trim() },
        { icon: 'people-outline' as const, label: 'Kids', value: kidsStatusLabel(kidsStatus) },
    ].filter(Boolean);

    return (
        <ScrollView contentContainerStyle={styles.previewContent} showsVerticalScrollIndicator={false}>
            <View style={styles.previewCard}>
                <View style={styles.previewPhoto}>
                    {primaryPhoto ? (
                        <Image source={{ uri: primaryPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                        <Avatar username={username} size={112} fontSize={34} />
                    )}
                    <LinearGradient
                        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.26)', 'rgba(0,0,0,0.78)']}
                        locations={[0, 0.52, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.previewHeroText}>
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
                    <View style={styles.previewSection}>
                        <Text style={styles.previewSectionLabel}>About</Text>
                        {previewBio ? (
                            <Text style={styles.previewBio}>{previewBio}</Text>
                        ) : (
                            <Text style={styles.previewPlaceholder}>Add a Dating bio to preview how your profile will read.</Text>
                        )}
                    </View>
                </View>
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
    sectionLabel: {
        ...TextStyles.label,
        color: Colors.text.primary,
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
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    photoTile: {
        width: 92,
        height: 120,
        borderRadius: Radius.md,
        overflow: 'hidden',
        backgroundColor: Colors.bg.raised,
    },
    photoAdd: {
        width: 92,
        height: 120,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    photoRemove: {
        position: 'absolute',
        top: Spacing.xs,
        right: Spacing.xs,
        width: 28,
        height: 28,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.58)',
    },
    bioInput: {
        minHeight: 96,
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
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingTop: Spacing.sm,
        paddingBottom: ContentInsets.listBottom,
    },
    previewCard: {
        overflow: 'hidden',
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    previewPhoto: {
        width: '100%',
        aspectRatio: 0.78,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.raised,
    },
    previewHeroText: {
        position: 'absolute',
        left: Spacing.lg,
        right: Spacing.lg,
        bottom: Spacing.lg,
        gap: 4,
    },
    previewBody: {
        padding: Spacing.lg,
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
        gap: Spacing.sm,
    },
    previewSectionLabel: {
        ...TextStyles.caption,
        color: Colors.text.muted,
        textTransform: 'uppercase',
    },
    previewGoalPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        alignSelf: 'flex-start',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.primarySubtle,
    },
    previewGoalText: {
        ...TextStyles.label,
        color: Colors.primary,
    },
    previewChipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    previewChip: {
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.bg.raised,
    },
    previewChipText: {
        ...TextStyles.caption,
        color: Colors.text.secondary,
    },
    previewDetails: {
        gap: Spacing.sm,
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
        color: Colors.text.primary,
        lineHeight: 22,
    },
    previewPlaceholder: {
        ...TextStyles.secondary,
        color: Colors.text.muted,
        lineHeight: 21,
    },
});
