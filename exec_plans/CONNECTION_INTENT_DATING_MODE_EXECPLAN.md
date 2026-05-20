# Add connection intent onboarding and Dating mode discovery

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

SoberSpace is a recovery-first social app, and users should be able to say why they are here when they join. After this change, a new user can choose whether they are here for friendship only or also open to dating during onboarding. They can later change Dating mode from Settings, and the People discovery screen will expose a Dating browsing mode only for users who have opted in. Dating discovery will only show people who also opted into Dating.

This plan intentionally borrows the useful parts of dating-app discovery settings without making SoberSpace feel like a dating app first. In plain terms, a "mode" means the current context for browsing people. Friends mode is the default recovery/community people discovery. Dating mode is opt-in and filters people discovery to others whose profile says they are also open to dating. Turning Dating off removes the user from Dating discovery, but it must not delete existing friends, chats, or profile content.

## Progress

- [x] (2026-05-20T10:45Z) Reviewed `PLANS.md`, current onboarding intent code, profile settings code, Discover filtering code, and backend connection-intent parsing before authoring this ExecPlan.
- [x] (2026-05-20T10:45Z) Created this ExecPlan in `exec_plans/CONNECTION_INTENT_DATING_MODE_EXECPLAN.md`.
- [x] (2026-05-20T10:52Z) Implemented onboarding copy and option helper text in `src/screens/onboarding/IntentStep.tsx`.
- [x] (2026-05-20T10:52Z) Added the Dating mode toggle to `src/screens/main/SettingsScreen.tsx`.
- [x] (2026-05-20T10:52Z) Added Friends/Dating people discovery mode behavior in `src/screens/main/DiscoverScreen.tsx`.
- [x] (2026-05-20T10:55Z) Aligned labels and helper functions in `src/utils/connectionIntents.ts`, `src/hooks/useDiscoverFilters.ts`, and the Discover filter sheet.
- [x] (2026-05-20T10:52Z) Ran TypeScript validation and targeted/full backend validation.
- [x] (2026-05-20T11:04Z) Refactored Discover from nested People plus Friends/Dating controls to one top-level `Friends | Meetings | Dating` tab set, with Dating shown only when opted in.
- [ ] Manually verify onboarding, Settings, and Discover behavior in an Expo build.

## Surprises & Discoveries

- Observation: The app already has a useful connection-intent foundation and does not need a database migration for the first version of Dating mode.
    Evidence: `src/api/client.ts` defines `ConnectionIntent = 'friends' | 'dating'`, `src/utils/connectionIntents.ts` normalizes to `['friends']` or `['friends', 'dating']`, and `/home/michaelroddy/repos/project_radeon/schema/base.sql` constrains `users.connection_intents` to contain `friends` and optionally `dating`.

- Observation: Settings are already split into `src/screens/main/SettingsScreen.tsx`, so the Dating toggle should be implemented there, not directly in the large profile tab screen.
    Evidence: `src/screens/main/ProfileTabScreen.tsx` imports `SettingsScreen` and returns it when `subView === 'settings'`.

- Observation: Discover currently treats connection intent as an advanced filter field, not as a top-level browsing mode.
    Evidence: `src/components/discover/DiscoverFilterSheet.tsx` has a "Connection intent" section with `Any` and `Open to dating`, while `src/hooks/useDiscoverFilters.ts` serializes `intent=dating` through `toDiscoverApiFilters`.

- Observation: Dating mode must use the filtered/search discover query path so `intent=dating` participates in the React Query cache key.
    Evidence: `src/hooks/queries/useDiscoverResults.ts` keys `intent` for search and filtered modes, while suggested mode keys only location and limit.

- Observation: Backend tests already cover the required contract for this app feature.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/user/handler_test.go` contains `TestUpdateMePersistsConnectionIntents` and `TestDiscoverParsesAdvancedFilters`, including `intent=dating`.

- Observation: The legacy advanced Connection intent filter could otherwise let non-opted-in users browse Dating profiles without selecting Dating mode.
    Evidence: `src/components/discover/DiscoverFilterSheet.tsx` exposed an `Any | Dating` filter independently of the new Settings toggle.

- Observation: Once Dating is a top-level Discover tab, the advanced Connection intent filter becomes redundant and creates two paths into the same browsing context.
    Evidence: `src/screens/main/DiscoverScreen.tsx` now owns Dating selection via `activeTab === 'dating'`, and the Discover filter sheet no longer renders a Connection intent section.

## Decision Log

- Decision: Keep connection intent in onboarding.
    Rationale: SoberSpace is a social app, and asking why the user is here during onboarding helps shape the experience from the beginning. The question must be recovery-first and optional for dating, not dating-led.
    Date/Author: 2026-05-20 / Codex

- Decision: Keep the existing data values `friends` and `dating`.
    Rationale: The backend and app already support this model, and the user rejected awkward alternative names such as "soft dating." The public UI can say "Dating" while helper copy explains that it is opt-in and low-pressure.
    Date/Author: 2026-05-20 / Codex

- Decision: Put the ongoing Dating control in Settings.
    Rationale: This matches the user request and the common pattern where discovery visibility preferences live under Settings. Onboarding is the first opt-in moment; Settings is where the user changes the decision later.
    Date/Author: 2026-05-20 / Codex

- Decision: Do not create separate dating profiles, separate match tables, or destructive mode switching in the first version.
    Rationale: Those features are larger product systems. The existing friendship/chat model should remain stable, and turning Dating off must be a reversible visibility preference.
    Date/Author: 2026-05-20 / Codex

- Decision: Use one top-level Discover tab set: Friends, Meetings, and Dating.
    Rationale: Nested Friends/Dating controls made the screen feel clunky and visually over-specified. Making Dating a sibling of Friends and Meetings gives users one clear navigation model while still hiding Dating unless the user opted in.
    Date/Author: 2026-05-20 / Codex

## Outcomes & Retrospective

Implemented the first version of connection-intent Dating mode in the app. Onboarding now asks "Why are you here?", shows shared Friends/Dating helper copy, and continues to persist `connection_intents` through the existing profile update API. Settings now has a `DISCOVERY & CONNECTIONS` section with a server-backed Dating mode switch. Discover now uses one top-level tab set: Friends, Meetings, and Dating, with Dating visible only for opted-in users. The Dating tab sends `intent=dating` and uses mode-specific headings and empty states. The advanced Connection intent filter was removed from the filter sheet so Dating has one clear entry point, and stale `intent=dating` filter state is cleared defensively.

Validated with `npm run typecheck` in `/home/michaelroddy/repos/project_radeon_app`, `GOCACHE=/tmp/go-build go test ./internal/user`, and `GOCACHE=/tmp/go-build go test ./...` in `/home/michaelroddy/repos/project_radeon`. Also confirmed `rg -n "Open to dating" src` returns no app source matches and `git diff --check` reports no whitespace errors. Remaining gap: manual Expo QA has not yet been completed.

## Context and Orientation

The app repository is `/home/michaelroddy/repos/project_radeon_app`. It is a React Native/Expo frontend. API calls live in `src/api/client.ts`, global auth state lives in `src/hooks/useAuth.tsx`, query keys live in `src/query/queryKeys.ts`, and the main tab shell lives in `src/navigation/AppNavigator.tsx`.

The backend repository is `/home/michaelroddy/repos/project_radeon`. It is a Go API. User profile and discover behavior live under `internal/user`. The backend stores the connection-intent preference on the `users` table as `connection_intents`, a text array. In the current schema, every user must have `friends`, and they may also have `dating`.

Important existing app files:

- `src/screens/onboarding/IntentStep.tsx` is the onboarding step where users currently choose connection intent. It imports `CONNECTION_INTENT_OPTIONS` and `normalizeConnectionIntents` from `src/utils/connectionIntents.ts`, defaults to the current user's stored intents, keeps `friends` selected, and saves with `api.updateMe({ connection_intents: selected })`.
- `src/utils/connectionIntents.ts` defines the two current labels: `Friends` and `Open to dating`. It also normalizes missing or invalid values to `['friends']`.
- `src/screens/main/SettingsScreen.tsx` is the Settings screen opened from the profile tab. It currently has a `FEED` group with "Hidden content" and an `ACCOUNT` group with "Log out".
- `src/screens/main/ProfileTabScreen.tsx` currently has a profile-edit "Connection intent" section. That section edits the same `connection_intents` field and may remain for MVP, but its labels and copy should align with the Settings toggle.
- `src/screens/main/DiscoverScreen.tsx` owns People discovery UI and data fetching. It already passes API filters through `useDiscoverResultsQuery`.
- `src/components/discover/DiscoverFilterSheet.tsx` currently includes a "Connection intent" section inside the advanced filter sheet. That can remain for filtering, but it should not be the only way users understand Dating mode.
- `src/hooks/useDiscoverFilters.ts` defines `DiscoverIntentValue = 'any' | api.ConnectionIntent` and maps intent labels. It currently labels `dating` as "Open to dating".
- `src/hooks/queries/useDiscoverResults.ts` passes `intent` to `api.discoverUsers`.
- `src/api/client.ts` defines `ConnectionIntent`, `User.connection_intents`, `UpdateMeInput.connection_intents`, and the discover API request shape.

Important backend files:

- `/home/michaelroddy/repos/project_radeon/internal/user/handler.go` normalizes profile updates through `normalizeConnectionIntents`. It currently accepts `friends` and `dating`.
- `/home/michaelroddy/repos/project_radeon/internal/user/store.go` persists `connection_intents` in `UpdateUser` and filters discover results using `u.connection_intents @> ARRAY[$intent]`.
- `/home/michaelroddy/repos/project_radeon/internal/user/discover_store.go` also uses connection intent as one candidate source and as part of discover eligibility in the v2 discover pipeline.
- `/home/michaelroddy/repos/project_radeon/schema/base.sql` and migrations `071_user_connection_intents_and_safety.sql` and `072_simplify_connection_intents.sql` document the current connection-intent schema.

Terms used in this plan:

- "Connection intent" means the reason a user is open to connecting with people. In code, this is `connection_intents`.
- "Friends" means regular recovery/community social discovery. In code, this is the required value `friends`.
- "Dating" means opt-in romantic openness. In code, this is the optional value `dating`.
- "Dating mode" means the People discovery screen is filtering to `intent=dating`, so it only shows users who also opted into Dating.

## Plan of Work

### Milestone 1: Make connection intent onboarding clear and recovery-first

This milestone updates the first opt-in moment. At the end, new users still choose why they are here during onboarding, but the text and labels will be clearer: Friends is required and selected by default, Dating is optional, and the copy explains that Dating is opt-in and can be changed later.

Edit `src/utils/connectionIntents.ts`. Keep the values as `friends` and `dating`, but change the dating label from `Open to dating` to `Dating`. Consider expanding `CONNECTION_INTENT_OPTIONS` from only `value` and `label` to also include `description`, because both onboarding and profile/settings UI need consistent helper copy. Use descriptions such as "Meet sober peers, build community, and stay connected." for Friends and "Only people who also choose Dating can see you there." for Dating.

Edit `src/screens/onboarding/IntentStep.tsx`. Change the title to "Why are you here?" and the subtitle to explain that SoberSpace is recovery-first and the user can change this in Settings later. Render each option with both title and helper text if `connectionIntents.ts` now exposes descriptions. Keep the existing rule that `friends` cannot be deselected. Continue saving with `api.updateMe({ connection_intents: selected })`, then `refreshUser()`, then `onNext()`.

Milestone 1 acceptance: run `npm run typecheck` from `/home/michaelroddy/repos/project_radeon_app` and expect it to pass. In the app, a new user should see "Why are you here?", Friends selected by default, Dating optional, and Continue should save the selected array.

### Milestone 2: Add Dating mode control to Settings

This milestone makes Settings the persistent control for Dating visibility. At the end, a signed-in user can open Profile, tap Settings, and turn Dating mode on or off without going through profile edit.

Edit `src/screens/main/SettingsScreen.tsx`. Import `Switch` from `react-native`, `useState` from React if needed, `useAuth` from `../../hooks/useAuth`, `appAlert` from `../../components/ui/appAlert`, and `api` from `../../api/client`. Read `user` and `refreshUser` from `useAuth()`. Derive `datingEnabled` from `user?.connection_intents?.includes('dating')`.

Add a new section above `FEED` named `DISCOVERY & CONNECTIONS`. Inside the existing grouped row style, add a row with copy and a `Switch`:

    Dating mode
    When on, you can see and be seen by people who are also open to dating.

When the user toggles on, call `api.updateMe({ connection_intents: ['friends', 'dating'] })`. When they toggle off, call `api.updateMe({ connection_intents: ['friends'] })`. While saving, disable the switch or show reduced opacity. On success, call `refreshUser()` so `useAuth().user` updates everywhere. On failure, leave UI derived from the old user value and show an alert. Do not persist local optimistic state unless you also handle rollback carefully; a simple saving state plus server-derived value is safer.

Keep the existing Hidden content and Log out rows. Do not remove Plus fields or subscription fields from the user type.

Milestone 2 acceptance: with a logged-in user, toggling Dating mode on should send `connection_intents: ['friends', 'dating']` and then the switch should remain on after `refreshUser()`. Toggling off should send `['friends']` and the switch should turn off. `npm run typecheck` must pass.

### Milestone 3: Add Friends and Dating modes to People discovery

This milestone makes the onboarding/settings choice visible in People discovery. At the end, users who opted into Dating see a `Friends | Dating` mode control, and Dating mode fetches only other Dating-enabled users.

Edit `src/screens/main/DiscoverScreen.tsx`. Reintroduce `useAuth` if it is not currently imported. Read the current user and compute:

    const datingEnabled = user?.connection_intents?.includes('dating') ?? false;
    type PeopleConnectionMode = 'friends' | 'dating';
    const [peopleMode, setPeopleMode] = useState<PeopleConnectionMode>('friends');

When `datingEnabled` becomes false, force `peopleMode` back to `friends` with a `useEffect`. This prevents the screen from staying in a hidden Dating mode after the user turns Dating off in Settings.

In the People tab controls, render a compact `SegmentedControl` with `Friends` and `Dating` only when `datingEnabled` is true. Keep it near the top of People discovery, not in the modal filter sheet, because this is a browsing mode rather than an advanced filter. Use the existing `SegmentedControl` component from `src/components/ui/SegmentedControl.tsx` and match the page style already used for Discover/Meetings tabs where practical.

When building the discover query params, merge the active mode with existing filters. Friends mode should not send an `intent` parameter by default, because Friends is the broad recovery/community discovery context and all users are required to have `friends`. Dating mode should always send `intent: 'dating'`, even when no filter sheet intent is set. Be careful if the filter sheet also has an intent field: the Dating mode should take precedence while active. A simple helper can make this explicit:

    const modeIntent = peopleMode === 'dating' ? 'dating' : undefined;
    const discoverIntent = modeIntent ?? effectiveApiFilters.intent;

Then pass `intent: discoverIntent` to `useDiscoverResultsQuery`. The query key will update because `useDiscoverResults` already includes `intent`.

Update empty state copy in `getNoResultsCopy` or near the render path so Dating mode can say "No Dating profiles nearby yet" and "Dating mode only includes people who also opted in. Try widening your filters or check back later." Keep existing search/filter empty copy for Friends mode.

Do not show a Dating mode CTA to users who have not opted in for the first implementation unless the UI remains quiet and non-disruptive. The user asked for the setting pattern, so hiding Dating mode until enabled is acceptable for MVP.

Milestone 3 acceptance: a user with `connection_intents: ['friends']` sees no Friends/Dating segmented control. A user with `['friends', 'dating']` sees it. Selecting Dating causes the discover request to include `intent=dating`; selecting Friends removes that intent unless the user explicitly applies an advanced intent filter.

### Milestone 4: Align profile display and filter labels

This milestone cleans up copy so the product language is consistent. At the end, the app says "Dating" instead of "Open to dating" wherever connection intent is displayed.

Edit `src/hooks/useDiscoverFilters.ts` so `getDiscoverIntentLabel('dating')` returns `Dating`. Keep `friends` returning `Friends` and `any` returning `null`.

Edit `src/components/discover/DiscoverFilterSheet.tsx`. If the Connection intent filter remains, label the dating option as `Dating` through `getDiscoverIntentLabel`. Consider whether the filter is now redundant with Dating mode. For MVP, it can remain because it also lets users filter search results, but the top-level Dating mode should be the primary path.

Edit `src/screens/main/ProfileTabScreen.tsx` only as needed. The existing profile summary and edit section use `getConnectionIntentLabel`, so updating `connectionIntents.ts` may be enough. If the profile edit section duplicates the Settings toggle too awkwardly, keep it for this release but ensure it uses the same labels and helper copy. Do not remove it unless implementation proves the duplication is confusing in manual QA.

Edit `src/screens/main/UserProfileScreen.tsx` only if copy or spacing needs adjustment after the labels change.

Milestone 4 acceptance: searching the app for `Open to dating` should return no user-visible copy except possibly old docs or comments. Public profile, own profile, onboarding, settings, and discover filters should all use `Dating`.

### Milestone 5: Backend tests and compatibility check

This milestone verifies the backend contract stays compatible. Runtime backend changes should not be necessary unless the current tests reveal a gap.

In `/home/michaelroddy/repos/project_radeon`, inspect `internal/user/handler_test.go` tests around profile update and discover parsing. If there is not already a test proving that `connection_intents: ['friends', 'dating']` updates correctly, add one. If there is not already a discover parsing test proving `intent=dating` reaches `DiscoverUsersParams.Intent`, add or keep one.

Do not change the database schema in this plan. The schema already allows `friends` and `dating`; adding a migration would add risk without changing behavior.

Milestone 5 acceptance: from `/home/michaelroddy/repos/project_radeon`, run:

    GOCACHE=/tmp/go-build go test ./internal/user
    GOCACHE=/tmp/go-build go test ./...

Both commands should exit 0. If shell startup prints unrelated `/home/guest` read-only cleanup warnings, ignore those warnings if the Go test result is still `ok`.

## Concrete Steps

Start from a clean app worktree:

    cd /home/michaelroddy/repos/project_radeon_app
    git status --short --branch

If implementing this plan, create a feature branch before code edits:

    git checkout -b feature/connection-intent-dating-mode

Read the current app files:

    sed -n '1,180p' src/screens/onboarding/IntentStep.tsx
    sed -n '1,220p' src/screens/main/SettingsScreen.tsx
    sed -n '1,120p' src/utils/connectionIntents.ts
    sed -n '220,380p' src/screens/main/DiscoverScreen.tsx
    sed -n '470,525p' src/screens/main/ProfileTabScreen.tsx

Read the backend contract if changing or testing backend behavior:

    cd /home/michaelroddy/repos/project_radeon
    sed -n '430,520p' internal/user/handler.go
    sed -n '576,640p' internal/user/handler.go
    rg -n "connection_intents|intent=dating|DiscoverParsesAdvancedFilters" internal/user

Implement milestones in order. After each milestone, run the relevant validation command and update the `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` sections of this file.

## Validation and Acceptance

Run app validation from `/home/michaelroddy/repos/project_radeon_app`:

    npm run typecheck

Expected result: TypeScript exits with code 0.

Run backend validation from `/home/michaelroddy/repos/project_radeon` if backend tests were touched:

    GOCACHE=/tmp/go-build go test ./internal/user
    GOCACHE=/tmp/go-build go test ./...

Expected result: every package exits with `ok` or `[no test files]`.

Manual validation requires a running backend and Expo app. Use the repository defaults unless `.env` points to another backend:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

Manual acceptance scenarios:

- Fresh onboarding: reach the connection intent step, observe title "Why are you here?", Friends selected and locked, Dating optional, Continue saves and advances.
- Existing user with Dating off: Profile -> Settings shows Dating mode off. Discover -> People does not show a Friends/Dating switch.
- Toggle on: Profile -> Settings -> Dating mode on saves successfully. Returning to Discover -> People now shows Friends and Dating.
- Dating discovery: selecting Dating changes the people query to include `intent=dating` and the list only contains users who opted into Dating.
- Toggle off: Settings -> Dating mode off saves successfully. Returning to Discover hides the Dating switch and uses normal Friends discovery.
- Profile display: own profile and user profiles show `Friends` and `Dating` chips with consistent labels.

If network logging is available, verify requests manually:

- Friends mode request should look like `/users/discover?...` without `intent=dating` unless the user explicitly applies that advanced filter.
- Dating mode request should include `/users/discover?...&intent=dating`.

## Idempotence and Recovery

The app edits are normal TypeScript/React Native changes and can be retried safely. If the Dating toggle save fails, the UI should derive its state from `useAuth().user` after refresh and show an alert rather than leaving stale optimistic state.

No schema migration is planned. This makes rollback simple: revert the app commits and any backend test-only commits. If a backend runtime change becomes necessary, keep it additive and covered by tests before merging.

If Discover mode state behaves oddly after Settings changes, add an effect in `DiscoverScreen` that resets `peopleMode` to `friends` whenever `datingEnabled` is false. This is safe and idempotent.

## Artifacts and Notes

Relevant current code facts collected while writing this plan:

    src/utils/connectionIntents.ts currently labels dating as "Open to dating".
    src/screens/onboarding/IntentStep.tsx already saves api.updateMe({ connection_intents: selected }).
    src/screens/main/SettingsScreen.tsx currently contains FEED and ACCOUNT sections only.
    src/screens/main/DiscoverScreen.tsx currently owns People discovery query wiring.
    src/hooks/queries/useDiscoverResults.ts already passes params.intent to api.discoverUsers.
    /home/michaelroddy/repos/project_radeon/schema/base.sql already constrains connection_intents to friends plus optional dating.

The product wording to use consistently:

    Friends
    Dating
    SoberSpace is recovery-first. Choose how you want to connect. You can change this anytime in Settings.
    Dating mode only shows you to people who also choose Dating.
    When on, you can see and be seen by people who are also open to dating.

## Interfaces and Dependencies

Use the existing API client. Do not add a new endpoint.

In `src/api/client.ts`, keep:

    export type ConnectionIntent = 'friends' | 'dating';
    export interface UpdateMeInput {
        connection_intents?: ConnectionIntent[];
    }

In `src/utils/connectionIntents.ts`, expose stable options that can be reused by onboarding, profile, and settings. A suitable shape is:

    interface ConnectionIntentOption {
        value: ConnectionIntent;
        label: string;
        description: string;
    }

    export const CONNECTION_INTENT_OPTIONS: ConnectionIntentOption[] = [
        { value: 'friends', label: 'Friends', description: 'Meet sober peers, build community, and stay connected.' },
        { value: 'dating', label: 'Dating', description: 'Only people who also choose Dating can see you there.' },
    ];

In `src/screens/main/SettingsScreen.tsx`, use `useAuth()` and `api.updateMe()` directly. This keeps Settings self-contained and avoids threading new props through `ProfileTabScreen`.

In `src/screens/main/DiscoverScreen.tsx`, use `useAuth()` to derive `datingEnabled` and show a `SegmentedControl` only when dating is enabled. Do not create a separate query hook for Dating mode unless the existing `useDiscoverResults` shape becomes confusing; it already supports `intent`.

Revision note: Created on 2026-05-20 after deciding that connection intent should remain in onboarding, Dating should be the public label, and Settings should own the ongoing Dating toggle. The plan deliberately avoids database migrations and separate dating profiles for the first implementation because the current codebase already supports the needed opt-in and discover filtering behavior.
