import type { User } from '../api/client';

export type GuidedOnboardingStep =
    | 'friend'
    | 'group'
    | 'meetup'
    | 'post'
    | 'dating_like'
    | 'paywall';

export interface GuidedOnboardingAvailability {
    hasMeetup: boolean;
}

export type GuidedOnboardingCompletion = Partial<Record<GuidedOnboardingStep, boolean>>;

export function buildGuidedOnboardingSteps(
    user: User | null,
    availability: GuidedOnboardingAvailability,
    completedSteps?: GuidedOnboardingCompletion,
): GuidedOnboardingStep[] {
    const steps: GuidedOnboardingStep[] = [];
    const friendComplete = completedSteps ? completedSteps.friend : Boolean(user?.onboarding_first_friend_user_id);
    const groupComplete = completedSteps ? completedSteps.group : Boolean(user?.onboarding_first_group_id);
    const meetupComplete = completedSteps ? completedSteps.meetup : Boolean(user?.onboarding_first_meetup_id);
    const postComplete = completedSteps ? completedSteps.post : Boolean(user?.onboarding_first_post_id);
    const datingLikeComplete = completedSteps ? completedSteps.dating_like : Boolean(user?.onboarding_first_dating_like_user_id);

    if (!friendComplete) steps.push('friend');
    if (!groupComplete) steps.push('group');
    if (availability.hasMeetup && !meetupComplete) steps.push('meetup');
    if (!postComplete) steps.push('post');
    if (user?.connection_intents?.includes('dating') && !datingLikeComplete) {
        steps.push('dating_like');
    }

    steps.push('paywall');
    return steps;
}

export function getGuidedStepTitle(step: GuidedOnboardingStep): string {
    switch (step) {
        case 'friend':
            return 'Add your first friend';
        case 'group':
            return 'Join your first group';
        case 'meetup':
            return 'RSVP to a meetup';
        case 'post':
            return 'Make your first post';
        case 'dating_like':
            return 'Send your first like';
        case 'paywall':
            return 'Your SoberSpace is ready';
    }
}

export function getGuidedStepDescription(step: GuidedOnboardingStep): string {
    switch (step) {
        case 'friend':
            return 'Pick someone from Discover and send a real friend request.';
        case 'group':
            return 'Choose a group and join the conversation.';
        case 'meetup':
            return 'Save a spot at an upcoming sober meetup.';
        case 'post':
            return 'Share a quick check-in so your feed starts with your own activity.';
        case 'dating_like':
            return 'Like one dating profile to start your dating activity.';
        case 'paywall':
            return 'Subscribe to view your activity, keep connecting, and continue using the community.';
    }
}
