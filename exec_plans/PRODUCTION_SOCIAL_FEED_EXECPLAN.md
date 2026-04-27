# Production-Grade Social Feed Replacement

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`. The backend repository at `/home/michaelroddy/repos/project_radeon` also contains a `PLANS.md` file with the same operating standard, and implementation work in that repository should follow the same rules.

## Purpose / Big Picture

The app now has the technical beginnings of a modern feed system, but the current `Friends` and `For You` split is not the right final product shape. It adds mode-switch complexity, complicates optimistic state, and nudges the experience toward a Facebook-style graph timeline when this product needs one alive, relevant, community-first home feed. The final target is one ranked home feed that blends friend content, community content, reshares, and discovery in a single stream. Friendships remain important, but they are treated as strong ranking and explanation signals rather than a separate user-facing timeline.

After this revision, a user should be able to open the app and see one coherent feed that feels socially familiar, personally relevant, and consistently fresh. A friend’s post should still matter more than a random low-signal community post, but the user should never need to choose between “friend content” and “community content.” The proof will be visible in a local end-to-end run: create posts from multiple accounts, establish friendships, reshare a post, interact with several authors, then refresh the app and observe that the feed remains full, relevant, diversified, and stable with no segmented `Friends` / `For You` decision.

This revised plan treats the current split-feed implementation as migration scaffolding, not as wasted work. The ranking, reshare, hide, mute, impression, and aggregate infrastructure should be preserved. The execution task is now to collapse the product surface to one ranked home feed while keeping those backend and app primitives intact.

## Progress

- [x] (2026-04-27 12:25Z) Audited the current Expo feed implementation in `src/screens/main/FeedScreen.tsx`, `src/hooks/queries/useFeed.ts`, `src/hooks/queries/useCreatePostMutation.ts`, `src/query/queryKeys.ts`, and `src/api/client.ts`.
- [x] (2026-04-27 12:31Z) Audited the current Go feed backend in `/home/michaelroddy/repos/project_radeon/internal/feed/store.go`, `/home/michaelroddy/repos/project_radeon/internal/feed/handler.go`, `/home/michaelroddy/repos/project_radeon/internal/feed/cache_store.go`, and the relevant schema migrations for posts and post images.
- [x] (2026-04-27 12:36Z) Audited existing social graph and recommendation primitives in `/home/michaelroddy/repos/project_radeon/internal/friends`, `/home/michaelroddy/repos/project_radeon/internal/user/discover_store.go`, and `/home/michaelroddy/repos/project_radeon/internal/meetups/recommendation_*` to reuse proven ranking patterns.
- [x] (2026-04-27 12:49Z) Authored the original cross-repository ExecPlan for a `Friends` and `For You` feed replacement with ranked discovery, impression logging, aggregate feed features, and app-native post sharing.
- [x] (2026-04-27 13:07Z) Created implementation branches `codex/production-social-feed` in `/home/michaelroddy/repos/project_radeon` and `codex/social-feed-client` in `/home/michaelroddy/repos/project_radeon_app`.
- [x] (2026-04-27 13:19Z) Added backend feed foundation: migration `039_social_feed_foundation.sql`, feed foundation types, store methods for post sharing, hides, mutes, impressions, and feed events, plus cache wrapper updates and tests.
- [x] (2026-04-27 13:28Z) Added backend HTTP contracts for feed actions including sharing, hiding, muting, impressions, and feed events.
- [x] (2026-04-27 13:36Z) Added frontend feed-item and telemetry scaffolding in `/home/michaelroddy/repos/project_radeon_app`, including API contracts and React Query keys/hooks.
- [x] (2026-04-27 14:03Z) Added backend read endpoints `GET /feed/friends` and `GET /feed/for-you`, backed by shared feed-item hydration for posts and reshares plus a first-pass heuristic ranker.
- [x] (2026-04-27 14:11Z) Replaced the Expo feed screen query path with segmented `Friends` and `For You` queries, including basic reshare rendering and direct reshare action support.
- [x] (2026-04-27 14:19Z) Added initial feed controls in the app: impression logging, hide item, mute author, and per-card action menus.
- [x] (2026-04-27 17:04Z) Added backend aggregate support in `/home/michaelroddy/repos/project_radeon`: migration `040_social_feed_engagement.sql`, share-native reactions and comments, share-quality features, total and recent post-quality counters, and aggregate refresh paths on feed mutations and impressions. Feed reads now use denormalized feature joins instead of per-row live count subqueries.
- [x] (2026-04-27 17:26Z) Completed richer reshare behavior and stronger ranking: generic feed-item reaction/comment endpoints, reshare threads with their own like/comment counts, stronger ranking signals, and rollout switches for `For You` and reshares.
- [x] (2026-04-27 17:43Z) Completed app-side production UX: comments modal supports post and reshare threads, reshares use their own like/comment/share actions, quote-share composer UI is live, and dwell-time impressions plus feed events are logged from real visibility and interaction state.
- [x] (2026-04-27 18:34Z) Revised the target product direction from a split `Friends` / `For You` feed into one unified ranked home feed. No implementation code has been executed as part of this plan revision.

## Surprises & Discoveries

- Observation: The original feed was a global reverse-chron timeline rather than a personalized social home feed.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/feed/store.go` implemented `ListFeed()` as a global `ORDER BY p.created_at DESC`, and the app fetched it directly from `/feed?before=...`.

- Observation: The repository already had a good recommendation pattern worth copying for feed ranking.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/meetups/recommendation_ranker.go` and related types already implement candidate pooling, weighted scoring, diversification, and versioned opaque cursors.

- Observation: The social graph is friendship-based, not follower-based.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/friends/store.go` and related user store paths expose accepted friendship state and friend counts. There is no asymmetric follow model in this repository.

- Observation: Share-specific engagement semantics needed real backend support rather than UI redirection.
    Evidence: The current implementation added `share_reactions`, `share_comments`, generic feed-item comment/reaction endpoints, and a generalized `CommentsModal` because routing reshares into original-post comments was not sufficient.

- Observation: Real dwell-time impression tracking fit the current FlatList architecture, but it needed active visibility state and flush-on-hide behavior rather than a one-shot callback.
    Evidence: `FeedScreen.tsx` now tracks active impressions keyed by feed context and item id, records interaction flags while visible, and flushes `view_ms` when items leave the viewport or the screen deactivates.

- Observation: The `Friends` / `For You` split is technically workable, but it introduces product and state complexity that the final app does not need.
    Evidence: The feed now requires segmented UI, tab-specific optimistic behavior, separate query paths, and tab-aware impression keys. Recent post-create behavior exposed that the product expectation is one coherent feed, not two competing surfaces.

## Decision Log

- Decision: Use app-native post sharing as internal resharing or quote-sharing, not only the operating-system share sheet.
    Rationale: Internal resharing is socially meaningful feed behavior. It affects ranking, social proof, and in-app conversation in a way an external share sheet does not.
    Date/Author: 2026-04-27 / Codex

- Decision: Start with a deterministic heuristic ranker and only later graduate to learned ranking.
    Rationale: The app now has the right telemetry and feature surfaces to support a strong heuristic system. A machine-learned ranker would be premature until enough stable interaction history exists.
    Date/Author: 2026-04-27 / Codex

- Decision: Keep author timelines such as `/users/:id/posts` as mostly reverse-chronological profile views rather than forcing ranked serving everywhere.
    Rationale: A user profile timeline is an authored archive. Ranking belongs to the home feed.
    Date/Author: 2026-04-27 / Codex

- Decision: Treat hide, mute, reshares, impressions, and feedback logging as first-class v1 feed features.
    Rationale: A production-grade feed is not complete if users can only consume and like content. They need control surfaces and the system needs negative signals.
    Date/Author: 2026-04-27 / Codex

- Decision: The final product should use one ranked home feed, not separate `Friends` and `For You` surfaces.
    Rationale: This app is community-first, not graph-first. A unified home feed better supports relevance, discovery, post volume, and newcomer experience while still letting friendships shape ranking strongly.
    Date/Author: 2026-04-27 / Codex

- Decision: Preserve the current split-feed implementation only as migration scaffolding.
    Rationale: The current work already contains useful ranking, aggregate, reshare, hide, mute, and impression infrastructure. Reusing it is lower risk than discarding it before the unified home feed is live.
    Date/Author: 2026-04-27 / Codex

## Outcomes & Retrospective

The earlier implementation work was not wasted. It established the right backend and app primitives for a serious feed system: ranked candidate serving, reshares, share-native engagement, hide and mute controls, denormalized features, dwell-time impressions, and query-level feed isolation. The main change is product shape, not technical direction.

The biggest takeaway is that the app already has enough infrastructure for a strong ranked home feed, but it should not keep the split user experience. The next execution slice is therefore a convergence task: unify the read path, simplify the app surface, and keep the ranking system socially grounded by boosting friendship signals inside one home feed.

## Context and Orientation

There are two repositories involved in this plan.

The frontend repository is `/home/michaelroddy/repos/project_radeon_app`. The feed tab is rendered in `src/screens/main/FeedScreen.tsx`. The React Query hooks for feed pages are in `src/hooks/queries/useFeed.ts`, which call feed functions in `src/api/client.ts`. Feed query keys live in `src/query/queryKeys.ts`. The current screen already supports optimistic post creation, local image upload, pagination, share-specific comments, reshares, hides, mutes, and impression logging.

The backend repository is `/home/michaelroddy/repos/project_radeon`. Feed routes and types live in `internal/feed/handler.go`. The Postgres implementation lives across `internal/feed/*.go`, including ranking, aggregates, engagement, and serving support. Cached wrappers live in `internal/feed/cache_store.go`. Friendships are stored in `internal/friends/store.go`. Recommendation patterns already exist in the meetup system under `internal/meetups/recommendation_*`.

In this document, a “candidate” means a post that is eligible to appear in the home feed but has not been ranked yet. A “ranker” means the logic that turns a pool of candidates into an ordered page. A “feed impression” means that the app actually displayed an item to a viewer in a specific position. A “reshare” means a user republishes someone else’s post into their own feed, optionally with commentary.

## Plan of Work

The revised work starts from the current implementation rather than from zero. The backend already has timeline storage, aggregate features, reshares, negative-feedback controls, and separate ranked-serving paths. The next task is to converge those read paths into one explicit home-feed contract.

The final feed should be defined as one ranked home stream. It should draw candidates from multiple bounded sources rather than querying the full posts table directly. The initial source set should be: recent friend posts, recent friend reshares, strong-affinity authors based on prior likes and comments, mutual-friend authors, interest-matched posts based on profile interests and inferred post topics, city-local posts if location is available, trending community posts, and a small exploration bucket that introduces new authors. These candidate pools should be over-fetched independently and then merged. Friend content should get a meaningful boost and stronger freshness protection, but not a hard eligibility boundary.

The current `Friends` and `For You` logic should be reinterpreted as source families, not user-facing products. What is now “Friends” becomes one socially grounded candidate bucket. What is now “For You” becomes a broader ranking bucket that already contains discovery signals. The unified home-feed ranker should combine these sources, normalize them, score them with existing quality and affinity features, then apply a diversification pass so the final page does not over-serve one author, one topic, one reshare chain, or one content shape.

The serving contract should converge to one explicit endpoint. Keep `GET /feed/friends` and `GET /feed/for-you` working temporarily for migration safety, but add `GET /feed/home` and make that the final read path. The envelope should remain the existing feed-item shape so the app can still distinguish original posts from reshares. A reshare item should continue to include both the resharing author and the embedded original post author. The cursor must remain opaque and versioned, similar to the meetup recommendation cursor.

The app should migrate back down to one feed query layer. In `src/api/client.ts`, add `getHomeFeed()` while preserving the existing feed action endpoints for sharing, hiding, muting, and impression logging. In React Query, add a dedicated `homeFeed()` key. In `FeedScreen.tsx`, remove the segmented control once the unified feed is live. Preserve the current composer, optimistic create-post flow, comments opening, reactions, shares, hides, mutes, and impression logging, but simplify local feed state back to one surface.

Telemetry and feedback controls remain first-class. The app should continue logging impressions when an item is stably visible and continue logging likes, comment opens, comment submits, share opens, share confirms, hides, and mutes as feed events with position metadata. Feed mode should become a deprecated field during migration and eventually collapse to one home-feed value.

Rollout should now happen in two layers. First, preserve the existing split implementation as a safe baseline. Second, add the unified `home` feed path, switch the app to it, and only then retire the `Friends` / `For You` user-facing surfaces. This keeps the infrastructure gains while simplifying the product.

## Milestones

### Milestone 1: Feed-foundation primitives

At the end of this milestone, the backend still serves the existing feed, but the repository has the additive schema and core package structure required for a production feed. New tables for post shares, feed impressions, feed events, hidden posts, muted authors, and denormalized feed statistics exist. This milestone is complete.

### Milestone 2: Split-feed implementation baseline

At the end of this milestone, the repository has the now-existing `Friends` and `For You` implementation that serves as the transition baseline. Ranked serving, reshares, share-native engagement, hide and mute controls, denormalized feature reads, and dwell-time impressions are already live. This milestone is complete and should be treated as scaffolding rather than the final UX.

### Milestone 3: Unified home-feed serving and app migration

At the end of this milestone, the backend exposes `GET /feed/home` backed by one ranked pipeline, and the app consumes that one feed with no segmented `Friends` / `For You` toggle. The unified feed still uses the existing ranking signals, reshare rendering, hide and mute controls, and dwell-time logging, but it no longer asks the user to choose between two feed modes. The proof is that a viewer can create a post, refresh, and continue scrolling one coherent feed where friend content is visible but community content remains eligible and relevant.

### Milestone 4: Production hardening and split-surface retirement

At the end of this milestone, the unified home feed is the only user-facing feed surface. Impression logging, negative feedback, denormalized aggregate reads, rollout controls, and performance protections remain intact. The old split endpoints can either be retired or left temporarily as non-default fallback paths, but the segmented feed UI is gone. The proof is that logs and metrics capture visible home-feed events, hide and mute immediately alter subsequent pages, and feed latency remains acceptable under local load tests.

## Concrete Steps

The commands below are the exact commands that should be used during implementation. This plan spans both repositories.

In the backend repository:

    cd /home/michaelroddy/repos/project_radeon
    git checkout -b codex/unified-home-feed

Inspect the current feed package before editing:

    rg -n "ListFriendsFeed|ListForYouFeed|ListFeed|FeedMode|FeedItem" internal/feed

Inspect the current app-facing feed routes before editing:

    rg -n "/feed/friends|/feed/for-you|/feed" internal/feed cmd/api

Run the backend test suite before any changes:

    go test ./...

Implement the unified read path and rerun:

    go test ./...

Expected outcome at major milestones:

    ok   github.com/project_radeon/api/internal/feed       ...
    ok   github.com/project_radeon/api/internal/friends    ...
    ok   github.com/project_radeon/api/internal/meetups    ...
    ok   github.com/project_radeon/api/pkg/...             ...

Start the backend locally:

    go run ./cmd/api

In the frontend repository:

    cd /home/michaelroddy/repos/project_radeon_app
    git checkout -b codex/unified-home-feed-client

Run the typecheck before edits:

    npx tsc --noEmit

As the home-feed query and screen changes land, rerun:

    npx tsc --noEmit

Start the app:

    npx expo start

During validation, use multiple seeded users and create posts, likes, comments, and reshares from different accounts. Keep at least one user with no friends, one with several friends, and one highly active account to validate that the unified home feed remains alive for low-graph users while still giving clear weight to friendship signals.

## Validation and Acceptance

Acceptance is behavioral, not structural.

First validate the backend primitives. A new post can still be created exactly as before. A new reshare can still be created and stored durably without mutating the original post. Hidden-post and muted-author records suppress content for the acting user only. Feed impressions and feed events still write successfully and can be queried in tests. Denormalized aggregate jobs or update paths populate post-level quality and engagement rows without corrupting existing post reads.

Then validate the unified home feed. Create or seed at least three users, with two accepted friendships and one unrelated user. Have a friend create a post, have the unrelated user create a post, then interact with some authors and interests. Refresh the feed. Friend posts must receive meaningful visibility and freshness protection, but relevant non-friend posts must still appear. The page should not feel like a pure friend-only timeline or a pure discovery slot machine. A very high-volume friend should not dominate the first page with near-identical items, and a user with few friends should still see a healthy stream.

Then validate reshares. From one account, reshare another user’s post with and without commentary. Open the unified feed from multiple accounts. The feed must render the reshare as a separate item, identify the resharing user, preserve the original author attribution, and allow comments on the share item according to the chosen product rule. Reactions and comments on a reshare belong to the share item, while the embedded original remains read-only in that context.

Then validate hide and mute behavior. Hide a post and confirm it stops appearing in future home-feed pages for that user. Mute an author and confirm their original posts and reshares no longer appear for that user. This must not affect other users. A hidden or muted item should not reappear after app restart or pull-to-refresh.

Then validate impression logging. Scroll a feed page slowly enough for multiple items to become genuinely visible. Confirm that the app emits impression events only for visible items and includes home-feed position metadata. A short test transcript or assertion should demonstrate that fetched-but-never-visible items are not logged as viewed.

Performance acceptance should be measured as well. Feed serving must not perform per-row count subqueries for every visible page in its final form. The app should remain smooth while scrolling the first page and fetching the next page. The backend should be able to serve a warm home-feed page in a few hundred milliseconds locally, and the app should not flicker or hard-reload the feed list during refresh or after optimistic post creation.

## Idempotence and Recovery

This migration should be implemented additively. Do not delete the existing `/feed`, `/feed/friends`, or `/feed/for-you` paths until `GET /feed/home` is validated. New migrations and endpoint changes must be backward-compatible first. The old feed and the split feed can coexist with the new home feed while the app is migrated behind a feature flag.

If ranking logic fails during development, the fallback should be to return a simpler recency-first candidate ordering rather than break feed reads entirely. If denormalized feature updates fall behind, the serving path should tolerate missing feature rows and assign safe defaults.

If any milestone becomes unstable, the safe recovery path is to keep author profile posts plus the existing split-feed implementation active while the unified home feed is validated independently. That allows rollback without removing the new schema or losing user content.

## Interfaces and Dependencies

In `/home/michaelroddy/repos/project_radeon/internal/feed`, the final serving contract should center on one mode:

    type FeedMode string

    const (
        FeedModeHome FeedMode = "home"
    )

The existing `FeedItem`, `FeedActor`, `EmbeddedPost`, `ViewerFeedState`, and related share metadata types should remain, because the unified feed still needs to distinguish posts from reshares and still needs viewer-specific state.

The backend feed service should expose an explicit unified read method rather than a split user-facing contract:

    ListHomeFeed(ctx context.Context, viewerID uuid.UUID, cursor string, limit int) (*CursorPage[FeedItem], error)
    SharePost(ctx context.Context, viewerID, postID uuid.UUID, commentary string) (uuid.UUID, error)
    HideFeedItem(ctx context.Context, viewerID, itemID uuid.UUID, kind FeedItemKind) error
    MuteFeedAuthor(ctx context.Context, viewerID, authorID uuid.UUID) error
    LogFeedImpressions(ctx context.Context, viewerID uuid.UUID, impressions []FeedImpressionInput) error

In the app repository, expose an explicit home-feed client function in `src/api/client.ts`:

    getHomeFeed(cursor?: string, limit?: number): Promise<CursorResponse<FeedItem>>
    sharePost(input: { postId: string; commentary?: string }): Promise<{ id: string }>
    hideFeedItem(input: { itemId: string; kind: FeedItemKind }): Promise<void>
    muteFeedAuthor(authorId: string): Promise<void>
    logFeedImpressions(input: FeedImpressionInput[]): Promise<void>

Add a dedicated query key in `src/query/queryKeys.ts` for:

    homeFeed(limit?: number)

Keep profile timelines on `userPosts()` and do not mix them with home-feed query keys.

The app screen should render one primary feed in `src/screens/main/FeedScreen.tsx` with no user-facing segmented control. The screen must still render both original posts and reshares. Reshare cards must continue to show the resharing actor clearly and must not flatten away original authorship.

## Revision Notes

Revision note: This plan originally targeted separate `Friends` and `For You` feed surfaces. That split is now treated as transitional scaffolding only.

Revision note: The final product direction is one unified ranked home feed. Friendship remains a core ranking and explanation signal, but not a separate top-level feed surface.

Revision note: No implementation code was executed as part of this latest plan revision. The next step, if approved, is to execute Milestone 3 and Milestone 4 against the already-built feed subsystem.
