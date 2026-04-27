# Support Screen UX Redesign

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`. The backend repository at `/home/michaelroddy/repos/project_radeon` also contains a `PLANS.md` file with the same operating standard, and any backend adjustments needed to support this redesign should follow that standard as well.

## Purpose / Big Picture

The new support-routing platform is materially stronger than the old board-first system, but the current app surface now exposes too much of the backend model directly. It mixes role-based navigation (`Get help`, `Support others`), content-lane navigation (`Community`), and an action tab (`Create`) at the same level. That makes the support screen feel heavier than it needs to.

The goal of this redesign is to simplify the support experience without discarding the new backend architecture. The final UI should feel more like the meetups screen: a small number of stable top-level tabs, scoped nested tabs beneath them, and clear separation between open work and completed history. The user should not need to understand support routing as a system. They should only need to understand where to go to help now, browse community requests, manage their own requests, or create a new one.

The final target information architecture is:

- top-level tabs: `Immediate`, `Community`, `My requests`, `Create`
- nested tabs:
  - `Immediate`: `Open`, `Completed`
  - `Community`: `Open`, `Completed`
  - `My requests`: `Open`, `Completed`
  - `Create`: `Immediate`, `Community`

The proof will be visible in a local app run. The support screen should no longer present `Get help` or `Support others` as top-level destinations. Instead, the top tab bar should mirror the meetups screen structure, the nested tabs should organize state cleanly, and request/session cards should move into the correct surfaces without changing the core fulfillment behavior already implemented on the backend.

## Progress

- [x] (2026-04-27 16:06Z) Re-audited the current `SupportScreen.tsx` structure after the support-routing rollout and compared it against the meetups-screen tab pattern in `src/screens/main/MeetupsScreen.tsx`.
- [x] (2026-04-27 16:10Z) Identified the main UX problem: top-level tabs currently mix role, lane, and action, which makes support harder to scan than meetups.
- [x] (2026-04-27 16:18Z) Settled the revised information architecture with the user: `Immediate`, `Community`, `My requests`, and `Create` as top-level tabs, each with simple nested state tabs.
- [x] (2026-04-27 16:24Z) Authored this ExecPlan for the support-screen redesign. No implementation code has been changed yet under this plan.
- [x] (2026-04-27 16:43Z) Added the small backend read refinement in `/home/michaelroddy/repos/project_radeon/internal/support/store.go` so `ListMySupportRequests(...)` now returns `channel`, routing metadata, and matched-session metadata, and community board reads are explicitly community-only.
- [x] (2026-04-27 16:58Z) Reworked `src/screens/main/SupportScreen.tsx` around the new meetups-style IA: `Immediate`, `Community`, `My requests`, and `Create` top-level tabs with nested `Open` / `Completed` scopes and `Create > Immediate | Community`.
- [x] (2026-04-27 17:06Z) Removed the extra review-stage request flow and simplified creation to direct submit from the scoped create form.
- [x] (2026-04-27 17:11Z) Validated the redesign with `npx tsc --noEmit`, `go test ./internal/support -count=1`, and `go test ./internal/chats/... ./cmd/api/...`.

## Surprises & Discoveries

- Observation: the current support screen is not confusing because it has too much data; it is confusing because the navigation model is inconsistent.
    Evidence: `src/screens/main/SupportScreen.tsx` currently uses top-level tabs for `Get help`, `Support others`, `Community`, and `Create`, which mixes user role, support lane, and action in one control.

- Observation: the meetups screen pattern is a better fit for support than the current support screen pattern.
    Evidence: `src/screens/main/MeetupsScreen.tsx` cleanly separates a primary segmented control from scoped secondary controls and section headers, while `SupportScreen.tsx` currently branches into large role-specific views.

- Observation: the new support backend does not need a conceptual redesign to support this UI change.
    Evidence: the routed immediate-request model, community-request model, support sessions, offer queue, and request history already exist; the problem is how those objects are presented in the app.

- Observation: a dedicated `My requests` top-level tab is more coherent than burying “mine” inside `Community`.
    Evidence: user-owned support requests span both immediate and community lanes, so treating “mine” as community-only would hide active immediate requests in the wrong place.

- Observation: separate `Active` and `Recent` tabs are unnecessary for this product.
    Evidence: the user explicitly rejected that structure, and the data model already has a simpler lifecycle split available: open work versus completed work.

## Decision Log

- Decision: the support screen will use four top-level tabs: `Immediate`, `Community`, `My requests`, and `Create`.
    Rationale: these are all real destinations, unlike the current mixed set of role tabs plus a create action. This keeps the navigation model consistent and easier to scan.
    Date/Author: 2026-04-27 / Codex

- Decision: `Immediate` will be organized into `Open` and `Completed`, not `Active`, `Queue`, or `Recent`.
    Rationale: the user does not need separate tabs for live versus queued support if both are still actionable. `Open` is the correct mental model.
    Date/Author: 2026-04-27 / Codex

- Decision: `Community` will be organized into `Open` and `Completed`.
    Rationale: the community lane is fundamentally a request board plus history. `Open` and `Completed` are simpler and more consistent than `Discover` and other more feed-like labels.
    Date/Author: 2026-04-27 / Codex

- Decision: `My requests` will combine immediate and community requests in one place, separated only by request-type badges and status ordering.
    Rationale: users think “my requests” first, not “my community requests” or “my immediate requests” separately. This tab becomes the requester’s management home.
    Date/Author: 2026-04-27 / Codex

- Decision: `Create` will remain a top-level tab and will use nested tabs for `Immediate` and `Community`.
    Rationale: the user explicitly wants creation easy to access. Keeping it top-level preserves that while still keeping the rest of the IA clean.
    Date/Author: 2026-04-27 / Codex

- Decision: the redesign will reuse the existing support-routing backend behavior and only make backend changes where the new UI needs different aggregate payloads or ordering support.
    Rationale: the routing architecture is already in place; the immediate need is UX simplification, not a second backend rebuild.
    Date/Author: 2026-04-27 / Codex

## Outcomes & Retrospective

The redesign is now implemented. The support screen no longer exposes `Get help` and `Support others` as the primary model. Instead, the app now uses one consistent navigation system built around support lanes and request ownership.

The most important lesson from execution is that the routing platform itself did not need another conceptual rewrite. The necessary backend change was small: the frontend only needed reliable request-lane metadata and clearer board filtering to present the newer architecture cleanly.

The main success criterion was simplicity, not additional capability. That outcome was achieved. The support screen now feels structurally closer to meetups, creation is lighter weight, and the user has one obvious place to manage their own requests without losing the distinct immediate and community lanes.

## Context and Orientation

This repository is the Expo frontend at `/home/michaelroddy/repos/project_radeon_app`. The backend is a separate Go service at `/home/michaelroddy/repos/project_radeon`.

The current support UI is centered in `src/screens/main/SupportScreen.tsx`. That screen already consumes the newer routing-platform APIs through `src/hooks/queries/useSupport.ts` and `src/api/client.ts`, but it still frames them through role-based top-level tabs and large branch-specific layouts. The meetups screen in `src/screens/main/MeetupsScreen.tsx` is the structural reference for this redesign because it already demonstrates the app’s preferred pattern for primary and secondary segmented controls.

The support backend already has the main primitives this redesign needs:

- immediate support requests routed through support offers
- responder queue reads
- support sessions
- session completion
- community support requests as the async lane

That means the redesign can focus on restructuring the app surface first and only add backend support where the frontend would otherwise need to stitch together too many different query sources inefficiently.

The key term in this plan is `open work`. Open work means everything still actionable or still live for the user:

- immediate routed offers that have not been accepted or declined
- active support sessions
- open support requests
- routed immediate requests still looking for a match

The second key term is `completed work`. Completed work means closed or resolved items:

- completed immediate support sessions
- closed community requests
- closed immediate requests

This redesign intentionally avoids more granular tab states than that.

## Plan of Work

### Milestone 1: Reframe the support screen state model around the new information architecture

The first milestone is purely structural. In `src/screens/main/SupportScreen.tsx`, replace the current top-level support-surface state with a new primary tab state for `Immediate`, `Community`, `My requests`, and `Create`. Add separate secondary tab state for each top-level surface:

- `Immediate`: `Open`, `Completed`
- `Community`: `Open`, `Completed`
- `My requests`: `Open`, `Completed`
- `Create`: `Immediate`, `Community`

This milestone should also rename and regroup derived lists in the screen so they match the new UX model rather than the current role model. For example, immediate routed offers and active support sessions should no longer be prepared only for a responder-specific view; they should be grouped as `Immediate > Open`. Likewise, the user’s immediate and community requests should be merged into the `My requests` surfaces with clear request-type badges and stable ordering.

Do not change backend behavior yet in this milestone. The goal is to get the screen’s state tree and branching logic aligned with the new IA first.

### Milestone 2: Rebuild the top-level screen layout to match the meetups pattern

The second milestone updates the layout structure. The support screen should use the same visual pattern as meetups:

- primary segmented control pinned near the top
- section header or info card beneath the top tabs
- secondary segmented control only within the active section
- content scrolling underneath the pinned top tabs

This milestone should remove the large role-based branch blocks currently used for `Get help` and `Support others`. Replace them with smaller section renderers:

- `renderImmediateOpen`
- `renderImmediateCompleted`
- `renderCommunityOpen`
- `renderCommunityCompleted`
- `renderMyRequestsOpen`
- `renderMyRequestsCompleted`
- `renderCreateImmediate`
- `renderCreateCommunity`

These do not need to become separate files immediately, but they should become separate render functions or extracted components so the screen stops behaving like one large conditional tree.

### Milestone 3: Redesign `Immediate` around open and completed work

This milestone focuses on `Immediate`.

`Immediate > Open` should include:

- immediate availability controls
- incoming routed offers
- active immediate support sessions the user is part of
- any still-open immediate support connection state

This view should be ordered so the most actionable work appears first:

1. active sessions
2. pending offers
3. other still-open immediate items

`Immediate > Completed` should include:

- completed immediate support sessions
- closed immediate requests relevant to the user

If the current app does not yet expose enough data to render completed immediate requester items cleanly, add the smallest backend read needed for that purpose rather than keeping awkward app-side stitching forever.

### Milestone 4: Redesign `Community` around open and completed board activity

This milestone focuses on `Community`.

`Community > Open` should show the public async board:

- open community requests from others
- response actions
- optional community availability card

`Community > Completed` should show community items the user has completed or participated in, but only if they are meaningful enough to justify the space. If that dataset is too noisy, constrain this view to the user’s own completed community requests and any explicit completed-response relationships already tracked in the backend.

This milestone should also simplify copy. Community should be clearly framed as the broader async lane, not as the primary support product.

### Milestone 5: Build `My requests` as the requester’s management home

This milestone is the most important UX addition.

`My requests > Open` should merge the user’s open immediate and community requests into one list. Every card must show a request-type badge (`Immediate` or `Community`) and should surface the correct summary:

- immediate: routing status, matched state, or active session state
- community: response summary, response count, or latest response metadata

The ordering should be:

1. matched or active immediate requests
2. pending immediate requests
3. open community requests
4. older open items

`My requests > Completed` should contain the user’s closed immediate and community requests, again with clear type badges.

If the existing query shape makes this merge too expensive or awkward in the app, add a backend convenience endpoint or response shape for `my open requests` and `my completed requests` rather than overfitting the frontend with too much client-side merging logic.

### Milestone 6: Simplify `Create` into two scoped request flows

This milestone updates the creation surface.

`Create` remains a top-level tab and uses nested tabs:

- `Create > Immediate`
- `Create > Community`

The create flow should feel lighter than it does today. Support requests are not meetups; they do not need the same heavy review-oriented workflow. Unless a concrete validation issue appears during implementation, remove the preview/review step and allow direct submit from the form.

The immediate create form should emphasize that the request will be routed privately to available supporters. The community create form should emphasize that the request will be posted to the wider async board.

### Milestone 7: Add only the backend support needed to make the new UI efficient

The redesign should prefer existing backend primitives where possible, but it should not force the frontend into wasteful stitching. Add backend work only where the new screen needs cleaner or cheaper reads.

Likely candidates:

- a more direct `my requests` read that returns immediate and community requests together with enough status metadata for `Open` and `Completed`
- a cleaner completed-immediate history read if current support-session history is not enough
- small payload refinements for request-type badges, routing summaries, or closed-state grouping

Do not re-architect routing again in this milestone. This is a UI-alignment pass, not a second platform rewrite.

### Milestone 8: Cleanup, copy, and validation

After the new structure is in place:

- remove the old `Get help` and `Support others` naming from the support surface
- remove dead state branches and unused helpers in `SupportScreen.tsx`
- tighten empty states and header copy
- verify scroll, refresh, and pagination behavior on each surface
- ensure the top tabs remain pinned and nested tabs behave consistently with meetups

At the end of this milestone, the support feature should feel like one coherent product instead of a set of stitched-together workflows.

## Concrete Steps

The commands below are the exact commands that should be used during implementation. This plan is primarily frontend, with optional additive backend support if the UI needs better aggregate reads.

In the frontend repository:

    cd /home/michaelroddy/repos/project_radeon_app
    git checkout -b codex/support-screen-ux-redesign

Inspect the current support and meetups screens before editing:

    sed -n '1,260p' src/screens/main/SupportScreen.tsx
    sed -n '1480,1825p' src/screens/main/SupportScreen.tsx
    sed -n '640,920p' src/screens/main/MeetupsScreen.tsx

Typecheck before edits:

    npx tsc --noEmit

Rerun after each milestone:

    npx tsc --noEmit

Start the app:

    npx expo start

If backend read refinements are needed:

    cd /home/michaelroddy/repos/project_radeon
    git checkout -b codex/support-screen-ux-redesign-backend

Inspect the current support handlers and store reads:

    rg -n "support session|SupportSession|List.*Support|my requests|community" internal/support

Run backend tests before and after any backend changes:

    env GOPATH=/tmp/go GOMODCACHE=/tmp/go/pkg/mod GOCACHE=/tmp/go-build-support-ui GOSUMDB=off go test ./internal/support -count=1
    env GOPATH=/tmp/go GOMODCACHE=/tmp/go/pkg/mod GOCACHE=/tmp/go-build-support-ui GOSUMDB=off go test ./internal/chats/... ./cmd/api/...

## Validation and Acceptance

Acceptance is behavioral and structural.

First validate navigation clarity. Open the support screen and confirm the top tabs are exactly:

- `Immediate`
- `Community`
- `My requests`
- `Create`

There should be no remaining top-level `Get help` or `Support others` labels.

Then validate each tab:

`Immediate > Open`
- shows routed offers if the user has any
- shows active immediate support sessions if the user is in any
- shows availability controls
- feels like one “live work” surface, not separate role surfaces

`Immediate > Completed`
- shows finished immediate items only

`Community > Open`
- shows open async community requests from others

`Community > Completed`
- shows the chosen completed community history set without becoming noisy

`My requests > Open`
- shows both immediate and community requests owned by the user
- clearly labels each request type
- orders urgent immediate items first

`My requests > Completed`
- shows both immediate and community requests that are closed

`Create`
- shows nested `Immediate` and `Community`
- allows direct submit without unnecessary extra friction unless validation proves a review step is still needed

Also validate layout behavior:

- primary tabs remain pinned
- content scrolls underneath the pinned tabs
- nested tabs appear only within the active surface
- empty states and loading states do not cause whole-screen flicker

If backend read refinements are added, validate that they reduce frontend stitching complexity rather than simply moving the same complexity server-side without a real product benefit.

## Idempotence and Recovery

This redesign should be additive and reversible while it is under development. Do not remove backend routing behavior or community support behavior. The safe rollback path is to keep the existing support-routing backend and revert only the support-screen UI if the redesign proves unstable.

If a backend convenience endpoint is added for `My requests`, keep the existing endpoints available until the new screen is validated. The redesign should not depend on destructive backend cleanup as part of first rollout.

If the simplified create flow increases user errors unexpectedly, the recovery path is to restore a lightweight review step only for the affected request type rather than bringing back the heavier role-based navigation.

## Artifacts and Notes

- Reference layout pattern: `src/screens/main/MeetupsScreen.tsx`
- Main implementation target: `src/screens/main/SupportScreen.tsx`
- Existing support data hooks: `src/hooks/queries/useSupport.ts`
- Existing support API client types and methods: `src/api/client.ts`
- Backend support platform foundation already exists under `/home/michaelroddy/repos/project_radeon/internal/support`
