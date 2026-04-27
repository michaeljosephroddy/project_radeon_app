# Production-Grade Websocket Chat Messaging Migration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`. The backend repository at `/home/michaelroddy/repos/project_radeon` also contains a `PLANS.md` file with the same operating standard, and implementation work in that repository should follow the same rules.

## Purpose / Big Picture

Today the app’s chat experience is driven by REST requests for the chat list, message history, sending a message, and marking a thread as read. That is functional, but it will not feel seamless enough for a production social app once traffic grows, users expect instant delivery, and multiple devices or background push delivery enter the picture. After this change, a user should be able to open a chat, receive messages live, send a message with immediate acknowledgement, see unread counts and support-chat state update live, recover cleanly after temporary network loss, and still load history and older messages efficiently. The proof will be visible in a local end-to-end run: open the app on two simulators or devices, send a chat message on one, watch it appear on the other without refresh, then disable and restore network and confirm the thread converges automatically without duplicates.

The key design decision in this plan is that “replace the current REST API” does not mean “move every chat read to websocket.” A production chat stack for this app should use a hybrid model. Websocket is the live event transport for deltas such as new messages, read receipts, typing, chat summary updates, and support-chat status transitions. HTTP remains the cold-start and history transport for the initial chat list, initial thread fetch, older message pagination, and media upload. That is how the best consumer messaging products stay fast, resilient, and debuggable.

## Progress

- [x] (2026-04-27 10:32Z) Audited the current Expo chat flow in `src/api/client.ts`, `src/hooks/queries/useChats.ts`, `src/hooks/queries/useChatMessages.ts`, `src/screens/main/chat/useChatThreadController.ts`, `src/screens/main/ChatScreen.tsx`, and `src/screens/main/ChatsScreen.tsx`.
- [x] (2026-04-27 10:41Z) Audited the current Go chat stack in `/home/michaelroddy/repos/project_radeon/cmd/api/main.go`, `/home/michaelroddy/repos/project_radeon/internal/chats/handler.go`, `/home/michaelroddy/repos/project_radeon/internal/chats/store.go`, and the schema references in `/home/michaelroddy/repos/project_radeon/project_radeon_db_schema.sql`.
- [x] (2026-04-27 10:56Z) Authored this ExecPlan with a production-grade websocket architecture, migration phases, validation plan, and rollout guidance. No code has been executed against either repository.
- [x] (2026-04-27 11:08Z) Updated the approved architecture to add explicit non-goals for v1 and to standardize the chat list from page/offset pagination to cursor pagination during the migration.
- [ ] Create implementation branches in both repositories and begin Milestone 1.
- [ ] Implement backend websocket foundation, persistence changes, and server-side event fanout.
- [ ] Implement shared Expo realtime transport, reconnect/resume behavior, and chat-list live updates.
- [ ] Migrate active chat thread send/receive/read flows to the realtime path while preserving HTTP bootstrap and pagination.
- [ ] Validate end-to-end behavior, measure delivery latency and reconnect recovery, and complete rollout hardening.

## Surprises & Discoveries

- Observation: The current mobile client is already structured around a strong seam for transport replacement.
    Evidence: `src/screens/main/chat/useChatThreadController.ts` already owns optimistic sends, cache patching, read sync, message reload, and pagination boundaries. That means the websocket transport can be introduced behind this hook without rewriting the screen tree.

- Observation: The current backend chat flow already includes support-chat state and notification hooks, which makes a generic “new message only” websocket design insufficient.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/chats/handler.go` uses a `Notifier` for `NotifyChatMessage` and `MarkChatRead`, and chat payloads include support-specific status such as `pending_requester_acceptance`, `accepted`, and `declined`.

- Observation: The current durable store is sufficient to remain the source of truth; the realtime system does not need a second message database.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/chats/store.go` already persists `messages`, joins `chat_members`, computes unread counts, and fetches ordered history. The websocket layer should wrap that store rather than replace it.

- Observation: The backend currently serves chat list pagination by page/offset but thread history by cursor timestamp, which means the realtime migration must tolerate two pagination shapes during rollout.
    Evidence: `getChats()` in `src/api/client.ts` uses page numbers, while `getMessages()` uses `before` timestamps and `next_before`.

## Decision Log

- Decision: Keep HTTP for initial chat list fetch, initial thread bootstrap, older message pagination, and media upload; use websocket for live chat deltas.
    Rationale: Production messaging systems are strongest when websocket carries live incremental state while HTTP remains the bootstrap and recovery path. This keeps reconnect logic safe and makes older history paging much simpler.
    Date/Author: 2026-04-27 / Codex

- Decision: Introduce client-generated idempotency keys and a per-chat monotonic sequence number before moving send operations to websocket.
    Rationale: Duplicate sends and out-of-order delivery are the most common failure modes in mobile realtime chat. A `client_message_id` plus a server-assigned `chat_seq` gives safe dedupe and stable ordering.
    Date/Author: 2026-04-27 / Codex

- Decision: Use one authenticated websocket connection per logged-in device session rather than one socket per chat.
    Rationale: A single multiplexed connection is more battery-efficient, easier to manage on mobile, and supports global unread-count and chat-list updates.
    Date/Author: 2026-04-27 / Codex

- Decision: For cross-instance realtime fanout, start with Redis pub/sub rather than a heavier event bus.
    Rationale: The backend already has Redis cache wiring in `cmd/api/main.go`. Reusing Redis for short-lived realtime fanout is operationally simpler than introducing Kafka or NATS at the first production rollout.
    Date/Author: 2026-04-27 / Codex

- Decision: Standardize the chat list from page/offset pagination to cursor pagination as part of this migration.
    Rationale: The thread history path already uses cursors, and websocket resume logic becomes easier to reason about when both list and thread backfill use monotonic cursors rather than mixing offsets and timestamps.
    Date/Author: 2026-04-27 / Codex

- Decision: Treat typing indicators and lightweight presence as ephemeral, in-memory state rather than durable relational data.
    Rationale: Typing state is a volatile UX hint. Persisting it to Postgres adds load and complexity without improving correctness.
    Date/Author: 2026-04-27 / Codex

- Decision: Do not build full global online presence in the first websocket release.
    Rationale: The product requirement is seamless messaging, not generalized presence. Chat delivery, read receipts, and reconnect behavior are more important and materially harder.
    Date/Author: 2026-04-27 / Codex

## Outcomes & Retrospective

At this stage the outcome is a complete implementation design, not a code change. The main success is that the design is grounded in the actual seams and constraints of both repositories rather than a generic websocket tutorial. The remaining work is full execution. The most important lesson from the research phase is that this app is already close to a workable migration boundary: the client’s `useChatThreadController` and the backend’s `internal/chats` package provide clear insertion points for a realtime layer without destabilizing the broader app.

## Context and Orientation

There are two repositories involved in this plan.

The frontend repository is `/home/michaelroddy/repos/project_radeon_app`. It is an Expo and React Native app. Chat transport currently lives in `src/api/client.ts`, query hooks in `src/hooks/queries/useChats.ts` and `src/hooks/queries/useChatMessages.ts`, thread state orchestration in `src/screens/main/chat/useChatThreadController.ts`, the thread UI in `src/screens/main/ChatScreen.tsx`, and the chat list UI in `src/screens/main/ChatsScreen.tsx`. React Query is the client cache layer. An “optimistic send” means the app inserts a temporary message locally before the server confirms success.

The backend repository is `/home/michaelroddy/repos/project_radeon`. It is a Go API server. Routes are wired in `cmd/api/main.go`. Chat HTTP handlers live in `internal/chats/handler.go`, and the primary Postgres store lives in `internal/chats/store.go`. The schema already contains `chats`, `chat_members`, and `messages`, and chat notifications are already integrated via the `Notifier` interface passed to `chats.NewHandlerWithNotifier(...)`.

The app already supports support-chat flows in which a conversation can be pending requester acceptance, accepted, declined, or closed. Those states affect whether a message can be sent. Any websocket design that ignores support-chat state would be incomplete for this codebase.

The term “resume” in this document means reconnecting a websocket and asking the server to replay recent missed events instead of forcing the app to guess what changed. The term “idempotent” means that if the client retries the same send command after a connection failure, the server must not create a duplicate message. The term “fanout” means sending one server event to every device session that should see it.

This first production websocket release has explicit non-goals. It will not send attachments over websocket; attachments will continue to upload over HTTP and be referenced from durable message records later if that feature is added. It will not add global “online now” or platform-wide presence indicators; only chat-scoped connection and typing hints are in scope. It will not add message editing or deletion synchronization across devices. Those features would complicate ordering, replay, and moderation behavior and are intentionally excluded from the first rollout.

## Plan of Work

The work begins in the backend repository because the client must not ship a realtime transport without a deterministic server protocol. In `/home/michaelroddy/repos/project_radeon/internal/chats`, add a websocket-specific service layer rather than bloating the existing REST handler. Create a websocket upgrade handler, a local connection registry keyed by authenticated user, a protocol package or file that defines command and event payloads, and a chat realtime service that persists durable writes before publishing transient events. Keep the current REST routes intact. Add one new protected route such as `/ws` or `/realtime` in `/home/michaelroddy/repos/project_radeon/cmd/api/main.go`, and wire it through the same auth middleware path the REST routes already use. Do not add a second persistence store for messages. Extend the existing Postgres schema instead.

The first backend schema change is to support safe dedupe and stable ordering. Add a nullable or required `client_message_id` column to `messages` for client-generated send identifiers, and add a monotonic `chat_seq` column that increases within a single chat. The server will assign `chat_seq`. Add a unique index on `(chat_id, client_message_id)` and a unique index on `(chat_id, chat_seq)`. Update `internal/chats/store.go` so message insertion accepts the client id, allocates the next chat sequence atomically inside the same transaction, and returns both the durable `message_id` and the `chat_seq`. This will allow the sender to reconcile the optimistic row and all clients to sort messages deterministically.

At the same time, standardize the chat list pagination path to cursor pagination. Today `GET /chats` uses page/offset while `GET /chats/{id}/messages` already uses a backward cursor named `before`. Change the chat list route and store so it accepts an optional cursor such as `before` or `cursor`, orders chats by `COALESCE(last_message_at, created_at) DESC`, and returns a cursor-based envelope instead of page numbers. The frontend query hook in `src/hooks/queries/useChats.ts` must migrate to the same cursor semantics. This keeps all chat backfill flows aligned and reduces complexity when a reconnect requires the app to resync list state.

The websocket protocol should be explicit and versioned. The server must accept commands named `resume`, `subscribe_chat`, `unsubscribe_chat`, `send_message`, `mark_read`, `typing_start`, and `typing_stop`. The server must emit `connection.ready`, `chat.message.created`, `chat.message.ack`, `chat.message.failed`, `chat.read.updated`, `chat.typing.started`, `chat.typing.stopped`, `chat.summary.updated`, `chat.status.updated`, `system.heartbeat`, and `system.resync_required`. Every event must include an `event_id`, `occurred_at`, `type`, and a cursor the client can store for replay. `chat.message.created` must include the server `message_id`, `chat_seq`, `chat_id`, sender identity, message body, and sent timestamp. `chat.message.ack` must include the original `client_message_id` so the sender can replace the optimistic row.

The server must use Redis pub/sub for cross-instance fanout. `cmd/api/main.go` already initializes Redis cache configuration, so extend that runtime setup to construct a dedicated realtime pub/sub component using the same Redis address and credentials. When a durable message insert succeeds, publish a lightweight internal event containing the target chat, target users, message payload, and summary updates. Each app node will receive the pub/sub event and deliver it only to locally connected sockets for the affected users. Typing indicators and ephemeral presence should use the same pub/sub path but must not touch Postgres.

Reconnect behavior must be designed before the client transport exists. The backend needs a small replay strategy. For the first production version, do not build a full durable event store if it is not necessary. Instead, maintain a bounded in-memory or Redis-backed replay buffer of recent event envelopes keyed by user or chat stream cursor. On reconnect, the client sends its last seen cursor. If the gap is still inside the replay window, replay the missed events. If the gap is too large, emit `system.resync_required`, after which the client will refetch the chat list and current thread over HTTP. This keeps the realtime path efficient while preserving correctness.

On the frontend, add a shared realtime transport instead of embedding websocket behavior inside `ChatScreen`. Create a module such as `src/realtime/chatSocket.ts` to own connect, disconnect, authenticate, heartbeat, backoff, and resume logic. Add a companion event dispatcher module such as `src/realtime/chatEvents.ts` to decode server events into React Query cache updates. Keep the socket singleton scoped to the authenticated app session so there is one connection per device session, not one per screen.

The first frontend integration should target the chat list before the active thread send path. `src/hooks/queries/useChats.ts` and `src/screens/main/ChatsScreen.tsx` already consume a query cache that can be patched incrementally. Use websocket events to update `last_message`, `last_message_at`, `unread_count`, support-chat pending badges, and list ordering. The list should move the active chat to the front on `chat.summary.updated` and `chat.message.created` without refetching all chat pages.

After live list updates are stable, integrate the active thread. `src/screens/main/chat/useChatThreadController.ts` should remain the orchestration seam. Replace its direct `api.sendMessage(...)` path with a realtime command sender that generates a `client_message_id`, appends an optimistic message, and waits for either `chat.message.ack` or `chat.message.failed`. Keep `useChatMessages()` and `getMessages()` for the initial thread bootstrap and older-message pagination. That means a user still fetches the last fifty messages by HTTP on first open, but every new message after the socket is connected arrives live.

Read-state behavior should also migrate into the realtime path. The controller already tracks `otherUserLastReadMessageId` and performs best-effort read sync. Replace the `api.markChatRead(...)` POST path with a debounced websocket `mark_read` command carrying the newest visible `message_id`. The server must ignore regressions and only advance read state. When the server persists it, emit `chat.read.updated` to the relevant members and `chat.summary.updated` for unread count changes. This should update both the active thread and the chat list.

Typing indicators should be added only after send, receive, and read flows are correct. In `ChatScreen`, emit `typing_start` after the input becomes non-empty, throttle repeats aggressively, and emit `typing_stop` on blur, clear, or send. The server should expire typing state automatically after a short timeout even if a client disappears mid-type. The client should display typing only for the active thread.

Support-chat state changes must be first-class realtime events. `ChatScreen` already branches on `pending_requester_acceptance`, `accepted`, and `declined`. When `acceptSupportChat(...)` or `declineSupportChat(...)` completes, or when a support request is closed elsewhere, the backend must emit `chat.status.updated`. The client must patch the thread header card, send gating, pending badge in `ChatsScreen`, and any cached chat summary. A thread in a non-sendable state must reject `send_message` commands at the server and respond with `chat.message.failed` describing the reason.

The final production pass is hardening, not feature invention. Add rate limits for websocket message sends, guardrails on maximum message body size, connection count limits per user, heartbeat timeout and dead-connection cleanup, and structured logs with `user_id`, `chat_id`, `message_id`, `client_message_id`, `connection_id`, and event cursor. Add metrics for send latency, connection count, reconnect frequency, replay success rate, resync-required rate, duplicate-send suppression, and message fanout latency.

## Milestones

### Milestone 1: Backend protocol, cursor pagination, schema, and local websocket service foundation

At the end of this milestone, the backend still serves the same chat functionality over HTTP, but the chat list endpoint has been standardized to cursor pagination, the websocket endpoint exists, and the database has the fields needed for idempotent realtime messaging. No mobile UI needs to switch yet. The proof is that a developer can start the Go API, connect a test websocket client with a valid auth token, receive `connection.ready`, send a `resume` command without error, and fetch chat list pages through the new cursor contract. The schema migration must also be present and the backend test suite must pass.

The work in this milestone lives entirely in `/home/michaelroddy/repos/project_radeon`. Extend `internal/chats/store.go` to support `client_message_id` and `chat_seq`, create websocket protocol structs under `internal/chats`, add Redis-backed pub/sub fanout and a local connection registry, and register the new route in `cmd/api/main.go`. Keep HTTP handlers unchanged except for using the new store signatures where needed.

### Milestone 2: Live chat-list updates and reconnect/resume in the Expo app

At the end of this milestone, the Expo app connects one websocket after login and uses live events to update chat list previews, ordering, unread counts, and support-chat badges. Message sending from the active thread can still use REST at this point. The proof is that two app sessions can stay on the chat list screen, a new REST-sent message appears on both chat lists live, and reconnect after a short network interruption replays the missed summary updates.

The work spans `src/api/client.ts` only for type additions, new realtime modules under `src/realtime`, and cache patching in `src/hooks/queries/useChats.ts` or adjacent helpers. `src/screens/main/ChatsScreen.tsx` should need very little UI code beyond consuming already-patched query data.

### Milestone 3: Active thread live receive, websocket send, and read receipts

At the end of this milestone, the active thread is production-real-time. Opening a thread still uses HTTP to fetch the latest history and older pagination still works over HTTP, but new messages arrive live over the socket, sends go through websocket with optimistic ack/fail reconciliation, and read receipts update live. The proof is that two devices in the same chat can exchange messages without refresh, one device can kill and restore network, and after reconnect both sides converge on the same thread contents with no duplicate visible messages.

This milestone updates `src/screens/main/chat/useChatThreadController.ts`, `src/screens/main/ChatScreen.tsx`, the backend websocket send/read handlers, and the replay/resync behavior. It also updates tests on both sides.

### Milestone 4: Support-chat realtime correctness, typing indicators, and production hardening

At the end of this milestone, support-chat accept/decline/close state propagates live, typing indicators behave like a modern consumer chat app, and observability and failure handling are good enough for staged production rollout. The proof is that a support requester sees the thread unlock immediately after acceptance, typing indicators appear and clear correctly, and metrics/logging show expected values during manual testing.

This milestone finalizes rollout safety, including push-notification coexistence, connection limits, rate limiting, and alerting thresholds.

## Concrete Steps

The commands below are the exact commands that should be used during implementation. They are organized by repository because this plan spans two working trees.

In the backend repository:

    cd /home/michaelroddy/repos/project_radeon
    git checkout -b codex/websocket-chat-foundation

Inspect current chat package before editing:

    rg -n "type Handler|SendMessage|GetMessages|MarkRead|NotifyChatMessage" internal/chats cmd/api/main.go

Run backend tests before any changes:

    go test ./...

Apply the cursor-pagination contract changes for `GET /chats`, then apply schema migration, websocket handler, pub/sub fanout, and store changes. After those edits, rerun:

    go test ./...

Expected outcome at this stage:

    ok   github.com/project_radeon/api/internal/chats   ...
    ok   github.com/project_radeon/api/internal/support ...
    ok   github.com/project_radeon/api/...              ...

Start the API locally:

    go run ./cmd/api

Expected log excerpt:

    connected to database
    connected to redis cache
    project_radeon api running on :8080

In the frontend repository:

    cd /home/michaelroddy/repos/project_radeon_app
    git checkout -b codex/websocket-chat-client

Run the existing typecheck before edits:

    npx tsc --noEmit

After adding the realtime transport and controller integration, rerun:

    npx tsc --noEmit

Start the app:

    npx expo start

Open two clients against the same local backend, sign in with two accounts, open the same chat thread, and validate live send/receive/read behavior.

If the backend websocket endpoint uses a direct URL like `/ws`, the mobile socket module must build it from `EXPO_PUBLIC_API_URL` by converting `http://` to `ws://` and `https://` to `wss://`.

## Validation and Acceptance

Acceptance is behavioral, not structural.

First validate the backend in isolation. The `GET /chats` route must return cursor-based pages ordered by most recent activity and must not rely on page numbers anymore. A websocket client connected with a valid bearer token must receive `connection.ready`. Sending a `resume` command with no previous cursor must succeed. Sending `send_message` with a valid `chat_id` and `client_message_id` must produce a durable database row and emit `chat.message.ack` to the sender and `chat.message.created` to chat members. Repeating the same `client_message_id` must not create a duplicate row.

Then validate the app end to end. Use two app sessions logged into different accounts. Open the same direct chat. When user A sends a message, user A must see the optimistic bubble become durable without flicker, and user B must see the message appear without refresh. Returning to the chat list on user B must show the updated last-message preview and unread count. Opening the thread on user B must clear unread count and update user A’s read state live.

Then validate reconnect correctness. With both clients open to the same thread, disable networking on one device long enough to miss at least one message, then restore connectivity. The app must reconnect automatically. If the replay buffer can satisfy the gap, the missed message must appear without a full thread reload. If the gap exceeds replay retention, the app may resync through HTTP, but the visible result must still converge on the correct thread contents with no duplicates and no permanently stuck optimistic row.

Then validate support-chat state. Use a support-generated chat where the requester must accept before replying. The requester must see `chat.status.updated` unlock the thread immediately after acceptance, and the responder must see the pending badge clear in the chat list without refresh. Declined or closed support chats must reject sends.

Performance acceptance should be measured during local or staging testing. Message send-to-delivery should feel sub-second. The app must not refetch the entire thread or chat list for every incoming message. Typing indicators should clear automatically after a short idle window and should not persist after app backgrounding or abrupt disconnect.

## Idempotence and Recovery

This migration is safe to perform incrementally because HTTP remains in place throughout rollout. That is the primary recovery strategy. If the websocket layer fails in development or staging, the app can temporarily disable realtime send/receive behind a feature flag and continue using the current REST path.

Database migrations must be additive first. Add `client_message_id` and `chat_seq` without removing existing columns or handlers. Code should be able to tolerate a temporary state where websocket features are disabled but the new columns exist. This makes repeated deploys and rollbacks safe.

If a websocket command handler is only partially implemented, do not register the client path to use it yet. The safe order is backend foundation, passive client receive, active client receive, then send migration. If a reconnect or replay bug is discovered, the client must be able to fall back to `system.resync_required` and perform HTTP refetch rather than guessing state.

If a pub/sub outage occurs, local node delivery may still work for users connected to the same app instance, but cross-instance fanout will degrade. For that reason, alerting on pub/sub delivery failures is required before production rollout. The immediate rollback is to disable websocket live delivery and revert to REST send plus refresh behavior while preserving the schema changes.

## Artifacts and Notes

The most important interfaces that must exist by the end of implementation are listed here so the work remains concrete.

In `/home/michaelroddy/repos/project_radeon/internal/chats`, define websocket protocol structs equivalent to:

    type ClientCommand struct {
        Type string          `json:"type"`
        Data json.RawMessage `json:"data"`
    }

    type ServerEvent struct {
        Type       string          `json:"type"`
        EventID    uuid.UUID       `json:"event_id"`
        OccurredAt time.Time       `json:"occurred_at"`
        Cursor     string          `json:"cursor"`
        Data       json.RawMessage `json:"data"`
    }

In `/home/michaelroddy/repos/project_radeon/internal/chats/store.go`, extend message insertion so it can accept and return:

    InsertRealtimeMessage(ctx context.Context, chatID, userID uuid.UUID, clientMessageID string, body string) (messageID uuid.UUID, chatSeq int64, sentAt time.Time, err error)

In `/home/michaelroddy/repos/project_radeon/internal/chats/handler.go` and `/home/michaelroddy/repos/project_radeon/internal/chats/store.go`, standardize chat list reads to a cursor-shaped interface equivalent to:

    ListChats(ctx context.Context, userID uuid.UUID, query string, before *time.Time, limit int) ([]Chat, error)

and a response envelope that behaves like:

    type ChatPage struct {
        Items      []Chat      `json:"items"`
        Limit      int         `json:"limit"`
        HasMore    bool        `json:"has_more"`
        NextBefore *time.Time  `json:"next_before,omitempty"`
    }

In `/home/michaelroddy/repos/project_radeon_app/src/realtime/chatSocket.ts`, expose a singleton transport with functions conceptually equivalent to:

    connect(): Promise<void>
    disconnect(): void
    send(command: ClientCommand): void
    subscribe(listener: (event: ServerEvent) => void): () => void
    getConnectionState(): "idle" | "connecting" | "connected" | "reconnecting"

In `/home/michaelroddy/repos/project_radeon_app/src/screens/main/chat/useChatThreadController.ts`, preserve the existing observable responsibilities: optimistic append, durable reconciliation, read-state sync, older-message pagination, and chat-list summary updates. The transport change must not scatter that logic into screen components.

## Interfaces and Dependencies

Use the existing technology stack before introducing new systems. On the backend, stay within Go, Chi routing, pgx for Postgres access, and Redis for cross-instance pub/sub. Do not introduce a separate Node websocket gateway or a new database. The current app server in `/home/michaelroddy/repos/project_radeon/cmd/api/main.go` should remain the entrypoint.

On the frontend, stay within Expo, React Native, and React Query. The standard React Native `WebSocket` API is sufficient for a first production implementation if the protocol is simple and the reconnect logic is well-contained. Do not pull in a heavyweight socket framework unless a concrete missing feature appears during implementation. The query cache should remain the single source of visible client state for chats and messages.

The backend notifier path should continue to coexist with realtime delivery. Push notifications remain necessary when a recipient device is backgrounded, terminated, or disconnected. The implementation should eventually make push policy presence-aware, but the first production version may tolerate conservative push behavior as long as message correctness is not affected.

Because this is a high-risk migration, implementation should be guarded by feature flags in both repos. The backend should expose a websocket enable flag and possibly a send-over-websocket flag. The frontend should keep a switch that allows falling back to the current REST send path during rollout. Feature flag names should be explicit and repository-local rather than overloaded with unrelated config.

At the bottom of each implementation revision of this file, append a short note describing what changed and why.
