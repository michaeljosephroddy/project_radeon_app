# Recovery Profile Counter and Daily Reflections

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`. Implementation work in `/home/michaelroddy/repos/project_radeon` must also follow that repository's `PLANS.md`.

## Purpose / Big Picture

Project Radeon is a community-first sober social app. This plan adds two recovery features that strengthen that identity without turning the product into a habit tracker or gamified recovery tool: a more pronounced public sobriety counter on profiles, and a private daily reflection journal that can optionally be shared to the social feed.

After this change, a member can open any profile and immediately understand how long that person has been sober. The same member can also write a short daily reflection, keep it private, browse past reflections, or share a snapshot to the feed as a normal community post. The feature is intentionally quiet: there are no streaks, experience points, quests, leaderboards, recovery scores, or pressure language.

The proof is user-visible. Start the backend and Expo app, log in, set a sober date, open the profile, and see a prominent `Sober for` counter near the profile header. Then create today's reflection, confirm it appears in a private reflection history, share it to feed, and confirm the feed shows a clean social post labeled as a daily reflection while the private journal entry remains editable without unexpectedly changing the feed snapshot.

## Progress

- [x] (2026-05-01 09:15Z) Audited the current frontend profile, feed, query, API client, and date helper surfaces in `/home/michaelroddy/repos/project_radeon_app`.
- [x] (2026-05-01 09:15Z) Audited the current backend user, feed, route, and schema surfaces in `/home/michaelroddy/repos/project_radeon`.
- [x] (2026-05-01 09:15Z) Confirmed that `users.sober_since` already exists and is already returned on `/users/me` and `/users/{id}`.
- [x] (2026-05-01 09:15Z) Authored this ExecPlan as a planning artifact only. No application or backend implementation code has been changed by this plan.
- [x] (2026-05-01 09:16Z) Created implementation branch `feature/recovery-reflections` in `/home/michaelroddy/repos/project_radeon`. The app repository is continuing on `codex/recovery-profile-reflections-execplan`, which already contains this plan.
- [x] (2026-05-01 09:24Z) Added backend migration `059_daily_reflections.sql`, `daily_reflections` schema, post source metadata columns, authenticated reflection routes, reflection store/handler code, and focused handler tests.
- [x] (2026-05-01 09:27Z) Reworked app profile sobriety presentation with a shared `SobrietyCounter` component and removed the badge-forward profile treatment from own/public profiles.
- [x] (2026-05-01 09:28Z) Added frontend reflection API functions, React Query keys/hooks, deterministic prompt helper, daily reflection composer, recent history, delete, and share-to-feed actions.
- [x] (2026-05-01 09:29Z) Added shared-reflection source label support to feed and profile post rendering.
- [x] (2026-05-01 09:29Z) Validated `npx tsc --noEmit` in the app and focused backend tests `GOCACHE=/tmp/go-build-cache go test ./internal/reflections ./internal/feed ./cmd/api`.
- [x] (2026-05-01 09:43Z) Revised the reflection UX based on user feedback: removed the profile-embedded reflection section and rotating prompt helper, added a header icon in `AppNavigator`, and moved reflections into dedicated `DailyReflectionScreen`.
- [x] (2026-05-01 09:43Z) Revalidated `npx tsc --noEmit` after the dedicated-screen redesign.
- [x] (2026-05-01 09:50Z) Built out the dedicated journal experience with date-forward writing, grouped monthly history, and editable entry detail views.
- [x] (2026-05-01 10:00Z) Replaced the open journal box with three structured prompts: `Today I'm grateful for`, `What's on my mind?`, and `What's blocking me today?`; added backend migration `060_daily_reflection_sections.sql`.
- [x] (2026-05-01 10:00Z) Revalidated `npx tsc --noEmit`, `GOCACHE=/tmp/go-build-cache go test ./internal/reflections ./internal/feed ./cmd/api`, and `git diff --check` in both repositories.
- [x] (2026-05-01 10:12Z) Removed the extra reflection metadata controls from the app UI and client request contract, keeping the journal focused on the three writing prompts.
- [x] (2026-05-01 10:20Z) Removed the extra reflection metadata fields from backend code, schema, migrations, tests, and this plan.
- [ ] Run the app and backend manually against a migrated local database to validate the full user flow.

## Surprises & Discoveries

- Observation: The app already has the core sobriety data model.
    Evidence: The backend `users` table in `/home/michaelroddy/repos/project_radeon/schema/base.sql` includes `sober_since DATE`, `internal/user/store.go` selects it in `GetUser`, and the frontend `User` interface in `src/api/client.ts` exposes `sober_since?: string`.

- Observation: The app already shows some sobriety UI, but it currently leans toward milestone-badge language.
    Evidence: `src/screens/main/ProfileTabScreen.tsx` renders a `SOBRIETY` section with `Sober since`, a milestone badge, and days-to-next milestone text. `src/screens/main/UserProfileScreen.tsx` renders a small `MILESTONE` card using `getRecoveryMilestone`.

- Observation: The current date helper returns a simple day count, not a human-scale profile counter.
    Evidence: `src/utils/date.ts` implements `formatRecoveryDuration(daysSober)` as `N days in recovery`; it does not format years, months, and days for longer sobriety periods.

- Observation: The feed already supports normal text posts and internal post sharing, so reflection sharing should reuse the existing feed instead of building a separate public reflection surface.
    Evidence: `src/api/client.ts` already exposes `createPost`, `sharePost`, and `getHomeFeed`; the backend routes in `/home/michaelroddy/repos/project_radeon/cmd/api/main.go` already mount `POST /posts` and `GET /feed/home`.

- Observation: The AGENTS guidance mentions `src/utils/theme.ts`, but the current app imports design tokens from `src/theme`.
    Evidence: Files such as `src/screens/main/UserProfileScreen.tsx` import `{ Colors, Typography, Spacing, Radius, ContentInsets }` from `../../theme`; there is no `src/utils/theme.ts` in this working tree.

- Observation: A full backend `go test ./...` currently fails outside this feature because `scripts/seed_avatars` has a vet failure for `fmt.Println` with a redundant newline.
    Evidence: `GOCACHE=/tmp/go-build-cache go test ./...` passes app packages touched by this work but reports `scripts/seed_avatars/main.go:362:2: fmt.Println arg list ends with redundant newline`.

## Decision Log

- Decision: Sobriety counters are public profile information, with no visibility settings in this feature.
    Rationale: The user explicitly chose public sobriety on profiles because the app is a recovery community app. Visibility settings would add complexity and imply ambiguity that the product does not need right now.
    Date/Author: 2026-05-01 / Codex

- Decision: Replace badge-forward profile language with a prominent sober-time counter and quiet supporting date.
    Rationale: The user does not want the app to feel gimmicky. A clear counter supports identity and connection without turning sobriety into an achievement system.
    Date/Author: 2026-05-01 / Codex

- Decision: Daily reflections are private by default, but sharing a reflection creates a feed snapshot.
    Rationale: The journal should remain a private writing space. Sharing should support community connection, but public feed content must not silently change when a user later edits a private entry.
    Date/Author: 2026-05-01 / Codex

- Decision: Do not add streaks, quests, XP, leaderboards, progress-to-next-milestone prompts, recovery scores, or pushy reminder mechanics in this plan.
    Rationale: Those patterns would move the app toward a gamified recovery tool. The desired product direction is sober social network first.
    Date/Author: 2026-05-01 / Codex

- Decision: Use one reflection per local calendar date for v1.
    Rationale: A daily reflection should be easy to understand and query. Allowing multiple entries per day would turn this into a fuller journaling product and increase UI and API complexity before the core behavior is proven.
    Date/Author: 2026-05-01 / Codex

- Decision: Reflections live behind a top-level app-header icon and open into a dedicated screen, not inline on profile or feed.
    Rationale: The profile-embedded UI felt cluttered and low quality. A dedicated screen makes reflection feel intentional and premium while keeping profile focused on public identity.
    Date/Author: 2026-05-01 / Codex

- Decision: Use one static prompt, `What do you want to reflect on?`, instead of rotating daily questions.
    Rationale: The user explicitly rejected daily question variation. A single prompt is calmer and avoids making the feature feel like a recovery-game mechanic.
    Date/Author: 2026-05-01 / Codex

- Decision: Keep the reflection contract to the prompt fields and generated body only.
    Rationale: The user wants the journal to feel calm and non-gimmicky. The app and backend now focus on the three short writing prompts without extra self-rating or classification metadata.
    Date/Author: 2026-05-01 / Codex

- Decision: Persist three structured reflection sections alongside the generated body.
    Rationale: The user wanted a guided journal flow rather than a weak open text box. Storing sections separately keeps editing/history clean while preserving `body` as the feed-share snapshot content.
    Date/Author: 2026-05-01 / Codex

## Outcomes & Retrospective

The first implementation slice is complete in code, then the reflection UX was redesigned based on user feedback and tightened into a calmer guided journal experience. The current app shape is: public profile sobriety counters remain on profiles; reflections are launched from a header icon and open into a dedicated full-screen writing experience with date, three short reflection prompts, monthly history groups, and editable entry detail. Shared reflections still create feed snapshots with subtle `Daily reflection` labels. Focused backend tests and the app typecheck pass. Manual validation against a running local app remains outstanding.

## Context and Orientation

This work spans two repositories.

The frontend repository is `/home/michaelroddy/repos/project_radeon_app`. It is a React Native Expo app. The app's single API module is `src/api/client.ts`; all network calls should go there. Global authenticated user state is in `src/hooks/useAuth.tsx`. The current user's editable profile screen is `src/screens/main/ProfileTabScreen.tsx`. Another user's public profile screen is `src/screens/main/UserProfileScreen.tsx`. Feed rendering is in `src/screens/main/FeedScreen.tsx`. React Query keys live in `src/query/queryKeys.ts`. Existing data hooks live under `src/hooks/queries/`. Shared date helpers live in `src/utils/date.ts`. Design tokens are exported from `src/theme`.

The backend repository is `/home/michaelroddy/repos/project_radeon`. It is a Go HTTP API backed by Postgres. Routes are mounted in `cmd/api/main.go`. User profile handlers and types live in `internal/user/handler.go`; user persistence lives in `internal/user/store.go`; the user cache wrapper lives in `internal/user/cache_store.go`. Feed handlers and post/feed types live in `internal/feed/handler.go` and `internal/feed/foundation_types.go`; feed persistence lives mainly across `internal/feed/store.go`, `internal/feed/read_store.go`, `internal/feed/foundation_store.go`, and `internal/feed/engagement_store.go`. SQL migrations live in `migrations/`, and the base schema lives in `schema/base.sql`.

Define the key terms plainly:

- A `sobriety counter` is the public profile display that calculates elapsed sober time from `users.sober_since`.
- A `daily reflection` is a private journal entry owned by one user for one calendar date.
- A `reflection prompt` is optional helper text shown above the journal input for a given date.
- A `shared reflection` is a normal feed post created from a snapshot of the reflection text at share time.
- A `snapshot` means the feed post stores its own body and metadata. If the user edits the private reflection later, the public feed post does not change automatically.

The backend already stores `users.sober_since`. Registration and profile update flows already accept `sober_since` in `internal/auth/handler.go`, `internal/auth/store.go`, `internal/user/handler.go`, and `internal/user/store.go`. The frontend already lets a user edit their sober date in `ProfileTabScreen.tsx`. Implementation should preserve those paths.

## Plan of Work

The work should proceed in five milestones.

### Milestone 1: Quietly reframe profile sobriety around a public counter

At the end of this milestone, both own profile and public user profiles show a prominent `Sober for` counter derived from `sober_since`. The counter should be positioned near the profile identity area, before less important profile details. The supporting date should read `Since Month Day, Year`. The visual treatment should be calm and profile-native: no trophy language, no progress-to-next milestone text, and no large achievement wall.

In `/home/michaelroddy/repos/project_radeon_app/src/utils/date.ts`, add or replace helper functions so a date-only sober date can produce:

    formatSoberCounter(dateStr?: string): string
    formatSoberSinceLine(dateStr?: string): string
    getSoberDayCount(dateStr?: string): number | null

The counter should format same-day sobriety as `Sober today`, one day as `1 day`, short spans as `N days`, and longer spans as human-scale labels such as `1 year, 2 months, 4 days`. The exact helper names can change if the code reads better, but the behavior must be centralized in `src/utils/date.ts` so profile screens do not duplicate date math.

In `src/screens/main/ProfileTabScreen.tsx`, replace the current milestone-forward sobriety summary with a prominent public counter. Keep the existing edit flow for `sober_since`. Remove or de-emphasize `days to next` and `Longest milestone badge unlocked` copy because it feels like a gamified badge system.

In `src/screens/main/UserProfileScreen.tsx`, replace the current small `MILESTONE` card with the same public counter component or the same visual pattern. If a shared component is appropriate, create it in `src/components/` as `SobrietyCounter.tsx`; otherwise keep the two implementations small and consistent. Use `StyleSheet.create` and design tokens from `src/theme`; do not hardcode colors or spacing unless the existing file already uses an unavoidable one-off.

This milestone is frontend-only because the backend already returns `sober_since`.

### Milestone 2: Add backend daily reflection persistence

At the end of this milestone, the backend can create, update, list, retrieve, and delete private daily reflections for the authenticated user. Reflections are not visible to other users unless shared to feed in a later milestone.

Create a migration in `/home/michaelroddy/repos/project_radeon/migrations/` with the next numeric prefix. Add a table named `daily_reflections`:

    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
    reflection_date DATE NOT NULL
    prompt_key TEXT NULL
    prompt_text TEXT NULL
    body TEXT NOT NULL
    shared_post_id UUID NULL REFERENCES posts(id) ON DELETE SET NULL
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    UNIQUE (user_id, reflection_date)
    CHECK (length(body) <= 2000)

Also add indexes for listing by user and date:

    CREATE INDEX IF NOT EXISTS idx_daily_reflections_user_date_desc
        ON daily_reflections(user_id, reflection_date DESC);

Update `/home/michaelroddy/repos/project_radeon/schema/base.sql` with the same table so fresh databases match migrated databases.

Add a new backend package or small internal module for reflections. Prefer `internal/reflections` because the feature has its own persistence and HTTP contract. If the repository strongly favors adding small features to existing packages during implementation, it is acceptable to place it under `internal/user`, but the API should still be named around reflections, not users.

The backend type should expose fields matching the JSON contract:

    type DailyReflection struct {
        ID             uuid.UUID  `json:"id"`
        UserID         uuid.UUID  `json:"user_id"`
        ReflectionDate string     `json:"reflection_date"`
        PromptKey      *string    `json:"prompt_key,omitempty"`
        PromptText     *string    `json:"prompt_text,omitempty"`
        GratefulFor    *string    `json:"grateful_for,omitempty"`
        OnMind         *string    `json:"on_mind,omitempty"`
        BlockingToday  *string    `json:"blocking_today,omitempty"`
        Body           string     `json:"body"`
        SharedPostID   *uuid.UUID `json:"shared_post_id,omitempty"`
        CreatedAt      time.Time  `json:"created_at"`
        UpdatedAt      time.Time  `json:"updated_at"`
    }

The reflection date should be a date-only string in `YYYY-MM-DD` format. Use server validation for that format. Body should be trimmed, required, and limited to 2000 characters. Prompt fields should be optional and stored as the prompt shown at the time of writing, so prompt copy can change later without rewriting old entries.

### Milestone 3: Add backend reflection HTTP endpoints

At the end of this milestone, the app can call authenticated reflection endpoints. Mount these routes in `/home/michaelroddy/repos/project_radeon/cmd/api/main.go`:

    GET    /reflections
    GET    /reflections/today
    PUT    /reflections/today
    GET    /reflections/{id}
    PATCH  /reflections/{id}
    DELETE /reflections/{id}
    POST   /reflections/{id}/share

`GET /reflections` should list the current user's reflections using cursor pagination. Date-based pagination is enough: accept `before=YYYY-MM-DD` and `limit`, default to 20, cap at 50, and return the existing cursor envelope shape used elsewhere in the API if practical. If the existing pagination helper only supports timestamps, either extend it carefully or implement a small local date cursor parser inside the reflections package.

`GET /reflections/today` should return today's reflection for the authenticated user if it exists. If no reflection exists, it should return `null` in the data envelope rather than a 404, because the app will use this to decide whether to show an empty composer.

`PUT /reflections/today` should upsert one reflection for the current server date. This endpoint is the simplest v1 writing path. It should create the row if none exists for `(user_id, current_date)`, or update the existing row if one exists.

`PATCH /reflections/{id}` should update an existing reflection owned by the current user. Ownership must be enforced by filtering on both `id` and `user_id`.

`DELETE /reflections/{id}` should delete a private reflection owned by the current user. Deleting a private reflection must not delete any feed post that was already shared from it. The feed post is a public snapshot and follows normal feed deletion rules.

`POST /reflections/{id}/share` should create a normal feed post from a snapshot of the reflection. It should reject sharing another user's reflection. If the reflection was already shared and still has `shared_post_id`, the endpoint should be idempotent: return the existing post id instead of creating duplicates. The feed post body should be the trimmed reflection body, not an auto-generated motivational wrapper.

The share endpoint should set subtle source metadata on the created post so the feed can label it. The recommended backend change is to add nullable columns to `posts`:

    source_type TEXT NULL
    source_id UUID NULL
    source_label TEXT NULL

For a shared daily reflection, use:

    source_type = 'daily_reflection'
    source_id = daily_reflections.id
    source_label = 'Daily reflection'

Add a check constraint limiting `source_type` to known values if present. Add these fields to backend `feed.Post`, `feed.FeedItem`, and the frontend `Post` and `FeedItem` interfaces. Existing posts should continue to render normally with null source metadata.

If implementation reveals that adding source columns to `posts` is too invasive, the fallback is to create a feed post with normal body only and add the label later. Do not block private reflection functionality on feed metadata. Record that fallback in `Decision Log` if used.

### Milestone 4: Add frontend reflection API, hooks, composer, and history

At the end of this milestone, the app has a private daily reflection flow.

In `/home/michaelroddy/repos/project_radeon_app/src/api/client.ts`, define shared types next to API functions:

    export interface DailyReflection {
        id: string;
        user_id: string;
        reflection_date: string;
        prompt_key?: string | null;
        prompt_text?: string | null;
        grateful_for?: string | null;
        on_mind?: string | null;
        blocking_today?: string | null;
        body: string;
        shared_post_id?: string | null;
        created_at: string;
        updated_at: string;
    }

    export interface UpsertDailyReflectionInput {
        prompt_key?: string | null;
        prompt_text?: string | null;
        grateful_for?: string | null;
        on_mind?: string | null;
        blocking_today?: string | null;
        body: string;
    }

Add functions:

    getTodayReflection(): Promise<DailyReflection | null>
    upsertTodayReflection(input: UpsertDailyReflectionInput): Promise<DailyReflection>
    listReflections(cursor?: string, limit?: number): Promise<CursorResponse<DailyReflection>>
    getReflection(id: string): Promise<DailyReflection>
    updateReflection(id: string, input: Partial<UpsertDailyReflectionInput>): Promise<DailyReflection>
    deleteReflection(id: string): Promise<void>
    shareReflection(id: string): Promise<{ post_id: string }>

In `src/query/queryKeys.ts`, add keys for today's reflection, reflection history, and reflection detail. In `src/hooks/queries/`, add focused hooks such as `useTodayReflection`, `useReflectionHistory`, and mutation hooks if that matches current query patterns. Keep API types in `src/api/client.ts`; do not create a separate top-level `types/` folder.

Add the UI in a restrained location. Do not create a new recovery tab. The final placement is the app header, opening a dedicated full-screen reflection screen. Keep the composer short and utilitarian with three writing prompts only. Avoid copy that explains the feature in the UI; labels like `Reflection`, `Journal`, `Save`, and `Share` are enough.

The prompt system should be local in v1. Create a small helper in `src/utils/reflectionPrompts.ts` that deterministically picks one prompt per date. Use a fixed list with calm prompts such as:

- `What do you need today?`
- `What are you carrying today?`
- `What helped you stay grounded recently?`
- `What is one thing you want to remember from today?`
- `Who could you reach out to today?`

The prompt shown to the user should be sent to the backend and stored on the reflection row as `prompt_key` and `prompt_text`. That makes history stable even if the prompt list changes later.

Add a reflection history view reachable from the reflection screen header. The history should be a simple date-ordered list with date, shared status, and preview. Tapping an entry opens a detail/edit view. Keep the reflection flow in `DailyReflectionScreen.tsx` unless it grows enough to justify extracting screen-specific subcomponents.

### Milestone 5: Add share-to-feed and feed labeling

At the end of this milestone, a user can share a saved reflection to the feed. The feed should render it as a normal community post with subtle metadata, not as a special recovery card.

In the reflection composer and reflection detail view, show `Share to feed` only after the reflection has been saved and has body text. Tapping it should call `shareReflection(id)`. On success, invalidate `queryKeys.homeFeed()` and the current user's `queryKeys.userPosts(user.id)` so the shared post appears in feed and profile post lists.

If the backend adds post source metadata, update `src/api/client.ts` to include:

    source_type?: 'daily_reflection' | string | null;
    source_id?: string | null;
    source_label?: string | null;

on both `Post` and `FeedItem`. Update `FeedScreen.tsx` and `UserProfileScreen.tsx` to show a subtle metadata line when `source_label` is present:

    Daily reflection

If the current user has a valid `sober_since`, the feed metadata may include sober duration using existing local user state only when it is already available. Do not add extra backend joins just to show `42 days sober` on feed cards in v1. The important behavior is sharing the reflection as a social post.

The share action should not create a second post if tapped twice. The backend idempotence rule should protect this, and the frontend should also disable the button while the mutation is pending.

## Concrete Steps

Use these commands exactly unless a file move requires a path adjustment.

Create implementation branches before coding. In the backend repository:

    cd /home/michaelroddy/repos/project_radeon
    git checkout -b feature/recovery-reflections

In the frontend repository:

    cd /home/michaelroddy/repos/project_radeon_app
    git checkout -b feature/recovery-reflections-client

Inspect the current profile and sobriety surfaces:

    cd /home/michaelroddy/repos/project_radeon_app
    rg -n "sober_since|formatRecoveryDuration|formatSobrietyDate|getRecoveryMilestone|MILESTONE|SOBRIETY|UserProfileScreen|ProfileTabScreen" src

Inspect the current backend user and feed surfaces:

    cd /home/michaelroddy/repos/project_radeon
    rg -n "sober_since|GetUser|UpdateMe|CreatePost|ListHomeFeed|Post struct|FeedItem struct|/feed/home|/posts" internal cmd migrations schema

Run baseline backend tests:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache go test ./internal/user ./internal/feed ./cmd/api

Run the baseline app typecheck:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Implement Milestone 1 in the app and rerun:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Implement backend migrations and reflection endpoints, then rerun:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache go test ./internal/reflections ./internal/user ./internal/feed ./cmd/api

If the `internal/reflections` package does not exist before implementation, the first version of this command will fail until the package is created. After the package is created, it should pass.

Apply migrations locally when the SQL is ready:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache make migrate
    GOCACHE=/tmp/go-build-cache make migrate-status

Implement the frontend reflection API and UI, then rerun:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Start the backend and app for manual validation:

    cd /home/michaelroddy/repos/project_radeon
    go run ./cmd/api

In a separate terminal:

    cd /home/michaelroddy/repos/project_radeon_app
    EXPO_PUBLIC_API_URL=http://localhost:8080 npx expo start

If validating on Android emulator, use the app's configured Android default or set:

    EXPO_PUBLIC_API_URL=http://10.0.2.2:8080 npx expo start

## Validation and Acceptance

Validation must prove behavior, not just compilation.

First validate the public sobriety counter. Log in as a user with `sober_since` set to today's date and open the current user's profile. The profile should read `Sober for` with a same-day label such as `Sober today` or equivalent product-approved copy, and a supporting `Since Month Day, Year` line. Change the sober date to at least one year ago and refresh. The profile should display a human-scale counter such as `1 year, ...` rather than only a large day count. Open another user's profile and confirm the same public counter pattern appears there. There should be no visibility setting, no progress-to-next milestone copy, and no trophy-style badge wall.

Then validate private reflections. Open the reflection screen from the app header. With no reflection written today, the composer should be empty and ready to write. Enter one or more prompt responses, save, refresh the app, and confirm the saved reflection returns. Edit the reflection, refresh again, and confirm the edit persists. Delete it and confirm it no longer appears in today's composer or history.

Then validate reflection history. Create or seed reflections for at least three different dates. Open history and confirm entries are ordered newest first, show stable dates, show a preview without layout overflow, and open into an editable detail screen. Pagination should fetch older entries without duplicating rows.

Then validate share-to-feed. Save today's reflection and tap `Share to feed`. The app should create a feed post, invalidate the home feed, and show the shared body in the feed. The feed item should have subtle metadata such as `Daily reflection` if post source metadata was implemented. Tap share again and confirm no duplicate feed post is created. Edit the private reflection after sharing and confirm the feed post remains the original snapshot.

Then validate ownership and privacy. Log in as a second user. The second user must not be able to list, retrieve, edit, delete, or share the first user's private reflections by guessing IDs. The second user can only see a reflection if it was shared as a normal feed post.

Then validate backend tests and app typecheck:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache go test ./...

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

The expected result is that Go tests pass and TypeScript reports no type errors. If the repository has known unrelated failing tests at implementation time, record the exact failing package, command output, and reason in `Surprises & Discoveries`.

## Idempotence and Recovery

The profile counter milestone is safe to retry because it only changes derived display from existing `sober_since` data. If date formatting produces incorrect labels, revert the helper function behavior with a focused edit rather than changing stored dates.

The reflection migration is additive. It creates a new table and optional post source columns. It must not rewrite or delete existing user, post, feed, or support data. If the migration fails before being stamped as applied, fix the SQL and rerun `make migrate`. If it has been applied in a local development database and needs adjustment, create a new corrective migration rather than editing an already-applied migration.

The reflection write path is idempotent for today's entry because `daily_reflections` has a unique constraint on `(user_id, reflection_date)`. `PUT /reflections/today` should use an upsert or transaction-safe get-then-update pattern so repeated saves update the same row instead of creating duplicates.

The share path must be idempotent. Use `shared_post_id` on `daily_reflections` to remember the created feed post. If a request is retried after the post is created but before the reflection row is updated, implementation should either run in a transaction or detect an existing post with `source_type = 'daily_reflection'` and `source_id = reflection.id`.

If feed source metadata proves risky, keep reflection sharing as a normal post and document the decision. Private reflection creation, editing, history, and snapshot sharing are the critical feature behaviors; feed labeling is helpful but not worth destabilizing feed serving.

## Artifacts and Notes

Current relevant frontend files:

    /home/michaelroddy/repos/project_radeon_app/src/api/client.ts
        Contains User, Post, FeedItem interfaces and all API functions.

    /home/michaelroddy/repos/project_radeon_app/src/screens/main/ProfileTabScreen.tsx
        Current user's profile and sober date edit flow. Already renders a sobriety summary.

    /home/michaelroddy/repos/project_radeon_app/src/screens/main/UserProfileScreen.tsx
        Public profile view for another user. Already renders `Sober since` and a milestone card.

    /home/michaelroddy/repos/project_radeon_app/src/screens/main/FeedScreen.tsx
        Home feed rendering. Use this only for subtle shared-reflection metadata; do not create a separate public reflection feed.

    /home/michaelroddy/repos/project_radeon_app/src/utils/date.ts
        Existing date helpers for sobriety formatting.

Current relevant backend files:

    /home/michaelroddy/repos/project_radeon/schema/base.sql
        Fresh database schema. Add `daily_reflections` and any post source columns here after adding migrations.

    /home/michaelroddy/repos/project_radeon/internal/user/handler.go
        User profile HTTP contract. Already exposes `sober_since`.

    /home/michaelroddy/repos/project_radeon/internal/user/store.go
        User profile persistence. Already selects and updates `sober_since`.

    /home/michaelroddy/repos/project_radeon/internal/feed/handler.go
        Feed and post HTTP contract. Add source metadata to `Post` if implementing shared-reflection labeling.

    /home/michaelroddy/repos/project_radeon/internal/feed/foundation_types.go
        Feed item model. Add source metadata to `FeedItem` if implementing shared-reflection labeling.

    /home/michaelroddy/repos/project_radeon/cmd/api/main.go
        Route mounting. Add `/reflections` routes here.

Potential SQL shape for the new reflection table:

    CREATE TABLE IF NOT EXISTS daily_reflections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reflection_date DATE NOT NULL,
        prompt_key TEXT NULL,
        prompt_text TEXT NULL,
        body TEXT NOT NULL,
        shared_post_id UUID NULL REFERENCES posts(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, reflection_date),
        CHECK (length(body) <= 2000)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_reflections_user_date_desc
        ON daily_reflections(user_id, reflection_date DESC);

Potential post source metadata:

    ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS source_type TEXT NULL,
        ADD COLUMN IF NOT EXISTS source_id UUID NULL,
        ADD COLUMN IF NOT EXISTS source_label TEXT NULL;

    ALTER TABLE posts
        ADD CONSTRAINT posts_source_type_chk
        CHECK (source_type IS NULL OR source_type IN ('daily_reflection'));

## Interfaces and Dependencies

Backend reflection store interface should be explicit and ownership-safe:

    type Store interface {
        GetTodayReflection(ctx context.Context, userID uuid.UUID, today time.Time) (*DailyReflection, error)
        UpsertTodayReflection(ctx context.Context, userID uuid.UUID, today time.Time, input UpsertDailyReflectionInput) (*DailyReflection, error)
        ListReflections(ctx context.Context, userID uuid.UUID, before *time.Time, limit int) ([]DailyReflection, error)
        GetReflection(ctx context.Context, userID, reflectionID uuid.UUID) (*DailyReflection, error)
        UpdateReflection(ctx context.Context, userID, reflectionID uuid.UUID, input UpdateReflectionInput) (*DailyReflection, error)
        DeleteReflection(ctx context.Context, userID, reflectionID uuid.UUID) error
        ShareReflection(ctx context.Context, userID, reflectionID uuid.UUID) (uuid.UUID, error)
    }

The actual implementation may split `ShareReflection` into a reflection service that calls both the reflection store and feed store. If so, keep the transaction boundary clear and document it in this plan. The share operation touches both `daily_reflections` and `posts`, so it should be transaction-safe in the backend rather than implemented as two separate client calls.

Frontend reflection APIs must live in `src/api/client.ts`. React Query hooks should live under `src/hooks/queries/`. Query keys must live in `src/query/queryKeys.ts`. UI should use existing React Native primitives, `StyleSheet.create`, and tokens from `src/theme`. Do not add a new state library.

The app has no dedicated lint or test command configured. Use `npx tsc --noEmit` as the primary frontend verification command. The backend should use `GOCACHE=/tmp/go-build-cache go test ./...` unless a focused package command is being used during intermediate development.

Revision note: This initial ExecPlan was created on 2026-05-01 to capture the agreed product direction: public, prominent sobriety counters plus private daily reflections with optional share-to-feed, explicitly avoiding gimmicky recovery mechanics.
