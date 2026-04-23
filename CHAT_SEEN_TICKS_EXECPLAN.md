# Chat Seen Ticks ExecPlan

## Goal

Add real, backend-backed seen ticks to direct-message chat threads in a way that is simple, performant, and compatible with the current cache/query model.

The current frontend shows Gifted Chat send/receive state, but it is not real read-state. Non-optimistic messages are hardcoded as `sent: true` and `received: true`, so the UI cannot distinguish:

- sent but not yet seen
- seen by the recipient

## Current State

### Backend

The backend already stores thread-level read state:

- `chat_reads(chat_id, user_id, last_read_message_id, last_read_at)` exists in [schema/base.sql](/home/michaelroddy/repos/project_radeon/schema/base.sql:335)
- `POST /chats/:id/read` updates that cursor in [internal/chats/handler.go](/home/michaelroddy/repos/project_radeon/internal/chats/handler.go:355)
- sending a message also marks the sender as read up to the newly created message in [internal/chats/handler.go](/home/michaelroddy/repos/project_radeon/internal/chats/handler.go:330)

What is missing is response data:

- `GET /chats/:id/messages` returns only message fields in [internal/chats/store.go](/home/michaelroddy/repos/project_radeon/internal/chats/store.go:428)
- `Message` in [internal/chats/handler.go](/home/michaelroddy/repos/project_radeon/internal/chats/handler.go:71) has no read-state fields
- `Chat` in [internal/chats/handler.go](/home/michaelroddy/repos/project_radeon/internal/chats/handler.go:57) has no counterpart read cursor for the other participant

### Frontend

- `api.Message` has no read-state field in [src/api/client.ts](/home/michaelroddy/repos/project_radeon_app/src/api/client.ts:303)
- `toGiftedChatMessages(...)` hardcodes `sent` and `received` for all non-optimistic messages in [chatGiftedModels.ts](/home/michaelroddy/repos/project_radeon_app/src/screens/main/chat/chatGiftedModels.ts:15)
- the chat thread already calls `POST /chats/:id/read` in [useChatThreadController.ts](/home/michaelroddy/repos/project_radeon_app/src/screens/main/chat/useChatThreadController.ts:99)

So the app already updates read state, but it does not retrieve enough data to render real seen ticks.

## Recommended Model

Use a **thread-level read cursor** for the other participant, not per-message read flags.

For 1:1 chats:

- backend exposes the other participant's `last_read_message_id` and/or `last_read_at`
- frontend marks an outgoing message as seen if it is at or before that read cursor

Why this is the right model:

- it reuses existing backend state
- no schema redesign is required
- no per-message write amplification
- simple client mapping
- good enough for standard seen ticks in direct chats

For group chats:

- do **not** implement multi-user seen receipts in this pass
- keep current generic sent state or no seen ticks at all

Multi-user receipts are a separate product and data-model problem.

## Scope

### In scope

- direct chats
- backend response contract for thread read cursor
- frontend message mapping for real seen ticks
- cached thread updates after sending and marking read

### Out of scope

- group-chat participant-by-participant receipts
- websocket or push-based live read receipt updates
- delivery receipts distinct from seen receipts

## Implementation Plan

### Phase 1: Backend contract

Add a read-cursor payload to chat thread responses.

Recommended response shape:

- `chat_read_state.other_user_last_read_message_id?: string`
- optionally `chat_read_state.other_user_last_read_at?: string`

Best place to expose it:

- `GET /chats/:id/messages`

Reason:

- the thread screen already fetches this payload
- it avoids needing a second chat-details fetch
- it keeps seen-tick data scoped to the thread that needs it

Concrete backend changes:

1. Extend the chat message response model in [internal/chats/handler.go](/home/michaelroddy/repos/project_radeon/internal/chats/handler.go:71).
2. Add a store query that reads the other participant's row from `chat_reads` for a direct chat.
3. Return that read cursor alongside message pages.
4. For group chats, return `null`/empty read-state in this field.

### Phase 2: Frontend API types

Update frontend types in [src/api/client.ts](/home/michaelroddy/repos/project_radeon_app/src/api/client.ts:303):

1. Add a chat-thread read-state shape.
2. Extend `getMessages(...)` return type to include:
   - paginated messages
   - optional `other_user_last_read_message_id`

This should remain backward-compatible with the existing infinite query structure by keeping the messages array under the current page payload, with extra metadata attached.

### Phase 3: Thread mapping

Update [chatGiftedModels.ts](/home/michaelroddy/repos/project_radeon_app/src/screens/main/chat/chatGiftedModels.ts:15):

1. Stop hardcoding `received: !pending` for every non-optimistic message.
2. For outgoing messages in direct chats:
   - mark `sent: true` once the optimistic message is replaced by a real server id
   - mark `received: true` only if the message is at or before `other_user_last_read_message_id`
3. For incoming messages:
   - no seen tick logic is needed on the local side

Comparison rule:

- if the outgoing message id equals the other participant's last read message id, it is seen
- if it appears before that id in the ordered message list, it is also seen
- if it appears after that id, it is not yet seen

The comparison should be index-based within the current ordered message array, not lexicographic by UUID.

### Phase 4: Thread controller

Update [useChatThreadController.ts](/home/michaelroddy/repos/project_radeon_app/src/screens/main/chat/useChatThreadController.ts:89):

1. Preserve the current `POST /read` behavior.
2. After sending a message, refetch or reconcile thread metadata so the thread gets the latest seen cursor when reopened.
3. Keep the current session-level guard against repeated `POST /read` spam.

No extra read POST should be added beyond the current best-effort sync.

### Phase 5: UI decision

Keep the initial UI minimal:

- one tick: sent
- two ticks: seen

If the current Gifted Chat wrapper already supports `sent`/`received`, reuse that.
If not, add a small custom message footer/tick renderer only for outgoing direct messages.

Do not introduce a third delivery state in this pass.

## Validation Plan

### Backend validation

1. Open a direct chat between user A and user B.
2. Send messages from A.
3. Open the same chat as B so `POST /read` advances B's read cursor.
4. Fetch A's thread again.

Expected result:

- thread payload includes B's `last_read_message_id`
- that id matches the latest message B has seen

### Frontend validation

1. A sends a new message.
2. Before B opens the chat:
   - A sees the message as sent but not seen
3. B opens the chat:
   - A sees the same message transition to seen after refetch/reopen

### Regression checks

- optimistic send still works
- cached message history still renders immediately
- no extra chat-open POST spam is reintroduced
- group chats do not show incorrect seen ticks

## Rollout Order

1. Backend response contract
2. Frontend API types
3. Message mapping
4. UI tick rendering
5. Manual validation across 1:1 chats

## Recommendation

Implement this as a **direct-chat-only read-cursor feature** first.

That gives you real seen ticks with low complexity and without touching the underlying message table design. It also leaves room to add richer receipt behavior later if the product needs it.
