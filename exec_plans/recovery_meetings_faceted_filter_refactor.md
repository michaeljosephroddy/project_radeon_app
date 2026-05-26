# Recovery meetings faceted filter refactor

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in `/home/michaelroddy/repos/project_radeon_app/PLANS.md`. It spans three local repositories: `/home/michaelroddy/repos/project_radeon` for the Go backend API, `/home/michaelroddy/repos/project_radeon_app` for the Expo React Native app, and `/home/michaelroddy/repos/recovery-meeting-ingestion` for the Python ingestion pipeline that produces normalized meeting snapshots.

## Purpose / Big Picture

People using SoberSpace should be able to filter recovery meetings quickly without knowing how each fellowship source stores geography. A user should be able to choose `United States -> New York -> New York`, `Ireland -> Dublin -> Dublin`, or `United Kingdom -> London` through fast suggestions, then combine that location with AA, CA, NA, meeting mode, day, and text search. The filter experience should feel like a polished finder, not a set of fragile text boxes.

After this refactor, the app will show a production-grade meeting filter page powered by backend facet data. A "facet" is a grouped filter option with a count, such as `New York, United States - 128 meetings` or `AA - 50 meetings`. The backend will normalize raw source fields into country, region/state/county, and locality/town/city values before returning suggestions. The app will consume those normalized options and send one efficient meeting list request for the selected filters.

The behavior can be seen by starting the backend and app, opening the recovery meetings filter page, typing `ire` into country, selecting `Ireland`, typing `dub` into region, selecting `Dublin`, typing `dub` into town/city, selecting `Dublin`, and applying filters. The request should be one list query with normalized location fields and selected fellowships, and the UI should not require users to guess source-specific values like `Co. Dublin North`.

## Progress

- [x] (2026-05-26 19:05Z) Drafted this ExecPlan after diagnosing that the current filter UI is constrained by raw source geography and that a normalized backend-driven filter model is needed.
- [x] (2026-05-26 19:20Z) Created backend branch `feature/recovery-meeting-faceted-filters` and frontend branch `feature/recovery-meeting-faceted-filters`, carrying the prerequisite uncommitted recovery meeting fixes into the new feature branches.
- [x] (2026-05-26 19:28Z) Added `087_recovery_meeting_filter_places.sql`, a normalized backend place projection for recovery meeting filter options.
- [x] (2026-05-26 19:38Z) Added backend filter option types, store query, handler, route, and handler/store tests.
- [x] (2026-05-26 19:48Z) Added frontend filter option API types, API client method, query key, and React Query hook.
- [x] (2026-05-26 19:55Z) Refactored the filter sheet to use normalized country, region, and locality options from the new endpoint.
- [x] (2026-05-26 20:02Z) Applied the migration locally and validated with backend tests, a database-backed Ireland/Dublin filter option test, and app typecheck.
- [x] (2026-05-26 20:08Z) Extracted recovery meeting filter orchestration from `MeetingsView.tsx` into `useRecoveryMeetingFilters.ts`.

## Surprises & Discoveries

- Observation: The imported recovery meeting data is present but geography is not consistently shaped across countries and sources.
    Evidence: In the local database, `Ireland / IE` has 1422 active meetings, but most Irish rows have blank `region`; rows such as `Co. Dublin North` and `Co. Dublin South` were stored in `city`.

- Observation: Clean country/region/city records exist and must not be broken by normalization.
    Evidence: The user explicitly called out `country=United States`, `region=New York`, `city=New York` as the expected normal model. The refactor must preserve this clean path and only repair messy source rows where fields are blank or misplaced.

- Observation: The current frontend blocks valid city/town lookup when region is blank.
    Evidence: Before the latest fix, `RecoveryMeetingFilterSheet.tsx` required `selectedCountryValue.length > 0 && selectedRegionValue.length > 0` before city/town suggestions were enabled, so country-only rows could not reach town/city suggestions.

- Observation: The current backend can list meetings by text filters but suggestion endpoints still expose too much raw storage shape.
    Evidence: Location suggestions can return raw source-like values unless the SQL derives a normalized place. The better long-term solution is a dedicated normalized filter projection rather than repeating complex expressions across every query.

## Decision Log

- Decision: Build a backend-owned normalized place model instead of making the frontend infer countries, regions, and cities.
    Rationale: The frontend should not encode world geography rules or source cleanup logic. The backend owns the imported data and can normalize it once, index it, and serve the same interpretation to list queries and filter suggestions.
    Date/Author: 2026-05-26 / Codex.

- Decision: Keep the existing `/recovery-meetings` list endpoint as the result source, but add a new filter option endpoint for the redesigned filter page.
    Rationale: The list endpoint already supports cursor pagination and meeting filters. A separate filter option endpoint keeps suggestion payloads small and avoids changing the paginated meeting response shape.
    Date/Author: 2026-05-26 / Codex.

- Decision: Use `locality` as the backend term for town/city in the normalized model.
    Rationale: "City" is too narrow globally. `locality` can represent town, city, village, borough, or source-level place while the app can label it as "Town / city" for clarity.
    Date/Author: 2026-05-26 / Codex.

- Decision: Preserve normal clean rows exactly where possible.
    Rationale: A row already stored as `United States / New York / New York` should not be changed into a special derived form. Normalization should fill gaps and clean known prefixes, not degrade correct data.
    Date/Author: 2026-05-26 / Codex.

## Outcomes & Retrospective

Implemented for the first faceted-filter milestone. The backend now exposes `GET /recovery-meetings/filter-options`, backed by a normalized `recovery_meeting_filter_places` view. The app filter sheet now gets country, region/state/county, and town/city suggestions from that endpoint and keeps selected country/region metadata in filter state. Filter orchestration now lives in `useRecoveryMeetingFilters.ts`, so `MeetingsView.tsx` is focused on local place resolution and list rendering. The implementation preserves the existing paginated `/recovery-meetings` list endpoint and old suggestion endpoints. Validation passed with backend package tests, frontend typecheck, local migration application, and a database-backed Ireland/Dublin filter option acceptance test.

## Context and Orientation

The backend repository is `/home/michaelroddy/repos/project_radeon`. Recovery meeting code lives in `internal/recoverymeetings/`. The route handlers are in `internal/recoverymeetings/handler.go`, shared response/data types are in `internal/recoverymeetings/types.go`, and PostgreSQL queries are in `internal/recoverymeetings/store.go`. Migrations live in `migrations/`. The backend uses PostgreSQL and the `pgx` driver.

The app repository is `/home/michaelroddy/repos/project_radeon_app`. All network calls go through `src/api/client.ts`. React Query hooks for recovery meetings live in `src/hooks/queries/useRecoveryMeetings.ts`. Query keys live in `src/query/queryKeys.ts`. The recovery meetings screen is `src/screens/main/support/MeetingsView.tsx`. The current filter modal is `src/components/support/RecoveryMeetingFilterSheet.tsx`. Filter state helpers are in `src/screens/main/support/recoveryMeetings.ts`.

The ingestion repository is `/home/michaelroddy/repos/recovery-meeting-ingestion`. It normalizes external AA, CA, and NA data before backend import. Its code may be updated later so future snapshots contain cleaner geography, but this plan must not require a complete re-import before the app improves. The backend should work against the current database by deriving normalized places at query time or through a migration-backed projection.

"Normalized place" in this plan means a consistent interpretation of a meeting's location:

- `country` is the country display name, such as `United States`, `Ireland`, or `United Kingdom`.
- `country_code` is the ISO-style country code where available, such as `US`, `IE`, or `GB`.
- `region` is the state, province, county, administrative area, or broad area inside a country, such as `New York`, `Dublin`, or `England`.
- `region_code` is the source or standardized code for that region where available.
- `locality` is the town/city/local place, such as `New York`, `Dublin`, `London`, `Portlaoise`, or `Carlow`.

The current working tree has uncommitted recovery meeting changes in both backend and app repositories. This plan assumes those changes are either committed first or carefully folded in. The important existing direction is: the list endpoint supports multiple fellowship query parameters, and the app no longer needs to fan out AA/CA/NA list requests.

## Plan of Work

First, create a normalized place projection in the backend. The recommended implementation is a database view or materialized view named `recovery_meeting_filter_places`. A normal view is simpler and always current; a materialized view can be faster but requires refresh after imports. Start with a normal view unless profiling proves it too slow. Add a migration such as `migrations/087_recovery_meeting_filter_places.sql`.

The view should select from active `recovery_meetings` and expose one row per meeting with normalized location columns. Use existing clean fields first. If `region` is non-empty, keep it. If `region` is empty and `city` looks like an administrative area, derive region from city by removing prefixes such as `Co.`, `County`, `State`, `Province`, `Prov.`, `Region`, `Prefecture`, or `Department`, and by dropping trailing direction words such as `North`, `South`, `East`, or `West` when they are source subdivisions rather than the core place. For example, `Co. Dublin North` should derive `region=Dublin` and `locality=Dublin`; `Co. Carlow` should derive `region=Carlow` and `locality=Carlow`. If the row is clean, such as `country=United States`, `region=New York`, `city=New York`, then normalized fields should remain `United States`, `New York`, `New York`.

The view should include `meeting_id`, `fellowship`, `meeting_type`, `country`, `country_code`, `region`, `region_code`, `locality`, and a `search_text` value built from normalized country, region, locality, raw city, raw region, venue, address, and postal code. Add indexes if using a materialized view; if using a normal view, ensure underlying table indexes are adequate and add expression or trigram indexes where needed. The current migrations already include some trigram indexes; verify whether new normalized expressions need additional indexes or whether the data size is still acceptable.

Second, add backend types and endpoints for filter options. Add types in `internal/recoverymeetings/types.go`:

    type FilterOptionLevel string

    const (
        FilterOptionLevelCountry  FilterOptionLevel = "country"
        FilterOptionLevelRegion   FilterOptionLevel = "region"
        FilterOptionLevelLocality FilterOptionLevel = "locality"
    )

    type FilterOption struct {
        Label        string  `json:"label"`
        Level        string  `json:"level"`
        Country      *string `json:"country,omitempty"`
        CountryCode  *string `json:"country_code,omitempty"`
        Region       *string `json:"region,omitempty"`
        RegionCode   *string `json:"region_code,omitempty"`
        Locality     *string `json:"locality,omitempty"`
        MeetingCount int     `json:"meeting_count"`
    }

    type FilterOptionsParams struct {
        Level       FilterOptionLevel
        Query       string
        Fellowships []string
        Country     string
        Region      string
        Limit       int
    }

Add `ListFilterOptions(ctx context.Context, params FilterOptionsParams) ([]FilterOption, error)` to the `Querier` interface in `internal/recoverymeetings/store.go`. Add a handler method in `internal/recoverymeetings/handler.go` for `GET /recovery-meetings/filter-options`. It should accept `level=country|region|locality`, `q`, repeated or comma-separated `fellowship`, optional `country`, optional `region`, and `limit`. It should reuse the same fellowship parser as the list endpoint so invalid fellowships are rejected consistently. It should return an empty list for a query shorter than two characters. It should cap the limit at 15.

Third, implement store queries against the normalized place projection. Country options should group by normalized country and country code and rank exact matches first, prefix matches second, then count descending. Region options should require a country and group by normalized region within that country. Locality options should require a country and optionally use region when present. It should not require region; this keeps countries with blank or messy regions searchable. Locality matching should search normalized locality and `search_text`, but results should group by normalized locality, region, and country.

The endpoint should support examples:

    GET /recovery-meetings/filter-options?level=country&q=ire
    GET /recovery-meetings/filter-options?level=region&country=Ireland&q=dub
    GET /recovery-meetings/filter-options?level=locality&country=Ireland&region=Dublin&q=dub
    GET /recovery-meetings/filter-options?level=region&country=United+States&q=new
    GET /recovery-meetings/filter-options?level=locality&country=United+States&region=New+York&q=new

Fourth, keep existing suggestion endpoints compatible during migration. The current app uses `/recovery-meetings/countries`, `/recovery-meetings/regions`, and `/recovery-meetings/locations`. They can remain as wrappers around the new store logic or stay in place temporarily. The final app should use the new endpoint, but the old endpoints should not break existing builds until the next app release is known to be deployed.

Fifth, add backend tests. In `internal/recoverymeetings/handler_test.go`, add tests for parsing `filter-options` level, fellowship arrays, invalid level, invalid fellowship, short query returning an empty list, and country-required behavior for region/locality. In `internal/recoverymeetings/store_test.go`, add tests that inspect SQL or helper output for normalized admin-area derivation. In `internal/recoverymeetings/store_integration_test.go`, add opt-in database tests behind `RECOVERY_MEETINGS_DB_TEST=1` for:

- `country q=ire` returns `Ireland`.
- `region country=Ireland q=dub` returns `Dublin`.
- `locality country=Ireland region=Dublin q=dub` returns `Dublin`.
- `region country=United States q=new` returns `New York` if the dev database contains those rows; if not, use a stable existing United States region from the database and document the observed value in this plan.
- `locality country=United Kingdom q=lon` returns `London` if the dev database contains London rows.

Sixth, update the app API client. In `src/api/client.ts`, define:

    export type RecoveryMeetingFilterOptionLevel = 'country' | 'region' | 'locality';

    export interface RecoveryMeetingFilterOption {
        label: string;
        level: RecoveryMeetingFilterOptionLevel;
        country?: string | null;
        country_code?: string | null;
        region?: string | null;
        region_code?: string | null;
        locality?: string | null;
        meeting_count: number;
    }

    export interface RecoveryMeetingFilterOptionParams {
        level: RecoveryMeetingFilterOptionLevel;
        q: string;
        fellowship?: string | string[];
        country?: string;
        region?: string;
        limit?: number;
    }

Add `getRecoveryMeetingFilterOptions(params: RecoveryMeetingFilterOptionParams): Promise<RecoveryMeetingFilterOption[]>`. Serialize fellowship arrays exactly like `getRecoveryMeetings`, using repeated `fellowship` parameters.

Seventh, add React Query support. In `src/query/queryKeys.ts`, add `recoveryMeetingFilterOptions(params)` and in `src/hooks/queries/useRecoveryMeetings.ts`, add `useRecoveryMeetingFilterOptions(params, enabled)`. Use a 10-minute stale time, a two-character minimum query, and a default limit of 10. The hook should be disabled unless the filter sheet is open and the required parent fields are present. For locality, require country but not region.

Eighth, refactor app filter state into a small hook. Create `src/hooks/useRecoveryMeetingFilters.ts` or, if local ownership is preferred, keep it under `src/screens/main/support/useRecoveryMeetingFilters.ts`. The hook should own `draftFilters`, `appliedFilters`, search debounce, active chip generation, apply/reset/remove actions, and conversion to API params. Keep shared data types in `src/screens/main/support/recoveryMeetings.ts` unless they are API response types, which belong in `src/api/client.ts`. This removes filter orchestration from `MeetingsView.tsx` and makes the screen focus on loading and rendering results.

Ninth, redesign `RecoveryMeetingFilterSheet.tsx`. Keep it as a full-screen modal, but organize it into predictable sections:

- A compact header with back/close, title, and reset.
- Fellowship multi-select chips for AA, CA, NA.
- A location picker section with three stacked searchable rows: Country, Region / state / county, Town / city. Country is first. Region is optional. Town/city is enabled once country is present. Each row shows suggestions with meeting counts and selected state. Suggestions come from the new `filter-options` endpoint.
- Meeting mode segmented chips: Any, In person, Online, Hybrid, Phone.
- Day chips: Any, Sun through Sat. Keep single-select until backend supports arrays.
- Footer with Apply button and a small result-context line such as `Filtering AA + NA meetings near New York`.

Do not use a landing-page style or explanatory text. This is an operational filter surface. Keep spacing tight, use existing design tokens from `src/theme`, and keep cards out of cards. Use `StyleSheet.create` and existing UI primitives such as `ScreenHeader`, `TextField`, and `PrimaryButton`.

Tenth, update `MeetingsView.tsx` to use the new hook and active filter summary. The screen should continue to make one `useRecoveryMeetings` query for applied filters. Local default loading should still use device location and selected/default fellowships. Manual filters should always override device-derived defaults. Active chips should display compact values such as `New York`, `AA + NA`, `In person`, and `Saturday`; tapping a chip removes it.

Eleventh, ensure performance. Backend filter option queries should not scan more than needed for each keystroke. Use grouped normalized columns and existing active-status predicates. If a normal view proves slow in `EXPLAIN ANALYZE`, promote it to a materialized view with indexes and refresh it after meeting imports. The materialized view refresh can initially be manual or called from the import completion path; document the chosen approach in this plan's Decision Log if changed.

## Concrete Steps

Before implementation, create or switch to dedicated branches. From `/home/michaelroddy/repos/project_radeon`:

    git switch -c feature/recovery-meeting-faceted-filters

If the branch already exists, use:

    git switch feature/recovery-meeting-faceted-filters

From `/home/michaelroddy/repos/project_radeon_app`:

    git switch -c feature/recovery-meeting-faceted-filters

If the branch already exists, use:

    git switch feature/recovery-meeting-faceted-filters

If the current multi-fellowship/location fixes are still uncommitted when this plan is implemented, commit or intentionally carry them first. Do not overwrite those changes; they are prerequisites for this refactor.

Backend implementation steps:

1. Add migration `migrations/087_recovery_meeting_filter_places.sql` in `/home/michaelroddy/repos/project_radeon`.
2. Add `FilterOption`, `FilterOptionsParams`, and level constants to `internal/recoverymeetings/types.go`.
3. Extend `Querier` in `internal/recoverymeetings/store.go` with `ListFilterOptions`.
4. Implement `ListFilterOptions` in `internal/recoverymeetings/store.go`.
5. Add `ListFilterOptions` handler in `internal/recoverymeetings/handler.go`.
6. Register the route in `cmd/api/main.go` beside the existing recovery meeting suggestion routes.
7. Add handler, store, and opt-in database tests.
8. Run:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build GOMODCACHE=/tmp/go-mod go test ./internal/recoverymeetings

If a local database is available:

    cd /home/michaelroddy/repos/project_radeon
    set -a; . ./.env; set +a
    RECOVERY_MEETINGS_DB_TEST=1 GOCACHE=/tmp/go-build GOMODCACHE=/tmp/go-mod go test ./internal/recoverymeetings -run TestPgStoreRecoveryMeetingFilterOptions

Frontend implementation steps:

1. Add filter option types and `getRecoveryMeetingFilterOptions` to `src/api/client.ts`.
2. Add the query key to `src/query/queryKeys.ts`.
3. Add `useRecoveryMeetingFilterOptions` to `src/hooks/queries/useRecoveryMeetings.ts`.
4. Extract filter orchestration into `src/screens/main/support/useRecoveryMeetingFilters.ts` or `src/hooks/useRecoveryMeetingFilters.ts`.
5. Refactor `src/components/support/RecoveryMeetingFilterSheet.tsx` around the new location picker and filter option hook.
6. Update `src/screens/main/support/MeetingsView.tsx` to use the hook and keep one list query.
7. Bump the React Query persistence cache buster in `App.tsx`, for example to `client-cache-v6-faceted-meeting-filters`.
8. Run:

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck

## Validation and Acceptance

Backend acceptance:

- `GET /recovery-meetings/filter-options?level=country&q=ire&limit=10` returns an option with `country: "Ireland"` and a positive `meeting_count`.
- `GET /recovery-meetings/filter-options?level=region&country=Ireland&q=dub&limit=10` returns an option with `region: "Dublin"`.
- `GET /recovery-meetings/filter-options?level=locality&country=Ireland&region=Dublin&q=dub&limit=10` returns an option with `locality: "Dublin"` and `region: "Dublin"`.
- `GET /recovery-meetings/filter-options?level=region&country=United+States&q=new&limit=10` returns `New York` when the local database has New York meetings.
- Invalid level values return a validation error instead of a server error.
- Invalid fellowship values return the same validation style as `/recovery-meetings`.
- `GOCACHE=/tmp/go-build GOMODCACHE=/tmp/go-mod go test ./internal/recoverymeetings` passes.

Frontend acceptance:

- Opening the filter page does not fetch all filter options upfront. It fetches only when the user types at least two characters in an open picker.
- Typing `ire` shows `Ireland`.
- Selecting Ireland and typing `dub` in region shows `Dublin`.
- Selecting Dublin and typing `dub` in town/city shows `Dublin`.
- Typing `uni` shows `United States` and `United Kingdom` if both exist in the backend data.
- Selecting `United States`, `New York`, `New York`, then applying filters produces one meetings query with `country=United States`, `region=New York`, and `location=New York`.
- Selecting AA and NA produces repeated fellowship query params on the list request.
- `npm run typecheck` passes.

End-to-end manual verification:

1. Start the backend from `/home/michaelroddy/repos/project_radeon` using the project's normal command.
2. Start the app from `/home/michaelroddy/repos/project_radeon_app` with `npx expo start`.
3. Open the recovery meetings tab.
4. Open filters.
5. Search and apply `Ireland -> Dublin -> Dublin`.
6. Confirm the list shows matching meetings and the backend log shows one `/recovery-meetings` list request for the applied filters.
7. Repeat with `United States -> New York -> New York`.

## Idempotence and Recovery

The migration should use `CREATE VIEW IF NOT EXISTS` or `CREATE MATERIALIZED VIEW IF NOT EXISTS` only if the SQL is stable. If the projection definition changes during development, use `CREATE OR REPLACE VIEW` for a normal view. For a materialized view, write a migration that drops and recreates the view only if safe for development, or create a new versioned view name and switch the code after validation.

All backend query changes should be additive until the new endpoint is tested. Keep old suggestion endpoints working during the frontend migration. If the new endpoint fails, the app can temporarily continue using the old endpoints.

All frontend changes should keep network calls inside `src/api/client.ts`. If the filter hook refactor becomes too large, first add the new endpoint and hook, then replace one picker at a time. Do not remove current filter behavior until the new country, region, and locality pickers compile and pass typecheck.

If database-backed tests fail because the local database lacks a specific country/region example, inspect the local data with:

    cd /home/michaelroddy/repos/project_radeon
    set -a; . ./.env; set +a
    psql "$DATABASE_URL" -c "SELECT country, region, city, COUNT(*) FROM recovery_meetings WHERE status = 'active' GROUP BY country, region, city ORDER BY COUNT(*) DESC LIMIT 50;"

Then update the opt-in test to use a stable example from the available dataset and record that discovery in this plan.

## Artifacts and Notes

Important data-shape examples observed before this plan:

    Ireland / IE active meetings: 1422
    Most Ireland rows had blank region.
    Example raw city values:
      Co. Dublin North
      Co. Dublin South
      Co. Galway
      Co. Carlow

Expected normalized examples:

    Raw: country=Ireland, region='', city='Co. Dublin North'
    Normalized: country=Ireland, region=Dublin, locality=Dublin

    Raw: country=Ireland, region='', city='Co. Carlow'
    Normalized: country=Ireland, region=Carlow, locality=Carlow

    Raw: country=United States, region=New York, city=New York
    Normalized: country=United States, region=New York, locality=New York

    Raw: country=United Kingdom, region='', city=London
    Normalized: country=United Kingdom, region='', locality=London

This plan intentionally avoids making the app responsible for geography cleanup. If the app receives `label: "Dublin, Ireland"` and structured fields `{ country: "Ireland", region: "Dublin", locality: "Dublin" }`, it should render and apply them without trying to re-parse the label.

## Interfaces and Dependencies

Backend endpoint:

    GET /recovery-meetings/filter-options

Query parameters:

    level: country | region | locality
    q: string
    fellowship: optional repeated or comma-separated aa | ca | na
    country: optional for country, required for region and locality
    region: optional for locality
    limit: optional, default 10, maximum 15

Backend response envelope follows the existing API convention:

    {
      "data": [
        {
          "label": "Dublin, Ireland",
          "level": "region",
          "country": "Ireland",
          "country_code": "IE",
          "region": "Dublin",
          "region_code": null,
          "locality": null,
          "meeting_count": 52
        }
      ]
    }

Frontend API additions in `src/api/client.ts`:

    export type RecoveryMeetingFilterOptionLevel = 'country' | 'region' | 'locality';

    export interface RecoveryMeetingFilterOption {
        label: string;
        level: RecoveryMeetingFilterOptionLevel;
        country?: string | null;
        country_code?: string | null;
        region?: string | null;
        region_code?: string | null;
        locality?: string | null;
        meeting_count: number;
    }

    export interface RecoveryMeetingFilterOptionParams {
        level: RecoveryMeetingFilterOptionLevel;
        q: string;
        fellowship?: string | string[];
        country?: string;
        region?: string;
        limit?: number;
    }

    export async function getRecoveryMeetingFilterOptions(
        params: RecoveryMeetingFilterOptionParams,
    ): Promise<RecoveryMeetingFilterOption[]>

Frontend filter state should keep structured values:

    export interface RecoveryMeetingFilters {
        query: string;
        fellowships: string[];
        country: string;
        countryCode?: string | null;
        region: string;
        regionCode?: string | null;
        location: string;
        dayOfWeek: DayOfWeek | null;
        meetingType: RecoveryMeetingType | '';
    }

The existing list request API can stay:

    getRecoveryMeetings({
        fellowship: ['aa', 'na'],
        country: 'United States',
        region: 'New York',
        location: 'New York',
        meeting_type: 'in_person',
        day_of_week: 1,
        limit: 20,
    })

Plan revision note, 2026-05-26: Created this plan to capture the proposed production-grade faceted meeting filter refactor after discovering that the current UI and suggestion endpoints are too tied to raw imported geography.

Plan revision note, 2026-05-26: Updated after implementing the first milestone: normalized place view, backend filter-options endpoint, frontend filter option client/hook, filter sheet integration, and validation results.
