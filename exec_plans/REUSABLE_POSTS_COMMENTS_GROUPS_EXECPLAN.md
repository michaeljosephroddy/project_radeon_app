# Reuse Post and Comment UI Between Community Feed and Groups

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `PLANS.md` at the root of `/home/michaelroddy/repos/project_radeon_app`.

## Purpose / Big Picture

The app currently has two separate implementations for post-like content. The Community feed has a polished post card, comments modal, and create-post floating action button. The Groups detail screen has a separate inline group post card, inline group comments panel, and inline group composer. This duplication makes the Groups posts section feel less mature than the Community feed and will make future post features expensive to build twice.

After this change, the Groups posts tab should visually and behaviorally mirror the Community feed where the underlying product rules match. A user should see group posts rendered with the same card structure, action row, image handling, and create-post FAB style used by the For You feed. When the user taps comments on either a feed post or group post, the same reusable comment modal should open, while each surface still calls its own backend endpoints. The work is complete when the Community feed still behaves as it does today, and group posts use the shared post card, shared create FAB, and shared comments modal rather than their inline implementations.

## Progress

- [x] (2026-05-02T20:35Z) Confirmed the current Groups UI and backend caching work was committed and pushed to `origin/main` in both `/home/michaelroddy/repos/project_radeon_app` and `/home/michaelroddy/repos/project_radeon`.
- [x] (2026-05-02T20:35Z) Created frontend branch `codex/reusable-post-comments-plan` from the pushed app `main` branch.
- [x] (2026-05-02T20:35Z) Reviewed `PLANS.md` and the existing Groups ExecPlan to match the required living-document format.
- [x] (2026-05-02T20:35Z) Reviewed `src/screens/main/FeedScreen.tsx`, `src/components/CommentsModal.tsx`, `src/screens/main/groups/GroupDetailScreen.tsx`, `src/navigation/AppNavigator.tsx`, and `src/hooks/queries/useGroups.ts` to identify duplication and API differences.
- [x] (2026-05-02T20:35Z) Authored this ExecPlan in `exec_plans/REUSABLE_POSTS_COMMENTS_GROUPS_EXECPLAN.md`.
- [x] (2026-05-02T20:47Z) Implemented Milestone 1: added shared post display types and feed/group mapping helpers under `src/components/posts/`.
- [x] (2026-05-02T20:47Z) Implemented Milestone 2: extracted `PostCard` and `CreatePostFab`, then migrated `FeedScreen` normal feed posts and feed FAB to use them.
- [x] (2026-05-02T20:47Z) Implemented Milestone 3: split comments into `CommentThread`, `CommentThreadModal`, comment adapter types, and a feed-compatible `CommentsModal` wrapper.
- [x] (2026-05-02T20:47Z) Implemented Milestone 4: migrated the Groups posts tab to shared `PostCard`, shared `CommentThreadModal`, shared `CreatePostFab`, and a modal group post composer.
- [x] (2026-05-02T20:47Z) Ran `npx tsc --noEmit`; TypeScript passed.
- [x] (2026-05-02T20:47Z) Ran `git diff --check`; whitespace validation passed.
- [x] (2026-05-02T20:56Z) Fixed follow-up QA findings: group comments now open through the root app overlay like Community feed comments, group post creation now uses `CreatePostScreen` in group-target mode instead of a temporary modal composer, and `GroupDetailScreen` handles bottom safe area when replacing the tab bar.
- [x] (2026-05-02T20:56Z) Reran `npx tsc --noEmit`; TypeScript passed.
- [x] (2026-05-02T20:56Z) Reran `git diff --check`; whitespace validation passed.
- [x] (2026-05-02T21:07Z) Decoupled feature wrappers from shared UI: extracted `PostComposer`, restored `CreatePostScreen` to a feed wrapper, added `GroupCreatePostScreen`, added `FeedCommentsModal`, added `GroupCommentsModal`, removed the old generic-looking `components/CommentsModal.tsx`, and removed feed/group API branching from shared components.
- [x] (2026-05-02T21:07Z) Reran `npx tsc --noEmit`; TypeScript passed.
- [x] (2026-05-02T21:07Z) Reran `git diff --check`; whitespace validation passed.
- [ ] Perform device/simulator visual QA for Community feed and Groups posts.

## Surprises & Discoveries

- Observation: The Community feed post card is visually reusable but is declared inside `src/screens/main/FeedScreen.tsx`, so no other surface can import it.
    Evidence: `PostCard` is a local `React.memo` component beginning around `src/screens/main/FeedScreen.tsx`, and its styles are local to the same file.

- Observation: The Community feed comments modal is already a full-screen modal-like surface with keyboard handling, pagination, mention search, optimistic comments, and user profile taps, but it hardcodes feed comment endpoints.
    Evidence: `src/components/CommentsModal.tsx` calls `api.getFeedItemComments` and `api.addFeedItemComment` directly using `CommentThreadTarget.itemId` and `CommentThreadTarget.itemKind`.

- Observation: Group comments are currently inline inside the group post card, so group comments do not match the feed's modal behavior.
    Evidence: `GroupPostCard` conditionally renders `GroupCommentsPanel` in `src/screens/main/groups/GroupDetailScreen.tsx`, and `GroupCommentsPanel` calls `useGroupComments` and `useCreateGroupCommentMutation`.

- Observation: Group post creation currently happens through an inline composer at the top of the group posts list, not through the feed-style FAB.
    Evidence: `GroupPostsTab` renders a `ListHeaderComponent` containing `TextField`, photo picker, and post button in `src/screens/main/groups/GroupDetailScreen.tsx`.

- Observation: Keeping feed comment API wiring in `src/components/CommentsModal.tsx` made a component-layer file look generic while it was actually feed-specific.
    Evidence: The cleanup moved feed comment wiring into `src/screens/main/feed/FeedCommentsModal.tsx` and group comment wiring into `src/screens/main/groups/GroupCommentsModal.tsx`.

- Observation: Rendering group comments inside `GroupPostsTab` constrained the modal to the area below the group header and tabs.
    Evidence: User QA reported that the group comments modal was not fullscreen. The fix moved group comment state and `CommentThreadModal` rendering into `AppNavigator`, matching the root overlay path used by Community feed comments.

- Observation: Making `CreatePostScreen` target-aware coupled the feed composer screen to group post submission.
    Evidence: The cleanup extracted `src/screens/main/createPost/PostComposer.tsx`; `CreatePostScreen` now submits feed posts only, while `GroupCreatePostScreen` submits group posts only.

## Decision Log

- Decision: Share UI and interaction components, but keep feed and group API calls separate through adapters.
    Rationale: Feed items and group posts have different backend concepts. Feed supports reshares, hide, mute, telemetry, and feed item kinds. Groups support membership permissions, pinned posts, anonymous posts, group post types, and moderation. A shared UI layer should not force those data models into one backend abstraction.
    Date/Author: 2026-05-02 / Codex

- Decision: Comments should remain a modal or modal-like full-screen overlay, not become a separate navigation screen for this refactor.
    Rationale: Comments are secondary to a post. A modal lets users close comments and return to the exact feed or group scroll position. A separate screen can be added later for deep links by reusing the same `CommentThread` component.
    Date/Author: 2026-05-02 / Codex

- Decision: Extract reusable comments in two layers: `CommentThread` for the list/composer UI and `CommentThreadModal` for the full-screen animated presentation.
    Rationale: This keeps the reusable UI available for future inline or bottom-sheet uses while preserving the current feed modal experience.
    Date/Author: 2026-05-02 / Codex

- Decision: Migrate the Community feed first after extraction, then migrate Groups.
    Rationale: The feed is the current reference implementation. Proving the extracted components preserve feed behavior before changing Groups reduces the chance of regressing the primary community surface.
    Date/Author: 2026-05-02 / Codex

- Decision: Do not add backend changes for this refactor unless validation exposes a missing API capability.
    Rationale: The backend already has feed comments and group comments endpoints. This work is about making the frontend use one UI implementation with separate adapters.
    Date/Author: 2026-05-02 / Codex

- Decision: Keep shared UI components generic and move feed/group API calls into feature wrappers.
    Rationale: `PostComposer`, `PostCard`, `CreatePostFab`, `CommentThread`, and `CommentThreadModal` should be reusable without importing feed or group mutations. Feed and group wrappers can transform shared UI outputs into their own API payloads without coupling the shared layer to product-specific endpoints.
    Date/Author: 2026-05-02 / Codex

## Outcomes & Retrospective

The first implementation pass is complete at the code-validation level. Shared post display models, a reusable post card, a reusable create-post FAB, reusable comment thread components, and adapter-driven feed/group comment wiring now exist. The Community feed still uses its existing feed-specific logic for telemetry, share, hide, mute, and reactions, while normal feed post rendering and the FAB come from shared components. The Groups posts tab now renders with the shared post card, opens the shared root-level comments modal, and uses the shared FAB to open `CreatePostScreen` in group-target mode instead of showing an always-visible inline composer.

Remaining risk is visual and interaction QA on a simulator or device. `npx tsc --noEmit` and `git diff --check` pass, but those commands do not prove that the modal composer feels right on small screens, that the group FAB clears the tab bar in every device size, or that comment modal keyboard behavior matches the existing feed behavior after extraction.

Follow-up QA changed the direction for group creation: the group FAB now opens a full-screen group create-post wrapper that uses the same shared `PostComposer` as the Community feed. Group comments now render through `GroupCommentsModal` as a root overlay, so they should match the Community feed modal footprint rather than being constrained by the group posts tab. `GroupDetailScreen` now uses bottom safe-area handling because it replaces the app tab bar. A later cleanup pass removed the temporary target-aware `CreatePostScreen` and replaced it with feed-specific and group-specific wrappers around shared UI.

## Context and Orientation

This repository is `/home/michaelroddy/repos/project_radeon_app`, an Expo React Native app. It talks to a Go backend through the API client in `src/api/client.ts`. All backend calls from screens and hooks should go through that file. React Query hooks live in `src/hooks/queries/`.

The Community feed lives in `src/screens/main/FeedScreen.tsx`. It currently owns its local `PostCard`, `ReshareCard`, feed scroll behavior, telemetry, local reaction state, hide/mute/share actions, comments opening, and create-post FAB. In this plan, "FAB" means floating action button: the pill-shaped Create button that floats near the bottom of the feed and opens the post composer.

The reusable comments surface lives in `src/components/comments/CommentThread.tsx` and `src/components/comments/CommentThreadModal.tsx`. Feed-specific wiring lives in `src/screens/main/feed/FeedCommentsModal.tsx`. Group-specific wiring lives in `src/screens/main/groups/GroupCommentsModal.tsx`.

The Groups list lives in `src/screens/main/GroupsScreen.tsx`. Opening a group renders `src/screens/main/groups/GroupDetailScreen.tsx` through `src/navigation/AppNavigator.tsx`. The group detail posts tab currently owns the group post list, inline create composer, inline group post card, inline comment panel, image picker, group post mutations, group reaction mutation, pin mutation, and delete mutation.

The relevant backend response types are in `src/api/client.ts`. Feed posts use `api.FeedItem`, `api.Post`, and `api.Comment`. Group posts use `api.GroupPost` and `api.GroupComment`. Feed comments are loaded through `api.getFeedItemComments(itemId, itemKind, cursor, limit)` and created through `api.addFeedItemComment(itemId, itemKind, body, mentionUserIds)`. Group comments are loaded through `api.listGroupComments(groupId, postId, cursor, limit)` and created through `api.createGroupComment(groupId, postId, body)`.

In this plan, an "adapter" means a small object or set of callback functions that hides the difference between feed APIs and group APIs from a reusable UI component. For example, the comment UI should call `loadComments(cursor)` and `createComment(body, mentionUserIds)`, while the parent decides whether those callbacks call feed endpoints or group endpoints.

## Plan of Work

### Milestone 1: Shared display types and mapping helpers

Add shared frontend-only types under `src/components/posts/`. Create `src/components/posts/postTypes.ts` with a normalized post display model. This model should describe what the shared UI needs to render, not every field from every API response. It should include `id`, `authorId`, `username`, `avatarUrl`, `body`, `createdAt`, optional `sourceLabel`, optional `badgeLabel`, optional `imageUrl`, optional `tags`, `reactionCount`, `commentCount`, `viewerHasReacted`, `isPinned`, `isOwn`, and `isAnonymous`.

Create mapping helpers in `src/components/posts/postMappers.ts`. Add `feedItemToPostDisplayModel(item, currentUserId)` and `groupPostToPostDisplayModel(post, currentUserId)`. The feed mapper should preserve the current behavior of `feedItemToPost` in `FeedScreen.tsx`. The group mapper should translate `GroupPost.post_type` into a small badge label such as `Post`, `Milestone`, `Needs support`, `Announcement`, or `Check-in`, set `isPinned` from `pinned_at`, and use `Anonymous member` when the group post is anonymous.

This milestone should not change visible UI. It should only add types and helpers, then update no call sites or only add focused tests if the repo has an existing testing setup. Since the app currently has no dedicated test or lint command, validation is `npx tsc --noEmit` from `/home/michaelroddy/repos/project_radeon_app`.

### Milestone 2: Extract shared `PostCard` and `CreatePostFab`

Create `src/components/posts/PostCard.tsx`. Move the non-reshare feed post card JSX and styles from `src/screens/main/FeedScreen.tsx` into this component. Keep it presentational. It should receive a `PostDisplayModel` plus callbacks for `onReact`, `onOpenComments`, `onPressUser`, optional `onOpenActions`, optional `onShare`, and optional `onPressPinned`. It should render the same layout as the current feed card: avatar, author name, timestamp, optional source or badge line, optional body, optional image, optional tags, and action row.

The component must not call `api.reactToFeedItem` or `api.toggleGroupPostReaction` itself. Parent screens own API calls and cache updates. This keeps the shared card usable for feed and groups.

Create `src/components/posts/CreatePostFab.tsx`. Move the visual style of the feed create FAB into this component. It should accept `visible`, `bottom`, `label`, `onPress`, and optional `disabled`. The default label should be `Create`. The feed should use it with the same bottom positioning it uses today. Groups should later use it with the label `Post` or `Create`, depending on which reads better in the final UI. Prefer `Create` for visual parity unless product copy says otherwise.

Update `src/screens/main/FeedScreen.tsx` to import and use these components for normal posts and the create FAB. Keep the local `ReshareCard` in `FeedScreen.tsx` for this milestone unless it is trivial to adapt, because group posts do not need reshare support. Preserve feed telemetry, share, hide, mute, scroll-to-top, and local reaction behavior in `FeedScreen.tsx`.

Validation after this milestone: run `npx tsc --noEmit`, start Expo with `npx expo start` if it is not already running, open the Community For You tab, and confirm normal feed posts look unchanged and the Create FAB appears, hides during downward scroll, and opens `CreatePostScreen`.

### Milestone 3: Extract reusable comment thread and modal adapter surface

Create `src/components/comments/commentTypes.ts`. Define `CommentDisplayModel` with `id`, `userId`, `username`, optional `avatarUrl`, `body`, `createdAt`, and optional `mentions`. Define a `CommentThreadAdapter` interface with:

    loadComments(cursor?: string): Promise<api.CursorResponse<CommentDisplayModel>>;
    createComment(body: string, mentionUserIds?: string[]): Promise<CommentDisplayModel>;
    searchMentionUsers?(query: string): Promise<api.User[]>;

The adapter can use `api.CursorResponse` because that type already represents paginated server responses in `src/api/client.ts`. If `api.CursorResponse` is not exported, export it there rather than duplicating the shape.

Create `src/components/comments/CommentThread.tsx`. Move the comment list, row, empty state, mention parsing, mention search, optimistic submit, and composer UI out of `CommentsModal.tsx` into `CommentThread`. The component should receive `adapter`, `currentUser`, `initialCommentCount`, `focusComposer`, `onPressUser`, and `onCommentCreated`. It should not know whether comments belong to a feed post or group post.

Create `src/components/comments/CommentThreadModal.tsx`. Move the slide-in animation, safe-area-aware header, Android back handler, keyboard provider, and close button from `CommentsModal.tsx` into this wrapper. It should render `CommentThread` inside the modal shell.

Add feed and group wrapper modals instead of keeping endpoint wiring in the shared component layer. `src/screens/main/feed/FeedCommentsModal.tsx` should build the feed comment adapter from the current `CommentThreadTarget` and render `CommentThreadModal`. `src/screens/main/groups/GroupCommentsModal.tsx` should build the group comment adapter from the selected group post and render the same shared modal.

Validation after this milestone: run `npx tsc --noEmit`, open comments from a feed post, load existing comments, add a new comment, mention a user if discover search is available, close the modal, and verify the feed post comment count updates through the existing `onCommentCreated` callback.

### Milestone 4: Migrate group posts to shared post card, shared comments modal, and shared FAB

Update `src/screens/main/groups/GroupDetailScreen.tsx`. Replace the inline `GroupPostCard` rendering with `PostCard`. The render callback should map each `api.GroupPost` to `PostDisplayModel` using `groupPostToPostDisplayModel`. The `onReact` callback should continue to call `useToggleGroupPostReactionMutation(group.id).mutate(post.id)`. The `onOpenComments` callback should set local state for the selected group post and open `CommentThreadModal` with a group adapter. The group adapter should call `api.listGroupComments(group.id, post.id, cursor)` and `api.createGroupComment(group.id, post.id, body)`. It should map `api.GroupComment` to `CommentDisplayModel`.

Remove the inline `GroupCommentsPanel` from `GroupDetailScreen.tsx` after the modal path works. The comment count should still update optimistically through `useCreateGroupCommentMutation` or a local callback that updates the React Query cache for `['groups', 'posts', groupId]`. Prefer reusing the existing mutation helper in `src/hooks/queries/useGroups.ts` if it can expose a function that increments counts without forcing the reusable component to import group-specific hooks.

Move group pin/remove actions into the shared post card's action menu. The group card should pass `onOpenActions` when `group.can_moderate_content` is true. The action handler should show an `Alert.alert` menu or an existing action-sheet pattern if the app already has one. Options should be `Pin` or `Unpin`, `Remove`, and `Cancel`. Normal members should not see moderation actions.

Replace the inline group post composer header with `CreatePostFab`. Do not remove group post creation capability. For the first implementation, create a simple group post composer modal in `GroupDetailScreen.tsx` that reuses the existing group image upload logic from the inline composer. The modal should open from the shared FAB and submit through `useCreateGroupPostMutation(group.id)`. It can be local to `GroupDetailScreen.tsx` for now, because fully unifying `CreatePostScreen` for feed and groups is a separate larger composer refactor.

The group list should keep its current tabs for Posts, Media, Members, and About. Only the Posts tab rendering, comments, and composer entry point change in this plan.

Validation after this milestone: run `npx tsc --noEmit`, open Community > Groups, open a group, use the Posts tab, tap the FAB to create a text post, create an image post, like a post, open comments in the modal, add a comment, close the modal, and verify the post remains in place with updated counts. For an admin account, verify pin and remove actions still work.

### Milestone 5: Visual parity, performance, and cleanup

Review `src/screens/main/FeedScreen.tsx` and `src/screens/main/groups/GroupDetailScreen.tsx` for dead local styles and helper functions that were superseded by shared components. Remove unused imports, duplicate styles, and the inline `GroupPostCard` and `GroupCommentsPanel` implementations.

Make sure `PostCard` uses stable props and `React.memo` where appropriate. Avoid passing newly created inline objects into every row if doing so causes FlatList row rerenders. The mapper can run inside a memoized render path, but the action callbacks should be stable with `useCallback` where practical.

Run `npx tsc --noEmit`. Run `git diff --check`. If Expo is already running, reload the app. If not, run `npx expo start` from `/home/michaelroddy/repos/project_radeon_app`. Test both a narrow mobile simulator viewport and a larger device if available. Confirm that text does not overlap in the post card, images have stable aspect ratio, comments do not bleed into the status bar, and the FAB does not cover the bottom tab bar or modal composer.

## Concrete Steps

Start from a clean branch:

    cd /home/michaelroddy/repos/project_radeon_app
    git status -sb

Expected before implementation:

    ## codex/reusable-post-comments-plan

Create the shared post files:

    src/components/posts/postTypes.ts
    src/components/posts/postMappers.ts
    src/components/posts/PostCard.tsx
    src/components/posts/CreatePostFab.tsx

Create the shared comment files:

    src/components/comments/commentTypes.ts
    src/components/comments/CommentThread.tsx
    src/components/comments/CommentThreadModal.tsx

Refactor compatibility wrapper:

    src/components/CommentsModal.tsx

Update feed call sites:

    src/screens/main/FeedScreen.tsx

Update group call sites:

    src/screens/main/groups/GroupDetailScreen.tsx

If `AppNavigator` needs to support group comment modal state globally, update:

    src/navigation/AppNavigator.tsx

Prefer keeping the group comment modal local to `GroupDetailScreen.tsx` unless notification deep links to group comments require global routing. Existing group notification handling currently opens group detail, not a specific group comment thread.

After each milestone, run:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit
    git diff --check

When ready for visual QA, run:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

## Validation and Acceptance

Acceptance is user-visible. The refactor is not complete just because TypeScript passes.

Community feed acceptance:

- The For You feed renders normal posts with the same layout as before extraction.
- The feed Create FAB appears at the same position, hides during scroll as before, and opens `CreatePostScreen`.
- Tapping Like on a feed post updates the heart state and count.
- Tapping Comment opens the comment modal, loads existing comments, submits a new comment, and updates the feed post comment count.
- Tapping Share, hide, mute, and profile actions still works as before.

Groups acceptance:

- Community > Groups still opens the groups list and group detail screens.
- The group Posts tab uses the shared post card layout, not the old boxed inline group card layout.
- Group posts show author, timestamp, body, image, comment count, reaction count, pinned state, and post type badge where relevant.
- Tapping Like on a group post updates the reaction state and count.
- Tapping Comment opens the same comment modal layout used by the feed.
- Submitting a group comment calls the group comment API and updates the group post comment count.
- Admin pin and remove actions remain available to moderators/admins and hidden from regular members.
- Group post creation is opened from the shared create FAB, not from an always-visible inline composer at the top of the list.

Technical validation:

- `npx tsc --noEmit` exits with code 0.
- `git diff --check` exits with code 0.
- No screen imports `fetch` directly.
- Shared UI components do not import `useGroupPosts`, `useHomeFeed`, `api.reactToFeedItem`, or `api.toggleGroupPostReaction`; parent screens or adapter builders own those calls.

## Idempotence and Recovery

This refactor is additive before it is subtractive. First create shared components and use them in the feed while keeping behavior unchanged. Then migrate group posts. Only remove old inline group components after the shared path is working.

If feed comments regress, restore the previous feed wrapper behavior in `src/screens/main/feed/FeedCommentsModal.tsx` rather than changing the shared `CommentThread` components. If group comments regress, restore the old inline `GroupCommentsPanel` from git history while keeping the shared comment components for feed.

If the group composer refactor grows too large, keep the inline composer temporarily and complete the shared post card plus shared comments migration first. The FAB composer can be completed in a follow-up milestone, but this plan should record that deviation in `Decision Log` and `Progress`.

No database migrations are expected. No backend routes are expected. If implementation discovers a backend gap, pause and update this ExecPlan with the missing endpoint or response field before changing backend code.

## Artifacts and Notes

The current pushed app commit before this plan is:

    ca53921 Move groups into community feed

The current pushed backend commit before this plan is:

    ab188d1 Add group caching and richer seed data

Important existing source locations:

    src/screens/main/FeedScreen.tsx
        Owns the current feed post card, reshare card, create FAB, feed telemetry, and feed actions.

    src/components/CommentsModal.tsx
        Owns the current feed comments modal, including keyboard handling, mention search, pagination, and optimistic submit.

    src/screens/main/groups/GroupDetailScreen.tsx
        Owns the current group posts tab, inline group composer, inline group post card, inline comments panel, and group admin post actions.

    src/hooks/queries/useGroups.ts
        Owns group post, reaction, comment, pin, and delete mutations plus React Query cache updates.

## Interfaces and Dependencies

The shared post UI should expose these interfaces, adjusting exact names only if implementation reveals a clearer local convention:

    export interface PostDisplayModel {
        id: string;
        authorId: string;
        username: string;
        avatarUrl?: string;
        body: string;
        createdAt: string;
        sourceLabel?: string;
        badgeLabel?: string;
        imageUrl?: string;
        tags?: string[];
        reactionCount: number;
        commentCount: number;
        viewerHasReacted: boolean;
        isPinned?: boolean;
        isOwn?: boolean;
        isAnonymous?: boolean;
    }

    export interface PostCardProps {
        post: PostDisplayModel;
        onReact: () => void;
        onOpenComments: () => void;
        onPressUser?: () => void;
        onOpenActions?: () => void;
        onShare?: () => void;
        showShareAction?: boolean;
    }

    export interface CreatePostFabProps {
        visible: boolean;
        bottom: number;
        onPress: () => void;
        label?: string;
        disabled?: boolean;
    }

The shared comments UI should expose these interfaces:

    export interface CommentDisplayModel {
        id: string;
        userId: string;
        username: string;
        avatarUrl?: string;
        body: string;
        createdAt: string;
        mentions?: api.CommentMention[];
    }

    export interface CommentThreadAdapter {
        loadComments: (cursor?: string) => Promise<api.CursorResponse<CommentDisplayModel>>;
        createComment: (body: string, mentionUserIds?: string[]) => Promise<CommentDisplayModel>;
        searchMentionUsers?: (query: string) => Promise<api.User[]>;
    }

    export interface CommentThreadProps {
        adapter: CommentThreadAdapter;
        currentUser: api.User;
        initialCommentCount: number;
        focusComposer: boolean;
        onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
        onCommentCreated?: (comment: CommentDisplayModel) => void;
    }

    export interface CommentThreadModalProps extends CommentThreadProps {
        title?: string;
        onClose: () => void;
    }

Use existing dependencies only: React, React Native, `@expo/vector-icons`, `react-native-safe-area-context`, `react-native-keyboard-controller`, `react-native-reanimated`, and the existing theme modules. Do not add a new UI library or state-management library for this refactor.

## Revision Notes

- 2026-05-02 / Codex: Initial ExecPlan authored after current frontend and backend Groups work was committed and pushed. The plan is frontend-only unless implementation discovers a backend gap.
