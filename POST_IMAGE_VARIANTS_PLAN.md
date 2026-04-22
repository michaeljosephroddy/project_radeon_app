# Preserve Original Post Images and Add Feed-Sized Display Variants

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with [PLANS.md](PLANS.md).

## Purpose / Big Picture

After this change, a user can pick a photo for a community post, position it inside the same 6:5 frame that appears in the feed, and publish a sharp-looking image without throwing away the untouched original upload. The mobile app will upload two assets for each post image: the original file for preservation and future full-screen use, plus a cropped display file sized for the feed and profile timeline. The backend will store both URLs and continue returning `image_url` as the display URL so existing UI rendering stays stable.

## Progress

- [x] (2026-04-22 14:53Z) Read `PLANS.md`, `src/screens/main/FeedScreen.tsx`, `src/api/client.ts`, and the backend feed handler/store to confirm the current single-image pipeline and the UI's fixed `aspectRatio: 1.2` frame.
- [x] (2026-04-22 15:07Z) Added backend schema support for `original_image_url` and `display_image_url` in `project_radeon/migrations/022_post_image_variants.sql`, updated `project_radeon/schema/base.sql`, and applied the migration with `make migrate`.
- [x] (2026-04-22 15:09Z) Updated the backend upload endpoint and store layer to persist original and display URLs while keeping `image_url` as the display alias for compatibility.
- [x] (2026-04-22 15:12Z) Updated the Expo app to crop to the feed frame, derive a bounded display asset locally, recover the untouched original when possible, and upload both variants through `src/api/client.ts`.
- [x] (2026-04-22 15:15Z) Ran backend tests and frontend type-checking successfully.

## Surprises & Discoveries

- Observation: The feed and profile timeline already render post images in a fixed 6:5 frame via `aspectRatio: 1.2`, so preserving the user's intended framing requires a crop flow that targets that exact ratio instead of a generic square crop.
    Evidence: `src/screens/main/FeedScreen.tsx` and `src/screens/main/UserProfileScreen.tsx` both define `postImage` with `aspectRatio: 1.2`.

- Observation: The current backend quality loss is caused by a second lossy pass on the server, not just the Expo picker.
    Evidence: `internal/feed/handler.go` currently resizes with `imaging.Fit(..., 1600, 1600, ...)` and re-encodes as JPEG at quality 82.

- Observation: The Expo crop UI alone is not enough for the long-term design because the crop result becomes the user's chosen display framing, while the untouched original still needs to be recovered separately.
    Evidence: `expo-image-picker` returns the edited asset URI for the crop result, so the app now uses `expo-media-library` to recover the original file when `assetId` is available.

- Observation: The backend test break during implementation was caused by multipart writer sequencing, not the new upload logic.
    Evidence: `TestUploadPostImageSuccess` failed with `multipart: can't write to finished part` until the display file was fully written before creating the original file part.

## Decision Log

- Decision: Use two stored assets per post image: an untouched original file and a display file sized and cropped for the feed.
    Rationale: This keeps the best source material available while giving the mobile UI a predictable, lighter-weight image to render in scrolling lists.
    Date/Author: 2026-04-22 / Codex

- Decision: Keep `image_url` in the API response as an alias for `display_image_url`.
    Rationale: This avoids a broad UI migration and keeps existing post rendering stable while the richer image model is introduced.
    Date/Author: 2026-04-22 / Codex

- Decision: Make the app own the user's 6:5 crop choice and upload that cropped result as the display asset.
    Rationale: The user must be able to position the photo inside the frame they will actually see in the feed. The Expo image picker can provide that crop UI directly.
    Date/Author: 2026-04-22 / Codex

- Decision: Resize the cropped display asset on-device before upload instead of resizing it again on the backend.
    Rationale: The cropped result is the exact framing the user chose. Resizing it once on-device with high quality avoids the previous double-encoding softness and reduces the file size the feed has to serve.
    Date/Author: 2026-04-22 / Codex

## Outcomes & Retrospective

The implementation landed as planned. New post images now preserve an untouched original and a separate display image, the composer crop UI matches the feed's 6:5 frame, and the display image is resized locally before upload so the server no longer performs the extra lossy resize/re-encode step that caused softness. One remaining practical constraint is that recovering the untouched original depends on the picker returning an `assetId`; when that is unavailable, the app falls back to using the cropped asset for both original and display so posting still succeeds.

## Context and Orientation

The frontend repository is `project_radeon_app`. The community composer lives in `src/screens/main/FeedScreen.tsx`, and the shared network types live in `src/api/client.ts`. The feed card and profile timeline both render post images with a fixed 6:5 frame, which React Native expresses as `aspectRatio: 1.2`.

The backend repository is `project_radeon`. The post image upload endpoint lives in `internal/feed/handler.go`, and the database reads and writes for posts live in `internal/feed/store.go`. The database schema currently stores a single `image_url` in the `post_images` table, so preserving the original requires a schema change plus a safe backfill for already-created rows.

In this plan, an "original" image means the untouched file chosen from the photo library. A "display" image means the cropped, feed-sized image that the user positioned inside the 6:5 post frame and that the feed actually renders.

## Plan of Work

First, add a new backend migration in `project_radeon/migrations` that adds `original_image_url` and `display_image_url` to `post_images`, populates both from the existing `image_url` value for all current rows, and keeps `image_url` in place. Update `project_radeon/schema/base.sql` so a fresh database creates the table with all three URL columns from the start.

Next, update `project_radeon/internal/feed/handler.go` so `PostImage` carries `original_image_url` and `display_image_url` in addition to `image_url`. Change `Handler.UploadPostImage` to accept a multipart request with a required `display` file and an optional `original` file, while still accepting the legacy `image` field as a fallback. The handler will validate file types, upload the untouched original bytes when present, upload the display bytes separately, inspect the display file to capture width and height, and return a `PostImage` payload where `image_url` equals `display_image_url`.

Then update `project_radeon/internal/feed/store.go` so post creation inserts the new URL columns and feed reads scan them back into `PostImage`. Keep `image_url` populated from `display_image_url` on reads so older callers remain safe. Update `project_radeon/internal/feed/handler_test.go` to cover the new upload shape and the backward-compatible create-post behavior.

After the backend contract is ready, update `src/api/client.ts` so `PostImage` exposes `original_image_url` and `display_image_url`, normalize missing arrays as before, and change `uploadPostImage` to send multipart form data for both files. In `src/screens/main/FeedScreen.tsx`, switch the picker to `allowsEditing: true` with `aspect: [6, 5]` and `quality: 1`. Use Expo Media Library to recover the untouched original asset when an asset id is available, and use Expo Image Manipulator to resize the cropped display asset to a bounded feed size before upload. If the untouched original cannot be recovered, fall back to using the cropped asset for both original and display so the post still succeeds.

Finally, run backend feed tests and frontend type-checking, then document the exact commands and outcomes below.

## Concrete Steps

From `/home/michaelroddy/repos/project_radeon_app`, install any missing Expo packages needed to recover the original asset and to resize the cropped display image.

From `/home/michaelroddy/repos/project_radeon`, add and apply the schema migration, then run the feed test package:

    go test ./internal/feed/...

From `/home/michaelroddy/repos/project_radeon_app`, run:

    npx tsc --noEmit

After the code changes, restart the backend and create a new post with an image. The crop UI should enforce a 6:5 frame. After publishing, the feed should display the cropped image sharply inside the card without the prior softness from double JPEG compression.

## Validation and Acceptance

Acceptance is:

1. A user can choose a photo in the feed composer, reposition it inside a 6:5 crop frame, and see that crop in the preview before posting.
2. Posting succeeds and the feed card shows the cropped image at the same framing the user selected.
3. Backend tests still pass for feed handlers and post image upload behavior.
4. Frontend type-checking passes.
5. Existing posts without the new columns continue rendering because the migration backfills them and the API still provides `image_url`.

## Idempotence and Recovery

The migration must be additive and safe to run once on existing environments. Backfilling `original_image_url` and `display_image_url` from `image_url` ensures old rows remain valid immediately. If the app cannot obtain the untouched original asset for a specific pick result, it will fall back to the cropped display file for both uploads, which preserves publish behavior instead of failing the post.

## Artifacts and Notes

Expected backend validation command:

    $ go test ./internal/feed/...
    ok  	github.com/project_radeon/api/internal/feed	0.0Xs

Expected frontend validation command:

    $ npx tsc --noEmit

Applied migration transcript:

    $ make migrate
    /usr/local/go/bin/go run ./cmd/migrate up
    Applied 022_post_image_variants.sql

## Interfaces and Dependencies

In `project_radeon/internal/feed/handler.go`, `type PostImage` must expose:

    type PostImage struct {
        ID               uuid.UUID `json:"id"`
        ImageURL         string    `json:"image_url"`
        OriginalImageURL string    `json:"original_image_url"`
        DisplayImageURL  string    `json:"display_image_url"`
        Width            int       `json:"width"`
        Height           int       `json:"height"`
        SortOrder        int       `json:"sort_order"`
    }

In `project_radeon_app/src/api/client.ts`, `export interface PostImage` must mirror those URL fields so the UI can use `image_url` now and richer URLs later.

The Expo app will use:

- `expo-image-picker` for the user's crop UI with a 6:5 frame.
- `expo-media-library` to recover the untouched original file when the picker returns an asset id.
- `expo-image-manipulator` to resize the cropped display asset to a feed-friendly size before upload.

Revision note: created this ExecPlan before implementation after confirming the current feed image frame and the backend's single-asset upload path.
Revision note: updated after implementation to record the dual-upload contract, the successful validation commands, and the migration application result.
