# Build an In-App Notifications Inbox

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `PLANS.md` in the repository root. Keep it self-contained and update it whenever implementation decisions change.

## Purpose / Big Picture

Users should have a reliable place to see important activity even when a push notification is missed, dismissed, delayed, or disabled. After this change, a user can tap a bell icon in the app, see unread notifications such as "Laura sent you a message" or "Jack mentioned you in a comment", tap one to navigate to the relevant chat or comment, and see the unread badge clear in a predictable way. Push notifications remain a delivery channel, but the durable in-app inbox becomes the source of truth for notification history and unread state.

The feature should be performant by default. The notification list must be cursor-paginated, the unread badge must come from an O(1) summary endpoint rather than counting large tables repeatedly, chat-message noise should be grouped or cleared intelligently, and the app should refetch on foreground or explicit actions rather than polling constantly.

## Progress

- [x] (2026-04-30 06:39Z) Created this ExecPlan after confirming the app has push-tap handling but no notifications UI, and the backend already has notification storage plus `GET /notifications` and `POST /notifications/{id}/read`.
- [x] (2026-04-30 06:51Z) Implemented backend notification summary, bulk read, read-all, and transactionally maintained unread counters on branch `feature/notifications-inbox` in `/home/michaelroddy/repos/project_radeon`.
- [x] (2026-04-30 06:51Z) Added frontend notification API types/functions and React Query hooks in `/home/michaelroddy/repos/project_radeon_app`.
- [x] (2026-04-30 06:51Z) Built a full-screen notifications overlay and placed a bell icon with unread count in the app header.
- [x] (2026-04-30 06:51Z) Wired notification row taps to existing chat and mention navigation paths.
- [x] (2026-04-30 06:51Z) Added row read and mark-all-read behavior.
- [ ] Validate the full UI flow in Expo after starting the app and sending fresh chat/mention notifications.

## Surprises & Discoveries

- Observation: The backend already stores durable notifications and exposes a paginated list, but the app only registers devices and handles push taps.
    Evidence: `project_radeon/internal/notifications/handler.go` has `ListNotifications` and `MarkNotificationRead`; `src/api/client.ts` only exposes `registerPushDevice` and `markNotificationRead`.
- Observation: Chat messages and comment mentions already create notification rows; missing pushes are therefore a frontend discoverability problem plus a backend unread-summary performance problem, not a missing notification-write path.
    Evidence: `project_radeon/internal/chats/handler.go` and `project_radeon/internal/chats/ws_handler.go` call `NotifyChatMessage`; `project_radeon/internal/feed/handler.go` calls `NotifyCommentMentions` for post comment mentions.
- Observation: Notification-tap routing already exists for `chat.message` and `comment.mention`.
    Evidence: `src/notifications/NotificationProvider.tsx` converts those payloads into `intent`, and `src/navigation/AppNavigator.tsx` opens the chat or focuses the feed comments modal.
- Observation: The default Go build cache path is read-only in this execution environment, which makes `go test ./...` fail during setup even though package tests pass.
    Evidence: `go test ./...` failed with `open /home/michaelroddy/.cache/go-build/...: read-only file system`; rerunning as `GOCACHE=/tmp/go-build go test ./...` passed.
- Observation: A chat-close bug was reported while implementing this plan. The defensive close path now dismisses the keyboard, clears chat, notification, and comment overlays, and resets keyboard visibility so the app header can return normally after leaving chat.
    Evidence: `npx tsc --noEmit` passed after the `handleCloseChat` update in `src/navigation/AppNavigator.tsx`.

## Decision Log

- Decision: Build the inbox around the existing backend `notifications` table instead of creating a separate frontend-only store.
    Rationale: The backend table is durable, already receives chat and comment notification events, and can support multiple devices consistently. A local-only app inbox would lose notifications on reinstall, fail across devices, and diverge from push delivery.
    Date/Author: 2026-04-30 / Codex
- Decision: Add a summary endpoint backed by a denormalized unread counter instead of repeatedly running `COUNT(*) WHERE read_at IS NULL`.
    Rationale: Counting unread rows can remain acceptable for small data, but it becomes a hot query because the bell badge appears on every main screen. A counter row keyed by `user_id` makes badge reads constant-time and keeps the path cheap as notification history grows.
    Date/Author: 2026-04-30 / Codex
- Decision: Put the notifications entry point in the existing top bar as a bell icon rather than adding a sixth bottom tab.
    Rationale: Notifications are a global utility like the profile avatar, not a primary section like community, discover, support, meetups, or chats. A top-bar bell keeps the bottom navigation stable and gives the unread badge high visibility.
    Date/Author: 2026-04-30 / Codex
- Decision: Keep push delivery independent from read state.
    Rationale: A push can be dismissed or never delivered, but the notification row must remain available in the inbox until the user views or marks it read. Push tap handling may mark the corresponding notification read because it proves the user acted on that notification.
    Date/Author: 2026-04-30 / Codex
- Decision: Keep the bell icon in the existing top header beside the profile avatar.
    Rationale: The user explicitly confirmed this placement while implementation was underway. It keeps notifications globally visible without adding another bottom tab.
    Date/Author: 2026-04-30 / Codex
- Decision: Use `GOCACHE=/tmp/go-build` for full backend validation in this environment.
    Rationale: The default Go cache directory is read-only here, and `/tmp` is writable. This keeps validation meaningful without changing project files.
    Date/Author: 2026-04-30 / Codex

## Outcomes & Retrospective

Implementation is underway. Backend summary/read endpoints and the app inbox UI have been implemented on local feature branches. Backend tests pass with `GOCACHE=/tmp/go-build go test ./...`, and app TypeScript passes with `npx tsc --noEmit`. Remaining validation is a manual Expo flow with fresh chat and mention notifications.

## Context and Orientation

There are two repositories involved.

The mobile app lives at `/home/michaelroddy/repos/project_radeon_app`. It is a React Native and Expo app. All API calls belong in `src/api/client.ts`. Query keys live in `src/query/queryKeys.ts`. Existing query hooks live in `src/hooks/queries/`. The authenticated app shell lives in `src/navigation/AppNavigator.tsx`. Push registration and push-tap handling live in `src/notifications/NotificationProvider.tsx`. The app already routes `chat.message` pushes into `ChatScreen` and `comment.mention` pushes into the feed comments modal.

The backend lives at `/home/michaelroddy/repos/project_radeon`. It is a Go API using chi, pgx, PostgreSQL, and raw SQL. The notifications package lives in `internal/notifications/`. Routes are registered in `cmd/api/main.go`. Database migrations live in `migrations/`. The backend response shape is an envelope: successful responses are `{"data": ...}` and errors are `{"error": "..."}`.

A notification is a durable database row describing something a user should notice. A push notification is a delivery attempt to a device. These are different: the inbox shows notification rows; Expo push delivery sends some of those rows to a device. A notification is unread when its `read_at` column is null.

The existing backend notification schema in `migrations/019_notifications.sql` contains `notifications`, `notification_deliveries`, `user_devices`, and `notification_preferences`. The existing indexes include `idx_notifications_user_id_created_at` for pagination and `idx_notifications_user_id_unread` for unread rows. The `notifications` table currently stores `id`, `user_id`, `type`, `actor_id`, `resource_type`, `resource_id`, `title`, `body`, `payload`, `created_at`, and `read_at`.

The existing backend routes are:

    POST /notifications/devices
    DELETE /notifications/devices/{id}
    GET /notifications
    POST /notifications/{id}/read
    GET /notifications/preferences
    PATCH /notifications/preferences

The existing mobile app only exposes:

    registerPushDevice(data)
    markNotificationRead(id)

in `src/api/client.ts`. It does not expose `GET /notifications`, and it has no notifications screen.

## Plan of Work

First, implement the backend performance foundation. Add a new migration in `/home/michaelroddy/repos/project_radeon/migrations/` that creates `notification_counters` with `user_id` as the primary key, `unread_count integer not null default 0`, and `updated_at timestamptz not null default now()`. Backfill it from existing unread notification rows using `INSERT INTO notification_counters (user_id, unread_count) SELECT user_id, COUNT(*) FROM notifications WHERE read_at IS NULL GROUP BY user_id ON CONFLICT (user_id) DO UPDATE SET unread_count = EXCLUDED.unread_count, updated_at = NOW()`. This migration is additive and safe to run after existing deployments.

In the backend notifications package, add a `NotificationSummary` type with `UnreadCount int json:"unread_count"`. Extend `Store` in `internal/notifications/types.go` with `GetSummary(ctx, userID uuid.UUID) (*NotificationSummary, error)`, `MarkNotificationsRead(ctx, userID uuid.UUID, notificationIDs []uuid.UUID, readAt time.Time) (int, error)`, and `MarkAllNotificationsRead(ctx, userID uuid.UUID, readAt time.Time) (int, error)`. Keep the existing `MarkNotificationRead` method for compatibility, but implement it through the bulk helper so counter updates stay centralized.

In `internal/notifications/store.go`, update notification creation functions so they increment `notification_counters` in the same transaction that inserts notification rows. `CreateChatMessageNotifications` and `CreateCommentMentionNotifications` should call a helper such as `incrementUnreadCounter(ctx, tx, userID, 1)` after inserting a notification for a recipient. The helper should upsert one counter row with `unread_count = notification_counters.unread_count + $2`.

Implement read operations so counters never go below zero and only decrement for rows that were unread before the update. The safest pattern is to update rows in a common table expression and count the changed rows:

    WITH updated AS (
        UPDATE notifications
        SET read_at = COALESCE(read_at, $3)
        WHERE user_id = $1
          AND id = ANY($2::uuid[])
          AND read_at IS NULL
        RETURNING id
    )
    SELECT COUNT(*) FROM updated

Then decrement the counter by that count using `GREATEST(unread_count - count, 0)`. For mark-all-read, update all unread rows for that user and set the counter to zero in the same transaction. This makes repeated calls idempotent.

Add backend handlers in `internal/notifications/handler.go`: `GetSummary`, `MarkNotificationsRead`, and `MarkAllNotificationsRead`. Register routes in `cmd/api/main.go`:

    GET /notifications/summary
    POST /notifications/read
    POST /notifications/read-all

The bulk read body should be:

    {"notification_ids":["uuid-1","uuid-2"]}

The response should be:

    {"read": true, "updated": 2}

Keep `POST /notifications/{id}/read` working by delegating to the same service method.

Next, implement frontend API support. In `src/api/client.ts`, define interfaces `NotificationItem`, `NotificationSummary`, and `NotificationPayload`. Use `unknown` for payload values that are not guaranteed to be strings, then narrow in the UI. Add:

    getNotifications(params?: { before?: string | null; limit?: number }): Promise<CursorResponse<NotificationItem>>
    getNotificationSummary(): Promise<NotificationSummary>
    markNotificationsRead(ids: string[]): Promise<{ read: boolean; updated: number }>
    markAllNotificationsRead(): Promise<{ read: boolean; updated: number }>

Preserve `markNotificationRead(id)` as a convenience wrapper or keep the existing route call.

Add query keys in `src/query/queryKeys.ts`:

    notifications: () => ['notifications'] as const
    notificationSummary: () => ['notification-summary'] as const

Add hooks in `src/hooks/queries/useNotifications.ts` and `src/hooks/queries/useNotificationSummary.ts`. Use `useInfiniteQuery` for the list with a page size of 20, and use `useQuery` for the summary. Use the app's existing query policy patterns. The summary should be enabled only when the authenticated app shell is mounted. Refetch the summary when the app returns to foreground, when a notification is marked read, and after push-tap handling marks a notification read.

Build a reusable notifications screen in `src/screens/main/NotificationsScreen.tsx`. This screen should be a full-screen overlay, similar to chat or profile overlays, so it can be opened from the top bar without becoming a bottom tab. It should show a `ScreenHeader` with title `Notifications`, a close button, a mark-all-read action when unread items exist, a `FlatList`, pull-to-refresh, infinite scroll, loading and empty states. Use existing theme tokens from `src/theme` and shared components such as `Avatar`, `EmptyState`, and `ScreenHeader`. Do not hardcode colors or magic spacing outside one-off layout values.

Notification rows should be dense and scan-friendly. Use the notification `title` and `body` from the backend, plus a relative timestamp. For `chat.message`, show a chat bubble icon or sender avatar if the actor can be hydrated cheaply later; for v1, use `Avatar` with `title` as username when `title` is a sender username. For `comment.mention`, show a mention/comment icon and text such as `@jack.taylor mentioned you`. Unread rows should have a small red dot or stronger text weight. Avoid placing the entire row in a decorative card; the inbox is an operational list.

Wire the screen into `src/navigation/AppNavigator.tsx`. Add `notificationsOpen` state, include it in overlay checks, and render `NotificationsScreen` as an absolute-fill overlay. Add a bell icon button in the existing top bar next to the avatar. The bell button should show a red unread badge when `notificationSummary.unread_count > 0`, capped at `99+`. The badge should use `Colors.danger`, `Colors.textOn.danger`, and `Radius.pill`.

Tapping a notification row should mark that notification read and navigate using the same semantics as push taps. For `chat.message`, read `chat_id` from `payload`, call `api.getChat(chatId)`, set the active tab to `chats`, close the notifications overlay, and open `ChatScreen`. For `comment.mention`, read `post_id` and optional `comment_id` from `payload`, close the overlay, set the active tab to `community`, and set `feedFocusRequest` with a fresh nonce. The `feedFocusRequest` consumption logic added in `src/screens/main/FeedScreen.tsx` should prevent the comments modal from reopening after close.

Update `NotificationProvider` so when push taps mark a notification read, it also invalidates `notificationSummary` and `notifications` queries. The provider currently does not import the query client; either import the shared `queryClient` from `src/query/queryClient.ts` or expose a small helper in a notifications utility. Keep the provider focused on push registration and intent conversion.

Handle chat unread notifications carefully. Chats already have `unread_count` in the Chats screen and opening a chat marks the chat read. The notifications inbox should still show chat-message notification rows because a user may miss a push and want a single history of activity. When a chat notification is tapped, mark the tapped notification read immediately. As a later enhancement, opening a chat can bulk-mark all unread `chat.message` notifications for that `chat_id` by adding a backend endpoint such as `POST /notifications/resource/read` with body `{"type":"chat.message","resource_type":"chat","resource_id":"..."}`. Do not block v1 on this enhancement; row-level read is enough to make the inbox useful.

Add tests at the backend level. In `internal/notifications`, add tests for summary count, increment on chat notification creation, decrement on mark-read, idempotent repeated mark-read, and mark-all-read. If the existing package does not have test infrastructure for a real database, add focused unit tests around service behavior with a fake store, and add SQL integration tests only if a test database pattern already exists. In the frontend, there is no configured test runner, so validation is TypeScript plus manual Expo scenarios.

## Concrete Steps

Start with the backend:

    cd /home/michaelroddy/repos/project_radeon
    git checkout main
    git pull --ff-only origin main
    git checkout -b feature/notifications-inbox-backend

Create a migration named with the next sequence number after the current highest migration, for example `migrations/054_notification_counters.sql` if `053_...` is still the latest. Do not edit previous migrations. Apply locally with:

    make migrate

If `make migrate` only applies `001_bootstrap.sql` in this repository, run the new migration manually against the local database using:

    psql "$DATABASE_URL" -f migrations/054_notification_counters.sql

Then update backend types, store, service, handler, and route registration. Run:

    gofmt -w internal/notifications cmd/api/main.go
    go test ./internal/notifications ./internal/chats ./internal/feed
    go test ./...

Expected result is all tests passing. If there are unrelated pre-existing failures, record the exact failures in this ExecPlan before proceeding.

Then implement the app:

    cd /home/michaelroddy/repos/project_radeon_app
    git checkout main
    git pull --ff-only origin main
    git checkout -b feature/notifications-inbox

Add API functions and query hooks first. Run:

    npx tsc --noEmit

Then add `NotificationsScreen`, wire it into `AppNavigator`, and run the same TypeScript command again.

Start both services for manual validation:

    cd /home/michaelroddy/repos/project_radeon
    make run

In another terminal:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

Log in as `test@radeon.dev / password123` or another seeded user. Trigger a chat message and a comment mention from a second account or Postman. Confirm the bell badge increments, the notification appears in the inbox, tapping it routes correctly, and the unread count decreases.

Useful Postman or curl checks:

    GET http://localhost:8080/notifications/summary
    Authorization: Bearer <token>

Expected response:

    {"data":{"unread_count":1}}

    GET http://localhost:8080/notifications?limit=20
    Authorization: Bearer <token>

Expected response shape:

    {"data":{"items":[{"id":"...","type":"comment.mention","read_at":null,"payload":{"post_id":"..."}}],"limit":20,"has_more":false}}

    POST http://localhost:8080/notifications/read
    Authorization: Bearer <token>
    Content-Type: application/json

    {"notification_ids":["..."]}

Expected response:

    {"data":{"read":true,"updated":1}}

## Validation and Acceptance

Backend acceptance:

After creating a notification row for a user through the existing chat or comment mention paths, `GET /notifications/summary` returns an unread count greater than zero for that user. After `POST /notifications/{id}/read`, the same summary count decreases by one. Repeating the same mark-read request does not decrease the count again. After `POST /notifications/read-all`, summary returns zero and the list shows `read_at` values on previously unread rows.

Frontend acceptance:

After logging into the app, the top bar shows a bell icon beside the profile avatar. If unread notifications exist, the bell shows a red count badge capped at `99+`. Tapping the bell opens a full-screen Notifications view. Pull-to-refresh reloads the first page. Scrolling loads older pages when `has_more` is true. Tapping a chat notification closes the inbox and opens the chat. Tapping a mention notification closes the inbox and opens the feed comments modal for the mentioned post. Closing that comments modal does not reopen it.

Push acceptance:

When a push notification is received and tapped, existing push-tap routing still works. If the push includes `notification_id`, the backend marks it read and the bell badge refreshes. If a user dismisses a push without tapping it, the notification remains unread in the inbox.

Performance acceptance:

The bell badge must not fetch the full notification list. It must call `GET /notifications/summary`. `GET /notifications` must remain cursor-paginated and must not use offset pagination. Backend unread count updates must happen transactionally with notification creation and read operations. The list page size should default to 20 and cap at 50, matching existing backend pagination.

Run these commands before considering the feature done:

    cd /home/michaelroddy/repos/project_radeon
    go test ./...

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

## Idempotence and Recovery

The migration is additive. Re-running it should be safe because it uses `CREATE TABLE IF NOT EXISTS` and upserts the counter backfill. Read endpoints are idempotent because they only decrement counters for rows that were unread before the request. Mark-all-read is idempotent because the second call updates zero unread rows and leaves the counter at zero.

If counter data drifts during development, recover by re-running the backfill statement:

    INSERT INTO notification_counters (user_id, unread_count, updated_at)
    SELECT user_id, COUNT(*)::int, NOW()
    FROM notifications
    WHERE read_at IS NULL
    GROUP BY user_id
    ON CONFLICT (user_id) DO UPDATE
    SET unread_count = EXCLUDED.unread_count,
        updated_at = NOW();

If the app list cache shows stale data after marking read, invalidate both `queryKeys.notifications()` and `queryKeys.notificationSummary()`. If a notification payload is missing the required target ID, mark it read but show a user-facing alert such as `This notification can no longer be opened.`

## Artifacts and Notes

Existing notification routes in the backend:

    GET /notifications
    POST /notifications/{id}/read

Existing app push payload handling:

    chat.message -> { kind: 'chat', chatId, notificationId }
    comment.mention -> { kind: 'mention', postId, commentId, notificationId }

Current gap:

    The app has no `getNotifications`, no `getNotificationSummary`, no notifications query hooks, and no notifications screen.

Known limitation to address later:

    Reshare comment mentions are currently stored as mentions but do not send push or notification rows from `AddFeedItemComment` because notification sending is guarded by `itemKind == FeedItemKindPost`. This inbox plan should not hide that limitation. A follow-up can support `comment.mention` on reshare comments by adding payload fields for `item_kind` and `share_id` and teaching app navigation how to open reshare comment threads.

## Interfaces and Dependencies

Backend new types in `/home/michaelroddy/repos/project_radeon/internal/notifications/types.go`:

    type NotificationSummary struct {
        UnreadCount int `json:"unread_count"`
    }

    type BulkReadResult struct {
        Read    bool `json:"read"`
        Updated int  `json:"updated"`
    }

Backend new service methods in `/home/michaelroddy/repos/project_radeon/internal/notifications/service.go`:

    func (s *Service) GetSummary(ctx context.Context, userID uuid.UUID) (*NotificationSummary, error)
    func (s *Service) MarkNotificationsRead(ctx context.Context, userID uuid.UUID, notificationIDs []uuid.UUID) (*BulkReadResult, error)
    func (s *Service) MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID) (*BulkReadResult, error)

Frontend new API interfaces in `/home/michaelroddy/repos/project_radeon_app/src/api/client.ts`:

    export interface NotificationItem {
        id: string;
        user_id: string;
        type: 'chat.message' | 'comment.mention' | string;
        actor_id?: string | null;
        resource_type: string;
        resource_id?: string | null;
        title: string;
        body: string;
        payload: Record<string, unknown>;
        created_at: string;
        read_at?: string | null;
    }

    export interface NotificationSummary {
        unread_count: number;
    }

Frontend new screen:

    src/screens/main/NotificationsScreen.tsx

Its props should be:

    interface NotificationsScreenProps {
        isActive: boolean;
        currentUser: api.User;
        onBack: () => void;
        onOpenChat: (chat: api.Chat) => void;
        onOpenMention: (target: { postId: string; commentId?: string }) => void;
    }

The `currentUser` prop is included for consistency with other authenticated screens, even if v1 only needs it for future actor display. `onOpenChat` and `onOpenMention` keep navigation ownership inside `AppNavigator`, matching the app's callback-based navigation pattern.

## Revision Notes

- 2026-04-30 06:39Z: Initial ExecPlan created. It captures the existing backend notification foundation, the missing frontend inbox, and a performance-oriented design using cursor pagination plus a denormalized unread counter.
- 2026-04-30 06:51Z: Updated progress after implementing backend counters/endpoints, frontend hooks, the header bell badge, notifications overlay, row navigation, and read behavior. Added the chat-close bug fix and validation notes discovered during implementation.
