# Recovery meetings single-query refactor

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the project root. It spans two local repositories: `/home/michaelroddy/repos/project_radeon` for the Go backend API, and `/home/michaelroddy/repos/project_radeon_app` for the Expo React Native app.

## Purpose / Big Picture

Users opening the recovery meetings screen should see nearby meetings quickly, without waiting for the phone to make several separate AA, CA, and NA requests. Users should also be able to choose any combination of fellowships, such as AA only, CA and NA together, or all three. After this change, the app asks the backend for a selected set of fellowships in one request, and the backend returns matching meetings with the existing cursor pagination.

The behavior can be seen by starting the backend and watching the request log while opening the meetings screen. The first local London load should be one request like `/recovery-meetings?fellowship=aa&fellowship=ca&fellowship=na&country=United+Kingdom&location=London&limit=20`, not three requests split by fellowship.

## Progress

- [x] (2026-05-26 17:55Z) Diagnosed the current frontend performance problem from server logs: AA and NA requests arrived at 17:35:40, CA arrived at 17:36:12, then all three repeated. Backend response times were around 30-135ms, so client request fan-out and orchestration are the immediate bottleneck.
- [x] (2026-05-26 18:00Z) Created backend branch `feature/recovery-meetings-query-refactor` in `/home/michaelroddy/repos/project_radeon`.
- [x] (2026-05-26 18:00Z) Continued frontend work on branch `fix/fast-local-recovery-meetings` in `/home/michaelroddy/repos/project_radeon_app`, with two existing uncommitted changes that will be folded into this refactor.
- [x] (2026-05-26 18:15Z) Updated backend list parameters, handler parsing, SQL generation, and tests to support multiple fellowship values in one request.
- [x] (2026-05-26 18:25Z) Updated frontend API types, query keys, recovery meeting filter state, and filter sheet to support multi-select fellowships.
- [x] (2026-05-26 18:30Z) Replaced frontend local-mixed loading with one scoped multi-fellowship request and sequential broadening only after an empty local result.
- [x] (2026-05-26 18:35Z) Ran backend Go tests and frontend TypeScript validation.

## Surprises & Discoveries

- Observation: The app was not slow because the database query was slow. It was slow because the frontend made separate fellowship requests and one request was delayed by the client stack.
    Evidence: Server logs showed `GET /recovery-meetings?fellowship=na...` in 108ms and `fellowship=aa...` in 135ms at 17:35:40, but `fellowship=ca...` did not arrive until 17:36:12.
- Observation: The backend already supports all-fellowship scoped listing when no `fellowship` filter is provided, so the refactor can be incremental. Multi-fellowship filtering is still needed for user-selected subsets such as CA+NA.
    Evidence: Existing `getRecoveryMeetings` only sets the `fellowship` query parameter when supplied, and backend SQL only applies `rm.fellowship = $n` when `params.Fellowship != ""`.

## Decision Log

- Decision: Support both repeated query parameters and comma-separated fellowship values on the backend.
    Rationale: Repeated parameters are idiomatic for arrays in URLs, while comma-separated values are convenient for React Native `URLSearchParams` and backward-compatible with a single string value.
    Date/Author: 2026-05-26 / Codex.
- Decision: Keep backend response shape as the existing `CursorPage<RecoveryMeeting>` for this pass.
    Rationale: This minimizes API risk and still solves the current speed and multi-select problem. Facets and resolved-location metadata can be added later without blocking the performance fix.
    Date/Author: 2026-05-26 / Codex.
- Decision: Use one frontend recovery meetings query for default local loading instead of the older `useLocalMixedRecoveryMeetings` client-side fan-out helper.
    Rationale: The backend owns filtering and sorting and can return all selected fellowships in a single request. Keeping client fan-out would preserve the failure mode that caused the slow load.
    Date/Author: 2026-05-26 / Codex.

## Outcomes & Retrospective

Implemented. Default local loading now uses one `/recovery-meetings` query with `fellowship=aa&fellowship=ca&fellowship=na` for the active local fallback, rather than one request per fellowship. If that local fallback returns no meetings, the screen advances to broader fallbacks sequentially, so it still avoids request fan-out. The filter sheet now supports AA, CA, NA, and any subset of those values. Backend recovery meeting tests and frontend typechecking pass.

## Context and Orientation

The backend repository is `/home/michaelroddy/repos/project_radeon`. Recovery meeting API code lives under `internal/recoverymeetings/`. `handler.go` parses HTTP query parameters into a `ListParams` struct. `types.go` defines `ListParams`. `store.go` builds the SQL query. `handler_test.go`, `store_test.go`, and `store_integration_test.go` cover parsing and query construction.

The frontend repository is `/home/michaelroddy/repos/project_radeon_app`. The API client is `src/api/client.ts`; all network calls should go through it. React Query hooks for recovery meetings are in `src/hooks/queries/useRecoveryMeetings.ts`. Query keys are in `src/query/queryKeys.ts`. The meetings screen is `src/screens/main/support/MeetingsView.tsx`. Filter state and labels live in `src/screens/main/support/recoveryMeetings.ts`. The filter modal is `src/components/support/RecoveryMeetingFilterSheet.tsx`.

“Fellowship” means the recovery program source/type of a meeting. Current values are `aa`, `ca`, and `na`. The app should default to all three, but users can choose a subset.

## Plan of Work

First, update the backend contract so `ListParams` has `Fellowships []string` instead of `Fellowship string`. Add parsing helpers in `internal/recoverymeetings/handler.go` that accept `?fellowship=aa`, `?fellowship=aa,ca,na`, and repeated `?fellowship=aa&fellowship=na`. The parser should lower-case, trim whitespace, dedupe values, and reject unknown values with a validation error. The SQL in `internal/recoverymeetings/store.go` should use `rm.fellowship = ANY($n)` when the array is non-empty. Search-query fellowship detection should append to the fellowship filter rather than conflict with explicit filters.

Second, update backend tests. Existing single-fellowship tests should still pass after replacing field names. Add tests for comma-separated and repeated fellowship params and for SQL containing `ANY` with a string slice argument.

Third, update frontend types. `src/api/client.ts` should allow `fellowship?: string | string[]`, and `getRecoveryMeetings` should serialize arrays as repeated `fellowship` params. `src/query/queryKeys.ts` should accept the same array shape. Filter state in `src/screens/main/support/recoveryMeetings.ts` should change from `fellowship: string` to `fellowships: string[]`, defaulting to an empty array for manual filters where empty means “any”.

Fourth, update `src/components/support/RecoveryMeetingFilterSheet.tsx` so fellowship chips are multi-select. “Any fellowship” should clear the list. Pressing AA, CA, or NA should toggle that value. Suggestion queries can pass the selected fellowship only when exactly one is selected; otherwise they should omit fellowship so suggestions cover the selected geography broadly.

Fifth, replace local mixed loading in `src/screens/main/support/MeetingsView.tsx` with a single `useRecoveryMeetings` call for the first local fallback, with `fellowship: ['aa', 'ca', 'na']` by default when the user has no manual fellowship selection. Keep the fallback widening local-first: try the most local fallback first, then broader region/country only if the first result is empty. Do not make one request per fellowship.

## Concrete Steps

Work in `/home/michaelroddy/repos/project_radeon` for backend changes:

    git switch feature/recovery-meetings-query-refactor
    go test ./internal/recoverymeetings

Work in `/home/michaelroddy/repos/project_radeon_app` for frontend changes:

    git switch fix/fast-local-recovery-meetings
    npm run typecheck

If broader backend package checks are affordable, run:

    GOCACHE=/tmp/go-build GOMODCACHE=/tmp/go-mod go test ./...

## Validation and Acceptance

Backend acceptance:

- `GET /recovery-meetings?fellowship=aa&fellowship=na&country=United+Kingdom&location=London&limit=20` returns only AA and NA meetings.
- `GET /recovery-meetings?fellowship=aa,ca,na&country=United+Kingdom&location=London&limit=20` returns AA, CA, and NA meetings in one response.
- Existing single-value requests such as `?fellowship=ca` still work.
- Invalid fellowship values return a validation error.

Frontend acceptance:

- Opening the meetings tab with London current location makes one local list request for all selected default fellowships, not three separate fellowship requests.
- The filter sheet lets the user select AA only, CA only, NA only, CA+NA, or all.
- `npm run typecheck` passes.

## Idempotence and Recovery

The changes are additive and can be retried safely. If backend parsing changes break tests, restore the previous single `Fellowship` field from git and reapply in smaller steps. If frontend filter state changes cause broad compile errors, first update `RecoveryMeetingFilters` and `filtersToApiParams`, then update call sites one by one with TypeScript as the guide.

## Artifacts and Notes

Important server log evidence from the slow path:

    17:35:40 GET /recovery-meetings?fellowship=na&country=United+Kingdom&location=London&limit=10 200 in 108ms
    17:35:40 GET /recovery-meetings?fellowship=aa&country=United+Kingdom&location=London&limit=10 200 in 135ms
    17:36:12 GET /recovery-meetings?fellowship=ca&country=United+Kingdom&location=London&limit=10 200 in 30ms

## Interfaces and Dependencies

Backend final interface:

    type ListParams struct {
        Query       string
        Fellowships []string
        Country     string
        Region      string
        City        string
        Location    string
        MeetingType string
        DayOfWeek   *int
        Cursor      string
        Limit       int
    }

Frontend final interface:

    export interface RecoveryMeetingFilters {
        q?: string;
        fellowship?: string | string[];
        country?: string;
        region?: string;
        city?: string;
        location?: string;
        meeting_type?: RecoveryMeetingType;
        day_of_week?: number;
    }

Plan revision note, 2026-05-26: Created the plan after diagnosing delayed client fan-out and before backend/frontend edits for the full multi-fellowship refactor.
