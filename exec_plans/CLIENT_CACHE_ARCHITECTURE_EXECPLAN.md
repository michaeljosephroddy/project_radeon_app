# Build a policy-driven client cache and scroll-restoration system for mobile feeds

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with [PLANS.md](PLANS.md).

## Purpose / Big Picture

After this change, the app should feel fast and predictable in the same way users expect from large social apps: reopening a tab should show useful cached content immediately, background refreshes should stay bounded, deep scroll history should not explode into many network requests, and list position should either restore correctly or intentionally reset to the top. The user-visible result should be that feed-like screens feel stable instead of jumpy, tab switches do not trigger wasteful refetch storms, and scroll position never lands in a broken mid-list state after cached pages have been trimmed.

This plan starts from the current repository state, where React Query with persistence already exists, several screens already use `useInfiniteQuery`, and an initial guardrail has been added to trim some infinite queries and suppress eager `onEndReached` calls. The goal here is not another one-off patch. The goal is to replace ad hoc behavior with a maintainable, extensible, and modular cache architecture that can support future surfaces without re-solving the same problems screen by screen.

## Progress

- [x] (2026-04-23 10:22Z) Reviewed `PLANS.md` and the existing cache rollout plan to confirm the required ExecPlan structure and the current repository baseline.
- [x] (2026-04-23 10:28Z) Re-audited the current infinite-query surfaces in `src/hooks/queries/` and the mounted-tab behavior in `src/navigation/AppNavigator.tsx`.
- [x] (2026-04-23 10:35Z) Confirmed the current first-pass mitigation already in the working tree: bounded persistence for several infinite queries and guarded `FlatList.onEndReached` handling.
- [x] (2026-04-23 11:03Z) Added `src/query/queryPolicies.ts` as the shared registry for infinite-query persistence, inactive page windows, refetch-on-mount behavior, scroll mode, and list profile defaults.
- [x] (2026-04-23 11:06Z) Replaced hardcoded infinite-query page limits in `src/query/infiniteQueryPolicy.ts` with policy-driven trimming and persisted-page handling.
- [x] (2026-04-23 11:13Z) Added `src/query/scrollStateStore.ts` and `src/hooks/useListScrollRestoration.ts` so list surfaces save offsets explicitly and either restore or reset according to policy instead of relying on implicit `FlatList` behavior.
- [x] (2026-04-23 11:18Z) Added `src/utils/listPerformance.ts` and applied shared list profiles plus scroll restoration to feed, discover, chats, meetups, support requests, and user-profile timelines.
- [x] (2026-04-23 11:22Z) Updated the infinite-query hooks to read policy-driven `refetchOnMount` behavior and reran `npx tsc --noEmit` successfully.
- [ ] Validate the behavior on-device across feed, discover, meetups, support, chats, profile timelines, and chat threads.

## Surprises & Discoveries

- Observation: the existing tab shell in `src/navigation/AppNavigator.tsx` keeps top-level tabs mounted and simply hides inactive ones with `display: 'none'`.
    Evidence: `DiscoverTab`, `SupportTab`, `MeetupsTab`, and `ChatsTab` all render their screens continuously and swap between `styles.tabVisible` and `styles.tabHidden`.

- Observation: TanStack Query v5 re-fetches as many pages as an infinite query already has cached when a stale infinite query refetches, rather than collapsing back to page 1.
    Evidence: the library code in `node_modules/@tanstack/query-core/src/infiniteQueryBehavior.ts` uses `oldPages.length` as the count of pages to refetch during stale infinite-query revalidation.

- Observation: a screen can show page-1-only data while still remembering a deep scroll offset if list position is preserved separately by React Native and the query data is trimmed independently.
    Evidence: after trimming cached feed pages to one page, revisiting the feed can land near the end of the remaining content instead of the top because the `FlatList` offset outlives the deeper data window.

- Observation: the repository now contains a useful but incomplete mitigation in `src/query/infiniteQueryPolicy.ts` and `src/hooks/useGuardedEndReached.ts`.
    Evidence: these modules trim persisted/inactive infinite queries and suppress mount-triggered pagination, but they do not yet provide a true scroll restoration strategy or per-surface policy registry.

- Observation: restoring scroll safely requires tracking the page window that existed when the offset was saved, not just the offset itself.
    Evidence: `src/hooks/useListScrollRestoration.ts` now stores both `offsetY` and `pageCount`, and will reset instead of restoring if the current cached page window is smaller than the saved one.

- Observation: the current feed/profile/discover surfaces can share one restoration hook even though their product behavior differs, because the policy registry decides reset versus restore behavior.
    Evidence: `FeedScreen` uses `scrollMode: restore_if_valid_else_reset`, while discover and user-post timelines consume the same hook with `scrollMode: reset`.

## Decision Log

- Decision: treat “server snapshot”, “pagination window”, and “scroll state” as separate concerns.
    Rationale: a single infinite-query cache cannot safely represent both a lightweight persisted snapshot and an exact deep-scroll restoration target. Large social apps solve this by separating what is cached, how far pagination extends in-session, and how position is restored.
    Date/Author: 2026-04-23 / Codex

- Decision: use a policy registry rather than hardcoded screen heuristics.
    Rationale: the repository already has multiple infinite-query surfaces with different product expectations. Discover should reset aggressively, while chat threads should preserve more context. A registry keeps those choices explicit and reusable.
    Date/Author: 2026-04-23 / Codex

- Decision: prefer “restore if valid, otherwise reset intentionally” over “best-effort restore”.
    Rationale: landing at an arbitrary middle offset after trimming pages is worse than resetting to the top. The system should either restore a valid anchor with enough surrounding data or reset deterministically.
    Date/Author: 2026-04-23 / Codex

- Decision: keep React Query as the cache engine and refine the architecture around it instead of replacing it.
    Rationale: the existing rollout already centralizes network reads successfully, and the current issues come from policy gaps, not from React Query being the wrong tool.
    Date/Author: 2026-04-23 / Codex

- Decision: keep scroll state in memory for this milestone instead of persisting it through AsyncStorage.
    Rationale: the current product risk comes from invalid same-session restoration after trimming cached pages. In-memory restoration solves that directly while keeping the first architectural pass small and easier to validate. Persisted scroll state can be added later if product testing proves it valuable.
    Date/Author: 2026-04-23 / Codex

## Outcomes & Retrospective

The policy-driven cache architecture is now in place for the major `FlatList`-based infinite-scroll surfaces. The repository now has a single infinite-query policy registry, policy-driven query trimming, a shared in-memory scroll-state store, a reusable restoration/reset hook, and shared list-performance profiles. Feed, discover, chats, meetups, support requests, and user-profile timelines now use the shared behavior instead of each screen making up its own cache lifecycle rules.

What remains is on-device validation. The compiler is clean, but this plan is not complete until the actual app behavior is verified on real list interactions across tabs, overlays, search filters, and app restarts.

## Context and Orientation

This repository is an Expo / React Native frontend app rooted at `/home/michaelroddy/repos/project_radeon_app`. The app entry point is `App.tsx`. Navigation is owned by `src/navigation/AppNavigator.tsx`. Screen-specific data fetching happens through query hooks in `src/hooks/queries/`, and all HTTP calls still flow through `src/api/client.ts`.

The first cache rollout has already introduced React Query and persistence:

- `App.tsx` wraps the app in `PersistQueryClientProvider`.
- `src/query/queryClient.ts` defines shared query defaults.
- `src/query/queryKeys.ts` defines stable cache keys.
- `src/query/asyncStoragePersister.ts` writes persisted cache state to AsyncStorage.

Several screens now use infinite queries. In this repository, an “infinite query” means a paginated list that can fetch the next page and append it to previously loaded pages. Current infinite-query hooks include:

- `src/hooks/queries/useFeed.ts`
- `src/hooks/queries/useDiscover.ts`
- `src/hooks/queries/useChats.ts`
- `src/hooks/queries/useMeetups.ts`
- `src/hooks/queries/useSupport.ts`
- `src/hooks/queries/useUserPosts.ts`
- `src/hooks/queries/useChatMessages.ts`

The current first-pass mitigation lives in:

- `src/query/infiniteQueryPolicy.ts`
- `src/hooks/useGuardedEndReached.ts`

That code trims some queries to a bounded page count when they go inactive or are persisted, and it prevents `FlatList.onEndReached` from firing immediately on mount. This is useful groundwork, but it is not the finished architecture because it still leaves several missing pieces:

1. There is no central policy registry that explains which surfaces should persist one page, which should persist more, which should restore scroll position, and which should reset to top.
2. There is no dedicated scroll state store, so scroll restoration currently depends on implicit `FlatList` behavior.
3. There is no single focus/refetch lifecycle helper for mounted-but-hidden tabs versus unmounted overlays.
4. List-performance settings are still screen-specific and inconsistent.

In this plan, the term “snapshot” means the shallow cached content that should render immediately on revisit, typically page 1 or a small bounded window. The term “pagination window” means the deeper pages loaded during the current session as the user scrolls. The term “scroll anchor” means the saved position or item reference needed to restore a list to a meaningful place. The term “policy registry” means a single module that declares, per screen or per query family, how snapshots, pagination, refetching, and scroll should behave.

## Plan of Work

The implementation should begin by creating a dedicated query policy registry in `src/query/queryPolicies.ts`. This module must be the single source of truth for feed-like surfaces. For each query family, define a stable configuration object that includes: whether the query is eligible for persistence, how many pages may be persisted, how many pages may remain in memory while the surface is inactive, whether stale data should refetch on mount, whether scroll should restore or reset, how long scroll state remains valid, and any list tuning defaults that the screen should consume. The query families that must be covered in the first pass are `feed`, `discover`, `chats`, `meetups`, `my-meetups`, `support-requests`, `user-posts`, and `chat-messages`.

Next, replace the current ad hoc trimming logic in `src/query/infiniteQueryPolicy.ts` with policy-driven helpers. This module should stop hardcoding page limits and instead look up behavior in `src/query/queryPolicies.ts`. It should expose helpers for three lifecycle moments: trimming before persistence, trimming when a query becomes inactive or unmounts, and deciding whether the current cached page window is compatible with the saved scroll state. This logic must remain generic and should not import screen components.

Then add a dedicated scroll state layer. Create `src/query/scrollStateStore.ts` or `src/navigation/scrollStateStore.ts` and define a small typed API for saving, reading, and clearing scroll state by logical surface key. The saved state should contain enough information to decide whether restoring is valid. At minimum that means: a stable surface key, a timestamp, the last offset, and an optional anchor item id if one is available. The store may begin in memory only; persistence across app restarts is optional in this milestone and should be explicitly deferred unless it becomes necessary to support a proven user expectation. The key requirement is that a surface can decide on activation whether to restore or reset based on its own policy and the current cached page window.

Once the store exists, create a reusable hook such as `src/hooks/useListScrollRestoration.ts`. This hook should work with `FlatList` refs and should expose three capabilities: save scroll state on scroll or blur, decide whether to restore or reset on focus, and clear invalid state when query data has been trimmed below the saved anchor. The hook must support two modes: “restore” and “reset”. In restore mode, it should restore the offset only if the current policy and current data window make that restoration valid. In reset mode, it should scroll to the top when the surface becomes active again. Discover and browse-heavy tabs should use reset mode. Chat threads should use restore mode with a bounded recent window. The community feed should use restore mode only if enough shallow pages remain cached; otherwise it should reset cleanly.

After the restoration layer exists, refactor each infinite-scroll screen to consume policy-driven behavior instead of screen-specific assumptions. Update:

- `src/screens/main/FeedScreen.tsx`
- `src/screens/main/DiscoverScreen.tsx`
- `src/screens/main/ChatsScreen.tsx`
- `src/screens/main/MeetupsScreen.tsx`
- `src/screens/main/SupportScreen.tsx`
- `src/screens/main/UserProfileScreen.tsx`
- `src/screens/main/chat/useChatThreadController.ts`

Each screen should stop deciding its own lifecycle rules independently. It should obtain the relevant query policy, apply the shared pagination guard, and apply the shared scroll-restoration behavior. Keep screen code focused on rendering and user actions. Cache window sizing, reset-vs-restore behavior, and lifecycle trimming should come from the shared modules.

After that, standardize list-performance settings. Add a small reusable helper, likely `src/utils/listPerformance.ts`, that exports tuned defaults for `FlatList` classes used in this app. Do not force every list into the same values; instead define a few named profiles such as `denseFeed`, `twoColumnGrid`, and `chatList`. Apply those to the screens above. Where item heights are known or close to fixed, add `getItemLayout`. Do not attempt `getItemLayout` on highly variable-height post cards in the feed unless a reliable measurement strategy already exists. The first win is consistency and avoiding accidental regressions, not overengineering measurement.

Finally, add lightweight development instrumentation so this system can be verified. Create a debug-only helper in `src/query/cacheDebug.ts` or a similar path that logs, in development builds only, which query family is being trimmed, how many pages are persisted, and whether a screen restored or reset its scroll state. This logging should be concise and easy to remove later. The purpose is to make manual on-device validation possible without guessing.

## Concrete Steps

All commands below must be run from `/home/michaelroddy/repos/project_radeon_app`.

Start by reviewing the current baseline before editing:

    sed -n '1,220p' src/query/infiniteQueryPolicy.ts
    sed -n '1,220p' src/hooks/useGuardedEndReached.ts
    sed -n '1,260p' src/navigation/AppNavigator.tsx
    rg -n "useInfiniteQuery\\(" src/hooks/queries

Create the new policy and scroll modules:

    src/query/queryPolicies.ts
    src/query/scrollStateStore.ts
    src/hooks/useListScrollRestoration.ts
    src/utils/listPerformance.ts

Refactor the existing trimming module to depend on the policy registry:

    src/query/infiniteQueryPolicy.ts
    src/query/asyncStoragePersister.ts

Wire policy and scroll restoration into the affected hooks and screens:

    src/hooks/queries/useFeed.ts
    src/hooks/queries/useDiscover.ts
    src/hooks/queries/useChats.ts
    src/hooks/queries/useMeetups.ts
    src/hooks/queries/useSupport.ts
    src/hooks/queries/useUserPosts.ts
    src/hooks/queries/useChatMessages.ts
    src/screens/main/FeedScreen.tsx
    src/screens/main/DiscoverScreen.tsx
    src/screens/main/ChatsScreen.tsx
    src/screens/main/MeetupsScreen.tsx
    src/screens/main/SupportScreen.tsx
    src/screens/main/UserProfileScreen.tsx
    src/screens/main/chat/useChatThreadController.ts

Run a type check after each milestone-sized set of edits:

    npx tsc --noEmit

Use the Expo app for manual validation:

    npx expo start

During manual testing, exercise these scenarios in a development build:

1. Open community feed, load several pages, switch away, return, and verify that the screen either restores to a valid location or resets cleanly according to policy.
2. Open discover, load several pages, switch away, return, and verify that it resets to the top with only shallow cached content.
3. Open a chat thread, load older messages, leave the thread, return, and verify that recent context remains bounded but restoration is still coherent.
4. Kill and reopen the app, then revisit feed, discover, chats, and meetups to confirm persisted snapshots remain shallow and no longer trigger large refetch bursts.

Expected type-check transcript:

    $ npx tsc --noEmit
    [no output]

Expected manual behavior transcript for discover after the full change:

    Enter Discover
    Page 1 renders immediately from cache if available
    No automatic page 2+ requests occur on tab entry
    Scroll down
    Page 2 loads only after user-driven pagination
    Leave tab and return
    Discover resets to top and shows shallow cached results

## Validation and Acceptance

This work is complete only when the following behaviors can be observed by a human tester:

1. Reopening any infinite-scroll screen no longer triggers an unbounded refetch of all historically loaded pages. The number of background refetches must match the policy-defined shallow window for that surface.
2. A screen whose data window is trimmed does not land at an arbitrary preserved deep offset. It either restores meaningfully or resets to the top according to policy.
3. Community feed, discover, chats, meetups, support requests, and user-profile timelines all use shared lifecycle helpers rather than screen-specific trimming logic.
4. Chat threads retain a bounded recent message window and continue to support loading older messages on demand.
5. `npx tsc --noEmit` passes after the refactor.
6. After an app restart, persisted feed-like screens show shallow cached content immediately and do not generate multi-page refetch storms.

Acceptance for the feed specifically is:

- If the user briefly switches away and returns while the shallow restore window is still valid, the feed may restore near the prior location.
- If the saved position is no longer compatible with the cached page window, the feed resets to the top intentionally instead of landing in the middle.

Acceptance for discover specifically is:

- Re-entering the tab always resets to the top.
- Only the first page, or the policy-defined shallow snapshot, is persisted and revalidated.

Acceptance for chat messages specifically is:

- Leaving and reopening a thread preserves recent context more aggressively than browse surfaces.
- The cached message window remains bounded so reopening a long thread does not re-fetch every historical page.

## Idempotence and Recovery

This plan is safe to implement incrementally because the new system can be layered on top of the current first-pass mitigation before the older behavior is removed. The safest order is:

1. Introduce the policy registry and keep the old trimming behavior functionally equivalent.
2. Introduce the scroll state store and restoration hook behind one surface first, preferably discover or feed.
3. Migrate the remaining surfaces to the shared behavior one by one.
4. Remove any redundant screen-local logic only after the shared hooks prove stable.

If a specific surface regresses during rollout, the recovery path is to keep the policy registry and shared helpers in place but temporarily revert that one screen to explicit reset-to-top behavior. A deterministic reset is an acceptable fallback; an invalid restoration is not. If persisted cache shapes become incompatible during development, clear AsyncStorage for the app and relaunch. Because the cache is only a performance layer, clearing it does not remove authoritative user data.

## Artifacts and Notes

Suggested first-pass policy definitions to implement in `src/query/queryPolicies.ts`:

    feed:
      persist: true
      persistedPages: 2
      inactivePages: 2
      scrollMode: restore_if_valid_else_reset
      scrollTtlMs: 5 * 60 * 1000

    discover:
      persist: true
      persistedPages: 1
      inactivePages: 1
      scrollMode: reset

    chats:
      persist: true
      persistedPages: 1
      inactivePages: 1
      scrollMode: restore_if_valid_else_reset
      scrollTtlMs: 2 * 60 * 1000

    meetups:
      persist: true
      persistedPages: 1
      inactivePages: 1
      scrollMode: reset

    support-requests:
      persist: true
      persistedPages: 1
      inactivePages: 1
      scrollMode: reset

    user-posts:
      persist: true
      persistedPages: 1
      inactivePages: 1
      scrollMode: reset

    chat-messages:
      persist: true
      persistedPages: 3
      inactivePages: 3
      scrollMode: restore_if_valid_else_reset
      scrollTtlMs: 10 * 60 * 1000

These values are intentionally conservative. The main performance objective is to bound network and storage cost first. Page windows can be widened later if measurement proves a stronger restoration experience is worth the additional cost.

## Interfaces and Dependencies

Continue using the existing libraries already present in this repository:

- `@tanstack/react-query`
- `@tanstack/react-query-persist-client`
- `@react-native-async-storage/async-storage`
- React Native `FlatList`

In `src/query/queryPolicies.ts`, define types similar to:

    export type ScrollMode = 'reset' | 'restore_if_valid_else_reset';

    export interface InfiniteQueryPolicy {
        persist: boolean;
        persistedPages: number;
        inactivePages: number;
        scrollMode: ScrollMode;
        scrollTtlMs?: number;
        refetchOnMount?: boolean | 'always';
        listProfile?: 'denseFeed' | 'twoColumnGrid' | 'chatList';
    }

    export function getInfiniteQueryPolicy(queryKey: QueryKey): InfiniteQueryPolicy | undefined;

In `src/query/scrollStateStore.ts`, define a small API similar to:

    export interface SavedScrollState {
        surfaceKey: string;
        offsetY: number;
        savedAt: number;
        anchorItemId?: string;
    }

    export function saveScrollState(state: SavedScrollState): void;
    export function getScrollState(surfaceKey: string): SavedScrollState | undefined;
    export function clearScrollState(surfaceKey: string): void;

In `src/hooks/useListScrollRestoration.ts`, define a reusable hook similar to:

    export interface ListScrollRestorationOptions {
        surfaceKey: string;
        enabled: boolean;
        scrollMode: 'reset' | 'restore_if_valid_else_reset';
        scrollTtlMs?: number;
        canRestore: () => boolean;
    }

    export function useListScrollRestoration(
        flatListRef: React.RefObject<FlatList>,
        options: ListScrollRestorationOptions,
    ): {
        onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
        restoreOrReset: () => void;
        clearSavedState: () => void;
    };

The important constraint is that screen components should not need to know how trimming, persistence, and restoration are implemented internally. They should only select the correct policy and hand their list ref plus lifecycle state to the shared hooks.

Revision note: created this ExecPlan on 2026-04-23 after validating that the current first-pass cache rollout fixed some runaway pagination behavior but still lacked a coherent long-term architecture for scroll restoration and per-surface cache policy.
