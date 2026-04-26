# Refine Discover filtering into a premium-quality suggestions and search experience

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` at the repository root.

This plan builds on the discovery work already described in `exec_plans/DISCOVERY_ADVANCED_FILTERS_EXECPLAN.md` and `exec_plans/DISCOVERY_SUGGESTIONS_EXECPLAN.md`, but it is self-contained and should be implementable without reading either older file.

## Purpose / Big Picture

Today the Discover tab can already show suggested users, run username search, and expose paid filters for gender, age, distance, and sobriety. The problem is that these behaviors do not yet feel like one coherent premium experience. Search hides the filter controls, filters live inside an inline accordion that competes with the results list, suggested and filtered modes share one overloaded screen component, and the UI gives very little guidance when the user applies too many constraints and runs out of inventory.

After this change, Discover will remain suggestion-led for free members while Plus members get a filter experience that feels deliberate and smooth. A user will be able to open a dedicated filter sheet, adjust premium filters without janking the results list, preview whether the filter set is too narrow, apply the filters in one action, and still receive relevant people ranked by the existing suggestions algorithm. When the filter set is too strict, the product will explain that clearly and optionally broaden the result set in a predictable, user-controlled way instead of feeling broken.

The feature is “working” only when a human can observe all of the following in a running Expo build: suggested people remain the default; search and filters can be combined; active filters are always visible and removable; filtered results still feel relevant instead of random; empty states recommend what to relax next; and the interaction remains fast on a device with a realistic amount of user data.

## Progress

- [x] (2026-04-26 15:20Z) Reviewed the current Discover implementation in `src/screens/main/DiscoverScreen.tsx`, the supporting query hook in `src/hooks/queries/useDiscover.ts`, the discover client contract in `src/api/client.ts`, and the Discover tab mounting behavior in `src/navigation/AppNavigator.tsx`.
- [x] (2026-04-26 15:30Z) Reviewed existing discovery-related ExecPlans in `exec_plans/DISCOVERY_ADVANCED_FILTERS_EXECPLAN.md` and `exec_plans/DISCOVERY_SUGGESTIONS_EXECPLAN.md` to avoid duplicating or contradicting earlier design decisions.
- [x] (2026-04-26 15:45Z) Authored this refinement ExecPlan in `exec_plans/DISCOVERY_FILTER_REFINEMENT_EXECPLAN.md`.
- [x] (2026-04-26 16:25Z) Implemented a canonical filter model in `src/hooks/useDiscoverFilters.ts`, including canonical identifiers, draft-vs-applied state helpers, chip generation, summary copy, and preview-effective filter application.
- [x] (2026-04-26 16:40Z) Split Discover into dedicated query hooks and discover UI components: `src/hooks/queries/useDiscoverResults.ts`, `src/hooks/queries/useDiscoverPreview.ts`, `src/components/discover/DiscoverFilterSheet.tsx`, `src/components/discover/DiscoverActiveFiltersBar.tsx`, and `src/components/discover/DiscoverEmptyState.tsx`.
- [x] (2026-04-26 16:55Z) Added backend preview support in `~/repos/project_radeon/internal/user`, including `GET /users/discover/preview`, interest-aware discover filtering, candidate counting, and controlled broadening metadata.
- [x] (2026-04-26 17:05Z) Rewrote `src/screens/main/DiscoverScreen.tsx` around the new filter sheet, active chip row, exact-vs-broadened UX, and separate suggested/search/filtered query identities.
- [x] (2026-04-26 17:10Z) Verified backend changes with `GOCACHE=/tmp/go-build go test ./...`.
- [x] (2026-04-26 17:12Z) Verified frontend changes with `npx tsc --noEmit`.
- [ ] Run manual Expo validation against a local backend with representative Plus and non-Plus accounts.

## Surprises & Discoveries

- Observation: The current `DiscoverScreen` is already doing too much for a paid feature that needs to be reliable and maintainable.
    Evidence: `src/screens/main/DiscoverScreen.tsx` owns search state, debounce logic, filter draft state, applied filter state, location fetch, query wiring, optimistic friend-request state, two different list layouts, and the inline filter panel in one file.

- Observation: Search and filtering are not presented as one coherent interaction even though the data layer already allows them to overlap.
    Evidence: the screen hides the filter bar when `isSearching` is true, but `useDiscover` still receives the previously applied filter state when `isFilteredView` is true.

- Observation: The current filter state is stored using display labels such as `Women` and `1+ year` instead of canonical internal identifiers.
    Evidence: `src/screens/main/DiscoverScreen.tsx` defines `GENDER_OPTIONS` and `SOBRIETY_OPTIONS` as the actual state values, then passes those strings through to `src/hooks/queries/useDiscover.ts` and `src/api/client.ts`.

- Observation: The tab mounting strategy in `src/navigation/AppNavigator.tsx` is good for preserving Discover state within a session, which means a large part of the “smoothness” problem is architectural inside Discover rather than caused by navigation unmounts.
    Evidence: `AppNavigator` keeps the Discover tab mounted behind `display: 'none'` and only gates activation via the `isActive` prop and `useLazyActivation`.

- Observation: The current free-vs-paid gate is functionally correct but weak as a premium product moment.
    Evidence: `src/screens/main/DiscoverScreen.tsx` only triggers `onOpenPlus()` when a non-Plus user presses Apply, and `src/components/PlusUpsellScreen.tsx` describes advanced filters as one bullet in a generic Plus pitch rather than as the focused value proposition of the action the user just attempted.

- Observation: The refinement goals could be met without changing the main discover list response shape.
    Evidence: the implementation now uses `GET /users/discover/preview` to compute exact counts, broadened counts, relaxed fields, and effective relaxed filters, while `GET /users/discover` remains a plain paginated list query.

## Decision Log

- Decision: Keep suggested users as the default Discover behavior for every user, including Plus members.
    Rationale: The user explicitly wants the existing suggestions algorithm to remain primary for non-subscribers, and it is also the strongest fallback when a premium user clears filters or over-filters the inventory.
    Date/Author: 2026-04-26 / Codex

- Decision: Treat advanced filtering as a refinement layer on top of the existing ranking algorithm instead of as a separate unranked search mode.
    Rationale: A paid filter experience feels broken if it returns a technically correct but poorly ordered list. Results should still be ranked by the existing relevance algorithm after the candidate set is constrained.
    Date/Author: 2026-04-26 / Codex

- Decision: Move filters out of the inline accordion and into a dedicated full-screen sheet or modal with draft state and a sticky footer.
    Rationale: The current inline panel causes layout shifts, mixes browsing with editing, and makes it difficult to show counts, locked premium affordances, and “broaden results” explanations cleanly.
    Date/Author: 2026-04-26 / Codex

- Decision: Introduce a canonical internal filter model with stable identifiers and separate presentation labels.
    Rationale: Using display copy as state creates brittle API contracts, complicates future localization, and makes refactors riskier than they need to be.
    Date/Author: 2026-04-26 / Codex

- Decision: Support a user-visible “broaden results if exact matches run low” behavior rather than silently relaxing filters.
    Rationale: Small-community discovery needs inventory protection, but a paid filter feature must remain trustworthy. Broadening should be explicit, predictable, and explainable.
    Date/Author: 2026-04-26 / Codex

- Decision: Defer saved multi-preset filters to a later release unless implementation proves the core experience is already polished.
    Rationale: Presets are attractive but not essential. The more urgent problems are interaction smoothness, result quality, transparency, and performance.
    Date/Author: 2026-04-26 / Codex

- Decision: Keep `GET /users/discover` as a paginated list endpoint and move broadening metadata to `GET /users/discover/preview`.
    Rationale: This kept the existing discover list contract stable while still giving the app enough information to preview exact counts, explain broadened results, and apply backend-approved relaxed filters transparently.
    Date/Author: 2026-04-26 / Codex

## Outcomes & Retrospective

The refinement implementation now exists across both repositories. The app has a canonical filter model, a dedicated filter sheet, active filter chips, split suggested/search/filtered query identities, and explicit broadened-result messaging. The backend now supports preview counts, effective broadened filters, and interest-aware discover filtering without changing the main paginated discover response contract.

The remaining gap is manual device validation. Automated verification is complete for the current sandbox: `GOCACHE=/tmp/go-build go test ./...` passed in `~/repos/project_radeon`, and `npx tsc --noEmit` passed in `~/repos/project_radeon_app`. What has not been observed yet is the full touch interaction in a running Expo session against representative data.

## Context and Orientation

This plan spans both the React Native app in `/home/michaelroddy/repos/project_radeon_app` and the Go backend in `/home/michaelroddy/repos/project_radeon`, because a smooth premium filtering experience depends on both client architecture and server behavior.

In the app repository, the current Discover implementation lives primarily in `src/screens/main/DiscoverScreen.tsx`. That file currently:

- stores search text, filter draft values, filter applied values, and view mode;
- rounds device coordinates and passes them into the discover query;
- renders one inline filter bar and panel;
- renders a search result list when the user is searching;
- renders a two-column card grid otherwise;
- keeps optimistic friend-request state locally.

Supporting files are:

- `src/hooks/queries/useDiscover.ts`, which currently exposes one infinite-query hook for every Discover mode;
- `src/api/client.ts`, which serializes discover request parameters and defines the `User` type returned by the backend;
- `src/query/queryKeys.ts` and `src/query/queryPolicies.ts`, which define the React Query cache identity and retention rules for discover requests;
- `src/navigation/AppNavigator.tsx`, which keeps the Discover tab mounted during tab switching and owns the Plus upsell overlay;
- `src/components/PlusUpsellScreen.tsx`, which is the current generic premium upsell screen.

In the backend repository, the discover ranking logic and filtering logic live under `internal/user/`. The older advanced-filter work already established that discovery filters and suggestion ranking belong on the main discover endpoint rather than on a disconnected second API. This refinement plan keeps that principle, but it adds response metadata and inventory-aware behavior so the UI can explain the results instead of just showing a list.

A “draft filter” in this plan means the not-yet-applied values a user edits in the filter sheet. An “applied filter” means the committed filter set currently affecting the discover query and result list. A “preview count” means a lightweight backend response that estimates how many results a draft filter set would produce before the user taps Apply. A “broadened result” means a result that comes from a controlled relaxation rule because exact matches were too scarce. Broadening is optional and user-visible, not a silent change to what the user asked for.

The current pain points that this plan addresses are:

- the filter editor competes with the results list instead of feeling like its own task;
- the screen mixes suggested browsing, search, and filtering in one large component;
- the result list goes straight from “loaded” to “empty” without enough explanation or recovery;
- the state model uses display strings as logic values;
- the paid upgrade moment is generic instead of contextual;
- there is no explicit contract for exact matching vs broadened matching.

## Plan of Work

The implementation should proceed in four milestones. Each milestone leaves the codebase in a valid, testable state and narrows one class of risk at a time.

### Milestone 1 — Freeze the product contract and data contract before rewriting the screen

The goal of this milestone is to stop the current feature from drifting and to make both repositories agree on a stable contract before the UI is split apart.

In the app repository, define a canonical filter model in a new file such as `src/hooks/useDiscoverFilters.ts` or `src/screens/main/discover/filters.ts`. The exact path may vary, but the model must not remain embedded in `DiscoverScreen.tsx`. It should define:

- the internal filter shape,
- default values,
- field validation,
- conversion between internal values and API query params,
- chip labels and summary copy,
- whether a given filter should be treated as exact-only or broadenable.

Do not use presentation copy such as `Women` or `1+ year` as the canonical values. Use stable identifiers such as `women`, `men`, `non_binary`, `days_30`, `days_90`, `years_1`, and `years_5`, then map those to labels in one place.

In the backend repository, define a discover request contract and a discover response metadata contract that can express:

- applied filters,
- whether the response is exact or broadened,
- which filters were relaxed if broadening occurred,
- optional total or approximate count metadata,
- optional reasons for an empty result set.

The recommended shape is to keep `GET /users/discover` for paginated results and add a lightweight preview endpoint such as `GET /users/discover/preview` or `POST /users/discover/preview` that returns counts and relaxation hints for a draft filter set. The preview endpoint should never return the full user list. It exists so the filter sheet can say `Show 42 people` or `No exact matches; broaden to see 18 close matches` without thrashing the main results query.

This milestone should also define which filters are in scope for the first polished release. The recommended first-release set is:

- gender,
- age range,
- distance,
- sobriety milestone,
- shared interests.

Interests are already present on the `User` type in `src/api/client.ts`, which makes them a strong candidate for a premium filter that feels socially relevant in this app. Do not add weaker “nice to have” filters such as presets, zodiac, or lifestyle trivia until the first-release interaction is excellent.

Milestone 1 is complete when both repositories have a written and coded source of truth for filter identifiers, defaults, query serialization, response metadata, and first-release filter scope.

### Milestone 2 — Replace the inline panel with a dedicated filter sheet and split Discover into focused units

The goal of this milestone is to make Discover easier to reason about and remove the biggest source of UI awkwardness: the inline accordion.

Create focused components under `src/components/` and focused hooks under `src/hooks/`. A recommended split is:

- `src/components/discover/DiscoverFilterSheet.tsx`
- `src/components/discover/DiscoverActiveFiltersBar.tsx`
- `src/components/discover/DiscoverResultsHeader.tsx`
- `src/components/discover/DiscoverEmptyState.tsx`
- `src/hooks/useDiscoverFilters.ts`
- `src/hooks/queries/useDiscoverResults.ts`
- `src/hooks/queries/useDiscoverPreview.ts`

The exact filenames may vary, but each file should do one job. `DiscoverScreen.tsx` should shrink into a container that wires navigation callbacks, auth state, and the selected Discover mode together. The current filter chips, summary helpers, and debounce logic should move out of the screen unless a helper is truly trivial.

The new Discover top area should behave as follows:

- The search bar remains visible at the top of the tab.
- A filter button sits beside or inside the top area and always remains accessible, even when search text is present.
- If any filters are applied, a horizontal active-filter chip row appears beneath the search area. Each chip can be removed individually without reopening the sheet.
- The active chip row should show both paid filters and any global mode toggle such as `Exact only` or `Broaden if low`.

The filter editor should open as a full-screen sheet or modal. It should contain:

- a clear title,
- sections grouped by filter type,
- short helper copy when a filter can reduce inventory sharply,
- a sticky footer with `Reset`, a primary action, and premium lock treatment for non-Plus users.

Draft changes in the sheet must not immediately rewrite the main results query. The sheet owns draft state. The main screen owns applied state. The only exceptions are local preview queries and local validation feedback.

For non-Plus users, allow the sheet to open so the premium value is visible. The fields should be readable and interactive enough to explain the capability, but the commit action should become a contextual upgrade action rather than pretending filters have been applied. The current generic Plus pitch in `src/components/PlusUpsellScreen.tsx` should be extended or replaced with copy that specifically references discover filtering.

Milestone 2 is complete when `DiscoverScreen.tsx` no longer contains the bulk of the filter UI, search and filters are visibly compatible, and a non-Plus user encountering the sheet gets a clear premium explanation tied to the action they attempted.

### Milestone 3 — Make results inventory-aware with preview counts, exact matching, and controlled broadening

The goal of this milestone is to make premium filters feel both trustworthy and practical on a social graph that may not always have huge local inventory.

Implement the preview query in both repositories. When the filter sheet is open and the draft state is valid, the app should make a debounced preview request and show one of three footer states:

- `Show 42 people`
- `No exact matches`
- `No exact matches; show 18 close matches`

The preview request should be lightweight. It should return counts and optional relaxation hints, not the user list. Debounce it around 250 to 400 milliseconds and do not call it while the draft state is invalid.

Define exact matching vs broadened matching as a first-class product rule. The recommended behavior is:

- exact matching remains the source of truth for filter correctness;
- the sheet includes a toggle such as `Broaden results if exact matches run low`;
- when that toggle is on and the exact match count falls below a backend-defined threshold, the backend may relax only the fields marked as broadenable;
- the backend must return metadata describing that broadening occurred and which dimensions were relaxed.

For the first polished release, the recommended broadening order is:

1. distance,
2. age range,
3. shared interests,
4. sobriety.

Gender should remain exact if selected. Shared interests should be broadened by reducing the minimum overlap requirement rather than by ignoring all interests immediately. Sobriety broadening must be conservative because it is sensitive in this product context.

When broadened results are shown, the main screen must say so explicitly in the results header or banner. The user should be able to switch back to exact-only results with one tap. Empty states should explain the narrowest likely constraint and offer a direct next action such as `Increase distance`, `Widen age range`, or `Clear sobriety filter`.

The backend must continue to rank any surviving candidates by the existing suggestions algorithm. Filtering chooses the candidate pool; ranking still decides order. Do not degrade the premium experience into a mere database filter sort.

Milestone 3 is complete when the filter sheet can preview result viability, the main result list can show exact or broadened states transparently, and over-filtering no longer dead-ends the user without explanation.

### Milestone 4 — Tune caching, list rendering, and verification until the interaction stays smooth

The goal of this milestone is to protect the experience under real user behavior instead of declaring victory after the layout compiles.

Replace the single overloaded discover query path with a clearer query structure. The recommended key split is:

- suggested results,
- search results,
- filtered results,
- filter preview metadata.

The implementation can still share one low-level API function if that remains clean, but the cache identities and UI states must not all collapse into one ambiguous query. Suggested results should remain warm in cache when a user opens and closes the filter sheet. Applying filters should not destroy or refetch the base suggested cache unnecessarily.

In the app, preserve previous visible results during filter apply and show inline progress treatment instead of dropping to a full-screen spinner. For example, keep the existing list visible while the next applied result set is loading, dim the header, and show a compact activity indicator. The only time a full-screen loading state is acceptable is the first-ever Discover load with no cached content.

Tune `FlatList` intentionally. The grid cards in Discover already have deterministic sizes, which means the implementation should consider `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `removeClippedSubviews`, and a stable `getItemLayout` or row-height strategy where practical. Avoid speculative tuning that cannot be observed, but do not leave the defaults untouched if they produce jank.

Memoize the result card components only after the architecture split makes prop boundaries clear. The current `DiscoverCard` and `SearchResultRow` are good candidates once their props stop changing because of unrelated screen state. Keep optimistic friend-request state out of the giant screen component if it is causing broad re-renders; a dedicated mutation hook or a small local result-state adapter is acceptable.

Manual verification for this milestone must happen on both a fast desktop simulator and at least one slower or more constrained device profile. The product claim here is smoothness, so this milestone is not complete until a human has observed scroll stability, filter apply responsiveness, and clear state recovery from over-filtering.

Milestone 4 is complete when the user can repeatedly open the filter sheet, change draft filters, preview counts, apply filters, clear individual chips, search within filtered results, and return to suggested mode without jarring list resets or confusing state changes.

## Concrete Steps

Run the commands below from the app repository unless another repository is explicitly named.

Before starting implementation, inspect the current Discover state:

    cd /home/michaelroddy/repos/project_radeon_app
    sed -n '1,260p' src/screens/main/DiscoverScreen.tsx
    sed -n '261,760p' src/screens/main/DiscoverScreen.tsx
    sed -n '1,120p' src/hooks/queries/useDiscover.ts
    sed -n '1,80p' src/query/queryKeys.ts
    sed -n '1,120p' src/components/PlusUpsellScreen.tsx
    sed -n '1,220p' src/navigation/AppNavigator.tsx

Review the older discovery plans for historical context:

    cd /home/michaelroddy/repos/project_radeon_app
    sed -n '1,220p' exec_plans/DISCOVERY_ADVANCED_FILTERS_EXECPLAN.md
    sed -n '1,220p' exec_plans/DISCOVERY_SUGGESTIONS_EXECPLAN.md

Inspect the backend discovery contract before adding preview metadata or broadening logic:

    cd /home/michaelroddy/repos/project_radeon
    rg -n "DiscoverUsers|discover|preview|sobriety|distance" internal/user
    sed -n '1,260p' internal/user/handler.go
    sed -n '1,320p' internal/user/store.go
    sed -n '1,220p' internal/user/cache_store.go

During implementation, keep the ExecPlan updated after every milestone or meaningful scope decision.

After each frontend milestone, verify the TypeScript surface:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

After each backend milestone, run the backend test suite:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build go test ./...

For manual app verification:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

Point `EXPO_PUBLIC_API_URL` in `/home/michaelroddy/repos/project_radeon_app/.env` at the running local backend. Sign in as a Plus test user and a non-Plus test user. Use seeded accounts with deliberately different age, gender, city, sobriety, and interests so the filter interactions are obvious during testing.

## Validation and Acceptance

Acceptance must be behavior-based and observed in the running app, not inferred from code.

For milestone 1, acceptance is that one canonical filter model exists in code and both repositories agree on filter identifiers, preview semantics, and response metadata. This is partly a code review milestone: there should be one obvious place to see defaults, API serialization, and chip labels rather than rediscovering them across the screen.

For milestone 2, acceptance is:

- the Discover screen still opens normally and suggested results remain the default;
- the inline accordion no longer shifts the results list;
- the filter editor opens as a dedicated sheet or modal;
- active filters remain visible after the sheet closes;
- non-Plus users can understand what the premium feature does without being misled into thinking it is active.

For milestone 3, acceptance is:

- the filter sheet can show a preview count or a clear “no exact matches” message for valid draft states;
- exact-only results and broadened results are clearly distinguished;
- a user can recover from over-filtering with one or two obvious actions;
- filtered results are still ordered by relevance rather than by arbitrary field order;
- search can be combined with active filters without hiding that those filters are active.

For milestone 4, acceptance is:

- first load may show a full-screen spinner, but subsequent filter applies do not blank the entire screen;
- suggested results remain cached when switching into and out of filtered mode;
- repeated open-edit-apply-clear cycles do not produce visible flicker or scroll-position bugs;
- card scrolling remains smooth in both grid and search-list layouts;
- `npx tsc --noEmit` passes in the app repository;
- `GOCACHE=/tmp/go-build go test ./...` passes in the backend repository.

One recommended manual acceptance script is:

1. Sign in as a Plus user and open Discover. Confirm the header reads as a suggestion-led experience and shows unfiltered suggested people.
2. Open filters, set `Women`, `25-35`, `Within 25 km`, and `90+ days`. Confirm the footer previews a nonzero exact count.
3. Apply the filters. Confirm the result header indicates filtered results, active chips appear, and the list does not blank entirely while loading.
4. Add a search term. Confirm the search list still shows the active chips and still reflects the applied filters.
5. Over-filter intentionally until the preview says there are no exact matches. Turn on broadening if it is off. Confirm the app explains the broadened state instead of silently showing a different result set.
6. Remove one chip directly from the active chip row. Confirm the results update without reopening the sheet.
7. Clear all filters and confirm the user returns to the base suggested experience without stale filtered banners.
8. Repeat the flow as a non-Plus user and confirm the commit action routes to a contextual upgrade moment instead of pretending the filters were applied.

## Idempotence and Recovery

All planned code edits are additive refactors or endpoint extensions and should be safe to apply incrementally. The architectural split is intentionally milestone-based so the app can remain releasable after each step.

If milestone 2 lands but preview counts are not ready yet, the safe interim state is a dedicated filter sheet with draft-vs-applied state and an `Apply filters` action that does not yet show counts. Do not block the architecture cleanup on the preview endpoint.

If broadening logic proves too risky for the first pass, the safe fallback is to ship exact-only filtering with strong empty-state recovery copy and leave the broadening toggle hidden behind an internal flag until the backend behavior is trustworthy. Do not silently auto-broaden without transparent UI.

If the new filter identifiers break compatibility with older locally cached queries, clear the discover cache namespace or adjust the query keys so stale caches cannot produce mixed old/new semantics.

If a performance optimization such as `getItemLayout` proves incorrect because the effective row height is not actually fixed, remove that optimization rather than shipping incorrect scroll behavior. Smoothness matters, but correctness and stability matter more.

## Artifacts and Notes

The following app files are the primary touch points for this work:

    /home/michaelroddy/repos/project_radeon_app/src/screens/main/DiscoverScreen.tsx
    /home/michaelroddy/repos/project_radeon_app/src/hooks/queries/useDiscover.ts
    /home/michaelroddy/repos/project_radeon_app/src/api/client.ts
    /home/michaelroddy/repos/project_radeon_app/src/query/queryKeys.ts
    /home/michaelroddy/repos/project_radeon_app/src/query/queryPolicies.ts
    /home/michaelroddy/repos/project_radeon_app/src/navigation/AppNavigator.tsx
    /home/michaelroddy/repos/project_radeon_app/src/components/PlusUpsellScreen.tsx

Recommended new app files:

    /home/michaelroddy/repos/project_radeon_app/src/components/discover/DiscoverFilterSheet.tsx
    /home/michaelroddy/repos/project_radeon_app/src/components/discover/DiscoverActiveFiltersBar.tsx
    /home/michaelroddy/repos/project_radeon_app/src/components/discover/DiscoverResultsHeader.tsx
    /home/michaelroddy/repos/project_radeon_app/src/components/discover/DiscoverEmptyState.tsx
    /home/michaelroddy/repos/project_radeon_app/src/hooks/useDiscoverFilters.ts
    /home/michaelroddy/repos/project_radeon_app/src/hooks/queries/useDiscoverResults.ts
    /home/michaelroddy/repos/project_radeon_app/src/hooks/queries/useDiscoverPreview.ts

The following backend files are the primary touch points if preview metadata or broadening behavior require API work:

    /home/michaelroddy/repos/project_radeon/internal/user/handler.go
    /home/michaelroddy/repos/project_radeon/internal/user/store.go
    /home/michaelroddy/repos/project_radeon/internal/user/cache_store.go
    /home/michaelroddy/repos/project_radeon/internal/user/handler_test.go
    /home/michaelroddy/repos/project_radeon/internal/user/store_test.go
    /home/michaelroddy/repos/project_radeon/internal/user/cache_store_test.go

The current frontend values that should be replaced by canonical identifiers are:

    "Any"
    "Women"
    "Men"
    "Non-binary"
    "30+ days"
    "90+ days"
    "1+ year"
    "5+ years"

The first-release experience should preserve these user-visible labels, but they should no longer be the values that travel through the app as source-of-truth state.

## Interfaces and Dependencies

At the end of milestone 1, the app should have a canonical filter model that is stable enough to survive copy changes and future localization. A recommended TypeScript shape is:

    export interface DiscoverAppliedFilters {
        gender: 'any' | 'women' | 'men' | 'non_binary';
        ageMin: number | null;
        ageMax: number | null;
        distanceKm: number | null;
        sobriety: 'any' | 'days_30' | 'days_90' | 'years_1' | 'years_5';
        interests: string[];
        broadenIfFewExact: boolean;
    }

The draft state can remain slightly more permissive to support text entry, but the applied state should be normalized to one clear shape before it reaches the query hook.

The low-level client API in `src/api/client.ts` should define a richer discover response instead of treating every discover mode as a plain paginated list with no metadata. A recommended response shape is:

    export interface DiscoverResponse extends PaginatedResponse<User> {
        mode: 'suggested' | 'filtered' | 'search';
        exact_match_count?: number;
        broadened_match_count?: number;
        broadened: boolean;
        relaxed_filters?: Array<'distance' | 'age' | 'interests' | 'sobriety'>;
    }

The preview endpoint should return a lightweight metadata shape such as:

    export interface DiscoverPreviewResponse {
        exact_count: number;
        broadened_count?: number;
        broadened_available: boolean;
        likely_too_narrow_fields: Array<'distance' | 'age' | 'interests' | 'sobriety' | 'gender'>;
    }

In the backend repository, the discover request parser and store should converge on one explicit request structure instead of extending positional arguments indefinitely. A recommended Go shape is:

    type DiscoverQuery struct {
        ViewerID            uuid.UUID
        SearchQuery         string
        Gender              string
        AgeMin              *int
        AgeMax              *int
        DistanceKm          *int
        Sobriety            string
        InterestNames       []string
        BroadenIfFewExact   bool
        Lat                 *float64
        Lng                 *float64
        Page                int
        Limit               int
    }

The backend should expose a lightweight preview interface in addition to the main paginated discover interface. The exact function names may vary, but both should accept the same normalized discover query shape so the preview and the real results cannot drift semantically.

Do not add a new external state library for this feature. The repo’s architecture is React Context plus hooks. Keep that constraint. Do not let screens call `fetch` directly; all network access must continue to flow through `src/api/client.ts`.

Revision note: updated on 2026-04-26 after implementation to record the completed app/backend refinement work, the decision to use a dedicated preview endpoint for broadening metadata, and the current validation status.
