# Production Cache Strategy for Recovery Meetings

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` in `/home/michaelroddy/repos/project_radeon_app`. It spans two local repositories: `/home/michaelroddy/repos/project_radeon_app` for the Expo React Native frontend and `/home/michaelroddy/repos/project_radeon` for the Go backend API. The plan does not add a new server. It uses the app's existing React Query client cache and the backend's existing Redis cache abstraction in `pkg/cache`.

## Purpose / Big Picture

Recovery meetings should feel almost instant when a user opens the Meetings screen, especially for the default local AA view. Today the app has a useful frontend cache, but the backend still executes the recovery meeting database query for every cache miss, every process, and every user with the same common filters. The current frontend policy also refetches recovery meetings on mount, which can make a cached screen still feel busy and can waste backend work.

After this change, a user opening the Meetings screen should see a cached first page immediately when available, the app should only refetch when the cached meeting data is stale, and the backend should serve repeated meeting list/detail/place-autocomplete requests from Redis with safe version-based invalidation after meeting imports. The visible behavior is simple: first load and repeat loads of common meeting searches are faster, pull-to-refresh still works, and newly imported meeting data appears after the import pipeline bumps the recovery-meetings cache version.

## Progress

- [x] (2026-05-31T21:28Z) Reviewed `PLANS.md` and confirmed this plan must be self-contained and live under `exec_plans/`.
- [x] (2026-05-31T21:28Z) Confirmed the frontend currently persists `recovery-meetings` first pages in `src/query/queryPolicies.ts`, uses `staleTime` of 10 minutes in `src/hooks/queries/useRecoveryMeetings.ts`, and keeps previous pages visible with `placeholderData`.
- [x] (2026-05-31T21:28Z) Confirmed the backend already has Redis cache primitives in `pkg/cache` and existing domain cache decorators such as `internal/meetups/cache_store.go` and `internal/groups/cache_store.go`.
- [x] (2026-05-31T21:28Z) Confirmed recovery meeting backend reads currently go through `internal/recoverymeetings.NewPgStore` directly from `cmd/api/main.go`, with no recovery-meetings cache decorator yet.
- [x] (2026-05-31T21:43Z) Created backend `internal/recoverymeetings/cache_store.go` and tests for list/detail/filter/suggestion read-through caching, normalized keys, version invalidation, and cache-error fallback.
- [x] (2026-05-31T21:43Z) Wired the recovery-meetings cached store into `cmd/api/main.go`.
- [x] (2026-05-31T21:43Z) Bumped the recovery-meetings cache version after successful recovery meeting imports and after canonical place-match refreshes.
- [x] (2026-05-31T21:43Z) Added Redis read-through caching for `/places/autocomplete` in `internal/places/cache_store.go` and bumped the places cache version after committed GeoNames imports.
- [x] (2026-05-31T21:43Z) Tuned frontend recovery-meetings React Query policy so mount behavior uses cached data first and refetches only when stale.
- [x] (2026-05-31T21:43Z) Added default local AA prefetch after the authenticated user profile has `current_place_id`.
- [x] (2026-05-31T21:43Z) Validated with `GOCACHE=/tmp/go-build-cache go test ./internal/recoverymeetings ./internal/places`, `GOCACHE=/tmp/go-build-cache go test ./...`, and `npm run typecheck`.

## Surprises & Discoveries

- Observation: The frontend already has a first-page persisted cache for `recovery-meetings`, but it still refetches on mount.
    Evidence: `src/query/queryPolicies.ts` sets `persist: true`, `persistedPages: 1`, and `refetchOnMount: true` for `recovery-meetings`. `src/hooks/queries/useRecoveryMeetings.ts` uses a 10 minute stale time and passes the policy's `refetchOnMount` value to `useInfiniteQuery`.

- Observation: The backend has the cache infrastructure needed for this work, but recovery meetings are not using it yet.
    Evidence: `cmd/api/main.go` wraps users, feed, meetups, support, friends, groups, and dating stores with cached stores. Recovery meetings are registered separately with `recoverymeetings.NewPgStore(db)` and no `NewCachedStore` wrapper.

- Observation: The existing backend cache package already has the right primitives for this feature.
    Evidence: `pkg/cache/cache.go` provides `ReadThrough`, `GetVersion`, `BumpVersions`, `WithJitter`, JSON serialization, disabled-cache fallback behavior, and singleflight request coalescing.

- Observation: The meeting data changes in batch imports rather than frequent user writes.
    Evidence: recovery meeting data is updated by `cmd/import-recovery-meetings` and place matches are refreshed by `cmd/import-places -refresh-recovery-meeting-matches`. This makes version-based invalidation safer and simpler than per-row invalidation for the first production cache pass.

- Observation: Place autocomplete fits the same cache strategy and is cheap to invalidate independently.
    Evidence: `/places/autocomplete` depends on the imported `places` table, not on per-user state. The implementation added a separate places cache version that is bumped after committed GeoNames imports.

- Observation: The new cache layers preserve cache-off behavior.
    Evidence: `GOCACHE=/tmp/go-build-cache go test ./...` passes without Redis environment variables. The cached stores use `pkg/cache.NewDisabled()` when no cache store is supplied and fall back to the inner store on version read errors.

## Decision Log

- Decision: Use the existing Redis-backed `pkg/cache.Store` rather than adding another cache service or application server.
    Rationale: The user does not want another server. The backend already initializes Redis for other domains when `CACHE_ENABLED` is true, and `pkg/cache.NewDisabled()` keeps local development and cache-off deployments working.
    Date/Author: 2026-05-31 / Codex.

- Decision: Cache recovery meeting reads with global version keys, not with per-meeting-list deletion.
    Rationale: Meeting data arrives through imports and match-refresh jobs. A global version included in cache keys makes invalidation cheap and reliable: bumping the version makes old list/detail/suggestion keys unreachable without scanning Redis.
    Date/Author: 2026-05-31 / Codex.

- Decision: Cache list pages by normalized request parameters, including cursor and limit.
    Rationale: Cursor-paginated list responses are only correct for the exact filter and cursor that produced them. Omitting any filter would serve the wrong page to users. The cache key must include `place_id`, fellowships, query text, country, region, location, day, meeting type, cursor, and limit. The selected-place search radius is backend-owned and is not a public cache-key input.
    Date/Author: 2026-05-31 / Codex.

- Decision: Keep frontend persistence shallow and cache-first, but do not make the app permanently offline for meetings.
    Rationale: Users should see existing meeting data immediately, but recovery meeting schedules can change. A longer stale time plus explicit pull-to-refresh gives a fast default without hiding refresh behavior.
    Date/Author: 2026-05-31 / Codex.

- Decision: Prefetch only the default local AA first page, not every fellowship or place combination.
    Rationale: The default local AA view is the highest-impact first screen. Prefetching every possible filter would waste mobile bandwidth and backend cache space.
    Date/Author: 2026-05-31 / Codex.

## Outcomes & Retrospective

The target outcome is a two-layer cache: React Query and AsyncStorage on the device for instant render, plus Redis read-through caching on the backend for repeated meeting list/detail/autocomplete requests. The backend cache must stay correct through versioned invalidation after imports. The frontend cache must stop unnecessary mount refetches and should prefetch the likely default local AA query when enough user location context exists.

Implementation is complete. The backend now has Redis read-through decorators for recovery meeting list/detail/filter/suggestion reads and place autocomplete. Recovery meeting cache keys include a manual schema, global version, normalized filters, cursor, and limit. Place autocomplete keys include a separate places version. Recovery meeting imports bump the recovery-meetings version after committed imports, place-match refreshes bump the recovery-meetings version, and GeoNames imports bump the places version.

The frontend now treats recovery meetings as cache-first on mount by setting `refetchOnMount: false`, extends the stale window to 30 minutes, preserves previous pages during refetch, and prefetches the default local AA first page when `user.current_place_id` is available. Validation passed with backend package tests, the full backend test suite, frontend typecheck, and whitespace checks.

## Context and Orientation

The frontend repository is `/home/michaelroddy/repos/project_radeon_app`. It is an Expo React Native app. All HTTP calls are centralized in `src/api/client.ts`. Recovery meeting query hooks live in `src/hooks/queries/useRecoveryMeetings.ts`. Query keys live in `src/query/queryKeys.ts`. Query persistence and trimming live in `src/query/asyncStoragePersister.ts`, `src/query/infiniteQueryPolicy.ts`, and `src/query/queryPolicies.ts`. The Meetings screen is `src/screens/main/support/MeetingsView.tsx`.

The frontend currently uses TanStack React Query. In this plan, "React Query cache" means the in-memory and persisted client-side server-state cache that stores API responses by query key. "Persisted first page" means only the first page of an infinite query is stored in AsyncStorage so app restart can render useful content without preserving unlimited scroll history. "Stale time" means how long React Query considers cached data fresh before it may refetch automatically.

The backend repository is `/home/michaelroddy/repos/project_radeon`. It is a Go API backed by PostgreSQL. Recovery meeting API code lives in `internal/recoverymeetings/`. The handler is `internal/recoverymeetings/handler.go`, the PostgreSQL store is `internal/recoverymeetings/store.go`, and shared types are `internal/recoverymeetings/types.go`. Routes are registered in `cmd/api/main.go`. Recovery meeting imports are handled by `cmd/import-recovery-meetings/main.go` and `internal/recoverymeetings/importer.go`. Canonical place-match refreshes are handled by `cmd/import-places/main.go` and `internal/places/store.go`.

The backend already has a Redis cache abstraction in `pkg/cache`. In this plan, "read-through cache" means a wrapper around the database store that first checks Redis for a JSON response. If Redis has the response, the wrapper returns it. If Redis misses, the wrapper calls the real database store, stores the result in Redis with a time-to-live, and returns the result. "Time-to-live" or "TTL" means how long a Redis key may live before expiring automatically. "Version-based invalidation" means every cache key includes an integer version from Redis; when data changes, the backend increments that version and future requests use new keys while old keys expire naturally.

Recovery meetings are mostly public/static reference data. They do not have per-user viewer decorations like membership state. That makes them good cache candidates. The main correctness risk is returning a response for the wrong filter, the wrong pagination cursor, or stale imported data after a refresh.

## Plan of Work

Begin in `/home/michaelroddy/repos/project_radeon` on the current feature branch or a new branch if this work is split out. Add a recovery-meetings cached store in a new file `internal/recoverymeetings/cache_store.go`. Follow the established shape of `internal/meetups/cache_store.go`: define TTL constants, a `cachedStore` struct with `inner Querier` and `cache appcache.Store`, a `NewCachedStore(inner Querier, store appcache.Store) Querier` constructor, and methods implementing the existing recovery meeting `Querier` interface.

The cached store must cache `ListRecoveryMeetings`, `GetRecoveryMeeting`, `ListFilterOptions`, `ListLocationSuggestions`, `ListRegionSuggestions`, and `ListCountrySuggestions`. `ListRecoveryMeetings` should use a short-to-medium TTL, initially 15 minutes. `GetRecoveryMeeting` should use a longer TTL, initially 1 hour. Filter options and old location suggestion endpoints can use 1 hour because they are derived from imported meeting data. If selected-place search depends on canonical place matches, it must share the same recovery-meetings version so a match refresh invalidates old selected-place results.

Add a global version key helper such as `recoveryMeetingsVersionKey()`. A key can be built as `cache.Key("recovery_meetings", "v")`. Every cached read must first call `GetVersion` for this key. If `GetVersion` errors, the method should fall back to the inner store rather than fail the request. The actual read cache key should include this version. For example, list keys should begin with `recovery_meetings:list:v:<version>`.

Normalize every cache-key part. Use lowercased and trimmed strings for free-text fields. Use stable sorted encoding for fellowships so `aa&ca` and `ca&aa` produce the same cache key. Encode nil UUIDs, empty cursors, empty filters, day values, and limits explicitly. Use `url.QueryEscape` or the same safe string-encoding approach used by existing cache stores. Do not concatenate raw user text into keys without escaping because spaces, colons, slashes, and unicode can make keys hard to inspect or accidentally ambiguous.

The `ListRecoveryMeetings` cache key must include at least: version, normalized query text, sorted fellowships, country, region, location, day of week, meeting type, place id, cursor, and limit. It must also include a manual key schema version such as `schema:1`, so future changes to sorting or response shape can invalidate all old list keys without waiting for TTL expiry.

The `GetRecoveryMeeting` cache key must include the global version and meeting id. If there is no user-specific data in the detail response, do not include viewer id. If a future change adds viewer-specific detail fields, update this plan and the key before implementation. For now, recovery meeting detail should remain globally cacheable.

Wire the cached store in `cmd/api/main.go` by changing recovery meeting store construction from `recoverymeetings.NewPgStore(db)` to `recoverymeetings.NewCachedStore(recoverymeetings.NewPgStore(db), cacheStore)`. Keep cache-off behavior working through `pkg/cache.NewDisabled`.

Add cache version bumping after imports. In `cmd/import-recovery-meetings/main.go`, after a successful import transaction completes and the command is not a dry run, initialize the same cache store configuration used by the API if `CACHE_ENABLED` is true, then call `BumpVersions` for the recovery meetings version key. If the command already has database-only scope and should not learn Redis configuration, add a small exported helper in `internal/recoverymeetings` such as `BumpCacheVersion(ctx context.Context, cache appcache.Store) error`. The command can call it only when cache initialization succeeds. Cache bump failure should be logged and return a non-zero exit only if the import succeeded but stale meeting data would be unacceptable for deployment. For production safety, prefer failing the command after a successful import if cache bump fails, so operators know to manually clear Redis or rerun the bump.

Also bump the recovery meetings version after canonical place-match refreshes in `cmd/import-places/main.go` when `-refresh-recovery-meeting-matches` succeeds. Selected-place meeting results can change even when the meeting rows themselves do not, because the `recovery_meeting_place_matches` table affects which meetings are returned for a place.

Add backend tests in `internal/recoverymeetings/cache_store_test.go`. Tests should use a stub `Querier` and a real disabled or fake cache store where practical. The tests must prove that repeated identical list requests call the inner store once when cache is enabled, that different fellowship order produces the same normalized key, that different cursor or limit produces a different cache entry, that cache version changes cause a miss, and that cache errors fall back to the inner store. If the existing cache package does not expose an in-memory fake, create a small test-only fake implementing `pkg/cache.Store` inside the test file.

Add a direct test for key normalization if the normalization helpers are exported or package-visible. At minimum, assert that a list with fellowships `["ca", "aa"]` and another with `["AA", "ca", "aa"]` normalize to the same fellowship component once invalid values have already been rejected by the handler. The handler already validates fellowship values; the cache layer should normalize case and ordering, not re-validate user input.

After the backend cache passes tests, tune the frontend. In `/home/michaelroddy/repos/project_radeon_app/src/query/queryPolicies.ts`, change the `recovery-meetings` policy from `refetchOnMount: true` to `refetchOnMount: false` or remove it so React Query uses staleness rather than remounts. The preferred first pass is `refetchOnMount: false` for recovery meetings only, because these rows are not social feed content and should not refetch every time the tab remounts. In `src/hooks/queries/useRecoveryMeetings.ts`, increase `RECOVERY_MEETINGS_STALE_TIME` from 10 minutes to 30 minutes unless manual product testing shows this is too stale. Keep `placeholderData: keepPreviousData`.

Add a small prefetch helper for the default local AA meetings first page. It can live in `src/hooks/queries/useRecoveryMeetings.ts` as a function such as `prefetchRecoveryMeetings(params)` or in a new hook if that fits local patterns better. It must call `queryClient.prefetchInfiniteQuery` with the exact same key shape used by `useRecoveryMeetings`. Do not duplicate query-key construction. The prefetch should only run when the user is authenticated, has `current_place_id`, and the app has enough context to build the default local query: `fellowship: ["aa"]`, `place_id: user.current_place_id`, and `limit: 20`.

Wire the prefetch near authenticated app startup, likely in `src/navigation/AppNavigator.tsx` or the first place that already sees the authenticated `user` from `useAuth`. The prefetch must be background-only and must not block navigation. It must not request GPS or reverse geocoding. It should rely only on `user.current_place_id`; if that field is absent, skip prefetch. It should not prefetch CA or NA by default.

Keep pull-to-refresh behavior on `MeetingsView.tsx`. Even if `refetchOnMount` is disabled, the user must be able to refresh manually. The `RefreshControl` already calls `recoveryMeetingsQuery.refetch()`. Preserve that behavior.

Do not add HTTP cache headers in the first implementation. Authenticated API responses and mobile React Query persistence are already controlling caching. HTTP validators such as ETags can be useful later, but they add another correctness surface and are not required for the main performance win.

## Concrete Steps

Before editing, check branch and current status in both repositories:

    cd /home/michaelroddy/repos/project_radeon_app
    git status --short --branch

    cd /home/michaelroddy/repos/project_radeon
    git status --short --branch

If this plan is implemented separately from the current location-search branch, create matching branches in both repositories:

    cd /home/michaelroddy/repos/project_radeon_app
    git switch -c feature/recovery-meetings-cache-strategy

    cd /home/michaelroddy/repos/project_radeon
    git switch -c feature/recovery-meetings-cache-strategy

Start with backend cache implementation:

    cd /home/michaelroddy/repos/project_radeon
    sed -n '1,220p' internal/recoverymeetings/handler.go
    sed -n '1,260p' internal/recoverymeetings/store.go
    sed -n '1,220p' internal/recoverymeetings/types.go
    sed -n '1,180p' internal/meetups/cache_store.go
    sed -n '1,320p' pkg/cache/cache.go

Create:

    internal/recoverymeetings/cache_store.go
    internal/recoverymeetings/cache_store_test.go

After adding cache code, wire it:

    cmd/api/main.go
    cmd/import-recovery-meetings/main.go
    cmd/import-places/main.go

Run backend tests after the cache store compiles:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache go test ./internal/recoverymeetings
    GOCACHE=/tmp/go-build-cache go test ./...

Expected successful transcript shape:

    ok  	github.com/project_radeon/api/internal/recoverymeetings	...
    ok  	github.com/project_radeon/api/internal/places	...
    ok  	github.com/project_radeon/api/internal/user	...

Then tune frontend cache behavior:

    cd /home/michaelroddy/repos/project_radeon_app
    sed -n '1,120p' src/query/queryPolicies.ts
    sed -n '1,100p' src/hooks/queries/useRecoveryMeetings.ts
    rg -n "useAuth\\(|current_place_id|prefetchInfiniteQuery|recoveryMeetings" src/navigation src/hooks src/screens

Edit:

    src/query/queryPolicies.ts
    src/hooks/queries/useRecoveryMeetings.ts
    src/navigation/AppNavigator.tsx

Run frontend validation:

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck

Expected successful transcript:

    > project-radeon@1.0.0 typecheck
    > tsc --noEmit

For manual backend verification with Redis enabled, start the backend with `CACHE_ENABLED=true` and a valid `REDIS_ADDR`, then run the same authenticated request twice. Replace `$TOKEN` and `$PLACE_ID` with real values:

    curl -H "Authorization: Bearer $TOKEN" "http://localhost:8080/recovery-meetings?fellowship=aa&place_id=$PLACE_ID&limit=20"
    curl -H "Authorization: Bearer $TOKEN" "http://localhost:8080/recovery-meetings?place_id=$PLACE_ID&fellowship=AA&limit=20"

The second request should return the same response and should show a cache hit in development logs or observability counters if those are available. If cache logging is not visible, add a temporary test-only assertion rather than leaving noisy production logs.

For manual frontend verification, start the Expo app:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

Log in with a user that has `current_place_id`, open the app, and then open Meetings. The first page should render from cache or the background prefetch if available. Leaving and reopening the Meetings screen should not refetch solely because of remount. Pull-to-refresh should still refetch.

## Validation and Acceptance

Backend acceptance requires tests proving correct cache behavior. `GOCACHE=/tmp/go-build-cache go test ./internal/recoverymeetings` must pass. The new test suite must demonstrate cache hits for identical normalized list params, cache misses for different cursors or limits, cache misses after version bump, cache fallback when Redis errors, and detail caching for `GetRecoveryMeeting`.

Backend acceptance also requires that the API still behaves when Redis is disabled. Run `GOCACHE=/tmp/go-build-cache go test ./...` with no Redis environment required. The disabled cache path must call the inner PostgreSQL store and return correct data.

Import invalidation acceptance requires a demonstrable version bump after successful imports. A future implementation should capture a short transcript from a local Redis-enabled run. The important observable result is: before bump, a repeated request can hit cache; after bump, the same request misses and reloads from the database because its cache key contains the new version.

Frontend acceptance requires `npm run typecheck` to pass. Manual app acceptance requires that Meetings renders cached content immediately when present, does not refetch on every mount, still refetches after the 30 minute stale window, and still supports pull-to-refresh.

Performance acceptance should be measured with realistic local data. For the backend, compare two identical selected-place AA first-page requests with Redis enabled. The first request may take normal database time. The second request should avoid database query work and should be substantially faster, typically single-digit milliseconds inside the backend once JSON is read from Redis. For the frontend, cached Meetings reopen should render without an empty loading state when the first page exists in AsyncStorage or memory.

Correctness acceptance is more important than raw speed. No cached response may be served for the wrong filter, wrong fellowship set, wrong cursor, or wrong selected place. If there is any ambiguity in a cache key, the implementation is not complete.

## Idempotence and Recovery

All cache implementation should be additive. If Redis is unavailable or `CACHE_ENABLED=false`, the backend must behave like it did before this plan. The cache decorator must fall back to the inner store on cache read/version errors.

Version bumps are safe to run more than once. Bumping a version only makes old keys unreachable; it does not delete data or mutate meeting rows. If an import succeeds but cache bump fails, rerun the bump command or rerun the import command after fixing Redis connectivity. Old keys will also expire by TTL, but relying on TTL alone after a production import is not acceptable for freshness.

Cache keys must include a manual schema version. If a future response shape or sorting rule changes, increment that schema component so stale Redis JSON is not decoded into the wrong assumptions.

Avoid storing unbounded list pages. Cache one cursor page per key with the requested `limit`. Do not cache a giant all-meetings response. Do not prefetch every location, fellowship, or place. The default prefetch is intentionally limited to local AA first page for a user with `current_place_id`.

If frontend prefetch causes unwanted network work during startup, disable only that prefetch path and keep the backend cache. The backend cache is still valuable for explicit Meetings opens and repeated searches.

## Artifacts and Notes

Current frontend meeting cache baseline:

    src/query/queryPolicies.ts:
    'recovery-meetings': {
        persist: true,
        persistedPages: 1,
        refetchOnMount: true,
    }

    src/hooks/queries/useRecoveryMeetings.ts:
    const RECOVERY_MEETINGS_STALE_TIME = 1000 * 60 * 10;
    placeholderData: keepPreviousData

Current backend cache baseline:

    cmd/api/main.go wraps users, feed, meetups, support, friends, groups, and dating stores with cached stores.
    Recovery meetings currently use the PostgreSQL store directly and need a `NewCachedStore` wrapper.

Existing cache primitives to reuse:

    pkg/cache.Store.ReadThrough(ctx, key, ttl, dest, loader)
    pkg/cache.Store.GetVersion(ctx, key)
    pkg/cache.Store.BumpVersions(ctx, keys...)
    pkg/cache.Store.WithJitter(ttl)

Suggested TTLs for first implementation:

    recovery meetings list page: 15 minutes
    recovery meeting detail: 1 hour
    recovery meeting filter options and legacy suggestions: 1 hour
    place autocomplete: 24 hours, if included in this plan's implementation

## Interfaces and Dependencies

In `/home/michaelroddy/repos/project_radeon/internal/recoverymeetings/cache_store.go`, define:

    func NewCachedStore(inner Querier, store appcache.Store) Querier

The returned type must implement the existing `internal/recoverymeetings.Querier` interface. It must wrap:

    ListRecoveryMeetings(ctx context.Context, params ListParams) (*CursorPage[RecoveryMeeting], error)
    ListFilterOptions(ctx context.Context, params FilterOptionsParams) ([]FilterOption, error)
    ListLocationSuggestions(ctx context.Context, params LocationSuggestionParams) ([]LocationSuggestion, error)
    ListRegionSuggestions(ctx context.Context, params RegionSuggestionParams) ([]RegionSuggestion, error)
    ListCountrySuggestions(ctx context.Context, params CountrySuggestionParams) ([]CountrySuggestion, error)
    GetRecoveryMeeting(ctx context.Context, id uuid.UUID) (*RecoveryMeeting, error)

If these signatures differ in the current working tree, use the actual interface from `internal/recoverymeetings/handler.go` or `internal/recoverymeetings/types.go` and update this section before implementing.

In `/home/michaelroddy/repos/project_radeon/internal/recoverymeetings/cache_store.go`, define package-private helpers:

    func recoveryMeetingsVersionKey(cache appcache.Store) string
    func encodeRecoveryMeetingCachePart(value string) string
    func encodeRecoveryMeetingFellowships(values []string) string
    func recoveryMeetingListCacheKey(cache appcache.Store, version int64, params ListParams) string

In `/home/michaelroddy/repos/project_radeon/internal/recoverymeetings`, expose a version bump helper if command packages need it:

    func BumpCacheVersion(ctx context.Context, store appcache.Store) error

In `/home/michaelroddy/repos/project_radeon_app/src/hooks/queries/useRecoveryMeetings.ts`, keep `useRecoveryMeetings` as the single source of list query configuration and add a prefetch helper only if it can reuse the same query key and query function. A suitable shape is:

    export function prefetchRecoveryMeetings(
        params: api.RecoveryMeetingFilters & { limit?: number },
    ): Promise<void>

If using a hook is cleaner locally, define:

    export function usePrefetchDefaultRecoveryMeetings(): void

The helper must call the same API client function, `api.getRecoveryMeetings`, and must not call `fetch` directly.

## Revision Notes

2026-05-31T21:28Z: Initial ExecPlan created to turn the recovery meetings cache discussion into an implementation-ready plan. The plan was split from the location autocomplete plan because it has a separate risk profile: cache correctness, invalidation, and startup behavior.
