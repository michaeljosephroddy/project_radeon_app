# Stabilize Meetups Detail, Organizer Workflows, and Event Lifecycle Semantics

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

`PLANS.md` lives at `/home/michaelroddy/repos/project_radeon_app/PLANS.md` and this document must be maintained in accordance with it.

## Purpose / Big Picture

After this work, the meetups feature should behave like a polished paid feature instead of a prototype. A user should be able to RSVP, cancel, manage, and browse events without full-screen flashing. Tapping attendees or hosts on an event should immediately open their profile on top of the detail screen. Organizers should have clear and safe management actions: drafts remain unpublished-only, published events are edited in place, cancelled events leave the upcoming section, cover images appear consistently on cards, and organizers can add co-hosts. The event lifecycle must become predictable enough that a user can trust that "save changes" keeps a live event live and "save draft" only applies to actual draft events.

The visible proof of success is simple. In the app, open an event detail screen and press RSVP or Cancel Event: the page should update without a loading flash. Tap an attendee: their profile should appear immediately above the event detail screen. Open the organizer area: cancelled events should not remain in Upcoming, draft events should stay in Drafts, and published events edited through Manage should remain published. Discover and organizer lists should display cover images when a meetup has one. Drafts and upcoming organizer-owned items should support a clear destructive action pattern without exposing destructive actions in Discover.

## Progress

- [x] (2026-04-26 21:05Z) Create this ExecPlan with root-cause analysis, scope boundaries, and ordered milestones.
- [x] (2026-04-26 21:38Z) Fix full-screen flashing on event detail mutations by separating initial load from in-place mutation refresh.
- [x] (2026-04-26 21:39Z) Fix overlay stacking so attendee and host taps open profiles above meetup detail.
- [x] (2026-04-26 21:46Z) Split organizer event scopes into `upcoming`, `drafts`, `cancelled`, and `past`, and update app/backend contracts to match.
- [x] (2026-04-26 21:42Z) Restore cover images on meetup cards across Discover and organizer lists.
- [x] (2026-04-26 21:47Z) Remove misleading organizer leave behavior and ensure organizer-owned events never present `Leave` as a primary action.
- [x] (2026-04-26 21:49Z) Implement Option A lifecycle semantics: drafts are unpublished only; published events are edited in place.
- [x] (2026-04-26 21:50Z) Redesign meetup form actions so draft and published editing states use distinct buttons and destructive actions.
- [x] (2026-04-26 21:53Z) Add co-host selection and persistence in create/edit flows.
- [x] (2026-04-26 21:55Z) Add organizer-only delete patterns for drafts and eligible upcoming events using a swipe affordance similar to chats.
- [x] (2026-04-26 21:57Z) Preserve meetup coordinates during edit saves even though raw coordinate fields remain out of the visible UI.
- [ ] (2026-04-26 22:00Z) Run manual Expo/device checks covering RSVP, cancel, attendee navigation, edit-in-place, co-hosts, and deletion flows. Completed: backend tests and TypeScript validation. Remaining: manual app verification on device/simulator.

## Surprises & Discoveries

- Observation: The attendee-profile bug is not caused by the attendee row press handler. It is caused by overlay order in the app shell.
    Evidence: In `src/navigation/AppNavigator.tsx`, `UserProfileScreen` is rendered before `MeetupDetailScreen`, so when both are open the meetup detail overlay is painted above the profile overlay.

- Observation: The detail-screen flash on RSVP and Cancel Event is self-inflicted by the screen itself, not by React Query.
    Evidence: In `src/screens/main/MeetupDetailScreen.tsx`, `handlePrimaryAction()` mutates, invalidates queries, and then calls `load()`, while `load()` sets `loading=true` and swaps the entire screen into a loading state.

- Observation: "Save draft changes" for a published event is currently changing the live event row into a draft instead of creating a separate revision.
    Evidence: In `src/screens/main/MeetupsScreen.tsx`, the edit form always calls `api.updateMeetup(editingMeetup.id, validated.values)` and forwards whatever `status` the form chooses. In `internal/meetups/store.go`, `UpdateMeetup(...)` writes `status = $7` directly onto the same `meetups` row.

- Observation: Cancelled events still appearing in Upcoming is a backend scope-definition issue, not a frontend filtering bug.
    Evidence: In `internal/meetups/store.go`, `loadMyMeetups(..., "hosting")` includes `m.status IN ('published', 'cancelled', 'completed')`.

- Observation: Cover images are already present in the meetup payloads but are not rendered in list cards.
    Evidence: `cover_image_url` is selected and returned by the backend, and appears in detail rendering, but `src/components/events/MeetupCard.tsx` does not render an image at all.

- Observation: Coordinates still matter to the backend even though the frontend removed the raw latitude/longitude fields.
    Evidence: `internal/meetups/store.go` still reads and computes against `m.lat` and `m.lng`, including distance decoration for the viewer.

- Observation: Editing an event after the raw coordinate inputs were removed would silently clear existing coordinates on save.
    Evidence: `MeetupUpsertInput` still supports `lat` and `lng`, and `internal/meetups/store.go` writes those columns directly during update. Without hidden form-state preservation, every edit would send `nil` for both fields.

- Observation: Organizer-side mutations were not invalidating other users' cached `Going` pages on the server.
    Evidence: `cachedStore.bumpMeetupVersions(...)` already bumped the global meetups version, but `ListMyMeetups` cache keys were only using the per-user `myMeetupsVersionKey(userID)`. Attendees could therefore refetch against a stale server-side `Going` cache after an organizer cancelled or deleted an event.

## Decision Log

- Decision: Use Option A for event lifecycle semantics.
    Rationale: Published events are edited in place. Drafts remain unpublished-only. This removes the most dangerous ambiguity without introducing event-revision infrastructure.
    Date/Author: 2026-04-26 / Codex

- Decision: Write a new stabilization ExecPlan instead of rewriting `MEETUPS_PLATFORM_REFACTOR_EXECPLAN.md`.
    Rationale: The platform refactor plan describes the broader shipped feature. This follow-up plan is a corrective, behavior-focused hardening pass and should stand on its own for implementation and review.
    Date/Author: 2026-04-26 / Codex

- Decision: Treat organizer "leave" as invalid product behavior for now.
    Rationale: An organizer cannot leave their own event in a meaningful way without either transferring organizer ownership or cancelling/deleting the event. Until transfer exists, organizer actions should be `Manage`, `Save changes`, `Cancel event`, or `Delete draft`, not `Leave`.
    Date/Author: 2026-04-26 / Codex

- Decision: Keep coordinate support in the backend model.
    Rationale: Coordinates are already useful for event distance and discovery quality. The frontend issue is poor coordinate capture UX, not the existence of coordinates themselves.
    Date/Author: 2026-04-26 / Codex

- Decision: Preserve existing coordinates during event edits without reintroducing raw latitude/longitude inputs into the visible form.
    Rationale: This fixes the silent data-loss bug immediately while avoiding a regression back to poor raw-coordinate UX. A richer place-selection flow can be added later without blocking the stabilization pass.
    Date/Author: 2026-04-26 / Codex

- Decision: Tie `ListMyMeetups` server-cache entries to the global meetups version as well as the per-user organizer version.
    Rationale: Organizer-side cancellations, deletions, and edits must invalidate attendee-facing `Going` data immediately enough to avoid stale server responses after the client invalidates its local cache.
    Date/Author: 2026-04-26 / Codex

## Outcomes & Retrospective

The core stabilization pass is implemented across both repositories. The detail screen no longer forces a full loading-state flash after RSVP or cancel actions. User profiles opened from attendee and host rows now stack above meetup detail instead of behind it. Organizer event scopes are split into `upcoming`, `drafts`, `cancelled`, and `past`, and Option A lifecycle semantics are enforced so published events stay published when edited. Meetup cards now render cover images, co-host selection exists in the organizer form, and organizer-only swipe actions provide draft deletion plus upcoming-event delete or cancel affordances.

Two important implementation discoveries slightly reshaped the work. First, coordinate removal from the visible form had created silent data loss on edit, so the implementation preserves coordinates in hidden form state even though raw numeric coordinate fields remain absent from the UI. Second, attendee `Going` caches on the server needed broader invalidation than originally planned, so the server-side `my meetups` cache key now also tracks the global meetups version.

The remaining gap is manual Expo/device verification. Backend tests and TypeScript validation passed, but the final acceptance scenarios still need to be exercised on a running app build to confirm the user-visible flows behave as intended on device.

## Context and Orientation

The meetups feature spans both repositories. The frontend lives in `/home/michaelroddy/repos/project_radeon_app` and the backend lives in `/home/michaelroddy/repos/project_radeon`. The frontend uses React Native with Expo. The backend is a Go HTTP API with PostgreSQL storage. A "scope" in this document means a named organizer list such as upcoming or drafts, returned by the API and displayed in the app. A "detail mutation" means a user-triggered state change on the event detail screen such as RSVP, leaving a waitlist, publishing a draft, or cancelling an event. A "draft" means an unpublished meetup row whose status is `draft`. A "published event" means a live meetup row whose status is `published`.

The key frontend files are:

- `src/navigation/AppNavigator.tsx`, which owns overlay ordering for screens such as user profile and meetup detail.
- `src/screens/main/MeetupsScreen.tsx`, which contains the discover, hosting, going, and create/manage flows.
- `src/screens/main/MeetupDetailScreen.tsx`, which loads event detail, attendees, waitlist state, and mutation actions.
- `src/components/events/MeetupCard.tsx`, which renders meetup cards in lists.
- `src/components/events/MeetupForm.tsx`, which renders the create/manage form and its action buttons.
- `src/api/client.ts`, which defines the meetup API contracts shared across the app.

The key backend files are:

- `internal/meetups/handler.go`, which parses requests, validates payloads, and exposes the HTTP meetups endpoints.
- `internal/meetups/store.go`, which implements PostgreSQL queries for discovery, organizer lists, detail loading, RSVP, cancel, publish, and update behavior.
- `internal/meetups/types.go` and `internal/meetups/logic.go`, which define the data model and validation or enum helpers used by the meetups feature.
- `cmd/api/main.go`, which wires routes into the API server.

Today, several user-visible bugs come from the interaction between these files. The detail screen is visually unstable because it swaps back into full-screen loading after each mutation. The profile overlay appears behind meetup detail because overlay order in `AppNavigator` is wrong. Published-event editing and draft editing share the same update path, so saving a draft while editing a published event demotes the live event to draft status. The organizer list scope called `hosting` currently returns cancelled items in the same dataset as future published events. Meetup cards do not render the event banner image even though the API provides it. Co-host support exists only as stored data for display, not as an editable workflow.

## Plan of Work

Begin with the smallest changes that remove broken visible behavior without changing data shape. In `src/screens/main/MeetupDetailScreen.tsx`, replace the single `loading` gate with separate state for initial page load and mutation-in-progress. `load()` should be split into an initial loader and a quiet refresh path. RSVP, waitlist leave, draft publish, and cancel should update `detail` immediately and then refresh attendees or waitlist data without blanking the whole screen. Query invalidation should remain, but it must not force the detail screen into a top-level loading placeholder after a user presses a button.

Next, fix navigation layering in `src/navigation/AppNavigator.tsx`. The user profile overlay must render after the meetup detail overlay so that attendee and host taps visibly open the profile above the detail screen. Preserve the existing back behavior: pressing back from the profile should reveal the meetup detail screen beneath it instead of dropping the user all the way back to discover.

Then correct event-list semantics across frontend and backend. In `internal/meetups/store.go`, replace the current organizer scope behavior with explicit `upcoming`, `drafts`, `cancelled`, and `past` scopes. `upcoming` must return only future published events owned by the organizer. `drafts` must return only draft rows. `cancelled` must return cancelled events. `past` must contain completed or already-started historical events for hosting or attendance history. Update `internal/meetups/handler.go`, `internal/meetups/logic.go`, and `src/api/client.ts` so these scopes are the only valid ones. Then adjust `src/screens/main/MeetupsScreen.tsx` to use these new scopes and relabel the organizer sub-tabs accordingly. This change removes cancelled events from the active hosting section and creates a dedicated place for them.

After the list semantics are correct, restore visual fidelity by updating `src/components/events/MeetupCard.tsx` to render `cover_image_url` when present. The card must maintain the existing information density but include a properly cropped cover image so Discover and organizer lists match the detail screen’s visual hierarchy. This is also the right time to ensure the card layout remains performant by keeping the image treatment simple and memoized.

Once the list and detail views are stable, fix the organizer action model in `src/screens/main/MeetupsScreen.tsx` and `src/screens/main/MeetupDetailScreen.tsx`. Organizer-owned events should never render a primary label of `Leave`. In organizer contexts they should show `Manage`, and in detail they should expose organizer-specific actions. In the Going list, either exclude organizer-owned events entirely or still surface them as `Manage`; this plan chooses exclusion because Going should represent attendance rather than hosting. Align label and action routing so the button text and the executed behavior always match.

The next change is the most important data-behavior correction: implement Option A in both app and backend. In the frontend form flow, "save draft" must only be available for draft events or new unpublished events. When managing a published event, the form must not send `status: draft`; it should save changes while preserving `status: published`. In the backend, no schema change is needed for this rule because the existing `UpdateMeetup(...)` path can continue to edit the live row in place. The frontend must simply stop presenting a fake draft-revision path for published events. Redesign the meetup form action area in `src/components/events/MeetupForm.tsx` accordingly. For drafts, show `Publish event` as primary and `Save draft` as secondary. For published events, show `Save changes` as primary and move destructive actions such as Cancel Event into a lower-emphasis destructive affordance rather than placing them beside publish controls.

After lifecycle semantics are correct, extend organizer capabilities by wiring co-host selection through the full stack. In the backend, add host identifiers to the create/update meetup input types in `internal/meetups/types.go` and `internal/meetups/handler.go`, validate them, and update `event_hosts` in `internal/meetups/store.go`. Preserve the organizer as the required primary host and prevent duplicate host rows. In the frontend, add a co-host selector to `src/components/events/MeetupForm.tsx` and supporting logic in `src/screens/main/MeetupsScreen.tsx`. Reuse existing user search/profile data where practical, but keep the UI simple: organizer shown first, selected co-hosts beneath, remove controls for co-hosts, and clear validation if a chosen host is invalid.

Finally, add a clear deletion model. Reuse the existing swipe gesture pattern from `src/screens/main/ChatsScreen.tsx` for organizer-only lists in `src/screens/main/MeetupsScreen.tsx`. Do not add swipe delete in Discover. On the backend, add a delete endpoint for drafts and define the policy for published events. This plan chooses a conservative policy: drafts can be hard deleted; published upcoming events should default to Cancel Event rather than hard delete unless the event has no attendees or product requirements explicitly allow deletion. The frontend should reflect that distinction clearly in confirmation prompts.

Coordinates are intentionally left until the end because they are not blocking the current correctness bugs. If the implementation phase finds that location-based meetup ranking or filtering materially degrades without frontend-supplied coordinates, add a proper venue-location capture flow that derives coordinates from address or current location. Do not reintroduce raw numeric latitude/longitude inputs unless no better option exists.

## Concrete Steps

Work from both repositories. Use a dedicated feature branch in each repository before implementation starts.

From `/home/michaelroddy/repos/project_radeon_app`:

    git checkout -b feature/meetups-stabilization-pass
    sed -n '1,260p' src/navigation/AppNavigator.tsx
    sed -n '1,280p' src/screens/main/MeetupDetailScreen.tsx
    sed -n '1,260p' src/components/events/MeetupCard.tsx
    sed -n '1,260p' src/components/events/MeetupForm.tsx
    sed -n '180,760p' src/screens/main/MeetupsScreen.tsx

From `/home/michaelroddy/repos/project_radeon`:

    git checkout -b feature/meetups-stabilization-pass
    sed -n '1,320p' internal/meetups/handler.go
    sed -n '320,920p' internal/meetups/store.go
    sed -n '1,220p' internal/meetups/types.go
    sed -n '1,180p' internal/meetups/logic.go

During implementation, keep this file updated. After completing each milestone, add dated entries to `Progress`, record any changed assumptions in `Decision Log`, and note newly discovered behavior in `Surprises & Discoveries`.

Expected command examples during implementation:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build go test ./internal/meetups ./pkg/middleware

Expected result:

    ok  	github.com/project_radeon/api/internal/meetups	...
    ok  	github.com/project_radeon/api/pkg/middleware	...

And from the app repository:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Expected result:

    TypeScript exits successfully with no diagnostics.

If manual device verification is required:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

Then open the Meetups tab on device or simulator and run the acceptance scenarios listed below.

## Validation and Acceptance

Backend validation must prove that organizer scopes now behave correctly. Add or update tests so that `upcoming` excludes cancelled and draft events, `drafts` returns only draft events, and `cancelled` returns cancelled events. Add tests for co-host persistence and any new delete behavior. If a delete endpoint is introduced, add tests showing drafts can be deleted and that published-event deletion or cancellation follows the intended rules.

Frontend validation must prove that mutation UX is stable. On a real device or simulator, open an event detail screen, press RSVP, and verify that the detail view remains visible without a full-page flash. Press Leave or Join Waitlist where applicable and expect the same. As organizer, open a published event and press Cancel Event; the detail page should update status in place without flashing. Tap an attendee or host and verify their profile opens immediately above the detail screen; pressing back should reveal the same detail screen underneath.

Organizer workflow validation must prove Option A is working. Create a draft event, save it, reopen it, and publish it. Then manage a published event, change title or description, press Save Changes, and verify it remains visible in Discover and Upcoming as a published event. It must not move into Drafts. Cancel that event and verify it leaves Upcoming and appears only in Cancelled. Discover and organizer cards for events with cover images must render the banner image consistently.

Deletion validation must prove destructive affordances are correctly scoped. In organizer Upcoming and Drafts, swipe an item and verify the destructive affordance appears. Confirm that no such swipe affordance exists in Discover. Deleting a draft should remove it entirely. Cancelling a published event should not remove it from history; it should move to Cancelled.

Co-host validation must prove organizer collaboration works. Create or edit an event, add one or more co-hosts, save, reopen the detail page, and verify the host list shows organizer plus co-hosts. Reopen the manage form and ensure selected co-hosts persist. Attempt to add the organizer as a duplicate co-host and expect validation to prevent it.

## Idempotence and Recovery

This work should be implemented incrementally and safely. Most frontend changes are idempotent: rerunning `npx tsc --noEmit` and reopening the app after edits should simply confirm the current state. Backend tests can be rerun safely. If a scope or lifecycle change breaks organizer list rendering, recover by reverting only the contract changes for the affected scope and rerunning meetups tests before continuing. If co-host persistence proves too large to complete in the same pass, the implementation may stop after lifecycle stabilization only if this ExecPlan is updated to split the incomplete milestone clearly and document the remaining backend and UI work.

Do not delete production meetup rows manually while testing. Use seeded or local development data. If schema changes become necessary for deletion or host management, make them additive and reversible through a migration file instead of editing data in place.

## Artifacts and Notes

Important known code excerpts at the time this plan was written:

    src/navigation/AppNavigator.tsx
        UserProfileScreen is rendered before MeetupDetailScreen inside the overlay stack.

    src/screens/main/MeetupDetailScreen.tsx
        handlePrimaryAction() mutates, invalidates queries, and then calls load().
        load() sets loading=true and swaps to the loading placeholder.

    src/screens/main/MeetupsScreen.tsx
        submitMeetup(status) uses api.updateMeetup(editingMeetup.id, validated.values)
        for both draft edits and published-event edits.

    internal/meetups/store.go
        loadMyMeetups(..., "hosting") includes published, cancelled, and completed statuses.

    src/components/events/MeetupCard.tsx
        cover_image_url exists in data but is not rendered.

These excerpts are not implementation instructions by themselves; they are the observed fault lines that this plan is intended to correct.

## Interfaces and Dependencies

The frontend will continue using React Native, Expo, React Query, and the app’s existing callback-based screen opening model. No new global state library should be introduced. Reuse the existing `Swipeable` component from `react-native-gesture-handler` for organizer delete gestures, following the pattern already used in `src/screens/main/ChatsScreen.tsx`.

At the end of implementation, the following interface changes should exist:

- In `src/api/client.ts`, the organizer scope type must include `upcoming`, `drafts`, `cancelled`, and `past`, and remove or stop using the overloaded `hosting` meaning for active organizer events.
- In `internal/meetups/logic.go` and `internal/meetups/handler.go`, the valid scope set must match the frontend exactly.
- In `internal/meetups/types.go`, create/update payload types must support co-host identifiers if co-host management is implemented in the same pass.
- In `internal/meetups/store.go`, organizer list queries must treat upcoming, drafts, cancelled, and past as distinct datasets with stable semantics.
- In `src/components/events/MeetupForm.tsx`, the form action API should distinguish between draft-only secondary actions and published-event save actions so the UI cannot accidentally send a published event back to draft status.

If a delete endpoint is introduced, define it explicitly in both repositories and keep its policy narrow: draft hard delete first, published-event hard delete only if product rules and backend tests prove it is safe.

Revision note: Created on 2026-04-26 to drive the post-launch stabilization pass for the meetups/events feature after identifying flash, overlay, lifecycle, organizer-scope, and cover-image regressions in the shipped implementation.

Revision note: Updated on 2026-04-26 after implementation to record completed milestones, the coordinate-preservation fix, the broader server-cache invalidation change, and the remaining manual app-verification work.
