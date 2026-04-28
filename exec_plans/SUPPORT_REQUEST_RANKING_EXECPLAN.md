# Production-Grade Support Request Ranking

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

After this change, open support requests in both the `Immediate` and `Community` queues will surface in a way that is fair, predictable, and fast under production load. A supporter opening the queue should see the requests that most need attention first, not simply the newest requests. Requests with no responses should rise quickly, requests that already have fresh attention should cool down temporarily, and supporters should not keep seeing the same request at the top after they have already responded.

This work is successful when an open support request can be created, responded to, and then observed to move through the queue according to clear rules that are enforced by the backend rather than improvised in the app. The ranking must remain stable across pagination, cheap to query repeatedly, and understandable enough that future contributors can tune it without reverse-engineering a black-box score.

## Progress

- [x] (2026-04-28 15:55Z) Replaced the older support-ranking ExecPlan, which described an outdated audience/priority model that no longer matches the current request-thread system.
- [x] (2026-04-28 18:34Z) Added `support_requests.last_response_at`, backfilled it from `support_responses`, and updated response creation so `response_count` and `last_response_at` move together.
- [x] (2026-04-28 18:34Z) Implemented lane-specific backend queue ranking for `Immediate` and `Community`, including attention buckets and viewer-response demotion.
- [x] (2026-04-28 18:34Z) Replaced recency-only open-queue pagination with an opaque keyset cursor based on ranking fields plus `id`.
- [x] (2026-04-28 18:34Z) Added and applied the queue-ranking migration and supporting indexes, and regenerated the Postman collection to the new queue contract.
- [x] (2026-04-28 18:34Z) Updated the app to request ranked open queues by channel and to render backend order without client-side resorting.
- [x] (2026-04-28 18:34Z) Added backend unit coverage for ranking helpers, cursor behavior, and the new `general` query alias, then verified backend/app compilation.

## Surprises & Discoveries

- Observation: the checked-in support-ranking plan in this repository was written for an older support model with `audience`, paid priority boosts, and different request lifecycle assumptions.
    Evidence: the previous version of `exec_plans/SUPPORT_REQUEST_RANKING_EXECPLAN.md` described `priority_visibility`, `audience`, and a scored discovery model that does not match the current `open -> active -> closed` support request flow.

- Observation: the current support queue endpoint already denormalizes enough request data to rank cheaply, but it still orders mostly by channel, urgency, and recency.
    Evidence: `internal/support/store.go` currently orders visible requests by `channel`, `urgency`, `created_at`, and `id`, without any notion of stale attention or response saturation.

- Observation: the app’s open support queue was implicitly mixed-lane and needed an explicit lane parameter from the backend once ranking became queue-specific.
    Evidence: `useSupportRequests` and `getSupportRequests` had to change from a generic open-queue fetch to a channel-aware contract so `Immediate` and `Community` could page independently without app-side filtering.

## Decision Log

- Decision: ranking will stay server-side and database-first for the first production implementation.
    Rationale: this repository already serves queue pages from Go and PostgreSQL. Pushing ranking into the app would create inconsistent views and weak pagination. Introducing Redis or an asynchronous scorer immediately would add operational complexity before proving that the simpler approach is insufficient.
    Date/Author: 2026-04-28 / Codex

- Decision: the ranking model will be a queue ranker, not a social-feed score.
    Rationale: support requests should be surfaced by need for attention, not by popularity or engagement. Queue semantics are easier to explain, easier to test, and less likely to create harmful pile-on behavior.
    Date/Author: 2026-04-28 / Codex

- Decision: per-viewer personalization is limited to whether the viewer has already responded to the request.
    Rationale: this is the one viewer-specific signal that materially improves the queue without turning the system into an opaque recommender. It also has a cheap, indexable database implementation through `support_responses`.
    Date/Author: 2026-04-28 / Codex

- Decision: `Immediate` and `Community` use the same ranking framework but different cooling windows.
    Rationale: the product should behave consistently across both lanes, but `Immediate` needs stale unanswered requests to rise much faster than `Community`.
    Date/Author: 2026-04-28 / Codex

- Decision: the open support queue now requires a `channel` query parameter and returns an opaque `cursor` token rather than a raw timestamp `before` value.
    Rationale: once ranking depends on attention buckets and deterministic tie-breakers, timestamp-only pagination is no longer stable or correct across pages.
    Date/Author: 2026-04-28 / Codex

## Outcomes & Retrospective

The ranking rollout landed cleanly with a DB-first implementation and no extra infrastructure. The backend now ranks open support requests by attention need instead of recency, the app requests the correct lane directly, and the open queue paginates through an opaque keyset cursor that is stable under the new sort order.

What remains outside this plan is behavioral/manual validation in a live app session to observe queue reordering after real response activity. Compile-time verification and targeted backend tests are in place, but the end-to-end human check is still worth doing against a dev database.

## Context and Orientation

There are two repositories involved in this feature.

The backend lives at `/home/michaelroddy/repos/project_radeon`. The support queue is implemented in `internal/support/store.go` and exposed over HTTP in `internal/support/handler.go`, then mounted from `cmd/api/main.go`. The current open-queue query is `ListVisibleSupportRequests`. The current support-request lifecycle is request-centric: a request is `open`, later may become `active` after the requester accepts a response, and eventually becomes `closed`. Supporters respond through `support_responses`, and `support_requests.response_count` is already maintained.

The app lives at `/home/michaelroddy/repos/project_radeon_app`. The support queue is fetched through `src/api/client.ts`, queried with React Query in `src/hooks/queries/useSupport.ts`, and rendered in `src/screens/main/SupportScreen.tsx`. The app should not compute its own ranking. It should display the order provided by the backend.

The term “keyset pagination” is important here. In this repository, cursor pagination currently uses a timestamp such as `created_at` and asks for items “before” that timestamp. Keyset pagination means the cursor contains the exact ordering fields used by the query, so the next page can continue from the same sorted position without duplicates, reordering, or the performance problems of SQL `OFFSET`. That matters because ranking will no longer be simple recency ordering.

The term “cooling window” is also important. A cooling window is a short time period after a request receives attention during which that request is temporarily ranked below still-unanswered requests. This prevents a request with several fresh responses from dominating the queue while another request has none.

## Plan of Work

The implementation should proceed in four milestones.

The first milestone adds the minimal ranking data model. `support_requests` already has `response_count`, but it does not currently store the time of the latest response. Add `last_response_at TIMESTAMPTZ NULL` to `support_requests` in a new backend migration. Update `internal/support/store.go` so `CreateSupportResponse` increments `response_count` and sets `last_response_at = NOW()` in the same write path. Update request creation paths so new requests start with `response_count = 0` and `last_response_at = NULL`. This milestone also defines the exact ranking buckets in code comments and tests before the actual queue query is changed.

The second milestone changes backend ranking. Replace the current `ORDER BY channel, urgency, created_at DESC, id DESC` inside `ListVisibleSupportRequests` with lane-specific ranking logic that derives three fields for every visible request: `has_viewer_responded`, `attention_bucket`, and a deterministic sort tail. `has_viewer_responded` comes from an indexed `EXISTS` check against `support_responses`. `attention_bucket` is derived from `response_count` and `last_response_at`. For `Immediate`, bucket `0` means zero responses, bucket `1` means one or two responses but no recent response in the last ten minutes, bucket `2` means the request already has fresh attention, and bucket `3` means the viewer already responded. For `Community`, the same structure applies, but the stale-attention threshold is one hour instead of ten minutes. Inside each bucket, older requests sort first using `created_at ASC`, then `id ASC`. This preserves fairness while keeping the rule set understandable.

The third milestone upgrades pagination and indexing. Because the queue is no longer ordered by a single timestamp, the cursor parser in the support handler layer must move from a plain `before` timestamp to a structured cursor that captures the ranking fields: `channel`, `has_viewer_responded`, `attention_bucket`, `created_at`, and `id`. The implementation does not need a new public route, but the query-string cursor token must become an encoded value rather than a raw timestamp. Add indexes that support the open-queue filter and the viewer-response lookup. At minimum, add an index on `support_requests(channel, status, created_at, id)` restricted to open rows if the database style in this repo allows it, and an index on `support_responses(responder_id, support_request_id)`. The acceptance criteria for this milestone are stable pagination with no duplicates when a request moves between pages because of new responses.

The fourth milestone updates the app and validates the behavior end to end. `src/api/client.ts` should continue to expose the same support-request types unless the backend cursor contract changes shape. `src/hooks/queries/useSupport.ts` should pass the cursor through without trying to interpret ranking locally. `src/screens/main/SupportScreen.tsx` must not resort items client-side. Add an observable scenario in which two open requests are created, one receives a response, and the queue reorders so the still-unanswered request rises above the newly-answered one. Validation must prove this in both `Immediate` and `Community`.

## Concrete Steps

Run every backend command from `/home/michaelroddy/repos/project_radeon`.

Create a new migration after the current latest migration:

    cat > migrations/049_support_request_queue_ranking.sql

The migration should add `last_response_at` to `support_requests`, backfill it from `support_responses` by taking `MAX(created_at)` per request, and add the queue indexes described in this plan. Then apply it:

    GOCACHE=/tmp/go-build-cache make migrate

Expected transcript:

    /usr/local/go/bin/go run ./cmd/migrate up
    Applied 049_support_request_queue_ranking.sql

Update `internal/support/store.go` so `CreateSupportResponse` updates `last_response_at`, then replace the `ListVisibleSupportRequests` ordering with a common-table-expression query that calculates `has_viewer_responded` and `attention_bucket`. The query must keep filtering to `sr.status = 'open'` and `sr.requester_id <> $1`.

Update `internal/support/handler.go` if the cursor representation changes. If the existing pagination helper cannot express the new keyset, define a support-specific cursor parser rather than forcing the generic timestamp cursor to pretend ranking is still pure recency.

Run backend verification:

    GOCACHE=/tmp/go-build-cache go test ./internal/support ./cmd/api

Expected result:

    ok  	github.com/project_radeon/api/internal/support	...
    ok  	github.com/project_radeon/api/cmd/api	...

Run the app verification from `/home/michaelroddy/repos/project_radeon_app`:

    npx tsc --noEmit

Expected result:

    no output, exit code 0

If the backend Postman collection is maintained as part of the API surface, regenerate it after the route or request-body contract changes:

    node scripts/generate_postman_collection.js

## Validation and Acceptance

Acceptance is behavioral, not just compile-time.

First, create two open immediate requests with different `created_at` times. The older request should appear above the newer request if neither has any responses. Then create a support response on the older request. Refresh the open immediate queue as a different supporter. The older request should cool down and the unanswered request should now rank above it. Wait longer than the immediate cooling window and refresh again. If the older request still has only one or two responses and no accepted responder, it should rise back above requests that are newer but equally unattended.

Repeat the same scenario in the community lane, but verify that the cooling window is longer. A fresh response should suppress queue prominence immediately, but the request should not resurface until at least one hour has passed or the test clock is advanced in a controlled test.

Add automated tests in the backend that prove:

- zero-response requests outrank recently-answered requests in the same lane,
- already-responded requests rank below otherwise-similar requests for the same viewer,
- pagination remains stable when two requests share the same `created_at`,
- active and closed requests never appear in the open queue.

Manual acceptance for the app is complete when the support queue visually changes order after a response is created and no client-side re-sorting logic exists in `SupportScreen.tsx`.

## Idempotence and Recovery

This plan is safe to execute incrementally. The migration must use `ADD COLUMN IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` where possible so reruns do not fail unnecessarily. If the migration is applied to a database with live traffic, the backfill query for `last_response_at` should be written to be restart-safe: setting the column to `MAX(created_at)` per request is deterministic and can be run more than once.

If the new queue ordering causes unexpected behavior, the safest recovery path is to keep the new column and indexes in place but temporarily revert only the `ORDER BY` logic in `ListVisibleSupportRequests` back to recency ordering. Do not drop the migration in production as the first rollback move.

If the new cursor implementation produces duplicates or gaps, revert the handler and store to the old timestamp cursor while preserving the denormalized ranking fields. That gives a working queue while the keyset implementation is corrected.

## Artifacts and Notes

The most important ranking rule to keep in mind is this:

    unanswered first,
    then stale-lightly-answered,
    then freshly-answered,
    then requests the current supporter already responded to.

The intended immediate ordering is:

    ORDER BY
        has_viewer_responded ASC,
        attention_bucket ASC,
        created_at ASC,
        id ASC

Where `attention_bucket` is derived as:

    0 when response_count = 0
    1 when response_count in (1, 2) and last_response_at is null or older than 10 minutes
    2 when response_count >= 3 or last_response_at is within 10 minutes
    3 when the viewer has already responded

The intended community ordering is identical except that “older than 10 minutes” becomes “older than 60 minutes”.

These rules are deliberately simple. They are meant to be cheap to compute and easy to debug from SQL results.

## Interfaces and Dependencies

At the end of this plan, the following backend elements must exist.

In `internal/support/store.go`, `CreateSupportResponse` must update both:

    response_count = response_count + 1
    last_response_at = NOW()

In `internal/support/store.go`, `ListVisibleSupportRequests` must continue to return `[]SupportRequest`, but the sorting must be based on ranked queue fields rather than pure recency.

In the database, `support_requests` must have:

    last_response_at TIMESTAMPTZ NULL

In the database, `support_responses` must keep an index equivalent to:

    (responder_id, support_request_id)

In `src/hooks/queries/useSupport.ts`, the app must continue to fetch queue pages from the backend and must not apply any additional sort to the returned items.

Revision note: 2026-04-28 / Codex replaced the older audience-and-priority ranking ExecPlan with a new production queue-ranking plan that matches the current peer-support request model and current repository state.
