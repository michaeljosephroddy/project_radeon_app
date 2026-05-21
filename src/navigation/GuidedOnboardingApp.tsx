import { appAlert } from '@/components/ui/appAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { DatingDeck } from '../components/discover/DatingDeck';
import { GuidedCoachMark, type GuidedCoachPhase } from '../components/onboarding/GuidedCoachMark';
import { GuidedStepTransition } from '../components/onboarding/GuidedStepTransition';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { PlusUpsellScreen, type PlusActivitySummaryItem } from '../components/PlusUpsellScreen';
import { CreatePostScreen } from '../screens/main/CreatePostScreen';
import { CommunityHubScreen, type CommunityHubSurface } from '../screens/main/CommunityHubScreen';
import { MeetupDetailScreen } from '../screens/main/MeetupDetailScreen';
import { UserProfileScreen } from '../screens/main/UserProfileScreen';
import { GroupDetailScreen } from '../screens/main/groups/GroupDetailScreen';
import type { CommentThreadTarget } from '../screens/main/feed/FeedCommentsModal';
import * as api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { DEFAULT_MEETUP_FILTERS, toMeetupQueryFilters } from '../hooks/useMeetupFilters';
import {
    buildGuidedOnboardingSteps,
    getGuidedStepDescription,
    getGuidedStepTitle,
    type GuidedOnboardingCompletion,
    type GuidedOnboardingStep,
} from '../onboarding/guidedOnboarding';
import { queryKeys } from '../query/queryKeys';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../theme';

interface GuidedOnboardingAppProps {
    onBack: () => void;
}

function emptyCursor<T>(): api.CursorResponse<T> {
    return { items: [], limit: 0, has_more: false, next_cursor: null };
}

const GUIDED_PROGRESS_STORAGE_VERSION = 'v2';
const GUIDED_PROGRESS_STEPS: GuidedOnboardingStep[] = ['friend', 'group', 'meetup', 'post', 'dating_like'];
const GUIDED_SUCCESS_VISIBLE_MS = 760;
const GUIDED_TRANSITION_MS = 260;
const CAN_RESET_GUIDED_PROGRESS = process.env.NODE_ENV !== 'production';
const GUIDED_GROUP_PARAMS: api.ListGroupsParams = {
    q: undefined,
    member_scope: 'discover',
    tag: undefined,
    recovery_pathway: undefined,
    city: undefined,
    country: undefined,
    visibility: undefined,
    group_type: undefined,
    limit: 20,
};
const GUIDED_MEETUP_PARAMS: api.MeetupFilters & { limit: number } = {
    ...toMeetupQueryFilters(DEFAULT_MEETUP_FILTERS),
    limit: 20,
};

function getGuidedProgressStorageKey(userId: string): string {
    return `guided_onboarding:${GUIDED_PROGRESS_STORAGE_VERSION}:${userId}`;
}

function parseStoredCompletion(value: string | null): GuidedOnboardingCompletion {
    if (!value) return {};

    try {
        const parsed: unknown = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object') return {};
        const source = parsed as Record<string, unknown>;
        return GUIDED_PROGRESS_STEPS.reduce<GuidedOnboardingCompletion>((completion, step) => {
            if (source[step] === true) completion[step] = true;
            return completion;
        }, {});
    } catch {
        return {};
    }
}

function getGuidedSuccessLabel(step: GuidedOnboardingStep): string {
    switch (step) {
        case 'friend':
            return 'Friend request sent';
        case 'group':
            return 'Group joined';
        case 'meetup':
            return 'RSVP saved';
        case 'post':
            return 'Post published';
        case 'dating_like':
            return 'Like sent';
        case 'paywall':
            return 'Ready';
    }
}

export function GuidedOnboardingApp({ onBack }: GuidedOnboardingAppProps): React.ReactElement {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [people, setPeople] = useState<api.User[]>([]);
    const [meetups, setMeetups] = useState<api.Meetup[]>([]);
    const [datingProfiles, setDatingProfiles] = useState<api.User[]>([]);
    const [loading, setLoading] = useState(true);
    const [progressLoaded, setProgressLoaded] = useState(false);
    const [completedSteps, setCompletedSteps] = useState<GuidedOnboardingCompletion>({});
    const [acting, setActing] = useState(false);
    const [coachPhase, setCoachPhase] = useState<GuidedCoachPhase>('ready');
    const [successStep, setSuccessStep] = useState<GuidedOnboardingStep | null>(null);
    const [skipDating, setSkipDating] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState<api.User | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedMeetup, setSelectedMeetup] = useState<api.Meetup | null>(null);
    const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    }, []);

    useEffect(() => {
        let cancelled = false;

        if (!user?.id) {
            setCompletedSteps({});
            setProgressLoaded(true);
            return () => {
                cancelled = true;
            };
        }

        setProgressLoaded(false);
        void (async (): Promise<void> => {
            const stored = await AsyncStorage.getItem(getGuidedProgressStorageKey(user.id));
            if (cancelled) return;
            setCompletedSteps(parseStoredCompletion(stored));
            setProgressLoaded(true);
        })();

        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    useEffect(() => {
        let cancelled = false;
        (async (): Promise<void> => {
            setLoading(true);
            try {
                const [peoplePage, meetupsPage, datingPage] = await Promise.all([
                    api.discoverUsers({ limit: 8, intent: 'friends' }).catch(() => emptyCursor<api.User>()),
                    api.getMeetups({ limit: 8, sort: 'recommended' }).catch(() => emptyCursor<api.Meetup>()),
                    user?.connection_intents?.includes('dating')
                        ? api.discoverDatingUsers({ limit: 8 }).catch(() => emptyCursor<api.User>())
                        : Promise.resolve(emptyCursor<api.User>()),
                ]);
                if (cancelled) return;
                setPeople((peoplePage.items ?? []).filter((person) => person.friendship_status !== 'self'));
                setMeetups((meetupsPage.items ?? []).filter((meetup) => !meetup.is_attending && !meetup.can_manage && meetup.status === 'published'));
                setDatingProfiles(datingPage.items ?? []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [user?.connection_intents]);

    useEffect(() => {
        if (!progressLoaded || loading) return;

        void Promise.all([
            queryClient.prefetchInfiniteQuery({
                queryKey: queryKeys.groups(GUIDED_GROUP_PARAMS),
                queryFn: ({ pageParam }) => api.listGroups({
                    ...GUIDED_GROUP_PARAMS,
                    cursor: pageParam as string | undefined,
                }),
                initialPageParam: undefined as string | undefined,
            }),
            queryClient.prefetchInfiniteQuery({
                queryKey: queryKeys.meetups(GUIDED_MEETUP_PARAMS),
                queryFn: ({ pageParam, signal }) => api.getMeetups({
                    ...GUIDED_MEETUP_PARAMS,
                    cursor: pageParam as string | undefined,
                    signal,
                }),
                initialPageParam: undefined as string | undefined,
            }),
            queryClient.prefetchQuery({
                queryKey: queryKeys.meetupCategories(),
                queryFn: () => api.getMeetupCategories(),
            }),
        ]).catch(() => undefined);
    }, [loading, progressLoaded, queryClient]);

    const steps = useMemo(() => {
        const built = buildGuidedOnboardingSteps(user, { hasMeetup: meetups.length > 0 }, completedSteps);
        return skipDating ? built.filter((step) => step !== 'dating_like') : built;
    }, [completedSteps, meetups.length, skipDating, user]);

    const boundedIndex = Math.min(currentIndex, Math.max(steps.length - 1, 0));
    const currentStep = steps[boundedIndex] ?? 'paywall';
    const progressLabel = `Step ${boundedIndex + 1} of ${steps.length}`;

    const prefetchGuidedStep = async (step: GuidedOnboardingStep | undefined): Promise<void> => {
        if (!step) return;

        if (step === 'group') {
            await queryClient.prefetchInfiniteQuery({
                queryKey: queryKeys.groups(GUIDED_GROUP_PARAMS),
                queryFn: ({ pageParam }) => api.listGroups({
                    ...GUIDED_GROUP_PARAMS,
                    cursor: pageParam as string | undefined,
                }),
                initialPageParam: undefined as string | undefined,
            });
            return;
        }

        if (step === 'meetup') {
            await Promise.all([
                queryClient.prefetchInfiniteQuery({
                    queryKey: queryKeys.meetups(GUIDED_MEETUP_PARAMS),
                    queryFn: ({ pageParam, signal }) => api.getMeetups({
                        ...GUIDED_MEETUP_PARAMS,
                        cursor: pageParam as string | undefined,
                        signal,
                    }),
                    initialPageParam: undefined as string | undefined,
                }),
                queryClient.prefetchQuery({
                    queryKey: queryKeys.meetupCategories(),
                    queryFn: () => api.getMeetupCategories(),
                }),
            ]);
        }
    };

    const completeMilestone = async (step: GuidedOnboardingStep, update: api.UpdateMeInput): Promise<void> => {
        const nextCompleted = { ...completedSteps, [step]: true };
        const nextSteps = buildGuidedOnboardingSteps(user, { hasMeetup: meetups.length > 0 }, nextCompleted);
        const nextStep = (skipDating ? nextSteps.filter((item) => item !== 'dating_like') : nextSteps)[0];

        setCoachPhase('acting');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSuccessStep(step);
        setCoachPhase('success');

        const nextStepReady = (async (): Promise<boolean> => {
            await api.updateMe(update);
            if (user?.id) {
                await AsyncStorage.setItem(getGuidedProgressStorageKey(user.id), JSON.stringify(nextCompleted));
            }
            await prefetchGuidedStep(nextStep);
            return true;
        })().catch((error: unknown) => {
            setSuccessStep(null);
            setCoachPhase('ready');
            appAlert.alert('Could not save onboarding progress', error instanceof Error ? error.message : 'Please try again.');
            return false;
        });

        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);

        successTimerRef.current = setTimeout(() => {
            void (async (): Promise<void> => {
                const canAdvance = await nextStepReady;
                if (!canAdvance) return;
                setCoachPhase('transitioning');
                transitionTimerRef.current = setTimeout(() => {
                    setCompletedSteps(nextCompleted);
                    setSelectedFriend(null);
                    setSelectedGroupId(null);
                    setSelectedMeetup(null);
                    setSuccessStep(null);
                    setCurrentIndex(0);
                    setCoachPhase('ready');
                }, GUIDED_TRANSITION_MS);
            })();
        }, GUIDED_SUCCESS_VISIBLE_MS);
    };

    const handleFriendActionComplete = async (profile: api.User): Promise<void> => {
        if (acting) return;
        if (profile.friendship_status !== 'outgoing' && profile.friendship_status !== 'friends') {
            return;
        }
        setActing(true);
        try {
            await completeMilestone('friend', { onboarding_first_friend_user_id: profile.id });
        } catch (error: unknown) {
            appAlert.alert('Could not save onboarding progress', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setActing(false);
        }
    };

    const handleGroupJoined = async (group: api.Group): Promise<void> => {
        if (acting) return;
        setActing(true);
        try {
            await completeMilestone('group', { onboarding_first_group_id: group.id });
        } catch (error: unknown) {
            appAlert.alert('Could not save onboarding progress', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setActing(false);
        }
    };

    const handleRsvpComplete = async (meetup: api.Meetup, result: api.MeetupRsvpResult): Promise<void> => {
        if (acting || (!result.attending && !result.waitlisted)) return;
        setActing(true);
        try {
            await completeMilestone('meetup', { onboarding_first_meetup_id: meetup.id });
        } catch (error: unknown) {
            appAlert.alert('Could not save onboarding progress', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setActing(false);
        }
    };

    const handlePostCreated = async (post: { id: string }): Promise<void> => {
        try {
            await completeMilestone('post', { onboarding_first_post_id: post.id });
        } catch (error: unknown) {
            appAlert.alert('Could not save onboarding progress', error instanceof Error ? error.message : 'Please try again.');
        }
    };

    const handleDatingLike = async (profile: api.User): Promise<void> => {
        if (acting) return;
        setActing(true);
        try {
            await api.recordDatingAction(profile.id, 'like');
            setDatingProfiles((current) => current.filter((item) => item.id !== profile.id));
            await completeMilestone('dating_like', { onboarding_first_dating_like_user_id: profile.id });
        } catch (error: unknown) {
            appAlert.alert('Could not send like', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setActing(false);
        }
    };

    const handleDatingPass = (profile: api.User): void => {
        setDatingProfiles((current) => current.filter((item) => item.id !== profile.id));
    };

    const blockedGuideAction = (): void => {
        appAlert.alert('Finish guided setup', 'Complete this guided step before exploring the rest of the app.');
    };

    const noopComments = (_thread: CommentThreadTarget, _focusComposer: boolean, _onCommentCreated?: (comment: api.Comment) => void): void => {
        blockedGuideAction();
    };

    const handleCommunitySurfaceChange = (_surface: CommunityHubSurface): void => {
        blockedGuideAction();
    };

    const resetGuidedProgress = async (): Promise<void> => {
        if (!user?.id) return;
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        await AsyncStorage.removeItem(getGuidedProgressStorageKey(user.id));
        setCompletedSteps({});
        setSkipDating(false);
        setSelectedFriend(null);
        setSelectedGroupId(null);
        setSelectedMeetup(null);
        setSuccessStep(null);
        setCoachPhase('ready');
        setCurrentIndex(0);
    };

    const activitySummary = useMemo<PlusActivitySummaryItem[]>(() => ([
        { key: 'profile', label: 'Profile created', completed: true },
        { key: 'verification', label: 'ID verification ready', completed: true },
        { key: 'friend', label: 'Friend request sent', completed: Boolean(completedSteps.friend || user?.onboarding_first_friend_user_id) },
        { key: 'group', label: 'Group joined or requested', completed: Boolean(completedSteps.group || user?.onboarding_first_group_id) },
        ...(completedSteps.meetup || user?.onboarding_first_meetup_id ? [{ key: 'meetup', label: 'Meetup RSVP saved', completed: true }] : []),
        { key: 'post', label: 'First post created', completed: Boolean(completedSteps.post || user?.onboarding_first_post_id) },
        ...(completedSteps.dating_like || user?.onboarding_first_dating_like_user_id ? [{ key: 'dating', label: 'First like sent', completed: true }] : []),
    ]), [completedSteps, user]);
    const canNavigateGuide = coachPhase === 'ready';
    const defaultGuideBack = canNavigateGuide
        ? (boundedIndex === 0 ? onBack : () => setCurrentIndex((index) => Math.max(0, index - 1)))
        : undefined;
    const successLabel = successStep ? getGuidedSuccessLabel(successStep) : undefined;
    const transitionKey = [
        currentStep,
        selectedFriend?.id ?? 'friend-list',
        selectedGroupId ?? 'group-list',
        selectedMeetup?.id ?? 'meetup-list',
        datingProfiles[0]?.id ?? 'dating-empty',
    ].join(':');

    const renderCoach = (onBackPress = defaultGuideBack): React.ReactElement => (
        <GuidedCoachMark
            title={getGuidedStepTitle(currentStep)}
            description={getGuidedStepDescription(currentStep)}
            progressLabel={progressLabel}
            phase={coachPhase}
            successLabel={successLabel}
            onBack={onBackPress}
        />
    );
    const coachBack = currentStep === 'friend' && selectedFriend && canNavigateGuide
        ? () => setSelectedFriend(null)
        : defaultGuideBack;

    const renderGuidedContent = (): React.ReactNode => {
        if (currentStep === 'post') {
            return (
                <CreatePostScreen
                    closeOnSubmit={false}
                    guidedHighlightSubmit={coachPhase === 'ready'}
                    onBack={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                    onPostCreated={handlePostCreated}
                />
            );
        }

        if (currentStep === 'friend' && selectedFriend) {
            return (
                <UserProfileScreen
                    userId={selectedFriend.id}
                    username={selectedFriend.username}
                    avatarUrl={selectedFriend.avatar_url ?? undefined}
                    isActive
                    onBack={() => setSelectedFriend(null)}
                    onOpenChat={blockedGuideAction}
                    onOpenComments={noopComments}
                    onComposeDM={blockedGuideAction}
                    onFriendActionComplete={(profile) => void handleFriendActionComplete(profile)}
                    guidedHighlightFriendAction={coachPhase === 'ready'}
                />
            );
        }

        if (currentStep === 'group') {
            return selectedGroupId ? (
                <GroupDetailScreen
                    groupId={selectedGroupId}
                    onBack={() => setSelectedGroupId(null)}
                    onOpenComments={blockedGuideAction}
                    onOpenChat={blockedGuideAction}
                    focusPostRequest={null}
                    onFocusPostConsumed={() => undefined}
                    focusSupportRequest={null}
                    onFocusSupportRequestConsumed={() => undefined}
                />
            ) : (
                <CommunityHubScreen
                    isActive
                    activeSurface="groups"
                    onChangeSurface={handleCommunitySurfaceChange}
                    onOpenGroup={setSelectedGroupId}
                    onOpenUserProfile={blockedGuideAction}
                    onOpenMeetup={blockedGuideAction}
                    onOpenManageMeetup={blockedGuideAction}
                    onGroupJoined={(group) => void handleGroupJoined(group)}
                    guidedHighlightGroupJoinAction={coachPhase === 'ready'}
                />
            );
        }

        if (currentStep === 'meetup') {
            return selectedMeetup ? (
                <MeetupDetailScreen
                    meetup={selectedMeetup}
                    onBack={() => setSelectedMeetup(null)}
                    onOpenUserProfile={blockedGuideAction}
                    onRsvpComplete={(meetup, result) => void handleRsvpComplete(meetup, result)}
                    guidedHighlightPrimaryAction={coachPhase === 'ready'}
                />
            ) : (
                <CommunityHubScreen
                    isActive
                    activeSurface="meetups"
                    onChangeSurface={handleCommunitySurfaceChange}
                    onOpenGroup={blockedGuideAction}
                    onOpenUserProfile={blockedGuideAction}
                    onOpenMeetup={setSelectedMeetup}
                    onOpenManageMeetup={blockedGuideAction}
                    onRsvpComplete={(meetup, result) => void handleRsvpComplete(meetup, result)}
                    guidedHighlightMeetupRsvpAction={coachPhase === 'ready'}
                />
            );
        }

        if (currentStep === 'dating_like') {
            return datingProfiles.length ? (
                <DatingDeck
                    users={datingProfiles}
                    loading={false}
                    fetchingNext={false}
                    emptyTitle="No dating profiles right now"
                    emptyDescription="Dating only includes people who also opted in. You can continue and check back later."
                    guidedHighlightConnectAction={coachPhase === 'ready'}
                    onLike={(profile) => void handleDatingLike(profile)}
                    onPass={handleDatingPass}
                    onOpenProfile={blockedGuideAction}
                    onLoadMore={() => undefined}
                />
            ) : (
                <View style={styles.content}>
                    <EmptyGuidedState
                        title="No dating profiles right now"
                        description="Dating only includes people who also opted in. You can continue and check back later."
                    />
                    <PrimaryButton
                        label="Continue"
                        onPress={() => {
                            setSkipDating(true);
                            setCurrentIndex((index) => index + 1);
                        }}
                        variant="secondary"
                    />
                </View>
            );
        }

        return (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {currentStep === 'friend' ? renderFriendPicker(people, acting || coachPhase !== 'ready', setSelectedFriend) : null}
            </ScrollView>
        );
    };

    if (loading || !progressLoaded) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.centered}>
                    <ActivityIndicator color={Colors.primary} />
                    <Text style={styles.loadingText}>Preparing your guided setup...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (currentStep === 'paywall') {
        return (
            <PlusUpsellScreen
                primaryLabel="Unlock SoberSpace"
                dismissLabel={CAN_RESET_GUIDED_PROGRESS ? 'Restart guided tour' : undefined}
                activitySummary={activitySummary}
                onPrimary={() => appAlert.alert('Subscription checkout', 'Membership checkout is not connected yet.')}
                onDismiss={CAN_RESET_GUIDED_PROGRESS ? () => void resetGuidedProgress() : undefined}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {renderCoach(coachBack)}
            <GuidedStepTransition stepKey={transitionKey} transitioning={coachPhase === 'transitioning'}>
                {renderGuidedContent()}
            </GuidedStepTransition>
        </SafeAreaView>
    );
}

function renderFriendPicker(
    people: api.User[],
    acting: boolean,
    onSelect: (person: api.User) => void,
): React.ReactNode {
    return people.length ? people.map((person) => (
        <PersonActionCard
            key={person.id}
            user={person}
            label="View profile"
            icon="person-outline"
            disabled={acting}
            onPress={() => onSelect(person)}
        />
    )) : <EmptyGuidedState title="No friend suggestions right now" description="Try again shortly to send your first request." />;
}

function PersonActionCard({
    user,
    label,
    icon,
    disabled,
    onPress,
}: {
    user: api.User;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    disabled: boolean;
    onPress: () => void;
}): React.ReactElement {
    return (
        <TouchableOpacity style={styles.personCard} onPress={onPress} disabled={disabled} activeOpacity={0.86}>
            {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
            ) : (
                <Avatar username={user.username} size={54} fontSize={18} />
            )}
            <View style={styles.personBody}>
                <Text style={styles.cardTitle}>@{user.username}</Text>
                <Text style={styles.cardMeta}>{[user.city, user.country].filter(Boolean).join(', ') || 'SoberSpace member'}</Text>
                {user.bio ? <Text style={styles.cardBody} numberOfLines={2}>{user.bio}</Text> : null}
            </View>
            <View style={styles.actionPill}>
                <Ionicons name={icon} size={15} color={Colors.textOn.primary} />
                <Text style={styles.actionPillText}>{label}</Text>
            </View>
        </TouchableOpacity>
    );
}

function EmptyGuidedState({ title, description }: { title: string; description: string }): React.ReactElement {
    return (
        <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{title}</Text>
            <Text style={styles.emptyDescription}>{description}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    flex: { flex: 1 },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
        padding: Spacing.xl,
    },
    loadingText: {
        ...TextStyles.secondary,
        textAlign: 'center',
    },
    content: {
        gap: Spacing.md,
        padding: Spacing.md,
        paddingBottom: Spacing.xl,
    },
    card: {
        gap: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
    },
    personCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
    },
    avatarImage: {
        width: 54,
        height: 54,
        borderRadius: 27,
    },
    personBody: { flex: 1 },
    cardTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    cardBody: {
        fontSize: Typography.sizes.sm,
        lineHeight: 19,
        color: Colors.text.secondary,
    },
    cardMeta: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    actionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    actionPillText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    emptyWrap: {
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.lg,
    },
    emptyTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    emptyDescription: {
        fontSize: Typography.sizes.sm,
        lineHeight: 19,
        color: Colors.text.secondary,
    },
});
