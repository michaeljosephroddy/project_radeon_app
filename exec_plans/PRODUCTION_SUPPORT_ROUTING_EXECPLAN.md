# Production-Grade Support Routing Platform Replacement

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`. The backend repository at `/home/michaelroddy/repos/project_radeon` also contains a `PLANS.md` file with the same operating standard, and implementation work in that repository should follow that standard as well.

## Purpose / Big Picture

The current support feature works like a public request board. A user posts a request, other users browse a list, and a response can create or reopen a support chat immediately. That is good enough for a first social feature, but it is not the right production design for a support network where users may need timely, private, trustworthy help. It is too passive for urgent cases, too noisy for responders, and too eager about creating chats before there is a real match.

The replacement target is a routing system with two distinct lanes. The first lane is `Immediate support`, where the app actively finds a small number of good-fit responders and routes offers to them in near real time. The second lane is `Community support`, where the user wants broader asynchronous encouragement and can still receive responses from the community without urgent routing expectations. After this change, a requester should be able to say “I need help now” and see the app actively finding support instead of passively hoping somebody notices a card. A responder should see a personalized queue of offers that match their availability and capacity instead of a raw public board.

The proof will be visible in a local end-to-end run. A requester creates an immediate support request. The backend creates targeted offers, a responder receives an offer in their queue, accepts it, and only then is a support session and chat created. A separate community request remains visible in a community queue and can gather asynchronous responses without the immediate-routing flow. The old board-based support path should remain available during migration, but it should stop being the final product surface.

## Progress

- [x] (2026-04-27 11:10Z) Audited the current frontend support flow in `src/screens/main/SupportScreen.tsx`, `src/hooks/queries/useSupport.ts`, and `src/api/client.ts`.
- [x] (2026-04-27 11:18Z) Audited the current backend support flow in `/home/michaelroddy/repos/project_radeon/internal/support/handler.go`, `/home/michaelroddy/repos/project_radeon/internal/support/store.go`, and `/home/michaelroddy/repos/project_radeon/internal/support/cache_store.go`.
- [x] (2026-04-27 11:24Z) Audited the current support-chat coupling in `/home/michaelroddy/repos/project_radeon/internal/chats/store.go` and the app chat screens that consume support chat context.
- [x] (2026-04-27 11:31Z) Identified the main production gaps: public-board-first fulfillment, binary responder availability, inline list ranking as the primary matching engine, eager chat creation on response, and missing responder-quality and load controls.
- [x] (2026-04-27 11:46Z) Authored this cross-repository ExecPlan for a routing-based support platform with offers, sessions, responder presence, and a secondary async community lane.
- [x] (2026-04-27 12:06Z) Created implementation branches `codex/support-routing-platform` in `/home/michaelroddy/repos/project_radeon` and `codex/support-routing-platform-client` in `/home/michaelroddy/repos/project_radeon_app`.
- [x] (2026-04-27 12:24Z) Added backend schema and foundation code: migrations `041_support_routing_foundation.sql` and `042_support_routing_indexes.sql`, new support routing types, additive handler/store methods for support home, responder profiles, immediate/community request creation, responder queue reads, and session reads, plus route wiring in `cmd/api/main.go`.
- [x] (2026-04-27 12:31Z) Added frontend foundation scaffolding in `src/api/client.ts`, `src/hooks/queries/useSupport.ts`, and `src/query/queryKeys.ts` for support home, responder profile, queue, sessions, and immediate/community request endpoints.
- [x] (2026-04-27 13:02Z) Added the first live routing and fulfillment backend path: `RouteSupportRequest(...)` now creates scored immediate-support offers, `AcceptSupportOffer(...)` creates a support session and only then creates the support chat, and `DeclineSupportOffer(...)` closes offers without creating chats.
- [x] (2026-04-27 13:38Z) Reworked the app support surface in `src/screens/main/SupportScreen.tsx` around `Get help`, `Support others`, and `Community`, wired to support home, responder queue, responder profile, active sessions, and immediate/community request creation.
- [x] (2026-04-27 13:51Z) Added first-pass reroute hardening: responder queue reads now expire stale pending offers and reroute the request, and a fully declined batch also reroutes instead of stopping after the first attempt.
- [x] (2026-04-27 14:09Z) Added a background support-routing worker with `SUPPORT_ROUTING_ENABLED` and `SUPPORT_ROUTING_SWEEP_INTERVAL_SECONDS`, plus `SweepExpiredSupportOffers(...)` so immediate support does not depend only on request creation or queue reads.
- [x] (2026-04-27 14:18Z) Added support-session close/completion flow in the backend and app, plus recent support-session history in `SupportScreen.tsx`.
- [x] (2026-04-27 14:24Z) Completed the migration framing: the public board now lives only as the `Community` lane, while `Get help` and `Support others` are the primary product surfaces.
- [x] (2026-04-27 14:27Z) Added rollout and observability basics: support-routing feature flags, worker logs, durable `support_events`, and validation coverage across backend tests and frontend typecheck.

## Surprises & Discoveries

- Observation: the current system creates or reuses a chat too early, inside support response creation.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/support/store.go` implements `CreateSupportResponse(...)`, and that function persists the response while also creating or reopening a support chat and inserting the initial chat message.

- Observation: responder availability is only a boolean flag today.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/support/handler.go` exposes `UpdateSupportProfile` with only `is_available_to_support`, and `/home/michaelroddy/repos/project_radeon/internal/support/store.go` stores only `is_available_to_support` and `support_updated_at` on `users`.

- Observation: the “open support” experience is still fundamentally a ranked list query.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/support/store.go` implements `ListVisibleSupportRequests(...)` as a scored SQL query over `support_requests`, using urgency, sobriety-band similarity, freshness, and location, then returning that list to `SupportScreen.tsx`.

- Observation: the app already has a decent cursor-based list and query-cache foundation that can be reused for responder queues and session lists.
    Evidence: `src/hooks/queries/useSupport.ts` already uses `useInfiniteQuery` with cursor pagination for both open and my-request views.

- Observation: the current feature is not actually weak because of UI polish; it is weak because the fulfillment model is wrong for urgent support.
    Evidence: `SupportScreen.tsx` already supports create, preview, open, and mine flows, but those flows still depend on a responder manually browsing a list rather than a backend routing engine.

- Observation: the existing `support_requests` table is flexible enough to serve as the root durable request record for both immediate and community lanes once it gets lane and routing metadata.
    Evidence: the foundation implementation added `channel`, `routing_status`, `desired_response_window`, `privacy_level`, and `matched_session_id` to `support_requests` rather than introducing a replacement request table.

- Observation: delayed chat creation was possible without redesigning the entire chat schema first.
    Evidence: `AcceptSupportOffer(...)` now creates `support_sessions` and only then creates a chat linked by `support_request_id`, which is enough to move chat creation behind accepted offers while a later milestone can still add richer session-native chat metadata if needed.

- Observation: the existing `SupportScreen.tsx` was large but still salvageable; the lowest-risk path was to replace the top-level product framing while reusing the existing request card and response composer pieces for the community lane.
    Evidence: the new support surface keeps `SupportRequestCard`, response loading, and check-in-later composition for community support, while the requester home and responder queue now sit above them as the primary product.

- Observation: request-creation-time routing alone was not enough; immediate support needed at least one follow-up reroute trigger to avoid stalling after the first offer batch.
    Evidence: the implementation now reroutes on queue-time offer expiry and after a fully declined batch, while excluding responders who have already been offered the same request.

- Observation: a background sweep was still necessary even after queue-time reroute logic existed.
    Evidence: the final implementation adds `RunRoutingWorker(...)` plus `SweepExpiredSupportOffers(...)` because otherwise a request could still stall indefinitely if no targeted responder opened their queue after an offer expired.

## Decision Log

- Decision: the replacement system will use two support lanes, `Immediate support` and `Community support`, instead of one generalized request board.
    Rationale: urgent or near-real-time requests need active routing and controlled responder load, while lower-pressure support still benefits from broader community visibility. Trying to serve both behaviors with one board leads to weak latency, noisy fulfillment, and unclear expectations.
    Date/Author: 2026-04-27 / Codex

- Decision: support chats will be created only after an offer is accepted and a support session is opened.
    Rationale: the current eager chat creation path produces noise, creates too many premature chats, and makes it hard to reason about the real fulfillment state. A support session is the correct durable object that should own the chat relationship.
    Date/Author: 2026-04-27 / Codex

- Decision: the old public board will not remain the primary product. It will be preserved temporarily as migration scaffolding and then reduced into the `Community support` lane only.
    Rationale: keeping the raw board as the main fulfillment model would preserve the current system’s biggest weakness. The production surface should be a routed requester flow and a personalized responder queue.
    Date/Author: 2026-04-27 / Codex

- Decision: responder availability will become a richer profile and presence model instead of a single boolean.
    Rationale: production routing needs to know whether a responder is available now, what modalities they support, how many active sessions they can handle, what languages or locales they can support, and whether they have recent activity. A binary flag cannot support quality routing.
    Date/Author: 2026-04-27 / Codex

- Decision: routing will be done in small targeted batches through a worker, not by broadcasting every immediate request to all eligible responders.
    Rationale: small-batch routing protects responders from spam, avoids race chaos, and makes fairness and fatigue control possible. This is closer to how high-quality production support or assistance systems behave.
    Date/Author: 2026-04-27 / Codex

- Decision: the first production scoring model will be heuristic and feature-based, not machine-learned.
    Rationale: the repository does not yet have the instrumentation volume or offline training infrastructure to justify a learned model. A heuristic model with good telemetry is the correct first production step.
    Date/Author: 2026-04-27 / Codex

## Outcomes & Retrospective

The first implementation slice is complete. The codebase now has the new durable schema and additive backend and frontend contracts needed for the routing platform, but the old board-first support feature is still the active product surface. That is intentional. The current state is safe migration scaffolding, not half-switched behavior.

The biggest lesson from this first milestone is that the repository could absorb the new support domain cleanly without breaking the existing support board. That validates the additive migration strategy: keep `support_requests` as the root request object, add offers and sessions beside it, then move the product surface over in later milestones.

The second implementation slice has also started successfully. Immediate support requests now have a real backend fulfillment path rather than being mere stored records. That backend path is still intentionally incomplete: reroute-on-expiry, async worker execution, and the full app-side surface have not been switched on yet.

The app cutover milestone is now mostly in place as well. The support tab no longer presents the raw public board as the only conceptual model. Users can now see a requester-focused home, a responder queue, and the community lane separately. What remains on the app side is follow-through detail, not first-order product framing.

Routing is also now materially more resilient than the first backend slice. Immediate requests will continue to search for a match after stale offers expire or a batch is fully declined. There is still room for a dedicated background worker and richer responder-quality updates, but the platform no longer depends on a single first-pass offer batch.

The final implementation slices completed that remaining follow-through. The platform now has a background routing sweep, session completion flow, session history, and feature-flagged routing startup. At the approved scope, the plan is complete: the support feature has been transformed from a board-first public request list into a routed support platform with a secondary async community lane.

## Context and Orientation

This repository is the Expo frontend at `/home/michaelroddy/repos/project_radeon_app`. The backend is a separate Go service at `/home/michaelroddy/repos/project_radeon`. The current support feature spans both repositories and is tightly coupled to chat creation.

In the frontend, `src/screens/main/SupportScreen.tsx` owns the current support experience. It renders a segmented control with `open`, `mine`, and `create` subviews, plus request creation, availability toggles, request cards, and response actions. `src/hooks/queries/useSupport.ts` defines the current React Query data access for support profile and support request lists. `src/api/client.ts` contains the support request, support response, support profile, and support chat context types, plus the HTTP client functions used by the screen.

In the backend, `/home/michaelroddy/repos/project_radeon/internal/support/handler.go` exposes the current HTTP contract. `/home/michaelroddy/repos/project_radeon/internal/support/store.go` contains the core database logic. Today the key model objects are `SupportRequest`, `SupportResponse`, and support-aware chats. `ListVisibleSupportRequests(...)` is the main discovery query. `CreateSupportResponse(...)` is the main fulfillment path, and it is also where the system creates or reuses a support chat. `/home/michaelroddy/repos/project_radeon/internal/support/cache_store.go` adds caching on top of that store.

The important term in this plan is `support session`. A support session is the durable record that says a specific requester and responder have been matched for a specific support request. It owns lifecycle state such as `offered`, `matched`, `active`, `completed`, or `cancelled`, and it can optionally own a chat. The current code does not have this concept. That is one of the main gaps this plan closes.

Another important term is `support offer`. A support offer is the routed invitation sent to a responder for an immediate support request. The responder can accept or decline it, and offers can expire automatically. This is different from the current `support_responses` table, which mixes community reply behavior with fulfillment behavior.

The final key term is `routing worker`. A worker is background backend logic that reacts to new immediate support requests, computes eligible responders, scores them, writes offers, and advances offer batches if the earlier batch expires or is declined. In this repository, that worker should live in the backend service, use Postgres as the source of truth, and use Redis only for short-lived queue and presence acceleration.

## Plan of Work

### Milestone 1: Add the new durable support model without breaking the current feature

The first milestone adds the schema and types that the routed system needs while leaving the current board usable. In the backend repository, create two new migrations after the current highest migration number. The first migration should add `support_offers`, `support_sessions`, `support_responder_profiles`, `support_responder_presence`, `support_responder_stats`, and `support_events`. The second migration should add the supporting indexes and any helper constraints needed for high-volume queue reads and session lookups. The existing `support_requests` table should gain explicit lane and routing fields such as `channel`, `routing_status`, `desired_response_window`, `privacy_level`, and `matched_session_id`. The `support_responses` table should remain in place during migration for the community lane, but immediate support should stop depending on it as the fulfillment primitive.

In `/home/michaelroddy/repos/project_radeon/internal/support`, add new types and interfaces for offers, sessions, responder profiles, and routing events. Do not overload the current `SupportResponse` type to mean all of these things. The goal is a clear model: `SupportRequest` is the requester’s ask, `SupportOffer` is the responder invitation, and `SupportSession` is the accepted match. Add new store methods for creating an immediate support request, creating a community support request, listing responder queue offers, accepting an offer, declining an offer, cancelling a request, listing active sessions, and closing a session.

This milestone should also add cache-key planning in `cache_store.go`, but it should not yet switch the current handler routes over. The existing endpoints can keep working while the new routes and worker are built beside them.

### Milestone 2: Build the routing engine and targeted responder queue

The second milestone turns the new durable model into a real routing system. In the backend repository, add a routing module under `/home/michaelroddy/repos/project_radeon/internal/support` with files such as `routing.go`, `routing_store.go`, `queue_store.go`, and `scoring.go`. The worker should react when an immediate support request is created. It should generate a candidate pool of responders who are eligible by availability, modality, language, load, block state, and location if relevant. Then it should score them.

The first production score should be deterministic and explainable. Use a weighted sum with strong positive weight for immediate availability, medium weight for historical response quality and low current load, medium weight for modality fit and location when relevant, smaller positive weight for prior positive interaction or social proximity, and explicit penalties for recent heavy load, ignored offers, repeated declines, and safety restrictions. The exact v1 recommendation is:

    total_score =
        0.25 * availability_now
      + 0.18 * responsiveness_quality
      + 0.16 * completion_quality
      + 0.14 * modality_fit
      + 0.10 * locality_fit
      + 0.08 * requester_affinity
      + 0.05 * exploration_fairness
      - 0.12 * active_load_penalty
      - 0.08 * recent_ignore_penalty
      - 0.04 * safety_penalty

Each component should be normalized to a `0.0` to `1.0` range before weighting. `availability_now` is whether the responder is currently active and accepting sessions. `responsiveness_quality` is built from median response time and accept rate. `completion_quality` is built from completed sessions and helpfulness feedback. `modality_fit` reflects whether the responder supports chat, scheduled check-ins, or meetups. `locality_fit` matters most for in-person help and should be near-zero for chat-only requests. `requester_affinity` can use prior sessions or accepted friendship as a modest boost. `exploration_fairness` keeps the same small set of helpers from absorbing every request. The penalties must cap overserving and low-quality responders. This is intentionally heuristic. It is the right first production model.

When the worker finishes scoring, it should write a small batch of offers, typically three to five responders for a normal immediate request and one to three for the highest urgency requests. Offers should expire automatically after a short window such as ninety seconds. If all offers expire or are declined, the worker should advance to the next batch. This is where Redis can help as a queue accelerator, but the source of truth must stay in Postgres.

In the same milestone, add new HTTP routes for responders to fetch their queue and act on offers. The responder queue must be personalized, not global. A responder should never load every open request. They should fetch `their` queue, sorted by urgency, expiry, and score.

### Milestone 3: Redesign the app around requester routing and responder queue flows

The third milestone changes the app product surface. In `src/screens/main/SupportScreen.tsx`, replace the current open-board-centered UX with two primary experiences. The requester experience should center on “Get help” and should let the user choose `Immediate support` or `Community support`. The responder experience should center on “Support others” and show a personalized queue of routed offers plus a lightweight community lane for broader async support.

In `src/api/client.ts`, add explicit request and response types for `SupportOffer`, `SupportSession`, `SupportResponderProfile`, `SupportQueuePage`, and `SupportHomePayload`. Add client functions such as `createImmediateSupportRequest`, `createCommunitySupportRequest`, `getSupportHome`, `getSupportQueue`, `acceptSupportOffer`, `declineSupportOffer`, `cancelSupportRequest`, `getSupportSessions`, and `closeSupportSession`. The old `createSupportResponse` function should remain only for the temporary community-lane bridge until the migration is complete.

In `src/hooks/queries/useSupport.ts`, split the current query set into clear units: requester home, responder queue, responder profile, active sessions, and community support list. Use cursor pagination for the queue and community lane. Preserve the existing React Query policy patterns already used elsewhere in the app.

In the screen layer, the requester who creates an immediate request should see a routed state machine, not just a posted card. The UI states should include `routing`, `offers_sent`, `matched`, `no_match_yet`, `community_fallback_available`, `active_session`, and `closed`. The responder should see offer cards with expiry indicators, fit reasons, and load-aware action labels. Community support can still show request cards, but those cards should move into a clearly secondary async lane and should no longer be framed as the whole product.

### Milestone 4: Move support chat creation behind accepted sessions

The fourth milestone untangles support from premature chat creation. In the backend chat package, the support-aware chat context should stop assuming that a raw support response creates a chat. Instead, when an offer is accepted, the backend should create a `support_session` first and then create or associate a chat for that session. The chat context should point to `support_session_id` and `support_request_id`, not just the request and latest response metadata.

In `/home/michaelroddy/repos/project_radeon/internal/chats/store.go` and related handler code, add helper methods that create a support session chat only after the match exists. In the frontend, the chat opening path from support should switch from “open the chat that was created by a response” to “open the chat attached to the accepted support session.” This is the point where the current support chat acceptance and decline behavior should be simplified, because acceptance now happens at the offer layer before chat exists.

The key behavioral acceptance for this milestone is simple: an immediate request should not create any chat until a responder accepts an offer. A community support reply can still create a conversation later if the requester explicitly chooses to continue with someone, but it should not happen automatically just because someone replied on the board.

### Milestone 5: Add quality controls, observability, and migration cleanup

The fifth milestone makes the system production-ready rather than merely feature-complete. Add rate limiting for request creation and offer actions. Add responder concurrency caps. Add cooldowns to prevent the same responder from being hammered repeatedly. Add metrics and logs for offer latency, acceptance rate, expired-offer rate, no-match rate, median route time, active session count, and community-fallback usage. Add abuse and safety hooks so exact location is never broadly exposed, muted or blocked users are excluded, and emergency-language escalation can be introduced later without redesigning the model.

In the app, add a basic “Support preferences” surface that lets responders manage availability, supported modalities, and max concurrent sessions. This can live either inside the support tab or under settings, but the state should be served from the new responder profile endpoints. Add a “Session history” or “Recent support” list for completed sessions so the feature does not feel like requests disappear into the void.

Only after the new requester, queue, and session flows are validated should the legacy board-first handlers and the old eager-response path be retired. During cleanup, keep the async community lane but rename and narrow it so it is clearly the secondary path, not the primary product.

## Concrete Steps

The commands below are the exact commands that should be used during implementation. This plan spans both repositories.

In the backend repository:

    cd /home/michaelroddy/repos/project_radeon
    git checkout -b codex/support-routing-platform

Inspect the current support package before editing:

    rg -n "CreateSupportResponse|ListVisibleSupportRequests|SupportResponse|support_request" internal/support internal/chats

Inspect the current support migrations:

    rg -n "support_requests|support_responses|support_request_id" migrations

Run the backend test suite before any changes:

    env GOPATH=/tmp/go GOMODCACHE=/tmp/go/pkg/mod GOCACHE=/tmp/go-build-support GOSUMDB=off go test ./...

As each milestone lands, rerun at minimum:

    env GOPATH=/tmp/go GOMODCACHE=/tmp/go/pkg/mod GOCACHE=/tmp/go-build-support GOSUMDB=off go test ./internal/support/... ./internal/chats/... ./cmd/api/...

Start the backend locally:

    go run ./cmd/api

In the frontend repository:

    cd /home/michaelroddy/repos/project_radeon_app
    git checkout -b codex/support-routing-platform-client

Typecheck before edits:

    npx tsc --noEmit

Rerun after each major slice:

    npx tsc --noEmit

Start the app:

    npx expo start

During validation, use at least three seeded users:

    1. one requester with no responder history
    2. one highly available responder with low current load
    3. one responder with higher load or lower recent responsiveness

Use that data to prove that immediate requests route to the better responder first and that community requests still remain available asynchronously.

## Validation and Acceptance

Acceptance is behavioral.

First validate the backend routing flow. Create an immediate support request and confirm that the backend writes the request, creates a first batch of offers, and does not create any chat yet. Fetch the responder queue for one of the targeted responders and confirm the offer is visible with expiry and fit metadata. Accept the offer. Confirm that the backend marks the offer accepted, closes sibling offers, creates a support session, and only then creates or attaches a support chat.

Then validate the requester flow in the app. Open the support tab as a requester, create an immediate request, and verify that the UI transitions through routing states instead of just dropping a card into a public board. If a responder accepts, the requester should see an active matched state and a chat entry point. If no responder accepts in the first batch, the requester should see a clear fallback state and the app should either continue routing the next batch or offer the community lane as a fallback without losing the request.

Then validate the responder flow. Open the app as a responder, set availability and supported modalities, and verify that the support queue only shows offers targeted to that user. The queue must not behave like the old global request list. Accepting an offer should remove it from the queue and create a new active session. Declining or letting an offer expire should not create any chat.

Then validate the community lane. Create a community support request and confirm it appears in the secondary async support list. Respond to it and verify that the response is stored without triggering the immediate-routing machinery. If the product later allows the requester to continue that thread into a session or chat, verify that it only happens on explicit user action.

Then validate safety and load behavior. Mark one responder at max concurrent sessions and confirm they stop receiving new immediate offers. Mute or block a requester and confirm they no longer route to that responder. Create several immediate requests and verify that the same highest-quality responder does not receive every offer if the fairness and load penalties should have diversified the queue.

Performance acceptance matters too. Queue reads must be responder-scoped and index-backed. The backend must not scan the entire open-request set for each responder queue request. Immediate support request creation should remain fast because routing can be queued asynchronously after the request is written. The app should remain stable with no hard reload flicker when queue or session state updates.

## Idempotence and Recovery

This migration should be additive. Do not delete the current support board or `support_responses` path until the new request, queue, and session flows are validated. New tables and routes should be added first, then the app can migrate screen by screen behind feature flags.

If the routing worker fails during development, the safe fallback is to keep immediate requests stored with a `routing_status` that can be retried later. Do not lose the request just because routing failed once. A retryable worker is safer than synchronous all-or-nothing request creation.

If offer creation or acceptance fails halfway, all offer and session transitions must be wrapped in transactions so the system does not create duplicate sessions or leave multiple accepted offers for one request. If a migration is applied but the app has not yet switched over, the old board must continue to work.

If the new queue flow becomes unstable, the rollback path is to keep the old support screen available while disabling the new immediate-routing feature flags. That is why the current board should remain as migration scaffolding until the final cleanup milestone.

## Artifacts and Notes

The current implementation seam that proves why this replacement is needed is the support response creation path:

    internal/support/store.go
        CreateSupportResponse(...)
            -> finds request
            -> creates or reuses support chat
            -> inserts support response
            -> inserts chat message

The key replacement seam this plan introduces is:

    createImmediateSupportRequest(...)
        -> persist support request
        -> enqueue routing work
        -> create support offers

    acceptSupportOffer(...)
        -> transaction
        -> accept offer
        -> create support session
        -> create or attach chat
        -> close sibling offers

That is the core architectural difference between the old system and the replacement.

The current discovery seam that should become secondary rather than primary is:

    internal/support/store.go
        ListVisibleSupportRequests(...)

That query is still useful as the basis of an async community lane, but it should no longer represent the entire support product.

## Interfaces and Dependencies

In the backend repository, add new support-domain types under `/home/michaelroddy/repos/project_radeon/internal/support`. The stable contract should include types similar to:

    type SupportChannel string

    const (
        SupportChannelImmediate SupportChannel = "immediate"
        SupportChannelCommunity SupportChannel = "community"
    )

    type SupportRoutingStatus string

    const (
        SupportRoutingPending   SupportRoutingStatus = "pending"
        SupportRoutingOffered   SupportRoutingStatus = "offered"
        SupportRoutingMatched   SupportRoutingStatus = "matched"
        SupportRoutingFallback  SupportRoutingStatus = "fallback"
        SupportRoutingClosed    SupportRoutingStatus = "closed"
    )

    type SupportOfferStatus string

    const (
        SupportOfferPending  SupportOfferStatus = "pending"
        SupportOfferAccepted SupportOfferStatus = "accepted"
        SupportOfferDeclined SupportOfferStatus = "declined"
        SupportOfferExpired  SupportOfferStatus = "expired"
        SupportOfferClosed   SupportOfferStatus = "closed"
    )

    type SupportSessionStatus string

    const (
        SupportSessionPending   SupportSessionStatus = "pending"
        SupportSessionActive    SupportSessionStatus = "active"
        SupportSessionCompleted SupportSessionStatus = "completed"
        SupportSessionCancelled SupportSessionStatus = "cancelled"
    )

The backend store and service layer should end with explicit methods similar to:

    CreateImmediateSupportRequest(ctx context.Context, requesterID uuid.UUID, input CreateImmediateSupportRequestInput) (*SupportRequest, error)
    CreateCommunitySupportRequest(ctx context.Context, requesterID uuid.UUID, input CreateCommunitySupportRequestInput) (*SupportRequest, error)
    RouteSupportRequest(ctx context.Context, requestID uuid.UUID) error
    ListResponderQueue(ctx context.Context, responderID uuid.UUID, cursor string, limit int) (*CursorPage[SupportOffer], error)
    AcceptSupportOffer(ctx context.Context, responderID, offerID uuid.UUID) (*SupportSession, error)
    DeclineSupportOffer(ctx context.Context, responderID, offerID uuid.UUID) error
    ListSupportSessions(ctx context.Context, userID uuid.UUID, cursor string, limit int) (*CursorPage[SupportSession], error)
    CloseSupportSession(ctx context.Context, userID, sessionID uuid.UUID, outcome string) error

The backend should also expose HTTP routes that map cleanly to those operations, for example:

    POST   /support/requests/immediate
    POST   /support/requests/community
    GET    /support/home
    GET    /support/queue
    POST   /support/offers/{offerID}/accept
    POST   /support/offers/{offerID}/decline
    GET    /support/sessions
    GET    /support/sessions/{sessionID}
    POST   /support/sessions/{sessionID}/close
    GET    /support/responders/me
    PATCH  /support/responders/me

In the frontend repository, add matching client functions in `src/api/client.ts` and matching React Query hooks in `src/hooks/queries/useSupport.ts`. The final app contract should include types similar to:

    interface SupportOffer
    interface SupportSession
    interface SupportResponderProfile
    interface SupportHomePayload
    interface SupportQueuePage

The app should keep using React Query, `FlatList`, and cursor pagination. There is no need for a new client state library. The routing worker should live in the backend service, not in the app. Redis is recommended only for presence and short-lived routing acceleration. Postgres remains the source of truth for requests, offers, sessions, and analytics.

## Revision Notes

Revision note: this plan does not revise a prior checked-in support-platform ExecPlan. Earlier support plans in `exec_plans/` focused on ranking and simplification of the current board-based system. This document supersedes that product direction by treating the board as migration scaffolding and defining a new routing-based support platform.

Revision note: implementation started on 2026-04-27. The first completed slice added the new support-routing schema and additive backend/frontend scaffolding, while deliberately leaving the legacy board-first feature active until later milestones are complete.

Revision note: a second execution slice added first-pass offer routing plus session-before-chat fulfillment on the backend, but the app UI has not yet been migrated to those endpoints.

Revision note: a third execution slice migrated the support tab UI to the new routed product framing while intentionally preserving the community board and old response flow as the async lane during migration.

Revision note: a fourth execution slice added first-pass reroute hardening so immediate requests continue routing after expiries or fully declined batches.

Revision note: a fifth execution slice completed the remaining production-grade support-platform work at the approved scope by adding the routing sweeper, support-session close/history flow, and final rollout/observability basics.
