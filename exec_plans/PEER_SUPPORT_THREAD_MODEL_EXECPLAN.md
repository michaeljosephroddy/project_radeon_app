# Replace Routed Immediate Support With Peer Support Threads

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`. Implementation work in `/home/michaelroddy/repos/project_radeon` must also follow that repository’s `PLANS.md`.

## Purpose / Big Picture

The current support product mixes two different ideas. `Community` support behaves like a thread with responses, while `Immediate` support behaves like a private routing system with offers, queue management, and acceptance before the requester can see who is available. That makes the feature harder to understand and pushes too much invisible system behavior between community members who are supposed to be helping each other.

After this change, both `Immediate` and `Community` support will use the same peer-support mechanic: a person creates a support request, community members respond when they can, the requester reviews those responses, and only when the requester accepts one response does a one-to-one chat open. `Immediate` remains a separate urgent lane with different ranking and urgency language, but not a different fulfillment engine. The proof is simple and user-visible: create an immediate request, watch multiple people respond without opening chats yet, accept one response, see the request move to `Active`, see a chat appear for the accepted pair, and see the request disappear from the open queue for everyone else.

## Progress

- [x] (2026-04-28 14:35Z) Audited the current frontend support seams in `src/screens/main/SupportScreen.tsx`, `src/api/client.ts`, `src/hooks/queries/useSupport.ts`, and `src/query/queryKeys.ts`.
- [x] (2026-04-28 14:39Z) Audited the current backend support and chat seams in `/home/michaelroddy/repos/project_radeon/internal/support/*.go`, `/home/michaelroddy/repos/project_radeon/internal/chats/*.go`, and `/home/michaelroddy/repos/project_radeon/cmd/api/main.go`.
- [x] (2026-04-28 14:48Z) Chose the replacement product direction: one peer-support engine with two channels, `community` and `immediate`, and chat creation only after requester acceptance.
- [x] (2026-04-28 14:55Z) Authored this ExecPlan in `exec_plans/PEER_SUPPORT_THREAD_MODEL_EXECPLAN.md`.
- [x] (2026-04-28 16:06Z) Added backend migration `046_peer_support_thread_model.sql` to introduce accepted-response fields on `support_requests`, request/response status normalization, and response-status indexing.
- [x] (2026-04-28 16:18Z) Reworked backend support persistence so `CreateSupportResponse(...)` no longer creates chats, `AcceptSupportResponse(...)` creates the chat and activates the request, and request queries derive active/completed state from accepted-response fields instead of offers.
- [x] (2026-04-28 16:24Z) Removed the old routed-offer support endpoints from `cmd/api/main.go` and added `POST /support/requests/{id}/responses/{responseId}/accept`.
- [x] (2026-04-28 16:37Z) Reworked the app support client, query keys, and `SupportScreen.tsx` so `Immediate` and `Community` both run on the same request/response lifecycle, with paginated response loading and acceptance from `My requests`.
- [x] (2026-04-28 16:43Z) Regenerated the Postman collection, applied migration `046`, reran backend tests, and reran app typecheck.

## Surprises & Discoveries

- Observation: the backend still exposes the old routed-offer immediate model even after the support-session removal.
    Evidence: `/home/michaelroddy/repos/project_radeon/cmd/api/main.go` still mounts `GET /support/queue`, `POST /support/offers/{offerID}/accept`, and `POST /support/offers/{offerID}/decline`.

- Observation: support response creation still creates or reuses a chat too early for the peer-support design.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/support/store.go` implements `CreateSupportResponse(...)`, and that function finds or creates a chat, inserts `chat_members`, writes the response with `chat_id`, and inserts a chat message immediately.

- Observation: the app UI already has most of the request-card and response-list pieces needed for the redesign; the main problem is the underlying lifecycle, not missing surface area.
    Evidence: `src/screens/main/SupportScreen.tsx` already renders request cards, response summaries, response expansion, close actions, and per-channel tab views.

- Observation: the current `Immediate` screen language still assumes routing and offers, which will directly conflict with the new product model.
    Evidence: `src/screens/main/SupportScreen.tsx` includes copy such as `Incoming routed offers`, `Open support offers`, and the `supportQueue` query path in `src/hooks/queries/useSupport.ts`.

- Observation: the backend already enforces closed support chats correctly, which can be preserved under the new acceptance model.
    Evidence: support-request closure now closes linked chats and `internal/chats/store.go` rejects new messages when `chats.status = 'closed'`.

- Observation: the migration needed correlated subqueries instead of `UPDATE ... FROM LATERAL` to backfill accepted-response fields safely.
    Evidence: the first `make migrate` run failed with `invalid reference to FROM-clause entry for table "sr"` until the update statements in `046_peer_support_thread_model.sql` were rewritten.

## Decision Log

- Decision: both `Immediate` and `Community` support will use the same request-response-accept lifecycle.
    Rationale: this matches the product goal of a peer support network where people volunteer when they can, instead of being assigned private offers by a routing engine.
    Date/Author: 2026-04-28 / Codex

- Decision: `Immediate` remains a separate channel, but it will differ by urgency, ordering, visibility treatment, and copy rather than by a separate backend matching model.
    Rationale: urgent support still needs a distinct lane, but the requester and responder mental model should stay consistent across both types of support.
    Date/Author: 2026-04-28 / Codex

- Decision: a chat will be created only when the requester accepts a specific support response.
    Rationale: this removes premature chats, preserves requester control, and keeps support conversations finite and intentional.
    Date/Author: 2026-04-28 / Codex

- Decision: `Completed` tabs will show only requests that were accepted and became active before being closed.
    Rationale: a request that was closed without any accepted responder is not a completed support interaction. It may still be retained for requester history, but it should not occupy the completed-support surface.
    Date/Author: 2026-04-28 / Codex

- Decision: response lists must be paginated from the start.
    Rationale: immediate requests may attract many lightweight volunteer responses, and the requester’s screen must stay fast even if a request becomes popular.
    Date/Author: 2026-04-28 / Codex

- Decision: the app no longer requires the responder availability toggle to volunteer on a support request.
    Rationale: the product direction is community members choosing to respond when they can, not being placed in a responder queue. Keeping the availability gate in the response path would have conflicted with that model.
    Date/Author: 2026-04-28 / Codex

## Outcomes & Retrospective

The peer-support thread model is now implemented across both repositories. `Immediate` and `Community` both use open requests, volunteer responses, requester acceptance, active chats only after acceptance, and completed tabs that exclude requests closed without ever becoming active. The remaining gaps are cleanup-oriented rather than product-blocking: old support-offer code still exists in the backend package as unused implementation debt, and unused compatibility client functions still exist in `src/api/client.ts`. The next contributor should remove those leftovers only after confirming no downstream tooling still depends on them.

## Context and Orientation

This work spans two repositories.

The frontend lives at `/home/michaelroddy/repos/project_radeon_app`. The primary support screen is `src/screens/main/SupportScreen.tsx`. The app’s single API module is `src/api/client.ts`. React Query keys live in `src/query/queryKeys.ts`, and support-specific hooks live in `src/hooks/queries/useSupport.ts`. Support chats open through `src/screens/main/ChatScreen.tsx` and related chat helpers in `src/screens/main/chat/`.

The backend lives at `/home/michaelroddy/repos/project_radeon`. HTTP routes are mounted in `cmd/api/main.go`. The support package is split mainly across `internal/support/handler.go`, `internal/support/store.go`, `internal/support/foundation_store.go`, `internal/support/routing_store.go`, and `internal/support/cache_store.go`. Chat persistence and message-send enforcement live in `internal/chats/store.go` and `internal/chats/handler.go`. Database schema changes are applied through SQL files in `migrations/`.

Define these terms plainly because the implementation must not drift:

- A `support request` is the main record created by the person asking for help.
- A `support response` is a volunteer reply from another community member saying they can help.
- An `accepted response` is the one response the requester chooses to engage with.
- An `active request` is a support request that has an accepted response and an open chat.
- A `closed request` is a support request that has ended. If it never had an accepted response, it is closed history, not completed support.

Today the codebase is in an awkward middle state. Support sessions were removed, but the old routed-offer model is still present for immediate support. The backend still maintains `support_offers`, `support/queue`, offer acceptance and decline endpoints, rerouting logic, and immediate-request status transitions such as `matched`. At the same time, the broader support feature still supports thread-like request responses. The goal of this plan is to eliminate that split personality.

## Plan of Work

The work should proceed in five milestones.

The first milestone redefines the backend data model around requests and responses rather than requests and offers. Additive schema changes should happen first in `/home/michaelroddy/repos/project_radeon/migrations/`. Extend `support_requests` so it can directly represent a peer-support lifecycle with fields such as `accepted_response_id`, `accepted_responder_id`, `chat_id`, `accepted_at`, and `closed_at` if any are still missing or unreliable today. Extend `support_responses` to carry a real response lifecycle with `status` values such as `pending`, `accepted`, and `not_selected`. If `chat_id` currently lives on each response because chats are created at response time, remove that responsibility from the response-write path; the accepted response can still be discoverable through the request record. Preserve historical data safely. Do not physically drop old routed-offer tables until the new acceptance path is working and the app no longer calls it.

The second milestone replaces the app-facing backend contract. In `/home/michaelroddy/repos/project_radeon/cmd/api/main.go` and `internal/support/handler.go`, add or reshape endpoints so the peer-support model is explicit:

    POST /support/requests
    GET /support/requests
    GET /support/requests/{id}
    PATCH /support/requests/{id}
    POST /support/requests/{id}/responses
    GET /support/requests/{id}/responses
    POST /support/requests/{id}/responses/{responseId}/accept

`GET /support/requests` must support filters for `channel`, `status`, and `scope`, where `scope` distinguishes visible community queues from the requester’s own requests and requests the current user has been accepted on. `GET /support/requests/{id}/responses` must be paginated. Offset pagination is acceptable if the existing support screen already uses offsets and the result sets stay bounded, but cursor pagination is preferred because the app already has cursor-style patterns elsewhere. `POST /support/requests/{id}/responses/{responseId}/accept` is the keystone transaction: it marks the request active, marks the chosen response accepted, marks sibling pending responses not selected, creates the chat, writes any required support event, and removes the request from open queues because `status` is no longer `open`. During this milestone, deprecate the routed-offer endpoints and make their callers fail loudly in tests so they are not accidentally left in the app.

The third milestone rewrites backend support persistence. In `/home/michaelroddy/repos/project_radeon/internal/support/store.go` and related support store files, refactor `CreateSupportResponse(...)` so it only creates a support response and never creates a chat. Add a new transactional method such as `AcceptSupportResponse(ctx, requesterID, requestID, responseID)` that verifies ownership, verifies the request is still open, verifies the response belongs to that request and is still pending, creates or attaches a direct chat between requester and responder, updates request and response status fields, and closes sibling responses. Update request-listing queries so `Open` means `status = 'open'`, `Active` means `status = 'active'`, and `Completed` means `status = 'closed' AND accepted_response_id IS NOT NULL`. Update any helper that still interprets immediate requests as `matched`. Delete app-facing dependencies on `support_offers`, `routing_status`, and `support/queue` once tests show nothing still relies on them. The old tables may remain for one migration if that reduces risk, but the handlers and stores should stop reading them.

The fourth milestone reworks the app surface in `/home/michaelroddy/repos/project_radeon_app`. In `src/api/client.ts`, remove client functions for `getSupportQueue`, `acceptSupportOffer`, and `declineSupportOffer`. Add functions such as `listSupportRequests`, `listSupportRequestResponses`, `createSupportResponse`, and `acceptSupportResponse`, all with explicit TypeScript interfaces next to them. In `src/query/queryKeys.ts` and `src/hooks/queries/useSupport.ts`, stop treating immediate support as a separate queue product. Replace `supportQueue` with request list queries keyed by `channel`, `status`, and `scope`, and add a paginated response-list query keyed by `requestId`. In `src/screens/main/SupportScreen.tsx`, keep separate `Immediate` and `Community` top-level sections and keep `Open`, `Active`, and `Completed` subtabs for each, but drive every subtab from request state rather than offers. Request cards that belong to the current user should expose `View responses` while open, `Accept` on pending responses, `Open` and `Complete` while active, and history-only rendering once closed. Request cards shown to other users should expose a lightweight volunteer action such as `I'm available` or the current response composer, but they must not open a chat immediately. Immediate support should use stronger copy such as `Right now`, `urgent`, or `needs support soon`, but it should still behave as a thread.

The fifth milestone tightens completion, chat behavior, and cleanup. When a requester or accepted responder closes a support request, preserve the recent work that writes a final close message to the chat and locks further sends. Ensure `ChatScreen.tsx` continues to respect the server’s closed-chat state. In the support screen, closed requests must still allow the requester to read prior responses, but they must not offer new chat entry points from unaccepted responses. After the app has switched to the new request-response flow and tests cover it, remove or dead-code eliminate remaining frontend and backend references to `support_offers`, `routing_store.go`, `support/queue`, `matched` immediate statuses, and offer acceptance copy. If `routing_status` remains in the schema for historical reasons, stop surfacing it in any app-facing payload.

## Concrete Steps

Use these commands exactly unless a file move requires a path adjustment.

In the backend repository, create a dedicated branch before implementation:

    cd /home/michaelroddy/repos/project_radeon
    git checkout -b refactor/peer-support-threads

Inspect the current support surfaces again before editing:

    rg -n "support/queue|support/offers|CreateSupportResponse|ListSupportResponses|matched|routing_status" cmd/api/main.go internal/support internal/chats

Run focused backend tests before any changes:

    GOCACHE=/tmp/go-build-cache go test ./internal/support ./internal/chats ./cmd/api

Add migrations and store changes incrementally. After each backend milestone, rerun:

    GOCACHE=/tmp/go-build-cache go test ./internal/support ./internal/chats ./cmd/api

If the backend migrations are ready, apply them locally:

    GOCACHE=/tmp/go-build-cache make migrate

Confirm the migration status:

    GOCACHE=/tmp/go-build-cache make migrate-status

In the frontend repository, create a matching branch before implementation:

    cd /home/michaelroddy/repos/project_radeon_app
    git checkout -b refactor/peer-support-threads-client

Typecheck before edits:

    npx tsc --noEmit

Rerun typecheck after each frontend milestone:

    npx tsc --noEmit

Start the app when ready to validate behavior:

    npx expo start

Regenerate the Postman collection after backend endpoint changes:

    cd /home/michaelroddy/repos/project_radeon
    node scripts/generate_postman_collection.js

## Validation and Acceptance

Validation must prove behavior, not just compilation.

First validate open-request browsing. Start the backend and app, log in as two or more users, create one `Immediate` request and one `Community` request, and confirm both appear in their separate `Open` tabs. Neither request should create a chat just because another user responds.

Then validate volunteer responses. As at least two different users, respond to the same immediate request. The requester should open that request and see a paginated response list. If the first page size is small, the requester should be able to load more responses without reloading the whole support screen.

Then validate acceptance. The requester accepts one response. The accepted request should move to `Active`, the accepted responder should see it in their own `Active` view, the open request should disappear from other supporters’ open immediate queue after refresh or realtime update, and exactly one chat should open for the requester and accepted responder. No chat should exist for unaccepted responders.

Then validate closure. Complete the active request. The request should move to `Completed`, the linked chat should receive the final close message, and the composer should lock for both participants. Closed requests should still allow the requester to view old responses, but there should be no `Open chat` action for unaccepted responses.

Then validate the completed-tab rule. Close a request without accepting any response. It must not appear in `Completed`. If the product keeps such records for personal history, that history must live outside the completed-support surface.

Finally validate removal of routed-offer behavior. `GET /support/queue` and offer acceptance paths should no longer be exercised by the app, and support-screen copy should no longer refer to routed offers. Running the Postman collection should show the new acceptance endpoint and should not advertise offer acceptance or decline as the main support workflow.

## Idempotence and Recovery

The safest implementation path is additive first, subtractive second. Add the new response-acceptance fields and endpoints before deleting the old routed-offer code. If a migration fails halfway, fix the SQL and rerun `make migrate`; do not hand-edit the database to “skip ahead” unless the migration runner itself is broken and the exact manual correction is documented in this plan.

Acceptance logic must be transaction-safe. A double-submit of `POST /support/requests/{id}/responses/{responseId}/accept` must not create two chats or accept two different responses. The transaction should lock the request row and the chosen response row before creating a chat. Sibling responses should be updated inside the same transaction.

Frontend query changes should be safe to retry. If the app is switched to the new request list queries before every backend endpoint is ready, it should fail clearly rather than silently opening chats through the old response path. Delete dead client calls only after the new ones typecheck and the backend routes exist.

If the new thread model proves unstable during rollout, the rollback path is to temporarily keep only `Community` on the old request-response path while disabling `Immediate` creation in the app. Do not reintroduce routed offers as an emergency shortcut unless the user explicitly chooses to restore that product model.

## Artifacts and Notes

The current backend seams that must be removed from the app-facing model are:

    cmd/api/main.go
        GET  /support/queue
        POST /support/offers/{offerID}/accept
        POST /support/offers/{offerID}/decline

The current backend seam that creates chats too early is:

    internal/support/store.go
        CreateSupportResponse(...)
            -> finds or creates chat
            -> inserts chat members
            -> writes support_responses.chat_id
            -> inserts a message

The replacement seam should become:

    CreateSupportResponse(...)
        -> validates request is open
        -> inserts support_responses row with status = 'pending'
        -> does not create a chat

    AcceptSupportResponse(...)
        -> transaction
        -> verifies requester owns request
        -> locks request and response
        -> creates chat
        -> marks response accepted
        -> marks request active with accepted_response_id, accepted_responder_id, chat_id
        -> marks sibling pending responses not_selected

The frontend replacement seam should become:

    SupportScreen.tsx
        Open request
            -> view responses
            -> accept one response
            -> only then open chat

## Interfaces and Dependencies

The backend must end with a request-centric support API. In `/home/michaelroddy/repos/project_radeon/internal/support`, define or preserve stable types that make the lifecycle explicit. At minimum, the app-facing `SupportRequest` type should carry:

    ID
    RequesterID
    Type
    Message
    Channel
    Status
    AcceptedResponseID
    AcceptedResponderID
    ChatID
    AcceptedAt
    ClosedAt
    CreatedAt

The app-facing `SupportResponse` type should carry:

    ID
    SupportRequestID
    ResponderID
    ResponseType
    Message
    Status
    CreatedAt

In `/home/michaelroddy/repos/project_radeon/cmd/api/main.go`, the implementation must expose:

    POST   /support/requests
    GET    /support/requests
    GET    /support/requests/{id}
    PATCH  /support/requests/{id}
    POST   /support/requests/{id}/responses
    GET    /support/requests/{id}/responses
    POST   /support/requests/{id}/responses/{responseId}/accept

In `/home/michaelroddy/repos/project_radeon_app/src/api/client.ts`, define matching TypeScript interfaces and client functions with explicit return types. Avoid `any`. Keep all support types local to `client.ts` next to the endpoints that produce them. In `src/hooks/queries/useSupport.ts`, the main query shapes should become request-centric, for example:

    supportRequests({ channel, status, scope, limit })
    supportRequest(id)
    supportResponses({ requestId, cursor, limit })

The chat package remains a dependency, but only at acceptance and close time. `internal/chats/store.go` must continue to enforce closed-chat writes, and `src/screens/main/ChatScreen.tsx` must continue to render the final system close message clearly and lock the composer after closure.

Revision note: created on 2026-04-28 to replace the earlier routed-offer support direction with a unified peer-support thread model after the product goal was clarified as “the community can help each other when they are in need.” Updated on 2026-04-28 after implementation to record the shipped backend/app changes and the migration correction.
