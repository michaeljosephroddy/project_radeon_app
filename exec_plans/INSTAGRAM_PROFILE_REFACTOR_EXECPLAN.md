# Instagram-style profile refactor

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root. It is self-contained so a contributor can continue the work without prior context.

## Purpose / Big Picture

Project Radeon currently shows another user's profile as a banner, centered avatar, metadata, and a vertical list of full post cards. After this change, someone visiting a user profile will see a more familiar social profile layout inspired by Instagram: a compact identity header, a stats row, action buttons, and icon subtabs for Posts, Reposts, and Tagged content. The Posts tab will show authored media in a three-column grid. Reposts and Tagged will have first-class tab slots with empty-state behavior until backend data is available.

The work is primarily in the Expo app at `/home/michaelroddy/repos/project_radeon_app`. The app talks to a Go backend, but this plan keeps the first milestone frontend-focused because the existing backend only exposes authored posts through `GET /users/:id/posts`. Repost data exists in the backend database model, but no user-profile endpoint exists yet. Tagged-post data does not yet have a backend model.

## Progress

- [x] (2026-05-01 12:38Z) Created app branch `feature/instagram-profile-refactor`.
- [x] (2026-05-01 12:41Z) Inspected `src/screens/main/UserProfileScreen.tsx`, `src/screens/main/ProfileTabScreen.tsx`, `src/api/client.ts`, `src/hooks/queries/useUserPosts.ts`, and backend feed/user post support.
- [x] (2026-05-01 12:52Z) Refactored public `UserProfileScreen` to the Instagram-style header plus profile content tabs.
- [x] (2026-05-01 12:47Z) Added reusable profile UI components under `src/components/profile/`.
- [x] (2026-05-01 12:57Z) Added the same Posts/Reposts/Tagged tab strip and media grid preview to the current user's profile home.
- [x] (2026-05-01 13:03Z) Deferred API/query additions for reposts and tagged posts because the backend does not expose those profile datasets yet; the app now renders intentional empty states for those tabs.
- [x] (2026-05-01 12:58Z) Ran TypeScript validation with `npx tsc --noEmit`; it exited successfully.
- [x] (2026-05-01 13:09Z) Smoke-checked standard Expo startup with Metro running on `http://localhost:8082`.
- [x] (2026-05-01 13:10Z) Updated this ExecPlan with validation evidence and retrospective.
- [x] (2026-05-01 17:09Z) Cleaned up the current-user profile so editable Bio/Location/Interests/Identity/Sobriety cards live behind `Edit Profile` instead of appearing under the Posts tab.
- [x] (2026-05-01 17:14Z) Moved the current user's basic bio/interests/sobriety summary and `Edit Profile` action above the Posts/Reposts/Tagged tabs.
- [x] (2026-05-01 17:24Z) Changed profile posts from grid tiles to feed-style cards and wired their comment action into the existing comments modal.
- [x] (2026-05-01 17:35Z) Removed the current-user profile banner and reshaped the profile home header into an avatar-left, stats-right Instagram-like layout.

## Surprises & Discoveries

- Observation: The app has `useUserPosts(userId)` for authored posts, but no `useUserReposts` or `useUserTaggedPosts`.
    Evidence: `src/query/queryKeys.ts` only has `userPosts`, and `src/api/client.ts` only has `getUserPosts(userId, cursor, limit)`.
- Observation: The backend has a `post_shares` table and feed reshare support, but no public endpoint for `GET /users/:id/reposts`.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/feed/foundation_store.go` inserts `post_shares`; `/home/michaelroddy/repos/project_radeon/internal/feed/handler.go` only exposes user authored posts via `GetUserPosts`.
- Observation: Tagged posts are not currently modeled as post tags. Existing "mentions" are comment mention records, which are not equivalent to Instagram-style tagged posts.
    Evidence: Backend migrations include `comment_mentions` and `share_comment_mentions`, but no `post_tags` table.

## Decision Log

- Decision: Refactor `UserProfileScreen` first, not the current user's editable `ProfileTabScreen`.
    Rationale: The user explicitly asked for the user profile screen, and the codebase has a dedicated `UserProfileScreen.tsx` for viewing user profiles. The own-profile tab is larger and includes editing, friends, requests, and settings; applying the same visual system there should be a later milestone after the public profile UX is stable.
    Date/Author: 2026-05-01 / Codex.
- Decision: Add a lighter version of the tabbed content grid to `ProfileTabScreen` in the same pass.
    Rationale: The requested wording mentions "your photos and videos," so the logged-in profile should expose the same profile content categories. To avoid destabilizing the existing edit/settings/friends flows, this pass adds the tab strip and first-page grid preview under the existing stats while preserving the existing editable sections below.
    Date/Author: 2026-05-01 / Codex.
- Decision: Move current-user editable profile fields into an `Edit Profile` subview.
    Rationale: Leaving the old editable profile fields below the new grid made them look like Posts-tab content. The profile home should keep content tabs content-only, while edit controls should be reached through an explicit action.
    Date/Author: 2026-05-01 / Codex.
- Decision: Keep current-user basic profile information above the content tabs.
    Rationale: The content tabs should switch between user content categories only. Basic profile information belongs with the avatar/name header, matching the public profile and Instagram-like hierarchy.
    Date/Author: 2026-05-01 / Codex.
- Decision: Remove profile banners from the current-user profile home.
    Rationale: Instagram profile screens emphasize avatar, stats, bio, and actions rather than a cover/banner image. Removing the banner also prevents the header from competing with the content tabs.
    Date/Author: 2026-05-01 / Codex.
- Decision: Implement Posts as real grid content and Reposts/Tagged as real tabs with empty states in this frontend pass.
    Rationale: The frontend can deliver the requested profile structure now without inventing API contracts that would 404. True repost and tagged data should be backed by explicit backend endpoints before the app requests them.
    Date/Author: 2026-05-01 / Codex.
- Decision: Use `Ionicons` for tab icons and current theme tokens for color, spacing, and typography.
    Rationale: The app already uses `Ionicons` and central theme tokens, and repository guidance requires component styles to use the theme rather than hardcoded design values where possible.
    Date/Author: 2026-05-01 / Codex.

## Outcomes & Retrospective

The frontend refactor is complete for the app. Public user profiles now use a compact Instagram-style header with icon tabs for Posts, Reposts, and Tagged. Posts render as feed-style cards, including pressable comment actions that open the existing comments modal. The current user's profile tab no longer has a banner; it starts with an avatar-left, stats-right profile header, shows basic profile information under that header, keeps `Edit Profile` above the tabs, and uses the Posts/Reposts/Tagged strip only for content. Reposts and Tagged are intentionally empty until backend endpoints exist for those datasets.

## Context and Orientation

The app is a React Native/Expo frontend. API calls live in `src/api/client.ts`. React Query hooks for API data live in `src/hooks/queries/` and query cache keys live in `src/query/queryKeys.ts`. Public user profiles are rendered by `src/screens/main/UserProfileScreen.tsx`, which currently fetches the profile with `useUserProfile(userId)` and authored posts with `useUserPosts(userId)`.

The current `UserProfileScreen` renders a `FlatList<api.Post>` where the header is profile information and every list row is a full post card. The intended refactor keeps `FlatList` for scrolling and pagination, but changes each row to a square grid tile. A grid tile is a compact square preview of a post. If a post has an image, the tile displays the image. If it is text-only, the tile displays a short body preview.

A profile tab is an icon button above the content grid. In this implementation there are three tabs: `posts`, `reposts`, and `tagged`. `posts` means content authored by the profile user. `reposts` means content the user reshared from someone else. `tagged` means posts where another user tagged this account. The backend only supports authored posts today, so the non-posts tabs intentionally render empty states instead of making network calls.

## Plan of Work

First, create reusable presentation components under `src/components/profile/`. `ProfileContentTabs.tsx` will render the icon tab strip. `ProfileMediaGridTile.tsx` will render one square tile for a post-like item. `ProfileEmptyTabState.tsx` will render compact empty states for tabs.

Second, refactor `src/screens/main/UserProfileScreen.tsx`. Keep the data fetching and friend/message actions, but replace the header and row rendering. Add an `activeTab` state. Use a `FlatList` with `numColumns={3}` and a stable `key={activeTab}` so React Native can switch between grid layouts. Use `posts` as data for the Posts tab and an empty array for Reposts and Tagged until backend support exists. Keep pull-to-refresh and infinite scroll active only for the Posts tab.

Third, add the same content categories to `src/screens/main/ProfileTabScreen.tsx` under the existing current-user stats row. This own-profile implementation uses the first page from `useUserPosts(user.id)` and preserves the existing profile edit sections below the grid.

Third, ensure all styles use `StyleSheet.create` and theme tokens. Avoid inline style objects except existing dynamic style arrays that are already local patterns. Make the header compact, left-aligned for bio text, and visually close to Instagram's profile hierarchy: avatar and stats across the top, action buttons below, then icon tabs.

Finally, validate with TypeScript. This repo has no `test` or `lint` script, so the practical command is `npx tsc --noEmit`. If TypeScript passes, start Expo web with `npm run web -- --port 8082` for a manual smoke check.

## Concrete Steps

Run commands from `/home/michaelroddy/repos/project_radeon_app`.

Start from a clean app worktree:

    git status --short --branch

Create and verify the branch:

    git switch -c feature/instagram-profile-refactor
    git branch --show-current

Add the reusable profile components:

    src/components/profile/ProfileContentTabs.tsx
    src/components/profile/ProfileMediaGridTile.tsx
    src/components/profile/ProfileEmptyTabState.tsx

Refactor:

    src/screens/main/UserProfileScreen.tsx

Validate:

    npx tsc --noEmit

Expected outcome:

    The TypeScript command exits with code 0.

## Validation and Acceptance

Acceptance for the frontend refactor:

1. Opening another user's profile shows a compact profile header with avatar, stats, bio/location/interests/sobriety details, and Add Friend/Message actions.
2. Below the header, three icon tabs are visible: grid for Posts, repeat/repost for Reposts, and person for Tagged.
3. The Posts tab shows a three-column grid of the user's authored posts. Image posts display image thumbnails; text-only posts display text previews.
4. Pull-to-refresh reloads the profile and posts while the Posts tab is active.
5. Reposts and Tagged tabs show intentional empty states instead of broken requests.
6. TypeScript passes with `npx tsc --noEmit`.

## Idempotence and Recovery

The frontend changes are additive and localized. If a component edit fails, rerun `git status --short` and inspect only files touched by this plan. Do not reset unrelated user changes. The branch can be safely rebuilt by deleting the new `src/components/profile/` files and restoring `src/screens/main/UserProfileScreen.tsx` from Git, but only do so if explicitly requested.

## Artifacts and Notes

TypeScript validation passed:

    $ npx tsc --noEmit
    # exited 0 with no diagnostics

Diff whitespace validation passed:

    $ git diff --check
    # exited 0 with no diagnostics

Expo startup smoke check:

    $ HOME=/tmp/expo-home EXPO_HOME=/tmp/expo-home/.expo XDG_CACHE_HOME=/tmp/expo-cache npx expo start --port 8082 --host localhost
    Waiting on http://localhost:8082
    Logs for your project will appear below.

## Interfaces and Dependencies

`ProfileContentTabs.tsx` must export:

    export type ProfileContentTabKey = 'posts' | 'reposts' | 'tagged';

    export interface ProfileContentTabsProps {
        activeTab: ProfileContentTabKey;
        onChange: (tab: ProfileContentTabKey) => void;
    }

    export function ProfileContentTabs(props: ProfileContentTabsProps): React.ReactElement

`ProfileMediaGridTile.tsx` must render an `api.Post` without fetching. It should accept `item: api.Post`, `tileSize: number`, and an optional `variant` that identifies posts, reposts, or tagged tiles.

`UserProfileScreen.tsx` must keep its existing props and behavior for back navigation, direct messages, and friend actions.

Revision note, 2026-05-01: Initial plan created after inspecting the app and backend data surfaces. The plan intentionally limits real data loading to authored posts because repost and tagged profile endpoints do not yet exist.

Revision note, 2026-05-01: Updated progress and decisions after implementing the public profile refactor and adding a matching content preview area to the current user's profile home. TypeScript validation passed.
