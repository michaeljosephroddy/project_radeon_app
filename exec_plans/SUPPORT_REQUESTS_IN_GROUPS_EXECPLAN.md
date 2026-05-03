# Move Support Requests Into A System-Owned Groups Thread

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`. Implementation work also spans the backend repository at `/home/michaelroddy/repos/project_radeon`, which has its own `PLANS.md`. The plan is self-contained so a contributor can implement it without relying on prior conversation.

## Purpose / Big Picture

After this change, support requests will still exist as intentional support objects with urgency, support type, status, private offers, and accepted support chats, but users will find and discuss them inside a default `Community Support` group. Everyone is automatically a member of that group. The standalone Support tab goes away, and Groups moves into its tab slot. A user can open Groups, see the pinned Community Support group, create a support request there, receive public comments in the group thread, and accept a private offer that opens a chat.

This reduces duplicated feed surfaces. Support stops feeling like a separate app inside the app, while keeping the important support workflow that ordinary group posts do not have: urgency, request status, offer acceptance, and private support chat creation.

## Progress

- [x] (2026-05-03T10:37:46Z) Reviewed `PLANS.md` and confirmed this feature should be planned as an ExecPlan because it changes backend schema, backend behavior, app navigation, and app UI.
- [x] (2026-05-03T10:37:46Z) Reviewed the existing app support and groups surfaces in `src/api/client.ts`, `src/navigation/AppNavigator.tsx`, `src/screens/main/SupportScreen.tsx`, `src/screens/main/GroupsScreen.tsx`, and `src/screens/main/groups/*`.
- [x] (2026-05-03T10:37:46Z) Reviewed existing backend support and groups schema/code references in `/home/michaelroddy/repos/project_radeon/schema/base.sql`, `migrations/`, `internal/groups`, `internal/support`, and notification code.
- [x] (2026-05-03T10:37:46Z) Authored this ExecPlan in `exec_plans/SUPPORT_REQUESTS_IN_GROUPS_EXECPLAN.md`.
- [x] (2026-05-03T10:55:13Z) Created implementation branches named `feature/support-requests-in-groups` in both repositories.
- [x] (2026-05-03T10:55:13Z) Added backend migration `066_support_requests_in_groups.sql`, canonical schema fields, system group fields, support-request/group-post link columns, Community Support upsert/backfill, and automatic new-user membership in auth creation.
- [x] (2026-05-03T10:55:13Z) Updated backend group/support stores so support request creation creates a linked `need_support` group post, linked group posts can embed support request data, and support reply endpoints can use group comments for linked requests.
- [x] (2026-05-03T11:26:39Z) Promoted Groups to the removed Support tab slot in the app and removed the Community tab's nested Groups sub-tab.
- [x] (2026-05-03T11:26:39Z) Added app type fields for system groups, linked support group posts, and `group_post_id` on support requests.
- [x] (2026-05-03T11:26:39Z) Pinned/promoted Community Support in `GroupsScreen`, rendered linked support requests as support-style cards in `GroupDetailScreen`, and opened support request creation from the Community Support FAB.
- [x] (2026-05-03T11:26:39Z) Added requester offer management inside Community Support so a requester can review, accept, decline, or close a request from the group context.
- [x] (2026-05-03T11:26:39Z) Updated migration backfill to reconcile partial previous support-post links and copy existing support replies into group comments.
- [x] (2026-05-03T11:26:39Z) Validated with `GOCACHE=/tmp/go-build-cache go test ./...` in the backend and `npx tsc --noEmit` in the app.
- [x] (2026-05-03T11:48:22Z) Added `support.offer` notifications with Community Support `group_id` and linked `post_id` payloads, and updated app notification handling to open the linked group thread payload.
- [x] (2026-05-03T11:48:22Z) Updated seeds to create the Community Support system group, add all seeded users as members, link seeded support requests to `need_support` group posts, and add public comments/reactions around open, active, and closed scenarios.
- [x] (2026-05-03T11:48:22Z) Revalidated with `GOCACHE=/tmp/go-build-cache go test ./...` in the backend and `npx tsc --noEmit` in the app after notification and seed updates.
- [x] (2026-05-03T12:26:12Z) Applied migration `066_support_requests_in_groups.sql` to local `project_radeon` database and validated a two-user API flow on a fresh backend instance at `localhost:18080`: support request creation, Community Support group membership, linked embedded support post, private offer notification payload, offer acceptance with chat id, and public group comment creation.

## Surprises & Discoveries

- Observation: Groups already exist as first-class post communities with memberships, posts, comments, images, admin tools, reports, and notifications.
    Evidence: the backend has `schema/base.sql` tables from `groups` through `group_reactions`, and the app has `src/screens/main/GroupsScreen.tsx`, `src/screens/main/groups/GroupDetailScreen.tsx`, and `src/screens/main/groups/GroupCreatePostScreen.tsx`.

- Observation: Support requests already have the richer help workflow that must not be lost.
    Evidence: `src/api/client.ts` defines `SupportRequest`, `SupportOffer`, `SupportReply`, `createSupportOffer`, `acceptSupportOffer`, and `SupportChatContext`. The backend schema has `support_requests`, `support_responses`, and chats linked by `support_request_id`.

- Observation: The app currently duplicates community surfaces by having Groups nested under the Community tab and Support as its own top-level tab.
    Evidence: `src/navigation/AppNavigator.tsx` defines `type Tab = 'community' | 'discover' | 'support' | 'meetups' | 'chats'`, and `CommunityTab` renders a segmented control with `For You` and `Groups`.

- Observation: The current support screen is a feed-style surface, not a chat thread.
    Evidence: `src/screens/main/SupportScreen.tsx` renders support request cards in `FlatList` views for the feed and `My Requests`, while `CreateSupportRequestScreen` is opened as a separate create surface from `AppNavigator`.

- Observation: The backend `groups.owner_id` column is non-null, so a migration cannot create a system group in a completely empty database unless a user row exists.
    Evidence: `schema/base.sql` defines `groups.owner_id UUID NOT NULL REFERENCES users(id)`. Migration `066_support_requests_in_groups.sql` therefore creates Community Support only when at least one user exists, and support request creation also upserts the group once an authenticated user exists.

## Decision Log

- Decision: Preserve support requests as a backend domain and expose them inside Groups through linked group posts.
    Rationale: Support requests have status, urgency, support type, private offers, and accepted chat behavior. Those semantics are not ordinary group-post concerns, so the implementation should link support records to group posts instead of deleting the support model.
    Date/Author: 2026-05-03 / Codex

- Decision: Use one system-owned group named `Community Support` with stable `system_key = 'community_support'`.
    Rationale: A stable key makes the group idempotent across migrations, seeds, local databases, and future code. The name can change later without breaking code or notification routing.
    Date/Author: 2026-05-03 / Codex

- Decision: Use group comments as the public support thread for linked support requests.
    Rationale: The user wants the support request to act like a Reddit-style thread in Groups. Group comments already provide public discussion, moderation, and counters. Keeping separate `support_replies` in the app would duplicate conversation.
    Date/Author: 2026-05-03 / Codex

- Decision: Keep private support offers and accepted support chats on the existing support endpoints.
    Rationale: Offers are not public comments. They are commitments to provide direct support and should remain requester-controlled. The existing acceptance path already creates or opens the private support chat.
    Date/Author: 2026-05-03 / Codex

- Decision: Replace the Support top-level tab with Groups and remove the Community tab's Groups sub-tab.
    Rationale: The product goal is to remove the redundant Support tab and put Groups in that slot. Keeping Groups in two places would preserve the navigation duplication this plan is meant to reduce.
    Date/Author: 2026-05-03 / Codex

- Decision: Let support request creation upsert Community Support in addition to the migration upsert.
    Rationale: This covers empty local databases where migrations run before any users exist. The migration handles existing data; the store path ensures the first real support request has a system group to attach to.
    Date/Author: 2026-05-03 / Codex

## Outcomes & Retrospective

Implementation has moved through the main backend and app paths. Backend foundation and linkage are in place for system group columns, support-request/group-post references, support request creation into Community Support, linked support posts embedding support request data, linked reply compatibility, and migration cleanup/backfill for prior partial attempts. The app now exposes Groups as a top-level tab, removes the nested Groups sub-tab from Community, pins Community Support, renders support request cards inside the support group, creates support requests from that group, and gives requesters an offer-management surface. Support offer notifications now carry Community Support group/post payloads, and seeded support data now appears as linked Community Support group posts with comments/reactions. Backend package tests, app typechecking, migration application, and a two-user local API validation pass.

## Context and Orientation

There are two repositories. The app repository is `/home/michaelroddy/repos/project_radeon_app`, an Expo React Native app. The backend repository is `/home/michaelroddy/repos/project_radeon`, a Go API backed by PostgreSQL.

The app centralizes all HTTP calls in `src/api/client.ts`. Main app navigation lives in `src/navigation/AppNavigator.tsx`. The current support feed lives in `src/screens/main/SupportScreen.tsx`. Support request creation lives in `src/screens/main/CreateSupportRequestScreen.tsx`. Groups discovery lives in `src/screens/main/GroupsScreen.tsx`. Group detail, group post creation, comments, admin, and reporting surfaces live under `src/screens/main/groups/`.

The backend stores canonical schema in `schema/base.sql` and ordered database migrations in `migrations/`. Group behavior lives under `internal/groups`. Support behavior lives under `internal/support`. Notifications live under `internal/notifications`. API routes are mounted from `cmd/api/main.go`.

A `system group` in this plan means a group created and owned by the application, not by an ordinary user. Users cannot delete it, leave it permanently, rename it, make it invite-only, or change its core permissions. A `support request` means a user-authored help request with support-specific metadata such as urgency and desired support type. A `linked group post` means a row in `group_posts` whose `post_type` is `need_support` and whose metadata points to a row in `support_requests`. A `public thread` means comments visible to members of the group. A `private offer` means a support offer that only the requester can accept or decline; accepting it creates or opens a private chat.

The existing `GroupPostType` union in the app already includes `need_support`. This plan promotes that type from a generic label into the group representation of a real support request.

## Target Product Behavior

The bottom tabs should become:

    community
    discover
    groups
    meetups
    chats

The old Support tab should no longer appear. The Groups tab should open `GroupsScreen`. The Community tab should open the general feed directly, without a `For You` / `Groups` segmented control.

At the top of `GroupsScreen`, the app should promote the `Community Support` group. It should be visually obvious that everyone is already a member. The normal discover and joined groups lists should still work. The user should be able to open Community Support like any other group.

Inside Community Support, the post feed should show support requests as support request cards, not generic group posts. A support card should show requester, urgency, support type, topics, location when available, status, comment count, offer count, and the primary action. The public discussion opens through the existing group comments modal. Private support offers remain available from the card or detail surface, and accepting an offer still opens a private chat.

Creating a support request should happen from Community Support. The app may reuse `CreateSupportRequestScreen`, but it should be presented as the create flow for the support group. It should create both a `support_requests` record and a linked `group_posts` row in one backend transaction.

`My Requests` should not be a top-level Support tab anymore. It should be available inside Community Support as a filter or sub-tab, for example `All` and `My Requests`. The `My Requests` view must still show open, active, and closed requests so a requester can accept offers, close requests, or open an accepted chat.

## Backend Plan Of Work

Milestone 1 establishes the system group model. Add a migration in `/home/michaelroddy/repos/project_radeon/migrations/` and mirror it in `schema/base.sql`. Add nullable system columns to `groups`:

    is_system BOOLEAN NOT NULL DEFAULT false
    system_key TEXT NULL
    locked_settings BOOLEAN NOT NULL DEFAULT false

Add a unique partial index so only one group can use a given non-null system key:

    CREATE UNIQUE INDEX groups_system_key_unique_idx ON groups(system_key) WHERE system_key IS NOT NULL;

Insert or upsert a `Community Support` group with `system_key = 'community_support'`, `is_system = true`, `locked_settings = true`, `visibility = 'public'`, `posting_permission = 'members'`, and tags such as `support` and `community`. The migration must be idempotent. It should not fail if the group already exists. It should also insert active member rows for existing users into `group_memberships`, using role `member` and status `active`.

Add backend logic so new users are automatically made members. Prefer a Go store function such as `EnsureSystemGroupMemberships(ctx, userID)` in `internal/groups/store.go` and call it after registration and in a safe idempotent place such as the current-user load path. If registration code cannot import the groups store cleanly, add a small backend service layer rather than duplicating SQL in multiple packages. The SQL must use `ON CONFLICT DO NOTHING` so repeated calls are safe.

Protect system group settings in `internal/groups`. Users, including admins, should not delete the system group, change its visibility, remove its system key, ban themselves from it, or leave it in a way that makes it disappear from their Groups tab. If the existing API has leave or update endpoints, add explicit checks for `is_system`.

Milestone 2 links support requests to group posts. Add columns so each support request can be represented in the group feed:

    ALTER TABLE support_requests ADD COLUMN group_post_id UUID NULL REFERENCES group_posts(id) ON DELETE SET NULL;
    ALTER TABLE group_posts ADD COLUMN support_request_id UUID NULL REFERENCES support_requests(id) ON DELETE SET NULL;

Add unique indexes on both linkage columns where they are not null. The relationship should be one support request to one group post. Use one transaction when creating the pair so there is no request without a post or post without a request after normal creation.

Update support request creation in `internal/support` so `POST /support/requests` creates a support request and a `group_posts` row in the Community Support group. The group post should use `post_type = 'need_support'`, `body` equal to the support request message or a generated fallback such as `Support request`, and `user_id` equal to the requester. It should set `support_request_id` and then update `support_requests.group_post_id`. Increment the Community Support group's `post_count` like any other group post.

Backfill existing support requests. The migration should insert linked `need_support` group posts for existing support requests that do not have a `group_post_id`. Preserve their `created_at` where possible so old requests appear in roughly the same order. If a support request is closed, the linked group post can remain visible with closed status unless product decides otherwise later.

Milestone 3 changes public discussion from `support_replies` to group comments for the app path. For linked support requests, group comments are the public thread. The app should no longer call `getSupportReplies` or `createSupportReply` for the Community Support UI.

For compatibility, backend support reply endpoints can remain. If a support request has `group_post_id`, `GET /support/requests/{id}/replies` may read group comments and return them as `SupportReply` DTOs, and `POST /support/requests/{id}/replies` may create a group comment. This keeps older app builds from breaking during rollout. If implementing this compatibility would be risky, leave the old endpoints untouched but document in the Decision Log that the new app only uses group comments.

Support request `reply_count` should align with the group post `comment_count` for linked requests. Prefer deriving support request `reply_count` from `group_posts.comment_count` when reading linked support requests, or update both counters in the same transaction when adding comments. Do not let the app show two different public counts for the same thread.

Milestone 4 expands group post DTOs to include support context. In backend `internal/groups/types.go`, add an optional field on `GroupPost` similar to:

    SupportRequest *support.SupportRequest `json:"support_request,omitempty"`

Avoid an import cycle. If `internal/groups` cannot import `internal/support`, define a small local DTO with only the fields the app needs, or move shared support DTOs into a neutral package. The JSON returned by `GET /groups/{id}/posts` for linked `need_support` posts must include enough data for the app to render a support request card without making N extra detail requests.

In app `src/api/client.ts`, add:

    support_request?: SupportRequest | null

to `GroupPost`. Keep existing group post fields so normal group posts still render.

Milestone 5 keeps private offers unchanged but makes them reachable from the group UI. The existing endpoints in `src/api/client.ts` should remain:

    createSupportOffer
    acceptSupportOffer
    declineSupportOffer
    cancelSupportOffer
    getSupportOffers
    updateSupportRequest

The backend should keep these endpoints in `internal/support`. When an offer is accepted, the accepted chat behavior must remain unchanged and the group support post should reflect the request status when posts are refetched. Notifications for offers should still go to the requester. If support notifications currently deep-link to the Support tab, update them to deep-link to the Community Support group and linked post.

Milestone 6 updates seeds and local data. In `/home/michaelroddy/repos/project_radeon/seeds/seed.go`, ensure Community Support exists, all seeded users are active members, and several seeded support requests are linked to `need_support` group posts with comments and offer scenarios. Include at least one open urgent request, one unanswered request, one request with public comments, one request with a pending private offer, one active request with accepted chat, and one closed request.

## Frontend Plan Of Work

Milestone 1 promotes Groups into the Support tab slot. In `src/navigation/AppNavigator.tsx`, change:

    type Tab = 'community' | 'discover' | 'support' | 'meetups' | 'chats'

to:

    type Tab = 'community' | 'discover' | 'groups' | 'meetups' | 'chats'

Change the `TABS` entry that currently has key `support` and label `support` to key `groups`, label `groups`, and a suitable icon such as `people-outline` / `people`. Remove `SupportTab`, the `SupportScreen` import, and the top-level render branch that mounts support. Remove `CommunityMode` and the segmented control from `CommunityTab`, so Community only renders `FeedScreen`. Mount `GroupsScreen` as a top-level tab body.

Remove `createSupportRequestOpen` from general app-level state only after the new support-group create flow is wired. During migration it is acceptable to keep the state temporarily and open it only from Community Support. At the end, there should be no standalone Support tab path.

Milestone 2 adds system group awareness to app types. In `src/api/client.ts`, add these fields to `Group`:

    is_system: boolean
    system_key?: 'community_support' | string | null
    locked_settings: boolean

Add `support_request?: SupportRequest | null` to `GroupPost`. If backend initially omits these fields, normalizers should default `is_system` and `locked_settings` to false to keep older local APIs from crashing during development.

Milestone 3 makes `GroupsScreen` pin Community Support. Update `src/screens/main/GroupsScreen.tsx` so a group with `system_key === 'community_support'` is shown first in both discover and joined scopes. It should not show a Join button. It should use support-specific copy such as `Community Support` and `Everyone is a member`, but avoid long instructional text inside the app. If the backend supports a dedicated endpoint such as `GET /groups/system/community_support`, use it only if it simplifies cache behavior; otherwise list groups can include the system group.

Milestone 4 makes `GroupDetailScreen` render support requests inside Community Support. In `src/screens/main/groups/GroupDetailScreen.tsx`, detect:

    const isCommunitySupport = group.system_key === 'community_support'

For normal groups, keep the existing tabs and post cards. For Community Support, render a support-focused posts tab. It can share layout with `GroupPostsTab`, but linked posts where `post.post_type === 'need_support' && post.support_request` should render a support request card rather than a generic `PostCard`.

Extract reusable support-card pieces from `src/screens/main/SupportScreen.tsx` before deleting that screen. Avoid copying a full second implementation. A good target is `src/components/support/SupportRequestCard.tsx` plus small helpers for labels. The card should accept callbacks for public comments, offer, accept, decline, close, open chat, and press user. It should not know whether it lives in the old support screen or group detail.

The public comment button should open the existing group comments modal with the linked `GroupPost`. That keeps public discussion in Groups. The private offer button should call `createSupportOffer` with the linked `SupportRequest.id`.

Milestone 5 moves creation into Community Support. Reuse `src/screens/main/CreateSupportRequestScreen.tsx` if possible, but rename or wrap it so the UI title reads naturally from the group context. Opening the support create FAB from Community Support should call the existing support creation API, which now returns a `SupportRequest` containing `group_post_id`. On success, close the create screen, invalidate group posts for Community Support, and show the new linked post in the group feed.

If the current create screen returns only a support request and not a group post, add a backend response field or app follow-up fetch so the group posts cache can update. Prefer invalidating and refetching over manually building a complex optimistic group post on the first pass.

Milestone 6 replaces `My Requests`. Remove the `My Requests` top-level support surface. Inside Community Support, add a small segmented control or filter with `All` and `My Requests`. `All` uses group posts from Community Support. `My Requests` can use `getMySupportRequests` initially, but it should navigate/open the linked group post when the user wants to view discussion. If `getMySupportRequests` returns `group_post_id`, the app can match it to group posts or open the support group and scroll later. If scroll-to-post is not available in the first implementation, simply render the requester management cards in the `My Requests` filter and keep comments/offers actions working.

Milestone 7 removes obsolete support screen entry points. Once Community Support owns the support flow, delete or stop importing `src/screens/main/SupportScreen.tsx` if no longer used. Keep `CreateSupportRequestScreen.tsx` if it remains the create form. Keep API support functions that are still used by Community Support: create request, update request, offers, and my requests. Remove unused query hooks in `src/hooks/queries/useSupport.ts` only after checking imports with `rg`.

## Concrete Steps

Start from clean worktrees. In the app repository:

    cd /home/michaelroddy/repos/project_radeon_app
    git status --short --branch
    git switch -c feature/support-requests-in-groups

In the backend repository:

    cd /home/michaelroddy/repos/project_radeon
    git status --short --branch
    git switch -c feature/support-requests-in-groups

If either branch already exists, use `git switch feature/support-requests-in-groups`. If either worktree has unrelated changes, stop and inspect them before proceeding; do not overwrite user work.

Backend implementation should proceed first because the app depends on new response fields. After each backend milestone, run:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build-cache go test ./...

Expected success is all packages passing. If the default Go cache is writable on another machine, plain `go test ./...` is also acceptable.

After backend support-group fields are available, implement the app milestones and run:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Expected success is no TypeScript errors.

To run the app locally, use:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

The backend URL comes from `.env` through `EXPO_PUBLIC_API_URL`. If unset, Android emulator defaults to `http://10.0.2.2:8080`; iOS simulator and web default to `http://localhost:8080`.

## Validation and Acceptance

The implementation is accepted when all of these behaviors work against a migrated local database:

1. A newly registered user sees a `groups` bottom tab where `support` used to be.
2. The Community tab opens the normal feed directly and no longer contains a Groups sub-tab.
3. The Groups tab shows `Community Support` pinned/promoted, and the current user is already a member without tapping Join.
4. Opening Community Support shows support requests as support-style cards inside the group post feed.
5. Creating a support request from Community Support creates a `support_requests` row and a linked `group_posts` row with `post_type = 'need_support'`.
6. Another user can add a public comment through the group comments modal, and the support card comment count updates.
7. Another user can send a private offer on the support request.
8. The requester can see and accept the private offer from Community Support or My Requests.
9. Accepting the offer opens or creates the same support chat behavior that exists today.
10. Closing the request updates the support status on the linked group post after refresh.
11. The old Support tab is not visible and there is no route that opens `SupportScreen` from the main tab shell.

Backend validation must include tests for system group creation/backfill, automatic membership for new users, support request to group post linkage, group comments as public support replies, private offer acceptance, and system group protection. App validation must include `npx tsc --noEmit` and a manual device or simulator walkthrough of the above behavior.

## Idempotence and Recovery

All database migrations must be safe to run once through the migration system and safe in their data-upsert portions. The Community Support insert must use a stable `system_key` and conflict handling. Membership backfill must use `ON CONFLICT DO NOTHING`. Support request to group post backfill must skip requests that already have `group_post_id`.

If the migration partially fails before being recorded by the migration system, inspect the database before retrying. The upsert and backfill statements should be written so retrying does not create duplicate system groups, duplicate memberships, or duplicate linked posts.

Do not delete old support tables in this plan. Keep `support_requests`, `support_responses`, and any existing `support_replies` table or endpoint unless a later plan explicitly removes them. This makes rollback safer: if the group UI has problems, the support records and offers still exist.

If the app refactor causes navigation regressions, the lowest-risk rollback is to restore the Support tab and keep Groups as a top-level or community sub-tab while leaving backend linkage in place. Backend linkage is additive and should not prevent the old support feed from reading support requests.

## Interfaces and Dependencies

Backend schema must expose these new or updated fields:

    groups.is_system
    groups.system_key
    groups.locked_settings
    support_requests.group_post_id
    group_posts.support_request_id

App `Group` must include:

    is_system: boolean
    system_key?: string | null
    locked_settings: boolean

App `GroupPost` must include:

    support_request?: SupportRequest | null

Backend support request creation must still be available at:

    POST /support/requests

Backend group posts must still be available at:

    GET /groups/{groupID}/posts

Support offer endpoints must remain:

    POST /support/requests/{requestID}/offers
    GET /support/requests/{requestID}/offers
    POST /support/requests/{requestID}/offers/{offerID}/accept
    POST /support/requests/{requestID}/offers/{offerID}/decline
    POST /support/requests/{requestID}/offers/{offerID}/cancel

Group comments are the public thread for linked support requests:

    GET /groups/{groupID}/posts/{postID}/comments
    POST /groups/{groupID}/posts/{postID}/comments

Notification payloads that currently target support requests should include enough data to open the Community Support group and, if possible, the linked group post:

    group_id
    group_post_id
    support_request_id

## Artifacts and Notes

Current relevant app state at plan authoring:

    src/navigation/AppNavigator.tsx defines tabs as community, discover, support, meetups, chats.
    src/screens/main/SupportScreen.tsx owns the standalone support feed.
    src/screens/main/GroupsScreen.tsx owns group discovery/joined groups.
    src/screens/main/groups/GroupDetailScreen.tsx owns group posts, media, members, and about tabs.
    src/api/client.ts already defines SupportRequest, SupportOffer, SupportReply, Group, GroupPost, and GroupPostType = 'standard' | 'milestone' | 'need_support' | 'admin_announcement' | 'check_in'.

Current relevant backend state at plan authoring:

    schema/base.sql already contains groups, group_memberships, group_posts, group_comments, group_reactions, support_requests, support_responses, and chats.support_request_id.
    internal/groups contains handlers and store methods for listing groups, joining groups, listing posts, creating posts, listing/creating comments, reactions, moderation, invites, join requests, admin contact, and reports.
    internal/support contains support request, offer, reply, and chat acceptance behavior.

Revision note, 2026-05-03 / Codex: Initial ExecPlan authored after product discussion. The plan intentionally links support requests to system group posts instead of converting support into generic posts, because private offers and accepted support chats are core behavior that should survive the navigation simplification.
