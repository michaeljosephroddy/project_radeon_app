# Build Guided Restricted Onboarding App Mode

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `PLANS.md` in this repository. A future contributor must maintain it according to that file: keep it self-contained, update it as work proceeds, and make every milestone demonstrably verifiable.

## Purpose / Big Picture

New users should feel like they are using SoberSpace before they hit the subscription wall. The current onboarding flow collects profile fields and has standalone first-action screens, but those screens do not feel like the real app. After this change, a new user finishes profile setup and then enters a restricted guided app mode: they add a friend from a real profile, join a real group, optionally RSVP to a real meetup, create a real feed post, optionally send a dating like if they opted into dating, and then see a paywall that summarizes the activity they just created.

The finished behavior is visible by registering a new account. The user can go through profile setup, see an ID verification placeholder, enter a guided version of the app, perform each guided action in real app surfaces, and then land on a paywall that says their SoberSpace is ready and lists the friend request, group join, post, meetup RSVP if available, and dating like if applicable. The user cannot freely browse unrelated parts of the app during this guided mode.

## Progress

- [x] (2026-05-20T23:55Z) Read `PLANS.md` and inspected the current app surfaces that guided onboarding must reuse: `AppNavigator`, `DiscoverScreen`, `FeedScreen`, `CreatePostScreen`, `CommunityHubScreen`, `GroupDetailScreen`, `MeetupDetailScreen`, `MeetupsScreen`, `DatingDeck`, `PlusUpsellScreen`, and `src/api/client.ts`.
- [x] (2026-05-20T23:55Z) Confirmed the app already has a branch-local placeholder ID verification step in `src/screens/onboarding/IdentityVerificationStep.tsx`, but that change is not committed at the time this plan was written.
- [x] (2026-05-20T23:55Z) Authored this ExecPlan for the guided restricted onboarding mode.
- [x] (2026-05-20T23:55Z) Added backend milestone columns for first meetup RSVP and first dating like, exposed them through `/users/me`, and persisted them through the existing onboarding milestone update path.
- [x] (2026-05-20T23:55Z) Added a guided onboarding state model in the app that computes required steps from user state and available data.
- [x] (2026-05-20T23:55Z) Replaced the active standalone first friend, first group, and first post onboarding path with a guided restricted app shell.
- [x] (2026-05-20T23:55Z) Added a conditional guided meetup RSVP step that skips cleanly when no suitable meetups exist.
- [x] (2026-05-20T23:55Z) Added a conditional guided dating-like step that only appears when the user chose Dating during onboarding.
- [x] (2026-05-20T23:55Z) Updated the hard paywall to summarize the user's completed onboarding activity and block main app access until subscription checkout exists.
- [x] (2026-05-20T23:55Z) Ran backend tests, app typecheck, and applied migration `080_onboarding_guided_action_milestones.sql`.
- [x] (2026-05-21T00:35Z) Completed the deeper guided embedding pass: friend uses a real profile screen, groups and meetups use the community hub and detail screens, post creation returns into the real feed, and dating uses the real dating deck.
- [x] (2026-05-21T00:35Z) Re-ran app typecheck after embedding the real guided surfaces.
- [x] (2026-05-21T00:55Z) Changed guided actions to auto-advance after successful completion and moved step suppression to versioned local guided-tour progress instead of old server milestone presence.
- [x] (2026-05-21T01:15Z) Added production polish pass: coach-mark guidance, animated step entrance, success feedback phase, haptic success, and delayed smooth auto-advance.
- [x] (2026-05-21T01:25Z) Added a non-production guided paywall reset action so the interactive tour can be retested for the same user/device without clearing all app storage.
- [x] (2026-05-21T01:40Z) Added stable guided shell rendering, transition overlay masking, cache warmup for guided surfaces, and first-pass highlights on the target action controls.
- [ ] Run manual guided onboarding QA for both dating and non-dating users on device.

## Surprises & Discoveries

- Observation: The app already has the APIs needed for most guided actions.
    Evidence: `src/api/client.ts` exposes `discoverUsers`, `sendFriendRequest`, `listGroups`, `joinGroup`, `getMeetups`, `rsvpMeetup`, `createPost`, and `recordDatingAction`.

- Observation: The current first-action onboarding steps are standalone screens, not real app walkthroughs.
    Evidence: `src/screens/onboarding/FirstFriendStep.tsx`, `FirstGroupStep.tsx`, and `FirstPostStep.tsx` were added as isolated onboarding screens. They perform real API calls but do not open the real Discover profile, Group detail, Feed, or Meetup detail surfaces.

- Observation: Meetup RSVP must be conditional.
    Evidence: Meetups depend on location, date, and seeded/live data. `api.getMeetups()` may return an empty cursor page. Forcing RSVP when no meetup exists would block onboarding for users in sparse locations.

- Observation: Dating like must be conditional on connection intent.
    Evidence: `DiscoverScreen` computes `datingEnabled = user?.connection_intents?.includes('dating') ?? false` and only shows the Dating tab when the user opted in.

- Observation: The backend has first friend, first group, and first post milestone fields, but not first meetup or first dating-like fields.
    Evidence: `src/api/client.ts` currently includes `onboarding_first_friend_user_id`, `onboarding_first_group_id`, and `onboarding_first_post_id`, but not `onboarding_first_meetup_id` or `onboarding_first_dating_like_user_id`.

- Observation: The real group join action lives on group cards rather than in `GroupDetailScreen`.
    Evidence: `GroupsScreen` owns `useJoinGroupMutation` and the join callback. The guided flow therefore lets the user browse/open group detail, but milestone completion is attached to the real group card join action and then keeps the user on the joined group detail screen.

- Observation: The real feed focus mechanism opens comments for a focused post.
    Evidence: `FeedScreen` consumes `focusRequest` by finding the post and calling `onOpenComments`. The guided first-post success therefore returns to the real feed without passing `focusRequest`, so it does not unexpectedly open comments during onboarding.

- Observation: Existing server milestone fields can be set by older or partial onboarding attempts.
    Evidence: `buildGuidedOnboardingSteps` originally skipped friend, group, and post whenever `/users/me` returned `onboarding_first_*` IDs, which can hide required guided-tour steps for a user who has not experienced the new guided flow.

- Observation: The first auto-advance implementation felt jumpy because screen unmounting was the transition.
    Evidence: `completeMilestone` updated completion state, refreshed `/users/me`, cleared selected detail state, and reset the current index in one turn, causing React to immediately replace the active screen with the next guided step.

- Observation: Guided-tour retesting needs a local reset path.
    Evidence: The guide stores versioned completion state in AsyncStorage as `guided_onboarding:v2:<userId>`. Once those local flags are true, the same user/device correctly resumes at the guided paywall, which makes QA of the interactive steps awkward.

- Observation: Data prefetch alone does not hide child-screen mount work.
    Evidence: Groups, meetups, profile, composer, and dating are still real screen trees that can do local first-render setup after they mount. Keeping the guided shell stable and covering the content during transition masks that setup better than relying only on warmed query caches.

## Decision Log

- Decision: Keep classic profile setup screens, then switch into guided app mode for the action steps.
    Rationale: Profile setup fields are forms and should stay focused. Friend, group, meetup, post, and dating actions are value moments and should happen in real app surfaces.
    Date/Author: 2026-05-20 / Codex

- Decision: Make meetup RSVP optional and data-driven.
    Rationale: RSVP is valuable when there is a suitable event, but unavailable meetups should not block onboarding. The step should appear only if `getMeetups` returns at least one joinable event.
    Date/Author: 2026-05-20 / Codex

- Decision: Make dating like conditional on the user's onboarding connection intent.
    Rationale: Dating should never be shown to users who did not opt in. When a user did opt in, sending the first like is a strong value moment and belongs before the paywall.
    Date/Author: 2026-05-20 / Codex

- Decision: Persist first meetup and first dating-like milestones on the backend.
    Rationale: The paywall summary and resume behavior need server-backed state. Local React state would be lost across app restart and would not support analytics or later enforcement.
    Date/Author: 2026-05-20 / Codex

- Decision: Prefer a small guided wrapper and guided props over duplicating entire app screens.
    Rationale: The user should experience the real app. Reusing existing screens preserves visual and interaction consistency. Guided props can restrict unrelated controls and highlight the current target without forking the UI.
    Date/Author: 2026-05-20 / Codex

- Decision: Complete the deeper embedding in `GuidedOnboardingApp` without refactoring `AppNavigator`.
    Rationale: `AppNavigator` owns the unrestricted app shell. A dedicated guided wrapper can reuse real screens while blocking unrelated navigation and avoiding risk to the normal subscribed app.
    Date/Author: 2026-05-21 / Codex

- Decision: Auto-advance immediately after each successful guided action.
    Rationale: The explicit Continue button adds friction and can collide with device bottom navigation. Successful action completion is a clear enough transition point.
    Date/Author: 2026-05-21 / Codex

- Decision: Use versioned local guided-tour progress to decide which guided steps are complete, while still saving server milestones for backend state and paywall summary.
    Rationale: Older server milestone values should not hide the new guided tour. Versioned local progress lets this guided implementation show friend, group, post, optional meetup, and optional dating steps once, then resume correctly within this guided version.
    Date/Author: 2026-05-21 / Codex

- Decision: Use a lightweight coach mark plus success/transition phases instead of a full spotlight overlay.
    Rationale: A spotlight overlay requires measuring nested list/detail targets and can become brittle on React Native. The coach mark, target instruction, haptic success, and animated screen entrance give the guide a polished feel while keeping the implementation stable.
    Date/Author: 2026-05-21 / Codex

- Decision: Add direct target highlights before a measurement-based spotlight engine.
    Rationale: Highlighting known action controls gives the user clear guidance with low rendering risk. A true spotlight can be layered later if QA shows the simpler approach is not clear enough.
    Date/Author: 2026-05-21 / Codex

## Outcomes & Retrospective

The implementation is complete through static validation. It adds backend state for meetup and dating-like milestones, a guided onboarding step model, a restricted guided app shell, conditional meetup and dating steps, real first-action API calls, the real post composer, a real dating deck like action, and a paywall activity summary. The guide blocks unrelated exploration with a short alert and now uses coach-mark guidance, success feedback, haptics, and animated transitions before auto-advancing. Remaining work is manual device QA for dating and non-dating accounts and the future real subscription checkout / identity verification provider integrations.

## Context and Orientation

There are two repositories involved. The app lives at `/home/michaelroddy/repos/project_radeon_app`. The Go backend lives at `/home/michaelroddy/repos/project_radeon`.

The app is a React Native Expo app. All HTTP calls go through `src/api/client.ts`. Auth and current user state live in `src/hooks/useAuth.tsx`. The root app chooser is `App.tsx`, which currently decides between auth, onboarding, paywall, and the main app.

The main app shell is `src/navigation/AppNavigator.tsx`. It owns tab state, modal state, create flows, detail screens, and callbacks. The main tabs are feed, discover, community, and chats. In normal app mode this shell is unrestricted.

Onboarding currently lives in `src/navigation/OnboardingNavigator.tsx`. It uses numeric steps to show onboarding screens. At the time this plan was written, the branch also contains a new placeholder `src/screens/onboarding/IdentityVerificationStep.tsx` and the navigator includes it after the profile identity step. If this branch is lost, recreate that placeholder before implementing this plan.

Guided app mode means a restricted version of the real app. The user sees real Discover, Groups, Meetups, Feed, Profile, Dating, and Composer screens, but only the current task is enabled. For example, during the friend step, Discover and a selected profile are usable, but unrelated tabs and actions are disabled or show a short prompt.

The real app surfaces to reuse are:

- `src/screens/main/DiscoverScreen.tsx` for friend suggestions and Dating. It already has friend cards, user profile opening, and dating deck actions.
- `src/screens/main/UserProfileScreen.tsx` for showing the person after the friend request is sent.
- `src/screens/main/CommunityHubScreen.tsx` for the groups/meetups shell.
- `src/screens/main/GroupsScreen.tsx` for group discovery.
- `src/screens/main/groups/GroupDetailScreen.tsx` for showing the group after join.
- `src/screens/main/MeetupsScreen.tsx` for meetup discovery.
- `src/screens/main/MeetupDetailScreen.tsx` for the RSVP action.
- `src/screens/main/FeedScreen.tsx` for showing the created post in feed context.
- `src/screens/main/CreatePostScreen.tsx` and `src/screens/main/createPost/PostComposer.tsx` for first post creation.
- `src/components/PlusUpsellScreen.tsx` for the hard paywall.

The backend currently has migrations through `079_generic_profile_interests.sql`. Onboarding state added earlier includes `users.onboarding_completed_at`, identity verification fields, `onboarding_first_friend_user_id`, `onboarding_first_group_id`, `onboarding_first_post_id`, and `onboarding_owner_welcome_comment_id`. The backend user API code is in `/home/michaelroddy/repos/project_radeon/internal/user/handler.go`, `store.go`, and `cache_store.go`.

## Plan of Work

### Milestone 1: Add backend milestone state for meetup and dating actions

Add a new migration in `/home/michaelroddy/repos/project_radeon/migrations/080_onboarding_guided_action_milestones.sql`. This migration adds:

    onboarding_first_meetup_id UUID NULL REFERENCES meetups(id) ON DELETE SET NULL
    onboarding_first_dating_like_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL

Update `/home/michaelroddy/repos/project_radeon/schema/base.sql` with the same columns. Because `meetups` and `users` table creation order can matter in a schema snapshot, follow the pattern already used for onboarding first group/post/comment constraints: add plain UUID columns in the `users` table if direct table references are not available yet, then add foreign key constraints later after referenced tables exist.

Update backend user response fields in `/home/michaelroddy/repos/project_radeon/internal/user/handler.go` so `User` includes:

    OnboardingFirstMeetupID *uuid.UUID `json:"onboarding_first_meetup_id"`
    OnboardingFirstDatingLikeUserID *uuid.UUID `json:"onboarding_first_dating_like_user_id"`

Update `internal/user/store.go` `GetUser` SELECT and Scan to include the fields. Update the `UpdateOnboardingMilestones` method to accept first meetup and first dating-like IDs. Keep the method idempotent: use `COALESCE($value, existing_column)` and do not overwrite an existing milestone with null.

Update `internal/user/cache_store.go`, `internal/user/handler_test.go`, and `internal/user/cache_store_test.go` to match the new interface signature. Run:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project_radeon_go_cache go test ./...
    make migrate
    make migrate-status | tail -12

Expected result: tests pass, migration `080_onboarding_guided_action_milestones.sql` shows `applied`, and no historical applied migration reports `modified`.

### Milestone 2: Add app API fields and guided step state

Update `src/api/client.ts` `User` and `UpdateMeInput` with:

    onboarding_first_meetup_id?: string | null
    onboarding_first_dating_like_user_id?: string | null

For update input:

    onboarding_first_meetup_id?: string
    onboarding_first_dating_like_user_id?: string

Create `src/onboarding/guidedOnboarding.ts` or `src/utils/guidedOnboarding.ts`. This file should define:

    export type GuidedOnboardingStep =
      | 'friend'
      | 'group'
      | 'meetup'
      | 'post'
      | 'dating_like'
      | 'paywall';

    export interface GuidedOnboardingState {
      steps: GuidedOnboardingStep[];
      currentStep: GuidedOnboardingStep;
      completed: Partial<Record<GuidedOnboardingStep, boolean>>;
    }

Add a function that computes required steps from the current user and availability flags:

    friend is required unless onboarding_first_friend_user_id exists.
    group is required unless onboarding_first_group_id exists.
    meetup is included only when a suitable meetup exists and onboarding_first_meetup_id is empty.
    post is required unless onboarding_first_post_id exists.
    dating_like is included only when connection_intents includes dating and onboarding_first_dating_like_user_id is empty.
    paywall is always last.

Do not mark onboarding complete in this guided state. Completion should still happen only when the user has an active subscription or when the future checkout callback updates subscription state.

### Milestone 3: Introduce the guided app shell

Create `src/navigation/GuidedOnboardingApp.tsx`. This component replaces the standalone first friend, first group, first post, and Plus steps inside `OnboardingNavigator`.

`GuidedOnboardingApp` should:

- Read `user` and `refreshUser` from `useAuth`.
- Compute whether dating is opted in from `user.connection_intents`.
- Probe for meetup availability with `api.getMeetups({ limit: 1, sort: 'recommended' })` after the user has location data. If no meetup is returned, exclude the meetup step.
- Render a compact guided banner at the top. The banner should have title, one-sentence instruction, and progress text such as `Step 2 of 5`.
- Render the real surface for the current guided step.
- Disable unrelated tabs and global create actions.
- Use `appAlert.alert('Finish this step', 'Complete the highlighted action to continue.')` when the user taps outside the allowed guide path.

Create a reusable component `src/components/onboarding/GuidedOnboardingBanner.tsx`. Use existing design tokens from `src/theme`. It should not use marketing copy or a large hero layout; this is an in-app guidance banner.

In `src/navigation/OnboardingNavigator.tsx`, keep classic steps through Intent. After Intent, render `GuidedOnboardingApp` instead of standalone `FirstFriendStep`, `FirstGroupStep`, `FirstPostStep`, and `PlusStep`. The earlier standalone files can remain temporarily until the new guided flow is stable, but they should be removed before final commit if no longer referenced.

### Milestone 4: Guided first friend in real Discover/Profile surfaces

Update `src/screens/main/DiscoverScreen.tsx` to accept an optional guided prop. Prefer a small interface:

    interface DiscoverGuidedMode {
      step: 'friend' | 'dating_like';
      onFriendRequestSent?: (user: api.User) => void;
      onDatingLikeSent?: (user: api.User) => void;
      onBlockedAction?: () => void;
    }

When guided mode step is `friend`, force the friends tab, hide filters that are not needed, and keep user cards tappable. The user should be able to open a profile. The friend add button should be highlighted or at least visually prominent. After `api.sendFriendRequest`, call `api.updateMe({ onboarding_first_friend_user_id: selectedUser.id })`, call `refreshUser`, and call `onFriendRequestSent`.

Show the added user in their profile after the request. There are two acceptable implementation paths:

1. Open `UserProfileScreen` in guided mode and show the normal profile with the friend status updated to outgoing.
2. Keep the user in Discover but show a profile-style success panel with avatar, username, and `Friend request sent`.

Prefer path 1 if it can be done without a large refactor, because the user specifically wants to see the user added to their profile. Add a small guided prop to `UserProfileScreen` if needed:

    guidedSuccessMessage?: string
    restrictActions?: boolean

Acceptance: during guided friend step, the user selects a real person, sends a real friend request, sees that profile show an outgoing/sent state, and then can continue.

### Milestone 5: Guided first group in real Groups/Group detail surfaces

Use `CommunityHubScreen` with `activeSurface='groups'` for the group step. Add optional guided props to `CommunityHubScreen` and pass them into `GroupsScreen`.

The flow should be:

1. Show real group cards.
2. User taps a group.
3. Open `GroupDetailScreen`.
4. Highlight the join action if a join action exists.
5. After join succeeds, call `api.updateMe({ onboarding_first_group_id: group.id })`, call `refreshUser`, and keep the user on the group detail screen.
6. Show success copy in the guided banner: `You're in this group`.

If the group requires approval instead of instant join, the milestone still counts after the join request is created. The banner should say `Request sent` instead of `You're in`.

Acceptance: after the group action, the user is looking at the group detail and sees joined or request-sent state before moving on.

### Milestone 6: Conditional guided meetup RSVP

Before adding the meetup step to the sequence, check whether there is at least one suitable meetup. Suitable means: public/published, not already attending, not cancelled, and returned by the current meetups API for the user's location/filter context. If the API returns no items, skip the meetup step without showing an error.

Use `CommunityHubScreen` with `activeSurface='meetups'`. The flow should be:

1. Show real meetup cards from `MeetupsScreen`.
2. User taps a meetup.
3. Open `MeetupDetailScreen`.
4. Highlight the primary RSVP button.
5. After `api.rsvpMeetup` succeeds, call `api.updateMe({ onboarding_first_meetup_id: meetup.id })`, call `refreshUser`, and keep the user on the meetup detail screen.
6. Show success copy in the guided banner: `You're going` or `You're on the waitlist` depending on API result.

Update `MeetupDetailScreen` to accept an optional callback:

    onRsvpComplete?: (meetup: api.Meetup, result: api.MeetupRsvpResult) => void

Call this callback after the local RSVP state updates successfully. Do not duplicate RSVP logic in the guided wrapper if the detail screen already owns it.

Acceptance: if meetups exist, the user can RSVP from the real meetup detail screen and the milestone saves. If no meetups exist, the step does not appear and the next guided step loads.

### Milestone 7: Guided first post in real composer and feed

Use the real post composer. Update `src/screens/main/CreatePostScreen.tsx` so it accepts:

    onPostCreated?: (post: { id: string }) => void

The mutation currently returns whatever `useCreatePostMutation` returns. Ensure the created post ID is available and pass it to `onPostCreated`. If the hook only invalidates queries and does not expose the ID, adjust the hook or call `api.createPost` directly inside the composer submit flow while preserving existing behavior.

After the first post is created:

1. Call `api.updateMe({ onboarding_first_post_id: post.id })`.
2. Call `refreshUser`.
3. Return to `FeedScreen`.
4. Highlight or pin the created post visually if it appears in the feed.
5. If the backend owner welcome reply exists later, show copy in the banner: `Your first reply is waiting`. Until that backend endpoint exists, say `Your first post is live`.

Add a `focusRequest` to `FeedScreen` if the existing focus mechanism can focus the new post. `FeedScreen` already accepts `focusRequest` for post/comment notification focus, so reuse that mechanism instead of inventing a second one.

Acceptance: after posting, the user lands on the real feed, sees their post or a clear newly-created-post success state, and can continue.

### Milestone 8: Conditional guided dating like

Only include this step when `user.connection_intents` includes `dating`.

Use the existing Dating tab in `DiscoverScreen`. In guided dating mode:

1. Force `activeTab='dating'`.
2. Hide or disable unrelated controls except the dating card and like/pass buttons.
3. Let the user send one real like using `api.recordDatingAction(profile.id, 'like')`.
4. After success, call `api.updateMe({ onboarding_first_dating_like_user_id: profile.id })`, call `refreshUser`, and keep the user on the dating surface with success copy.

If there are no dating candidates, do not block onboarding indefinitely. Show a guided empty state that says no dating profiles are available right now and provide a `Continue` action. Do not save `onboarding_first_dating_like_user_id` when no like was sent. The paywall summary should omit the dating-like item if it was not completed.

Acceptance: a dating-opted user sees a dating step and can send one real like when candidates exist. A non-dating user never sees the step.

### Milestone 9: Paywall activity summary

Update `src/components/PlusUpsellScreen.tsx` to accept an optional `activitySummary` prop:

    interface PlusActivitySummaryItem {
      key: string;
      label: string;
      completed: boolean;
    }

    activitySummary?: PlusActivitySummaryItem[]

When passed, change the title and subtitle to:

    Title: Your SoberSpace is ready
    Subtitle: Subscribe to view your activity, keep connecting, and continue using the community.

Show summary rows for completed/applicable items:

- Profile created
- ID verification ready
- Friend request sent
- Group joined or requested
- Meetup RSVP saved, only if completed
- First post created
- First like sent, only if completed

Keep the four plan prices exactly as currently planned:

- One Year: €119.88 / year, €9.99 / month, Best value
- Six Months: €65.94 / 6 months, €10.99 / month, Popular
- Three Months: €35.97 / 3 months, €11.99 / month
- One Month: €12.99 / month

The checkout button can remain a placeholder until the subscription provider is implemented, but it must not allow entry into the main app. Use clear copy that checkout is not connected in development.

Acceptance: after guided actions, paywall lists the user's real completed milestones and there is no free dismiss path.

## Concrete Steps

Use two terminals or move between repositories carefully. Do not edit historical migration files that have already been applied, because the backend migration runner checks checksums and will reject modified applied migrations.

Start from the app repo:

    cd /home/michaelroddy/repos/project_radeon_app
    git status --short --branch

If not already on a feature branch, create one:

    git checkout -b feature/guided-restricted-onboarding

For backend work:

    cd /home/michaelroddy/repos/project_radeon
    git status --short --branch
    git checkout -b feature/guided-restricted-onboarding

After backend edits:

    cd /home/michaelroddy/repos/project_radeon
    gofmt -w internal/user/handler.go internal/user/store.go internal/user/cache_store.go internal/user/handler_test.go internal/user/cache_store_test.go
    GOCACHE=/tmp/project_radeon_go_cache go test ./...
    make migrate
    make migrate-status | tail -12

After app edits:

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck

Before committing:

    cd /home/michaelroddy/repos/project_radeon
    git diff --check
    git status --short --branch

    cd /home/michaelroddy/repos/project_radeon_app
    git diff --check
    git status --short --branch

## Validation and Acceptance

Backend acceptance:

- `GOCACHE=/tmp/project_radeon_go_cache go test ./...` exits 0.
- `make migrate` applies the new `080` migration without checksum errors.
- `make migrate-status | tail -12` shows `080_onboarding_guided_action_milestones.sql` as `applied`.
- A GET `/users/me` response includes `onboarding_first_meetup_id` and `onboarding_first_dating_like_user_id` as null or string values.

App static validation:

- `npm run typecheck` exits 0.

Manual app acceptance for a non-dating user:

1. Register a new user and do not opt into Dating during connection intent setup.
2. Complete profile setup and the ID verification placeholder.
3. Enter guided app mode.
4. Send a first friend request from a real Discover/profile surface.
5. Join or request a real group from the group detail surface.
6. If a meetup exists, RSVP from real meetup detail; if none exists, verify the step is skipped cleanly.
7. Create a first post from the real composer and see it represented in the feed.
8. Confirm the dating-like step never appears.
9. Confirm the paywall lists the completed activity and blocks entry into the main app.

Manual app acceptance for a dating user:

1. Register a new user and opt into Dating.
2. Complete the same guided steps.
3. Confirm the dating-like step appears after first post or after meetup if meetup exists.
4. Send one like if candidates exist, or see the no-candidates fallback and continue.
5. Confirm the paywall includes `First like sent` only when a like was actually sent.

Restriction acceptance:

- During guided friend step, tapping unrelated tabs or create actions should show `Finish this step` style feedback and not navigate away.
- During guided group step, unrelated surfaces are disabled.
- During guided post step, the user can use the composer but cannot open unrelated main app areas.
- The user can go back within the guide where appropriate, but cannot bypass the paywall into the full app.

## Idempotence and Recovery

All milestone updates must be idempotent. Calling `api.updateMe` with the same onboarding milestone ID twice should leave the same stored value and should not create duplicate friend requests, duplicate group memberships, duplicate RSVPs, or duplicate dating actions beyond what the underlying API already permits.

Do not edit already-applied migration files. Add new migration files only. If `make migrate` reports an older migration as `modified`, stop and restore that historical migration before retrying.

If a guided action succeeds but the milestone save fails, the user should be able to retry. On retry, the UI should detect existing friendship/group/RSVP/post/dating state where possible and allow saving the milestone without repeating destructive work.

If meetup or dating data is unavailable, the guide must not dead-end. Meetup can be skipped when no suitable events exist. Dating can show a no-candidates fallback when the user opted into dating but no profiles are available.

## Artifacts and Notes

At the time this plan was written, app status showed an uncommitted ID verification placeholder branch:

    ## feature/onboarding-id-verification-placeholder
     M src/navigation/OnboardingNavigator.tsx
    ?? src/screens/onboarding/IdentityVerificationStep.tsx

That placeholder is intentionally separate from the real provider integration. It should stay visible in onboarding until a real verification provider is implemented.

Relevant existing API functions in `src/api/client.ts` include:

    discoverUsers(params)
    sendFriendRequest(id)
    listGroups(params)
    joinGroup(id, message?)
    getMeetups(params)
    rsvpMeetup(id)
    createPost(data)
    recordDatingAction(targetUserId, 'like')
    updateMe(data)

## Interfaces and Dependencies

No new third-party app dependencies are required for the guided app mode. Use existing React Native, React Query, and project UI primitives.

The app should introduce these internal interfaces:

    export type GuidedOnboardingStep =
      | 'friend'
      | 'group'
      | 'meetup'
      | 'post'
      | 'dating_like'
      | 'paywall';

    export interface GuidedOnboardingBannerProps {
      title: string;
      description: string;
      progressLabel: string;
      onBack?: () => void;
    }

    export interface PlusActivitySummaryItem {
      key: string;
      label: string;
      completed: boolean;
    }

Backend `UpdateOnboardingMilestones` should end with a signature equivalent to:

    UpdateOnboardingMilestones(
        ctx context.Context,
        userID uuid.UUID,
        firstFriendUserID *uuid.UUID,
        firstGroupID *uuid.UUID,
        firstPostID *uuid.UUID,
        firstMeetupID *uuid.UUID,
        firstDatingLikeUserID *uuid.UUID,
    ) error

The exact function can use a struct input instead if that better matches local style, but all five milestone IDs must be supported and null inputs must not erase existing values.

Revision note, 2026-05-20: Created this ExecPlan after deciding that onboarding should become a guided restricted app experience rather than standalone first-action screens. The plan includes conditional meetup RSVP and conditional dating-like actions as requested.
