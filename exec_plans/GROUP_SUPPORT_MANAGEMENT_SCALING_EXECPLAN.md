# Scale Group Support Request Management

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `PLANS.md` in the repository root. If the implementation changes direction, update this file first so a future contributor can resume from only this plan and the current working tree.

## Purpose / Big Picture

Group support request owners currently open the group request management screen and see replies and private offers stacked together in one scrolling page. That is acceptable with a handful of items, but it breaks down when a request receives dozens or hundreds of replies or offers because the screen only fetches the first batch, gives no indication that more exists, and mixes private actionable offers with public discussion replies.

After this change, a request owner can manage a busy group support request through a compact management screen with separate `Offers` and `Replies` tabs. Offers load in pages, can be filtered by status, and keep `Accept` and `Decline` actions close to each offer. Replies load in pages and include a clear route back to the full group discussion. A human can see the behavior by opening a group support request they own, tapping `Manage`, switching between the tabs, and scrolling to load more results without the screen becoming a long unbounded mixed list.

## Progress

- [x] (2026-05-20T21:18Z) Read `PLANS.md` and confirmed the required ExecPlan structure.
- [x] (2026-05-20T21:18Z) Created planning branch `plan/group-support-management-scaling` in `/home/michaelroddy/repos/project_radeon_app`.
- [x] (2026-05-20T21:18Z) Audited the current app code and backend endpoint shape relevant to group support request management.
- [x] (2026-05-20T21:29Z) Implemented backend offer status filtering for `GET /support/requests/{id}/offers`.
- [x] (2026-05-20T21:29Z) Added app API and React Query hooks for paged offers and replies.
- [x] (2026-05-20T21:29Z) Replaced the current `SupportRequestManagementScreen` mixed `ScrollView` with a tabbed paged `FlatList` experience.
- [x] (2026-05-20T21:29Z) Validated backend tests with `GOCACHE=/tmp/project_radeon_go_cache go test ./internal/support ./cmd/api`.
- [x] (2026-05-20T21:29Z) Validated app typecheck with `npm run typecheck`.
- [x] (2026-05-20T21:34Z) Tightened management offer filters to `Pending` and `Accepted` only, and tightened the API to reject `status=all` and `status=not_selected`.
- [x] (2026-05-20T21:40Z) Updated the group manage `Offers`/`Replies` tabs and `Pending`/`Accepted` sub-tabs to use the same `SegmentedControl` section pattern.
- [x] (2026-05-20T21:44Z) Updated top-level app tabs to match Discover's page/primary `SegmentedControl` style while leaving nested filters on section styling.
- [x] (2026-05-20T21:45Z) Removed count badges from the group manage `Offers` and `Replies` tabs.
- [x] (2026-05-20T21:47Z) Reverted nested sub-tabs such as group support `Feed`/`My Requests` and profile request `Incoming`/`Sent` to section styling.
- [x] (2026-05-20T21:49Z) Standardized remaining nested main-app sub-tabs to section/secondary styling, including Support scopes and filters.
- [x] (2026-05-20T21:51Z) Reverted Meetups `Discover`/`Hosting`/`Going` and Groups `Discover`/`Joined` to section/secondary styling because they are nested surface tabs.
- [ ] Manually smoke test the Expo UI against a running backend on a device or simulator.
- [x] (2026-05-20T21:34Z) Updated this ExecPlan with outcomes, discoveries, and implementation notes.

## Surprises & Discoveries

- Observation: The app already imports `FlatList` in `src/screens/main/groups/GroupDetailScreen.tsx`, but the management screen itself still renders all loaded replies and offers inside one `ScrollView`.
    Evidence: `SupportRequestManagementScreen` starts near `src/screens/main/groups/GroupDetailScreen.tsx:205`, fetches `api.getSupportOffers(request.id, 1, 30)` and `api.getSupportReplies(request.id, undefined, 40)` near lines 230-231, and renders both sections in a `ScrollView` starting near line 308.
- Observation: The backend already paginates offers by page and replies by cursor, so the scalable UI does not require inventing new pagination semantics.
    Evidence: `src/api/client.ts:1765` exposes `getSupportOffers(id, page, limit)` returning `PaginatedResponse<SupportOffer>`, and `src/api/client.ts:1773` exposes `getSupportReplies(id, cursor, limit)` returning `CursorResponse<SupportReply>`.
- Observation: Accurate offer status filters need backend support. Filtering only the offers already loaded in the app would be misleading when hundreds of offers exist because matching offers could be on pages that have not been fetched yet.
    Evidence: `internal/support/handler.go:593` in the Go API lists offers without a `status` query parameter, and `internal/support/store.go:797` selects all rows for the request with `WHERE sres.support_request_id = $1`.
- Observation: No database migration was required.
    Evidence: The implementation filters the existing `support_responses.status` value in `internal/support/store.go`; no schema files were added or changed.
- Observation: The backend already has `idx_support_responses_request_status_created_at` on `support_responses(support_request_id, status, created_at DESC)`.
    Evidence: `migrations/046_peer_support_thread_model.sql` creates this index. The final store implementation uses a direct status predicate when a status filter is present so that filtered offer pages can use the indexed request/status prefix cleanly.

## Decision Log

- Decision: Keep impressions, support request replies, and support offers in place; this plan only changes how group support request management scales.
    Rationale: The current problem is a presentation and pagination issue in the group management screen, not a data model removal.
    Date/Author: 2026-05-20 / Codex
- Decision: Use separate `Offers` and `Replies` tabs instead of stacking both sections.
    Rationale: Offers are private and actionable for the requester, while replies are public discussion. Separate tabs reduce visual noise and make hundreds of items manageable.
    Date/Author: 2026-05-20 / Codex
- Decision: Add server-backed offer status filtering before exposing status filter chips in the app.
    Rationale: A client-only filter over the currently loaded pages would show incomplete results with high-volume requests. Server filtering keeps `Pending` and `Accepted` accurate from the first page.
    Date/Author: 2026-05-20 / Codex
- Decision: Expose only `Pending` and `Accepted` in the manage UI, and reject `status=all` and `status=not_selected` query values in the API.
    Rationale: The requester only needs actionable pending offers and the accepted offer in this management workflow. Keeping passed and all filters adds visual noise and encourages managing historical rows that are not useful yet.
    Date/Author: 2026-05-20 / Codex
- Decision: Keep the group manage tabs inside the list header, but style both primary and status tabs with the shared `SegmentedControl` section pattern.
    Rationale: The tab location preserves the request-card-first context, while using the shared control makes the screen consistent with Discover, Meetups, and the rest of Groups.
    Date/Author: 2026-05-20 / Codex
- Decision: Use Discover's `page`/`primary` segmented control style for top-level tabs across the app, and keep nested filters/sub-tabs on section styling.
    Rationale: Primary navigation should look the same wherever it appears. Secondary controls such as offer status filters and request scopes should remain visually subordinate.
    Date/Author: 2026-05-20 / Codex
- Decision: Use the existing app patterns: API calls in `src/api/client.ts`, query keys in `src/query/queryKeys.ts`, React Query hooks under `src/hooks/queries/`, `SegmentedControl` for tabs, and `FlatList` plus `useGuardedEndReached` for pagination.
    Rationale: These patterns already exist across feed, support, profile, chats, groups, notifications, and meetups screens, so the implementation will be easier to maintain and less surprising.
    Date/Author: 2026-05-20 / Codex

## Outcomes & Retrospective

Implemented. The backend now accepts `status=pending` or `status=accepted` on the support offers list endpoint and rejects unsupported values, including `status=all` and `status=not_selected`, with HTTP 400. Omitting the `status` parameter still returns the legacy unfiltered list for existing callers. The app now calls that endpoint through an options object, provides React Query infinite hooks for offers and replies, and renders the group support request management screen as separate paged `Offers` and `Replies` lists. The group management offer filters are limited to `Pending` and `Accepted`.

Automated validation passed with `GOCACHE=/tmp/project_radeon_go_cache go test ./internal/support ./cmd/api` in `/home/michaelroddy/repos/project_radeon` and `npm run typecheck` in `/home/michaelroddy/repos/project_radeon_app`. Manual Expo smoke testing has not been run yet in this implementation session.

## Context and Orientation

There are two repositories involved. The React Native app lives at `/home/michaelroddy/repos/project_radeon_app`. The Go backend API lives at `/home/michaelroddy/repos/project_radeon`. The app repository is the primary repository for this plan, but one small backend change is included because accurate offer status filtering cannot be done solely in the app.

In the app, all network calls must go through `src/api/client.ts`. The screens do not call `fetch` directly. Shared query keys live in `src/query/queryKeys.ts`. React Query hooks live under `src/hooks/queries/`; React Query is a library that caches server data and supports infinite queries, which means it can fetch page one, then page two, and so on as the user scrolls.

The group support request management UI is currently inside `src/screens/main/groups/GroupDetailScreen.tsx` in the `SupportRequestManagementScreen` function. It receives a `SupportRequest`, the optional group post that represents the public discussion, and callbacks for going back, opening comments, opening chat, and notifying the parent that data changed. It currently owns local arrays named `offers` and `replies`, loads both arrays once in a `useEffect`, then maps both arrays into cards inside one `ScrollView`.

The app already has reusable UI and pagination tools that should be used here. `src/components/ui/SegmentedControl.tsx` provides the tab control and already supports badge labels. `src/hooks/useGuardedEndReached.ts` prevents `FlatList.onEndReached` from firing before the user has actually scrolled. `src/components/support/SupportRequestCard.tsx` renders the compact request card and already knows how to display request metadata and actions. `src/components/support/supportRequestPresentation.ts` contains support type labels such as `getSupportTypeLabel`.

The existing API types are in `src/api/client.ts`. `PaginatedResponse<T>` has `items`, `page`, `limit`, and `has_more`. `CursorResponse<T>` has `items`, `limit`, `has_more`, and `next_cursor`. Offers are page-based because the endpoint accepts `page` and `limit`. Replies are cursor-based because the endpoint accepts `cursor` and `limit`; a cursor is an opaque string from the server that tells the next request where to continue.

In the backend, the support handler interface is in `internal/support/handler.go`. `ListSupportOffers` verifies that the authenticated user owns the support request, parses page pagination, calls `h.db.ListSupportOffers`, and returns `pagination.Slice`. The Postgres implementation is in `internal/support/store.go` and currently selects all `support_responses` for one request, ordered by `sres.created_at ASC`. The cached store in `internal/support/cache_store.go` simply delegates to the underlying store. Tests and mocks are in `internal/support/handler_test.go` and `internal/support/cache_store_test.go`.

The term `offer status` means the backend field `SupportOffer.Status`, exposed to the app as `SupportOffer['status']`, with current possible values `pending`, `accepted`, and `not_selected`. The management filter intentionally exposes only `pending` and `accepted`; `not_selected` can still exist in stored data but is not a supported management filter.

## Plan of Work

First, update the backend so the existing offer list endpoint can filter by status. In `/home/michaelroddy/repos/project_radeon/internal/support/handler.go`, change the `Querier` interface method `ListSupportOffers` to accept a status filter string before `limit` and `offset`, where the empty string means all statuses for legacy callers. In `Handler.ListSupportOffers`, read `status` from `r.URL.Query()`, trim it, and accept only empty, `pending`, or `accepted`. Return HTTP 400 for any other value, including `all` and `not_selected`, with a clear message such as `invalid support offer status`. Then pass the normalized status to the store. In `/home/michaelroddy/repos/project_radeon/internal/support/store.go`, update `pgStore.ListSupportOffers` to use a direct `AND sres.status = $2` predicate when a status filter is present, with `LIMIT $3 OFFSET $4`; when no status filter is present, omit the status predicate and use `LIMIT $2 OFFSET $3`. Keep ordering deterministic with `ORDER BY sres.created_at ASC`. Update `internal/support/cache_store.go`, `internal/support/handler_test.go`, and `internal/support/cache_store_test.go` for the new method signature. Add handler tests that prove `?status=pending` is passed to the mock store and unsupported statuses return 400.

Second, update the app API client and query hooks. In `/home/michaelroddy/repos/project_radeon_app/src/api/client.ts`, add an exported type named `SupportOfferStatusFilter` with values `pending` and `accepted`. Change `getSupportOffers` from positional parameters to an options object while preserving existing unfiltered calls that omit `status`. The target signature should be `getSupportOffers(id: string, options?: { page?: number; limit?: number; status?: SupportOfferStatusFilter }): Promise<PaginatedResponse<SupportOffer>>`. It should include `page`, `limit`, and a `status` query parameter only when status is supplied. Keep `getSupportReplies` unchanged unless the hook needs a clearer options object later. In `src/query/queryKeys.ts`, change `supportOffers` so the key includes `{ status, limit }` but not the current page; React Query stores all pages under one key. Keep `supportReplies` keyed by request id and limit.

Third, add hooks for this screen in `src/hooks/queries/useSupport.ts`. Add `useSupportOffers(requestId: string | null, status: api.SupportOfferStatusFilter = 'pending', limit = 25, enabled = true)` using `useInfiniteQuery`. Its first page parameter is `1`, it calls `api.getSupportOffers(requestId ?? '', { page: pageParam as number, limit, status })`, and `getNextPageParam` returns `lastPage.page + 1` only when `lastPage.has_more` is true. Add `useSupportReplies(requestId: string | null, limit = 25, enabled = true)` using the existing cursor response. Its first page parameter is `undefined`, it calls `api.getSupportReplies(requestId ?? '', pageParam as string | undefined, limit)`, and `getNextPageParam` returns `lastPage.next_cursor ?? undefined`. Both hooks should use the existing `getInfiniteQueryPolicy` pattern and should be disabled when there is no request id.

Fourth, refactor `SupportRequestManagementScreen` in `src/screens/main/groups/GroupDetailScreen.tsx`. Replace the local `offers`, `replies`, and `loading` state with React Query data. Add local state for `activeManageTab`, with allowed values `offers` and `replies`, and `offerStatusFilter`, with allowed values `pending` and `accepted`. Default to `pending` for open requests and `accepted` for active or closed requests. Flatten query pages with `useMemo`. Render exactly one `FlatList` at a time: the active `Offers` tab renders `SupportOffer` rows, and the active `Replies` tab renders `SupportReply` rows. Use `ListHeaderComponent` for the request summary card, the `SegmentedControl` with badge labels from `request.offer_count` and `request.reply_count`, and the offer status filter chips when the active tab is `offers`. Use `ListFooterComponent` for the paging spinner. Use `useGuardedEndReached` to call `fetchNextPage` only when the active query has a next page and is not already fetching.

Fifth, make the row rendering clean and reusable enough for this large screen. Prefer extracting `SupportOfferRow` and `SupportReplyRow` into new files under `src/components/support/` if the management screen grows too much. `SupportOfferRow` should receive `offer`, `requestStatus`, `pending`, `onAccept`, and `onDecline`. It should show avatar, username, support type label, human status label, message, and accept/decline buttons only for pending offers when the request is open. `SupportReplyRow` should receive `reply` and render avatar, username, body, and readable created time. If extracting causes too much churn, keep small screen-specific row components near `SupportRequestManagementScreen`, but do not duplicate the row JSX inside the `FlatList.renderItem` callback.

Sixth, keep mutations and cache updates coherent. `handleAcceptOffer` should still call `api.acceptSupportOffer`, call `onChanged`, and open chat when the accepted request contains `chat_id`. After accepting, invalidate support offer queries for the request and the parent group support request queries so counts and statuses refresh. `handleDeclineOffer` should call `api.declineSupportOffer`, then invalidate support offer queries for the current request. Avoid local array mutation because React Query owns the list data after this refactor. `handleCloseRequest` should keep the existing confirmation behavior and invalidate relevant support request queries after success.

Seventh, tune empty and loading states for high-volume behavior. The initial active tab should show a centered spinner only when there are no loaded rows yet. Empty offers should say `No pending offers.` or `No accepted offers.` based on the selected filter. Empty replies should say `No replies yet.`. When `post` exists, the replies tab header should expose the existing `onOpenComments(post)` path through the `SupportRequestCard` action or a small secondary action labelled `View full discussion`; when `post` is missing, keep the existing alert explaining that replies are unavailable from this path.

## Concrete Steps

Start from the app repository and confirm a clean tree:

    cd /home/michaelroddy/repos/project_radeon_app
    git status --short

If this plan is being implemented after approval, create a feature branch in the app repository:

    git checkout main
    git pull
    git checkout -b feature/group-support-management-scaling

Then create a matching backend branch because the endpoint gains status filtering:

    cd /home/michaelroddy/repos/project_radeon
    git status --short
    git checkout main
    git pull
    git checkout -b feature/group-support-management-scaling

Make the backend status-filtering edits first. Update the handler interface, handler parsing, store query, cached store delegation, and tests in the backend repository. Run:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project_radeon_go_cache go test ./internal/support ./cmd/api

Expected result is a successful Go test run. The exact number of tests can change as the repository changes, but the command must exit with code 0 and not print failing test names.

Make the app API, query key, hook, and screen edits next in the app repository. Run:

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck

Expected result is that TypeScript exits with code 0. If TypeScript reports unused imports or mismatched query types, fix them before continuing.

For manual app validation, start the backend and Expo app in the normal way for this workspace. The backend API URL should match the device or simulator, for example `EXPO_PUBLIC_API_URL=http://192.168.0.75:8080` if testing on the same LAN:

    cd /home/michaelroddy/repos/project_radeon
    go run ./cmd/api

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

Open the app, sign in, open a group that has a support request owned by the current user, and tap `Manage`. Confirm that the manage screen shows a compact support request summary, an `Offers` tab, and a `Replies` tab. Confirm that the offers tab defaults to the correct status filter, that `Pending` and `Accepted` filters show server-filtered results, and that scrolling loads more pages when more pages exist. Confirm that accepting a pending offer still opens chat when the backend returns a `chat_id`, declining an offer removes it from the pending filter after refresh, and closing the request still works. Confirm that the replies tab loads replies in pages and can open the full discussion when a group post is available.

## Validation and Acceptance

The backend acceptance criteria are behavioral. A request owner calling `GET /support/requests/{id}/offers?status=pending&page=1&limit=25` receives only pending offers for that request and the normal paginated response shape. A request owner calling the same endpoint with `status=accepted` receives accepted offers. Calling it with no status preserves the legacy unfiltered all-offers behavior. Calling it with `status=not_selected`, `status=all`, or any other unsupported value returns HTTP 400. A user who does not own the support request must still receive HTTP 403. `GOCACHE=/tmp/project_radeon_go_cache go test ./internal/support ./cmd/api` must pass.

The app acceptance criteria are user-visible. On the group support request management screen, hundreds of offers or replies no longer appear as one stacked mixed page. Offers and replies are separated into tabs. The active list loads its next page only when the user scrolls near the bottom. The `Offers` tab shows accurate status-filtered results backed by the server, and the tab badge uses the request counts already returned by the support request object. The `Replies` tab does not block offer management and can still route the user to the public discussion when possible. `npm run typecheck` must pass.

There should be no database migration for this plan. The backend reads an existing `support_responses.status` column and adds only query filtering over it.

## Idempotence and Recovery

The implementation is additive and safe to retry. If a backend test fails after changing the `ListSupportOffers` signature, search for all old call sites with:

    cd /home/michaelroddy/repos/project_radeon
    rg -n "ListSupportOffers\\(" internal

Update each caller, mock, and test stub so the signature is consistent. If the app typecheck fails after changing `getSupportOffers`, search for old positional calls with:

    cd /home/michaelroddy/repos/project_radeon_app
    rg -n "getSupportOffers\\(" src

Convert each caller to the new options object. If the screen refactor becomes too large, pause after adding backend filtering and query hooks, update the `Progress` section with the exact remaining UI work, and leave the app compiling before stopping.

Do not use destructive git commands to recover. If a change needs to be backed out, use normal patch edits or `git diff` to inspect the touched files and undo only the lines from this task. Do not revert unrelated work.

## Artifacts and Notes

Current app evidence from the audit:

    src/screens/main/groups/GroupDetailScreen.tsx:205 starts SupportRequestManagementScreen.
    src/screens/main/groups/GroupDetailScreen.tsx:230 calls api.getSupportOffers(request.id, 1, 30).
    src/screens/main/groups/GroupDetailScreen.tsx:231 calls api.getSupportReplies(request.id, undefined, 40).
    src/screens/main/groups/GroupDetailScreen.tsx:308 renders a ScrollView.
    src/screens/main/groups/GroupDetailScreen.tsx:322 renders Replies by mapping the loaded replies array.
    src/screens/main/groups/GroupDetailScreen.tsx:342 renders Offers by mapping the loaded offers array.

Current app API evidence:

    src/api/client.ts:1765 exports getSupportOffers(id: string, page = 1, limit = 20): Promise<PaginatedResponse<SupportOffer>>.
    src/api/client.ts:1773 exports getSupportReplies(id: string, cursor?: string, limit = 20): Promise<CursorResponse<SupportReply>>.
    src/query/queryKeys.ts:163 has supportOffers keyed by request id and page params.
    src/query/queryKeys.ts:164 has supportReplies keyed by request id and limit.

Current backend evidence:

    internal/support/handler.go:593 starts Handler.ListSupportOffers.
    internal/support/handler.go:617 calls h.db.ListSupportOffers(r.Context(), requestID, params.Limit+1, params.Offset).
    internal/support/store.go:797 starts pgStore.ListSupportOffers.
    internal/support/store.go currently filters only by sres.support_request_id and orders by sres.created_at ASC.

Expected backend query shape for filtered offers after implementation:

    SELECT ...
    FROM support_responses sres
    JOIN support_requests sr ON sr.id = sres.support_request_id
    JOIN users u ON u.id = sres.responder_id
    WHERE sres.support_request_id = $1
      AND sres.status = $2
    ORDER BY sres.created_at ASC
    LIMIT $3 OFFSET $4

When no status filter is requested, the store omits the status predicate and uses `LIMIT $2 OFFSET $3`.

Expected app API shape after implementation:

    getSupportOffers(id, { page: 1, limit: 25, status: 'pending' })

Expected UI data flow after implementation:

    SupportRequestManagementScreen
      -> useSupportOffers(request.id, offerStatusFilter, 25, activeManageTab === 'offers')
      -> useSupportReplies(request.id, 25, activeManageTab === 'replies')
      -> FlatList renders only the active tab data
      -> onEndReached fetches the next page for the active query

## Interfaces and Dependencies

In `/home/michaelroddy/repos/project_radeon/internal/support/handler.go`, the `Querier` interface should expose:

    ListSupportOffers(ctx context.Context, requestID uuid.UUID, status string, limit, offset int) ([]SupportOffer, error)

In `/home/michaelroddy/repos/project_radeon/internal/support/cache_store.go`, `cachedStore.ListSupportOffers` should keep the same signature and delegate all parameters to `s.inner.ListSupportOffers`.

In `/home/michaelroddy/repos/project_radeon/internal/support/store.go`, `pgStore.ListSupportOffers` should keep the same signature and use the status string as a SQL filter where the empty string means no status filter.

In `/home/michaelroddy/repos/project_radeon_app/src/api/client.ts`, expose:

    export type SupportOfferStatusFilter = Extract<SupportOffer['status'], 'pending' | 'accepted'>;

    export interface GetSupportOffersOptions {
        page?: number;
        limit?: number;
        status?: SupportOfferStatusFilter;
    }

    export async function getSupportOffers(id: string, options?: GetSupportOffersOptions): Promise<PaginatedResponse<SupportOffer>>;

In `/home/michaelroddy/repos/project_radeon_app/src/hooks/queries/useSupport.ts`, expose:

    export function useSupportOffers(requestId: string | null, status?: api.SupportOfferStatusFilter, limit?: number, enabled?: boolean);

    export function useSupportReplies(requestId: string | null, limit?: number, enabled?: boolean);

In `/home/michaelroddy/repos/project_radeon_app/src/screens/main/groups/GroupDetailScreen.tsx`, the user-visible result should be one active paged `FlatList`, not a mixed `ScrollView`, with tabs driven by `SegmentedControl` and page loading driven by `useGuardedEndReached`.

## Revision Notes

2026-05-20 / Codex: Initial ExecPlan created from the group support request management audit. The plan includes a backend status-filtering companion change because app-only filtering would be inaccurate for large offer volumes.

2026-05-20 / Codex: Implemented the plan through backend status filtering and app paged management UI. The backend store uses separate SQL shapes for filtered and unfiltered offer lists so filtered lists do not rely on an `OR` predicate. Manual app smoke testing remains as the only unchecked validation item.

2026-05-20 / Codex: Tightened the management filters and API status query support to `pending` and `accepted` only. Unsupported query values including `all` and `not_selected` now return HTTP 400, while an omitted status still preserves the legacy unfiltered response for existing callers.

2026-05-20 / Codex: Kept the tabs in the group manage list header but changed the `Pending`/`Accepted` status selector from custom chips to the shared `SegmentedControl` section styling. The `Offers`/`Replies` control now explicitly uses the same section/secondary treatment.

2026-05-20 / Codex: Updated top-level tabs in Groups, Group detail, Group admin, Support, Meetups, Profile requests, and group support management to use Discover's page/primary segmented control style. Nested filters and scopes remain on section styling.

2026-05-20 / Codex: Removed the count badges from the group manage `Offers` and `Replies` tabs to keep the tabs cleaner.

2026-05-20 / Codex: Clarified the tab hierarchy after review. True screen-level tabs keep the Discover page/primary style. Nested controls, including group support `Feed`/`My Requests`, profile request `Incoming`/`Sent`, and status filters, use section styling.

2026-05-20 / Codex: Standardized the remaining nested main-app segmented controls. Support `Open`/`Active`/`Closed` and `All`/`Urgent`/`Unanswered` now use section/secondary styling like the other sub-tabs.

2026-05-20 / Codex: Reclassified Meetups `Discover`/`Hosting`/`Going` and Groups `Discover`/`Joined` as nested surface tabs, not app-level tabs. They now use section/secondary styling.
