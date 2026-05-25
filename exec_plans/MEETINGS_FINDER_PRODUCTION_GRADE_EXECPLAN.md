# Make the Recovery Meetings Finder Production Grade

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `PLANS.md` in this repository. It spans the React Native app in `/home/michaelroddy/repos/project_radeon_app` and the Go backend in `/home/michaelroddy/repos/project_radeon` because the user-visible finder depends on both.

## Purpose / Big Picture

People using SoberSpace should be able to find real AA, CA, and NA meetings without knowing the exact spelling used by the imported source. A user who filters for CA meetings in Ireland, Carlow, in person should see the two Carlow CA meetings currently imported from the CA Ireland source. The current finder is connected to the imported database, but the backend requires exact city equality, so `city=Carlow` misses records stored as `city=Co. Carlow`.

When this plan is complete, the finder will behave like a polished production search surface: forgiving location matching, clear filters, useful empty states, reliable backend tests, and acceptance checks that prove known source examples such as Carlow continue to work.

The next phase uses device coordinates only to infer a human place name. The app must reverse-geocode the user into a town or city, region, and country, then search recovery meetings by those text fields. It must not send longitude and latitude to the recovery meetings API for default ordering in this phase, because the imported AA and CA rows currently have text locations but no coordinates.

## Progress

- [x] (2026-05-25 13:24Z) Confirmed the SoberSpace app is connected to the recovery meetings endpoint through `src/api/client.ts`, `src/screens/main/support/MeetingsView.tsx`, and `src/components/support/RecoveryMeetingFilterSheet.tsx`.
- [x] (2026-05-25 13:24Z) Confirmed the backend endpoint is registered in `/home/michaelroddy/repos/project_radeon/cmd/api/main.go` and queries `recovery_meetings` through `/home/michaelroddy/repos/project_radeon/internal/recoverymeetings/store.go`.
- [x] (2026-05-25 13:24Z) Reproduced the Carlow issue against the imported database: exact filters return zero rows, while relaxed location matching returns two active CA Carlow rows.
- [x] (2026-05-25 14:36Z) Implemented backend `location` matching with legacy `city` fallback, matching city, region, venue, address lines, and postal code.
- [x] (2026-05-25 14:36Z) Expanded backend `q` search to include region, address lines, and postal code.
- [x] (2026-05-25 14:36Z) Replaced recovery meeting offset pagination with opaque keyset cursors ordered by next listed occurrence, meeting name, and id.
- [x] (2026-05-25 14:36Z) Added `083_recovery_meeting_finder_indexes.sql` for active structured filters and trigram search indexes.
- [x] (2026-05-25 14:36Z) Added backend tests for location query construction, legacy city fallback, keyset cursor predicates, handler parsing, and an opt-in database-backed Carlow acceptance case.
- [x] (2026-05-25 14:36Z) Improved the app filter model so users search a single location field instead of needing exact city and country text fields.
- [x] (2026-05-25 14:36Z) Polished empty states and active chips so users can clear location, clear mode, or reset all filters from the no-results state.
- [x] (2026-05-25 14:36Z) Ran backend and app validation and recorded the exact outputs in this plan.
- [x] (2026-05-25 15:10Z) Added recovery meeting location and country suggestion endpoints, modeled on meetup suggestions.
- [x] (2026-05-25 15:10Z) Added app API functions and React Query hooks for recovery meeting location and country suggestions.
- [x] (2026-05-25 15:10Z) Updated the meeting filter sheet so location and country fields debounce and suggest partial matches after two characters.
- [x] (2026-05-25 15:10Z) Removed unimported SMART and LifeRing fellowship chips from the meetings finder.
- [x] (2026-05-25 15:10Z) Replaced the meeting detail alert with a dedicated `RecoveryMeetingDetailScreen` opened through `AppNavigator`.
- [x] (2026-05-25 15:10Z) Refactored the meeting card toward the meetup card pattern and moved long connection details to the detail screen.
- [x] (2026-05-25 15:10Z) Fixed the meeting mode chip gap by using a full-width "Any mode" chip and equal-width mode chips.
- [x] (2026-05-25 14:02Z) Replanned the initial-local-results phase to use reverse-geocoded town, region, and country text rather than backend longitude/latitude distance ranking.
- [x] (2026-05-25 14:02Z) Added app-side local place inference to the meetings finder using `getDeviceCoords` and reverse geocoding.
- [x] (2026-05-25 14:02Z) Added town/region/country fallback logic that broadens local default results only when the narrower local query returns no rows.
- [x] (2026-05-25 14:02Z) Refactored meeting cards so mode, day, time/timezone, address, and online/phone credentials are displayed consistently.
- [x] (2026-05-25 14:02Z) Tightened the meeting detail page into a polished meeting profile with clear schedule, location, and connection sections.
- [x] (2026-05-25 14:02Z) Ran `npm run typecheck`, `GOCACHE=/tmp/go-build-cache go test ./...`, and the database-backed recovery meeting Carlow/suggestion acceptance tests.
- [x] (2026-05-25 14:17Z) Fixed typed search so one-character queries do not refetch, search uses a calmer 500ms debounce, previous results stay visible while a new search loads, and backend query search tokenizes multi-term input such as `na portlaoise ireland`.
- [x] (2026-05-25 14:25Z) Changed the unfiltered initial local feed to fetch AA, CA, and NA separately through the inferred city/region/country fallbacks, then interleave results so one fellowship does not dominate the first page. Normal filtered/search mode takes over as soon as the user applies filters or starts typing search text.
- [x] (2026-05-25 14:28Z) Tightened the local mixed fallback so country/global rows are not used to force AA/CA/NA mixture when at least one fellowship has city/region-local results. This prevents London from showing broad United Kingdom AA/NA rows as if they were nearby.

## Surprises & Discoveries

- Observation: The data is present in both the exported snapshot and the SoberSpace database.
    Evidence: The latest snapshot contains two `C.A. Carlow` meetings with `meeting_type=in_person`, `country=Ireland`, and `city=Co. Carlow`. The database query returned the same two rows.

- Observation: The production miss is caused by exact city equality, not by missing CA data or a broken app integration.
    Evidence: In the database, the exact filter `country=ireland`, `city=carlow`, `meeting_type=in_person`, `fellowship=ca` returned `0`, while a relaxed Carlow match returned `2`.

- Observation: The current app UI encourages exact city/country entry.
    Evidence: `RecoveryMeetingFilterSheet.tsx` has separate free-text `Country` and `City` fields, and `recoveryMeetings.ts` sends those values directly as API `country` and `city` parameters.

- Observation: Go tests need a writable build cache in this sandbox.
    Evidence: `go test ./internal/recoverymeetings` initially failed with `open /home/michaelroddy/.cache/go-build/...: read-only file system`; rerunning with `GOCACHE=/tmp/go-build-cache` passed.

- Observation: The local SoberSpace database accepted the new finder index migration.
    Evidence: `go run ./cmd/migrate up` applied `083_recovery_meeting_finder_indexes.sql`; `migrate status` then showed it as applied.

- Observation: The existing meetup suggestion flow was a good implementation model for recovery meetings.
    Evidence: `MeetupFilterSheet.tsx` already debounces location text after 250ms, calls a React Query suggestion hook, and renders themed suggestion rows. The recovery meeting filter now follows that same interaction pattern.

- Observation: The app database cannot support production-quality coordinate distance ranking for AA and CA yet.
    Evidence: On 2026-05-25, `recovery_meetings` had `aa total=96583 geocoded=0`, `ca total=2575 geocoded=0`, and `na total=74325 geocoded=15051`.

- Observation: The top search field was not production-grade for natural multi-term searches.
    Evidence: Before the fix, current backend search matched `carlow=8`, `london=145`, `portlaoise=9`, `c.a. carlow=2`, but `na portlaoise ireland=0` because the whole phrase was treated as one substring.

- Observation: London currently exposes data-quality and fallback-accuracy limits.
    Evidence: `London + United Kingdom` has 8 CA rows, but no AA or NA rows. `United Kingdom` has 1 AA, 728 CA, and 25 NA rows. Some real-looking London AA rows are imported from a Polish source with `country=Poland`, `region=Wielka Brytania`, and London in the address, so text-only country filtering excludes them from `London + United Kingdom`.

## Decision Log

- Decision: Fix the immediate miss in the backend first, then polish the app experience.
    Rationale: The backend is the source of truth. If API matching remains exact, app polish can still produce empty results for valid user intent.
    Date/Author: 2026-05-25 / Codex

- Decision: Treat the existing `city` request parameter as a forgiving location token for now rather than adding a new endpoint before the bug fix.
    Rationale: The app already sends `city`, existing clients keep working, and the backend can immediately match `Carlow` against `Co. Carlow`, venue, address, region, or postal code. A later milestone can add a richer `location` parameter and suggestions.
    Date/Author: 2026-05-25 / Codex

- Decision: Keep `country` exact but case-insensitive in the first backend fix.
    Rationale: Country exact matching reduces broad accidental matches, while the observed failure is in city/county formatting. A later country alias layer can map `IE`, `Ireland`, and `Republic of Ireland`.
    Date/Author: 2026-05-25 / Codex

- Decision: Add a first-class `location` query parameter while preserving `city` as a fallback alias.
    Rationale: `location` describes the user intent better than `city`, and the fallback keeps existing clients and cached app builds compatible.
    Date/Author: 2026-05-25 / Codex

- Decision: Use keyset pagination instead of offset pagination for the recovery meeting finder.
    Rationale: Offset scans get slower as result sets grow. Keyset cursors keep paging stable and efficient while preserving the existing opaque `next_cursor` response field.
    Date/Author: 2026-05-25 / Codex

- Decision: Add separate location and country suggestion endpoints.
    Rationale: Users type both fields independently, and countries need different grouping/ranking than city-style locations. Separate endpoints keep queries small and the UI predictable.
    Date/Author: 2026-05-25 / Codex

- Decision: Open recovery meeting details in a full screen overlay, not an alert.
    Rationale: Alerts cannot present schedule, address, source, formats, and connection details cleanly. A detail screen matches the meetup interaction model and leaves list cards dense.
    Date/Author: 2026-05-25 / Codex

- Decision: Use device coordinates only to derive town, region, and country text for the initial default results.
    Rationale: The user explicitly asked not to use longitude/latitude for ranking in this phase, and the current imported AA/CA meeting rows have text place data but no coordinates. Reverse-geocoded place filters can make local default results useful immediately while preserving the existing backend search model.
    Date/Author: 2026-05-25 / Codex

- Decision: Do not let inferred local filters override manual user location or country filters.
    Rationale: Device-derived place is only a default. Once the user types or selects a location/country, their explicit search intent should control the API query.
    Date/Author: 2026-05-25 / Codex

- Decision: Tokenize typed recovery meeting search and detect fellowship words or initials in the backend.
    Rationale: Users naturally type intent phrases such as `na portlaoise ireland`, where `na` is fellowship and the remaining words can match different meeting fields. Treating the whole query as one substring misses valid rows.
    Date/Author: 2026-05-25 / Codex

- Decision: Require at least two characters before the app applies a typed search query.
    Rationale: One-character searches cause noisy refetches and usually have poor intent. The finder should feel calm while typing and only search once there is a meaningful token.
    Date/Author: 2026-05-25 / Codex

- Decision: Build the default local feed as an app-side fellowship fan-out before adding a backend mixed-feed endpoint.
    Rationale: The existing `/recovery-meetings` endpoint can already filter by fellowship and place text. Fetching AA, CA, and NA independently lets the app show a balanced local first page now, while keeping explicit user search and filters on the normal endpoint path.
    Date/Author: 2026-05-25 / Codex

- Decision: Do not broaden missing fellowships to country/global if another fellowship has city/region-local results.
    Rationale: A local feed should prioritize accuracy over forced mixture. Showing countrywide AA or NA rows beside true London CA rows makes the default feed feel inaccurate.
    Date/Author: 2026-05-25 / Codex

## Outcomes & Retrospective

Implementation is complete for the search-first production finder milestone and the first polish pass. The backend now supports forgiving `location` search, legacy `city` fallback, richer `q` search, keyset cursor pagination, finder indexes, and partial-match suggestions for locations and countries. The app now sends `location`, shows a single location field with suggestions, labels active location chips clearly, provides no-results recovery actions, opens meetings into a detail screen, and keeps list cards clean.

The place-based local default phase is also complete. The app now reverse-geocodes device coordinates into city, region, and country text, applies that as a default only when the user has not manually searched a place, broadens from city to region to country to global results when local results are empty, and shows a subtle local status in the finder header. Cards now consistently show mode, day, time/timezone, location, address, and concise connection details. The detail page now presents schedule, location, connection, format, and source information with clearer hierarchy and actions.

## Context and Orientation

The backend repository `/home/michaelroddy/repos/project_radeon` is a Go REST API. Recovery meetings are stored in PostgreSQL tables created by `migrations/082_recovery_meetings.sql`. The route `GET /recovery-meetings` is protected by authentication and is registered in `cmd/api/main.go`. The handler in `internal/recoverymeetings/handler.go` parses query parameters such as `fellowship`, `country`, `city`, `meeting_type`, `day_of_week`, and `q`. The store in `internal/recoverymeetings/store.go` builds the SQL query.

The app repository `/home/michaelroddy/repos/project_radeon_app` is an Expo React Native app. The API client function `getRecoveryMeetings` in `src/api/client.ts` calls `/recovery-meetings`. The user-facing meeting list is `src/screens/main/support/MeetingsView.tsx`. The filter modal is `src/components/support/RecoveryMeetingFilterSheet.tsx`. Filter helpers live in `src/screens/main/support/recoveryMeetings.ts`.

The term "forgiving location matching" in this plan means that a user-entered place such as `Carlow` should match a row stored as `Co. Carlow`, and should also match venue, address, region, or postal code text when those are the only fields carrying the place name.

## Plan of Work

First, update the backend query in `internal/recoverymeetings/store.go`. Replace the exact city comparison with a location predicate that checks `rm.city`, `rm.region`, `rm.venue_name`, `rm.address_line1`, `rm.address_line2`, and `rm.postal_code` using `ILIKE`. Keep all user input parameterized. Expand the free-text `q` predicate to include address, region, and postal code so the search bar behaves consistently with the location filter. This is complete.

Second, add focused backend coverage. The existing handler tests only verify parsing. Add a small pure helper for building the location predicate if that is the cleanest way to test query behavior without requiring a live database. Add an opt-in database test for the imported Carlow records behind `RECOVERY_MEETINGS_DB_TEST=1`. This is complete.

Third, update the app filter model. Replace separate `Country` and `City` mental models with a single primary `Location` text field in the filter sheet while keeping country available as a narrowing field. Send the location text through the new backend `location` parameter. This is complete.

Fourth, polish the results surface. Improve active chips so they say `Location: Carlow` rather than just `Carlow`, improve the no-results state so it offers one-tap clear or broaden actions, and keep meeting cards dense and address-forward. This is complete.

Fifth, add production readiness checks. The local validation now includes full backend tests, app typecheck, migration application, and an opt-in database-backed Carlow acceptance test. This is complete for the search-first milestone.

Sixth, add typeahead polish. The backend exposes `GET /recovery-meetings/locations` and `GET /recovery-meetings/countries`; the app consumes them from `RecoveryMeetingFilterSheet` using debounced React Query hooks. This is complete.

Seventh, add detail navigation and card polish. `RecoveryMeetingCard` now behaves like an entry row and opens `RecoveryMeetingDetailScreen` through `AppNavigator`; long credentials and source details are displayed on the detail screen instead of in the list card. This is complete.

Eighth, add place-based local default results. Extend `src/utils/location.ts` with a reverse-geocoding helper that returns `{ city, region, country }`. In `src/screens/main/support/MeetingsView.tsx`, request device coordinates when the active meetings view first opens, reverse-geocode them, and apply inferred location filters only when the user has not manually set `query`, `location`, or `country`. Try the inferred city plus country first, then region plus country, then country alone, then global fallback if each narrower query returns no rows. Show a subtle status such as `Near Carlow, Ireland` so the user understands why the initial list is local.

Ninth, standardize meeting cards and polish details. Update `src/components/support/RecoveryMeetingCard.tsx` so each card consistently shows fellowship, mode, day, time with timezone, venue/location, address, and concise online/phone credentials where present. Update `src/screens/main/support/RecoveryMeetingDetailScreen.tsx` so the profile has a cleaner hierarchy: header badges, title, schedule block, location block, connection credentials block, formats, and source details.

Tenth, harden typed search. In `/home/michaelroddy/repos/project_radeon/internal/recoverymeetings/store.go`, parse `q` into lowercase tokens, detect fellowship tokens such as `aa`, `ca`, `na`, `a.a.`, `c.a.`, `n.a.`, and recovery fellowship names, then require each remaining token to match at least one searchable field. Searchable fields include name, meeting type, city, region, country, venue, address, postal code, online URL, phone/credential text, source fields, and formats. In `/home/michaelroddy/repos/project_radeon_app/src/screens/main/support/MeetingsView.tsx`, apply typed search only after two characters and a 500ms debounce. In `/home/michaelroddy/repos/project_radeon_app/src/hooks/queries/useRecoveryMeetings.ts`, preserve previous infinite-query data while a new search query is loading.

Eleventh, balance the unfiltered local feed. In `/home/michaelroddy/repos/project_radeon_app/src/hooks/queries/useRecoveryMeetings.ts`, add `useLocalMixedRecoveryMeetings`, which queries the existing recovery meetings endpoint once per fellowship. For each fellowship it tries the reverse-geocoded city/country fallback first, then region/country, then country, then global fellowship results only if no narrower rows exist. It then interleaves AA, CA, and NA rows into one first page. In `/home/michaelroddy/repos/project_radeon_app/src/screens/main/support/MeetingsView.tsx`, enable this local mixed hook only when the user has not typed a search and has no applied fellowship, mode, day, location, or country filters. When any explicit user intent exists, use the normal `useRecoveryMeetings` path.

Twelfth, avoid inaccurate broad filler in the local mixed feed. Keep the fan-out, but split local fallbacks from broad fallbacks. First try city/region-local rows for AA, CA, and NA. If any fellowship has local rows, interleave only those local groups and leave missing fellowships out. Only if no fellowship has local rows should the hook broaden to country/global fallbacks.

## Concrete Steps

Work on the branch `meeting-finder-production-grade` in both repositories.

In `/home/michaelroddy/repos/project_radeon`, edit `internal/recoverymeetings/store.go` and add tests under `internal/recoverymeetings`. Run:

    GOCACHE=/tmp/go-build-cache go test ./internal/recoverymeetings
    GOCACHE=/tmp/go-build-cache go test ./...

To verify against the local database, run:

    set -a; . ./.env; set +a
    psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM recovery_meetings WHERE status='active' AND fellowship='ca' AND country ILIKE 'ireland' AND meeting_type='in_person' AND (city ILIKE '%carlow%' OR venue_name ILIKE '%carlow%' OR address_line1 ILIKE '%carlow%');"

The expected count before the backend fix with current exact API city matching is zero for `city=Carlow`. The expected result after the backend fix is two rows through the API for the same user-facing filter.

In `/home/michaelroddy/repos/project_radeon_app`, edit `src/screens/main/support/recoveryMeetings.ts`, `src/components/support/RecoveryMeetingFilterSheet.tsx`, and `src/screens/main/support/MeetingsView.tsx`. Run:

    npm run typecheck

Observed validation on 2026-05-25:

    GOCACHE=/tmp/go-build-cache go test ./internal/recoverymeetings
    ok  	github.com/project_radeon/api/internal/recoverymeetings	0.004s

    set -a; . ./.env; set +a; GOCACHE=/tmp/go-build-cache RECOVERY_MEETINGS_DB_TEST=1 go test ./internal/recoverymeetings -run TestPgStoreListRecoveryMeetingsFindsCarlowByLocation -count=1
    ok  	github.com/project_radeon/api/internal/recoverymeetings	0.020s

    GOCACHE=/tmp/go-build-cache go test ./...
    ok  	github.com/project_radeon/api/internal/recoverymeetings	0.008s
    all other tested backend packages passed or reported no test files

    npm run typecheck
    exited 0

Observed validation after the typeahead/detail polish on 2026-05-25:

    set -a; . ./.env; set +a; GOCACHE=/tmp/go-build-cache RECOVERY_MEETINGS_DB_TEST=1 go test ./internal/recoverymeetings -run 'TestPgStore.*(Carlow|Suggestions)' -count=1
    ok  	github.com/project_radeon/api/internal/recoverymeetings	0.053s

    GOCACHE=/tmp/go-build-cache go test ./...
    all tested backend packages passed or reported no test files

    npm run typecheck
    exited 0

Observed validation after the place-based local default and card/detail polish on 2026-05-25:

    npm run typecheck
    exited 0

    GOCACHE=/tmp/go-build-cache go test ./...
    all tested backend packages passed or reported no test files

    set -a; . ./.env; set +a; GOCACHE=/tmp/go-build-cache RECOVERY_MEETINGS_DB_TEST=1 go test ./internal/recoverymeetings -run 'TestPgStore.*(Carlow|Suggestions)' -count=1
    ok  	github.com/project_radeon/api/internal/recoverymeetings	0.044s

Observed validation after the typed search hardening on 2026-05-25:

    npm run typecheck
    exited 0

    GOCACHE=/tmp/go-build-cache go test ./internal/recoverymeetings
    ok  	github.com/project_radeon/api/internal/recoverymeetings	0.009s

    set -a; . ./.env; set +a; GOCACHE=/tmp/go-build-cache RECOVERY_MEETINGS_DB_TEST=1 go test ./internal/recoverymeetings -run 'TestPgStore.*(Carlow|Suggestions|Portlaoise)' -count=1
    ok  	github.com/project_radeon/api/internal/recoverymeetings	0.889s

    GOCACHE=/tmp/go-build-cache go test ./...
    all tested backend packages passed or reported no test files

    Direct database sanity check with tokenized search semantics:
    carlow=8, london=253, portlaoise=9, na portlaoise ireland=9, c.a. carlow=8

Observed validation after the balanced local mixed feed on 2026-05-25:

    npm run typecheck
    exited 0

    GOCACHE=/tmp/go-build-cache go test ./internal/recoverymeetings
    ok  	github.com/project_radeon/api/internal/recoverymeetings	(cached)

Observed validation after tightening local fallback accuracy on 2026-05-25:

    npm run typecheck
    exited 0

## Validation and Acceptance

The first acceptance case is the original bug report. With the backend running against the imported database, a request equivalent to `GET /recovery-meetings?fellowship=ca&country=ireland&location=Carlow&meeting_type=in_person` returns two active meetings named `C.A. Carlow`. The legacy `city=Carlow` parameter is still accepted as a fallback.

The app acceptance case is that a user can open the Meetings surface, set fellowship to CA, country to Ireland, location to Carlow, and mode to In person, then see the Carlow meetings without needing to type `Co. Carlow`.

Regression acceptance requires AA and NA filters to continue returning imported meetings and invalid filters such as `meeting_type=invalid` to continue returning validation errors.

Suggestion acceptance requires typing `Carl` in the location field to offer `Co. Carlow, Ireland` for CA/Ireland data, typing `Ire` in the country field to offer `Ireland`, and selecting either suggestion to populate the corresponding filter field.

Detail acceptance requires pressing any meeting card to open `RecoveryMeetingDetailScreen`, loading fresh detail through `GET /recovery-meetings/{id}`, and returning to the filtered list with the back control.

Local default acceptance requires opening the meetings finder with location permission granted and seeing an initial query scoped to the reverse-geocoded place. If the city-level query returns zero rows, the app automatically broadens to region, then country, then global results. If location permission is denied, the finder loads global results. If the user manually enters a location or country, the inferred local default no longer affects the API query.

Card acceptance requires each meeting card to show the meeting mode, day, time/timezone, address when present, and connection credentials when an online URL or phone join information exists. Detail acceptance requires the same information to appear in a cleaner full-page layout with clear actions for online links and source links.

## Idempotence and Recovery

The backend query changes are additive and safe to re-run. Tests can be run repeatedly. A database migration is included as `083_recovery_meeting_finder_indexes.sql`; it uses `CREATE INDEX IF NOT EXISTS` and can be applied repeatedly by the migration runner without duplicating indexes.

The app changes are local TypeScript and React Native UI changes. If the filter model changes need to be split, keep compatibility by continuing to send existing backend query parameters until the backend exposes a new stable `location` parameter.

## Artifacts and Notes

Investigation evidence from 2026-05-25:

    SELECT source_id, source_record_id, name, meeting_type, city, country, venue_name
    FROM recovery_meetings
    WHERE fellowship='ca'
      AND status='active'
      AND country ILIKE 'ireland'
      AND (city ILIKE '%carlow%' OR name ILIKE '%carlow%' OR venue_name ILIKE '%carlow%');

    ca-23bc07bc85b3 | 9872c9083746674a | C.A. Carlow | in_person | Co. Carlow | Ireland | Carlow Cathedral Parish Centre
    ca-23bc07bc85b3 | f6d68dd513e6c0d2 | C.A. Carlow | in_person | Co. Carlow | Ireland | Carlow Cathedral Parish Centre

    exact_count: 0
    relaxed_count: 2

Implementation evidence from 2026-05-25:

    Applied 083_recovery_meeting_finder_indexes.sql

    migrate status tail:
    applied      079_generic_profile_interests.sql
    applied      080_onboarding_guided_action_milestones.sql
    applied      081_remove_guided_onboarding_milestones.sql
    applied      082_recovery_meetings.sql
    applied      083_recovery_meeting_finder_indexes.sql

## Interfaces and Dependencies

Backend interfaces should remain compatible with the current app:

    GET /recovery-meetings?fellowship=ca&country=ireland&location=Carlow&meeting_type=in_person

The response remains the existing cursor page of `RecoveryMeeting` objects. `city=Carlow` remains supported as a compatibility fallback. No new app dependency is required. Future polish may add a backend suggestions endpoint, for example `GET /recovery-meetings/locations?q=car`, but that is deliberately outside the completed search-first milestone.

Suggestion interfaces now exist:

    GET /recovery-meetings/locations?q=Carl&country=Ireland&fellowship=ca&limit=8
    GET /recovery-meetings/countries?q=Ire&fellowship=ca&limit=8

Location suggestions return `label`, `location`, optional `country`, and `meeting_count`. Country suggestions return `label`, `country`, and `meeting_count`.

Plan revision note, 2026-05-25: Created this ExecPlan after investigating a reported CA Ireland Carlow empty result. The plan records the concrete failure, the data evidence, and a staged path from backend correctness to app polish.

Plan revision note, 2026-05-25: Updated after implementation. The completed work includes forgiving backend location matching, `location` API support, keyset cursor pagination, finder indexes, app filter polish, and validation evidence.

Plan revision note, 2026-05-25: Updated after the typeahead/detail polish pass. The completed work includes recovery meeting location/country suggestions, app suggestion hooks, a full recovery meeting detail screen, card refactor, fellowship filter cleanup, and meeting mode chip layout correction.

Plan revision note, 2026-05-25: Updated after the user redirected the initial-nearby behavior away from longitude/latitude ranking. The next implementation uses reverse-geocoded place text and fallback queries, and brings credentials back onto cards in a controlled, standardized way.

Plan revision note, 2026-05-25: Updated after implementation of the place-based local default phase. The app now uses reverse-geocoded place text for initial results, broadens local fallback queries automatically, displays credentials on cards, and presents a cleaner meeting detail page.

Plan revision note, 2026-05-25: Updated after fixing typed search. The backend now tokenizes natural-language meeting queries and the app avoids one-character refetch churn while preserving prior results during search loads.

Plan revision note, 2026-05-25: Updated after implementing the balanced local mixed feed. The unfiltered finder now fans out by fellowship and interleaves AA, CA, and NA local results, while explicit search/filter interactions use the normal filtered query path.

Plan revision note, 2026-05-25: Updated after investigating London accuracy. The mixed feed now avoids countrywide/global filler when city or region local results exist, and the plan records the remaining London data-quality issue for source/import cleanup.
