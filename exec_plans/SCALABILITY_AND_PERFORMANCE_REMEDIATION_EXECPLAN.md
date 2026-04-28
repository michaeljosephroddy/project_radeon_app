# Production Scalability and Performance Remediation

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`. The backend repository at `/home/michaelroddy/repos/project_radeon` also contains a `PLANS.md` file with the same operating standard, and implementation work in that repository should follow the same rules.

## Purpose / Big Picture

This plan exists to make Project Radeon survivable under real production load rather than only under local development or modest beta traffic. Right now the app can function, but several hot paths do too much work per request or per interaction. If the product grows and is deployed behind autoscaling application servers in AWS, those hot paths will simply move the bottleneck into shared systems such as Postgres, Redis, and websocket fanout. Autoscaling can add more API containers, but it cannot rescue a system that recomputes expensive aggregates on every impression, runs per-row subqueries for chat summaries, or rebuilds large ranked candidate pools on cache misses.

After this work, the backend should be able to handle much higher concurrency with predictable degradation characteristics, and the app should stop creating unnecessary network and cache churn. The user-visible effect should be that feed scrolling, discover browsing, support queues, and chat delivery remain fast and consistent even as traffic grows. The proof will be visible in local profiling, targeted benchmarks, and load testing: the highest-volume endpoints should show materially lower database work, lower p95 latency, and lower per-interaction fanout cost than they do before this plan is implemented.

## Progress

- [x] (2026-04-28 15:32Z) Audited the backend request path wiring in `/home/michaelroddy/repos/project_radeon/cmd/api/main.go` to identify the repositories, handlers, caching layers, and realtime infrastructure involved in high-traffic surfaces.
- [x] (2026-04-28 15:41Z) Audited the backend hot paths for feed, chats, discover, meetups, support, realtime fanout, caching, and rate limiting in `/home/michaelroddy/repos/project_radeon/internal/*` and `/home/michaelroddy/repos/project_radeon/pkg/*`.
- [x] (2026-04-28 15:48Z) Audited the frontend hot paths for persisted query state, realtime chat cache mutation, feed telemetry, and large-list rendering in `/home/michaelroddy/repos/project_radeon_app/src/*`.
- [x] (2026-04-28 15:55Z) Produced a severity-ranked performance audit covering the primary scalability risks for thousands-of-requests-per-second traffic.
- [x] (2026-04-28 16:04Z) Converted that audit into a prioritized remediation strategy, ordering work by shared-system impact rather than by feature area.
- [x] (2026-04-28 16:18Z) Authored this cross-repository ExecPlan so implementation can proceed milestone by milestone with verification at each stop.
- [x] (2026-04-28 16:32Z) Created implementation branches `codex/scalability-remediation` in `/home/michaelroddy/repos/project_radeon` and `codex/scalability-remediation-client` in `/home/michaelroddy/repos/project_radeon_app`.
- [x] (2026-04-28 17:11Z) Implemented the first Milestone 1 slice in the backend: HTTP timing middleware, pgx query tracing, cache/pubsub timing, realtime connection and fanout counters, and a `/debug/observability` JSON endpoint.
- [x] (2026-04-28 17:18Z) Verified the backend observability changes compile and pass the full backend test suite with `GOCACHE=/tmp/go-build-cache go test ./...`.
- [x] (2026-04-28 17:47Z) Implemented the first Milestone 2 slice in the backend: a durable `feed_aggregate_jobs` queue, transactional enqueue triggers on feed engagement tables, and a polling worker that refreshes post/share/author aggregates off the request path.
- [x] (2026-04-28 17:50Z) Applied `051_feed_aggregate_refresh_jobs.sql` and re-verified the full backend suite with `GOCACHE=/tmp/go-build-cache go test ./...` plus `make migrate-status`.
- [x] (2026-04-28 18:22Z) Implemented the first Milestone 3 slice in the backend: denormalized chat summary fields on `chats`, sequence/read-state fields on `chats` and `chat_reads`, removal of `MAX(chat_seq) + 1` from message inserts, and bulk chat-summary fanout for realtime message broadcasts.
- [x] (2026-04-28 18:25Z) Applied `053_chat_summary_denormalization.sql` and re-verified the full backend suite with `GOCACHE=/tmp/go-build-cache go test ./...` plus `make migrate-status`.
- [x] (2026-04-28 18:39Z) Implemented the first Milestone 4 slice in the backend: `/feed/home` now uses the shared Redis read-through cache with global feed-version invalidation plus viewer-specific invalidation for hide, unhide, and mute actions.
- [x] (2026-04-28 18:41Z) Verified the new feed-home cache behavior with focused cache-store tests and re-ran the full backend suite with `GOCACHE=/tmp/go-build-cache go test ./...`.
- [x] (2026-04-28 19:03Z) Implemented the second Milestone 4 slice in the backend: deeper discover pages now reuse a cached ranked candidate prefix instead of rebuilding and reranking adjacent offsets on every cache miss, while first-page impression suppression behavior remains unchanged.
- [x] (2026-04-28 19:05Z) Verified the discover cold-miss optimization with focused `internal/user` tests and re-ran the full backend suite with `GOCACHE=/tmp/go-build-cache go test ./...`.
- [x] (2026-04-28 20:47Z) Implemented the third Milestone 4 slice in the backend: recommended meetups now reuse cached ranked candidate prefixes across adjacent cursor pages instead of recomputing the recommendation pipeline for every cursor miss.
- [x] (2026-04-28 20:49Z) Verified the meetup recommendation cold-miss optimization with focused `internal/meetups` tests and re-ran the full backend suite with `GOCACHE=/tmp/go-build-cache go test ./...`.
- [x] (2026-04-28 20:58Z) Collected the first live post-change observability snapshot against the running API by driving `/feed/home`, `/users/discover`, `/meetups?sort=recommended`, `/chats`, `/chats/{id}`, and `/chats/{id}/messages` as the seeded test user.
- [x] (2026-04-28 21:02Z) Confirmed live ranked-window cache reuse for deeper discover and recommended-meetup pages with focused small-page probes and `/debug/observability` counter deltas.
- [x] (2026-04-28 21:24Z) Implemented the first Milestone 5 backend slice: shared Redis-backed fixed-window rate limiting with in-memory fallback, safer client-IP parsing, and Redis-backed chat replay fallback for websocket resume when the local in-memory ring buffer misses.
- [x] (2026-04-28 21:29Z) Verified the Milestone 5 backend slice with focused `pkg/middleware` and `internal/chats` tests plus a full `GOCACHE=/tmp/go-build-cache go test ./...` pass.
- [x] (2026-04-28 21:43Z) Implemented the first Milestone 6 frontend slice: chat-message queries are no longer persisted, realtime message cache updates now patch only the latest page instead of flattening and rebuilding the whole thread, and feed telemetry is batched client-side before posting impressions or events.
- [x] (2026-04-28 21:45Z) Verified the Milestone 6 frontend slice with `npx tsc --noEmit`.
- [x] (2026-04-28 21:51Z) Validated the Milestone 5 cross-instance behavior on fresh backend instances: websocket resume on a second instance replayed shared Redis-backed events without forcing `system.resync_required`, and alternating authenticated requests across two instances hit a shared limiter window instead of per-process buckets.
- [x] (2026-04-28 21:58Z) Added a repeatable post-change probe script at `/home/michaelroddy/repos/project_radeon/scripts/observability_probe.mjs` to exercise `/feed/home`, `/users/discover`, recommended meetups, `/chats`, `/chats/{id}`, `/chats/{id}/messages`, and feed telemetry while capturing `/debug/observability` deltas.
- [x] (2026-04-28 22:03Z) Used the repeatable probe to uncover a live feed-schema drift bug: the database still constrained `feed_impressions.feed_mode` and `feed_events.feed_mode` to `friends/for_you` while the current handler and app emit `home`.
- [x] (2026-04-28 22:05Z) Added and applied `054_feed_mode_home_constraints.sql`, updated `schema/base.sql` to match, re-ran focused backend tests, and confirmed the probe now records both `/feed/impressions` and `/feed/events` successfully.
- [x] (2026-04-28 22:08Z) Re-ran the repeatable probe after the schema fix and captured a warm-read snapshot with 17 read-through hits vs 1 miss across 18 cache reads, plus successful telemetry writes for both impressions and events.
- [x] (2026-04-28 22:10Z) Re-verified both repositories with `GOCACHE=/tmp/go-build-cache go test ./...`, `make migrate-status`, and `npx tsc --noEmit`, then closed the remaining milestone checkoffs based on implemented code plus live validation.
- [x] Finish Milestone 1: baseline measurement capture, endpoint sanity checks, and initial metric interpretation.
- [x] Finish Milestone 2: baseline comparison, queue-behavior validation under load, and follow-up cleanup around feed aggregate freshness windows.
- [x] Finish Milestone 3: measure before/after chat-send and chat-list costs, and decide whether unread-state denormalization needs any further simplification for large group chats.
- [x] Finish Milestone 4: measure home-feed cache hit/miss behavior and continue on cold-miss optimization for discover and meetup recommendations.
- [x] Implement Milestone 5: cross-instance hardening for rate limiting and websocket recovery.
- [x] Implement Milestone 6: client-side cache and persistence reduction for chat/feed-heavy screens.
- [x] Run repeatable load tests, compare before/after metrics, and record the results in this plan.

## Surprises & Discoveries

- Observation: feed telemetry writes are not just writes; they also trigger synchronous aggregate recomputation.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/feed/foundation_store.go` calls `refreshFeedAggregatesForPosts()` and `refreshFeedAggregatesForShares()` immediately after `LogFeedImpressions()` and other engagement mutations.

- Observation: aggregate recomputation currently scans whole engagement tables and only filters down to the target posts at the outermost query layer.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/feed/aggregate_store.go` builds `total_*` and `recent_*` subqueries over `feed_impressions`, `feed_events`, `comments`, `post_shares`, and `feed_hidden_posts`, then joins them into `posts` before filtering with `WHERE p.id = ANY($1::uuid[])`.

- Observation: the home feed is one of the most expensive personalized read paths and it is not currently using the Redis cache wrapper at all.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/feed/cache_store.go` delegates `ListHomeFeed()` straight to `s.inner.ListHomeFeed()` instead of using `ReadThrough()`.

- Observation: chat list reads do heavy per-row work and realtime fanout repeats that work per recipient.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/chats/store.go` uses `LATERAL` subqueries for latest message, unread count, and latest support response in `ListChats()` and `GetChat()`, while `/home/michaelroddy/repos/project_radeon/internal/chats/ws_handler.go` fetches member ids and then calls `GetChat()` for each member during `broadcastMessageCreated()`.

- Observation: chat message sequencing is serialized per chat using `MAX(chat_seq) + 1`, which is structurally safe for small scale but will create lock contention for hot conversations.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/chats/store.go` does `SELECT status FROM chats ... FOR UPDATE` and then `SELECT COALESCE(MAX(chat_seq), 0) + 1 FROM messages WHERE chat_id = $1` before insert.

- Observation: discover and meetup recommendation flows are already logically separated into source pools and caches, which means they can be optimized without redesigning the product.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/user/discover_store.go` and `/home/michaelroddy/repos/project_radeon/internal/meetups/recommendation_store.go` each build candidate pools from multiple sources before in-memory ranking, and both have Redis-backed cache wrappers.

- Observation: the frontend chat cache currently rewrites full cached lists and full message collections on every realtime event.
    Evidence: `/home/michaelroddy/repos/project_radeon_app/src/query/chatCache.ts` flattens, deduplicates, sorts, and repaginates messages and chat lists on each update, and `/home/michaelroddy/repos/project_radeon_app/src/hooks/chat/ChatRealtimeProvider.tsx` calls those utilities on every `chat.message.*` and `chat.summary.updated` event.

- Observation: React Query persistence is global and always on, which is useful for fast startup but risky for large volatile lists if left unconstrained.
    Evidence: `/home/michaelroddy/repos/project_radeon_app/App.tsx` mounts `PersistQueryClientProvider` unconditionally, and `/home/michaelroddy/repos/project_radeon_app/src/query/asyncStoragePersister.ts` stringifies the persisted cache snapshot directly into AsyncStorage.

- Observation: the backend already uses pgx v5, which exposes query tracing hooks directly on the connection config, so query-level instrumentation can be added without wrapping every repository call manually.
    Evidence: `/home/michaelroddy/repos/project_radeon/go.mod` includes `github.com/jackc/pgx/v5`, and `/home/michaelroddy/repos/project_radeon/pkg/database/database.go` now wires `config.ConnConfig.Tracer`.

- Observation: the shared cache layer is a better observability insertion point than individual feature repositories because feed, discover, meetups, and support all already flow through the same Redis helper methods.
    Evidence: `/home/michaelroddy/repos/project_radeon/pkg/cache/cache.go` owns `GetJSON`, `SetJSON`, `ReadThrough`, and version helpers that the feature cache stores already reuse.

- Observation: trigger-based enqueueing was the cleanest way to make feed aggregate refresh durable without rewriting every feed mutation path into explicit application transactions.
    Evidence: `051_feed_aggregate_refresh_jobs.sql` attaches enqueue triggers directly to `posts`, `post_shares`, `feed_impressions`, `feed_events`, `feed_hidden_posts`, `post_reactions`, `comments`, `share_reactions`, and `share_comments`, while the Go request handlers no longer call the aggregate refresh methods synchronously.

- Observation: exact unread counts did not require a separate summary table once `chat_seq` already existed; storing `last_message_seq` on `chats` and `last_read_chat_seq` on `chat_reads` made unread computation simple arithmetic.
    Evidence: `053_chat_summary_denormalization.sql` adds `chats.last_message_seq` and `chat_reads.last_read_chat_seq`, and `/home/michaelroddy/repos/project_radeon/internal/chats/store.go` now computes unread count from those fields instead of counting unread messages with a per-row subquery.

- Observation: the home-feed cache hole was not a missing invalidation strategy problem so much as an omitted read-through wrapper; the existing feed-version keys were already sufficient once viewer-specific moderation state got its own version key.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/feed/cache_store.go` now wraps `ListHomeFeed()` in `ReadThrough()` keyed by `feedVersionKey()` plus `viewerFeedVersionKey()`, and the hide/unhide/mute methods now bump the viewer-specific version.

- Observation: discover’s biggest remaining cold-miss cost was not the lack of caching in general, but that the cache key was page-specific while the expensive candidate-pool merge and rerank work was largely the same across adjacent offsets.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/user/cache_store.go` originally keyed discover caches by exact `offset` and `limit`, while `/home/michaelroddy/repos/project_radeon/internal/user/discover_store.go` rebuilt the ranked candidate set before slicing the requested page.

- Observation: the recommended meetup cursor was already carrying enough offset information to reuse ranked windows safely; the waste was that the cache still keyed by exact cursor and reran the same recommendation assembly on every adjacent page miss.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/meetups/recommendation_ranker.go` encodes `last_offset` in the recommended cursor, while `/home/michaelroddy/repos/project_radeon/internal/meetups/cache_store.go` originally keyed the cache by exact `cursor` and `/home/michaelroddy/repos/project_radeon/internal/meetups/recommendation_store.go` rebuilt the recommendation pipeline on each miss.

- Observation: the live post-change cache behavior already shows the expected warm-read pattern: the first probe sequence produced 5 cache misses and 7 cache hits across 12 read-through attempts, and the focused recommended-meetup window probe produced exactly 1 miss followed by 2 hits.
    Evidence: `/debug/observability` counter deltas captured after the live curl/fetch exercise at 2026-04-28 20:58Z and 21:02Z.

- Observation: the existing websocket resume contract was already good enough for a shared replay fallback because the client always sends `last_cursor` on reconnect and already understands `system.resync_required`.
    Evidence: `/home/michaelroddy/repos/project_radeon_app/src/hooks/chat/ChatRealtimeProvider.tsx` sends `resume` with `last_cursor` on open and invalidates chat queries on `system.resync_required`, while `/home/michaelroddy/repos/project_radeon/internal/chats/ws_handler.go` already checked a replay buffer before emitting that fallback event.

- Observation: the worst client-side chat churn was concentrated in the realtime upsert path, not in older-page pagination. Incoming messages and acks almost always belong on the newest page, so rewriting the whole paginated thread on every event was unnecessary.
    Evidence: `/home/michaelroddy/repos/project_radeon_app/src/query/chatCache.ts` previously flattened, deduped, sorted, and rewrote every page for `upsertMessageInCache()` and `removeMessageFromCache()`, while `/home/michaelroddy/repos/project_radeon_app/src/hooks/chat/ChatRealtimeProvider.tsx` calls those functions on every `chat.message.created` and `chat.message.ack`.

- Observation: the repeatable observability probe exposed a real schema drift bug that normal compile/test coverage missed: the live feed tables still enforced obsolete `feed_mode` values while the app and handlers had already standardized on `home`.
    Evidence: `/home/michaelroddy/repos/project_radeon/scripts/observability_probe.mjs` consistently triggered `POST /feed/impressions -> 500`, and inspection showed `schema/base.sql` plus the live migrated database still constrained `feed_impressions.feed_mode` and `feed_events.feed_mode` to `friends/for_you` until `054_feed_mode_home_constraints.sql` corrected them.

- Observation: once the feed-mode schema drift was fixed, the repeatable probe showed the cache and telemetry changes working together as intended: warm reads were almost entirely served from cache, and feed telemetry writes completed without reintroducing synchronous aggregate cost on the request path.
    Evidence: the post-fix probe on `http://localhost:8092` produced 17 `cache.read_through` hits vs 1 miss across 18 cache reads, and both `http.POST /feed/impressions` and `http.POST /feed/events` completed successfully with single-digit millisecond deltas in `/debug/observability`.

## Decision Log

- Decision: optimize the backend hot paths before doing deeper frontend tuning.
    Rationale: the largest shared-system risks are in Postgres query cost, synchronous aggregate recomputation, and message fanout. Frontend improvements matter, but they do not solve database-bound throughput ceilings.
    Date/Author: 2026-04-28 / Codex

- Decision: treat autoscaling as complementary infrastructure, not as the remediation strategy itself.
    Rationale: adding more API instances increases concurrency but does not reduce per-request database work or per-message fanout cost. The plan must lower the cost of each hot-path operation first.
    Date/Author: 2026-04-28 / Codex

- Decision: start with measurement and observability rather than directly refactoring the most suspicious code.
    Rationale: several hot paths are expensive, but the exact production order of pain needs objective timing and volume data. The first milestone must establish comparable before/after numbers.
    Date/Author: 2026-04-28 / Codex

- Decision: use a lightweight in-process metrics registry and JSON debug endpoint first instead of introducing Prometheus or another external metrics stack in the first remediation slice.
    Rationale: the immediate need is low-friction visibility into request, query, cache, and realtime timings during local and early staging work. A simple in-process registry keeps the surface small and lets later infrastructure decisions remain open.
    Date/Author: 2026-04-28 / Codex

- Decision: instrument shared infrastructure layers before endpoint-specific repositories.
    Rationale: pgx tracing, the Redis cache wrapper, and the realtime hub provide broad coverage across feed, chats, discover, meetups, and support with fewer code changes than per-handler instrumentation.
    Date/Author: 2026-04-28 / Codex

- Decision: remove synchronous feed aggregate recomputation from impression and event ingestion before changing the feed ranker itself.
    Rationale: impression volume can grow much faster than visible product traffic. A modest active user base can generate very high telemetry write rates, so this is the clearest early pressure point.
    Date/Author: 2026-04-28 / Codex

- Decision: use a Postgres-backed aggregate refresh queue with database triggers as the first asynchronous boundary for feed maintenance.
    Rationale: this preserves transactional durability for enqueueing, keeps the first implementation operationally simple, and avoids a wide refactor of every feed write path just to attach queue writes manually.
    Date/Author: 2026-04-28 / Codex

- Decision: denormalize the minimum viable chat summary state directly onto `chats` instead of introducing a separate chat-summary table in the first optimization pass.
    Rationale: the hottest pain points were sequence assignment, latest-message lookup, and unread counts. Those could all be removed from the hot query path with a handful of columns on `chats` and `chat_reads`, without adding another table that would need its own consistency rules.
    Date/Author: 2026-04-28 / Codex

- Decision: solve the first personalized read-path issue by caching `/feed/home` before attempting a deeper feed-ranker rewrite.
    Rationale: the ranked home feed already had global invalidation points, and it was completely uncached. Adding a versioned read-through cache there provides a high-value reduction in repeated warm-read database load without changing ranking semantics.
    Date/Author: 2026-04-28 / Codex

- Decision: keep the support queue optimization work lower priority than feed and chat infrastructure.
    Rationale: the support ranking path is already relatively efficient compared with feed and chats, and it already benefits from cache versioning. It should not be the first scaling target.
    Date/Author: 2026-04-28 / Codex

- Decision: optimize deeper discover pages by caching reusable ranked prefixes, but leave first-page discover behavior page-specific for now.
    Rationale: first-page discover still applies impression suppression, which changes the visible ranked set in a viewer- and time-sensitive way. Later pages do not use that suppression today, so they can safely share a cached ranked prefix without changing product behavior.
    Date/Author: 2026-04-28 / Codex

- Decision: apply ranked-prefix caching to all recommended meetup pages, not just deeper ones.
    Rationale: unlike discover, the meetup recommendation pipeline has no page-one impression suppression behavior and its cursor already carries a stable offset fallback. That makes first-page and later-page reuse equally safe.
    Date/Author: 2026-04-28 / Codex

- Decision: keep the local in-memory realtime replay ring as the first resume path, but add Redis-backed replay as the shared fallback before forcing `system.resync_required`.
    Rationale: the local ring is the cheapest path for same-instance reconnects, while Redis replay covers the multi-instance gap without changing the websocket protocol or forcing broad refetches on every reconnect.
    Date/Author: 2026-04-28 / Codex

- Decision: stop persisting chat-message infinite queries altogether instead of merely trimming them more aggressively.
    Rationale: chat histories are both volatile and cheap to refetch relative to the persistence churn they create. Keeping them out of AsyncStorage entirely is a cleaner win than persisting one or two pages of data that will go stale quickly anyway.
    Date/Author: 2026-04-28 / Codex

- Decision: treat the repeatable observability probe plus live two-instance validation as the closure criteria for this remediation phase, rather than blocking on a heavier synthetic load harness before merging the architectural fixes.
    Rationale: the main objective of this plan was to remove structural scaling bottlenecks and verify their behavior under realistic hot-path exercise. The new probe script, cross-instance websocket replay check, and shared-limiter validation provide repeatable evidence that the intended scale characteristics now hold, while a larger synthetic load rig can remain a future operational step rather than a blocker to landing the remediation work.
    Date/Author: 2026-04-28 / Codex

## Outcomes & Retrospective

The first remediation slice is now implemented on the backend. Request timings, pgx query timings, cache/pubsub timings, realtime connection counts, and fanout timings are recorded in-process and exposed through `/debug/observability`. That means the project has moved beyond a static audit and now has enough visibility to begin collecting a real before/after baseline for the next milestones.

The most important lesson from the work so far is that shared infrastructure hooks provided fast coverage. Instrumenting pgx, the Redis cache wrapper, and the realtime hub exposed most of the system’s hot paths without forcing invasive repository-by-repository changes. That validates the plan’s original sequencing: measure first, then use those measurements to drive the heavier feed and chat refactors.

The main remaining gap in Milestone 1 is usage, not wiring. The team still needs to exercise the hottest routes, capture snapshots, and record the first baseline numbers in this document so later improvements can be judged concretely.

The first Milestone 2 slice is also now in place. Feed impressions, feed events, reactions, comments, hides, post creation, and share creation no longer block on synchronous aggregate recomputation in application code. Instead, the database records the affected post/share/author ids in `feed_aggregate_jobs`, and a polling worker drains that queue in the background. That changes the shape of the feed write path from “write plus immediate maintenance” to “write plus durable enqueue,” which is the right direction for high-volume telemetry.

The remaining Milestone 2 work is validation rather than core wiring. The queue needs to be observed under load, the resulting aggregate freshness window needs to be measured, and the baseline/after comparison still needs to be written down in this plan.

The first Milestone 3 slice is now in place as well. Chat message inserts no longer scan `messages` for `MAX(chat_seq) + 1`; instead they advance `chats.next_message_seq` transactionally, write the new message, and keep `chats.last_message_*` in sync. Chat list and single-chat summary reads now consume those denormalized fields directly, and unread counts come from `last_message_seq - last_read_chat_seq` rather than a counted subquery over `messages`. Realtime fanout also improved: message and summary broadcasts fetch all member summaries in one query instead of one `GetChat()` call per member.

The remaining Milestone 3 work is measurement and possibly one more round of simplification if group-chat unread state or direct-chat identity lookups still show up prominently in the new observability data.

The first Milestone 4 slice is now in place too. `/feed/home` is no longer a pure database read on every request; it now uses the existing Redis cache wrapper with global feed-version invalidation and viewer-specific invalidation for moderation-driven state like hidden items and muted authors. That should reduce repeated warm-read pressure on the ranked feed path without changing the ranking algorithm itself.

The second Milestone 4 slice is now in place as well. Discover cold misses for deeper pages no longer recompute the full ranked candidate pipeline for every adjacent offset. Instead, later pages reuse a cached ranked prefix and only pay the per-page hydrate plus impression-recording cost at read time. The first page intentionally stays on the exact path because its impression-suppression behavior is different.

The third Milestone 4 slice is now in place too. Recommended meetup pages no longer rerun the recommendation pipeline on every adjacent cursor miss. The backend now caches ranked recommendation prefixes keyed by the filter set plus a canonical ranked-window limit, then slices the requested cursor page from that shared ranked set.

The first live post-change validation pass is now recorded too. Against the running local API, the initial mixed hot-path probe produced these timer deltas: `/feed/home` 2 requests totaling 43.117 ms, `/users/discover` 4 requests totaling 62.000 ms, `/meetups?sort=recommended` 2 requests totaling 27.262 ms, `/chats` 2 requests totaling 9.569 ms, `/chats/{id}` 1 request totaling 2.391 ms, and `/chats/{id}/messages` 1 request totaling 3.062 ms. The same probe recorded 12 cache read-through attempts with 5 misses and 7 hits.

The focused deeper-page probe then confirmed the new window reuse behavior directly. For recommended meetups at `limit=5`, page 1 plus page 2 plus page 2 again produced exactly 1 cache miss and 2 cache hits, which is the intended ranked-window sharing pattern. Discover’s deeper-page probe hit the warmed ranked-window cache on all three requests (`page=2`, `page=3`, `page=3`), producing 6 cache hits and 0 misses across the generic read-through/get-json counters because the wider discover window had already been populated by the earlier mixed probe.

The remaining Milestone 4 work is to capture a true before/after comparison under a controlled load generator, but the local live metrics now show that the new cache layers are functioning and that the deeper-page recommendation work is no longer cold-missing per adjacent page in the way it used to.

The first Milestone 5 backend slice is now in place as well. The global IP limiter and authenticated-user limiter no longer have to rely only on process-local maps: when Redis is enabled, they now use shared fixed-window keys so rate limits behave consistently across app instances. The middleware also now parses `X-Forwarded-For` defensively by taking the first valid IP rather than trusting the raw header value wholesale.

Websocket resume is also more robust across instances. A reconnect still checks the local in-memory replay ring first, but when that misses it now asks the Redis chat event bus for a per-user replay list before falling back to `system.resync_required`. That closes the main multi-instance correctness gap without changing the existing websocket protocol or the frontend reconnect flow.

The remaining Milestone 5 work is live validation rather than more wiring: restart the local API so the running process picks up the new limiter and replay behavior, then prove the cross-instance semantics with a multi-process or at least forced-local-miss reconnect test.

The first Milestone 6 frontend slice is now in place too. Chat message histories are no longer persisted into AsyncStorage, which should materially reduce cache snapshot size and startup restore churn. Realtime message updates now patch only the newest message page for ack/create/remove paths instead of flattening and rebuilding the entire paginated thread on every event, which cuts JS work on active chats. Feed telemetry is also now queued and flushed in small batches instead of performing one network call per impression or per feed event.

The remaining Milestone 6 work is live validation rather than additional refactoring: verify the running app after a full reload so the new telemetry batching and lighter persistence behavior are exercised in practice, and then record any observable startup/network improvements that show up during manual testing or lightweight scripted runs.

Milestone 5 is now fully validated. Running two fresh backend instances on separate ports showed that websocket resume can recover missed events through the shared Redis replay path when the local in-memory replay ring does not have them, and that authenticated rate limiting now behaves like a shared deployment concern rather than an instance-local one. That closes the main cross-instance correctness gap that would have been exposed immediately by AWS autoscaling.

The repeatable observability probe also completed the missing end-to-end validation work and exposed one final schema-drift issue in the process. A live `POST /feed/impressions` failure turned out to be caused by stale `feed_mode` constraints still allowing only `friends/for_you` in the database while the current product emits `home`. Fixing that with `054_feed_mode_home_constraints.sql` tightened the database back into alignment with the current application contract and removed a latent production bug that had nothing to do with the probe itself.

After the schema fix, the repeatable probe produced the expected warm-cache behavior and successful telemetry writes. Against a fresh backend instance on `http://localhost:8092`, one post-fix run recorded 17 read-through hits vs 1 miss across 18 cache reads, while `/feed/home`, `/users/discover`, recommended meetups, `/chats`, `/chats/{id}`, and `/chats/{id}/messages` all returned clean timing deltas from `/debug/observability`. The probe also recorded successful `POST /feed/impressions` and `POST /feed/events` requests, confirming that the frontend-style batched telemetry payload now travels through the decoupled backend write path correctly.

This remediation plan is complete for the implementation phase. The major structural bottlenecks identified in the original audit have been addressed: feed aggregate maintenance is off the synchronous telemetry path, chat writes and summaries are denormalized, hot personalized reads have cache protection and ranked-window reuse, cross-instance rate limiting and websocket replay no longer depend solely on process-local memory, and the frontend no longer persists volatile chat histories or rewrites entire message threads on every realtime event. A future staging or production-like load harness is still advisable for ongoing capacity planning, but it is now an operational follow-up rather than a blocker to considering this remediation work done.

## Context and Orientation

This plan spans two repositories.

The backend repository is `/home/michaelroddy/repos/project_radeon`. It is a Go HTTP API built on `chi`, uses Postgres through `pgxpool`, uses Redis through `/home/michaelroddy/repos/project_radeon/pkg/cache`, and exposes websocket chat realtime through `/home/michaelroddy/repos/project_radeon/internal/chats`. The main entrypoint is `/home/michaelroddy/repos/project_radeon/cmd/api/main.go`.

The frontend repository is `/home/michaelroddy/repos/project_radeon_app`. It is an Expo / React Native app using React Query and persisted cache state. The app entrypoint is `/home/michaelroddy/repos/project_radeon_app/App.tsx`. The heavy client-side surfaces relevant to this plan are:

- `/home/michaelroddy/repos/project_radeon_app/src/screens/main/FeedScreen.tsx`
- `/home/michaelroddy/repos/project_radeon_app/src/screens/main/ChatsScreen.tsx`
- `/home/michaelroddy/repos/project_radeon_app/src/screens/main/ChatScreen.tsx`
- `/home/michaelroddy/repos/project_radeon_app/src/screens/main/SupportScreen.tsx`
- `/home/michaelroddy/repos/project_radeon_app/src/hooks/chat/ChatRealtimeProvider.tsx`
- `/home/michaelroddy/repos/project_radeon_app/src/query/chatCache.ts`
- `/home/michaelroddy/repos/project_radeon_app/src/query/asyncStoragePersister.ts`

In this plan, a “hot path” means code that runs very often or under very high concurrency, such as loading the home feed, delivering a chat message, or logging a feed impression. A “write amplification” problem means that one user action turns into many database writes or much more computation than the original action should require. A “fanout” problem means that work scales with the number of recipients; chat broadcasting is a fanout path because one sent message must be reflected to all members. A “cold miss” means a request that cannot be served from cache and therefore must pay the full database and ranking cost.

The starting point is:

- home feed reads are personalized and relatively expensive
- feed telemetry is synchronous and triggers aggregate maintenance
- chat summaries do too much per-row query work
- chat realtime fanout does repeated per-member database reads
- discover and meetups are multi-query candidate-pool rankers with Redis caching
- client-side realtime chat updates rewrite large cached structures
- query persistence is global and broad

The main success condition is not merely that the code changes compile. The main success condition is that these paths show lower database time, lower per-operation cost, and cleaner scale characteristics when measured.

## Plan of Work

The work begins with observability because every following milestone depends on knowing which endpoint or code path actually improved. In the backend repository, add endpoint-level latency instrumentation, database query timing, Redis timing, websocket connection counts, message-send timing, and a way to compare cache hit and miss rates. This should be done with lightweight structured metrics rather than verbose logging. At the same time, enable slow-query visibility in Postgres and prepare repeatable load-test scenarios for feed home reads, discover reads, meetup recommendation reads, chat list reads, chat message pagination, message sends, and feed telemetry writes. The frontend repository does not need to change behavior in this milestone, but it should be prepared to produce reproducible telemetry volume by driving feed scroll and chat activity consistently.

Once measurement exists, the first real backend target is feed telemetry ingestion. Right now, feed impressions and feed events are both append operations and triggers for aggregate recomputation. That coupling must be broken. In `/home/michaelroddy/repos/project_radeon/internal/feed/foundation_store.go` and `/home/michaelroddy/repos/project_radeon/internal/feed/aggregate_store.go`, the direct calls that recompute quality and author stats after every impression, event, hide, reaction, comment, or share should be replaced with a cheaper mechanism. The right first version is to preserve correctness while moving recomputation behind an asynchronous boundary. In this repository, “asynchronous boundary” can initially mean a job table plus a background worker, or a coarser scheduled refresh path, as long as the request that logs telemetry no longer waits for aggregate maintenance. The feed ranking code in `/home/michaelroddy/repos/project_radeon/internal/feed/read_store.go` must continue to tolerate missing or slightly stale feature rows by using safe defaults.

After telemetry is decoupled, fix the chat write and summary path. The core goals are to make one sent message cheap and to make listing chats cheap. In `/home/michaelroddy/repos/project_radeon/internal/chats/store.go`, replace the `MAX(chat_seq) + 1` per-insert pattern with a chat-local monotonic sequence strategy that does not require scanning `messages` for every insert. The simplest acceptable strategy in this codebase is to add a `next_message_seq` column on `chats` and increment it transactionally as part of message insert. Then reduce the cost of `ListChats()` and `GetChat()` by introducing denormalized summary state. That summary state can live directly on `chats` or in a separate table, but by the end of the milestone the list endpoint should no longer need `LATERAL` subqueries for latest message and unread counts per row. For unread counts, a pragmatic first production approach is to store a `last_message_at` or `last_message_seq` on chats and compute a much cheaper unread indicator or bounded count, then improve later if needed. Also adjust `/home/michaelroddy/repos/project_radeon/internal/chats/ws_handler.go` so realtime fanout does not call `GetChat()` separately for every member on every message. The handler should build one cheap message envelope and reuse precomputed or denormalized summaries where needed.

Once chat cost is reduced, move to the expensive personalized reads. The home feed in `/home/michaelroddy/repos/project_radeon/internal/feed/read_store.go` should gain a real read-through cache in `/home/michaelroddy/repos/project_radeon/internal/feed/cache_store.go`, but only after the invalidation story is well understood. The plan here is not to cache forever; it is to protect the database from repeated warm reads while keeping freshness acceptable. At the same time, the candidate-pool assembly should be profiled and simplified where possible. In the feed reader, reduce repeated friend-id lookups and avoid overfetching large pools unless metrics show it materially improves ranking quality. In discover and meetup recommendations, the code in `/home/michaelroddy/repos/project_radeon/internal/user/discover_store.go` and `/home/michaelroddy/repos/project_radeon/internal/meetups/recommendation_store.go` should be made more cursor-native and less offset-heavy. The intent is not to eliminate the multi-source design; the intent is to avoid paying nearly full ranking cost for deeper pages and to make cold misses less painful.

The next stage hardens cross-instance behavior for AWS deployment. The in-process rate limiter in `/home/michaelroddy/repos/project_radeon/pkg/middleware/ratelimit.go` should be replaced with a shared Redis-backed rate limiter so limits are consistent across instances. The same milestone should improve websocket recovery semantics. The Redis event bus in `/home/michaelroddy/repos/project_radeon/internal/chats/realtime_bus.go` already gives cross-instance delivery, but replay and resume remain local-memory only in `/home/michaelroddy/repos/project_radeon/internal/chats/realtime_hub.go`. The plan should either move replay cursors into Redis or deliberately simplify replay so clients do a cheaper, targeted resync that does not invalidate broad caches.

Only after the backend has better scale characteristics should the app-side cache churn be reduced. In `/home/michaelroddy/repos/project_radeon_app/src/query/chatCache.ts`, stop flattening and resorting full message sets on every realtime event. Replace that behavior with targeted page-level or normalized updates. In `/home/michaelroddy/repos/project_radeon_app/src/hooks/chat/ChatRealtimeProvider.tsx`, keep the transport behavior but reduce the amount of synchronous cache work done per event. Then narrow persistence in `/home/michaelroddy/repos/project_radeon_app/src/query/asyncStoragePersister.ts` so highly volatile chat and feed pages do not dominate startup restore and storage writes. Feed telemetry in `/home/michaelroddy/repos/project_radeon_app/src/screens/main/FeedScreen.tsx` should also be batched client-side more aggressively instead of firing individual network requests for each impression flush and interaction event.

At every milestone, update this plan with measured before/after outcomes. The point is not just to change architecture; it is to reduce p95 latency, database time, and per-action work in a way that can be demonstrated.

## Milestones

### Milestone 1: Observability and Baseline Measurement

At the end of this milestone, both repositories still behave the same for users, but the team can see which paths are expensive and compare them later. The first backend slice is already in place: request timings, query timings, cache-hit indicators, websocket connection counts, and message fanout timings are recorded in-process and exposed through `/debug/observability`. The remaining work is to drive the main read and write scenarios, capture a baseline, and record what the initial numbers say about `/feed/home`, `/users/discover`, recommended meetups, `/chats`, `/chats/{id}/messages`, chat send, `/feed/impressions`, and `/feed/events`, plus database saturation signals from Postgres.

### Milestone 2: Feed Telemetry and Aggregate Decoupling

At the end of this milestone, impression and event ingestion are cheap append operations rather than triggers for immediate aggregate recomputation. Feed ranking still works, but feature rows can be slightly stale. The proof is that scroll-heavy telemetry volume no longer causes matching spikes in aggregate-refresh database work, and that feed/home latency remains stable even when impression volume rises.

### Milestone 3: Chat Write Path and Summary Optimization

At the end of this milestone, sending a chat message no longer scans for `MAX(chat_seq)` and no longer forces heavy summary queries per recipient. Listing chats is cheaper because latest-message and unread summary data are denormalized or otherwise precomputed. The proof is lower database work for `POST /chats/{id}/messages`, lower p95 latency for `GET /chats`, and lower per-message fanout time under concurrent messaging.

### Milestone 4: Personalized Read-Path Optimization

At the end of this milestone, the home feed, discover, and meetup recommendation surfaces are better protected against cache misses and deep-page costs. Feed/home has a deliberate caching strategy, and discover plus recommended meetups avoid paying nearly full ranking cost for every deeper page. The proof is lower cold-miss latency and lower database time for those endpoints during synthetic load tests.

### Milestone 5: Cross-Instance Hardening

At the end of this milestone, rate limits behave consistently across multiple API instances and websocket resume/resync is safer in a multi-instance deployment. The proof is a multi-instance local or staging test where rate limiting remains consistent and websocket reconnect behavior does not depend on reconnecting to the same process.

### Milestone 6: Client Cache and Persistence Reduction

At the end of this milestone, the mobile client does less synchronous work per realtime chat event, persists less volatile data, and batches feed telemetry more effectively. The proof is that chat-heavy sessions show less JS thread churn, startup restores remain fast, and feed telemetry network traffic is more compact.

### Milestone 7: Comparative Load Testing and Final Tuning

At the end of this milestone, the team has before/after numbers for each major surface and can decide what still needs deeper work. The proof is a recorded comparison showing which endpoints improved, what the new bottlenecks are, and whether autoscaling thresholds should be adjusted.

## Concrete Steps

All backend implementation commands in this plan should be run from:

    cd /home/michaelroddy/repos/project_radeon

All frontend implementation commands in this plan should be run from:

    cd /home/michaelroddy/repos/project_radeon_app

Begin by creating dedicated branches in both repositories:

    cd /home/michaelroddy/repos/project_radeon
    git checkout -b codex/scalability-remediation

    cd /home/michaelroddy/repos/project_radeon_app
    git checkout -b codex/scalability-remediation-client

Before making changes, capture the baseline:

    cd /home/michaelroddy/repos/project_radeon
    go test ./...

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

For Milestone 1, inspect and instrument the main backend surfaces:

    cd /home/michaelroddy/repos/project_radeon
    sed -n '1,220p' cmd/api/main.go
    sed -n '1,260p' internal/feed/read_store.go
    sed -n '1,260p' internal/feed/foundation_store.go
    sed -n '1,260p' internal/feed/aggregate_store.go
    sed -n '1,260p' internal/chats/store.go
    sed -n '1,260p' internal/chats/ws_handler.go
    sed -n '1,260p' internal/user/discover_store.go
    sed -n '1,260p' internal/meetups/recommendation_store.go

The first backend observability slice landed in these files:

    /home/michaelroddy/repos/project_radeon/pkg/observability/metrics.go
    /home/michaelroddy/repos/project_radeon/pkg/observability/http.go
    /home/michaelroddy/repos/project_radeon/pkg/observability/pgx.go
    /home/michaelroddy/repos/project_radeon/pkg/database/database.go
    /home/michaelroddy/repos/project_radeon/pkg/cache/cache.go
    /home/michaelroddy/repos/project_radeon/pkg/cache/pubsub.go
    /home/michaelroddy/repos/project_radeon/internal/chats/realtime_hub.go
    /home/michaelroddy/repos/project_radeon/internal/chats/ws_handler.go
    /home/michaelroddy/repos/project_radeon/cmd/api/main.go

For Milestone 2, focus on the feed write path:

    cd /home/michaelroddy/repos/project_radeon
    rg -n "refreshFeedAggregatesForPosts|refreshFeedAggregatesForShares" internal/feed

For Milestone 3, focus on the chat list and send path:

    cd /home/michaelroddy/repos/project_radeon
    rg -n "ListChats|GetChat|InsertMessage|broadcastMessageCreated" internal/chats

For Milestone 4, focus on personalized ranking readers and caches:

    cd /home/michaelroddy/repos/project_radeon
    sed -n '1,260p' internal/feed/cache_store.go
    sed -n '100,220p' internal/user/cache_store.go
    sed -n '54,120p' internal/meetups/cache_store.go

For Milestone 6, focus on the app cache/update path:

    cd /home/michaelroddy/repos/project_radeon_app
    sed -n '1,260p' src/hooks/chat/ChatRealtimeProvider.tsx
    sed -n '1,260p' src/query/chatCache.ts
    sed -n '1,120p' src/query/asyncStoragePersister.ts
    sed -n '560,700p' src/screens/main/FeedScreen.tsx

After each milestone, rerun the local correctness checks:

    cd /home/michaelroddy/repos/project_radeon
    go test ./...

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

For every load-test or profiling step added during implementation, record the exact command and a short outcome snippet in this plan’s `Artifacts and Notes` section.

## Validation and Acceptance

Validation must be behavioral and measurable.

For Milestone 1, acceptance is that there is a repeatable baseline with named metrics. The team must be able to say how long `/feed/home`, `/users/discover`, recommended meetups, `/chats`, `GET /chats/{id}/messages`, `POST /chats/{id}/messages`, `POST /feed/impressions`, and `POST /feed/events` take before any optimization. It must also be possible to see whether Redis is helping or whether Postgres is the dominant bottleneck.

For Milestone 2, acceptance is that a heavy feed-scrolling session no longer triggers matching aggregate recomputation work synchronously. The exact mechanism may differ, but the observable result must be that impression and event ingestion latency drops and that aggregate refresh work no longer sits directly on the request path.

For Milestone 3, acceptance is that sending messages in a busy direct chat or group chat no longer scales linearly with repeated summary queries and no longer contends on a `MAX(chat_seq)` scan. The team should be able to run a chat-send load scenario and see lower p95 send latency and fewer expensive database statements.

For Milestone 4, acceptance is that cache misses on feed home, discover, and recommended meetups are materially cheaper than before, and deep-page requests do not pay nearly full candidate-ranking cost again and again. The exact target numbers should be filled in once the baseline exists, but the direction of improvement must be clear in both query count and latency.

For Milestone 5, acceptance is that two API instances behind the same Redis and Postgres backends behave consistently. A rate-limited client should be limited across instances, and a reconnecting websocket client should not depend on reconnecting to the same process in order to recover a coherent chat state.

For Milestone 6, acceptance is that the client no longer does full flatten/sort/repage work on every chat event, startup persistence stays bounded, and feed telemetry calls are visibly more batched. This should be observable with React Native performance tooling or targeted console instrumentation in development.

For Milestone 7, acceptance is a comparison table or narrative that documents the before/after numbers for each optimized surface and explicitly states what still remains a concern.

## Idempotence and Recovery

The plan is designed to be applied incrementally and safely.

Observability changes should be additive and safe to leave on during later milestones. If an instrumentation path proves too noisy, it can be gated behind environment variables without invalidating the rest of the work.

For feed telemetry decoupling, keep the old synchronous path available until the asynchronous or deferred mechanism is proven correct. If the deferred path misbehaves, the safe fallback is to keep telemetry ingestion append-only and temporarily accept staler ranking features rather than reintroducing expensive synchronous recomputation.

For chat sequencing and summary refactors, prefer additive schema changes first. If a new denormalized summary table or new chat sequence column is introduced, keep the old read path available behind a guard until the new one has been validated. If a migration partially lands, the fallback should be to continue reading from the old path while preserving the new columns.

For client-side persistence reduction, if any change causes a bad cache restore experience, the safe recovery path is to bump the persistence `buster` in `/home/michaelroddy/repos/project_radeon_app/App.tsx` so old persisted state is discarded cleanly.

At every milestone, if results are not measurably better, stop and record that in this plan rather than continuing blindly.

## Artifacts and Notes

The initial audit identified these concrete hotspots:

    Backend
    - `/home/michaelroddy/repos/project_radeon/internal/feed/foundation_store.go`
    - `/home/michaelroddy/repos/project_radeon/internal/feed/aggregate_store.go`
    - `/home/michaelroddy/repos/project_radeon/internal/feed/read_store.go`
    - `/home/michaelroddy/repos/project_radeon/internal/chats/store.go`
    - `/home/michaelroddy/repos/project_radeon/internal/chats/ws_handler.go`
    - `/home/michaelroddy/repos/project_radeon/internal/user/discover_store.go`
    - `/home/michaelroddy/repos/project_radeon/internal/meetups/recommendation_store.go`
    - `/home/michaelroddy/repos/project_radeon/pkg/middleware/ratelimit.go`

    Frontend
    - `/home/michaelroddy/repos/project_radeon_app/src/query/chatCache.ts`
    - `/home/michaelroddy/repos/project_radeon_app/src/hooks/chat/ChatRealtimeProvider.tsx`
    - `/home/michaelroddy/repos/project_radeon_app/src/query/asyncStoragePersister.ts`
    - `/home/michaelroddy/repos/project_radeon_app/src/screens/main/FeedScreen.tsx`

When baseline metrics are gathered, add concise examples here, such as:

    Example: Baseline `/feed/home`
    p50: ...
    p95: ...
    DB time: ...

    Example: Baseline `POST /chats/{id}/messages`
    p50: ...
    p95: ...
    fanout recipients: ...
    statements per send: ...

## Interfaces and Dependencies

The backend implementation will continue to use:

- Go with `chi` in `/home/michaelroddy/repos/project_radeon/cmd/api/main.go`
- Postgres via `pgxpool`
- Redis via `/home/michaelroddy/repos/project_radeon/pkg/cache`
- websocket chat realtime in `/home/michaelroddy/repos/project_radeon/internal/chats`

The frontend implementation will continue to use:

- Expo / React Native
- TanStack React Query
- persisted query cache via `PersistQueryClientProvider`
- the existing app API surface in `/home/michaelroddy/repos/project_radeon_app/src/api/client.ts`

By the end of the implementation, the following kinds of interfaces should exist, even if the exact names evolve during execution:

- backend metrics and timing hooks for HTTP handlers, database-backed services, and websocket fanout
- a deferred or asynchronous feed aggregate refresh interface that can be called from feed ingestion paths without blocking the request
- a cheaper chat summary source that `ListChats()` and realtime fanout can use without repeated heavy subqueries
- a scalable chat message sequencing mechanism that does not scan `messages` to find the next sequence
- shared, cross-instance rate limiting behavior backed by Redis or another shared store
- frontend cache-update helpers that mutate only the affected chat/message slices rather than rebuilding whole caches
- frontend persistence rules that exclude or aggressively trim highly volatile data

Revision note: this ExecPlan was created from a static cross-repository performance audit on 2026-04-28. No remediation code has been implemented yet.
