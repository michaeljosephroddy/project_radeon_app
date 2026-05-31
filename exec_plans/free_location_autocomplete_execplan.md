# Free Location Autocomplete for Recovery Meetings

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `PLANS.md` in this repository. It spans two local repositories: `/home/michaelroddy/repos/project_radeon` for the Go backend API and PostgreSQL database, and `/home/michaelroddy/repos/project_radeon_app` for the Expo React Native app. The plan intentionally avoids paid providers and avoids adding another server.

## Purpose / Big Picture

People using SoberSpace should be able to search for recovery meetings by typing a neighborhood, city, or postal area and choosing a clear canonical place, similar to consumer apps that show choices such as `Barcelona, Catalonia, Spain` and `Barcelona, Anzoategui, Venezuela`. Today the app asks the user to choose country first, then region, then town. That is workable but not production-grade because it cannot globally disambiguate places and its suggestions are derived only from the imported meeting rows.

After this change, a user can type `barcel` in one location field, select the intended place from a list backed by free GeoNames data stored in the existing Postgres database, and search AA, CA, and NA meetings near or within that selected place. This plan does not use Google Places, Mapbox, Photon, Elasticsearch, public Nominatim, or any other extra service. It uses the existing Go API, the existing Postgres database, a new imported `places` table, and a small amount of matching logic that links recovery meetings to canonical places.

This feature must be built as a high-performance search path, not as a convenient but slow SQL layer. Autocomplete should feel instant while typing, selected-place meeting searches should remain fast on the full production meeting dataset, and import or match-refresh work should be batch-oriented so it does not block normal API traffic. Performance is part of acceptance for this plan.

## Progress

- [x] (2026-05-31T20:32Z) Confirmed the current frontend meeting filters live in `src/screens/main/support/recoveryMeetings.ts`, `src/components/support/RecoveryMeetingFilterSheet.tsx`, and `src/screens/main/support/MeetingsView.tsx`.
- [x] (2026-05-31T20:32Z) Confirmed all frontend API calls go through `src/api/client.ts`, with recovery meeting list and filter option functions already present.
- [x] (2026-05-31T20:32Z) Confirmed the backend recovery meeting API lives in `/home/michaelroddy/repos/project_radeon/internal/recoverymeetings`, with routes registered from `cmd/api/main.go`.
- [x] (2026-05-31T20:32Z) Confirmed existing recovery meeting place suggestions are generated from `recovery_meeting_filter_places`, which is a view over active meeting rows, not a canonical world places dataset.
- [x] (2026-05-31T20:32Z) Created this ExecPlan on branch `execplan/free-location-autocomplete` in `/home/michaelroddy/repos/project_radeon_app`.
- [x] (2026-05-31T21:22Z) Renamed the app branch to `feature/free-location-autocomplete` once implementation began.
- [x] (2026-05-31T21:18Z) Created backend branch `feature/free-location-autocomplete` in `/home/michaelroddy/repos/project_radeon`.
- [x] (2026-05-31T21:18Z) Added `migrations/111_places_geonames.sql` with canonical `places` schema, normalized indexed text columns, and `recovery_meeting_place_matches`.
- [x] (2026-05-31T21:18Z) Added `cmd/import-places` and `internal/places` GeoNames parsing/import code with batched upserts and unit tests.
- [x] (2026-05-31T21:18Z) Added authenticated backend `GET /places/autocomplete` and handler tests.
- [x] (2026-05-31T21:18Z) Extended recovery meeting list parsing and SQL generation with `place_id`, backend-owned selected-place radius, place-match joins, bounding-box filtering, Haversine distance, and tests.
- [x] (2026-05-31T21:18Z) Updated app API client, React Query hook, filter state, active chips, and Meetings UI to use canonical place autocomplete with backend-owned selected-place radius behavior.
- [x] (2026-05-31T22:05Z) Applied migrations locally, imported GeoNames `cities1000`, refreshed recovery meeting place matches, and captured `EXPLAIN ANALYZE` evidence for autocomplete and selected-place search.
- [x] (2026-05-31T21:18Z) Added performance guardrails for minimum query length, capped autocomplete limits, indexed normalized columns, debounced frontend autocomplete, bounded radius, and batch import behavior.
- [x] (2026-05-31T21:18Z) Ran `GOCACHE=/tmp/go-build-cache go test ./...` in the backend and `npm run typecheck` in the app.
- [x] (2026-05-31T21:20Z) Updated first-load meeting behavior so the app defaults to AA, uses profile/current location immediately when available, does not block the initial meetings query on GPS or reverse geocoding, removes sequential local fallback round trips, and keeps previous React Query data visible during refetch.
- [x] (2026-05-31T21:20Z) Added migration `113_user_current_place_id.sql`, persisted `users.current_place_id` from saved GPS/current-location updates, backfilled existing current-location users, returned it from the user API, and made the app prefer `place_id` for initial local meeting loads when available.
- [x] (2026-05-31T21:20Z) Applied local migration `113_user_current_place_id.sql`, backfilled 226 local users, then re-ran `npm run typecheck`, `git diff --check`, and `GOCACHE=/tmp/go-build-cache go test ./...` after the first-load optimization pass.
- [x] (2026-05-31T22:50Z) Finalized the Meetings page layout: location autocomplete stays on the main screen, AA/CA/NA live in the filter sheet with day and meeting mode, and radius remains hidden as backend-owned behavior.

## Surprises & Discoveries

- Observation: The current recovery meeting autocomplete can never behave like Meetup-style global place search because its source data is only the meetings table.
    Evidence: The backend view `migrations/087_recovery_meeting_filter_places.sql` selects active meeting rows and builds `search_text` from meeting country, region, locality, venue, address, and postal code. It has no knowledge of places that do not already appear cleanly in imported meetings.

- Observation: The app currently enforces a country-first location flow.
    Evidence: `src/components/support/RecoveryMeetingFilterSheet.tsx` disables region and town selection until `draftFilters.country` has a value, and `src/hooks/queries/useRecoveryMeetings.ts` only enables locality suggestions when a country is present.

- Observation: Existing AA and CA meeting rows may not have coordinates, so a pure distance-only search would hide valid results.
    Evidence: The recovery meetings schema in `/home/michaelroddy/repos/project_radeon/migrations/082_recovery_meetings.sql` has nullable `latitude` and `longitude`. Earlier production-finder investigation found AA and CA rows were largely text-located rather than geocoded. This plan therefore includes a canonical place match table so text-located meetings can still be found by selected places.

- Observation: Automated tests, typechecks, imports, matching, and query-plan checks all pass on the local development database.
    Evidence: On 2026-05-31, `GOCACHE=/tmp/go-build-cache go test ./...` passed in `/home/michaelroddy/repos/project_radeon`, `npm run typecheck` passed in `/home/michaelroddy/repos/project_radeon_app`, GeoNames imported 169,140 rows, and the captured query plans met the autocomplete and selected-place search targets.

- Observation: GeoNames city rows may contain bare quote characters that Go's default CSV parser rejects.
    Evidence: The first dry run failed with `parse error on line 136829, column 45: bare " in non-quoted-field`. Setting `csv.Reader.LazyQuotes = true` allowed the dry run to parse all 169,140 rows.

- Observation: The initial meeting-place refresh SQL was too broad because alternate-name matching forced an expensive comparison path.
    Evidence: The first refresh attempt did not complete in a useful time window and wrote zero matches. Replacing the alternate-name join with indexed `places.name_normalized` and `places.ascii_name_normalized` matching let the refresh complete in 6.88 seconds and write 74,162 matches for 91,416 active meetings.

- Observation: The first selected-place search query shape was not acceptable for the performance target.
    Evidence: `EXPLAIN ANALYZE` for Dublin, Ireland initially took 397.96 ms and scanned all 91,416 active meetings plus all 169,140 places. Rewriting selected-place search to build an indexed candidate set first reduced the same query shape to 6.68 ms.

- Observation: The meetings screen first load had a frontend critical path before the API call.
    Evidence: `MeetingsView.tsx` previously disabled the recovery-meetings query while device coordinates and reverse geocoding resolved, even when a profile/current city was already available. The optimized flow now applies the profile/current place first and lets GPS/reverse geocoding refresh in the background.

- Observation: The non-canonical first-load local query is acceptable but slower than selected-place search, so saved current locations should use a canonical place id when available.
    Evidence: On the local development database, the current AA + Dublin loose-text query completed in 51.82 ms. The selected-place Dublin query is still faster at 6.68 ms. The implementation now stores `users.current_place_id` during current-location updates and the app sends that `place_id` on initial local loads when present.

## Decision Log

- Decision: Use GeoNames imported into the existing Postgres database instead of Google Places, Mapbox, Photon, Elasticsearch, or public Nominatim.
    Rationale: The user needs a free solution and does not want another server. GeoNames provides downloadable city and postal-code data that can be imported into the existing backend database, while public Nominatim is not appropriate as a production autocomplete backend.
    Date/Author: 2026-05-31 / Codex.

- Decision: Do not make PostGIS required for the first implementation.
    Rationale: PostGIS would be useful, but requiring a database extension can complicate deployment. A latitude/longitude bounding box plus Haversine distance calculation is good enough for city-level meeting search and keeps the change inside ordinary PostgreSQL.
    Date/Author: 2026-05-31 / Codex.

- Decision: Add a `places` table and a `recovery_meeting_place_matches` table instead of only adding latitude/longitude search to meetings.
    Rationale: Many recovery meeting rows are not address-geocoded. Matching each meeting to a canonical city or locality lets selected-place search work for rows that only have city, region, and country text.
    Date/Author: 2026-05-31 / Codex.

- Decision: Keep the existing meeting list response shape mostly stable and add optional distance/place fields only where needed.
    Rationale: The frontend already renders `RecoveryMeeting` rows. Keeping the response compatible reduces risk while allowing selected-place search to improve behavior.
    Date/Author: 2026-05-31 / Codex.

- Decision: Treat performance as a core contract for this feature.
    Rationale: Location autocomplete runs while a user is typing, and selected-place meeting search can touch a large global recovery meeting dataset. Without explicit latency targets, indexes, limits, and query-plan checks, the feature could feel polished in small local tests but degrade badly in production.
    Date/Author: 2026-05-31 / Codex.

## Outcomes & Retrospective

Implementation is complete across backend and app. The backend now has a canonical places schema, a GeoNames import command, a place autocomplete endpoint, selected-place recovery meeting search, and an indexed candidate-first selected-place query. The app now has a primary location autocomplete field backed by `/places/autocomplete`, stores the selected canonical place, sends `place_id` to `/recovery-meetings`, and keeps the old loose location fallback when no canonical place is selected.

The performance acceptance work is also complete on the local development database. GeoNames `cities1000` imported 169,140 place rows. Recovery meeting place matching scanned 91,416 active meetings and wrote 74,162 matches. Autocomplete for `barcel` used prefix and trigram indexes and completed in 3.62 ms. Selected-place meeting search for Dublin, Ireland used the place-match, meeting-coordinate, place-coordinate, and occurrence indexes and completed in 6.68 ms.

The first-load meetings pass is complete for the current frontend contract. The screen now defaults to AA, no longer waits for GPS or reverse geocoding before allowing meetings to load, initializes from profile/current city when available, removes sequential town/region/country fallback requests, and keeps cached/previous meeting pages visible while refetching. When a user has a saved `current_place_id`, the first local query uses the fastest selected-place path automatically.

The public radius control and `radius_km` API parameter were removed after implementation. Selected-place recovery meeting search now uses a backend-owned default radius of 50 km. The frontend sends only `place_id`; the filter sheet no longer exposes radius; cache keys no longer include radius; and backend handler parsing no longer accepts radius as a public filter.

The final app surface keeps location as the only primary Meetings page control. Fellowship selection is back in the filter sheet as a simple AA, CA, or NA choice, alongside day and meeting mode. This keeps the main screen lighter while preserving explicit fellowship filtering.

## Context and Orientation

The app repository is `/home/michaelroddy/repos/project_radeon_app`. It is a React Native/Expo app. All network calls must go through `src/api/client.ts`. Meeting list data is fetched through `src/hooks/queries/useRecoveryMeetings.ts`. Meeting filters are modeled in `src/screens/main/support/recoveryMeetings.ts`, rendered in `src/components/support/RecoveryMeetingFilterSheet.tsx`, and applied by `src/screens/main/support/MeetingsView.tsx`.

The backend repository is `/home/michaelroddy/repos/project_radeon`. It is a Go API backed by PostgreSQL. Recovery meetings are stored in `recovery_meetings` and `recovery_meeting_occurrences`, created by `migrations/082_recovery_meetings.sql`. Recovery meeting API code lives in `internal/recoverymeetings/`. The handler parses HTTP query parameters in `internal/recoverymeetings/handler.go`; SQL is built in `internal/recoverymeetings/store.go`; types live in `internal/recoverymeetings/types.go`. Routes are registered from `cmd/api/main.go`.

The phrase "canonical place" means a stable place record from a places dataset, not a free-text string typed by the user. For example, `Barcelona, Catalonia, Spain` and `Barcelona, Anzoategui, Venezuela` are different canonical places with different IDs and coordinates even though they share the name `Barcelona`.

The phrase "GeoNames" means the free geographic dataset published as tab-separated text files. The important files for this plan are `cities1000.zip` or `cities500.zip` for populated places and, later if needed, country postal-code files. The import must store attribution in developer documentation or an about/legal area before publishing because GeoNames data requires attribution.

The phrase "Haversine distance" means the standard formula for calculating approximate distance between two latitude/longitude points on Earth. This plan uses it inside SQL after first narrowing candidates with a bounding box. A bounding box is a cheap rectangular latitude/longitude range around a selected place, used to avoid calculating distance for every row.

## Plan of Work

Start in `/home/michaelroddy/repos/project_radeon` by creating a backend branch, for example `feature/free-location-autocomplete`. Add migrations after the current latest migration. In this implementation, the schema migration is `111_places_geonames.sql` and the selected-place coordinate index migration is `112_recovery_meeting_coordinate_index.sql`.

The migration should create a `places` table. Use `source` and `source_id` instead of assuming GeoNames is the only possible source forever. The minimum columns should be `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `source TEXT NOT NULL`, `source_id TEXT NOT NULL`, `name TEXT NOT NULL`, `ascii_name TEXT`, `alternate_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`, `country_code TEXT NOT NULL`, `country_name TEXT`, `admin1_code TEXT`, `admin1_name TEXT`, `admin2_code TEXT`, `admin2_name TEXT`, `feature_class TEXT`, `feature_code TEXT`, `population INTEGER NOT NULL DEFAULT 0`, `latitude DOUBLE PRECISION NOT NULL`, `longitude DOUBLE PRECISION NOT NULL`, `timezone TEXT`, `search_text TEXT NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, and `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Add a unique index on `(source, source_id)`, btree indexes on `country_code`, `(country_code, admin1_code)`, and `(latitude, longitude)`, and trigram indexes on `name`, `ascii_name`, and `search_text`. `pg_trgm` already exists in earlier migrations, but the migration can still include `CREATE EXTENSION IF NOT EXISTS pg_trgm;` safely.

The same migration, or the next one if smaller migrations are preferred, should create `recovery_meeting_place_matches`. The table should have `recovery_meeting_id UUID NOT NULL REFERENCES recovery_meetings(id) ON DELETE CASCADE`, `place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE`, `match_level TEXT NOT NULL`, `confidence INTEGER NOT NULL`, `matched_text TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, and a primary key on `recovery_meeting_id`. `match_level` should be one of plain strings such as `city_country`, `city_region_country`, `postal_code`, `coordinate_nearest`, or `manual`. `confidence` is an integer score where higher means the match is more trustworthy. Add indexes on `place_id` and `(place_id, confidence DESC)`.

Add a new backend package such as `internal/places`. It should contain types, a store, an importer, and tests. Keep it separate from `internal/recoverymeetings` because canonical places will probably be useful for meetups, profiles, and other location features later. Define `Place`, `PlaceSuggestion`, `AutocompleteParams`, and `ImportOptions` in `internal/places/types.go`. Define a `Querier` interface and `pgStore` in `internal/places/store.go`. Add `AutocompletePlaces(ctx, params)` to search the `places` table by prefix and fuzzy text.

Add a command at `/home/michaelroddy/repos/project_radeon/cmd/import-places/main.go`. Model the command style after `cmd/import-recovery-meetings/main.go`: use `flag`, read `DATABASE_URL`, open a pgx pool, and call the importer. It should accept `-geonames-cities /path/to/cities1000.txt`, `-country-info /path/to/countryInfo.txt`, `-admin1 /path/to/admin1CodesASCII.txt`, `-admin2 /path/to/admin2Codes.txt`, `-dry-run`, and `-timeout`. The importer should be idempotent by using `INSERT ... ON CONFLICT (source, source_id) DO UPDATE`. Re-running it with the same files should update names, population, coordinates, and search text without duplicating rows.

The GeoNames importer should parse tab-separated rows using Go's standard `encoding/csv` with `Comma` set to tab. For `cities1000.txt`, use GeoNames columns as follows: geonameid is source_id, name is name, asciiname is ascii_name, alternatenames is a comma-separated list, latitude and longitude are floats, feature class and feature code are strings, country code is country_code, admin1 and admin2 are codes, population is an integer, and timezone is timezone. Use `countryInfo.txt`, `admin1CodesASCII.txt`, and `admin2Codes.txt` to enrich country and admin names. Build `search_text` from name, ascii name, alternate names, country name/code, admin names/codes, and source id.

Add a meeting-place matcher in `internal/recoverymeetings` or `internal/places` with a clear public function such as `RefreshRecoveryMeetingPlaceMatches(ctx, pool)` or a store method. It should match active recovery meetings to canonical places using conservative rules. First try exact normalized `country_code` plus normalized `city` or derived locality against place names and alternate names. Then use `country_code`, `region_code`, and locality when available. Then try country name/code plus locality. If a meeting already has latitude and longitude, allow a coordinate-nearest match within a small radius such as 25 km when text matching fails. Do not guess across countries. Store the chosen place and confidence in `recovery_meeting_place_matches`.

Expose a backend autocomplete endpoint. Register `GET /places/autocomplete` in `cmd/api/main.go` and implement it in a new `internal/places/handler.go`. It should require authentication if nearby meeting search requires authentication today; match the existing route group style. Query parameters should be `q`, `limit`, and optional `country_code`. Reject or short-circuit queries shorter than two characters. Return at most 10 suggestions by default. Rank exact prefix matches first, then high-population places, then fuzzy text matches. The response should include `id`, `label`, `name`, `country`, `country_code`, `region`, `region_code`, `latitude`, `longitude`, `population`, and `source`.

Extend the recovery meeting list endpoint so it accepts selected place input. Add `place_id` to `internal/recoverymeetings.ListParams`. In `handler.go`, parse `place_id` as a UUID. Use a backend-owned default radius of 50 km for city-level selected-place searches. Preserve existing `country`, `region`, and `location` parameters so old app versions keep working.

In `internal/recoverymeetings/store.go`, when `place_id` is present, join the selected `places` row and use two matching paths. The first path should include meetings whose `recovery_meeting_place_matches.place_id` equals the selected place. The second path should include meetings or matched places inside the radius. For distance, use latitude/longitude from `recovery_meetings` when present; otherwise use the matched `places` row coordinates. Use a bounding box first, then a Haversine expression to compute `distance_km`. Order selected-place results by exact place match first, distance second, next occurrence third, and name fourth. Existing fellowship, day, meeting type, and text search filters must still apply.

Add backend tests before and after implementation. Unit tests should cover GeoNames row parsing, autocomplete ranking for duplicate city names, handler validation for short queries and invalid radius, and SQL generation for `place_id` search. Integration tests guarded by an environment variable should import a tiny fixture containing places such as Dublin, London, Barcelona Spain, Barcelona Venezuela, Galway, Dingle, and Portlaoise, then assert that autocomplete returns distinct labels and that a selected place returns known matched recovery meetings.

Add explicit performance work before exposing the feature in the app. Autocomplete must always require at least two characters, must cap `limit` to a small maximum such as 10, and must use indexed predicates before any fuzzy ranking. The store query should prefer prefix matches on normalized name/ascii name, then trigram `search_text` matches, then population ranking. Avoid scanning the whole `places` table for every keystroke. If needed, add generated or maintained normalized columns such as `name_normalized`, `ascii_name_normalized`, and `search_text_normalized` so queries can use predictable indexes instead of wrapping every column in functions at runtime.

Selected-place meeting search must avoid computing distance across all recovery meeting rows. First load the selected place once, calculate a latitude/longitude bounding box in Go or SQL, and use that bounding box to narrow candidate meeting or matched-place coordinates. Only then compute Haversine distance. The query should keep cursor pagination and return one page plus one extra row to determine `next_cursor`; it should never load all matching meetings into Go for sorting.

The meeting-place match refresh must be implemented as batch work. It should process active recovery meetings in chunks, use set-based SQL where practical, and commit in bounded transactions. It should not run inside the API request path. If a refresh command is interrupted, rerunning it should resume safely by replacing or upserting matches.

After the backend contract works, update `/home/michaelroddy/repos/project_radeon_app`. Add `PlaceSuggestion` and `SelectedPlace` interfaces in `src/api/client.ts`, plus a `getPlaceAutocomplete(query, params)` function that calls `/places/autocomplete`. Extend `RecoveryMeetingFilters` in `src/api/client.ts` to include `place_id?: string`. Extend `getRecoveryMeetings` to serialize that parameter.

Update `src/hooks/queries/useRecoveryMeetings.ts` with a `usePlaceAutocomplete` hook. Use the same React Query patterns already used in that file: stable query keys, minimum two-character query, and a small debounce in the component. The hook should not call a provider directly. It only calls the app API client.

Update `src/screens/main/support/recoveryMeetings.ts`. Add `selectedPlace: SelectedRecoveryPlace | null` to the frontend filter state. Keep `country`, `countryCode`, `region`, `regionCode`, and `location` during migration so existing fallback behavior and chips can continue to work, but make `selectedPlace` the preferred source for API params. `filtersToApiParams` should send `place_id` when `selectedPlace` exists. Only send loose `country`, `region`, and `location` when there is no selected place.

Update `src/screens/main/support/MeetingsView.tsx` with a single primary location autocomplete field labeled in user-facing language such as `City, neighbourhood, or postcode`. As the user types two or more characters, call `usePlaceAutocomplete`. Render suggestions as rows with a primary label and smaller region/country detail. Selecting a suggestion stores `selectedPlace`, fills the visible text with the suggestion label, and clears stale loose country/region/location fields. Keep AA/CA/NA, day, and meeting-type filters in `src/components/support/RecoveryMeetingFilterSheet.tsx`. Do not expose radius in the app.

Update `src/screens/main/support/MeetingsView.tsx`. The local default behavior can continue to use device/profile place inference until selected-place search is fully proven. Once the user selects a place, the explicit selected place must override inferred local fallbacks. Active chips should show `Location: Barcelona, Catalonia, Spain` when relevant. Empty states should suggest trying another location or clearing secondary filters.

Do not remove the older backend recovery meeting filter option endpoints in this plan. They may still support legacy app builds or a fallback screen. Once selected-place autocomplete has been released and verified, a later cleanup plan can remove or hide the old country-first UI paths.

## Concrete Steps

In the frontend repo, this ExecPlan was created on a planning branch:

    cd /home/michaelroddy/repos/project_radeon_app
    git switch -c execplan/free-location-autocomplete

Implementation continued after renaming the branch:

    git branch -m feature/free-location-autocomplete

When implementation starts, create a backend branch:

    cd /home/michaelroddy/repos/project_radeon
    git switch -c feature/free-location-autocomplete

Add backend migrations and run them locally:

    cd /home/michaelroddy/repos/project_radeon
    go run ./cmd/migrate up
    go run ./cmd/migrate status

Download GeoNames files outside the repository, for example under `/tmp/geonames`, then extract them. Keep the repository free of large data dumps. The importer command should accept extracted `.txt` paths:

    cd /home/michaelroddy/repos/project_radeon
    go run ./cmd/import-places \
      -geonames-cities /tmp/geonames/cities1000.txt \
      -country-info /tmp/geonames/countryInfo.txt \
      -admin1 /tmp/geonames/admin1CodesASCII.txt \
      -admin2 /tmp/geonames/admin2Codes.txt \
      -dry-run

After the dry run reports parsed and upsertable rows, run without `-dry-run`:

    go run ./cmd/import-places \
      -geonames-cities /tmp/geonames/cities1000.txt \
      -country-info /tmp/geonames/countryInfo.txt \
      -admin1 /tmp/geonames/admin1CodesASCII.txt \
      -admin2 /tmp/geonames/admin2Codes.txt

After importing places, refresh meeting-place matches:

    go run ./cmd/import-places -refresh-recovery-meeting-matches

If implementation chooses a separate command for match refresh, document the exact command here before running it.

Run backend validation:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache go test ./internal/places ./internal/recoverymeetings
    GOCACHE=/tmp/go-build-cache go test ./...

Capture query-plan evidence on a database with realistic imported places and recovery meetings:

    EXPLAIN ANALYZE
    SELECT id, label
    FROM places
    WHERE search_text ILIKE '%barcel%'
    ORDER BY population DESC
    LIMIT 10;

The actual implementation query should be more selective than this sketch if possible. Record the real `EXPLAIN ANALYZE` output in this plan after implementation. The target is that common autocomplete queries complete in well under 100 ms on the developer database after warm-up and do not show an unbounded sequential scan over the full places table for every request.

Also capture selected-place meeting search query plans. The target is that common selected-place searches complete in well under 250 ms after warm-up on the developer database and use the place match, fellowship, status, coordinate, or occurrence indexes before distance calculation.

Run frontend validation:

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck

For manual API verification, start the backend and query autocomplete. Replace the bearer token with a valid app auth token if the route is authenticated:

    curl -H "Authorization: Bearer $TOKEN" "http://localhost:8080/places/autocomplete?q=barcel&limit=5"

The expected response should include multiple distinct places, not only places already present in recovery meetings. A successful response shape should look like this, with real UUIDs and coordinates:

    {
      "data": [
        {
          "id": "00000000-0000-0000-0000-000000000000",
          "label": "Barcelona, Catalonia, Spain",
          "name": "Barcelona",
          "country": "Spain",
          "country_code": "ES",
          "region": "Catalonia",
          "region_code": "56",
          "latitude": 41.38879,
          "longitude": 2.15899,
          "population": 1621537,
          "source": "geonames"
        }
      ]
    }

For manual meeting search verification, use a selected place id from the autocomplete response:

    curl -H "Authorization: Bearer $TOKEN" "http://localhost:8080/recovery-meetings?place_id=$BARCELONA_PLACE_ID&fellowship=aa&fellowship=ca&fellowship=na&limit=20"

The response should be the existing cursor page shape, with meetings constrained by the selected place and backend-owned radius while still honoring fellowship filters.

## Validation and Acceptance

Autocomplete acceptance is user-visible. In the Meetings page location field, typing `barcel` should show multiple canonical places such as Barcelona in Spain and Barcelona in another country when present in the places dataset. Typing `dublin` should show Dublin, Ireland and Dublin locations in the United States when present. Typing `lon` should show London and other matching places, ordered so the most likely large populated places are near the top.

Meeting search acceptance is also user-visible. Selecting `Barcelona, Catalonia, Spain` should search meetings for that selected place using the backend-owned radius. Selecting `Dublin, Ireland` should not accidentally search `Dublin, Ohio`. Clearing the selected place should return the screen to its existing local/default behavior.

Backend acceptance requires tests for these behaviors: GeoNames import is idempotent; autocomplete rejects one-character queries; autocomplete returns duplicate city names as distinct suggestions with country and region labels; selected-place meeting search applies fellowship, day, meeting type, and query filters; and selected-place search can include text-located meetings through `recovery_meeting_place_matches`.

Performance acceptance is mandatory. Backend autocomplete must enforce a minimum query length and maximum limit. The implementation must include indexes that support the autocomplete predicates and selected-place meeting predicates. The final plan update must include at least one `EXPLAIN ANALYZE` transcript for autocomplete and one for selected-place meeting search, with a short note explaining whether the query uses indexes and whether the observed time is acceptable. If the query plan shows full-table scans on production-sized tables for normal user input, the feature is not complete.

Frontend acceptance requires `npm run typecheck` to pass and manual verification that the Meetings page no longer forces country-first input for the primary location search. The old country/region/location fields should not be visible as the primary production path once selected-place autocomplete is available.

Frontend performance acceptance is also mandatory. The autocomplete input must debounce requests, avoid firing for one-character input, cancel or ignore stale requests through React Query, and keep suggestion rendering capped to the backend limit. Selecting fellowship, day, or meeting-mode filters should refetch the meeting list without clearing already-rendered results unless the current UI pattern requires a full loading state.

## Idempotence and Recovery

The GeoNames import must be safe to run multiple times. Use `ON CONFLICT (source, source_id) DO UPDATE` for `places`. The meeting-place match refresh should be safe to run multiple times by upserting or replacing matches for active meetings inside a transaction.

Do not commit downloaded GeoNames dumps to either repository. Keep them in `/tmp/geonames` or another local scratch directory. If an import fails halfway, rerun the importer after fixing the parser or schema issue; the unique index on `(source, source_id)` prevents duplicate place rows.

If the selected-place recovery meeting search is too slow, first inspect query plans with `EXPLAIN ANALYZE` and add indexes before changing behavior. If the Haversine distance expression becomes hard to maintain, a later plan may introduce PostGIS as an optional database extension, but this first implementation should work without it.

If frontend selected-place UX causes issues, keep the old country-first endpoints in the backend and temporarily feature-flag the new UI in the app. Do not remove backend recovery meeting filter endpoints as part of this plan.

## Artifacts and Notes

Current frontend files that must be updated:

    /home/michaelroddy/repos/project_radeon_app/src/api/client.ts
    /home/michaelroddy/repos/project_radeon_app/src/hooks/queries/useRecoveryMeetings.ts
    /home/michaelroddy/repos/project_radeon_app/src/screens/main/support/recoveryMeetings.ts
    /home/michaelroddy/repos/project_radeon_app/src/components/support/RecoveryMeetingFilterSheet.tsx
    /home/michaelroddy/repos/project_radeon_app/src/screens/main/support/MeetingsView.tsx

Current backend files and directories that must be updated or added:

    /home/michaelroddy/repos/project_radeon/migrations/111_places_geonames.sql
    /home/michaelroddy/repos/project_radeon/migrations/112_recovery_meeting_coordinate_index.sql
    /home/michaelroddy/repos/project_radeon/cmd/import-places/main.go
    /home/michaelroddy/repos/project_radeon/internal/places/
    /home/michaelroddy/repos/project_radeon/internal/recoverymeetings/types.go
    /home/michaelroddy/repos/project_radeon/internal/recoverymeetings/handler.go
    /home/michaelroddy/repos/project_radeon/internal/recoverymeetings/store.go
    /home/michaelroddy/repos/project_radeon/cmd/api/main.go

Known current limitation that this plan fixes:

    Existing meeting filter suggestions are derived from recovery_meeting_filter_places.
    That view only contains active meeting rows, so it cannot answer "show me all Barcelonas"
    unless those places already exist cleanly in imported meeting data.

Observed real-data import and performance evidence on 2026-05-31:

    GOCACHE=/tmp/go-build-cache go run ./cmd/migrate up
    Applied 111_places_geonames.sql
    Applied 112_recovery_meeting_coordinate_index.sql

    GOCACHE=/tmp/go-build-cache go run ./cmd/import-places ... -dry-run
    dry run complete: rows_read=169140 rows_valid=169140 rows_saved=169140

    GOCACHE=/tmp/go-build-cache go run ./cmd/import-places ...
    import complete: rows_read=169140 rows_valid=169140 rows_saved=169140

    GOCACHE=/tmp/go-build-cache go run ./cmd/import-places -refresh-recovery-meeting-matches -timeout 30m
    recovery meeting place match refresh complete: meetings_scanned=91416 matches_written=74162

Autocomplete `EXPLAIN ANALYZE` for `barcel` used `idx_places_name_normalized_pattern`, `idx_places_ascii_name_normalized_pattern`, and `idx_places_search_text_trgm`. It returned 8 rows through a top-N sort with `Execution Time: 3.624 ms`, well under the 100 ms target.

Selected-place meeting search `EXPLAIN ANALYZE` for Dublin, Ireland at 50 km used `idx_recovery_meeting_place_matches_place_confidence`, `idx_recovery_meetings_active_lat_lng`, `idx_places_lat_lng`, `idx_recovery_meeting_place_matches_place`, `recovery_meetings_pkey`, and `idx_recovery_meeting_occurrences_unique`. It returned 21 rows with `Execution Time: 6.677 ms`, well under the 250 ms target.

## Interfaces and Dependencies

Backend final interface for place autocomplete:

    GET /places/autocomplete?q=barcel&limit=8&country_code=ES

    type PlaceSuggestion struct {
        ID          uuid.UUID `json:"id"`
        Label       string    `json:"label"`
        Name        string    `json:"name"`
        Country     string    `json:"country"`
        CountryCode string    `json:"country_code"`
        Region      *string   `json:"region,omitempty"`
        RegionCode  *string   `json:"region_code,omitempty"`
        Latitude    float64   `json:"latitude"`
        Longitude   float64   `json:"longitude"`
        Population  int       `json:"population"`
        Source      string    `json:"source"`
    }

Backend final interface for recovery meeting search:

    GET /recovery-meetings?place_id=<uuid>&fellowship=aa&fellowship=na&limit=20

    type ListParams struct {
        Query       string
        Fellowships []string
        Country     string
        Region      string
        City        string
        Location    string
        PlaceID     *uuid.UUID
        MeetingType string
        DayOfWeek   *int
        Cursor      string
        Limit       int
    }

Frontend final interface additions in `src/api/client.ts`:

    export interface PlaceSuggestion {
        id: string;
        label: string;
        name: string;
        country: string;
        country_code: string;
        region?: string | null;
        region_code?: string | null;
        latitude: number;
        longitude: number;
        population: number;
        source: string;
    }

    export interface RecoveryMeetingFilters {
        q?: string;
        fellowship?: string | string[];
        country?: string;
        region?: string;
        city?: string;
        location?: string;
        place_id?: string;
        meeting_type?: RecoveryMeetingType;
        day_of_week?: number;
    }

GeoNames is the required free data dependency. It is not a server dependency. The importer consumes downloaded text files and stores the parsed places in the existing Postgres database. The app must never call GeoNames, Google, Mapbox, Nominatim, or another provider directly.

Plan revision note, 2026-05-31: Created the initial plan after the user clarified they need a free location autocomplete solution and do not want to add another server to the app. The plan chooses GeoNames plus existing Postgres and includes a meeting-place match table because many recovery meeting rows are text-located rather than coordinate-geocoded.
