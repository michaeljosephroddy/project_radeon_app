# Build Interactive Verified Onboarding

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `PLANS.md` in the repository root. If the implementation changes direction, update this file first so a future contributor can resume from only this plan and the current working tree.

## Purpose / Big Picture

SoberSpace onboarding currently collects profile details but does not let the user move backward, does not persist onboarding completion on the server, and does not prove value before the Plus upsell. After this change, a new user can complete a guided, interactive first session: build a complete profile, verify they are human through identity verification, send a first friend request, join or request a group, and publish a first post that receives an automatic owner welcome reply. The Plus upsell appears after those value moments, so the user has already experienced a real community loop before being asked to upgrade.

A human can see the finished behavior by registering a new account, moving forward and backward through onboarding, being blocked from continuing when a required field is empty, completing identity verification, sending a friend request, joining a group, creating a first post, seeing the owner welcome reply appear on that post, seeing the Plus screen, and then entering the app. If the app is killed mid-onboarding, signing back in resumes onboarding because completion is stored on the backend, not only in local React state.

## Progress

- [x] (2026-05-20T22:54Z) Read `PLANS.md` and existing onboarding, interests, friends, groups, feed, and auth code before authoring this ExecPlan.
- [x] (2026-05-20T22:54Z) Researched Stripe Identity's official Verification Session and React Native integration shape for the identity verification milestone.
- [x] (2026-05-20T22:54Z) Created this ExecPlan in `exec_plans/INTERACTIVE_VERIFIED_ONBOARDING_EXECPLAN.md`.
- [ ] Confirm the identity verification provider and account readiness. This plan assumes Stripe Identity unless the product owner chooses a different provider before implementation.
- [ ] Implement backend migrations for onboarding completion, verification state, first-action tracking, and generic profile interests.
- [ ] Implement backend identity verification session, status, and webhook endpoints.
- [ ] Implement backend onboarding first-post endpoint with idempotent owner auto-reply.
- [ ] Add backend guards so unverified users cannot perform community actions outside the onboarding path.
- [ ] Update the app API client and auth state to use server-backed onboarding and verification status.
- [ ] Refactor onboarding navigation into a typed step list with shared frame, back navigation, required validation, and persisted progress.
- [ ] Add interactive onboarding steps for identity verification, first friend request, first group join, and first post.
- [ ] Move the Plus upsell after the interactive value steps.
- [ ] Run backend tests, app typecheck, and manual end-to-end onboarding QA.

## Surprises & Discoveries

- Observation: Onboarding completion is currently local-only and can be skipped accidentally after an app restart.
    Evidence: `src/hooks/useAuth.tsx` stores `isNewUser` only in React state. `register()` sets it to true, but session restoration calls `api.getMe()` and does not restore onboarding state. `App.tsx` only shows `OnboardingNavigator` while `isNewUser` is true.

- Observation: The app already has the core operations needed for interactive onboarding, but they are only exposed in main app surfaces today.
    Evidence: `src/api/client.ts` already exposes `discoverUsers`, `sendFriendRequest`, `listGroups`, `joinGroup`, `createPost`, and `addFeedItemComment`. The onboarding work should reuse these patterns instead of inventing direct `fetch` calls.

- Observation: New users are already auto-joined to system groups by the backend at registration.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/auth/store.go` inserts active `group_memberships` for all `groups` where `is_system = TRUE` when a user is created. The first group step should still present a choice of a real public group so the onboarding interaction feels intentional, not silently completed.

- Observation: Interests are backend-driven, not hardcoded only in the app.
    Evidence: `src/screens/onboarding/InterestsStep.tsx` calls `useInterests(true)`, which calls `api.getInterests()`, which requests `/interests`. The backend returns `SELECT name FROM interests ORDER BY name ASC` in `/home/michaelroddy/repos/project_radeon/internal/user/store.go`.

- Observation: Stripe Identity supports the shape needed for this app: create a server-side verification session, present a React Native verification sheet with a `client_secret`, and update local status from provider events or backend polling.
    Evidence: Stripe's official docs describe Verification Sessions with statuses such as `requires_input`, `processing`, `verified`, and `canceled`; the React Native guide uses `@stripe/stripe-identity-react-native` to present the verification sheet from the app.

## Decision Log

- Decision: Make onboarding completion server-backed with `users.onboarding_completed_at`.
    Rationale: Local-only `isNewUser` is not reliable. Onboarding is now a compliance and trust gate because identity verification happens there, so it must survive logout, app restart, and token restore.
    Date/Author: 2026-05-20 / Codex

- Decision: Keep onboarding mandatory for new users and mark existing users complete during migration.
    Rationale: New users should complete the trust and first-value flow before accessing community actions. Existing users should not be unexpectedly forced through a new onboarding flow on upgrade.
    Date/Author: 2026-05-20 / Codex

- Decision: Use Stripe Identity as the first planned provider, behind a narrow backend abstraction.
    Rationale: Stripe Identity provides document/selfie verification and a React Native verification sheet, so SoberSpace does not have to store government ID documents or build liveness checks. The backend abstraction keeps the app and database from being tightly coupled to one provider if the provider changes later.
    Date/Author: 2026-05-20 / Codex

- Decision: Require verification before friend, group, post, comment, dating, and support interaction APIs.
    Rationale: The stated goal is to reduce bots and fake accounts. Verification is only useful if unverified users cannot interact with real people outside the guided onboarding path.
    Date/Author: 2026-05-20 / Codex

- Decision: Put identity verification after profile basics and before community actions.
    Rationale: The user should understand what SoberSpace is and provide basic profile data before being asked for identity verification, but they should not be able to contact people, join groups, post, comment, use dating, or offer support before verification succeeds.
    Date/Author: 2026-05-20 / Codex

- Decision: Use a backend onboarding first-post endpoint for the owner welcome reply instead of having the app create a comment as the owner.
    Rationale: The app cannot safely impersonate the owner. The backend can create the post as the user, create exactly one owner reply, and keep the operation idempotent across retries.
    Date/Author: 2026-05-20 / Codex

- Decision: Keep the first friend action as sending a request, not forcing an accepted friendship.
    Rationale: A pending request is honest and respects the other user. It still gives the new user a meaningful first connection action.
    Date/Author: 2026-05-20 / Codex

## Outcomes & Retrospective

This plan has not been implemented yet. It is intentionally broad because the requested onboarding changes touch auth, backend schema, identity provider integration, API permissions, app onboarding UI, and product copy. The highest-risk area is identity verification because it depends on provider account setup, webhook correctness, and production policy decisions. The plan isolates that risk into an early milestone before adding the first-friend, first-group, and first-post steps.

## Context and Orientation

There are two repositories involved. The React Native Expo app lives at `/home/michaelroddy/repos/project_radeon_app`. The Go backend API lives at `/home/michaelroddy/repos/project_radeon`. The app uses `src/api/client.ts` for all network calls, `src/hooks/useAuth.tsx` for auth state, and `src/navigation/OnboardingNavigator.tsx` for the current onboarding flow. The backend stores users, posts, comments, groups, and friendships in Postgres and exposes HTTP handlers under `internal/`.

Onboarding means the sequence of screens a newly registered user sees before they enter the main app. Today it is driven by local state in `src/hooks/useAuth.tsx`: `register()` sets `isNewUser` to true, `completeOnboarding()` sets it false, and `App.tsx` shows `OnboardingNavigator` only while `isNewUser` is true. This is not enough for a required onboarding flow because it is not persisted on the server.

Identity verification means checking that a real human controls the account. This plan does not ask SoberSpace to collect or store ID documents directly. Instead, the backend creates a verification session with a provider such as Stripe Identity, the app opens that provider's verification UI, and the provider sends a webhook back to the backend when the user is verified, failed, or needs to retry. A webhook is an HTTP request sent by the provider to the backend when something changes.

The planned provider is Stripe Identity. Stripe's key object is a Verification Session. It has a server-created ID, a client secret used by the app to open the verification sheet, and statuses such as `requires_input`, `processing`, `verified`, and `canceled`. The app should not receive the Stripe secret API key. Only the backend uses provider secret credentials.

Community action means an action that can affect other people: sending friend requests, joining groups, creating posts or comments, dating actions, support requests, support offers, and direct messages. This plan requires verification before those actions, except for the specific onboarding endpoints that are designed to complete first friend, group, and post actions after verification.

The current profile interest catalog is stored in the backend `interests` table. `migrations/020_profile_bio_interests.sql` and `migrations/001_bootstrap.sql` seeded older values such as `Art`, `Books`, `Coffee`, `Gaming`, `Gym`, `Hiking`, `Journaling`, `Live Music`, and `Nature Walks`. The app reads this list from `/interests`, so updating the backend catalog updates onboarding, profile editing, discover filters, and dating filters.

Important current app files:

- `App.tsx` chooses `AuthNavigator`, `OnboardingNavigator`, or `AppNavigator`.
- `src/hooks/useAuth.tsx` owns `user`, `isAuthenticated`, `isNewUser`, `login`, `register`, `refreshUser`, and `completeOnboarding`.
- `src/navigation/OnboardingNavigator.tsx` switches over numeric steps and currently has no back navigation.
- `src/screens/onboarding/*.tsx` contains existing screens: Welcome, Photo, Identity, Sobriety, Location, Interests, Intent, Plus, and Ready.
- `src/api/client.ts` defines the `User` type, auth calls, profile update calls, discover users, friends, groups, posts, and comments.
- `src/hooks/queries/useGroups.ts`, `src/hooks/queries/useFriends.ts`, and `src/hooks/queries/useCreatePostMutation.ts` show existing React Query patterns for related data.

Important current backend files:

- `/home/michaelroddy/repos/project_radeon/schema/base.sql` is the canonical schema snapshot.
- `/home/michaelroddy/repos/project_radeon/migrations/` contains numbered migrations. The latest migration at planning time is `077_simplify_meetup_categories.sql`; new migrations should start at `078`.
- `/home/michaelroddy/repos/project_radeon/internal/auth/store.go` creates users and currently auto-joins system groups.
- `/home/michaelroddy/repos/project_radeon/internal/user/handler.go` and `internal/user/store.go` handle `/users/me`, `/users/me/location`, `/interests`, and profile updates.
- `/home/michaelroddy/repos/project_radeon/internal/friends/handler.go` handles friend request endpoints.
- `/home/michaelroddy/repos/project_radeon/internal/groups/handler.go` and `internal/groups/store.go` handle groups, group joins, group posts, and group comments.
- `/home/michaelroddy/repos/project_radeon/internal/feed/handler.go` and `internal/feed/store.go` handle feed posts and comments.

## Plan of Work

### Milestone 1: Persist onboarding and verification state on the backend

This milestone makes onboarding a real server-tracked lifecycle instead of local-only app state. At the end, `/users/me` tells the app whether the user has completed onboarding and whether identity verification is complete.

In `/home/michaelroddy/repos/project_radeon/migrations/078_onboarding_state_and_identity_verification.sql`, add these fields to `users`:

    onboarding_completed_at TIMESTAMPTZ NULL
    identity_verification_status TEXT NOT NULL DEFAULT 'not_started'
    identity_verification_provider TEXT NULL
    identity_verification_session_id TEXT NULL
    identity_verification_last_error TEXT NULL
    identity_verified_at TIMESTAMPTZ NULL
    onboarding_first_friend_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL
    onboarding_first_group_id UUID NULL REFERENCES groups(id) ON DELETE SET NULL
    onboarding_first_post_id UUID NULL REFERENCES posts(id) ON DELETE SET NULL
    onboarding_owner_welcome_comment_id UUID NULL REFERENCES comments(id) ON DELETE SET NULL

Add a check constraint so `identity_verification_status` can only be `not_started`, `requires_input`, `pending`, `verified`, `failed`, or `requires_retry`. Backfill `onboarding_completed_at = COALESCE(onboarding_completed_at, created_at)` for existing users. This backfill should run before the app starts reading the field, so existing accounts do not get forced into onboarding.

Update `/home/michaelroddy/repos/project_radeon/schema/base.sql` with the same columns and constraint so fresh databases match migrated databases. Update any user scan structs in backend code so `GET /users/me` returns:

    onboarding_completed_at?: string | null
    identity_verification_status: string
    identity_verified_at?: string | null
    onboarding_first_friend_user_id?: string | null
    onboarding_first_group_id?: string | null
    onboarding_first_post_id?: string | null

In the app, update `src/api/client.ts` `User` with these fields. Update `src/hooks/useAuth.tsx` so `isNewUser` is derived from `user?.onboarding_completed_at == null`, not only from local registration state. Keep a small local override during registration if needed, but token restore must route incomplete users to onboarding.

Add a backend endpoint `POST /onboarding/complete`. It should require authentication, require `identity_verification_status = 'verified'`, require first friend, first group, and first post columns to be non-null, set `onboarding_completed_at = NOW()` if it is null, and return the updated user or a compact status response. Existing users with `onboarding_completed_at` already set should receive HTTP 200 and no destructive changes.

### Milestone 2: Update the generic interest catalog

This milestone gives the user a cleaner, more generic profile-interest list like the simplified meetup categories. At the end, onboarding and profile editing show a smaller set of broad interests that work for most users and do not feel overly niche.

Create `/home/michaelroddy/repos/project_radeon/migrations/079_generic_profile_interests.sql`. Use a temporary mapping table or common table expression to map old names into new names. The target catalog should be:

    Coffee
    Fitness
    Outdoors
    Reading
    Music
    Movies & TV
    Cooking
    Gaming
    Art & Creativity
    Mindfulness
    Meetings
    Volunteering
    Family
    Sports
    Travel
    Pets

Recommended old-to-new mappings:

    Books -> Reading
    Gym -> Fitness
    Running -> Fitness
    Yoga -> Fitness
    Hiking -> Outdoors
    Nature Walks -> Outdoors
    Live Music -> Music
    Movies -> Movies & TV
    Film -> Movies & TV
    Art -> Art & Creativity
    Photography -> Art & Creativity
    Journaling -> Mindfulness
    Meditation -> Mindfulness
    Mindfulness -> Mindfulness
    Meetups -> Meetings
    Cycling -> Fitness

The migration should insert the new names first, copy `user_interests` from old interest IDs to mapped new interest IDs with `ON CONFLICT DO NOTHING`, and then delete old interest rows that are not in the final target catalog. This preserves user selections as much as possible while removing clutter. Update `schema/base.sql`, `migrations/020_profile_bio_interests.sql` if it is used for local bootstrap, and seed scripts that choose interests so fresh dev data uses the new catalog.

Update `src/screens/onboarding/InterestsStep.tsx` to require at least 3 and at most 5 selected interests before Continue. The selected count should say `3-5 selected` or `2 more required` when incomplete. It should not allow Continue with zero selections.

### Milestone 3: Add provider-backed identity verification

This milestone prevents bots from reaching community actions. At the end, a new user must pass identity verification during onboarding before they can send friend requests, join groups, post, comment, use dating, or offer support.

Use Stripe Identity as the initial provider unless the product owner chooses another provider before implementation. Add provider configuration to the backend using environment variables:

    IDENTITY_PROVIDER=stripe
    STRIPE_SECRET_KEY=...
    STRIPE_IDENTITY_WEBHOOK_SECRET=...
    IDENTITY_VERIFICATION_REQUIRED=true
    IDENTITY_VERIFICATION_DEV_BYPASS=false

`IDENTITY_VERIFICATION_DEV_BYPASS` may be true only for local development and automated tests. Production should require real provider verification.

Add a new backend package such as `/home/michaelroddy/repos/project_radeon/internal/identity`. It should expose a store and handler. The handler endpoints should be:

    POST /identity/verification-session
    GET /identity/verification-status
    POST /webhooks/identity/stripe

`POST /identity/verification-session` requires authentication. It should create or reuse a provider Verification Session for the current user. For Stripe, create a Verification Session with type `document`, `client_reference_id` set to the internal user ID, and metadata containing the internal user ID. It should store the provider session ID on `users.identity_verification_session_id`, set status to `requires_input` or `pending` based on the provider response, and return:

    {
      "provider": "stripe",
      "session_id": "...",
      "client_secret": "...",
      "status": "requires_input"
    }

The app uses `client_secret` with `@stripe/stripe-identity-react-native` to present the verification sheet. Do not return the Stripe secret API key to the app.

`GET /identity/verification-status` returns the current stored user verification status. If the current status is `requires_input` or `pending` and a provider session exists, the backend may retrieve the provider session to refresh the stored status before responding.

`POST /webhooks/identity/stripe` must verify the Stripe webhook signature with `STRIPE_IDENTITY_WEBHOOK_SECRET`. It should handle relevant verification session events and update the matching user by `client_reference_id` or metadata. Map provider statuses like this:

    verified -> verified and set identity_verified_at
    processing -> pending
    requires_input -> requires_retry or requires_input depending on whether the user has already attempted submission
    canceled -> failed

Do not store ID document images or sensitive extracted identity fields in the SoberSpace database. Store only provider IDs, status, error reason, and timestamps.

In the app, add a new onboarding step `src/screens/onboarding/VerificationStep.tsx`. It should say:

    Verify once so SoberSpace stays human and safer for people in recovery.
    Your ID details are handled by our verification partner. We do not show your legal name on your profile.

The primary button says `Verify identity`. When tapped, it calls `api.createIdentityVerificationSession()`, launches the Stripe Identity verification sheet, and then calls `api.getIdentityVerificationStatus()` or `refreshUser()` until the status is `verified`, `requires_retry`, or `failed`. Continue remains disabled until `verified`.

Add app API functions in `src/api/client.ts`:

    export type IdentityVerificationStatus = 'not_started' | 'requires_input' | 'pending' | 'verified' | 'failed' | 'requires_retry';
    export async function createIdentityVerificationSession(): Promise<IdentityVerificationSessionResponse>
    export async function getIdentityVerificationStatus(): Promise<IdentityVerificationStatusResponse>

Add `@stripe/stripe-identity-react-native` to the app dependencies only when implementing this milestone. Follow the existing Expo dependency pattern in `package.json`. If Expo requires a config plugin or native rebuild, document it in this ExecPlan during implementation.

### Milestone 4: Enforce verification guards on community APIs

This milestone makes verification meaningful. At the end, unverified accounts cannot interact with real people outside the onboarding verification flow.

Add a backend helper or middleware that checks the current authenticated user's `identity_verification_status`. A middleware is code that runs before a handler and can reject the request early. The helper should return allowed when verification is disabled for local dev or tests, when the user is verified, or when the endpoint is explicitly public/auth/profile/identity/onboarding. It should return HTTP 403 with a clear error such as `identity verification required` otherwise.

Apply this guard to:

- friend request send, accept, decline, cancel, and remove endpoints under `internal/friends`;
- group join, leave, create group, create group post, group comment, group reaction, contact admins, and report endpoints under `internal/groups`;
- feed create post, comments, reactions, shares, hide/mute endpoints under `internal/feed`;
- dating action endpoints under `internal/dating`;
- support request creation, support offers, support chat/session actions under `internal/support`;
- chat message sending and DM compose endpoints under `internal/chats`.

Do not block `GET /users/me`, profile update endpoints used by onboarding, `/interests`, identity verification endpoints, or read-only discovery endpoints needed to populate onboarding choices. If reads are later considered sensitive, that should be a separate product decision.

Add tests for at least one guarded endpoint in each major package or add middleware-level tests plus representative integration tests. The tests should show an unverified user receives HTTP 403 and a verified user can proceed.

### Milestone 5: Refactor onboarding navigation and shared UI

This milestone gives every onboarding step a consistent frame and back navigation. At the end, the user can go back to previous screens, each step has consistent dots and footer spacing, and Continue is disabled until the step is complete.

Create `src/components/onboarding/OnboardingFrame.tsx`. It should own:

- `SafeAreaView` with top and bottom edges;
- dark status bar;
- a top row with optional back button on the left and progress dots centered;
- title, subtitle, optional icon, scrollable body, and footer;
- a disabled/loading primary button area when appropriate.

Use `Ionicons` for the back chevron. Keep the screen visual style consistent with the existing onboarding files: dark page background, `Spacing.xl` horizontal padding, and no marketing hero layout.

Refactor `src/navigation/OnboardingNavigator.tsx` to use a typed step list instead of a numeric switch. The step list should include stable keys such as:

    welcome
    photo
    identity
    sobriety
    location
    interests
    verification
    intent
    first_friend
    first_group
    first_post
    plus
    ready

The navigator should expose `next`, `back`, `canGoBack`, `dotIndex`, and `dotTotal` to every step after Welcome. Dots should count only setup/action steps and not include Welcome or Ready. If Plus should show dots, include it at the end; if it feels too sales-like to count it, keep its dots optional but document the decision.

Update existing step props in `src/navigation/OnboardingNavigator.tsx`:

    export interface OnboardingStepProps {
      onNext: () => void;
      onBack: () => void;
      canGoBack: boolean;
      dotIndex: number;
      dotTotal: number;
    }

Remove `onSkip` from required onboarding steps. The product requirement is that users must fill out each screen completely before moving to the next. The only non-required screen should be Plus, where dismissing continues to Ready.

Refactor existing screens one by one to use `OnboardingFrame`: Welcome, Photo, Identity, Sobriety, Location, Interests, Intent, Plus, and Ready. Keep behavior stable first, then tighten validation.

Validation rules:

- Photo: Continue disabled until `user.avatar_url` or a successful local upload exists.
- Identity: Continue disabled until gender and birth date are present.
- Sobriety: Continue disabled until sober date and bio are present. Bio should have a minimum length such as 20 characters and maximum existing limit 160.
- Location: Continue disabled until city and country are present. Auto-detect should still try first; manual fallback must be allowed.
- Interests: Continue disabled until 3 to 5 interests are selected.
- Verification: Continue disabled until `identity_verification_status === 'verified'`.
- Intent: Continue enabled because `friends` is always selected by default, but the user must explicitly tap Continue.

### Milestone 6: Add first friend request step

This milestone turns onboarding from passive setup into a first social action. At the end, a verified user can send a first friend request from onboarding and cannot continue until one request succeeds, unless the backend returns no candidate users.

Create `src/screens/onboarding/FirstFriendStep.tsx`. It should use `api.discoverUsers({ limit: 10 })` or a new small helper hook to load suggested users. Prefer users with shared interests and location when available; the existing backend discover ranker already uses those fields. The screen should show compact rows or cards with avatar, username, city/country, and a small line such as `Shared interests` when known. Each card has an `Add friend` button.

When the user taps `Add friend`, call `api.sendFriendRequest(user.id)`. On success, call a new backend endpoint `POST /onboarding/first-friend` or `PATCH /onboarding/progress` to set `users.onboarding_first_friend_user_id` if it is null. The endpoint should verify that the friendship exists as pending or accepted between the current user and the target user before storing it. This prevents the app from marking the step complete without a real request.

If no candidates are returned, show an empty state explaining that the user can continue and find people later. In that empty-data case only, allow Continue and store a progress value that records the step as skipped due to no candidates. If the backend should distinguish this from a real friend action, add a nullable text field or a separate onboarding events table. If not, keep the first friend column null and allow completion only with an explicit `no_candidates` response from the endpoint.

### Milestone 7: Add first group join step

This milestone gives the user a community space before they enter the main app. At the end, a verified user joins or requests to join one group during onboarding.

Create `src/screens/onboarding/FirstGroupStep.tsx`. It should call `api.listGroups({ limit: 10, group_type: 'standard', visibility: 'public' })` first. If that returns very little, fall back to `api.listGroups({ limit: 10 })`. Show group name, description, member count, and whether it is public/private. Each card has a `Join group` button.

When tapped, call `api.joinGroup(group.id)`. If the result state is `active`, mark the step complete. If the result state is `pending`, mark it complete too because the user did the correct action for a private group. Store the result with `POST /onboarding/first-group` or the shared progress endpoint. The backend should verify that the current user has an active membership or pending join request for that group before storing `users.onboarding_first_group_id`.

Do not count the automatic system group membership as completion unless there are no other groups available. The first group step should feel like a user choice.

### Milestone 8: Add first post step and owner welcome reply

This milestone gives the user an immediate response loop. At the end, a verified user creates a first post during onboarding and the owner account automatically replies once.

Add a backend endpoint:

    POST /onboarding/first-post

Request body:

    {
      "body": "string"
    }

Response body:

    {
      "post_id": "...",
      "welcome_comment_id": "..."
    }

The endpoint should require authentication and verified identity. It should trim and validate the body with the same rules as normal feed post creation. If `users.onboarding_first_post_id` is already set, return the existing IDs instead of creating duplicates. If it is not set, create the feed post as the current user and create one comment on that post as the platform owner.

Configure the owner with an environment variable:

    SOBERSPACE_OWNER_USER_ID=...

At startup or request time, validate this user exists. If the env var is missing in local development, return a clear 500 error for the onboarding first-post endpoint and document that the variable must be configured. Do not silently create a fake owner user in production code.

The welcome reply body should be friendly, short, and recovery-safe. Use copy like:

    Welcome to SoberSpace, glad you are here. This is exactly the kind of first step the community was built for.

Use the existing feed store `CreatePost` and `AddComment` behavior where practical. If the existing store interface makes one transaction difficult, add a focused onboarding store method that creates the post, creates the owner comment, updates the user onboarding fields, and commits once. Idempotency matters more than sharing every line of code.

Create `src/screens/onboarding/FirstPostStep.tsx`. It should be a compact text composer, not the full create-post screen. Provide one or two optional prompt chips such as:

- `Today I am showing up by...`
- `One thing I am working on is...`
- `I am grateful for...`

The user must enter a non-empty body with a reasonable minimum such as 10 characters. On submit, call `api.createOnboardingFirstPost({ body })`, then show a success state with a short preview of the owner reply and enable Continue.

### Milestone 9: Move Plus upsell after value moments and complete onboarding

This milestone positions Plus at the right point in the user journey. At the end, the user sees Plus only after profile setup, verification, first friend request, first group action, and first post.

Keep `src/screens/onboarding/PlusStep.tsx` using `PlusUpsellScreen`, but render it after `first_post`. The primary button continues to the Ready screen. Dismiss should also continue to Ready. Do not let Plus block completion.

Update `src/screens/onboarding/ReadyStep.tsx` so `Enter SoberSpace` calls `api.completeOnboarding()` and then `refreshUser()` or a new `completeOnboarding()` auth method that calls the backend before clearing onboarding UI. It should not just set local `isNewUser` false. The backend should reject completion if required steps are missing, and the app should show the missing step message if that happens.

Update `src/hooks/useAuth.tsx`:

- `completeOnboarding` should call the backend, refresh `user`, and no longer be a local-only setter.
- `isNewUser` should derive from `user?.onboarding_completed_at == null`.
- `register()` should still set the user and route to onboarding because the returned `me` has no `onboarding_completed_at`.

### Milestone 10: Manual QA and polish

This milestone proves the full journey works and the app remains coherent. At the end, onboarding should be shippable for a test build.

Run through these manual flows:

1. Fresh registration with all required fields filled and successful verification.
2. Back navigation from each step to the previous step.
3. Empty/invalid fields on every required step block Continue.
4. App kill/reopen midway through onboarding resumes onboarding.
5. Verification pending state shows a useful message and does not allow community actions.
6. Verification failed/requires retry lets the user retry.
7. First friend request succeeds and marks the step complete.
8. First group join/request succeeds and marks the step complete.
9. First post creates exactly one owner welcome reply, even if the request is retried.
10. Plus appears after first post, can be dismissed, and Ready completes onboarding.
11. After onboarding, the user can enter the main app and use community actions.

## Concrete Steps

Before starting implementation, finish or intentionally carry any unrelated work in the app repository. At authoring time, the app repository is on `fix/dating-likes-bottom-safe-area` with an uncommitted `DatingLikesScreen` safe-area fix. Do not lose that change. Either commit and merge it first, or branch carefully and verify `git status --short` before editing onboarding files.

Recommended setup:

    cd /home/michaelroddy/repos/project_radeon_app
    git status --short --branch
    npm run typecheck

    cd /home/michaelroddy/repos/project_radeon
    git status --short --branch
    GOCACHE=/tmp/project_radeon_go_cache go test ./...

Create feature branches in both repositories:

    cd /home/michaelroddy/repos/project_radeon_app
    git switch main
    git pull
    git switch -c feature/interactive-verified-onboarding

    cd /home/michaelroddy/repos/project_radeon
    git switch main
    git pull
    git switch -c feature/interactive-verified-onboarding

Implement the backend migrations first. After adding migrations, run:

    cd /home/michaelroddy/repos/project_radeon
    go run ./cmd/migrate

If the migration command for this repo expects database environment variables, use the same env vars used by local API development. The migration must be safe to rerun: use `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `ON CONFLICT DO NOTHING` where possible.

After each backend milestone, run focused tests first, then broader tests:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project_radeon_go_cache go test ./internal/user ./internal/auth
    GOCACHE=/tmp/project_radeon_go_cache go test ./internal/identity ./cmd/api
    GOCACHE=/tmp/project_radeon_go_cache go test ./internal/feed ./internal/friends ./internal/groups ./internal/support ./internal/dating ./internal/chats
    GOCACHE=/tmp/project_radeon_go_cache go test ./...

After each app milestone, run:

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck
    git diff --check

For Expo manual QA, start the backend and app with the normal local API URL:

    cd /home/michaelroddy/repos/project_radeon
    go run ./cmd/api

    cd /home/michaelroddy/repos/project_radeon_app
    EXPO_PUBLIC_API_URL=http://192.168.0.75:8080 npx expo start

Adjust `EXPO_PUBLIC_API_URL` to the current machine IP if needed.

## Validation and Acceptance

Automated backend acceptance:

- `go test ./...` passes in `/home/michaelroddy/repos/project_radeon`.
- Migration tests or manual migration runs prove existing users receive `onboarding_completed_at` and are not forced through onboarding.
- Identity endpoint tests prove session creation updates user status, webhook signature validation rejects invalid signatures, verified events set `identity_verification_status = 'verified'`, and failed/retry events do not mark users verified.
- Guard tests prove unverified users receive HTTP 403 for community actions and verified users can proceed.
- First-post tests prove exactly one user post and one owner welcome comment are created, and retries return the existing records instead of duplicating them.

Automated app acceptance:

- `npm run typecheck` passes in `/home/michaelroddy/repos/project_radeon_app`.
- `git diff --check` reports no whitespace errors.
- Existing screens still compile after `User` type changes.

Manual product acceptance:

- Registering a new account shows onboarding.
- Killing and reopening the app during onboarding resumes onboarding.
- Back works from every onboarding step after Welcome.
- Each required step blocks Continue until complete.
- Interests show the new generic catalog and require 3 to 5 selections.
- Identity verification shows clear trust copy and cannot be bypassed in production mode.
- After verification, the user can send a first friend request.
- The user can join or request to join a first group.
- The user can create a first post and see the owner welcome reply.
- Plus appears after those value actions, not before.
- Tapping Enter SoberSpace calls the backend completion endpoint and enters the main app.

## Idempotence and Recovery

Migrations must be safe to rerun. Use `IF NOT EXISTS` for additive schema changes and `ON CONFLICT DO NOTHING` for seed inserts. Interest migration should copy user selections to new interests before deleting old rows, and it should use `ON CONFLICT DO NOTHING` so duplicate mappings do not fail.

Identity verification session creation should reuse an existing unfinished session where possible. If a user retries after `failed` or `requires_retry`, create a new provider session and update the stored session ID. Webhooks may arrive more than once, so webhook handling must be idempotent: setting `verified` twice should not create duplicate side effects.

First friend and first group progress endpoints must verify the real relationship or membership/request exists before setting onboarding fields. Retrying the same request should return success with the existing stored progress.

First post creation must be transactionally idempotent. If `onboarding_first_post_id` is already set, return the existing IDs. If the post exists but the owner comment failed in a previous attempt, retry should create the missing comment and update `onboarding_owner_welcome_comment_id`.

If the identity provider is unavailable, the app should show a retryable error and keep the user on the verification step. Do not mark verification complete on network failure.

## Artifacts and Notes

Relevant existing app snippets:

    src/hooks/useAuth.tsx currently:
        const [isNewUser, setIsNewUser] = useState(false);
        register() sets setIsNewUser(true);
        completeOnboarding() only calls setIsNewUser(false);

    App.tsx currently:
        if (!isAuthenticated) return <AuthNavigator />;
        if (isNewUser) return <OnboardingNavigator />;
        return <AppNavigator />;

This is why server-backed onboarding completion is a required early milestone.

Relevant existing backend registration behavior:

    internal/auth/store.go inserts every new user into active system groups:
        INSERT INTO group_memberships (group_id, user_id, role, status, joined_at)
        SELECT g.id, $1, 'member', 'active', NOW()
        FROM groups g
        WHERE g.is_system = TRUE

This is useful but should not replace the user's intentional first group choice.

Stripe Identity implementation notes embedded for implementers:

- The backend creates a provider Verification Session.
- The provider session has a `client_secret` that the React Native app can use to show the verification sheet.
- The app never receives the provider secret key.
- Provider webhooks must be signature-verified before updating SoberSpace users.
- Store only provider IDs, status, error, and timestamps in SoberSpace. Do not store ID document images or extracted sensitive fields.

## Interfaces and Dependencies

Backend user JSON must expose these new fields through `/users/me` and any shared user model that powers the app `User` type:

    onboarding_completed_at?: string | null
    identity_verification_status: 'not_started' | 'requires_input' | 'pending' | 'verified' | 'failed' | 'requires_retry'
    identity_verified_at?: string | null
    onboarding_first_friend_user_id?: string | null
    onboarding_first_group_id?: string | null
    onboarding_first_post_id?: string | null

Backend endpoints to add:

    POST /identity/verification-session
    GET /identity/verification-status
    POST /webhooks/identity/stripe
    POST /onboarding/first-friend
    POST /onboarding/first-group
    POST /onboarding/first-post
    POST /onboarding/complete

App API functions to add in `src/api/client.ts`:

    export type IdentityVerificationStatus =
        | 'not_started'
        | 'requires_input'
        | 'pending'
        | 'verified'
        | 'failed'
        | 'requires_retry';

    export interface IdentityVerificationSessionResponse {
        provider: 'stripe';
        session_id: string;
        client_secret: string;
        status: IdentityVerificationStatus;
    }

    export interface IdentityVerificationStatusResponse {
        status: IdentityVerificationStatus;
        last_error?: string | null;
        verified_at?: string | null;
    }

    export async function createIdentityVerificationSession(): Promise<IdentityVerificationSessionResponse>;
    export async function getIdentityVerificationStatus(): Promise<IdentityVerificationStatusResponse>;
    export async function recordOnboardingFirstFriend(userId: string): Promise<User>;
    export async function recordOnboardingFirstGroup(groupId: string): Promise<User>;
    export async function createOnboardingFirstPost(input: { body: string }): Promise<{ post_id: string; welcome_comment_id: string }>;
    export async function completeOnboarding(): Promise<User>;

New app screens to add:

    src/screens/onboarding/VerificationStep.tsx
    src/screens/onboarding/FirstFriendStep.tsx
    src/screens/onboarding/FirstGroupStep.tsx
    src/screens/onboarding/FirstPostStep.tsx

New shared app component:

    src/components/onboarding/OnboardingFrame.tsx

Provider dependency to add during the identity milestone:

    @stripe/stripe-identity-react-native

Use this dependency only from `VerificationStep.tsx` or a small wrapper hook such as `src/hooks/useIdentityVerificationSheet.ts`. Keeping provider calls in one place makes it easier to switch providers later.

## Revision Notes

- 2026-05-20T22:54Z: Initial ExecPlan created. It incorporates the requested back navigation, complete required steps, generic interests, first friend, first group, first post, owner auto-reply, Plus repositioning, and mandatory identity verification during onboarding.
