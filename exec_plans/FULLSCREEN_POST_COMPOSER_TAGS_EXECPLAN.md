# Full-screen community post composer with tags

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root. It is self-contained so a contributor can continue the work without prior context.

## Purpose / Big Picture

The community feed currently has an inline composer at the top of the feed. After this change, pressing `Create post` opens a focused full-screen composer similar to Reddit's post creation flow. A user can write a post, attach the one image currently supported by the app, and add short context tags such as `check-in`, `question`, or `milestone`.

Tags will be stored by the Go backend instead of being frontend-only decoration. After implementation, newly created posts should return with their tags from the feed and user-profile APIs, and both the home feed and profile posts list should display those tags.

## Progress

- [x] (2026-05-01 16:33Z) Created app branch `feature/fullscreen-composer-tags-execplan` for this planning work.
- [x] (2026-05-01 16:33Z) Inspected the existing inline composer in `src/screens/main/FeedScreen.tsx`.
- [x] (2026-05-01 16:33Z) Inspected app API types and post creation flow in `src/api/client.ts` and `src/hooks/queries/useCreatePostMutation.ts`.
- [x] (2026-05-01 16:33Z) Inspected backend post creation and feed read paths in `/home/michaelroddy/repos/project_radeon/internal/feed/`.
- [x] (2026-05-01 16:46Z) Implemented backend tag storage, validation, and response hydration on backend branch `feature/fullscreen-composer-tags`.
- [x] (2026-05-01 16:46Z) Implemented the full-screen composer UI in the Expo app.
- [x] (2026-05-01 16:46Z) Rendered post tags in the home feed and profile post cards.
- [x] (2026-05-01 16:46Z) Ran backend and frontend validation.
- [x] (2026-05-01 16:53Z) Simplified the feed entry to a single `+ Create` button and moved selected composer images above the text field with full-width presentation.
- [x] (2026-05-01 16:57Z) Moved post creation to a centered bottom floating action button that hides on downward feed scroll and reappears near the top or on upward scroll.
- [x] (2026-05-01 16:59Z) Applied backend migration `061_post_tags.sql` to the configured local database and lowered the feed create FAB.
- [x] (2026-05-01 17:24Z) Rebuilt the Create Post keyboard layout to mirror GiftedChat's measured-header plus keyboard-moving content/toolbar structure.
- [x] (2026-05-01 17:28Z) Replaced the Create Post modal's non-moving keyboard-controller toolbar with direct keyboard-event animation because the modal did not translate the toolbar.
- [ ] Commit, merge, and push the implementation after validation.

## Surprises & Discoveries

- Observation: The current backend create-post endpoint only accepts `body` and `images`; there is no post tag model or response field yet.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/feed/handler.go` reads a JSON body with `Body string` and `Images []PostImage`, and `/home/michaelroddy/repos/project_radeon/internal/feed/store.go` has `CreatePost(ctx, userID, body, images)`.
- Observation: The app already has image selection and optimistic post creation logic, but that logic is embedded in `FeedScreen.tsx`.
    Evidence: `src/screens/main/FeedScreen.tsx` owns `draft`, `selectedImage`, `handlePickPostImage`, `handlePost`, and optimistic post helpers.
- Observation: The latest backend migration at the time of planning is `060_daily_reflection_sections.sql`.
    Evidence: `/home/michaelroddy/repos/project_radeon/migrations` contains migration `060_daily_reflection_sections.sql`, so the next additive migration for tags should be numbered `061`.
- Observation: Running the new backend code before applying `061_post_tags.sql` causes home feed reads to fail with `relation "post_tags" does not exist`.
    Evidence: The backend logged `list home feed failed ... ERROR: relation "post_tags" does not exist (SQLSTATE 42P01)`. Running `make migrate` applied `061_post_tags.sql`, and `make migrate-status` then showed `applied 061_post_tags.sql`.

## Decision Log

- Decision: Store tags in a normalized `post_tags` table, not a JSON column or comma-separated text field on `posts`.
    Rationale: A separate table makes later filtering, search, analytics, cascade deletion, and uniqueness constraints straightforward. It also avoids parsing strings in application code.
    Date/Author: 2026-05-01 / Codex.
- Decision: Treat tags as context labels for posts, with a maximum of five tags per post.
    Rationale: The composer should help readers understand context without becoming a separate tagging product. Five tags is enough for context while keeping feed cards compact.
    Date/Author: 2026-05-01 / Codex.
- Decision: Normalize tags to lowercase and allow only letters, numbers, hyphen, and underscore.
    Rationale: Normalization prevents duplicate variants such as `Milestone`, `milestone`, and `mile stone`. The allowed characters are easy to type on mobile and simple to validate consistently.
    Date/Author: 2026-05-01 / Codex.
- Decision: Tags do not count as post content by themselves.
    Rationale: The existing product rule requires text or an image. A tag-only post would create low-information feed items and would weaken the current empty-post validation.
    Date/Author: 2026-05-01 / Codex.
- Decision: Keep the existing one-image limit in this feature.
    Rationale: The backend currently rejects more than one image. This plan is focused on composer presentation and tags, not multi-image galleries.
    Date/Author: 2026-05-01 / Codex.
- Decision: Let `FeedScreen` own the full-screen composer overlay for the first implementation.
    Rationale: Feed post creation is currently local to `FeedScreen`, and keeping the overlay local avoids unnecessary changes to `AppNavigator`. If future screens need the same composer entry point, it can be lifted later.
    Date/Author: 2026-05-01 / Codex.
- Decision: Use frontend suggested tags first instead of adding a backend tag-catalog endpoint.
    Rationale: The requested feature is the ability to add tags to posts. Suggestions can be static in the app while the backend stores arbitrary valid normalized tags. A catalog endpoint can be added after tag usage data exists.
    Date/Author: 2026-05-01 / Codex.
- Decision: Use a single `+ Create` button on the feed instead of a mini composer row with separate image/tag actions.
    Rationale: The user clarified that the feed should match Reddit's simple entry point: one button opens the full-screen composer, and image/tag actions belong inside that full-screen flow.
    Date/Author: 2026-05-01 / Codex.
- Decision: Move the `+ Create` action from the feed header to a bottom-center floating action button.
    Rationale: A bottom-center floating action button keeps creation available without taking vertical space from the feed. Hiding on downward scroll preserves reading space, while reappearing near the top or on upward scroll keeps the action discoverable.
    Date/Author: 2026-05-01 / Codex.
- Decision: Rebuild `CreatePostScreen` with the GiftedChat keyboard architecture.
    Rationale: GiftedChat keeps the fixed header outside keyboard movement, measures that header, then places the scrollable content and bottom composer inside one `react-native-keyboard-controller` `KeyboardAvoidingView` with `behavior="translate-with-padding"`. Reusing that structure gives the image toolbar and page content the same keyboard movement model as chat.
    Date/Author: 2026-05-01 / Codex.
- Decision: Use explicit keyboard show/hide animation for the Create Post toolbar inside the React Native modal.
    Rationale: The GiftedChat-style `react-native-keyboard-controller` structure did not move the toolbar when rendered inside the feed's full-screen modal. Listening to native keyboard events and translating the toolbar by the reported keyboard height gives deterministic modal behavior while preserving matching scroll bottom space.
    Date/Author: 2026-05-01 / Codex.

## Outcomes & Retrospective

Implementation is complete in the working trees. The backend now persists normalized post tags in `post_tags`, accepts `tags` on post creation, hydrates tags into feed/profile/hidden feed responses, and includes handler tests for tag normalization and rejection. The app now opens a full-screen composer from a centered bottom `+ Create` floating action button, supports suggested and custom tags, sends tags to the backend, includes tags in optimistic feed items, renders attached images above the text prompt at full screen width, and renders tag chips on feed and profile posts.

Validation passed with `npx tsc --noEmit` in the app repository and `GOCACHE=/tmp/project-radeon-go-cache go test ./...` in the backend repository. A plain `go test ./...` initially failed because the default Go build cache under `/home/michaelroddy/.cache/go-build` was read-only in this sandbox; rerunning with a writable `GOCACHE` resolved the environment issue. Expo Metro was started on port 8083 because port 8082 was already in use.

## Context and Orientation

The app repository is `/home/michaelroddy/repos/project_radeon_app`. It is a React Native/Expo app. All frontend API calls and shared API types live in `src/api/client.ts`. The community feed screen is `src/screens/main/FeedScreen.tsx`. React Query mutation hooks live in `src/hooks/queries/`, including `src/hooks/queries/useCreatePostMutation.ts`. Profile post rendering uses `src/components/profile/ProfilePostCard.tsx` after the recent profile refactor.

The backend repository is `/home/michaelroddy/repos/project_radeon`. It is a Go service with SQL migrations in `migrations/`. The feed feature lives in `internal/feed/`. The HTTP create-post handler is in `internal/feed/handler.go`; the write-side SQL implementation is in `internal/feed/store.go`; feed read and hydration behavior is in `internal/feed/read_store.go`; cache invalidation wrapper behavior is in `internal/feed/cache_store.go`.

In this plan, a "full-screen composer" means a screen-height modal or overlay launched from the feed that takes focus away from the scrolling feed until the user posts or dismisses it. A "tag" means a short normalized string stored on a post and returned by the backend with that post. An "optimistic post" means a temporary post inserted into the feed immediately before the backend request finishes, so the app feels responsive.

## Plan of Work

Start with the backend because the frontend needs a real API contract for tags. In `/home/michaelroddy/repos/project_radeon`, create or switch to an implementation branch named `feature/fullscreen-composer-tags`. Add migration `migrations/061_post_tags.sql` that creates a `post_tags` table with `post_id`, `tag`, and `created_at`. `post_id` should reference `posts(id)` with `ON DELETE CASCADE`, and `(post_id, tag)` should be unique. Add an index on `tag` for future filtering.

Update backend feed types so every post-shaped response can include tags. Add `Tags []string json:"tags"` to `Post`, `FeedItem`, and `EmbeddedPost` in the feed package files where those structs are defined. Keep JSON field names lower-case as `tags`.

Replace the widening `CreatePost(ctx, userID, body, images)` function shape with an input struct to avoid parameter sprawl. Define a feed package type such as `CreatePostInput` with `Body string`, `Images []PostImage`, and `Tags []string`. Update the `Querier` interface in `internal/feed/handler.go`, the SQL store in `internal/feed/store.go`, the cache wrapper in `internal/feed/cache_store.go`, and test stubs to use `CreatePost(ctx context.Context, userID uuid.UUID, input CreatePostInput)`.

Validate tags in the backend HTTP handler before calling the store. The handler should trim whitespace, remove a leading `#` if the user typed one, lowercase the tag, reject invalid characters, deduplicate tags while preserving the first occurrence order, and reject more than five tags. Tags should not satisfy the existing body-or-image requirement. Return a user-facing `400 Bad Request` for invalid tags.

Inside the backend store transaction that creates the post and any image row, insert tag rows for the normalized tags. Because `(post_id, tag)` is unique and the handler deduplicates input, inserts should be deterministic. If a retry reaches the store with duplicate input despite handler validation, the store should not create duplicate tag rows.

Hydrate tags in all read paths that return posts. Add a helper that loads tags by post IDs and attaches sorted or creation-order tag slices to returned objects. Use it in `ListUserPosts`, home feed hydration, embedded original posts for reshares, and any other feed read path that returns `Post`, `FeedItem`, or `EmbeddedPost`. Responses for posts without tags should include `tags: []`, not `null`.

After the backend contract exists, update the app. In `src/api/client.ts`, add `tags: string[]` to `Post`, `FeedItem`, and embedded/original post types. Update normalizers so missing tags from older backend responses become an empty array. Update `createPost` to accept optional `tags?: string[]` and send that field in the JSON body.

Update `src/hooks/queries/useCreatePostMutation.ts` so mutation input accepts `tags?: string[]` and passes them to `api.createPost`. Continue invalidating the home feed and current user's posts after a successful post.

Extract or relocate composer logic from `src/screens/main/FeedScreen.tsx` so the feed header becomes a compact "Create post" entry button instead of a full inline text field. Add a screen-specific component such as `src/screens/main/CreatePostScreen.tsx` that renders the full-screen composer. It should accept the current user, initial body if needed, an `onSubmit` callback, and an `onClose` callback. It should include a multiline text area, the existing image picker flow, image preview/removal, suggested tag chips, custom tag entry, selected tag chips with remove buttons, a disabled/enabled post action, loading state, and validation messages.

Keep tag validation in the frontend aligned with backend rules, but treat backend validation as authoritative. The app should prevent obviously invalid tags before submit and should display an alert if the backend rejects a tag. Use static suggested tags such as `check-in`, `question`, `milestone`, `craving`, `gratitude`, and `support`.

Update optimistic post creation in `FeedScreen.tsx` to include the selected tags on optimistic `Post` and `FeedItem` objects. Render tags in the existing feed post card layout and in `src/components/profile/ProfilePostCard.tsx`. Tags should be compact chips below the post body and above action buttons, using theme colors and `StyleSheet.create`.

## Concrete Steps

From the app repository, verify the planning branch is clean before implementation begins:

    cd /home/michaelroddy/repos/project_radeon_app
    git status --short --branch

Expected output during planning:

    ## feature/fullscreen-composer-tags-execplan

Create implementation branches when the user approves execution. The app branch can be created from `main` after this plan is merged, or from the current branch if the plan commit is meant to travel with the implementation:

    cd /home/michaelroddy/repos/project_radeon_app
    git switch -c feature/fullscreen-composer-tags

Create the matching backend branch:

    cd /home/michaelroddy/repos/project_radeon
    git switch -c feature/fullscreen-composer-tags

Implement backend files first:

    migrations/061_post_tags.sql
    internal/feed/handler.go
    internal/feed/store.go
    internal/feed/read_store.go
    internal/feed/foundation_types.go
    internal/feed/cache_store.go
    internal/feed/handler_test.go
    internal/feed/cache_store_test.go

Run backend validation:

    cd /home/michaelroddy/repos/project_radeon
    go test ./...

Expected outcome:

    all package tests pass, and there are no compile errors about the new CreatePost signature or missing Tags fields.

Implement frontend files next:

    src/api/client.ts
    src/hooks/queries/useCreatePostMutation.ts
    src/screens/main/FeedScreen.tsx
    src/screens/main/CreatePostScreen.tsx
    src/components/profile/ProfilePostCard.tsx

Run frontend validation:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Expected outcome:

    the command exits 0 with no TypeScript diagnostics.

Start Expo for a manual smoke check if a device, simulator, or web target is available:

    cd /home/michaelroddy/repos/project_radeon_app
    HOME=/tmp/expo-home EXPO_HOME=/tmp/expo-home/.expo XDG_CACHE_HOME=/tmp/expo-cache npx expo start --port 8082 --host localhost

Expected output:

    Waiting on http://localhost:8082
    Logs for your project will appear below.

## Validation and Acceptance

Backend acceptance requires both tests and observable API behavior. `go test ./...` from `/home/michaelroddy/repos/project_radeon` must pass. Add or update a create-post handler test that submits tags such as `["Milestone", "#support", "support"]` and expects a successful response with one normalized `milestone` tag and one `support` tag when the post is read back. Add an invalid-tag test that submits too many tags or an invalid character and expects HTTP 400.

Frontend acceptance requires `npx tsc --noEmit` from `/home/michaelroddy/repos/project_radeon_app` to pass. In the running app, the community feed should show a compact create-post entry instead of the old inline composer. Pressing it should open the full-screen composer. The user should be able to type text, pick one image, add and remove tags, and submit. While submitting, the post action should show a loading state and avoid duplicate submissions.

End-to-end acceptance is manual. Create a post with body `Testing tagged composer`, one selected suggested tag `milestone`, and one custom tag `support`. The new post should appear at the top of the feed immediately with `milestone` and `support` chips. After a refresh, the same post should still show both tags from the backend response. Opening the current user's profile Posts tab should show the post with the same tags. Creating a post with only tags and no body or image should remain blocked.

## Idempotence and Recovery

The database migration is additive. Running the migration once creates `post_tags`; running it through the backend's normal migration runner should not be repeated manually. If local development data must be reset, drop only the local development database or reverse only the new `post_tags` table after confirming no shared environment is targeted.

The backend code changes are safe to retry because post creation still occurs in one transaction. If tag insertion fails, the entire post creation should fail and roll back. Do not partially create a post without its accepted tags.

The frontend changes are localized to feed composition, API types, and post rendering. If an implementation attempt fails, inspect `git status --short` in both repos and review only files touched by this plan. Do not use destructive reset commands unless explicitly instructed by the user.

Because two repositories are involved, keep commits separate by repository. Commit the backend migration/API work in `/home/michaelroddy/repos/project_radeon` and the frontend UI/API-client work in `/home/michaelroddy/repos/project_radeon_app`.

## Artifacts and Notes

Current backend create-post input shape before implementation:

    CreatePost(ctx, userID, body, images)

Target backend create-post input shape:

    type CreatePostInput struct {
        Body   string
        Images []PostImage
        Tags   []string
    }

    CreatePost(ctx context.Context, userID uuid.UUID, input CreatePostInput) (uuid.UUID, error)

Current frontend create-post input shape before implementation:

    createPost(data: { body?: string; images?: PostImage[] }): Promise<{ id: string }>

Target frontend create-post input shape:

    createPost(data: { body?: string; images?: PostImage[]; tags?: string[] }): Promise<{ id: string }>

Latest known migration at planning time:

    060_daily_reflection_sections.sql

Next migration for this work:

    061_post_tags.sql

Frontend validation passed:

    $ npx tsc --noEmit
    # exited 0 with no diagnostics

Backend validation passed with a writable Go cache:

    $ GOCACHE=/tmp/project-radeon-go-cache go test ./...
    ok  	github.com/project_radeon/api/internal/feed	0.037s
    # all packages exited successfully

Expo startup:

    $ HOME=/tmp/expo-home EXPO_HOME=/tmp/expo-home/.expo XDG_CACHE_HOME=/tmp/expo-cache npx expo start --port 8083 --host localhost
    Starting Metro Bundler

Local database migration status after applying tags:

    $ GOCACHE=/tmp/project-radeon-go-cache make migrate-status | tail -n 5
    applied      057_unified_support_feed.sql
    applied      058_notification_counters.sql
    applied      059_daily_reflections.sql
    applied      060_daily_reflection_sections.sql
    applied      061_post_tags.sql

## Interfaces and Dependencies

In `/home/michaelroddy/repos/project_radeon/internal/feed/handler.go`, the create-post JSON input should accept:

    Body string json:"body"
    Images []PostImage json:"images"
    Tags []string json:"tags"

In `/home/michaelroddy/repos/project_radeon/internal/feed/`, define and use:

    type CreatePostInput struct {
        Body   string
        Images []PostImage
        Tags   []string
    }

    CreatePost(ctx context.Context, userID uuid.UUID, input CreatePostInput) (uuid.UUID, error)

Backend post-shaped response structs must include:

    Tags []string json:"tags"

The SQL table must be:

    post_tags
        post_id uuid not null references posts(id) on delete cascade
        tag text not null
        created_at timestamptz not null default now()
        unique (post_id, tag)

In `src/api/client.ts`, the app API types must include:

    interface Post {
        tags: string[];
    }

    interface FeedItem {
        tags: string[];
    }

    interface EmbeddedPost {
        tags: string[];
    }

In `src/hooks/queries/useCreatePostMutation.ts`, the mutation input must accept:

    tags?: string[]

In `src/screens/main/CreatePostScreen.tsx`, export:

    interface CreatePostScreenProps {
        currentUser: api.User;
        isSubmitting: boolean;
        onClose: () => void;
        onSubmit: (input: { body: string; image: SelectedPostImage | null; tags: string[] }) => Promise<void>;
    }

The exact `SelectedPostImage` type can be local to `FeedScreen.tsx` or moved into the new composer file, but it must preserve the image URI, width, height, and any upload metadata currently needed by the existing image upload flow.

Use existing dependencies only. The app already uses Expo and `expo-image-picker`; do not add a new image picker. Use existing theme tokens from `src/utils/theme.ts` and styles from `StyleSheet.create`. Use icons from the icon library already used in the app rather than hand-drawn SVG.

Revision note, 2026-05-01: Initial ExecPlan created after inspecting the app inline composer, app API client, React Query mutation hook, and backend feed create/read paths. The plan intentionally covers both repositories because post tags require persistent backend storage and response hydration.

Revision note, 2026-05-01: Updated progress, outcomes, and artifacts after implementing the backend tag contract, full-screen app composer, tag rendering, and validation. The implementation follows the original plan, with `FeedScreen` owning the composer modal and the backend using a normalized `post_tags` table.

Revision note, 2026-05-01: Updated the app plan notes after simplifying the feed composer entry to a single `+ Create` button and changing the composer image preview to render above the text field at full screen width.

Revision note, 2026-05-01: Updated the app plan notes after replacing the header create button with a bottom-center floating action button that hides while scrolling down and returns near the top or while scrolling upward.

Revision note, 2026-05-01: Recorded the local migration application that fixed the `post_tags` missing-table feed error and the follow-up FAB positioning adjustment.

Revision note, 2026-05-01: Recorded the Create Post keyboard-layout rebuild after switching from incremental keyboard tweaks to the same structural keyboard pattern used by GiftedChat.

Revision note, 2026-05-01: Recorded the modal-specific fallback from keyboard-controller translation to explicit keyboard event animation for the Create Post toolbar after the controller did not move the toolbar in this modal context.
