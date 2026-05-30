import React, { useCallback } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatingPhotoCarousel } from '../../../components/discover/DatingPhotoCarousel';
import { DiscoverEmptyState } from '../../../components/discover/DiscoverEmptyState';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { appAlert } from '../../../components/ui/appAlert';
import * as api from '../../../api/client';
import { queryKeys } from '../../../query/queryKeys';
import { Colors, ContentInsets, Radius, Spacing, TextStyles, Typography } from '../../../theme';
import { formatUsername } from '../../../utils/identity';
import type { RootStackParamList } from '../../../navigation/types';

type DatingProfileDetailRouteScreenProps = NativeStackScreenProps<RootStackParamList, 'DatingProfileDetail'>;

interface DatingOption<T extends string> {
    value: T;
    label: string;
}

const DATING_REPORT_OPTIONS: { label: string; reason: api.UserReportReason }[] = [
    { label: 'Fake or scam profile', reason: 'safety_concern' },
    { label: 'Inappropriate content', reason: 'safety_concern' },
    { label: 'Harassment or abuse', reason: 'harassment' },
    { label: 'Spam or promotion', reason: 'spam' },
    { label: 'Other safety concern', reason: 'other' },
];

const DATING_GOAL_OPTIONS: DatingOption<api.DatingRelationshipGoal>[] = [
    { value: 'long_term', label: 'Long-term relationship' },
    { value: 'life_partner', label: 'Life partner' },
    { value: 'short_term_open_to_long_term', label: 'Short-term, open to long-term' },
    { value: 'still_figuring_it_out', label: 'Still figuring it out' },
    { value: 'new_sober_connections', label: 'New sober connections' },
    { value: 'casual', label: 'Casual' },
    { value: 'open_to_explore', label: 'Open to explore' },
];

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

export function DatingProfileDetailRouteScreen({
    route,
    navigation,
}: DatingProfileDetailRouteScreenProps): React.ReactElement {
    const queryClient = useQueryClient();
    const initialProfile = route.params.initialProfile?.id === route.params.profileId
        ? route.params.initialProfile
        : undefined;
    const profileQuery = useQuery({
        queryKey: queryKeys.datingProfileById(route.params.profileId),
        queryFn: () => api.getDatingProfile(route.params.profileId),
        initialData: initialProfile,
    });
    const profile = profileQuery.data ?? initialProfile ?? null;

    const logDatingEvent = useCallback((event: api.DatingEventInput): void => {
        void api.logDatingEvents([{ ...event, event_at: new Date().toISOString() }]).catch(() => {});
    }, []);

    const handleReport = useCallback((): void => {
        if (!profile?.user_id) return;

        appAlert.alert('Report profile', 'Choose the closest reason.', [
            { text: 'Cancel', style: 'cancel' },
            ...DATING_REPORT_OPTIONS.map((option) => ({
                text: option.label,
                onPress: () => {
                    void (async (): Promise<void> => {
                        try {
                            await api.reportUser(profile.user_id as string, { reason: option.reason });
                            logDatingEvent({ event_type: 'report', profile_id: profile.id, payload: { reason: option.reason } });
                            appAlert.alert('Report sent', 'Thanks for helping keep Dating safe.');
                        } catch (error: unknown) {
                            appAlert.alert('Report failed', error instanceof Error ? error.message : 'Please try again.');
                        }
                    })();
                },
            })),
        ]);
    }, [logDatingEvent, profile]);

    const handleBlock = useCallback((): void => {
        if (!profile?.user_id) return;

        appAlert.alert(
            'Block profile?',
            `${formatUsername(profile.username)} will no longer be able to message you, and you will stop seeing them in Dating.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: () => {
                        void (async (): Promise<void> => {
                            try {
                                await api.blockUser(profile.user_id as string);
                                logDatingEvent({ event_type: 'block', profile_id: profile.id });
                                void queryClient.invalidateQueries({ queryKey: ['dating-discover'] });
                                void queryClient.invalidateQueries({ queryKey: ['dating-likes'] });
                                void queryClient.invalidateQueries({ queryKey: ['dating-matches'] });
                                appAlert.alert('Profile blocked', `${formatUsername(profile.username)} has been blocked.`);
                                navigation.goBack();
                            } catch (error: unknown) {
                                appAlert.alert('Block failed', error instanceof Error ? error.message : 'Please try again.');
                            }
                        })();
                    },
                },
            ],
        );
    }, [logDatingEvent, navigation, profile, queryClient]);

    if (profileQuery.isLoading && !profile) {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <ScreenHeader title="Dating profile" onBack={() => navigation.goBack()} />
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                </View>
            </SafeAreaView>
        );
    }

    if (!profile) {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <ScreenHeader title="Dating profile" onBack={() => navigation.goBack()} />
                <DiscoverEmptyState
                    title="Profile unavailable"
                    description="This dating profile could not be loaded."
                    primaryLabel="Try again"
                    onPrimaryPress={() => {
                        void profileQuery.refetch();
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title="Dating profile" onBack={() => navigation.goBack()} />
            <DatingProfileDetailContent
                profile={profile}
                refreshing={profileQuery.isFetching && !profileQuery.isLoading}
                onRefresh={() => {
                    void profileQuery.refetch();
                }}
                onReport={handleReport}
                onBlock={handleBlock}
            />
        </SafeAreaView>
    );
}

function DatingProfileDetailContent({
    profile,
    refreshing,
    onRefresh,
    onReport,
    onBlock,
}: {
    profile: api.DatingProfile;
    refreshing: boolean;
    onRefresh: () => void;
    onReport: () => void;
    onBlock: () => void;
}): React.ReactElement {
    const displayName = profile.age ? `${formatUsername(profile.username)}, ${profile.age}` : formatUsername(profile.username);
    const locationLabel = profile.city
        ? `${profile.city}${profile.country ? `, ${profile.country}` : ''}`
        : profile.country ?? null;
    const goalLabel = relationshipGoalLabel(profile.relationship_goal);
    const detailRows = getDatingDetailRows(profile);
    const prompts = (profile.prompt_answers ?? []).filter((answer) => answer.answer.trim().length > 0);

    return (
        <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={(
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={Colors.primary}
                />
            )}
        >
            <DatingPhotoCarousel
                username={profile.username}
                photos={profile.photos ?? []}
                avatarSize={112}
                style={styles.photo}
            />

            <View style={styles.body}>
                <View style={styles.identityBlock}>
                    <Text style={styles.name}>{displayName}</Text>
                    {locationLabel ? <Text style={styles.meta}>{locationLabel}</Text> : null}
                    {goalLabel ? (
                        <View style={styles.goalPill}>
                            <Ionicons name="heart-outline" size={16} color={Colors.primary} />
                            <Text style={styles.goalText}>{goalLabel}</Text>
                        </View>
                    ) : null}
                </View>

                {profile.bio ? (
                    <ProfileSection title="About">
                        <Text style={styles.bio}>{profile.bio}</Text>
                    </ProfileSection>
                ) : null}

                {profile.interests.length > 0 ? (
                    <ProfileSection title="Interests">
                        <View style={styles.chipWrap}>
                            {profile.interests.map((interest, index) => (
                                <View key={`${interest}-${index}`} style={styles.chip}>
                                    <Text style={styles.chipText} numberOfLines={1}>{interest}</Text>
                                </View>
                            ))}
                        </View>
                    </ProfileSection>
                ) : null}

                {detailRows.length > 0 ? (
                    <ProfileSection title="Basics">
                        <View style={styles.detailStack}>
                            {detailRows.map((detail, index) => (
                                <View key={`${detail.label}-${index}`} style={styles.detailRow}>
                                    <Ionicons name={detail.icon} size={17} color={Colors.text.secondary} />
                                    <Text style={styles.detailText}>{detail.value}</Text>
                                </View>
                            ))}
                        </View>
                    </ProfileSection>
                ) : null}

                {prompts.length > 0 ? (
                    <ProfileSection title="Prompts">
                        <View style={styles.promptStack}>
                            {prompts.map((answer, index) => (
                                <View
                                    key={`${answer.id ?? answer.prompt_key}-${index}`}
                                    style={[styles.promptCard, index === 0 && styles.firstPromptCard]}
                                >
                                    <Text style={styles.promptLabel}>{datingPromptLabel(answer.prompt_key)}</Text>
                                    <Text style={styles.promptAnswer}>{answer.answer}</Text>
                                </View>
                            ))}
                        </View>
                    </ProfileSection>
                ) : null}

                <View style={styles.safetyRow}>
                    <TouchableOpacity style={styles.safetyButton} onPress={onReport} activeOpacity={0.84}>
                        <Ionicons name="flag-outline" size={18} color={Colors.danger} />
                        <Text style={styles.safetyText}>Report</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.safetyButton} onPress={onBlock} activeOpacity={0.84}>
                        <Ionicons name="ban-outline" size={18} color={Colors.danger} />
                        <Text style={styles.safetyText}>Block</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}

function ProfileSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}): React.ReactElement {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

function getDatingDetailRows(profile: api.DatingProfile): Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> {
    const rows: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null }> = [
        { icon: 'heart-outline', label: 'Relationship type', value: labelForOption(RELATIONSHIP_TYPE_OPTIONS, profile.relationship_type ?? '') },
        { icon: 'person-outline', label: 'Gender', value: labelForOption(PROFILE_GENDER_OPTIONS, profile.gender ?? '') },
        { icon: 'sparkles-outline', label: 'Sexuality', value: labelForOption(SEXUALITY_OPTIONS, profile.sexuality ?? '') },
        { icon: 'chatbubble-outline', label: 'Pronouns', value: labelForOption(PRONOUNS_OPTIONS, profile.pronouns ?? '') },
        { icon: 'people-circle-outline', label: 'Ethnicity', value: labelForOption(ETHNICITY_OPTIONS, profile.ethnicity ?? '') },
        { icon: 'people-outline', label: 'Children', value: labelForOption(CHILDREN_OPTIONS, profile.children_status ?? '') },
        { icon: 'paw-outline', label: 'Pets', value: labelForOption(PETS_OPTIONS, profile.pets ?? '') },
        { icon: 'leaf-outline', label: 'Religion', value: labelForOption(RELIGIOUS_BELIEF_OPTIONS, profile.religious_belief ?? '') },
        { icon: 'language-outline', label: 'Languages', value: languageListLabel(profile.languages_spoken ?? []) },
        { icon: 'newspaper-outline', label: 'Politics', value: labelForOption(POLITICAL_VIEW_OPTIONS, profile.political_view ?? '') },
        { icon: 'resize-outline', label: 'Height', value: heightLabel(profile.height_cm) },
        { icon: 'briefcase-outline', label: 'Work', value: workLabel(profile) },
        { icon: 'school-outline', label: 'Education', value: educationLabel(profile) },
    ];

    return rows.filter((row): row is { icon: keyof typeof Ionicons.glyphMap; label: string; value: string } => Boolean(row.value));
}

function relationshipGoalLabel(goal: api.DatingRelationshipGoal): string | null {
    return labelForOption(DATING_GOAL_OPTIONS, goal);
}

function labelForOption<T extends string>(options: DatingOption<T>[], value: T | string): string | null {
    if (!value) return null;
    return options.find((option) => option.value === value)?.label ?? null;
}

function languageListLabel(values: string[]): string | null {
    if (values.length === 0) return null;
    return values.map((value) => labelForOption(LANGUAGE_OPTIONS, value) ?? value).join(', ');
}

function heightLabel(heightCm?: number | null): string | null {
    return heightCm ? `${heightCm} cm` : null;
}

function workLabel(profile: api.DatingProfile): string | null {
    const title = profile.job_title?.trim() ?? '';
    const company = profile.company?.trim() ?? '';
    if (title && company) return `${title} @ ${company}`;
    return title || company || profile.work?.trim() || null;
}

function educationLabel(profile: api.DatingProfile): string | null {
    const course = profile.course?.trim() ?? '';
    const school = profile.school?.trim() ?? '';
    if (course && school) return `${course} @ ${school}`;
    return course || school || profile.education?.trim() || null;
}

function datingPromptLabel(promptKey: string): string {
    switch (promptKey) {
        case 'small_thing_about_me':
            return 'A small thing that says a lot about me';
        case 'friends_describe_me':
            return 'My friends would describe me as';
        case 'proud_of':
            return "One thing I'm proud of";
        case 'happiest_when':
            return "I'm happiest when";
        case 'simple_pleasure':
            return 'A simple pleasure I never get tired of';
        case 'ideal_sober_date':
            return 'My ideal alcohol-free night out';
        case 'best_part_sobriety':
            return 'The best part of sobriety is';
        case 'sober_weekend':
            return "A weekend plan I'll always say yes to";
        case 'recovery_lifestyle':
            return 'My sober life looks like';
        case 'sober_win':
            return "A sober win I'm proud of";
        case 'how_i_reset':
            return 'How I like to reset';
        case 'looking_for':
            return "I'm looking for someone who";
        case 'green_flag':
            return 'The green flag I notice first';
        case 'great_first_date':
            return 'A great first date would be';
        case 'chemistry_when':
            return "I know there's chemistry when";
        case 'dating_intention':
            return 'My dating intention is';
        case 'make_time_for':
            return 'Something I will always make time for';
        case 'value_i_live_by':
            return 'A value I live by';
        case 'matters_most':
            return 'What matters most to me right now';
        case 'feel_connected_when':
            return 'I feel most connected when';
        case 'relationship_works_when':
            return 'A relationship works best when';
        case 'perfect_sunday':
            return 'My perfect Sunday';
        case 'usually_find_me':
            return "You'll usually find me";
        case 'recharge':
            return 'My favourite way to recharge';
        case 'next_adventure':
            return 'The next little adventure I want';
        case 'ask_me_about':
            return 'Ask me about';
        case 'teach_me_about':
            return 'Teach me something about';
        case 'lets_debate':
            return "Let's debate";
        case 'make_me_laugh':
            return 'The quickest way to make me laugh';
        case 'voice_note_includes':
            return 'A voice note from me probably includes';
        default:
            return 'Prompt';
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingBottom: ContentInsets.listBottom,
    },
    photo: {
        width: '100%',
        aspectRatio: 0.78,
        borderRadius: 0,
        backgroundColor: Colors.bg.raised,
    },
    body: {
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingTop: Spacing.md,
        gap: Spacing.lg,
    },
    identityBlock: {
        gap: Spacing.xs,
    },
    name: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    meta: {
        ...TextStyles.secondary,
        color: Colors.text.secondary,
    },
    goalPill: {
        alignSelf: 'flex-start',
        minHeight: 32,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        backgroundColor: Colors.bg.surface,
    },
    goalText: {
        ...TextStyles.label,
        color: Colors.primary,
    },
    section: {
        gap: Spacing.sm,
    },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    bio: {
        ...TextStyles.body,
        color: Colors.text.secondary,
        lineHeight: 22,
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    chip: {
        maxWidth: '100%',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 5,
        backgroundColor: Colors.bg.raised,
    },
    chipText: {
        ...TextStyles.caption,
        color: Colors.text.secondary,
    },
    detailStack: {
        gap: Spacing.sm,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    detailText: {
        flex: 1,
        ...TextStyles.secondary,
        color: Colors.text.secondary,
    },
    promptStack: {
        marginHorizontal: -ContentInsets.screenHorizontal,
    },
    promptCard: {
        gap: 5,
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
    },
    firstPromptCard: {
        borderTopWidth: 1,
        borderTopColor: Colors.border.emphasis,
    },
    promptLabel: {
        ...TextStyles.caption,
        color: Colors.text.secondary,
        fontWeight: '700',
    },
    promptAnswer: {
        ...TextStyles.body,
        color: Colors.text.primary,
        lineHeight: 21,
    },
    safetyRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingTop: Spacing.xs,
    },
    safetyButton: {
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.danger,
        backgroundColor: Colors.dangerSubtle,
    },
    safetyText: {
        ...TextStyles.label,
        color: Colors.danger,
    },
});
