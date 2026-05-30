# Remove Connection Intents and Refactor Discover People

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `PLANS.md` in this repository.

## Purpose / Big Picture

The app should have a simple product model: every user has a sober social profile, and dating is a separate opt-in feature controlled only by a dating profile. Today the older `connection_intents` field lets social profiles say they are open to `friends` or `dating`, which blurs social discovery with dating and makes Discover People feel closer to dating than a sober community directory.

After this work, users will discover sober people in a social-first People tab, dating will stay in its own Dating tab and profile flow, and there will be no `connection_intents` field in the frontend, backend user API, or database. Discover People will keep the current card layout for now and use one production-ready suggested ranking, refined by social-first filters for distance, sobriety, and shared interests. Age, gender, and Plus dating filters stay in Dating only. To keep cards uncluttered, visible card metadata is limited to distance/Nearby. Reach Out should not be a separate Discover badge; Discover cards should instead participate in the app-wide Reach Out red avatar outline/status treatment.

## Progress

- [x] (2026-05-30T21:52Z) Audited current app and backend references to `connection_intents`, social discover intent filtering, dating eligibility, and Discover People UI.
- [x] (2026-05-30T21:52Z) Wrote the initial production-grade ExecPlan.
- [x] (2026-05-30T22:54Z) Backend: replaced dating eligibility from `users.connection_intents` to completed, unpaused dating profile state.
- [x] (2026-05-30T22:54Z) Backend: removed social discover `intent` filtering and added discover metadata for distance, shared interests, new members, recent activity, and active Reach Out signals.
- [x] (2026-05-30T22:54Z) Backend: added migration `110_remove_connection_intents.sql` to remove `connection_intents` constraints, indexes, and column after code no longer reads it.
- [x] (2026-05-30T22:54Z) Backend: updated tests, schema snapshot, and seeds.
- [x] (2026-05-30T22:54Z) Frontend: removed connection-intent types, onboarding/profile/settings UI, Discover filters, and dating tab gating based on `User.connection_intents`.
- [x] (2026-05-30T22:54Z) Frontend: refactored Discover People copy and badges while keeping the existing user card grid.
- [x] (2026-05-30T23:30Z) Product revision: removed explicit Nearby, New, and Shared interests browse modes. Discover People now has one suggested ranking, with filters as the user-facing refinement controls.
- [x] (2026-05-30T22:54Z) Validated backend tests, frontend typecheck, and Expo Android export.

## Surprises & Discoveries

- Observation: The app has already separated Dating into its own `/dating/*` API and Dating profile editor, but Discover still carries a shared social/dating `intent` concept.
    Evidence: `src/screens/main/DiscoverScreen.tsx` uses `type DiscoverTab = 'friends' | 'meetings' | 'dating'`, `tabIntent`, `DiscoverFiltersPayload.intent`, and `user?.connection_intents?.includes('dating')`.
- Observation: The backend still uses `users.connection_intents` heavily for dating eligibility and social discover ranking.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/dating/store.go` has multiple `connection_intents @> ARRAY['dating']::text[]` checks, and `/home/michaelroddy/repos/project_radeon/internal/user/discover_store.go` reads and filters `u.connection_intents`.
- Observation: The database schema still defines `connection_intents` as a required users column with a GIN index.
    Evidence: `/home/michaelroddy/repos/project_radeon/schema/base.sql` defines `connection_intents TEXT[] NOT NULL DEFAULT ARRAY['friends']::TEXT[]`, a check constraint, and `idx_users_connection_intents`.
- Observation: The current Discover People card already shows sober milestone information, so the card layout can stay while the metadata and mode model improves.
    Evidence: `src/screens/main/DiscoverScreen.tsx` `DiscoverCard` computes `getRecoveryMilestone(user.sober_since)` and renders `cardMilestonePill`.

## Decision Log

- Decision: Remove `connection_intents` completely rather than reduce it to only `friends`.
    Rationale: A social profile already implies social community membership, while dating opt-in is better represented by a completed and unpaused dating profile. Keeping an always-friends intent would add no useful information.
    Date/Author: 2026-05-30 / Codex
- Decision: Keep the current Discover People card grid during this refactor.
    Rationale: The user explicitly wants to keep the cards for now. This plan changes the data model, copy, modes, and badges while avoiding a layout redesign.
    Date/Author: 2026-05-30 / Codex
- Decision: Use one suggested People ranking rather than explicit People browse modes.
    Rationale: Nearby, New, and Shared interests can be achieved through the existing distance, sobriety, and interest filters. Keeping one suggested surface avoids confusing users with a mode-vs-filter distinction and keeps Discover People more production-grade.
    Date/Author: 2026-05-30 / Codex
- Decision: Keep age and gender filters out of social People discovery.
    Rationale: Age and gender filters make People discovery feel like a dating surface. They remain available in Dating, while People discovery focuses on distance, sobriety, and shared interests.
    Date/Author: 2026-05-30 / Codex
- Decision: Do not add a separate Reach Out badge chip to Discover People cards.
    Rationale: The Reach Out feature already uses an app-wide red avatar outline/status treatment. Discover should reuse that shared visual system instead of inventing a second badge that could look inconsistent or overly alarming.
    Date/Author: 2026-05-30 / Codex
- Decision: Dating visibility is based on dating profile eligibility only.
    Rationale: The source of truth for dating should be the dating profile: it exists, it is completed, and it is not paused. Social profile fields must not control dating visibility.
    Date/Author: 2026-05-30 / Codex

## Outcomes & Retrospective

Implemented across the app and backend. The backend no longer reads or writes `users.connection_intents`; dating eligibility now comes from completed and unpaused dating profiles, while social Discover uses one suggested People ranking and returns card metadata. The frontend removes social/dating intent choices from onboarding, settings, profile edit, public profiles, Discover filters, and API types. The Discover surface keeps the existing user cards, labels the first tab as People, always exposes Dating as a separate opt-in product flow, and keeps only distance/Nearby as visible card metadata without adding explicit browse modes.

Validation passed:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project_radeon_go_cache go test ./...

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck
    HOME=/tmp/project_radeon_expo_home EXPO_HOME=/tmp/project_radeon_expo_home npx expo export --platform android --output-dir /tmp/project_radeon_app_discover_people_export_1780179390

Migration `110_remove_connection_intents.sql` was applied locally with:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project_radeon_go_cache make migrate

Manual runtime flows were not exercised in a simulator during this turn.

## Context and Orientation

There are two repositories involved. The React Native Expo app lives at `/home/michaelroddy/repos/project_radeon_app`. The Go backend lives at `/home/michaelroddy/repos/project_radeon`. The app talks to the backend through `src/api/client.ts`; screens should not call `fetch` directly. The backend owns database migrations under `/home/michaelroddy/repos/project_radeon/migrations`, schema snapshots under `/home/michaelroddy/repos/project_radeon/schema`, HTTP handlers under `/home/michaelroddy/repos/project_radeon/internal`, and seed data under `/home/michaelroddy/repos/project_radeon/seeds`.

`connection_intents` is an older social-profile field stored on `users`. It currently supports `friends` and `dating`. It appears in the app as `User.connection_intents`, in update-me payloads as `connection_intents`, and in Discover filters as `intent`. It appears in the backend user model, user update handler, discover endpoint, discover ranking, dating eligibility checks, schema, migrations, and seeds.

Dating already has a separate domain model. In the app, Dating uses `src/components/discover/DatingProfileEditorScreen.tsx`, route wrappers in `src/screens/main/dating`, and API calls in `src/api/client.ts` to `/dating/profile`, `/dating/discover`, `/dating/actions`, `/dating/matches`, `/dating/likes`, and `/dating/spotlights`. In the backend, Dating is primarily in `/home/michaelroddy/repos/project_radeon/internal/dating`. This plan preserves Dating as a separate opt-in feature.

Discover People currently lives in `src/screens/main/DiscoverScreen.tsx`. The tab called `Friends` is actually a discovery surface for people; it should be renamed to `People`. The current non-search display uses a two-column grid and `DiscoverCard`. That grid stays for this plan. Search results currently use `SearchResultRow`; update it only as needed for the new metadata and copy.

The phrase "suggested ranking" in this plan means the single People ordering used when the user browses Discover People. It blends social signals such as distance, shared interests, sobriety context, profile quality, and recent activity. The phrase "badge metadata" means fields returned by the backend to help the frontend show small labels on People cards: nearby, new here, active recently, shared interest count, and distance where privacy allows it. Reach Out metadata is still returned, but it is used to drive the shared red avatar outline/status treatment rather than a separate badge chip.

## Plan of Work

Start on the backend because removing `connection_intents` from the app before the API stops depending on it would create mixed-state behavior. Add code that can run safely while the column still exists, then remove the column in a migration only after all reads and writes are gone.

First, update the dating store in `/home/michaelroddy/repos/project_radeon/internal/dating/store.go`. Search for every `connection_intents @> ARRAY['dating']::text[]` condition. Replace it with a dating-profile eligibility condition. Eligibility means the candidate user has a dating profile row, the profile is complete, the profile is not paused, and the user itself is not deleted. Use the existing dating profile table and fields as already used by the store; if the store aliases the dating profile table as `dp`, the condition should be equivalent to `dp.completed_at IS NOT NULL AND dp.paused_at IS NULL`. Apply the same rule for viewer eligibility when needed. The exact table alias depends on each query, so adjust locally rather than copy-pasting one condition everywhere.

Second, update social discover in `/home/michaelroddy/repos/project_radeon/internal/user/discover_types.go`, `/home/michaelroddy/repos/project_radeon/internal/user/discover_store.go`, and `/home/michaelroddy/repos/project_radeon/internal/user/handler.go`. Remove `Intent` from discover request parsing and from `DiscoverUsersParams`. Remove `intent` from relaxed fields and "too narrow" logic. Remove any candidate strategy whose only purpose is matching `connection_intents`. Do not add user-facing People browse modes; People should use one suggested ranking and let filters refine the candidate pool.

Third, extend the social discover response only with metadata that is actively rendered by People cards or shared status UI. The existing API returns `api.User` in the app, so prefer adding optional fields to the existing discover user payload if that matches current backend structure and avoids broader rewrites. The frontend should receive:

    distance_km?: number | null
    has_active_reach_out?: boolean

`distance_km` should only be populated when the request includes location and the user's privacy rules allow it. If privacy is not yet modeled, return a rounded or approximate distance only; avoid exact street-level precision. `has_active_reach_out` should be based on active support signals if the backend can join them cheaply; otherwise add a targeted, indexed join against active support signals. Shared-interest count, new-member state, recent-activity state, and support signal ids may be used internally, but they are not exposed in the social discover user response unless a visible feature consumes them.

Fourth, implement the suggested People ordering. It should blend existing recommendation signals such as nearby distance, mutual interests, sobriety context, profile completeness, and recent activity. Filters define the candidate pool; the ranking then orders those candidates by social relevance and quality. Keep pagination stable by adding deterministic tie-breakers such as user id after timestamps or scores.

Fifth, update backend user update code. In `/home/michaelroddy/repos/project_radeon/internal/user/handler.go`, remove `ConnectionIntents` from update input and output types when the frontend is ready. In `/home/michaelroddy/repos/project_radeon/internal/user/store.go` and `cache_store.go`, remove `connectionIntents` parameters and update SQL scans so they no longer scan `u.connection_intents`. Update profile completeness scoring in `store.go` so it does not count `connection_intents`.

Sixth, update tests and seeds. In `/home/michaelroddy/repos/project_radeon/internal/user/handler_test.go`, remove tests that assert connection intent updates and invalid intent rejection. Update discover tests so they prove social discovery no longer accepts or applies `intent`, and so they cover filter combinations against the single suggested ranking. In dating tests, add or update tests proving a completed unpaused dating profile appears in dating discovery and a paused or incomplete dating profile does not, without any `connection_intents` dependency. In `/home/michaelroddy/repos/project_radeon/seeds/seed.go`, remove `ConnectionIntents` fields and helper functions. Seed dating profiles directly for users who should appear in Dating.

Seventh, add a backend migration. Create the next numbered migration under `/home/michaelroddy/repos/project_radeon/migrations`. It must drop indexes and constraints before dropping the column. It must also create replacement dating indexes that use dating profile completion/paused state rather than `users.connection_intents`. Update `/home/michaelroddy/repos/project_radeon/schema/base.sql` to match the final schema. The migration should be safe to run once and should not fail if old indexes are missing; use `DROP INDEX IF EXISTS` and `ALTER TABLE ... DROP COLUMN IF EXISTS` where appropriate.

Eighth, update the app API contract in `/home/michaelroddy/repos/project_radeon_app/src/api/client.ts`. Remove `ConnectionIntent`, remove `connection_intents` from `User`, remove `connection_intents` from update input, remove `intent` from `DiscoverFiltersPayload`, and remove `'intent'` from `DiscoverRelaxedField`. Add optional Discover People metadata fields to `User` or a discover-specific user type. If a discover-specific type is introduced, update `useDiscoverResults` and `DiscoverScreen` to use it while keeping user-profile navigation payloads unchanged.

Ninth, update app filter state in `/home/michaelroddy/repos/project_radeon_app/src/hooks/useDiscoverFilters.ts`. Remove `DiscoverIntentValue`, remove `intent` from draft and applied filters, remove intent chips, remove intent from summaries, remove intent clearing, and remove intent from relaxed-copy labels. Keep social filters focused on distance, sobriety time, interests, and the existing broaden-if-few-exact behavior. Age, gender, and Plus dating filters may remain in this shared file only for the Dating filter UI; social People must never expose or send them.

Tenth, update onboarding and profile editing. In `src/navigation/OnboardingNavigator.tsx`, remove the Intent step route if it exists only to set connection intents. Remove imports and files only if no longer used. In `src/screens/onboarding/IntentStep.tsx`, either delete the file or repurpose it only if the product needs a non-intent final step; do not keep social/dating intent choices. In `src/screens/main/ProfileTabScreen.tsx`, remove the "What are you open to?" section, state variables, save logic, and calls to update `connection_intents`. Profile edit should cover social profile facts only: bio, location, interests, identity, sober date.

Eleventh, update Discover People in `src/screens/main/DiscoverScreen.tsx` while keeping the current grid cards. Rename the `friends` tab label to `People`, but the internal enum may stay `friends` temporarily if changing it adds churn; prefer renaming it to `people` if straightforward. Stop computing `datingEnabled` from `user.connection_intents`. The Dating tab/entry should be shown based on product choice. The recommended product behavior is to keep the Dating tab visible to signed-in users and gate it with "Set up Dating" if there is no completed dating profile; this makes opt-in clear without requiring a social profile setting. If stakeholders later want to hide Dating until setup, make that a separate decision.

Twelfth, keep Discover People as a single suggested surface. Do not add a segmented control or compact chip row for Suggested, Nearby, New, or Shared interests. The People filter screen remains the place where users refine distance, sobriety, and interests. `useDiscoverResults`, React Query keys, and `src/api/client.ts` should not carry a People `mode` parameter.

Thirteenth, add card distance metadata and Reach Out status support to the existing `DiscoverCard`. Keep the full-bleed image card design for now. To avoid crowding, show only one metadata chip: Nearby or rounded distance when `distance_km` is present and within the nearby threshold. If `has_active_reach_out` is true, apply the same red avatar/card outline treatment used elsewhere in the app for active Reach Out users. Do not show separate Reach Out, sober milestone, New here, Active recently, or numeric shared interests badge chips on the profile card.

Fourteenth, update Discover copy. Replace dating-like or matching language in social People only. Use "People to connect with" and "People matching your filters". Avoid "matches" in People copy. Dating can continue using "matches" because it is a dating product. Update empty states and filter notice copy to say People rather than Friends where applicable.

Fifteenth, update all call sites and tests after the type errors guide cleanup. Search the app for `connection_intents`, `ConnectionIntent`, `intent:`, and "What are you open to". There should be no social-profile or social-discover usage remaining. Dating-specific terms like "Dating intentions" in the dating profile editor should remain because they are part of Dating, not social profile intents.

## Concrete Steps

Work in the backend first:

    cd /home/michaelroddy/repos/project_radeon
    rg -n "connection_intents|ConnectionIntent|intent" internal schema migrations seeds
    go test ./...

Expect the initial search to find many references. After backend implementation and migration, `rg -n "connection_intents|ConnectionIntent" internal schema seeds` should find no active code references, except old historical migration files. Historical migrations may keep old references because migrations are append-only records.

Then work in the app:

    cd /home/michaelroddy/repos/project_radeon_app
    rg -n "connection_intents|ConnectionIntent|DiscoverIntentValue|What are you open to|intent" src
    npm run typecheck
    HOME=/tmp/project_radeon_expo_home EXPO_HOME=/tmp/project_radeon_expo_home npx expo export --platform android --output-dir /tmp/project_radeon_app_discover_people_export_$(date +%s)

After implementation, the app search should not find `connection_intents`, `ConnectionIntent`, or `DiscoverIntentValue`. It may still find the word `intent` in Dating-specific labels such as "Dating intentions"; those are acceptable and should be reviewed manually rather than deleted blindly.

Use the backend and app commands after each milestone, not only at the end. If a milestone deliberately breaks frontend/backend compatibility temporarily, record that in `Progress` and fix it before merging.

## Validation and Acceptance

Backend validation must include `go test ./...` from `/home/michaelroddy/repos/project_radeon`. It should pass. Add tests that prove:

- `/users/discover` does not require or expose a People browse mode.
- `/users/discover` no longer accepts or uses `intent`.
- Dating discovery includes completed unpaused dating profiles and excludes incomplete or paused profiles without checking `users.connection_intents`.
- Updating `/users/me` ignores or rejects `connection_intents` according to the chosen API compatibility behavior. Prefer rejecting unknown fields only if the current API already rejects unknown fields; otherwise ignore the removed field during a compatibility window.

App validation must include `npm run typecheck` and Expo Android export from `/home/michaelroddy/repos/project_radeon_app`. Both must pass. Manual app acceptance:

- Onboarding no longer asks "what are you open to" or social/dating intent.
- Social profile edit no longer contains "What are you open to?"
- Discover tab label reads People, Meetings, Dating.
- People uses the current grid cards, not a new full-width card layout.
- People does not show Suggested, Nearby, New, or Shared interests browse-mode selectors.
- Changing People filters changes the candidate pool while the single suggested ranking remains stable.
- People cards can show sober milestone plus the new badges when data is present, and active Reach Out users receive the same red outline/status treatment used elsewhere in the app.
- People copy does not use "match" language.
- Dating setup and Dating discovery still work through dating profile state.
- Dating filters and Dating profile fields still include Dating-specific language where appropriate.

If a local backend and app can be run together, manually verify the API using curl or an API client:

    curl -H "Authorization: Bearer <token>" "http://localhost:8080/users/discover?distance_km=50&lat=53.35&lng=-6.26"

The response should contain users and optional discover metadata such as `distance_km` and `has_active_reach_out`. It should not contain `connection_intents`, shared-interest count, new-member state, recent-activity state, or support signal ids unless a visible feature consumes those fields.

## Idempotence and Recovery

This change spans a frontend app, backend service, and database migration. Keep the migration append-only; do not edit already-applied historical migrations except for the schema snapshot. If implementation fails before the migration is applied, revert code changes normally. If the migration has been applied locally and needs to be undone during development, restore from a local dev database backup or write a temporary down script only for local development; do not ship a destructive rollback unless the deployment process requires it.

Make the backend code stop reading `connection_intents` before dropping the column. This avoids runtime errors in mixed deploys. If the production deployment order can run app and backend at different times, backend should tolerate old app payloads for a short window by ignoring `connection_intents` in update requests rather than failing. Record the final compatibility choice in the Decision Log during implementation.

Do not remove Dating-specific profile fields or copy. Terms such as "Dating intentions" belong to the Dating profile and should stay. Only remove social-profile connection intents.

## Artifacts and Notes

Initial audit snippets:

    /home/michaelroddy/repos/project_radeon/schema/base.sql defines users.connection_intents and idx_users_connection_intents.
    /home/michaelroddy/repos/project_radeon/internal/dating/store.go uses connection_intents @> ARRAY['dating']::text[] for dating eligibility.
    /home/michaelroddy/repos/project_radeon/internal/user/discover_store.go reads u.connection_intents and uses intent as a discover source.
    /home/michaelroddy/repos/project_radeon_app/src/screens/main/DiscoverScreen.tsx uses user.connection_intents to decide whether Dating is enabled.
    /home/michaelroddy/repos/project_radeon_app/src/hooks/useDiscoverFilters.ts includes DiscoverIntentValue and intent chips.

Expected final search behavior:

    cd /home/michaelroddy/repos/project_radeon_app
    rg -n "connection_intents|ConnectionIntent|DiscoverIntentValue" src
    # no output

    cd /home/michaelroddy/repos/project_radeon
    rg -n "connection_intents|ConnectionIntent" internal schema seeds
    # no active code/schema output after migration and schema snapshot update

Final implementation artifacts:

    /home/michaelroddy/repos/project_radeon/migrations/110_remove_connection_intents.sql
    /home/michaelroddy/repos/project_radeon/internal/user/discover_store.go
    /home/michaelroddy/repos/project_radeon/internal/dating/store.go
    /home/michaelroddy/repos/project_radeon_app/src/screens/main/DiscoverScreen.tsx
    /home/michaelroddy/repos/project_radeon_app/src/hooks/useDiscoverFilters.ts
    /home/michaelroddy/repos/project_radeon_app/src/api/client.ts

## Interfaces and Dependencies

No new third-party library is required. Use existing React Native components, React Query hooks, and Go/Postgres patterns already in the repositories.

At the end of the backend work, `/users/discover` must accept this conceptual request shape:

    q?: string
    city?: string
    distance_km?: number
    sobriety?: string
    interest?: repeated string
    lat?: number
    lng?: number
    cursor?: string
    limit?: number

It must not accept or apply `intent`.

The app-side `DiscoverFiltersPayload` in `src/api/client.ts` must no longer include `intent`. The app-side social discover result must expose only the optional metadata used by visible card/status UI. If the existing `User` type is extended, add:

    distance_km?: number | null;
    has_active_reach_out?: boolean;

If a new discover-specific type is introduced instead, use:

    export interface DiscoverUser extends User {
        distance_km?: number | null;
        has_active_reach_out?: boolean;
    }

The Dating API and Dating profile types should keep their existing Dating-specific fields. Dating eligibility in backend queries must be expressed through dating profile completion and pause state, not through social user fields.

## Revision Notes

- 2026-05-30 / Codex: Initial plan created after auditing the app and backend references. The initial plan included immediate People browse modes and card badges because the user requested a full production-grade plan rather than deferring those features.
- 2026-05-30 / Codex: Revised Reach Out handling. Discover People should use the existing app-wide red avatar outline/status treatment for active Reach Out users rather than adding a separate visible Reach Out badge chip.
- 2026-05-30 / Codex: Implemented the plan. Backend full tests, app typecheck, and Android export passed.
- 2026-05-30 / Codex: Revised Discover People to remove explicit Nearby, New, and Shared interests browse modes. Filters now handle refinement and the People tab uses a single suggested ranking.
- 2026-05-31 / Codex: Revised visible People card badges to distance/Nearby only, including removing the sober milestone pill, so the card stays uncluttered.
- 2026-05-31 / Codex: Cleanup removed unused frontend style blocks and stopped exposing unused social discover response fields for shared-interest count, new-member state, and recent activity. Internal ranking still uses shared interests and activity where needed.
