# Separate Dating Profiles From Community Profiles

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in this repository. It covers coordinated changes in two sibling repositories: `/home/michaelroddy/repos/project_radeon_app` for the Expo mobile app and `/home/michaelroddy/repos/project_radeon` for the Go API.

## Purpose / Big Picture

Dating currently uses the normal community user profile in dating discovery, likes, and matches. After this change, a person who opts into Dating will create a dedicated dating profile with its own photos, dating bio, relationship goal, preferences, and pause state. The dating profile remains tied to the same account for safety, blocking, reporting, and chat, but incomplete or paused dating profiles are not shown in Dating discovery. A user can see the feature working by enabling Dating, completing the setup gate, browsing dating cards that come from dating profile data, and pausing the dating profile to disappear from discovery without deleting the profile.

## Progress

- [x] (2026-05-29T14:20:47Z) Created branch `feature/dating-profile-separation` in both app and backend repositories.
- [x] (2026-05-29T14:20:47Z) Inspected current dating implementation: backend has `/dating/*` actions, matches, likes, impressions, and ranking, but returns regular `user.User` records; app renders dating from `api.User`.
- [x] (2026-05-29T14:36:00Z) Added backend dating profile schema, migration, store methods, handlers, and route registration.
- [x] (2026-05-29T14:44:00Z) Updated backend dating discovery, likes, matches, and action contracts to use dating profiles and `target_profile_id`.
- [x] (2026-05-29T14:52:00Z) Updated app API types and query hooks to consume dating profile contracts.
- [x] (2026-05-29T15:01:00Z) Built app setup/edit/pause UX and switched dating deck, likes, and profile detail to dating profile data.
- [x] (2026-05-29T15:07:00Z) Ran backend migration/tests/build and app typecheck successfully.

## Surprises & Discoveries

- Observation: The existing backend already separates dating actions, impressions, matches, and ranking into `internal/dating`, so the new profile model can extend that package instead of creating a new subsystem.
    Evidence: `internal/dating/store.go`, `internal/dating/handler.go`, and `/dating/*` routes in `cmd/api/main.go`.
- Observation: Image upload and moderation already exist for avatars, posts, groups, and meetups.
    Evidence: User avatar uploads go through `internal/user/handler.go::UploadAvatar`; post/group/meetup image endpoints use the shared S3 uploader wrapped by moderation.
- Observation: The app's regular discovery and dating discovery contracts must remain distinct.
    Evidence: TypeScript initially caught `/users/discover` being typed as `DatingProfile`; restoring it to `CursorResponse<User>` fixed `useDiscoverResults` and feed mention search type errors.

## Decision Log

- Decision: Use one account identity and a separate dating profile record.
    Rationale: This keeps auth, moderation, blocking, reporting, and chat shared while giving users control over dating-specific presentation.
    Date/Author: 2026-05-29 / Codex
- Decision: Existing Dating users receive incomplete draft dating profiles seeded from current account data.
    Rationale: This avoids silently publishing old community profile data as a dating profile and requires intentional review before visibility resumes.
    Date/Author: 2026-05-29 / Codex
- Decision: Dating cards open a dating-only detail surface before match.
    Rationale: The user chose "Limited Dating Only"; community profile browsing from dating is intentionally decoupled.
    Date/Author: 2026-05-29 / Codex
- Decision: Paused completed profiles show the Dating profile management surface instead of the deck.
    Rationale: Pause hides discovery without deleting data, and the clearest recovery path is the same profile screen with a resume action.
    Date/Author: 2026-05-29 / Codex

## Outcomes & Retrospective

Implemented the first production-grade dating profile pass across backend and app. The backend now has dating profile/photo tables, migration `095_dating_profiles.sql`, profile CRUD/photo endpoints, and dating discovery/likes/matches/action responses based on `DatingProfile`. The app now has typed dating profile API functions, profile query/mutations, a setup/edit/pause panel, profile-photo upload/delete, dating-profile cards, dating likes rows, and a dating-only detail modal. Validation passed for backend tests/build, local migration application, schema spot-check, and app typecheck. Remaining future polish is richer photo reordering UI and more targeted end-to-end tests around profile completion and paused visibility.

## Context and Orientation

The backend lives in `/home/michaelroddy/repos/project_radeon`. The `internal/dating` package owns dating discovery, likes, passes, matches, and unmatch behavior. It currently returns `user.User` values selected from the `users` table. The `schema/base.sql` file is the authoritative fresh database schema, and numbered files in `migrations/` upgrade existing databases. The API routes are registered in `cmd/api/main.go`.

The app lives in `/home/michaelroddy/repos/project_radeon_app`. All HTTP calls and shared API types live in `src/api/client.ts`. Dating UI is mostly in `src/screens/main/DiscoverScreen.tsx`, `src/components/discover/DatingDeck.tsx`, and `src/components/discover/DatingLikesScreen.tsx`. The app currently gates the Dating tab only on `user.connection_intents` including `dating`.

## Plan of Work

First, add backend tables and types for `DatingProfile` and `DatingPhoto`. The profile belongs one-to-one to a user. It stores dating-only bio, relationship goal, interested-in genders, preferred age range, preferred distance, pause state, completion time, and timestamps. Photos are separate rows with position and dimensions. The migration seeds incomplete draft profiles for users who already opted into Dating and copies their current avatar into the first photo when present.

Next, extend `internal/dating` with profile CRUD and photo upload. Use the same uploader interface and image validation pattern already used by posts/groups/meetups, with keys under `dating-profiles/{userID}/...`. Completion requires a bio, relationship goal, at least one photo, at least one interested-in gender, valid age range, and distance. The backend should return a clear profile status so the app can show setup versus deck.

Then, change discovery, likes, matches, and action contracts. Discovery and likes return dating profile cards. Matches include the matched user's dating profile display data. Recording an action accepts `target_profile_id` and validates it to the target account before reusing the existing action/match tables. Discovery excludes incomplete and paused profiles in addition to the existing block/action/match filters.

Finally, update the app. Add `DatingProfile` and `DatingPhoto` API types and profile/photo functions. Add a setup/edit screen reachable from the Dating tab and Settings. The Dating tab shows setup until the profile is complete, then renders the deck from dating profiles. A dating profile detail surface replaces opening the community profile from dating cards. Pause/unpause keeps the profile editable but removes it from discovery.

## Concrete Steps

Work from the backend repository with:

    cd /home/michaelroddy/repos/project_radeon

Add the migration, schema updates, dating types, store methods, handler routes, and tests. Then run:

    GOCACHE=/tmp/project_radeon_go_build GOMODCACHE=/tmp/project_radeon_go_mod go test ./...
    GOCACHE=/tmp/project_radeon_go_build GOMODCACHE=/tmp/project_radeon_go_mod make build
    GOCACHE=/tmp/project_radeon_go_build GOMODCACHE=/tmp/project_radeon_go_mod make migrate

Work from the app repository with:

    cd /home/michaelroddy/repos/project_radeon_app

Update API contracts, query hooks, dating UI, setup/edit/profile detail screens, and navigation callbacks. Then run:

    npm run typecheck

## Validation and Acceptance

Backend acceptance: applying the new migration creates `dating_profiles` and `dating_profile_photos`; existing dating users get incomplete drafts; `/dating/profile` returns the caller's draft; `/dating/discover` omits incomplete and paused profiles; liking by `target_profile_id` still creates matches and chats when mutual.

App acceptance: a user with Dating enabled but no completed profile sees a setup gate; completing required fields unlocks the dating deck; dating cards show dating photos/bio/goals rather than community profile posts; pausing hides the profile while preserving profile data; typecheck passes.

## Idempotence and Recovery

The migration must use `IF NOT EXISTS` where practical and should not drop existing dating action or match data. Re-running app typecheck and backend tests is safe. If image upload fails, the app should keep the local draft state and show a user-facing error without marking the profile complete.

## Artifacts and Notes

Validation evidence:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project_radeon_go_build GOMODCACHE=/tmp/project_radeon_go_mod go test ./...
    ok github.com/project_radeon/api/internal/dating
    ok github.com/project_radeon/api/internal/user
    ... all backend packages passed

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project_radeon_go_build GOMODCACHE=/tmp/project_radeon_go_mod make migrate
    Applied 095_dating_profiles.sql

    cd /home/michaelroddy/repos/project_radeon
    set -a; . ./.env; set +a; psql "$DATABASE_URL" -Atc "SELECT ..."
    t|t|t|t

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck
    tsc --noEmit completed with exit code 0

## Interfaces and Dependencies

Backend endpoint names to exist at completion:

    GET    /dating/profile
    PATCH  /dating/profile
    POST   /dating/profile/photos
    DELETE /dating/profile/photos/{id}
    PATCH  /dating/profile/photos/order
    GET    /dating/profiles/{id}

App API functions to exist at completion:

    getMyDatingProfile()
    updateMyDatingProfile(input)
    uploadDatingProfilePhoto(input)
    deleteDatingProfilePhoto(photoId)
    reorderDatingProfilePhotos(photoIds)
    getDatingProfile(profileId)

The existing `expo-image-picker` dependency will be used for selecting dating photos, matching existing avatar, post, group, and meetup image flows.
