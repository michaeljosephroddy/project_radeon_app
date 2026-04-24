# Roll Out Client-Side Query Caching With Persistence

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with [PLANS.md](PLANS.md).

## Purpose / Big Picture

After this change, the app should feel substantially faster when reopening major screens such as the feed, profiles, meetups, and chats. Instead of each screen waiting for a fresh network round-trip before rendering, the app will show cached server data immediately and then refresh it in the background. The user-visible result should be: quicker tab switching, faster app reopen behavior, and less “blank loading” on commonly revisited screens.

The change is limited to the frontend repository `project_radeon_app`. The existing API layer in `src/api/client.ts` remains the source of truth for HTTP requests; the new cache layer wraps that API layer rather than replacing it.

## Progress

- [x] (2026-04-22 18:33Z) Reviewed the current architecture in `AGENTS.md` and confirmed that screens fetch directly from `src/api/client.ts` without a shared cache layer.
- [x] (2026-04-22 18:37Z) Defined the rollout order: `interests`, then `feed`, then `profiles`, then `meetups`, then `chats`, then `chat threads`, then `discover`, with support surfaces last.
- [x] (2026-04-22 18:47Z) Added React Query and persisted cache provider infrastructure in `App.tsx`, `src/query/queryClient.ts`, `src/query/queryKeys.ts`, and `src/query/asyncStoragePersister.ts`.
- [x] (2026-04-22 18:49Z) Migrated `interests` to `src/hooks/queries/useInterests.ts` and switched `ProfileTabScreen` to consume that hook instead of direct fetching.
- [x] (2026-04-22 18:57Z) Added `src/hooks/queries/useFeed.ts` and migrated `FeedScreen` to use `useInfiniteQuery` for the server-backed feed read path while preserving locally managed optimistic posts on top.
- [x] (2026-04-22 19:00Z) Added `src/hooks/queries/useCreatePostMutation.ts` and switched feed post creation onto a query-aware mutation that invalidates feed and current-user post queries after success.
- [x] (2026-04-22 19:05Z) Added `src/hooks/queries/useUserProfile.ts` and `src/hooks/queries/useUserPosts.ts`, then migrated `UserProfileScreen` to query-backed profile metadata and paginated post reads.
- [x] (2026-04-22 19:24Z) Migrated `MeetupsScreen` to cached infinite queries for public and self-hosted meetup lists while keeping local RSVP/create behavior and updating cached meetup pages in place.
- [x] (2026-04-22 19:32Z) Migrated `ChatsScreen`, `useChatThreadController`, and `DiscoverScreen` onto cached query hooks, preserving optimistic delete/message/friend actions through direct cache updates.
- [x] (2026-04-22 19:40Z) Migrated `SupportScreen` reads to cached support-profile and support-request queries while preserving existing local mutation flows and invalidating support queries after writes.
- [x] (2026-04-22 19:43Z) Re-ran `npx tsc --noEmit` after the full rollout and resolved the remaining integration issues.
- [ ] Validate persistence, background refresh behavior, and cache invalidation rules on-device.

## Surprises & Discoveries

- Observation: the current screen architecture is already well suited to React Query because `src/api/client.ts` cleanly centralizes HTTP calls.
    Evidence: the API client exposes typed functions such as `getFeed`, `getUser`, `getUserPosts`, `getChats`, and `getMeetups`, so the query layer can wrap those functions directly instead of rewriting request logic.

- Observation: some parts of the UI already use optimistic local state, especially the feed.
    Evidence: `src/screens/main/FeedScreen.tsx` currently performs optimistic post insertion and local reconciliation for image posting, which means a future mutation layer must preserve that perceived speed instead of regressing it.

- Observation: the installed persistence package already exports `PersistQueryClientProvider`, so the app root can use the packaged provider directly instead of hand-rolling restore state.
    Evidence: `node_modules/@tanstack/react-query-persist-client/build/modern/index.d.ts` exports `PersistQueryClientProvider`.

- Observation: the feed cannot simply swap its local `posts` state for query data because it already owns optimistic posts, local preview image handling, and comment-count adjustments.
    Evidence: `src/screens/main/FeedScreen.tsx` still inserts temporary posts and preserves local preview URIs, so the query migration keeps server pages in React Query but layers locally managed posts on top until a later mutation refactor.

- Observation: create-post invalidation is worth centralizing even before the full feed mutation flow is extracted because the feed and current-user post list must stay aligned.
    Evidence: `src/hooks/queries/useCreatePostMutation.ts` now invalidates both `queryKeys.feed()` and `queryKeys.userPosts(currentUserId)` on success.

- Observation: profile actions such as add friend, accept friend, and remove friend can keep their existing UI flow while still benefiting from query caching by simply refetching the profile query after mutation.
    Evidence: `src/screens/main/UserProfileScreen.tsx` now uses `profileQuery.refetch()` after relationship changes instead of a custom `loadProfile()` function.

- Observation: the larger social screens did not all need a full mutation rewrite to benefit from caching; for meetups and support, query-backed reads plus targeted cache updates or invalidations were enough to preserve the current UX.
    Evidence: `src/screens/main/MeetupsScreen.tsx` now reads from `useMeetups` and `useMyMeetups`, while `src/screens/main/SupportScreen.tsx` reads from `useSupportProfile`, `useSupportRequests`, and `useMySupportRequests` but still keeps the local response/composer state.

- Observation: chat-thread caching is easiest to integrate by letting the controller own optimistic message writes while the underlying history pages come from `useInfiniteQuery`.
    Evidence: `src/screens/main/chat/useChatThreadController.ts` now uses `useChatMessages` for paginated reads and updates the cached thread directly for optimistic sends and retries.

## Decision Log

- Decision: use `@tanstack/react-query` as the client-side cache layer.
    Rationale: the app needs stale-while-revalidate behavior, request deduplication, pagination support, background refetching, and mutation invalidation. React Query is a better fit than hand-rolled screen caches because the current codebase has multiple self-contained screens fetching independently.
    Date/Author: 2026-04-22 / Codex

- Decision: persist selected query data to AsyncStorage.
    Rationale: the highest-value experience improvement is showing cached server data immediately on app reopen and tab revisit. The repo already includes `@react-native-async-storage/async-storage`, so persistence can be added without a new storage backend.
    Date/Author: 2026-04-22 / Codex

- Decision: keep `src/api/client.ts` as the only network layer.
    Rationale: this preserves the existing architecture, minimizes migration risk, and prevents HTTP logic from being duplicated inside hooks.
    Date/Author: 2026-04-22 / Codex

- Decision: migrate read paths before mutation paths, except where an existing optimistic flow would regress perceived speed.
    Rationale: read-only query migration is lower risk, but the feed is already sensitive to perceived latency, so feed mutations must move to the query layer soon after the feed query itself is introduced.
    Date/Author: 2026-04-22 / Codex

## Outcomes & Retrospective

The full first-pass rollout is now complete. The app root has shared React Query infrastructure with persisted cache, and the main read-heavy surfaces now render through cached query hooks instead of bespoke per-screen fetch lifecycles:

- interests
- feed reads
- create-post invalidation
- public profile reads and user-post pagination
- meetup browse/my lists
- chats list
- chat-thread history
- discover results
- support profile and support-request lists

The remaining work is no longer structural. It is follow-up refinement: on-device verification of persistence behavior, and optional future cleanup where more write paths such as reactions, comments, or support actions could move from local screen state into dedicated mutation hooks.

## Context and Orientation

The frontend repository is `project_radeon_app`. All server requests currently live in `src/api/client.ts`. Global authentication state is handled by `src/hooks/useAuth.tsx`, which restores the auth token and current user but does not cache general server data such as feed posts or meetups.

Most screens fetch their own data directly. For example:

- `src/screens/main/FeedScreen.tsx` loads the community feed and manages optimistic posting locally.
- `src/screens/main/UserProfileScreen.tsx` loads a user profile and that user’s posts.
- `src/screens/main/MeetupsScreen.tsx` loads meetup lists.
- `src/screens/main/ChatsScreen.tsx` loads the chat list.
- `src/screens/main/chat/useChatThreadController.ts` manages chat thread pagination.

In this plan, a “query cache” means stored server data that can be shown immediately while a fresh request runs in the background. A “stale time” means how long cached data is considered fresh enough to render without an immediate forced refetch. A “mutation” means a write operation such as creating a post or sending a message that must update or invalidate cached queries afterward.

## Plan of Work

First, add the React Query foundation. Create `src/query/queryClient.ts` to build a `QueryClient` with mobile-friendly defaults, `src/query/queryKeys.ts` to define stable query keys, and `src/query/asyncStoragePersister.ts` to persist selected query results to AsyncStorage. Update the application root, expected to be `App.tsx`, to wrap the app in a `QueryClientProvider` and the React Query persistence restore component so cached data is available before major screens render.

Second, migrate the simplest low-risk data source: the interests catalog. Add `src/hooks/queries/useInterests.ts` that calls `api.getInterests()` and uses a very long stale time because interests are effectively static. Update the profile editing surface that currently fetches interests directly to use this hook instead. Validate that reopening the profile editor does not refetch unnecessarily and that the list survives an app restart once persistence is enabled.

Third, migrate the feed read path. Add `src/hooks/queries/useFeed.ts` based on `useInfiniteQuery`, wrapping `api.getFeed()`. The hook must flatten pages into the post list shape the current feed screen expects and expose `fetchNextPage`, `hasNextPage`, loading state, and refresh behavior. Update `src/screens/main/FeedScreen.tsx` so it reads feed data from the hook instead of maintaining its own ad hoc list-fetch lifecycle. Keep the current posting behavior intact during this milestone; the first goal is cached rendering and background refresh for feed reads.

Fourth, migrate feed mutations. Add a mutation hook, likely `src/hooks/queries/useCreatePost.ts`, that encapsulates optimistic post insertion, image upload coordination, and reconciliation. The mutation should update the cached feed query directly so the screen no longer owns mutation bookkeeping that belongs in the cache layer. Apply the same principle later to reactions and comments, but only after basic post creation is stable.

Fifth, migrate profiles. Add `src/hooks/queries/useUserProfile.ts` for `api.getUser()` and `src/hooks/queries/useUserPosts.ts` for paginated `api.getUserPosts()`. Update `src/screens/main/UserProfileScreen.tsx` to use those hooks. Make sure profile edits invalidate both the current-user query and any cached public profile for the authenticated user.

Sixth, migrate meetups and chats. Add query hooks for meetup lists, meetup detail, attendee lists, chats, and chat threads. Chat threads should use `useInfiniteQuery` because the current controller already paginates messages. Only recent message pages should be persisted to avoid growing the persisted cache indefinitely.

Throughout the rollout, define and apply invalidation rules centrally. For example, creating a post must update or invalidate the feed and the current user’s post list. Editing a profile must update or invalidate the current-user query and public profile query. Sending a message must update the chat thread cache and the chats list cache.

## Concrete Steps

From `/home/michaelroddy/repos/project_radeon_app`, install the required packages:

    npm install @tanstack/react-query @tanstack/react-query-persist-client

Create the query infrastructure files:

    src/query/queryClient.ts
    src/query/queryKeys.ts
    src/query/asyncStoragePersister.ts

Update the app root:

    App.tsx

so it wraps the existing app tree in the query provider and persistence restore provider.

Create the first query hook:

    src/hooks/queries/useInterests.ts

and switch the current interests consumer to that hook. Validate with:

    npx tsc --noEmit

Completed first-milestone validation:

    npx tsc --noEmit

Then add:

    src/hooks/queries/useFeed.ts

and migrate the feed screen read path. This is now complete. After each milestone, run:

    npx tsc --noEmit

and launch the Expo app:

    npx expo start

to confirm the screen renders cached data first and refreshes in the background.

## Validation and Acceptance

Acceptance for the foundation milestone is:

1. The app boots with the React Query provider and does not break authentication or navigation.
2. The interests catalog renders from a query hook and does not visibly refetch on every open.
3. After killing and reopening the app, the interests catalog and any migrated queries can render from persisted cache before the fresh network round-trip completes.

Acceptance for the feed milestone is:

1. Opening the feed after a previous visit shows cached posts immediately when available.
2. Pull-to-refresh still works.
3. Infinite scroll still loads later pages.
4. Background refresh updates the feed without a blank loading screen.
5. Existing optimistic post creation still feels at least as fast as before the migration.

Acceptance for later milestones is:

1. Reopening a previously visited public profile shows cached profile data and recent posts immediately.
2. Reopening the chats list shows cached conversations immediately.
3. Reopening a recent chat thread shows cached recent messages immediately, then refreshes.

## Idempotence and Recovery

This rollout is safe to do incrementally because it is additive at first. The initial provider setup does not require removing existing screen logic immediately. Each screen can be migrated one at a time. If a screen-specific migration causes problems, revert that screen to direct API calls temporarily while keeping the shared query infrastructure in place.

Persistence should be introduced cautiously. If a persisted query shape becomes incompatible during development, clear AsyncStorage for the app and relaunch. Because the cache is only a performance layer, clearing it should never lose authoritative user data.

## Artifacts and Notes

Recommended initial query timings:

    interests: staleTime = 24h
    feed: staleTime = 30s
    user profile: staleTime = 5m
    user posts: staleTime = 2m
    chats list: staleTime = 20s
    chat messages: staleTime = 15s
    meetups: staleTime = 3m
    discover: staleTime = 2m
    support surfaces: staleTime = 10s

Recommended first invalidation rules:

    createPost:
      invalidate or update ['feed']
      invalidate ['userPosts', currentUserId]

    updateMe:
      invalidate ['me']
      invalidate ['user', currentUserId]

    sendMessage:
      update ['chatMessages', chatId]
      invalidate or update ['chats']

    RSVP meetup:
      invalidate ['meetups']
      invalidate ['myMeetups']
      invalidate ['meetup', meetupId]

## Interfaces and Dependencies

Add these dependencies to `package.json`:

    @tanstack/react-query
    @tanstack/react-query-persist-client

Use `@react-native-async-storage/async-storage`, which is already present in the repo, as the persistence backend.

At the end of the first milestone, these files should exist:

    src/query/queryClient.ts
    src/query/queryKeys.ts
    src/query/asyncStoragePersister.ts
    src/hooks/queries/useInterests.ts

At the end of the second milestone, this file should also exist:

    src/hooks/queries/useFeed.ts

The query key module should define stable key builders, for example:

    queryKeys.interests()
    queryKeys.feed(limit)
    queryKeys.user(userId)
    queryKeys.userPosts(userId, limit)
    queryKeys.chats()
    queryKeys.chatMessages(chatId)

The query hooks must call the existing functions in `src/api/client.ts` rather than inlining `fetch` logic.

Revision note: created this ExecPlan after analyzing the current screen-by-screen fetch architecture and identifying the highest-value cache targets for a staged React Query rollout.
Revision note: updated after the first milestone landed to record the provider setup, the interests query migration, and the successful type-check validation.
