# Refactor Meetups into a full event discovery, creation, and hosting platform

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` at the repository root.

This plan is intentionally self-contained. It describes the work required in both `/home/michaelroddy/repos/project_radeon_app` and `/home/michaelroddy/repos/project_radeon`, because the current Meetups experience is constrained by both the React Native screen architecture and the Go data model.

## Purpose / Big Picture

Today a user can browse upcoming meetups, filter only by text and city, RSVP, view attendees, and create a basic meetup with a title, description, city, start time, and capacity. That is enough for a prototype, but it is not strong enough for a polished event product. The app cannot yet support the richer event discovery patterns people expect from products like Meetup, Eventbrite, Facebook Events, or LinkedIn Events: category browsing, location-aware discovery, distance filters, date presets, day-of-week filtering, time-of-day filtering, event type filtering, waitlists, organizer controls, richer venue details, or discovery ranking that balances relevance and freshness.

After this change, a user will be able to discover events through a purpose-built browse experience with search, chips, filters, and ranked result sections; create an event through a guided flow that supports in-person and online events; manage events they host through a dedicated organizer area; and RSVP or join a waitlist with a fast, stable, infinite-scroll list. The change is only complete when a human can start the backend and Expo app, open the Meetups tab, search and filter by category, distance, day of week, and event type, create a realistic event with venue details, RSVP to it, see it appear in `Hosting` or `Going`, and observe smooth scrolling and stable pagination under a realistic seeded dataset.

## Progress

- [x] (2026-04-26 17:21Z) Reviewed `PLANS.md` in both repositories and confirmed the required ExecPlan structure and maintenance rules.
- [x] (2026-04-26 17:21Z) Reviewed the current frontend meetups implementation in `src/screens/main/MeetupsScreen.tsx`, `src/screens/main/MeetupDetailScreen.tsx`, `src/hooks/queries/useMeetups.ts`, `src/api/client.ts`, and `src/query/queryKeys.ts`.
- [x] (2026-04-26 17:21Z) Reviewed the current backend meetups implementation in `internal/meetups/handler.go`, `internal/meetups/store.go`, `internal/meetups/cache_store.go`, `schema/base.sql`, and the meetup-related migrations.
- [x] (2026-04-26 17:21Z) Authored this ExecPlan in `exec_plans/MEETUPS_PLATFORM_REFACTOR_EXECPLAN.md`.
- [x] (2026-04-26 18:05Z) Implemented the expanded backend event schema in `schema/base.sql` and `migrations/036_events_platform.sql`, including event categories, event hosts, event waitlist, richer meetup fields, and new indexes.
- [x] (2026-04-26 18:19Z) Replaced the backend meetups API surface in `internal/meetups/handler.go`, `internal/meetups/store.go`, `internal/meetups/cache_store.go`, and `internal/meetups/types.go` with richer discovery, organizer, detail, waitlist, and RSVP behavior.
- [x] (2026-04-26 18:31Z) Replaced the frontend Meetups experience with the new discovery/filter/create/detail implementation across `src/screens/main/MeetupsScreen.tsx`, `src/screens/main/MeetupDetailScreen.tsx`, `src/hooks/queries/useMeetups.ts`, `src/hooks/useMeetupFilters.ts`, `src/components/events/*`, `src/query/queryKeys.ts`, and `src/api/client.ts`.
- [x] (2026-04-26 18:57Z) Upgraded `seeds/seed.go` to populate realistic event categories, event types, organizer roles, waitlists, hosting inventory, and filter-friendly event geography; local migration and reseed completed successfully.
- [x] (2026-04-26 19:05Z) Completed backend runtime validation against the migrated local database: authenticated discovery, category loading, hosting/drafts queries, detail loading, attendee previews, host lists, and waitlist behavior all returned successfully on a fresh API process.
- [ ] Run a manual Expo app smoke test against the new backend/event seed world and finish any final UI cleanup that only appears on-device.

## Surprises & Discoveries

- Observation: the current app-side Meetups feature is concentrated in one large screen that owns browse mode, creation mode, and “my meetups” mode at once.
    Evidence: `src/screens/main/MeetupsScreen.tsx` contains search, city geolocation bootstrap, RSVP mutation logic, creation form validation, create-mode keyboard handling, browse-mode pagination, and “my meetups” state in a single screen component.

- Observation: the current backend event model is too small to support high-quality filtering or organizer workflows.
    Evidence: `schema/base.sql` defines `meetups` with only `organiser_id`, `title`, `description`, `city`, `starts_at`, `capacity`, and `attendee_count`. There is no event category, venue coordinates, end time, event type, waitlist, status, or publishing state.

- Observation: current listing is based on plain future-date ordering instead of a relevance or discovery score.
    Evidence: `internal/meetups/store.go` lists meetups with `WHERE m.starts_at > NOW()` and `ORDER BY m.starts_at ASC`, with only city and text `ILIKE` filters.

- Observation: the current query contract does not yet distinguish discovery browsing from organizer back-office views.
    Evidence: `src/hooks/queries/useMeetups.ts` exposes only `useMeetups({ q, city, limit })` and `useMyMeetups(limit)`, while `internal/meetups/handler.go` exposes only list, detail, create, attendees, and RSVP endpoints.

- Observation: the existing cache-store pattern is worth preserving, but the cache keys and TTL choices will need to expand substantially once filters and cursor pagination are introduced.
    Evidence: `internal/meetups/cache_store.go` already uses viewer-aware cache keys and version bumps for list/detail/my-meetups, which is a good base for a larger event subsystem.

- Observation: reseeding the database without clearing Redis leaves the app in a mixed old/new meetup state during local development.
    Evidence: after the richer event seed ran, cached meetup detail payloads continued to omit hosts and attendee previews until Redis was cleared; `seeds/seed.go` now flushes the configured Redis DB after a successful reseed.

- Observation: the meetup detail path originally decorated a copy of the meetup value, which meant host and attendee preview data were not returned reliably from `GetMeetup`.
    Evidence: live API checks against `/meetups/:id` returned empty `hosts` and `attendee_preview` arrays until `internal/meetups/store.go` was updated to hydrate the returned value directly.

- Observation: host attachment must not drive management permissions.
    Evidence: `attachHosts` originally set `CanManage = true` whenever it saw an organizer host row, which made non-organizers appear able to manage events in discovery and detail responses. This was corrected during runtime validation.

## Decision Log

- Decision: treat this as a platform refactor, not a cosmetic screen rewrite.
    Rationale: the current constraints are rooted in the event data model and API shape. A better UI alone cannot provide category, distance, venue, waitlist, recurring events, or organizer tooling.
    Date/Author: 2026-04-26 / Codex

- Decision: rename the conceptual feature from “meetups screen” to “events platform” in implementation thinking, while preserving existing navigation labels until the UX work is complete.
    Rationale: the product requirements now extend beyond simple meetups into discovery, organization, hosting, filtering, and attendance management. Thinking in terms of “events” yields a cleaner data and API design.
    Date/Author: 2026-04-26 / Codex

- Decision: keep event discovery and organizer management as separate product surfaces that share data primitives but not the same screen state.
    Rationale: the current overloading of browse/create/my views into one screen is a root cause of awkward UX and maintenance risk.
    Date/Author: 2026-04-26 / Codex

- Decision: use cursor pagination for event discovery and retain offset pagination only where a back-office style view can tolerate it.
    Rationale: discovery results will need stable scrolling under ranking, filtering, and suppression rules. Cursor pagination is a better fit than page/offset for infinite scroll on a dynamic, ranked feed.
    Date/Author: 2026-04-26 / Codex

- Decision: make location a first-class event primitive with latitude and longitude, not merely a city string.
    Rationale: distance filtering, “near you” ranking, map previews, and venue search all depend on actual coordinates rather than city text.
    Date/Author: 2026-04-26 / Codex

- Decision: support both in-person and online events in the first full redesign, but defer ticketing and paid checkout.
    Rationale: online vs in-person is a core event discovery filter and creation branch. Paid ticketing is a large separate concern that would slow the refactor materially.
    Date/Author: 2026-04-26 / Codex

- Decision: defer invitations, attendee approval workflows, and event discussion threads until after the core discovery and hosting flows are stable.
    Rationale: those are meaningful features, but they are not necessary to achieve parity with a strong v1 event platform inside this app.
    Date/Author: 2026-04-26 / Codex

- Decision: keep meetup detail cache entries viewer-specific even though the underlying event row is shared.
    Rationale: detail responses include `can_manage`, `is_attending`, and `is_waitlisted`, so caching by event alone would leak viewer-specific state between users.
    Date/Author: 2026-04-26 / Codex

## Outcomes & Retrospective

The core refactor is implemented across both repositories. The backend now serves richer event discovery, organizer, detail, attendee, and waitlist flows on the expanded schema, and the frontend now renders a filterable discovery surface, guided event form, organizer scopes, and a richer detail view. Local validation passed at the levels that were exercised: `GOCACHE=/tmp/go-build go test ./...` in the backend, `npx tsc --noEmit` in the frontend, `make migrate`, `go run ./seeds`, direct PostgreSQL audits of the seeded event world, and live authenticated API checks on a fresh API process. The remaining work is a manual Expo-device smoke test to catch any purely client-runtime UI issues that static typing and API validation cannot surface.

## Context and Orientation

The frontend repository is a React Native Expo app. The current meetups entry point is `src/screens/main/MeetupsScreen.tsx`. That file currently renders four subviews inside one component: `browse`, `my`, `create`, and `preview`. It uses `useMeetups` and `useMyMeetups` from `src/hooks/queries/useMeetups.ts` and makes network calls through `src/api/client.ts`. The meetups API types in the app only include a small `Meetup` interface and a `MeetupAttendee` interface.

The backend repository is a Go API. The current meetup endpoints are implemented in `internal/meetups/handler.go`, backed by direct SQL in `internal/meetups/store.go` and wrapped by cache logic in `internal/meetups/cache_store.go`. The persisted event model is defined by `schema/base.sql` and older migrations. The current `meetups` table is minimal and the current `meetup_attendees` table only represents a confirmed RSVP relationship.

In this plan, “event discovery” means the user-facing list or feed used to find relevant upcoming events. “Organizer back-office” means the set of screens and endpoints a host uses to create, edit, publish, and manage their own events. “Facet” means a countable filter dimension such as category or day of week that can be shown in a filter sheet or chip row. “Cursor pagination” means the backend returns a stable token or ordered boundary for the next page rather than a page number and offset. “Waitlist” means users can express interest after capacity is reached and be promoted later if space opens.

The current product and technical gaps that make a full refactor necessary are:

- discovery only filters by `q` and `city`;
- event records do not include category, event type, venue coordinates, end time, status, or waitlist state;
- listing is ordered only by `starts_at`, which is simple but not discovery-quality;
- creation is a flat form embedded inside the browse screen;
- the detail view is informative but not organizer-grade;
- organizer and attendee workflows are not separated;
- there is no concept of drafts, published state, canceled state, or recurring events;
- there is no explicit support for geospatial filtering or day-of-week filtering;
- the seed dataset does not yet model richer event metadata, though it can be extended.

The implementation described below intentionally spans both repositories. Any contributor following this plan should keep both working trees open and treat the feature as one coordinated system.

## Plan of Work

Implementation proceeds in five milestones. Each milestone leaves the codebase in a shippable and testable state, even if some richer behavior remains behind a compatibility path during migration.

### Milestone 1 — Establish the new event data model and keep the old feature working during migration

The goal of this milestone is to expand the backend schema so that the product can represent a real event platform before the frontend starts depending on richer capabilities.

In `/home/michaelroddy/repos/project_radeon`, add new migrations under `migrations/` and update `schema/base.sql` so the canonical schema stays current. The existing `meetups` table should be evolved rather than replaced in one destructive step. Add fields needed for first-class discovery and creation:

- `category_slug` or a foreign key to an `event_categories` table;
- `event_type` with values like `in_person`, `online`, and `hybrid`;
- `status` with values like `draft`, `published`, `cancelled`, and `completed`;
- `visibility` with at least `public` and `unlisted`;
- `ends_at`;
- `timezone`;
- `venue_name`;
- `address_line_1`;
- `address_line_2`;
- `country`;
- `lat`;
- `lng`;
- `online_url`;
- `cover_image_url`;
- `waitlist_enabled`;
- `waitlist_count`;
- `saved_count`;
- `published_at`;
- `updated_at`;
- optional `how_to_find_us` or equivalent venue guidance text.

Create supporting tables:

- `event_categories` with a stable slug, label, and sort order;
- `event_hosts` so co-hosts can be modeled cleanly;
- `event_waitlist` so capacity overflow is explicit instead of overloaded into `meetup_attendees`;
- `event_saves` if “save for later” is included in the first public rollout;
- `event_occurrences` if recurring events are implemented in the same pass rather than deferred.

Keep `meetup_attendees` or rename it to `event_attendees` in a deliberate migration. If renaming is too risky for one pass, keep the old table name temporarily and migrate the code later, but do not leave the conceptual model ambiguous in new code. If the table keeps its old name during transition, document that clearly in the code comments and this plan.

The store layer in `internal/meetups/store.go` should be refactored into clearer, narrower query helpers. If the file becomes unwieldy, split it into:

- `internal/meetups/store_discovery.go`
- `internal/meetups/store_organizer.go`
- `internal/meetups/store_rsvp.go`
- `internal/meetups/types.go`

Update `seeds/seed.go` so the realistic seed world includes event categories, mixed event types, proper coordinates, venue names, and a range of capacities and attendance states. Seed at least:

- local Irish in-person events,
- a few online events,
- a few full-capacity events with waitlists,
- multiple categories,
- multiple weekday and weekend events,
- multiple hosts.

At the end of this milestone, the database must be able to represent the richer product even if the app is still rendering the older meetup UI.

### Milestone 2 — Introduce the new backend APIs, ranking model, and discovery query strategy

The goal of this milestone is to make the backend capable of serving a high-quality event discovery surface and organizer area without forcing the frontend to fake behavior client-side.

Extend `internal/meetups/handler.go` and the store interfaces so the API supports two clear families of endpoints.

Discovery endpoints:

- `GET /events` or keep `GET /meetups` temporarily with a richer query contract;
- `GET /events/facets` to return category and filter counts for the current query and location scope;
- `GET /events/:id`;
- `GET /events/:id/attendees`;
- `POST /events/:id/rsvp`;
- `DELETE /events/:id/rsvp`;
- `POST /events/:id/waitlist` if waitlist is separate from RSVP.

Organizer endpoints:

- `POST /events`;
- `PATCH /events/:id`;
- `POST /events/:id/publish`;
- `POST /events/:id/cancel`;
- `GET /events/mine`;
- `GET /events/:id/waitlist`;
- `POST /events/:id/waitlist/:userId/promote` if manual promotion exists in v1.

The discovery list query must accept filters for:

- `q` full-text search;
- `category`;
- `city` or location text override;
- `lat` and `lng`;
- `distance_km`;
- `event_type`;
- `date_preset`;
- `date_from`;
- `date_to`;
- `day_of_week`;
- `time_of_day`;
- `open_spots_only`;
- `hosting_scope` or `friends_going` later if added;
- `sort`.

Do not keep the current plain page/offset contract for the public discovery feed. Introduce cursor pagination with a stable response shape such as:

    {
      "items": [...],
      "next_cursor": "...",
      "has_more": true
    }

Organizer listing can remain page/offset if that simplifies rollout, but discovery should move to cursor pagination so new events, RSVP counts, and ranking changes do not make infinite scroll jump unpredictably.

Discovery ranking should use a bounded candidate set plus a deterministic score. For the first version, the score should combine:

- distance to the event for in-person or hybrid events;
- time proximity, with strong preference for upcoming near-term events over distant-future events;
- category affinity based on the user’s interests and prior attendance or saved-event behavior if available;
- friends or familiar users attending, if that signal exists;
- event popularity, capped so large events do not drown out all smaller events;
- organizer quality signals such as a history of published events that retain attendees, if easy to compute;
- recency of publication for tie-breaking and freshness.

Use geospatial filtering at the database level. The preferred path is PostGIS geography points plus GiST indexes. If that is too large a dependency for the first refactor, use numeric latitude/longitude columns with a bounding-box prefilter and exact Haversine distance calculation. Do not rely on `city ILIKE` as the primary location filter once this milestone is complete.

Update `internal/meetups/cache_store.go` to key caches on the full filter signature and viewer context. Cache event detail, first-page discovery results, and organizer result pages separately. Add a facets cache if the counts are expensive. Ensure cache version bumps are granular enough that publishing one event does not invalidate every unrelated event cache forever.

At the end of this milestone, the backend must be able to serve a full event discovery experience and organizer area even if the frontend is still partially migrated.

### Milestone 3 — Replace the current Meetups tab with a dedicated discovery surface and filter sheet

The goal of this milestone is to stop treating event discovery as one segment inside a multi-mode screen and replace it with a purpose-built browse experience.

In `/home/michaelroddy/repos/project_radeon_app`, split `src/screens/main/MeetupsScreen.tsx` into focused screens and components. The recommended structure is:

- `src/screens/main/EventsDiscoverScreen.tsx`
- `src/screens/main/MyEventsScreen.tsx`
- `src/screens/main/CreateEventScreen.tsx` or a flow folder
- `src/components/events/EventFiltersSheet.tsx`
- `src/components/events/EventCard.tsx`
- `src/components/events/EventResultsHeader.tsx`
- `src/components/events/EventEmptyState.tsx`
- `src/components/events/EventSectionCarousel.tsx` if curated sections are used
- `src/hooks/queries/useEventDiscover.ts`
- `src/hooks/queries/useMyEvents.ts`
- `src/hooks/queries/useEventFacets.ts`
- `src/hooks/useEventFilters.ts`

The main discover surface should include:

- a search bar that stays visible;
- a filter button with an active-count badge;
- active chips below the search bar;
- a default top section such as `For You` or `Near You`;
- optional curated rows for `This Week`, `Online Tonight`, `Coffee`, `Running`, `Recovery`, or other app-relevant categories;
- a full-screen filter sheet;
- a stable infinite-scroll list using cursor pagination.

The filter sheet should contain at least these first-release controls:

- category,
- location and distance,
- date preset,
- custom date range,
- day of week,
- time of day,
- event type,
- open spots only,
- sort.

Draft state belongs in the filter sheet; applied state belongs in the discovery screen hook. The discover list must not refetch on every keypress or every tentative filter tap. It should refetch only on committed filter application, except for optional lightweight facet preview requests.

Update `src/api/client.ts` and `src/query/queryKeys.ts` so event discovery has explicit request and response types rather than squeezing into the old meetup shape. Define richer types such as:

- `EventSummary`
- `EventDetail`
- `EventHost`
- `EventVenue`
- `EventFacetResponse`
- `EventFilters`
- `CreateEventInput`
- `UpdateEventInput`

Use distinct query keys for:

- discover results,
- discover facets,
- event detail,
- event attendees,
- my hosted events,
- my going events,
- draft previews if any.

At the end of this milestone, the user should be able to open the Meetups or Events tab and feel like they are using an event discovery product rather than browsing one generic list with a city box.

### Milestone 4 — Build the guided creation flow, detail redesign, and organizer management area

The goal of this milestone is to make event creation and hosting feel intentional and reliable instead of being an embedded form inside a browsing screen.

Replace the inline create form in `src/screens/main/MeetupsScreen.tsx` with a dedicated guided flow. The recommended creation sequence is:

1. Basics: title, category, cover image, event description.
2. Format: in-person, online, or hybrid.
3. Time: start time, end time, timezone, optional recurrence.
4. Location: venue name, address, map pin, city, how to find us, or online link.
5. Capacity and access: capacity, waitlist enabled, visibility.
6. Review and publish: preview card, preview detail, publish confirmation.

If recurrence is too large for the first release, keep the data model ready for it and ship only single-instance events in the UI. Document that explicitly in the final implementation notes rather than leaving a half-finished hidden feature.

Redesign `src/screens/main/MeetupDetailScreen.tsx` into a full `EventDetailScreen` that includes:

- cover image or category hero;
- title and category pill;
- date, start time, end time, and timezone;
- venue block with address and map preview if in-person;
- event type indicator;
- host and co-host information;
- attendee previews with friend/familiar emphasis if available;
- RSVP or waitlist action;
- edit or manage action for organizers;
- related events section.

Build a dedicated organizer area so `My events` is not just “things I created” in a flat list. Separate:

- `Hosting`,
- `Going`,
- `Drafts`,
- `Past`,
- optional `Waitlist` if surfaced at the list level.

Organizer detail should include attendee counts, waitlist counts, edit, publish, cancel, and capacity state. If notifications or reminders exist later, expose them here rather than bloating the discovery screen.

At the end of this milestone, a user should be able to create and manage an event end-to-end without ever needing the old embedded create mode.

### Milestone 5 — Performance hardening, validation, migration cleanup, and retirement of the old meetup path

The goal of this milestone is to make the new feature production-quality and remove the old path safely.

Validation must happen in both repositories:

- run backend tests and any new integration tests;
- run frontend type-checking;
- run the seed and verify the discovery dataset contains enough category, time, and location diversity;
- exercise the app manually in Expo or simulator builds with the local backend;
- verify scroll stability and no duplicate-page glitches on event discovery;
- verify cursor pagination remains stable under new event creation and RSVP changes;
- verify organizer edits invalidate the correct caches and no more.

After confidence is established, remove the obsolete code paths:

- the embedded create subview from `MeetupsScreen.tsx`;
- the old minimal query hook signatures;
- the old `city`-only and `q`-only assumptions in the backend list contract;
- any temporary compatibility aliases kept during migration.

If the route path remains `/meetups` for compatibility, document that as an intentional naming mismatch and optionally plan a future `/events` rename. If renaming to `/events` is done in this pass, update all callers and route registrations and add a brief compatibility note in the backend release notes or plan retrospective.

At the end of this milestone, the old meetup implementation should be gone or clearly isolated, the new event platform should be the only active path, and the final manual validation should show stable behavior with realistic data.

## Concrete Steps

The commands below describe how to implement and validate this feature once execution begins. They are intentionally explicit so a contributor can follow them without prior context.

Start in the backend repository to inspect and extend the event model:

    cd /home/michaelroddy/repos/project_radeon
    sed -n '141,166p' schema/base.sql
    sed -n '1,260p' internal/meetups/handler.go
    sed -n '1,260p' internal/meetups/store.go
    sed -n '1,260p' internal/meetups/cache_store.go

Create migrations for the expanded schema and keep `schema/base.sql` synchronized:

    cd /home/michaelroddy/repos/project_radeon
    ls migrations | tail

After writing migrations, run the backend tests:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build go test ./...

When the schema and backend handlers are ready, reseed realistic event data:

    cd /home/michaelroddy/repos/project_radeon
    set -a && source .env >/dev/null 2>&1 && set +a
    GOCACHE=/tmp/go-build go run ./seeds

Then inspect the frontend meetups surface before refactoring it:

    cd /home/michaelroddy/repos/project_radeon_app
    sed -n '1,260p' src/screens/main/MeetupsScreen.tsx
    sed -n '261,760p' src/screens/main/MeetupsScreen.tsx
    sed -n '1,260p' src/screens/main/MeetupDetailScreen.tsx
    sed -n '1,220p' src/hooks/queries/useMeetups.ts
    sed -n '183,220p' src/api/client.ts

Implement the new app-side event hooks and screen split, then validate the TypeScript build:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Run the backend and frontend together for manual validation:

    cd /home/michaelroddy/repos/project_radeon
    make migrate
    go run ./cmd/api

In a second terminal:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

During manual verification, use the seeded `test@radeon.dev / password123` account and confirm the event discovery feed returns enough nearby and cross-city events to make the new filters meaningful.

Expected short validation transcript examples once implementation is complete:

    GOCACHE=/tmp/go-build go test ./...
    ok  	github.com/project_radeon/api/internal/meetups	(cached)
    ok  	github.com/project_radeon/api/internal/user	(cached)

    npx tsc --noEmit
    [no output]

    GOCACHE=/tmp/go-build go run ./seeds
    → inserting events with categories, formats, and venues…
    → inserting attendees and waitlists…
    ✓ seed complete

## Validation and Acceptance

The feature is accepted only when the following behavior is observable in a running app backed by the migrated local API:

1. Opening the Meetups or Events tab shows a discovery-first surface rather than a mixed browse/create screen. Search is visible. Filters are accessible through a dedicated sheet. Applying `Category = Running`, `Distance = 25 km`, and `Day = Saturday` changes the result set predictably.

2. Infinite scroll remains smooth and stable. Scrolling to the bottom loads the next batch without duplicate cards, jumpy reordering, or a top-of-list loader appearing above the first result.

3. Location-aware filters behave correctly. With the seeded realistic dataset, changing only `Distance` from `10 km` to `50 km` increases the visible result set in a way that matches the local event inventory.

4. The event detail page surfaces venue, event type, attendance state, and hosts clearly. RSVPing updates both the detail view and any list card state without requiring a full screen reload.

5. If an event is full and waitlists are enabled, the user sees a waitlist action instead of a broken RSVP action.

6. The creation flow allows an organizer to create a public in-person event with category, venue, coordinates, date, time, and capacity, publish it, then see it appear in `Hosting` and in the public discovery feed.

7. The organizer area allows the host to view hosted events separately from attended events and to identify drafts, published events, and past events correctly.

8. Backend tests pass, TypeScript validation passes, and the reseed completes without schema mismatches.

If an implementation satisfies only the code-level changes but not these observed behaviors, it is not complete.

## Idempotence and Recovery

All schema work in this plan must be written as additive migrations that can run once safely and be reapplied only through the project’s normal migration tooling. Do not edit old migrations in place. Update `schema/base.sql` after adding each new migration so fresh environments remain reproducible.

Seeding is destructive by design in this repository, so only run the seed against a development database. If a seed fails halfway, terminate any lingering database sessions, fix the schema or seed mismatch, and rerun the seed from scratch. The seed should truncate and rebuild the event-related tables cleanly.

Frontend refactors should be done additively first. Introduce the new event screens and hooks alongside the old `MeetupsScreen` path, then switch navigation over only once the new screens are functioning. Remove the old code after manual validation instead of deleting it at the start.

If a cursor pagination implementation proves too risky to land atomically, keep the old page-based list behind a compatibility path while the new discovery endpoint is validated. The plan still requires the final public discovery surface to use cursor pagination before completion.

## Artifacts and Notes

Current state reference excerpts that justify this refactor:

    schema/base.sql
        CREATE TABLE IF NOT EXISTS meetups (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            city TEXT,
            starts_at TIMESTAMPTZ,
            capacity INT,
            attendee_count INT NOT NULL DEFAULT 0
        );

    internal/meetups/store.go
        WHERE m.starts_at > NOW()
            AND ($2 = '' OR m.city ILIKE $2)
            AND (
                $3 = ''
                OR m.title ILIKE $3
                OR COALESCE(m.description, '') ILIKE $3
            )
        ORDER BY m.starts_at ASC

    src/hooks/queries/useMeetups.ts
        export function useMeetups(params: { q?: string; city?: string; limit?: number }, enabled = true)

These excerpts show why the redesign must begin with the data and API contract rather than only adjusting the UI.

## Interfaces and Dependencies

The backend should continue using Go, `pgx`, and the existing cache abstraction in `pkg/cache` and `internal/meetups/cache_store.go`. Prefer splitting event logic into smaller files under `internal/meetups/` rather than creating a second parallel package.

At the end of implementation, the backend should expose types and interfaces equivalent in intent to:

    type EventSummary struct {
        ID               uuid.UUID
        OrganizerID      uuid.UUID
        Title            string
        CategorySlug     string
        CategoryLabel    string
        Description      *string
        EventType        string
        Status           string
        City             string
        Country          *string
        StartsAt         time.Time
        EndsAt           *time.Time
        Capacity         *int
        AttendeeCount    int
        WaitlistEnabled  bool
        WaitlistCount    int
        IsAttending      bool
        IsWaitlisted     bool
        DistanceKM       *float64
        VenueName        *string
        CoverImageURL    *string
        AttendeePreview  []AttendeePreview
        HostPreview      []HostPreview
    }

    type DiscoverEventsParams struct {
        Query         string
        Category      string
        Latitude      *float64
        Longitude     *float64
        DistanceKM    *int
        EventType     string
        DatePreset    string
        DateFrom      *time.Time
        DateTo        *time.Time
        DayOfWeek     []int
        TimeOfDay     []string
        OpenSpotsOnly bool
        Sort          string
        Cursor        string
        Limit         int
    }

The app should expose matching types in `src/api/client.ts` such as:

    export interface EventFilters {
      q?: string;
      category?: string;
      lat?: number;
      lng?: number;
      distance_km?: number;
      event_type?: 'in_person' | 'online' | 'hybrid';
      date_preset?: 'today' | 'tomorrow' | 'this_week' | 'this_weekend' | 'custom';
      date_from?: string;
      date_to?: string;
      day_of_week?: number[];
      time_of_day?: Array<'morning' | 'afternoon' | 'evening'>;
      open_spots_only?: boolean;
      sort?: 'recommended' | 'soonest' | 'distance' | 'popular' | 'newest';
    }

    export interface EventSummary {
      id: string;
      organizer_id: string;
      title: string;
      category_slug: string;
      category_label: string;
      event_type: 'in_person' | 'online' | 'hybrid';
      status: 'draft' | 'published' | 'cancelled' | 'completed';
      city: string;
      starts_at: string;
      ends_at?: string | null;
      capacity?: number | null;
      attendee_count: number;
      waitlist_enabled: boolean;
      waitlist_count: number;
      is_attending: boolean;
      is_waitlisted: boolean;
      distance_km?: number | null;
      venue_name?: string | null;
      cover_image_url?: string | null;
      attendee_preview?: EventPersonPreview[];
      host_preview?: EventPersonPreview[];
    }

React Query should continue to be the app-side data-fetching layer. Extend `src/query/queryKeys.ts` with distinct keys for discovery, facets, detail, attendees, hosting, going, and creation invalidation. The current `useInfiniteQuery` pattern remains appropriate, but it should be adapted to cursor pagination for discovery and kept page-based only where that is an intentional back-office tradeoff.

Revision note: Created this ExecPlan on 2026-04-26 to convert the current thin meetup feature into a full event platform plan. The document captures the current app and backend limitations, resolves major architectural choices up front, and defines an implementation order that keeps migration risk manageable.
