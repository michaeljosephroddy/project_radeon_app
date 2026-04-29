# Redesign Support Requests Into A Unified Ranked Help Feed

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`. Implementation work in `/home/michaelroddy/repos/project_radeon` must also follow that repository's `PLANS.md`. This plan intentionally spans both repositories because the product behavior depends on backend ranking, database fields, and app interaction design working together.

## Purpose / Big Picture

After this change, support requests will feel like one coherent recovery support feed instead of two separate lanes called `Immediate` and `Community`. A person asking for help can mark urgency for free, choose what kind of support they want, add topics such as anxiety or cravings, and optionally express a gender preference or coarse location. People who want to help can either post a public reply in the request thread or make a private support offer such as chat, call, or meetup. A private interaction only starts after the requester accepts an offer.

This matters because urgent help must never feel paywalled or fragmented. The backend will rank one feed by need, freshness, unanswered state, and a small priority boost where applicable. The app will show filters such as `All`, `Urgent`, and `Unanswered`, but these are views over the same ranked feed, not separate queues. The behavior is working when a user can create a high-urgency chat request about cravings, see it appear in the unified feed, receive public replies and private offers, accept one offer, and continue in a chat while the request moves out of the open feed.

## Progress

- [x] (2026-04-29T19:49:00Z) Audited the current app support surface in `src/screens/main/SupportScreen.tsx`, `src/hooks/queries/useSupport.ts`, `src/query/queryKeys.ts`, and `src/api/client.ts`.
- [x] (2026-04-29T19:49:00Z) Audited the current backend support surface in `/home/michaelroddy/repos/project_radeon/internal/support/handler.go`, `/home/michaelroddy/repos/project_radeon/internal/support/store.go`, `/home/michaelroddy/repos/project_radeon/internal/support/logic.go`, and support migrations.
- [x] (2026-04-29T19:49:00Z) Confirmed the current backend already has request-response-accept mechanics, private chat creation after requester acceptance, response counters, and ranked cursor pagination by channel.
- [x] (2026-04-29T19:49:00Z) Authored this ExecPlan for the unified support feed, richer request metadata, public replies, private offers, and app redesign.
- [x] (2026-04-29T20:09:48Z) Created implementation branches in both repositories.
- [x] (2026-04-29T20:09:48Z) Added backend migration `057_unified_support_feed.sql`, unified request creation, public replies, offer endpoints, unified feed ranking, high-urgency cooldown/cap enforcement, cache invalidation, and updated backend support tests.
- [x] (2026-04-29T20:15:24Z) Implemented app API types, query hooks, unified feed UI, request detail flow, offer/reply actions, my-request management, and the create flow.
- [x] (2026-04-29T20:15:24Z) Validated backend tests with `GOCACHE=/tmp/go-build-cache go test ./...` and app typecheck with `npx tsc --noEmit`.
- [x] (2026-04-29T20:37:00Z) Removed old app-facing Immediate/Community request creators, `/responses` client routes, support response types/query keys, legacy chat context response naming, and old support request response/channel fields from the frontend contract.
- [x] (2026-04-29T20:37:00Z) Removed old backend Immediate/Community routes and response handlers, cleaned unused support routing types and queue ranking helpers, renamed app-facing chat context metadata to `latest_offer_type`, and stopped returning legacy request `type`/`channel` fields.
- [x] (2026-04-29T20:37:00Z) Re-validated cleanup with `GOCACHE=/tmp/go-build-cache go test ./...` and `npx tsc --noEmit`.
- [ ] Run a manual multi-user support scenario against a migrated local database and Expo app.

## Surprises & Discoveries

- Observation: the current feature already contains the safest private-help mechanic: a support response does not create a chat until the requester accepts it.
  Evidence: `/home/michaelroddy/repos/project_radeon/internal/support/store.go` implements `AcceptSupportResponse(...)`, which marks the request active and creates or reuses a direct chat only after acceptance.

- Observation: the current app still presents support as two top-level open feeds, `Immediate` and `Community`, even though the backend support engine is now largely shared.
  Evidence: `src/screens/main/SupportScreen.tsx` has `SupportSurface = 'immediate' | 'community' | 'my_requests' | 'create'`, and `useSupportRequests(...)` requires a `channel` argument.

- Observation: the backend already ranks support queues using attention buckets and keyset cursor pagination, but the ranking is lane-specific and does not yet include topic, support type, public reply count, private offer count, or priority boost.
  Evidence: `/home/michaelroddy/repos/project_radeon/internal/support/store.go` computes `attention_bucket` inside `ListVisibleSupportRequests(...)` and orders by `attention_bucket`, `urgency_rank`, `created_at`, and `id`.

- Observation: there is no public reply/thread model today. The current `support_responses` table is actually a private offer/intention-to-help model, despite being named "response".
  Evidence: the app renders response actions such as `I can chat`, `Check in later`, and `I can meet up`, and the requester must accept a response before a chat opens.

- Observation: the backend support package and related route compile checks pass after the first backend implementation.
  Evidence: `GOCACHE=/tmp/go-build-cache go test ./internal/support` passed; `GOCACHE=/tmp/go-build-cache go test ./internal/chats ./cmd/api` passed.

- Observation: the full backend test suite and app typecheck pass after the app implementation.
  Evidence: `GOCACHE=/tmp/go-build-cache go test ./...` passed in `/home/michaelroddy/repos/project_radeon`; `npx tsc --noEmit` passed in `/home/michaelroddy/repos/project_radeon_app`.

- Observation: after cleanup, the old user-facing response terminology is gone from the app and API routes; remaining `support_responses`, `response_count`, and `accepted_response_id` references are database storage internals.
  Evidence: repository searches only find those names in backend SQL/schema-facing code, while the app now uses `SupportOffer`, `/offers`, `offer_count`, `has_offered`, and `latest_offer_type`.

## Decision Log

- Decision: replace the visible two-lane feed model with one unified ranked feed and filter views.
  Rationale: separate urgent and community lists fragment attention, create empty-list risk, and make monetization feel closer to access control. One feed lets the backend rank by need while keeping urgency available to every user.
  Date/Author: 2026-04-29 / Codex

- Decision: keep private support offers acceptance-controlled and add public replies as a separate concept.
  Rationale: a reply is lightweight public community support. An offer is a private commitment to personally help through chat, call, or meetup. Keeping them separate preserves requester control and makes moderation, rate limiting, and ranking clearer.
  Date/Author: 2026-04-29 / Codex

- Decision: use `support_type` values `chat`, `call`, `meetup`, and `general` for the requester's desired support mode.
  Rationale: these values directly answer what the requester wants to happen. The old request types, such as `need_to_talk` and `need_encouragement`, mix desired channel and emotional context. Emotional context belongs in `topics`.
  Date/Author: 2026-04-29 / Codex

- Decision: topics are controlled enum slugs in the first version, not arbitrary tags.
  Rationale: controlled topics support filtering, ranking, analytics, and localization without spammy or inconsistent free-text labels. The body message remains free text for nuance.
  Date/Author: 2026-04-29 / Codex

- Decision: location must be optional and coarse by default.
  Rationale: recovery support can be sensitive. Exact coordinates should not be shown in the feed. The first implementation should support city/region display and optional approximate coordinates for ranking only.
  Date/Author: 2026-04-29 / Codex

- Decision: premium or priority visibility is a small ranking boost, not an access rule.
  Rationale: a free high-urgency request must outrank a low-urgency priority request in ordinary cases. Priority can amplify visibility, but it must not make users feel they need to pay to be heard while struggling.
  Date/Author: 2026-04-29 / Codex

- Decision: keep the existing `support_responses` table as the storage layer for private offers during this implementation.
  Rationale: the current table already supports pending, accepted, and not-selected offer state plus requester acceptance and chat creation. Renaming the table now would add migration risk without changing user-visible behavior.
  Date/Author: 2026-04-29 / Codex

- Decision: replace `SupportScreen.tsx` rather than patching the existing Immediate/Community branch tree.
  Rationale: the old screen was structurally organized around the two-lane model, check-in scheduling, and response expansion inside requester cards. A replacement produced a smaller, clearer implementation around `Feed`, `My requests`, `Create`, and a request detail surface.
  Date/Author: 2026-04-29 / Codex

## Outcomes & Retrospective

The first implementation pass is complete across both repositories. The backend now has an additive migration for unified support metadata and public replies, new offer/reply routes, unified feed filtering and ranking, and compatibility aliases for older response endpoints. The app now uses one support feed with `All`, `Urgent`, and `Unanswered` filters, separate public replies and private offers, a request detail surface, and a richer create flow. Automated validation passes; the remaining gap is manual end-to-end validation against a migrated local database and running Expo app.

## Context and Orientation

This work spans two repositories.

The app repository is `/home/michaelroddy/repos/project_radeon_app`. The support screen is `src/screens/main/SupportScreen.tsx`. All support API types and functions live in `src/api/client.ts`. React Query support hooks live in `src/hooks/queries/useSupport.ts`, and query keys live in `src/query/queryKeys.ts`. The app currently renders four top-level support tabs: `Immediate`, `Community`, `My requests`, and `Create`.

The backend repository is `/home/michaelroddy/repos/project_radeon`. The support HTTP handlers live in `internal/support/handler.go`. The PostgreSQL implementation lives in `internal/support/store.go`. Support request validation helpers live in `internal/support/logic.go`. The support routes are mounted from `cmd/api/main.go`. Database migrations live in `migrations/`.

The current data model uses `support_requests` for the request itself and `support_responses` for private offers from helpers. Current request `type` values are `need_to_talk`, `need_distraction`, `need_encouragement`, and `need_in_person_help`. Current `urgency` values are `when_you_can`, `soon`, and `right_now`. Current `channel` values are `immediate` and `community`. Current request statuses are `open`, `active`, and `closed`.

In this plan, a `support request` is the main record created by the person asking for help. A `public reply` is a visible message inside the request thread, useful for encouragement, shared experience, or practical suggestions. A `support offer` is a private offer to directly help through chat, call, or meetup; it requires requester acceptance before a direct interaction starts. The existing backend type named `SupportResponse` currently represents what this plan calls a support offer.

The term `ranked feed` means the backend returns requests in the order they should be shown. The app must not fetch all requests and sort locally. The term `keyset cursor` means pagination continues from the last item's sort fields instead of using SQL `OFFSET`. This matters because ranked feeds must stay stable and fast as the database grows.

## Target Product Model

The support request object exposed to the app should move toward this shape:

    SupportRequest {
        id: string
        requester_id: string
        username: string
        avatar_url?: string | null
        message?: string | null
        urgency: 'low' | 'medium' | 'high'
        support_type: 'chat' | 'call' | 'meetup' | 'general'
        topics: SupportTopic[]
        preferred_gender?: 'woman' | 'man' | 'non_binary' | 'no_preference' | null
        location?: SupportLocation | null
        status: 'open' | 'active' | 'closed'
        reply_count: number
        offer_count: number
        view_count: number
        is_priority: boolean
        created_at: string
        accepted_offer_id?: string | null
        accepted_responder_id?: string | null
        chat_id?: string | null
        has_replied: boolean
        has_offered: boolean
        is_own_request: boolean
    }

The initial topic enum should be deliberately small and recovery-specific:

    anxiety
    relapse_risk
    loneliness
    cravings
    depression
    family
    work
    sleep
    celebration
    general

`SupportLocation` should be optional and coarse:

    SupportLocation {
        city?: string | null
        region?: string | null
        country?: string | null
        approximate_lat?: number | null
        approximate_lng?: number | null
        visibility: 'hidden' | 'city' | 'approximate'
    }

The app should show city/region at most in feed cards. Approximate coordinates, if present, are for ranking and future distance filters, not precise display.

## Backend Plan Of Work

The backend work should proceed in additive milestones so the app can be moved safely.

Milestone 1 adds the new database shape without removing old columns. Create the next migration in `/home/michaelroddy/repos/project_radeon/migrations/`. Add columns to `support_requests`: `support_type TEXT`, `topics TEXT[] NOT NULL DEFAULT '{}'`, `preferred_gender TEXT NULL`, `location_visibility TEXT NOT NULL DEFAULT 'hidden'`, `location_city TEXT NULL`, `location_region TEXT NULL`, `location_country TEXT NULL`, `location_approx_lat DOUBLE PRECISION NULL`, `location_approx_lng DOUBLE PRECISION NULL`, `view_count INTEGER NOT NULL DEFAULT 0`, `is_priority BOOLEAN NOT NULL DEFAULT false`, `priority_expires_at TIMESTAMPTZ NULL`, and eventually `offer_count INTEGER NOT NULL DEFAULT 0` if `response_count` is retained for backwards compatibility. If renaming `response_count` to `offer_count` is too disruptive, keep the column name internally and expose it as `offer_count` in JSON. Add check constraints for `support_type`, `urgency`, `preferred_gender`, `location_visibility`, and topics if PostgreSQL array checks are practical in this codebase.

The same migration should map old values into the new model. Map `need_to_talk` to `chat`, `need_in_person_help` to `meetup`, and both `need_distraction` and `need_encouragement` to `general`. Map old urgency values as `when_you_can` to `low`, `soon` to `medium`, and `right_now` to `high`. Because changing the existing `urgency` check constraint is a breaking data migration, do it in one transaction: drop the old constraint, update the values, set a default of `low`, and add a new check constraint for `low`, `medium`, and `high`. Keep the legacy `type` and `channel` columns during the rollout unless removing them is clearly safe after the app is updated.

Milestone 2 adds public replies. Create a new table named `support_replies` with `id`, `support_request_id`, `author_id`, `body`, `created_at`, `updated_at`, and nullable moderation fields if this repository already has a moderation pattern. Add `reply_count INTEGER NOT NULL DEFAULT 0` to `support_requests`. Add an index on `(support_request_id, created_at, id)` for paginated thread reads and an index on `(author_id, created_at DESC)` for future user history. Add backend methods and handlers for:

    POST /support/requests/{id}/replies
    GET /support/requests/{id}/replies?cursor=...&limit=...

Creating a reply must reject closed requests, reject replies to the user's own request only if product wants that restriction, increment `support_requests.reply_count`, and return the created reply with author preview fields. The default should allow the requester to reply in their own thread because follow-up context is useful. The backend should enforce a reasonable body length, for example 1 to 1000 characters after trimming.

Milestone 3 renames the private interaction concept at the API boundary. The database can keep `support_responses` if renaming the table would create unnecessary risk, but the API and app should call these objects `support offers`. Add or reshape endpoints so the user-facing contract is:

    POST /support/requests/{id}/offers
    GET /support/requests/{id}/offers?cursor=...&limit=...
    POST /support/requests/{id}/offers/{offerId}/accept
    POST /support/requests/{id}/offers/{offerId}/decline
    POST /support/requests/{id}/offers/{offerId}/cancel

Internally these may call existing `CreateSupportResponse`, `ListSupportResponses`, and `AcceptSupportResponse` code at first. The important behavior is that a private offer is visible to the requester, not public feed viewers, and no chat opens until the requester accepts it. Offer types should align with request support type: `chat`, `call`, and `meetup`. A `general` support request may accept `chat` offers by default and can optionally allow `call` or `meetup` if the requester explicitly permits those later. For the first implementation, keep the available primary offer tied to the request support type to avoid confusing users.

Milestone 4 replaces channel-specific open queue reads with a unified ranked feed. Change `GET /support/requests` so it accepts:

    filter=all|urgent|unanswered
    support_type=chat|call|meetup|general, optional
    topic=anxiety, optional and repeatable later
    cursor=opaque token
    limit=20

Do not require `channel`. For compatibility during rollout, the handler may still accept `channel` but should ignore it or map it to filters only while the app is transitioning. The response should stay a cursor page with `items`, `limit`, `has_more`, and `next_cursor`.

Ranking should be computed by the backend and should be deterministic. Start with an understandable score and sort tail rather than an opaque recommender:

    urgency_score:
        high = 300
        medium = 200
        low = 100

    priority_boost:
        active priority = 40
        no priority = 0

    unanswered_boost:
        reply_count = 0 and offer_count = 0 gives 80
        offer_count = 0 gives 50
        otherwise 0

    freshness_boost:
        greatest for new requests and decays with age

    active_penalty:
        active or closed requests are excluded from open feed
        requests the viewer already offered on are demoted

The exact SQL may use computed columns in a common table expression. Store the score in the cursor only if needed for stable keyset pagination; do not store it permanently on the request row. The final order should be `score DESC`, then `created_at DESC`, then `id DESC`. If the team prefers the older fairness model where older unanswered items rise above newer ones, record that decision in this ExecPlan before implementation. The first implementation should favor urgent, unanswered, recent requests while preventing old answered requests from dominating.

Milestone 5 adds anti-abuse rules for high urgency. Backend enforcement should live in the create-request path, not the app. Add a helper such as `CanCreateHighUrgencyRequest(ctx, userID)` that enforces a cap of two or three high-urgency open-or-recent requests per day and a cooldown between high-urgency requests. Return a stable error code or message when blocked, such as `high_urgency_limit_reached`. Do not block low or medium support requests because the user may still need help.

Milestone 6 updates tests. Add or update backend tests in `internal/support/logic_test.go`, `internal/support/handler_test.go`, and `internal/support/queue_ranking_test.go`. Tests must prove that high urgency is free, priority does not override urgent need, unanswered requests get lifted, public replies increment `reply_count`, private offers increment `offer_count`, accepting an offer creates or opens a chat, and closed requests cannot receive new replies or offers.

## App Plan Of Work

The app work starts only after the backend contract is clear enough to compile against.

Milestone 1 updates API types and query keys. In `src/api/client.ts`, replace the old support request unions with the new `SupportUrgency`, `SupportType`, `SupportTopic`, `PreferredGender`, and `SupportLocation` types. Add explicit interfaces for `SupportReply`, `SupportOffer`, `CreateSupportRequestInput`, `CreateSupportReplyInput`, and `CreateSupportOfferInput`. Add functions for:

    getSupportRequests(filter, cursor, limit)
    getMySupportRequests(cursor, limit)
    getSupportRequest(id)
    createSupportRequest(input)
    closeSupportRequest(id)
    getSupportReplies(requestId, cursor, limit)
    createSupportReply(requestId, input)
    getSupportOffers(requestId, cursor, limit)
    createSupportOffer(requestId, input)
    acceptSupportOffer(requestId, offerId)
    declineSupportOffer(requestId, offerId)
    cancelSupportOffer(requestId, offerId)

Keep compatibility wrappers only while `SupportScreen.tsx` is being migrated. Remove dead immediate/community creation wrappers before the plan is complete.

Milestone 2 updates query hooks in `src/hooks/queries/useSupport.ts` and keys in `src/query/queryKeys.ts`. Replace the current `useSupportRequests(channel, limit, enabled)` with `useSupportRequests(filter, limit, enabled)`, where filter is `all`, `urgent`, or `unanswered`. Add hooks for replies and offers if the detail screen needs infinite pagination. Query keys must include filter and limit so React Query does not mix pages from different views.

Milestone 3 redesigns `src/screens/main/SupportScreen.tsx` around one feed. Replace the `Immediate` and `Community` top-level tabs with:

    Feed
    My requests
    Create

Inside `Feed`, use a secondary segmented control:

    All
    Urgent
    Unanswered

The feed must render with `FlatList` using existing list performance helpers. Do not wrap a long mapped list in `ScrollView`. Feed cards should show urgency, support type, topics, time posted, reply count, offer count, and a small `Priority` badge only when relevant. The primary card action depends on support type: `Offer chat`, `Offer call`, `Offer meetup`, or `Reply` for general requests. A secondary action can open the request detail thread.

Milestone 4 adds or extracts a request detail view. The current support screen expands offer lists only inside `My requests`. The unified model needs a detail surface where anyone can read public replies and the requester can manage private offers. Follow the app's existing navigation pattern: if support drill-downs are owned by `AppNavigator`, add the detail there; if the current screen uses local full-screen branch state for support subflows, keep the first implementation local and record the choice in the Decision Log. The detail view should show the full request, public replies, a reply composer, and private offer actions. For the requester, it should also show offers with accept/decline controls.

Milestone 5 rebuilds creation. The create flow should ask for support type, topics, urgency, optional preferred gender, optional location visibility, and message. Urgency options must always include `High` for all users. Do not present high urgency as a paid feature. If the backend rejects a high-urgency request because of a cap or cooldown, show the backend message with `Alert.alert`. Location should default to hidden unless the user already has a coarse city profile and explicitly chooses to include it.

Milestone 6 updates `My requests`. The requester management tab should include open, active, and closed scopes. Open requests show reply and offer counts. Active requests show the accepted offer and `Open chat` when a chat exists. Closed requests are history. The requester should be able to close a request at any stage, and closing must invalidate feed, my requests, replies, offers, chats, and chat-message queries as appropriate.

Milestone 7 performs UI cleanup and removes obsolete channel language. Remove copy that says urgent lane, immediate lane, community board, or two-list support. Use plain labels like `High`, `Medium`, `Low`, `Chat`, `Call`, `Meetup`, `General`, `Replies`, and `Offers`. Keep public replies and private offers visually distinct so users understand that replying is visible while offering creates a private request for acceptance.

## Concrete Steps

Before implementation, create branches in both repositories:

    cd /home/michaelroddy/repos/project_radeon
    git checkout -b feature/unified-support-feed

    cd /home/michaelroddy/repos/project_radeon_app
    git checkout -b feature/unified-support-feed

If the app repository is already on `feature/unified-support-feed-plan`, either rename it or branch from it:

    git checkout -b feature/unified-support-feed

Run baseline backend tests:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache go test ./internal/support ./internal/chats ./cmd/api

Run baseline app typecheck:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Implement backend migration and support package changes first. After each backend milestone, run:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache go test ./internal/support

After route changes, also run:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache go test ./internal/chats ./cmd/api

Apply migrations locally only after reviewing the generated SQL:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache make migrate

If the backend Postman collection is part of this repository's API workflow, regenerate it after endpoint changes:

    cd /home/michaelroddy/repos/project_radeon
    node scripts/generate_postman_collection.js

Implement app changes after the backend types and endpoints are in place. After each app milestone, run:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Start the backend and app for manual validation:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

Use the configured `EXPO_PUBLIC_API_URL` if the backend is not on the default platform URL.

## Validation And Acceptance

Validation must prove the product behavior end to end.

First validate request creation. Log in as a user and create a high-urgency chat request with topics `cravings` and `anxiety`. The app must allow high urgency without premium. The created card should appear in `Feed > All` and `Feed > Urgent`, with support type `Chat`, urgency `High`, both topic chips, and zero replies and offers.

Next validate public replies. Log in as a second user, open the request detail, and post a public reply. The reply should appear in the request thread for both users. The feed card should show `1 reply`. This should not create a direct chat and should not move the request to active.

Next validate private offers. As the second user, create a chat offer. The offer should be visible to the requester in the request detail or `My requests`, and the feed card should show `1 offer`. No chat should open until the requester accepts the offer.

Next validate acceptance. As the requester, accept the private chat offer. The request should move from open to active, disappear from the open feed for other helpers, and expose `Open chat` for the requester and accepted helper. The backend must create or reuse exactly one direct chat for that accepted pair.

Next validate ranking. Create several requests with different urgency, priority, reply counts, and offer counts. A high-urgency free request with no replies or offers should rank above a low-urgency priority request in ordinary circumstances. An unanswered medium request should rank above a similar medium request that already has replies and offers. Pagination should return no duplicates across pages.

Next validate filters. `Urgent` should show high-urgency open requests only. `Unanswered` should show open requests with no public replies and no private offers. `All` should show all open requests. Changing filters should reset pagination to the first page.

Next validate high-urgency abuse controls. Create high-urgency requests until the backend limit is hit. The app should show a clear alert from the backend and still allow low or medium requests if the one-open-request rule permits another request in the test scenario. If the current product keeps the one-open-request rule, test the high-urgency cap with closed historical requests or a focused backend unit test.

Finally validate closure. Close an open or active request. It should stop accepting replies and offers, leave the open feed, and remain visible in `My requests > Closed`. If it had an accepted chat, that chat should show the existing closed-chat behavior and reject new messages.

## Idempotence And Recovery

This plan should be executed additively first. Add columns, tables, handlers, and app types before removing old channel-specific API functions. Migrations should use `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and deterministic backfills where practical. If the urgency migration changes existing enum-like constraints, test it against a local database before applying it to shared environments.

If the unified feed ranking causes unexpected results, the recovery path is to keep the new metadata and temporarily sort open requests by `created_at DESC` with urgency as the first sort key. Do not roll back public replies or support offers unless the data model itself is faulty.

If the API rename from responses to offers creates too much churn, keep the database and Go method names temporarily and expose offer terminology only in JSON and TypeScript. Record that compromise in the Decision Log and schedule a cleanup milestone.

If app implementation becomes too large for one screen, extract support-specific components under `src/components/` only for genuinely shared UI. Screen-specific helpers may remain inside `SupportScreen.tsx` at first, but if the file grows further, split request cards, reply rows, offer rows, and the create form into focused files that match the component naming standard.

## Artifacts And Notes

The current app seams to change are:

    src/api/client.ts
        SupportRequest
        SupportResponse
        createImmediateSupportRequest(...)
        createCommunitySupportRequest(...)
        getSupportRequests(channel, cursor, limit)
        createSupportResponse(...)
        acceptSupportResponse(...)

    src/hooks/queries/useSupport.ts
        useSupportRequests(channel, limit, enabled)

    src/query/queryKeys.ts
        supportRequests({ scope, channel, limit })
        supportResponses(requestId, params)

    src/screens/main/SupportScreen.tsx
        SupportSurface = 'immediate' | 'community' | 'my_requests' | 'create'
        SupportRequestChannel = 'immediate' | 'community'
        SUPPORT_TYPE_LABELS using legacy request types
        SUPPORT_URGENCY_OPTIONS using legacy urgency values
        response expansion inside own request cards

The current backend seams to change are:

    internal/support/handler.go
        validSupportTypes
        validSupportUrgencies
        CreateImmediateSupportRequest(...)
        CreateCommunitySupportRequest(...)
        ListSupportRequests(...)
        CreateSupportResponse(...)
        AcceptSupportResponse(...)
        ListSupportResponses(...)

    internal/support/store.go
        SupportRequest
        SupportResponse
        SupportQueueCursor
        CreateImmediateSupportRequest(...)
        CreateCommunitySupportRequest(...)
        ListVisibleSupportRequests(...)
        CreateSupportResponse(...)
        AcceptSupportResponse(...)
        ListSupportResponses(...)

    internal/support/logic.go
        createChannelSupportRequestInput
        normalizeCreateChannelSupportRequestInput(...)
        validateCreateChannelSupportRequestInput(...)
        createSupportResponseInput
        validateCreateSupportResponseInput(...)

The first implementation should not add external services, queues, or caching. PostgreSQL ranking with keyset pagination is enough until load tests prove otherwise.

## Interfaces And Dependencies

At the end of this plan, the backend must expose these concepts in JSON even if internal table names are transitional:

    type SupportUrgency = 'low' | 'medium' | 'high'
    type SupportType = 'chat' | 'call' | 'meetup' | 'general'
    type SupportTopic = 'anxiety' | 'relapse_risk' | 'loneliness' | 'cravings' | 'depression' | 'family' | 'work' | 'sleep' | 'celebration' | 'general'
    type PreferredGender = 'woman' | 'man' | 'non_binary' | 'no_preference'
    type SupportRequestFilter = 'all' | 'urgent' | 'unanswered'

The app must call one unified open-feed endpoint:

    GET /support/requests?filter=all&cursor=...&limit=20

The app must use separate endpoints for public replies and private offers:

    GET /support/requests/{id}/replies
    POST /support/requests/{id}/replies
    GET /support/requests/{id}/offers
    POST /support/requests/{id}/offers
    POST /support/requests/{id}/offers/{offerId}/accept

The backend may keep older endpoint aliases during migration, but the finished app should not depend on `/support/requests/immediate`, `/support/requests/community`, channel-specific open feeds, or user-facing "response" terminology for private offers.

Revision note: 2026-04-29 / Codex created this plan after the user chose a unified support feed with free urgency, paid priority amplification, support types, topics, optional gender/location matching, public replies, and private requester-accepted support offers.
