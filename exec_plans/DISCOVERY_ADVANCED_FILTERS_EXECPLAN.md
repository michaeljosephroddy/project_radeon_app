# Wire the Discover screen advanced filters end-to-end

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Right now the Discover screen exposes an advanced filter panel for gender, age range, distance, and sobriety, but only part of that state is real. The React Native screen already stores draft and applied filter values and already sends those values through the client query layer, yet the Go backend still ranks and searches users without honoring the new filter query parameters. The result is misleading UI: a Plus user can tap "Apply Filters" and see a network refetch, but the returned people are unchanged because the server ignores most of the filter inputs.

After this change, the Discover screen will behave honestly and observably. A user will be able to open Discover, set supported advanced filters, tap Apply, and see the returned people change to match those constraints. The implementation is intentionally phased. Distance and sobriety can become real immediately because the backend already stores the data needed to filter on those values. Gender and age require new user profile fields that do not exist today, so this plan includes the schema, profile, and API work needed to make those filters truthful instead of decorative.

## Progress

- [x] (2026-04-26 13:20Z) Inspected the existing Discover screen, query hook, API client, and backend discover endpoint across `project_radeon_app` and `project_radeon`.
- [x] (2026-04-26 13:35Z) Confirmed that the frontend already threads `gender`, `ageMin`, `ageMax`, `distanceKm`, and `sobriety` through `src/screens/main/DiscoverScreen.tsx`, `src/hooks/queries/useDiscover.ts`, `src/query/queryKeys.ts`, and `src/api/client.ts`.
- [x] (2026-04-26 13:45Z) Confirmed that the backend discover handler and store currently accept only `city`, `q`, `lat`, and `lng`, and that the cache key also omits the advanced filter values.
- [x] (2026-04-26 13:55Z) Confirmed that the current data model supports distance and sobriety filtering but does not yet persist gender or birth date for user profiles.
- [x] (2026-04-26 14:05Z) Authored this ExecPlan in `exec_plans/DISCOVERY_ADVANCED_FILTERS_EXECPLAN.md`.
- [x] (2026-04-26 14:25Z) Implemented backend support for `distance_km` and `sobriety` in `~/repos/project_radeon`, including request parsing, SQL filtering in both ranked and search discovery modes, and discover cache-key updates.
- [x] (2026-04-26 14:35Z) Implemented backend data model support for `gender` and `birth_date`, including migration `migrations/031_user_profile_identity.sql`, user read/write wiring, and validation in `PATCH /users/me`.
- [x] (2026-04-26 14:45Z) Implemented frontend profile editing support for `gender` and `birth_date` in `src/api/client.ts` and `src/screens/main/ProfileTabScreen.tsx`, including clear actions for both optional fields.
- [x] (2026-04-26 14:55Z) Tightened the Discover screen UX in `src/screens/main/DiscoverScreen.tsx` so filter state validates age ranges, supports reset, preserves filters during search, and communicates active filters clearly.
- [x] (2026-04-26 14:58Z) Added backend automated tests for advanced-filter parsing, profile persistence validation, and discover cache-key variation; verified the backend with `GOCACHE=/tmp/go-build go test ./...`.
- [x] (2026-04-26 15:00Z) Verified the frontend with `npx tsc --noEmit`.
- [ ] Validate the full flow manually in the Expo app against a running local backend.

## Surprises & Discoveries

- Observation: The frontend is farther along than the backend. The Discover screen already maintains `draftFilters` and `appliedFilters` and passes those values to the query layer.
    Evidence: `src/screens/main/DiscoverScreen.tsx` builds the `useDiscover` call with `gender`, `ageMin`, `ageMax`, `distanceKm`, and `sobriety`, and `src/api/client.ts` already serializes those values into `GET /users/discover`.

- Observation: The backend discover path still ignores all advanced filter values except the existing location coordinates used for ranking.
    Evidence: `internal/user/handler.go` parses only `city`, `q`, `lat`, and `lng`, and `internal/user/store.go` still exposes `DiscoverUsers(ctx, currentUserID, city, query string, lat, lng *float64, limit, offset int)`.

- Observation: The current backend schema appears to support only half of the planned filter set.
    Evidence: repository-wide searches in `~/repos/project_radeon` show no persisted `gender`, `date_of_birth`, `birth_date`, or `dob` fields, while sobriety data exists as `sober_since` and location data exists as `lat`, `lng`, `current_lat`, `current_lng`, and `current_city`.

- Observation: The discover cache key is already parameterized by request inputs, but not by the new filter inputs, so enabling backend filtering without changing the cache key would leak cached results across different filter combinations.
    Evidence: `internal/user/cache_store.go` keys discover results by viewer version, global version, viewer id, city, query, lat, lng, limit, and offset only.

- Observation: This environment allows editing tracked files but does not allow creating git branch refs, so the repo workflow requirement to create a feature branch could not be completed here.
    Evidence: `git switch -c discover-advanced-filters` failed in both repositories with `Unable to create ... refs/heads/discover-advanced-filters.lock: Read-only file system`.

## Decision Log

- Decision: Implement advanced filters in two functional slices instead of blocking everything on the missing profile schema.
    Rationale: Distance and sobriety can be shipped with today’s data model, giving users immediate value and reducing the size of the riskiest change. Gender and age are impossible to implement honestly without new persisted profile data, so pretending they are ready would keep the current misleading behavior.
    Date/Author: 2026-04-26 / Codex

- Decision: Keep advanced filtering on the existing `GET /users/discover` endpoint instead of introducing a second endpoint for filtered discovery.
    Rationale: The frontend already uses `GET /users/discover` for both ranked browsing and username search. Extending that existing endpoint preserves one contract and one cache namespace, and avoids splitting discovery behavior across multiple URLs.
    Date/Author: 2026-04-26 / Codex

- Decision: Use `birth_date` rather than storing a mutable integer age in the database.
    Rationale: Age changes over time and becomes wrong without scheduled maintenance. A birth date is a stable source field that can be converted into an age range at query time, which keeps filtering accurate every day without extra jobs.
    Date/Author: 2026-04-26 / Codex

- Decision: Prefer current location over older stored coordinates when distance filtering is applied.
    Rationale: The app already updates `current_lat`, `current_lng`, and `current_city` in the background. Using `COALESCE(current_lat, lat)` and `COALESCE(current_lng, lng)` aligns discovery filtering with the more current location model already used elsewhere in the backend.
    Date/Author: 2026-04-26 / Codex

- Decision: Filters should continue to apply even when the user is searching by username.
    Rationale: A search query should narrow the candidate pool by text match, not silently disable other active filters. This keeps behavior consistent and avoids the confusing current split where the filter panel is hidden during search but the query layer still carries filter state.
    Date/Author: 2026-04-26 / Codex

- Decision: Defer onboarding collection for `gender` and `birth_date` and add the new fields only to the existing profile editor in this pass.
    Rationale: The profile editor already owns user-managed identity and sobriety fields, so it is the lowest-risk place to make the new backend fields editable without widening the implementation into onboarding flow changes and new-user funnel regression risk.
    Date/Author: 2026-04-26 / Codex

## Outcomes & Retrospective

The planned implementation now exists across both repositories. The backend discover endpoint understands `gender`, `age_min`, `age_max`, `distance_km`, and `sobriety`, applies those constraints in both ranked and search discovery modes, and varies the Redis cache key by those filter values. The backend user model now persists `gender` and `birth_date`, and the frontend profile editor exposes both fields with save and clear flows. The Discover screen now validates age ranges, shows a clearer applied-filter summary, allows resets, and keeps active filters visible even while searching.

The remaining gap is manual end-to-end validation in a running Expo session against a migrated local backend. Automated verification is good: `GOCACHE=/tmp/go-build go test ./...` passed in `~/repos/project_radeon` and `npx tsc --noEmit` passed in `~/repos/project_radeon_app`. What has not been observed yet in this sandbox is the live mobile interaction against a real local database with migrated schema and representative user data.

## Context and Orientation

This work spans two repositories that already talk to each other over HTTP.

The frontend repository is `~/repos/project_radeon_app`. It is a React Native / Expo application. The Discover screen lives in `src/screens/main/DiscoverScreen.tsx`. That file owns the filter panel, search state, ranked grid, and the call into `useDiscover`. The query hook lives in `src/hooks/queries/useDiscover.ts`. The network request for discovery lives in `src/api/client.ts` as `discoverUsers`. The TanStack Query cache key lives in `src/query/queryKeys.ts`.

The backend repository is `~/repos/project_radeon`. It is a Go API. The discover HTTP route is handled by `internal/user/handler.go`, which reads query parameters from `GET /users/discover` and calls a database-facing interface named `Querier`. The PostgreSQL-backed implementation of that interface lives in `internal/user/store.go`. The Redis cache decorator for user reads lives in `internal/user/cache_store.go`.

A “query key” in the frontend is the stable array that TanStack Query uses to decide whether two requests are the same cached request. A “cache key” in the backend is the Redis string that identifies one cached discover result. Both keys must vary when filter inputs vary, or one user’s filtered request will incorrectly reuse another request’s cached result.

The current state is:

- `src/screens/main/DiscoverScreen.tsx` already keeps `draftFilters` and `appliedFilters` for gender, age range, distance, and sobriety.
- `src/hooks/queries/useDiscover.ts` and `src/api/client.ts` already thread those filter values into the discover request.
- `internal/user/handler.go` does not parse those values yet.
- `internal/user/store.go` does not accept those values yet.
- `internal/user/cache_store.go` does not vary its Redis key by those values yet.
- The backend has `sober_since` and location data, but no persisted `gender` or `birth_date` fields.

That means the frontend already looks more complete than the backend really is. The plan below closes that honesty gap first, then fills in the missing data model so every visible filter corresponds to actual filtering logic.

## Plan of Work

The implementation should proceed in four milestones. Each milestone is independently verifiable and leaves the app in a better state than before.

### Milestone 1 — Make the currently supported filters real on the backend

The goal of this milestone is to make at least part of the advanced filter UI truthful immediately. Work in `~/repos/project_radeon/internal/user/handler.go`, `internal/user/store.go`, `internal/user/cache_store.go`, `internal/user/handler_test.go`, and `internal/user/cache_store_test.go`.

First, define a small request-shape struct or explicit parameter list that includes `distance_km` and `sobriety` in addition to the current discover inputs. A stable name such as `DiscoverUsersParams` is preferable because the current positional parameter list is already getting unwieldy. The `Querier` interface in `internal/user/handler.go` and all implementations of `DiscoverUsers` should be updated to accept that structure instead of the current loose list of arguments.

In the HTTP handler, parse `distance_km` as an integer and `sobriety` as one of the frontend values already emitted by the app: `30+ days`, `90+ days`, `1+ year`, and `5+ years`. Reject malformed numeric input with `400 Bad Request` only if the parameter is present but not parseable. Absent parameters should retain today’s behavior.

In the store implementation, keep the current two-mode behavior: when `q` is present, the code uses username search ordering; when `q` is absent, the code uses ranked discovery ordering. In both modes, add filtering clauses for sobriety and distance. Sobriety should map to minimum days-sober thresholds computed from `sober_since`. Distance should be based on the user’s latest known coordinates using `COALESCE(current_lat, lat)` and `COALESCE(current_lng, lng)`. If the viewer lacks coordinates and a positive `distance_km` filter is requested, the safest behavior is to return users without applying the distance constraint and to rely on the frontend copy to make “Anywhere” explicit when distance is zero. Do not silently exclude everyone because the viewer declined location permission.

In `internal/user/cache_store.go`, add the new filter values to the Redis key for discover results. The key must vary by sobriety, distance, and any future filter fields added in milestone 2. This is not optional; otherwise cached responses will be wrong as soon as the backend starts honoring those query parameters.

This milestone is complete when a user can set Distance and Sobriety in the app, apply the filters, and observe different results for meaningfully different filter combinations.

### Milestone 2 — Add the missing data model for gender and age

The goal of this milestone is to make the remaining two advanced filters honest by creating the missing persisted profile fields and letting the app edit them.

In `~/repos/project_radeon`, add a new migration that introduces two user columns: `gender` and `birth_date`. `gender` should be a text field constrained at the application layer to the values the product supports today: `woman`, `man`, and `non_binary`. `birth_date` should be a SQL `date`. Keep both columns nullable so existing users remain valid and the rollout is additive.

Extend the backend user model in `internal/user/handler.go` so `GET /users/me` and `GET /users/{id}` return these fields. Update `internal/user/store.go` to select them and `UpdateUser` to persist them. The `PATCH /users/me` request body parsing in `internal/user/handler.go` should accept optional `gender` and `birth_date` values, validate them, and allow clearing them by sending an empty string when that is consistent with the rest of the profile-update contract.

In `~/repos/project_radeon_app/src/api/client.ts`, extend the `User` interface to include the new fields and extend the profile update path to send them. Then add editing affordances in `src/screens/main/ProfileTabScreen.tsx`. The profile screen is already the canonical place where users edit sobriety, bio, interests, and location. Gender and birth date should be added there rather than creating a new top-level profile editor.

If onboarding for new users should collect these values immediately, update the relevant onboarding step files under `src/screens/onboarding/`. If product wants to avoid onboarding churn for now, defer onboarding collection and rely on profile editing instead. The implementation should record whichever path is chosen in the plan’s `Decision Log` while the work is happening.

This milestone is complete when a user can save gender and birth date in the app, refresh the session, and still see the saved values coming back from `GET /users/me`.

### Milestone 3 — Wire gender and age filtering into discovery

Once milestone 2 has landed, extend the same discover request structure and SQL queries to support `gender`, `age_min`, and `age_max`.

In the handler, parse `gender`, `age_min`, and `age_max`. Normalize `gender` from the frontend display labels to the backend stored values. The frontend currently displays `Women`, `Men`, and `Non-binary`; the backend should store canonical lowercase identifiers such as `woman`, `man`, and `non_binary`. Age bounds should be parsed as integers and validated so `age_min <= age_max` when both are present.

In `internal/user/store.go`, convert age bounds into birth-date constraints instead of calculating raw ages in Go and filtering in memory. The filtering belongs in SQL so pagination and ordering continue to operate on the correct candidate set. Use SQL expressions based on `CURRENT_DATE` and `birth_date` so age ranges are accurate at query time.

Update `internal/user/cache_store.go` again so the Redis discover key includes gender, age minimum, and age maximum. Update tests to prove that two otherwise identical discover requests with different age or gender filters produce different cache keys and independent cached values.

This milestone is complete when a user can save profile gender and birth date, return to Discover, apply gender and age filters, and observe the result set narrow in a way that matches the saved data.

### Milestone 4 — Tighten the Discover screen UX around the now-real filters

The final milestone is frontend-only polish to remove ambiguity and make the feature obvious to users.

In `src/screens/main/DiscoverScreen.tsx`, replace the static subtitle text `Gender · Age · Distance · Sobriety` with a summary derived from the existing `getFiltersSummary` helper so the collapsed filter bar reflects the currently applied values. Add a clear or reset action inside the filter panel that restores the default values. Validate the age inputs before applying them so impossible ranges do not trigger a server request. If validation fails, show `Alert.alert` at the call site because this is a user-triggered action.

The current screen hides the whole filter panel when a search query is active. Keep that behavior if it is still visually cleaner, but show a compact “Filters active” summary above search results whenever non-default filters are applied so users understand that search is still constrained. If product prefers search to disable advanced filters entirely, then clear that state explicitly when search begins. Do not leave the current half-state where search hides the controls but the hook still carries previous applied filters invisibly.

Keep the existing Plus gating logic around the filter application button unless product decides otherwise. The current behavior in `src/screens/main/DiscoverScreen.tsx` only shows the upgrade sheet when a non-Plus user taps Apply. If that remains, disabled-state or locked-copy polish can be deferred. What matters for this plan is that Plus users get truthful filtering and non-Plus users are not led to believe filters are active when they are not.

This milestone is complete when the collapsed filter bar, search mode, and empty states all accurately reflect which constraints are active.

## Concrete Steps

The commands below are split by repository. Run each command from the stated working directory.

For the backend repository at `/home/michaelroddy/repos/project_radeon`, inspect the current discover path before editing:

    pwd
    rg -n "DiscoverUsers|discoverRanked|discoverBySearch|/users/discover" internal/user
    sed -n '378,420p' internal/user/handler.go
    sed -n '180,320p' internal/user/store.go
    sed -n '112,150p' internal/user/cache_store.go

After milestone 1 or milestone 3 changes, run:

    GOCACHE=/tmp/go-build go test ./...

Expect all tests to pass. Add targeted handler and cache-store tests if they do not already exist for the new parsing and key behavior.

If a database migration is added in milestone 2, start the backend in the usual local development way for this repository and apply the migration using the project’s existing migration workflow. This repository does not document a single migration command in the files reviewed during planning, so the implementation must follow the same local migration process already used by the project. Record the exact command in this ExecPlan when it is executed so a future contributor does not have to rediscover it.

For the frontend repository at `/home/michaelroddy/repos/project_radeon_app`, inspect the existing Discover screen and profile editor before editing:

    pwd
    sed -n '230,470p' src/screens/main/DiscoverScreen.tsx
    sed -n '1,120p' src/hooks/queries/useDiscover.ts
    sed -n '415,442p' src/api/client.ts
    rg -n "sobriety|ProfileTabScreen|saveSection" src/screens/main/ProfileTabScreen.tsx src/api/client.ts

After frontend changes, start the app:

    npx expo start

Then run the backend locally from `~/repos/project_radeon` and make sure `EXPO_PUBLIC_API_URL` in `/home/michaelroddy/repos/project_radeon_app/.env` points at that backend. Use a simulator or Expo Go client, sign in as a test user, and exercise the Discover screen manually.

Because this frontend repository has no dedicated test or lint command configured, manual verification is the primary acceptance path here. If implementation adds a lightweight reusable helper with unit-test coverage in an existing test setup, document that command here when it exists.

## Validation and Acceptance

Validation must prove real user-visible filtering, not just code compilation.

For milestone 1, use two test users with materially different sobriety histories and different locations. Open Discover as a Plus user, set a small distance radius and a high sobriety threshold such as `5+ years`, and confirm that users outside that radius or below that sobriety threshold disappear from the result set. Repeat with `Anywhere` and `Any` and confirm that those users return.

For milestone 2, edit the signed-in user’s profile to save gender and birth date. Refresh the user profile by backgrounding and reopening the app or by signing out and back in. Confirm the saved values are still present, proving they were persisted by the backend and not just held in local component state.

For milestone 3, create or reuse users whose saved gender and age are known. As a Plus user, apply each advanced filter individually and then in combination. Confirm that:

- gender-only filters exclude users outside the selected gender group,
- age-only filters exclude users outside the selected age range,
- combined filters return only users that satisfy all active constraints,
- pagination still works and does not duplicate users across pages,
- search results remain constrained by active filters if the plan’s chosen search behavior is implemented.

For milestone 4, verify that the Discover screen accurately communicates active state. Collapse the filter panel and confirm the bar shows the applied summary. Trigger an invalid age range and confirm the app shows an alert instead of sending a broken request. Enter a search term with active filters and confirm the screen still indicates that filtering is active, or explicitly clears filters if that is the chosen product behavior recorded during implementation.

Backend acceptance is not complete until `GOCACHE=/tmp/go-build go test ./...` passes in `~/repos/project_radeon`. Frontend acceptance is not complete until a human can reproduce the filtering behavior in the running Expo app.

## Idempotence and Recovery

The code-editing steps in both repositories are additive and safe to repeat. Re-running `go test ./...` in the backend and restarting `npx expo start` in the frontend are safe.

The migration in milestone 2 is the only step that changes persistent state. It must be written to be additive and idempotent for existing databases. Use `ADD COLUMN IF NOT EXISTS` style SQL so local environments can retry safely. If an implementation attempt writes the wrong profile values during testing, fix them through the normal profile-editing flow instead of editing database rows manually unless the local environment is disposable.

If milestone 1 lands and milestone 2 or 3 must be delayed, the safe fallback is to keep Gender and Age visibly gated or disabled in the frontend while leaving Distance and Sobriety active. Do not roll back the truthful filters just because the profile-schema work is incomplete. If a backend cache-key bug appears, disable the cache decorator for discover reads temporarily or clear the local Redis database before re-testing, because the Redis layer is an optimization, not the source of truth.

## Artifacts and Notes

The following file locations are the critical integration seams and should remain easy to find:

    /home/michaelroddy/repos/project_radeon_app/src/screens/main/DiscoverScreen.tsx
    /home/michaelroddy/repos/project_radeon_app/src/hooks/queries/useDiscover.ts
    /home/michaelroddy/repos/project_radeon_app/src/api/client.ts
    /home/michaelroddy/repos/project_radeon_app/src/query/queryKeys.ts
    /home/michaelroddy/repos/project_radeon_app/src/screens/main/ProfileTabScreen.tsx
    /home/michaelroddy/repos/project_radeon/internal/user/handler.go
    /home/michaelroddy/repos/project_radeon/internal/user/store.go
    /home/michaelroddy/repos/project_radeon/internal/user/cache_store.go
    /home/michaelroddy/repos/project_radeon/internal/user/handler_test.go
    /home/michaelroddy/repos/project_radeon/internal/user/cache_store_test.go

The frontend filter labels and their backend meanings should be treated as a stable contract:

    "Any"          -> no constraint
    "Women"        -> backend canonical value "woman"
    "Men"          -> backend canonical value "man"
    "Non-binary"   -> backend canonical value "non_binary"
    "30+ days"     -> sober_since at least 30 days ago
    "90+ days"     -> sober_since at least 90 days ago
    "1+ year"      -> sober_since at least 365 days ago
    "5+ years"     -> sober_since at least 1825 days ago

The default discover filter state today is:

    gender: "Any"
    ageMin: ""
    ageMax: ""
    distanceKm: 50
    sobriety: "Any"

If product later decides that the default distance should be `Anywhere` instead of `50`, treat that as a separate product decision and update both the UI copy and acceptance criteria in this plan at the same time.

## Interfaces and Dependencies

At the end of milestone 1, the backend should expose a single discover request contract that can represent all supported filters even if some are still unset. A concrete Go shape such as the following is recommended in `~/repos/project_radeon/internal/user`:

    type DiscoverUsersParams struct {
        CurrentUserID uuid.UUID
        City          string
        Query         string
        Gender        string
        AgeMin        *int
        AgeMax        *int
        DistanceKm    *int
        Sobriety      string
        Lat           *float64
        Lng           *float64
        Limit         int
        Offset        int
    }

The `Querier` interface, PostgreSQL store, and cache store should all accept the same shape:

    DiscoverUsers(ctx context.Context, params DiscoverUsersParams) ([]User, error)

At the end of milestone 2, the backend `User` JSON shape and the frontend `src/api/client.ts` `User` interface should both include:

    gender?: 'woman' | 'man' | 'non_binary' | null
    birth_date?: string | null

At the end of milestone 3, the frontend discover request in `src/api/client.ts` should continue using the existing parameter names:

    gender
    age_min
    age_max
    distance_km
    sobriety

The backend must accept those exact query-string names so the existing frontend request builder remains stable.

At the end of milestone 4, `src/screens/main/DiscoverScreen.tsx` should still own local draft and applied filter state, and all network calls must still go through `src/api/client.ts` rather than calling `fetch` directly from the screen.

Revision note: updated on 2026-04-26 after implementation to record completed backend and frontend work, automated verification results, the decision to keep new identity fields in profile editing rather than onboarding, and the environment limitation that blocked feature-branch creation.
