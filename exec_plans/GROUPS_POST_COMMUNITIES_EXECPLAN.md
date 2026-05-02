# Replace Reflections with Post-Based Recovery Groups

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`. The backend repository at `/home/michaelroddy/repos/project_radeon` is part of this plan because Groups require durable server-side permissions, membership, posts, media, moderation, and notifications.

## Purpose / Big Picture

The current app includes a private daily reflections feature. The new product direction is to remove reflections completely and replace that surface with recovery-focused Groups. After this change, a user can discover sober communities, request to join or accept an invite, read and create group posts with photos, comment and react, browse shared media, view members, contact group admins, and use admin tools to keep the group safe.

This feature is intentionally post-based. It does not include group chat, group direct messages, or real-time chat threads. Groups are durable community spaces organized around posts, images, comments, members, rules, and admin moderation. The proof of completion is a local end-to-end run where a user creates an approval-required group, approves a join request, posts text and images to that group, comments and reacts from another account, contacts the group admins, pins a post, removes inappropriate content as an admin, and sees the Groups tab fully replace the previous reflection entry points.

## Progress

- [x] (2026-05-02T15:11Z) Reviewed `PLANS.md` and existing ExecPlan examples to confirm the required format.
- [x] (2026-05-02T15:11Z) Reviewed the current app reflection touchpoints in `src/navigation/AppNavigator.tsx`, `src/query/queryKeys.ts`, `src/hooks/queries/useReflections.ts`, `src/screens/main/DailyReflectionScreen.tsx`, `src/screens/main/profile/ReflectionsTab.tsx`, and `src/api/client.ts`.
- [x] (2026-05-02T15:11Z) Reviewed the existing app feed primitives in `src/hooks/queries/useFeed.ts` and `src/api/client.ts` so group posts can reuse familiar post, image, comment, reaction, and pagination patterns where appropriate.
- [x] (2026-05-02T15:11Z) Reviewed backend package layout in `/home/michaelroddy/repos/project_radeon`, including `internal/feed`, `internal/reflections`, `internal/notifications`, `internal/friends`, `schema/base.sql`, and `migrations/`.
- [x] (2026-05-02T15:11Z) Authored this ExecPlan in `exec_plans/GROUPS_POST_COMMUNITIES_EXECPLAN.md`.
- [x] (2026-05-02T15:19Z) Created implementation branches `codex/post-based-groups-app` in `/home/michaelroddy/repos/project_radeon_app` and `codex/post-based-groups-api` in `/home/michaelroddy/repos/project_radeon`, carrying the existing dirty work because the user approved starting execution.
- [x] (2026-05-02T15:29Z) Implemented the first additive backend Groups foundation: migration `063_groups_foundation.sql`, canonical schema additions, `internal/groups` types/store/handler, route registration, and core endpoints for group discovery, create, detail, join, leave, and members.
- [x] (2026-05-02T15:47Z) Added focused backend handler tests in `internal/groups/handler_test.go` for group creation validation/defaults, join invite-required errors, and list search/filter parsing.
- [x] (2026-05-02T16:08Z) Implemented backend group posts/media/comments/reactions: migration `064_group_posts.sql`, schema updates, store methods, handlers, route registration, and handler tests for group post validation/image input.
- [x] (2026-05-02T16:36Z) Implemented backend invites, join request review, admin contact inbox, and reports with route registration and store support.
- [x] (2026-05-02T17:22Z) Added realistic group seed data in `seeds/seed.go`, including groups across visibility modes, members/admins/moderators, posts, images, comments, reactions, pending join requests, invites, admin contact threads, and reports.
- [x] (2026-05-02T17:45Z) Implemented backend group notifications through the existing notification service for join requests, approvals, posts, comments, admin contact, admin replies, and reports, honoring group notification preferences and muted groups.
- [x] (2026-05-02T15:41Z) Implemented the first frontend Groups slice: API contracts/functions in `src/api/client.ts`, query keys, `src/hooks/queries/useGroups.ts`, `src/screens/main/GroupsScreen.tsx`, and a visible Groups tab in `src/navigation/AppNavigator.tsx`.
- [x] (2026-05-02T16:18Z) Implemented frontend group detail read surfaces: `GroupDetailScreen` with Posts, Media, Members, and About tabs, plus list-card navigation from `GroupsScreen`.
- [x] (2026-05-02T16:16Z) Implemented frontend post composer, comments UI, invite/admin/report screens, and richer cache invalidation for deeper group flows.
- [x] (2026-05-02T16:42Z) Added a basic text post composer to the Group Posts tab and frontend API/query contracts for invites, join requests, admin inbox, and reports.
- [x] (2026-05-02T17:02Z) Implemented initial frontend comments UI, contact-admins panel, invite token creation panel, join request approval/rejection panel, and report-group panel inside `GroupDetailScreen`.
- [x] (2026-05-02T17:28Z) Added an inline create-group panel to `GroupsScreen` so users can create a public, approval-required, or invite-only group from the Groups tab.
- [x] (2026-05-02T17:41Z) Implemented frontend image post creation in `GroupDetailScreen` by reusing the existing image picker and upload API, then attaching uploaded images to group post creation.
- [x] (2026-05-02T17:46Z) Tightened frontend group cache behavior with prefix-scoped invalidation, post prepend updates, optimistic reaction updates, and comment count updates in `useGroups`.
- [x] (2026-05-02T17:56Z) Implemented group post moderation controls: backend pin/unpin/delete endpoints with permission checks, frontend API/hooks, and admin-facing pin/remove actions in group post cards.
- [x] (2026-05-02T18:14Z) Implemented group notification UI/deep-link handling: push notification intents and the in-app notification list now recognize `group.*` payloads and open the target group detail surface.
- [x] (2026-05-02T16:16Z) Implemented richer dedicated admin/report screens: a Group Admin center for join requests and admin inbox replies/resolution, plus a dedicated Group Report screen with reason selection and moderator context.
- [x] (2026-05-02T18:05Z) Removed app reflection surfaces: navigation state, profile reflections tab, reflection screens, reflection hooks, reflection utilities, reflection query keys, and reflection API client functions.
- [x] (2026-05-02T18:08Z) Removed backend reflection surfaces: API routes, `internal/reflections`, canonical `daily_reflections` schema, and added migration `065_drop_daily_reflections.sql`.
- [x] (2026-05-02T15:48Z) Reran `GOCACHE=/tmp/go-build go test ./...` in `/home/michaelroddy/repos/project_radeon` after adding Groups handler tests; all backend packages passed.
- [x] (2026-05-02T16:19Z) Reran `npx tsc --noEmit` in `/home/michaelroddy/repos/project_radeon_app` after adding group detail tabs; TypeScript passed.
- [x] (2026-05-02T16:43Z) Reran `npx tsc --noEmit` after adding group post composer and admin/invite/report contracts; TypeScript passed.
- [x] (2026-05-02T17:03Z) Reran `npx tsc --noEmit` after adding comments/admin/contact/report panels; TypeScript passed.
- [x] (2026-05-02T17:03Z) Reran `GOCACHE=/tmp/go-build go test ./...` after backend admin/control work; all backend packages passed.
- [x] (2026-05-02T17:29Z) Reran `GOCACHE=/tmp/go-build go test ./...` after adding group seed data; all backend packages passed.
- [x] (2026-05-02T17:29Z) Reran `npx tsc --noEmit` after adding the create-group panel; TypeScript passed.
- [x] (2026-05-02T17:45Z) Reran `GOCACHE=/tmp/go-build go test ./...` after adding group notification service/store methods and handler wiring; all backend packages passed.
- [x] (2026-05-02T17:46Z) Reran `npx tsc --noEmit` after adding image group posts and group cache updates; TypeScript passed.
- [x] (2026-05-02T17:56Z) Reran `GOCACHE=/tmp/go-build go test ./...` after group post moderation endpoints; all backend packages passed.
- [x] (2026-05-02T17:56Z) Reran `npx tsc --noEmit` after group post moderation actions; TypeScript passed.
- [x] (2026-05-02T18:08Z) Reran `GOCACHE=/tmp/go-build go test ./...` after removing backend reflection routes/package and adding the reflection drop migration; all backend packages passed.
- [x] (2026-05-02T18:08Z) Reran `npx tsc --noEmit` after removing frontend reflection screens/hooks/API contracts; TypeScript passed.
- [x] (2026-05-02T18:09Z) Searched active app/backend source for removed reflection entry points; no matches remained for reflection routes, app hooks, or daily reflection types outside historical migrations/support meeting copy.
- [x] (2026-05-02T18:14Z) Reran `npx tsc --noEmit` after adding group notification intent/list handling; TypeScript passed.
- [x] (2026-05-02T18:16Z) Final code validation pass: `npx tsc --noEmit` in the app passed and `GOCACHE=/tmp/go-build go test ./...` in the backend passed.
- [x] (2026-05-02T16:15Z) Applied pending local migrations with `go run ./cmd/migrate up`, including Groups schema and reflection drop migration.
- [x] (2026-05-02T16:16Z) Ran an authenticated local API smoke against `http://localhost:8080` covering create group, request join, approve request, create image-backed post, comment, react, contact admins, report post, pin post, media listing, and delete post.
- [x] (2026-05-02T16:16Z) Confirmed Expo Metro is running at `http://localhost:8082` with no new Metro errors emitted after the latest app changes.
- [x] (2026-05-02T16:16Z) Final validation after dedicated admin/report screens and smoke: `npx tsc --noEmit` passed and `GOCACHE=/tmp/go-build go test ./...` passed.

## Surprises & Discoveries

- Observation: The app currently exposes reflections as a modal-like flow from `AppNavigator`, not as a main tab.
    Evidence: `src/navigation/AppNavigator.tsx` imports `DailyReflectionScreen`, stores `reflectionOpen` and `openReflectionId`, and passes `onOpenReflection` behavior into profile-related flows.

- Observation: Profile content already has a reflections tab that must be removed, not merely hidden.
    Evidence: `src/components/profile/ProfileContentTabs.tsx` defines `ProfileContentTabKey` with a `reflections` value, and `src/screens/main/ProfileTabScreen.tsx` renders `ReflectionsTab` when that tab is active.

- Observation: The app already has robust post and image concepts that should be reused for group posts instead of creating an unrelated content model.
    Evidence: `src/api/client.ts` defines `Post`, `PostImage`, comments, reactions, image upload, and feed functions. The backend has `internal/feed` packages with post creation, image variants, comments, reactions, feed-item engagement, and aggregate logic.

- Observation: The worktrees are dirty at the time this plan was authored, so branch creation was intentionally deferred.
    Evidence: `/home/michaelroddy/repos/project_radeon_app` is on `feature/reflections-refactor-execplan` with modified reflection files, and `/home/michaelroddy/repos/project_radeon` is on `feature/fullscreen-composer-tags` with modified feed and reflection files. Switching branches now would carry those unrelated changes into the Groups branch.

- Observation: The default Go build cache path is read-only in this environment, but tests pass with a writable cache directory.
    Evidence: `go test ./...` failed opening `/home/michaelroddy/.cache/go-build/...` with `read-only file system`; `GOCACHE=/tmp/go-build go test ./...` passed for all backend packages.

## Decision Log

- Decision: Groups are post-based only; group chat is explicitly out of scope.
    Rationale: Recovery groups need durable, searchable, moderateable conversation more than high-volume real-time chat. Removing chat lowers implementation risk, improves moderation, and avoids duplicating the existing one-to-one chat subsystem.
    Date/Author: 2026-05-02 / Codex

- Decision: Replace reflections completely rather than keeping reflections and groups side by side.
    Rationale: The user explicitly asked to scratch the journal/reflections feature. Keeping both would increase navigation complexity and leave dead product surface area.
    Date/Author: 2026-05-02 / Codex

- Decision: Build Groups as a first-class backend package instead of overloading global feed posts with an optional `group_id`.
    Rationale: Groups require membership permissions, visibility, admin roles, join requests, invite links, admin contact, reports, media tabs, and group-specific notification preferences. Those rules should live in a cohesive domain package while still reusing feed/media primitives where possible.
    Date/Author: 2026-05-02 / Codex

- Decision: Use explicit membership roles: owner, admin, moderator, member, pending, and banned.
    Rationale: Production group software needs predictable permission checks. A simple boolean `is_admin` would become brittle as soon as moderation, invite management, ownership transfer, and post pinning are added.
    Date/Author: 2026-05-02 / Codex

- Decision: Use an admin inbox for "contact group admin" instead of exposing personal direct messages by default.
    Rationale: Recovery users can be vulnerable. A group-scoped admin inbox lets any admin respond, creates accountability, and avoids forcing members into private conversations with unknown admins.
    Date/Author: 2026-05-02 / Codex

- Decision: Support public, approval-required, invite-only, and private-hidden group visibility in the initial data model.
    Rationale: Recovery groups need different privacy levels for broad topic communities, local groups, identity-safe spaces, sponsor circles, and treatment cohorts. Adding these states later would require disruptive data and permission changes.
    Date/Author: 2026-05-02 / Codex

- Decision: Add Groups as a sixth top-level tab for the first frontend slice instead of removing Meetups or Discover immediately.
    Rationale: Reflections were not a main tab in the current app, so there is no one-for-one tab replacement. A temporary Groups tab makes the feature visible while avoiding an unrelated product decision about whether Meetups or Discover should be displaced.
    Date/Author: 2026-05-02 / Codex

- Decision: Route group notifications through the existing notification service and delivery queue rather than creating a group-specific notification subsystem.
    Rationale: The current notification package already owns unread counters, push delivery jobs, device routing, and user preferences. Extending it with group event methods keeps delivery behavior consistent while group-specific mute and preference checks stay in SQL against `group_notification_preferences`.
    Date/Author: 2026-05-02 / Codex

## Outcomes & Retrospective

Implementation is complete for the planned replacement scope. The Groups backend and app surfaces are in place for discovery, creation, membership, posts, images, comments, reactions, admin contact, reports, notifications, post moderation, dedicated admin tools, and dedicated report submission. Reflection UI/API surfaces have been removed from the app, and backend reflection routes/package/schema have been removed with a drop migration. Local migrations were applied and an authenticated API lifecycle smoke passed against the local API. Remaining risk is device-level visual QA in a simulator or physical development build, because the code-level Expo/TypeScript validation and local API smoke do not prove every React Native layout state visually.

## Context and Orientation

There are two repositories involved. The frontend repository is `/home/michaelroddy/repos/project_radeon_app`, an Expo React Native app. The backend repository is `/home/michaelroddy/repos/project_radeon`, a Go API backed by PostgreSQL.

The app currently centralizes API calls in `src/api/client.ts`. React Query keys live in `src/query/queryKeys.ts`. Query hooks live in `src/hooks/queries/`. The main tab shell is `src/navigation/AppNavigator.tsx`. Current main tabs are `community`, `discover`, `support`, `meetups`, and `chats`. Reflections are not a tab; they are opened as a separate screen from app navigation/profile flows. Reflection files include `src/screens/main/DailyReflectionScreen.tsx`, `src/screens/main/reflection/*`, `src/hooks/useReflectionForm.ts`, `src/hooks/useReflectionDraft.ts`, `src/hooks/queries/useReflections.ts`, `src/utils/reflections.ts`, and `src/screens/main/profile/ReflectionsTab.tsx`.

The backend currently has `internal/reflections` with handlers, store, types, and tests, plus migrations for `daily_reflections`. Posts, comments, reactions, images, and feed-serving logic live under `internal/feed`. Notifications live under `internal/notifications`. The canonical schema is `schema/base.sql`, and ordered migrations live in `migrations/`.

In this plan, a "group" means a recovery community with a name, description, photo, visibility level, rules, members, roles, posts, shared media, and admin controls. A "group post" means a durable item visible to permitted group members; it can contain text and images, and other members can comment and react. A "group media item" means an image attached to a group post, shown in a media grid that links back to the source post. A "join request" means a pending membership request that admins approve or reject. An "invite link" means a revocable token that lets users request or join a group according to group settings. "Cursor pagination" means the backend returns a token for the next page instead of using page numbers; this is more stable for infinite scrolling when new posts are being added.

The product inspiration is Sober Grid-style recovery community plus WhatsApp-style group administration, but without chat. The practical feature set is: discover groups, join/request access, invite members, post and share pictures, comment/react, view media and members, contact admins, moderate content, and manage group settings.

## Plan of Work

Implementation proceeds in seven milestones. Each milestone leaves the repositories in a working state and has a concrete validation path.

### Milestone 1: Backend group foundation and reflection deprecation scaffolding

Create a new backend package at `/home/michaelroddy/repos/project_radeon/internal/groups`. Do not edit `internal/reflections` destructively in the first milestone. The first milestone is additive so existing app builds are not broken while Groups are being built.

Add a migration after the current latest migration. The migration should create the core group tables:

- `groups`: id, owner_id, name, slug, description, rules, avatar_url, cover_url, visibility, posting_permission, allow_anonymous_posts, member_count, post_count, media_count, pending_request_count, created_at, updated_at, deleted_at.
- `group_memberships`: group_id, user_id, role, status, invited_by, joined_at, created_at, updated_at.
- `group_join_requests`: id, group_id, user_id, message, status, reviewed_by, reviewed_at, created_at.
- `group_invites`: id, group_id, token_hash, created_by, expires_at, max_uses, use_count, requires_approval, revoked_at, created_at.
- `group_admin_threads`: id, group_id, user_id, status, subject, created_at, updated_at.
- `group_admin_messages`: id, thread_id, sender_id, body, created_at.
- `group_reports`: id, group_id, reporter_id, target_type, target_id, reason, details, status, reviewed_by, reviewed_at, created_at.
- `group_audit_events`: id, group_id, actor_id, event_type, target_type, target_id, metadata_json, created_at.
- `group_notification_preferences`: group_id, user_id, post_notifications, comment_notifications, admin_notifications, muted_until, updated_at.

Use check constraints for `visibility`, `role`, `status`, and `target_type`. Use indexes that match the read paths: `groups(visibility, created_at DESC)`, `group_memberships(user_id, status, updated_at DESC)`, `group_memberships(group_id, status, role)`, `group_join_requests(group_id, status, created_at DESC)`, and `group_invites(group_id, revoked_at, expires_at)`.

Create `internal/groups/types.go` with plain Go structs for `Group`, `GroupMembership`, `GroupInvite`, `GroupJoinRequest`, `GroupAdminThread`, and the request/response DTOs. DTO means data transfer object: the JSON shape exchanged by the API. Create `internal/groups/store.go` for PostgreSQL access and `internal/groups/handler.go` for HTTP handlers. If cache wrappers are used immediately, add `internal/groups/cache_store.go`; otherwise leave caching for a later milestone and document the decision in this plan.

Implement permission helpers in the groups package. At minimum, create functions that answer: can view group, can post, can comment, can invite, can manage members, can manage settings, can moderate content, and can contact admins. These helpers must be used by handlers and stores instead of duplicating string comparisons across handlers.

At the end of this milestone, backend tests should prove that a user can create a group, the creator becomes owner, public groups are listable, approval-required groups create join requests, invite-only groups reject direct joins, and banned users cannot rejoin.

### Milestone 2: Backend group posts, images, comments, reactions, and media

Add post-based group content without adding chat. The preferred schema is group-specific content tables, because group posts have permission and moderation behavior that differs from the global home feed:

- `group_posts`: id, group_id, user_id, post_type, body, anonymous, pinned_at, pinned_by, deleted_at, created_at, updated_at, comment_count, reaction_count, image_count.
- `group_post_images`: id, group_id, post_id, image_url, thumb_url, width, height, position, created_at.
- `group_comments`: id, group_id, post_id, user_id, body, deleted_at, created_at, updated_at.
- `group_reactions`: group_id, post_id, user_id, type, created_at.
- `group_post_reports` can be folded into `group_reports` if `target_type` supports `post`, `comment`, `member`, and `group`.

Reuse the existing image upload approach from `internal/feed` when possible. If feed image uploading is tightly coupled to global posts, create a small shared image helper rather than copying upload code line-for-line. Image variants should include at least an original URL and thumbnail URL, because the app needs a performant media grid.

Expose post endpoints:

    GET    /groups/:id/posts
    POST   /groups/:id/posts
    PATCH  /groups/:id/posts/:post_id
    DELETE /groups/:id/posts/:post_id
    POST   /groups/:id/posts/:post_id/pin
    DELETE /groups/:id/posts/:post_id/pin
    GET    /groups/:id/posts/:post_id/comments
    POST   /groups/:id/posts/:post_id/comments
    DELETE /groups/:id/comments/:comment_id
    POST   /groups/:id/posts/:post_id/reactions
    DELETE /groups/:id/posts/:post_id/reactions
    GET    /groups/:id/media

Support these post types from the beginning: `standard`, `milestone`, `need_support`, `admin_announcement`, and `check_in`. `need_support` is an urgent peer-support post type, not a chat session. `admin_announcement` can be restricted to admins and moderators. `check_in` can be simple text in v1, with structured mood/craving fields deferred unless the backend schema is designed for them now.

At the end of this milestone, backend tests should show that only members can read private group posts, members can create allowed post types, admins can delete any group post, normal members can delete their own posts, pinned posts sort before normal posts, media returns only image posts visible to that viewer, and comments/reactions update counters without per-row count queries on list pages.

### Milestone 3: Backend discovery, admin inbox, invites, moderation, notifications, and seeds

Complete the backend product surface around group content. Add discovery query support with filters for `q`, `visibility`, `city`, `country`, `tag`, `recovery_pathway`, `member_scope`, and `limit`. If the first schema does not include tags/pathways, add `group_tags` and `group_recovery_pathways` before the app depends on those filters.

Implement these endpoints:

    GET    /groups
    POST   /groups
    GET    /groups/:id
    PATCH  /groups/:id
    DELETE /groups/:id
    POST   /groups/:id/join
    POST   /groups/:id/leave
    GET    /groups/:id/members
    PATCH  /groups/:id/members/:user_id
    DELETE /groups/:id/members/:user_id
    POST   /groups/:id/invites
    POST   /group-invites/:token/accept
    GET    /groups/:id/join-requests
    POST   /groups/:id/join-requests/:request_id/approve
    POST   /groups/:id/join-requests/:request_id/reject
    POST   /groups/:id/contact-admins
    GET    /groups/:id/admin-inbox
    POST   /groups/:id/admin-inbox/:thread_id/messages
    POST   /groups/:id/admin-inbox/:thread_id/resolve
    POST   /groups/:id/report

Add notification events for group join request received, join request approved, group invite received, admin contact reply, comment on group post, reaction on group post if desired, and admin announcement. Keep notification preferences group-scoped so users can mute a group without leaving it.

Update seeds in the backend so local development has realistic groups: a public alcohol-free group, an approval-required local Dublin group, an invite-only early recovery group, a private-hidden admin-created group, at least one group with multiple admins, several group posts with images, comments, reactions, pinned resources, join requests, and reports.

At the end of this milestone, a backend-only smoke run should create and exercise the full lifecycle: discover group, request access, approve request, create post, upload image, comment, react, contact admins, report post, remove post, and leave group.

### Milestone 4: Frontend API contracts, query hooks, and navigation replacement

In `/home/michaelroddy/repos/project_radeon_app`, add group types and API functions to `src/api/client.ts`. Follow the repository rule that shared API response types live beside the API functions. Define interfaces such as `Group`, `GroupSummary`, `GroupMember`, `GroupPost`, `GroupPostImage`, `GroupComment`, `GroupInvite`, `GroupJoinRequest`, `GroupAdminThread`, and `GroupReport`.

Add query keys in `src/query/queryKeys.ts`:

    groups(params)
    joinedGroups(limit)
    group(groupId)
    groupPosts(groupId, limit)
    groupMedia(groupId, limit)
    groupMembers(groupId, params)
    groupJoinRequests(groupId)
    groupAdminInbox(groupId)

Create hooks in `src/hooks/queries/useGroups.ts`. Use `useInfiniteQuery` for group lists, posts, media, and members. Use mutations for join, leave, invite, post creation, comments, reactions, pinning, moderation, admin contact, and reports. Scope invalidation narrowly: creating a post invalidates that group's posts and detail counters, not every group query in the app. Reacting to a post should optimistically update only that post in the active `groupPosts(groupId)` cache.

Replace reflection navigation in `src/navigation/AppNavigator.tsx`. Add a Groups tab or replace the reflection entry point according to the current product shell. The recommended final tab set is `community`, `groups`, `discover`, `support`, and `chats`, with Meetups either remaining if product requires it or staying where it is if this plan is not meant to alter main navigation. If there are only five tabs available and Meetups must remain, Groups should replace the old reflection/modal entry points without displacing existing tabs until a product owner decides the final tab set. Record the final choice in this plan's Decision Log during implementation.

Remove reflection open state from navigation once Groups are live: `reflectionOpen`, `openReflectionId`, `openReflection`, `closeReflection`, `openSavedReflection`, and `handleReflectionSaved`. Remove reflection-specific profile initial tab handling once the profile reflections tab is removed.

At the end of this milestone, the app compiles with group API contracts and can navigate to placeholder or skeletal group screens without importing reflection screens.

### Milestone 5: Frontend group screens and production interaction design

Create these app files:

- `src/screens/main/GroupsScreen.tsx`
- `src/screens/main/groups/GroupDetailScreen.tsx`
- `src/screens/main/groups/GroupPostsView.tsx`
- `src/screens/main/groups/GroupMediaView.tsx`
- `src/screens/main/groups/GroupMembersView.tsx`
- `src/screens/main/groups/GroupAboutView.tsx`
- `src/screens/main/groups/CreateGroupScreen.tsx`
- `src/screens/main/groups/GroupSettingsScreen.tsx`
- `src/screens/main/groups/GroupPostComposer.tsx`
- `src/screens/main/groups/GroupInviteSheet.tsx`
- `src/screens/main/groups/GroupMemberActionSheet.tsx`
- `src/screens/main/groups/GroupAdminInboxScreen.tsx`
- `src/screens/main/groups/GroupJoinRequestsScreen.tsx`

Use existing shared UI components where possible: `ScreenHeader`, `SearchBar`, `SegmentedControl`, `PrimaryButton`, `TextField`, `SurfaceCard`, `EmptyState`, `Avatar`, and feed/comment components where they fit. Do not duplicate the global feed UI wholesale if a small group-specific card is clearer.

`GroupsScreen` should show joined groups, suggested groups, and search/discovery. It must have loading, empty, error, and pull-to-refresh states. `GroupDetailScreen` should show a header with group name, photo, member count, visibility, join/leave/request state, and tabs for Posts, Media, Members, and About. `GroupPostsView` should use a virtualized list, cursor pagination, optimistic reactions, lazy comments, and a floating or header composer affordance. `GroupMediaView` should render a thumbnail grid and open the source post. `GroupMembersView` should paginate members and expose admin actions only when the viewer has permission. `GroupAboutView` should show rules, admins, invite/contact/report/leave actions, and group settings for admins.

The post composer should support text, image upload, post type selection, and admin announcement mode when allowed. It should not support chat semantics. "Need support" is a post type that creates a prominent post in the group feed and can trigger notifications, but it does not open a live chat room.

At the end of this milestone, a user can complete the core app flow against a running backend: create group, discover group, request to join, approve request from an admin account, create group post with image, comment, react, browse media, view members, contact admins, and leave group.

### Milestone 6: Remove reflections from frontend and backend

Once Groups are working end-to-end, remove the reflection feature completely.

In the app repository, delete or stop importing:

- `src/screens/main/DailyReflectionScreen.tsx`
- `src/screens/main/reflection/*`
- `src/screens/main/profile/ReflectionsTab.tsx`
- `src/hooks/useReflectionForm.ts`
- `src/hooks/useReflectionDraft.ts`
- `src/hooks/queries/useReflections.ts`
- `src/utils/reflections.ts`

Update:

- `src/navigation/AppNavigator.tsx` to remove reflection state and imports.
- `src/screens/main/ProfileTabScreen.tsx` to remove the reflections tab branch and `onOpenReflection` prop.
- `src/components/profile/ProfileContentTabs.tsx` to remove the `reflections` tab key and icon.
- `src/components/profile/ProfileEmptyTabState.tsx` to remove reflection-specific empty state.
- `src/query/queryKeys.ts` to remove reflection query keys.
- `src/api/client.ts` to remove `DailyReflection`, `UpsertDailyReflectionInput`, and reflection API functions.

In the backend repository, remove reflection routes from `cmd/api/main.go`, delete `internal/reflections` after all references are gone, and update `schema/base.sql` only after deciding how to handle historical `daily_reflections` data. The safe production approach is a two-step backend migration: first stop serving reflection APIs and leave data tables untouched, then later archive or drop `daily_reflections` in a separate migration after confirming no rollback needs it. If local-only cleanup is acceptable, add a migration that drops reflection-specific tables and removes the `daily_reflection` constraint value from posts only after shared reflection feed posts no longer need that source type.

At the end of this milestone, searching for `reflection`, `DailyReflection`, `daily_reflection`, and `reflections` should return no app feature code, except migration history or explicitly retained archival comments.

### Milestone 7: Performance, safety, and production hardening

Harden Groups after the happy path works. Add rate limits for creating groups, posts, comments, invites, join requests, admin-contact messages, and reports. Add server-side validation for group names, descriptions, rules, post bodies, image count, and invite limits. Add abuse prevention for new accounts: cap invite creation and posting volume until an account has a basic trust age or verified behavior.

Review list queries with `EXPLAIN ANALYZE` locally. Confirm group posts list pages do not perform count subqueries per row; counters should come from denormalized columns maintained by writes or triggers. Confirm member and media lists use indexes and cursor pagination. Confirm private-hidden groups do not leak in discovery, media, notifications, or search. Confirm banned users cannot access group detail, posts, media, members, or invite acceptance.

Add notification preference UI and backend enforcement. Add mute group behavior so a user can remain a member without receiving post notifications. Add admin audit log UI only if needed for v1 admin trust; otherwise keep the backend audit log available for support and future UI.

At the end of this milestone, Groups should be stable under realistic seeded data and safe enough for a recovery community beta.

## Concrete Steps

Before implementation, clean or intentionally carry the existing dirty work. Do not switch branches with unrelated modifications unless the user explicitly wants those edits moved into the Groups work.

In the app repository:

    cd /home/michaelroddy/repos/project_radeon_app
    git status --short --branch

If the status is clean or the user confirms carrying the dirty work:

    git checkout -b codex/post-based-groups-app

In the backend repository:

    cd /home/michaelroddy/repos/project_radeon
    git status --short --branch

If the status is clean or the user confirms carrying the dirty work:

    git checkout -b codex/post-based-groups-api

Inspect app reflection references before removing anything:

    cd /home/michaelroddy/repos/project_radeon_app
    rg -n "Reflection|reflection|DailyReflection|daily_reflection|reflections" src

Inspect backend reflection references before removing anything:

    cd /home/michaelroddy/repos/project_radeon
    rg -n "Reflection|reflection|DailyReflection|daily_reflection|reflections" internal cmd schema migrations

Implement backend milestones first, then run:

    cd /home/michaelroddy/repos/project_radeon
    go test ./...

If the backend has local migration tooling available, run the same migration command used elsewhere in this repo. Common local commands in this repository include:

    make migrate
    go run ./seeds
    go run ./cmd/api

If `make migrate` is not available in the current checkout, inspect `Makefile` and `cmd/migrate/main.go` before guessing. The expected successful test output is a sequence of `ok` lines for packages including `internal/groups`, `internal/feed`, `internal/notifications`, and any packages touched by route registration.

Implement frontend milestones after backend contracts are stable, then run:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit
    npx expo start

No dedicated lint or test command is configured in the app. TypeScript compilation and manual Expo validation are the minimum frontend checks.

## Validation and Acceptance

Validation must prove user-visible behavior, permissions, performance, and reflection removal.

Backend unit and handler tests must verify group creation, visibility, join/request/approval flows, invite links, role changes, membership removal, banning, post creation, image attachment, comments, reactions, pinning, media listing, admin contact, reports, and notification preference behavior. Tests should include at least one non-member, one member, one moderator, one admin, one owner, one pending user, and one banned user.

Manual end-to-end acceptance should use at least three accounts. Account A creates an approval-required group with rules and a group image. Account B finds the group in search, requests access, and cannot see posts before approval. Account A approves B. Account B creates a text post and an image post. Account C cannot see the private content unless it joins. Account A pins an announcement. Account B comments and reacts. Account A removes a comment as admin. Account B contacts admins through the admin inbox. Account A replies and resolves the thread. Account B leaves the group. The app should show correct counts and permissions at every step.

Media acceptance requires that image posts appear in the Posts tab and their images also appear in the Media tab. Tapping a media item should open the source post. The media grid must use thumbnails, not full-size images, so it remains smooth under a seeded group with dozens of images.

Performance acceptance requires cursor pagination for group posts, media, and members. Opening a group should not fetch every member or every image. Scrolling posts should be virtualized and should not re-render the entire list when one post receives a reaction. Creating a comment or reaction should update the active post optimistically without invalidating all groups globally.

Safety acceptance requires that private-hidden groups do not appear in discovery, invite-only groups cannot be joined directly, banned users cannot use stale invite links, normal members cannot promote users or delete other members' posts, admins cannot demote the owner, and owners cannot leave without transferring ownership or deleting the group.

Reflection removal acceptance requires:

    cd /home/michaelroddy/repos/project_radeon_app
    rg -n "Reflection|reflection|DailyReflection|daily_reflection|reflections" src

The command should return no app feature references after the removal milestone. It is acceptable for migration history in the backend to retain old reflection names, but active backend routes and packages should no longer serve reflection APIs.

Frontend typecheck acceptance requires:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Backend test acceptance requires:

    cd /home/michaelroddy/repos/project_radeon
    go test ./...

## Idempotence and Recovery

The implementation should be additive until Groups are proven. Do not delete reflection files or drop reflection backend routes in the same milestone that introduces group schema. If a groups milestone fails, the app should still compile with the old reflections feature until the replacement is ready.

Migrations must be safe to run once and must use `IF NOT EXISTS` where appropriate for indexes and helper functions. Destructive reflection data cleanup must be split into a later migration after route removal is validated. If production data exists, do not drop `daily_reflections` until the user has approved data archival or deletion.

Invite links should store token hashes, not raw tokens, so leaked database rows cannot be used as invites. If invite acceptance fails halfway, retrying should either create the membership once or return a clear already-member response. Join request approval should be idempotent: approving an already-approved request should not create duplicate memberships.

If image upload fails after a group post is created, either the post should be created without the failed image and report partial failure clearly, or the whole transaction should roll back. Choose one behavior and record it in the Decision Log before implementing image writes.

If app navigation migration becomes unstable, keep Groups behind a temporary internal entry point and do not remove reflections until the Groups tab is stable. The final state must still remove reflections completely.

## Interfaces and Dependencies

Backend implementation should define a groups store interface with methods similar to:

    CreateGroup(ctx context.Context, ownerID uuid.UUID, input CreateGroupInput) (*Group, error)
    ListGroups(ctx context.Context, viewerID uuid.UUID, params ListGroupsParams) (*CursorPage[GroupSummary], error)
    GetGroup(ctx context.Context, viewerID, groupID uuid.UUID) (*GroupDetail, error)
    UpdateGroup(ctx context.Context, viewerID, groupID uuid.UUID, input UpdateGroupInput) (*Group, error)
    JoinGroup(ctx context.Context, viewerID, groupID uuid.UUID, message string) (*JoinGroupResult, error)
    LeaveGroup(ctx context.Context, viewerID, groupID uuid.UUID) error
    ListMembers(ctx context.Context, viewerID, groupID uuid.UUID, params ListMembersParams) (*CursorPage[GroupMember], error)
    UpdateMember(ctx context.Context, viewerID, groupID, targetUserID uuid.UUID, input UpdateMemberInput) (*GroupMember, error)
    CreateInvite(ctx context.Context, viewerID, groupID uuid.UUID, input CreateInviteInput) (*GroupInvite, error)
    AcceptInvite(ctx context.Context, viewerID uuid.UUID, token string) (*GroupDetail, error)
    CreatePost(ctx context.Context, viewerID, groupID uuid.UUID, input CreateGroupPostInput) (*GroupPost, error)
    ListPosts(ctx context.Context, viewerID, groupID uuid.UUID, params ListGroupPostsParams) (*CursorPage[GroupPost], error)
    CreateComment(ctx context.Context, viewerID, groupID, postID uuid.UUID, input CreateGroupCommentInput) (*GroupComment, error)
    ReactToPost(ctx context.Context, viewerID, groupID, postID uuid.UUID, reactionType string) (*GroupPost, error)
    ListMedia(ctx context.Context, viewerID, groupID uuid.UUID, params ListGroupMediaParams) (*CursorPage[GroupMediaItem], error)
    ContactAdmins(ctx context.Context, viewerID, groupID uuid.UUID, input ContactGroupAdminsInput) (*GroupAdminThread, error)
    ReportTarget(ctx context.Context, viewerID, groupID uuid.UUID, input GroupReportInput) (*GroupReport, error)

Frontend API functions in `src/api/client.ts` should mirror those backend contracts:

    listGroups(params?: ListGroupsParams): Promise<CursorResponse<GroupSummary>>
    createGroup(input: CreateGroupInput): Promise<GroupDetail>
    getGroup(groupId: string): Promise<GroupDetail>
    updateGroup(groupId: string, input: UpdateGroupInput): Promise<GroupDetail>
    joinGroup(groupId: string, message?: string): Promise<JoinGroupResult>
    leaveGroup(groupId: string): Promise<void>
    listGroupPosts(groupId: string, cursor?: string, limit?: number): Promise<CursorResponse<GroupPost>>
    createGroupPost(groupId: string, input: CreateGroupPostInput): Promise<GroupPost>
    listGroupMedia(groupId: string, cursor?: string, limit?: number): Promise<CursorResponse<GroupMediaItem>>
    listGroupMembers(groupId: string, cursor?: string, limit?: number): Promise<CursorResponse<GroupMember>>
    createGroupInvite(groupId: string, input: CreateGroupInviteInput): Promise<GroupInvite>
    acceptGroupInvite(token: string): Promise<GroupDetail>
    contactGroupAdmins(groupId: string, input: ContactGroupAdminsInput): Promise<GroupAdminThread>
    reportGroupTarget(groupId: string, input: GroupReportInput): Promise<GroupReport>

Do not add a WebSocket or group-chat dependency. Existing one-to-one chat code under `src/hooks/chat`, `src/hooks/queries/useChat*`, and backend `internal/chats` should not be reused for Groups except for general notification patterns.

## Artifacts and Notes

The external product inspiration behind the plan is summarized here so implementation does not require external reading. Sober recovery community products commonly support anonymous or pseudonymous profiles, sober peer discovery, community posts with media, group-filtered feeds, privacy controls, and urgent support signals. WhatsApp-style group administration commonly includes roles, invite links, join approvals, member management, shared media, and group settings. This plan keeps the useful administration and community ideas while deliberately excluding chat.

At authoring time, branch creation was skipped because both repositories had unrelated dirty work. The implementation owner should create branches only after deciding how to handle that dirty work.

Revision note: Initial ExecPlan created on 2026-05-02 by Codex after the user clarified that Groups should have no group chat and should replace reflections completely.
