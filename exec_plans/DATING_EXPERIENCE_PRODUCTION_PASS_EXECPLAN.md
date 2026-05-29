# Build a production-grade Dating experience

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in this repository. It covers coordinated changes in two sibling repositories: `/home/michaelroddy/repos/project_radeon_app` for the Expo mobile app and `/home/michaelroddy/repos/project_radeon` for the Go API.

## Purpose / Big Picture

SoberSpace Dating is intended to become one of the product's most important engagement and subscription features. The current implementation has a real foundation: opt-in Dating, separate dating profiles, likes, passes, matches, a swipe deck, likes-you, and server-side ranking. After this plan is implemented, Dating should feel like a polished dating product inside SoberSpace rather than a thin extension of people discovery. A user should be able to complete a dedicated dating profile, browse performant photo-first profiles, open a full profile detail screen, like or pass, see mutual matches in a dedicated Matches screen, start a chat, unmatch or report safely, and preview/edit their own profile with confidence.

This plan deliberately avoids highly advanced features such as machine-learning personalization, video profiles, live events, or complex paid boost economies. It focuses on the production-grade core loop expected from a high-quality sober dating experience: correctness, privacy, safety, premium-feeling UI, fast discovery, profile depth, match management, and subscription-ready surfaces.

## Progress

- [x] (2026-05-29T16:55Z) Audited the existing app and backend Dating implementation at a high level and identified the next production pass scope.
- [x] (2026-05-29T17:04Z) Created this ExecPlan on branch `feature/dating-experience-execplan` in the app repository.
- [x] (2026-05-29T17:18Z) User approved implementation of this plan.
- [x] (2026-05-29T17:19Z) Created backend branch `feature/dating-experience-production-pass`; app work continues on `feature/dating-experience-execplan`.
- [x] (2026-05-29T17:42Z) Implemented backend public dating profile responses, mutual preference checks, paused/incomplete actor checks, ranking feature merge improvements, and a privacy regression test.
- [x] (2026-05-29T18:05Z) Implemented app Dating internal tabs, Matches tab, matches API/query hooks, unmatch action, reusable dating photo carousel, embedded Likes/Profile tabs, and richer carousel-backed profile detail.
- [x] (2026-05-29T18:07Z) Ran backend Dating package tests, backend full Go tests, and app TypeScript validation successfully.
- [x] (2026-05-29T18:42Z) Added dating prompts, Dating event logging, Plus-aware Likes You gating, dating profile report/block actions, and migration `097_dating_prompts_events_and_indexes.sql`.
- [x] (2026-05-29T18:45Z) Applied migration `097_dating_prompts_events_and_indexes.sql` locally with `GOCACHE=/tmp/go-build make migrate`.
- [x] (2026-05-29T18:50Z) Captured local `EXPLAIN (ANALYZE, BUFFERS)` plans for Dating discover count and Likes You count paths.
- [ ] Run device-level Expo smoke tests against a running backend with at least two Dating-enabled users.

## Surprises & Discoveries

- Observation: The backend already has dating-specific packages, routes, action storage, matches, likes-you, impressions, and ranking, so the next pass should extend the existing `internal/dating` subsystem instead of creating a parallel service.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/dating/store.go`, `/home/michaelroddy/repos/project_radeon/internal/dating/ranker.go`, and `/home/michaelroddy/repos/project_radeon/internal/dating/cache_store.go`.

- Observation: The app has a Dating deck and profile editor, but the complete dating product loop is not yet first-class in navigation. Matches exist in the backend but need a high-quality app surface.
    Evidence: `/home/michaelroddy/repos/project_radeon_app/src/screens/main/DiscoverScreen.tsx` owns Dating state and actions, while `/home/michaelroddy/repos/project_radeon_app/src/components/discover/DatingDeck.tsx` renders cards.

- Observation: Dating photos are modeled as multiple backend rows, but the deck currently behaves like a primary-photo card. A production dating experience needs a photo carousel in discovery, public profile detail, own-profile preview, likes-you, and matches.
    Evidence: `/home/michaelroddy/repos/project_radeon_app/src/components/discover/DatingDeck.tsx` derives `primaryPhoto` from the first photo.

- Observation: The backend `DatingProfile` type was used for both owner and public responses, so public discovery and likes responses could include owner-only fields such as interested-in genders, age range, distance, paused state, and completion state.
    Evidence: Before this pass, `internal/dating/handler.go` returned `pagination.CursorResponse[DatingProfile]` from `Discover` and `ListLikes`.

- Observation: The app already had a query key for dating matches but no API function, query hook, or screen that used it.
    Evidence: `src/query/queryKeys.ts` had `datingMatches`, while `src/api/client.ts` had no `listDatingMatches` function before this pass.

- Observation: Local Dating query plans are dominated by tiny-table planner choices, so index usage is not fully representative of production.
    Evidence: local discover count used a sequential scan on `dating_profiles` with 79 rows and completed in about 0.932 ms; local Likes You count completed in about 0.571 ms and showed `idx_dating_profiles_user_completed_paused` as an index-only scan once it reached profile eligibility.

## Decision Log

- Decision: Keep Dating inside the existing Discover area for this pass, with internal top-level Dating tabs for `Discover`, `Likes You`, `Matches`, and `Profile`.
    Rationale: This keeps Dating cohesive without adding another bottom tab too early. The internal structure can later be promoted to a dedicated bottom tab if Dating becomes the dominant product surface.
    Date/Author: 2026-05-29 / User + Codex

- Decision: Treat the Matches screen as part of the Dating product, not only as a filtered chat list.
    Rationale: A match is a dating relationship state with dating-specific actions such as view profile, message, unmatch, and report. Chats should remain connected, but Dating needs its own match management surface.
    Date/Author: 2026-05-29 / User + Codex

- Decision: Prioritize backend correctness, private/public profile separation, and safety controls before adding subscription gates.
    Rationale: Monetization should not amplify incorrect matching, privacy leaks, or unsafe interactions. The free core loop must feel excellent before paid features are layered on top.
    Date/Author: 2026-05-29 / Codex

- Decision: Use a photo-first, restrained, high-end UI style for Dating screens.
    Rationale: Dating is a visual, high-intent feature. The UI should feel premium and effortless without noisy cards, excessive explanation, or cluttered controls.
    Date/Author: 2026-05-29 / User + Codex

- Decision: Defer prompts, comment-with-like, analytics wiring, and subscription gates from the first implementation slice.
    Rationale: The approved plan is large. The first slice closes correctness/privacy gaps and adds the core Dating product loop in a verifiable way. Prompts, analytics, and paywalls need separate QA and product decisions so they do not destabilize the core loop.
    Date/Author: 2026-05-29 / Codex

- Decision: Implement prompt answers and analytics now, but defer comment-with-like and first-message analytics to a later messaging-specific pass.
    Rationale: Prompt answers and event logging are additive to the Dating profile and discovery loop. Comment-with-like changes the action contract and first-message analytics belongs in the chat send path, so both need focused QA around messaging behavior.
    Date/Author: 2026-05-29 / Codex

## Outcomes & Retrospective

Implementation completed for the production Dating core loop in this plan. The backend now converts public Dating responses to a public profile shape, enforces mutual interested-in preference checks in discovery and action validation, rejects actions from paused/incomplete actors, improves candidate ranking signal merging, gates full Likes You behind active Plus, stores profile prompt answers, stores Dating analytics events, and has regression tests for public response privacy and event logging. The app now has internal Dating tabs for Discover, Likes You, Matches, and Profile; a Matches screen with new-match strip, match rows, chat handoff, and unmatch action; a reusable dating photo carousel; carousel-backed deck cards and profile detail; embedded Likes/Profile tabs without extra headers; profile prompt editing/preview; free-user Likes You upgrade gate; and report/block actions from Dating profile detail. Remaining work outside this plan is device QA plus larger follow-ups: comment-with-like and first-message analytics in the chat/action contract.

## Context and Orientation

The app repository is `/home/michaelroddy/repos/project_radeon_app`. It is an Expo React Native app. All HTTP calls and shared response types live in `src/api/client.ts`. Main authenticated navigation is owned by `src/navigation/AppNavigator.tsx`. The broad Discover experience is in `src/screens/main/DiscoverScreen.tsx`. Existing Dating UI components live under `src/components/discover/`, especially `DatingDeck.tsx`, `DatingLikesScreen.tsx`, and `DatingProfileEditorScreen.tsx`.

The backend repository is `/home/michaelroddy/repos/project_radeon`. It is a Go API. Dating routes are registered from `cmd/api/main.go`. The dating package under `internal/dating` owns discovery, likes, actions, matches, profile data, ranking, and discovery cache behavior. Database migrations live in `migrations/`, and the fresh schema lives in `schema/base.sql`.

In this plan, a dating profile is the profile shown only in Dating. It is separate from the community profile and contains dating-specific photos, bio, relationship goal, interests, and personal details. A public dating profile is what other users can see. A private dating profile is what the owner can edit and includes preferences such as interested-in genders, age range, distance, pause state, and other settings that should not be exposed to other users.

A dating action is a stored like or pass from one user toward another dating profile. A dating match is created when two users both like each other. A dating match may have a normal one-to-one chat attached to it. Unmatching should close or disable the dating-created relationship and prevent continued dating contact through that match.

## Plan of Work

Milestone 1 hardens backend correctness, privacy, and safety. In `/home/michaelroddy/repos/project_radeon/internal/dating`, update discovery and action validation so mutual preference compatibility is enforced server-side. Discovery must only return candidates the viewer is interested in and who are also interested in the viewer. Action validation must reject likes against profiles that fail core Dating eligibility, are blocked, are incomplete, are paused, or are outside mutual dating preference rules. Split backend response types so owner-only settings are returned only from `GET /dating/profile` and `PATCH /dating/profile`, while discovery, likes, public profile detail, and matches return only public dating profile data. Add or expose dating-specific block, report, and unmatch flows so the app can make safety actions visible from profile detail, match detail, and chat entry points.

Milestone 2 upgrades the app Dating area into a polished sub-product. In `src/screens/main/DiscoverScreen.tsx`, replace ad hoc Dating switching with clear internal Dating tabs: `Discover`, `Likes You`, `Matches`, and `Profile`. Use the same top-level tab styling language as the rest of the app, but tune spacing, typography, and empty states so the Dating area feels premium. Keep Dating inside Discover for now rather than adding a new bottom tab. Ensure each tab preserves reasonable local state when switching and does not refetch aggressively unless data is stale or user action requires it.

Milestone 3 adds the production Matches screen. Create a reusable Dating matches screen component under `src/components/discover/` or `src/screens/main/` depending on the existing component boundaries at implementation time. It should show a horizontal `New Matches` strip when there are recent matches without messages, followed by a polished list of active matches/conversations. Each match row should show dating photo, name, age if available, latest chat snippet or matched time, unread state if available, and a compact action affordance. Tapping a new match opens a dating match detail/profile surface with `Send message`. Tapping an existing conversation opens the current chat flow. The screen must support empty, loading, error, and refreshing states.

Milestone 4 adds a full dating profile detail experience. Create a profile detail surface that can be opened from the deck, likes-you, matches, and own-profile preview where appropriate. This screen should be photo-first, with a full multi-photo carousel, name/age/location, relationship goal, bio, interests, work, education, kids status, height, and sober-lifestyle prompts when those fields exist. The detail view should include clear primary actions depending on context: like/pass from discovery, like back/pass from likes-you, send message/unmatch/report from matches, and edit from own profile. Avoid showing community profile content unless explicitly intended by product design.

Milestone 5 implements multi-photo carousel behavior consistently. Use the existing dating profile photo array returned by the backend. In `DatingDeck.tsx`, own-profile preview, public profile detail, likes-you, and match detail, allow the user to move through photos with tap zones or horizontal paging, visible progress dots, and predictable image sizing. Preload the next few images in the deck so swiping does not show blank states. Keep card dimensions stable so photo changes do not cause layout jumps. Preserve accessibility by keeping button alternatives for like/pass and not relying only on gestures.

Milestone 6 adds focused profile richness without overbuilding. Add a small prompt system if the backend does not already have one: profile prompt definitions and profile prompt answers. Start with a short curated sober-dating set such as ideal alcohol-free date, sober weekend plan, what recovery lifestyle means to me, and what I am looking for. Allow liking or commenting on a photo or prompt later, but do not block this production pass on the comment-with-like feature unless the backend change is small and low risk. Improve profile completion guidance so the profile encourages at least two photos, a meaningful bio, relationship goal, interests, and core personal fields without making every field mandatory.

Milestone 7 improves performance and observability. In the backend, run `EXPLAIN (ANALYZE, BUFFERS)` against realistic Dating discovery and count queries, then add indexes only where the query plans justify them. Consider a two-phase discovery shape: first select candidate IDs and ranking signals, then hydrate profiles/photos/interests once. Fix candidate feature merging so a candidate found through multiple sources keeps the strongest shared-interest, distance, recency, and incoming-like signals. In the app, prefetch when the deck has two or three profiles left and avoid repeated first-page requests during quick tab switching. Add analytics events for dating profile setup started/completed, profile opened, impression, like, pass, match created, chat opened, first message sent, report, block, unmatch, and subscription-gated likes-you interaction.

Milestone 8 prepares subscription surfaces without making them brittle. Keep safety free. Make `Likes You` the main paid surface if subscriptions are enabled: free users can see count and limited previews, subscribers can view the full list and like back directly. Prepare advanced filters such as relationship goal, kids, education, height, recently active, and sober-lifestyle preferences for later gating. Do not add boost, travel mode, incognito, high-intent likes, or read receipts in this pass unless the core loop has already passed QA and performance validation.

## Concrete Steps

Start by creating implementation branches in both repositories:

    cd /home/michaelroddy/repos/project_radeon_app
    git switch main
    git pull
    git switch -c feature/dating-experience-production-pass

    cd /home/michaelroddy/repos/project_radeon
    git switch main
    git pull
    git switch -c feature/dating-experience-production-pass

Backend work should begin in `/home/michaelroddy/repos/project_radeon`. Inspect the current dating store, handler, ranker, cache, schema, and tests:

    rg -n "DatingProfile|Discover|RecordAction|Match|likes|interested_in|distance" internal/dating schema migrations
    sed -n '1,260p' internal/dating/handler.go
    sed -n '360,940p' internal/dating/store.go
    sed -n '1,220p' internal/dating/ranker.go
    sed -n '1,180p' internal/dating/cache_store.go

Update backend tests first where practical. Add tests that prove discovery respects mutual interested-in gender preferences, action validation rejects ineligible targets, public profile responses exclude private settings, unmatch blocks continued dating match state, and matches can be listed with public profile data.

Run backend validation after each backend milestone:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build go test ./internal/dating
    GOCACHE=/tmp/go-build go test ./...
    git diff --check

App work should continue in `/home/michaelroddy/repos/project_radeon_app`. Inspect the current Dating components and API client:

    rg -n "Dating|dating|Matches|Likes|ProfileEditor|recordDatingAction|discoverDating" src/api src/screens src/components src/navigation
    sed -n '1,260p' src/components/discover/DatingDeck.tsx
    sed -n '1,260p' src/components/discover/DatingLikesScreen.tsx
    sed -n '1,320p' src/components/discover/DatingProfileEditorScreen.tsx

Add API client functions and types only in `src/api/client.ts`. Do not call `fetch` directly from screens. Keep screen-specific components small; extract repeated Dating profile card, photo carousel, tab, and match row UI into reusable components under `src/components/discover/` if they are used more than once. Keep all styling in `StyleSheet.create` blocks and use design tokens from `src/theme`.

Run app validation after each app milestone:

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck
    git diff --check

Validation evidence from the first implementation slice:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build go test ./internal/dating
    ok github.com/project_radeon/api/internal/dating

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build go test ./...
    all backend packages passed

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build make migrate
    Applied 097_dating_prompts_events_and_indexes.sql

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck
    tsc --noEmit completed with exit code 0

    cd /home/michaelroddy/repos/project_radeon_app
    curl smoke against http://192.168.0.75:8080 as test@radeon.dev
    /health: 200
    POST /auth/login: 200
    GET /dating/profile: 200
    GET /dating/discover?distance_km=50&lat=51.52&lng=-0.34&limit=10: 200
    GET /dating/discover/preview?distance_km=50&lat=51.52&lng=-0.34: 200
    GET /dating/likes/preview: 200
    GET /dating/likes?limit=20: 200
    GET /dating/matches?limit=20: 200
    GET /dating/matches/{id}: 200
    POST /dating/events: 200
    Counts: profile_photos=3, discover=0, likes=0, matches=1

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck
    tsc --noEmit completed with exit code 0

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build go test ./internal/dating
    ok github.com/project_radeon/api/internal/dating

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build make migrate
    Applied 098_dating_match_views.sql

    cd /home/michaelroddy/repos/project_radeon
    PORT=8084 GOCACHE=/tmp/go-build go run ./cmd/api
    Smoke as test@radeon.dev:
      POST /auth/login: 200
      GET /dating/matches?limit=20 before mark-seen: unseen_count=1, items=1
      POST /dating/matches/seen: unseen_count=0
      GET /dating/matches?limit=20 after mark-seen: unseen_count=0

Local query-plan evidence:

    Dating discover count:
    Planning Time: 11.525 ms
    Execution Time: 0.932 ms
    Note: local planner used a sequential scan on dating_profiles because the table had only 79 rows.

    Dating Likes You count:
    Planning Time: 8.717 ms
    Execution Time: 0.571 ms
    Note: local plan used idx_dating_profiles_user_completed_paused as an index-only scan after matching incoming likes.

When migrations are added, run them from the backend repository with a writable Go build cache:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build make migrate

Finally, start the backend and Expo app against a local or LAN API URL, then manually smoke test Dating as at least two seeded or real users.

## Validation and Acceptance

Backend acceptance: `GET /dating/discover` returns only completed, unpaused, eligible public dating profiles. It must not return the viewer, blocked users, users who blocked the viewer, accepted friends if that rule remains active, users already liked or passed, active matches, candidates outside mutual interested-in preferences, or profiles with missing completion requirements. `POST /dating/actions` must reject invalid targets even if a malicious client sends a direct profile ID. Public profile payloads must not include private filters or preferences. `GET /dating/matches` must return active matches with public profile data and enough chat metadata for the app to render a dating inbox. Unmatch must make the match inactive and prevent it from behaving like an active dating relationship.

App acceptance: the Dating area inside Discover has internal tabs for `Discover`, `Likes You`, `Matches`, and `Profile`. The Discover tab shows a fast photo-first deck with stable layout, swipe and button actions, and profile detail opening. The Likes You tab opens public dating profiles and supports like-back/pass flows. The Matches tab shows new matches and active conversations with high-quality rows and clear empty/loading/error states. The Profile tab lets the user edit and preview their own dating profile. Profile detail screens include a multi-photo carousel and context-aware actions. Report, block, and unmatch actions are reachable without hunting through unrelated app screens.

Performance acceptance: discovery should not blank between cards during normal use on a real device with seeded data. Images for the current and next profiles should render promptly after initial load. App typecheck must pass. Backend tests must pass. SQL query plans for discovery should be captured in this plan or in a linked note before adding indexes, and any new indexes should be justified by observed query plans.

Subscription-readiness acceptance: `Likes You` can distinguish free and entitled users through existing or planned entitlement APIs without hardcoding a permanent paywall into the UI. Safety controls remain available regardless of entitlement. Analytics events exist for the core Dating funnel so conversion and retention can be measured before finalizing subscription gates.

## Idempotence and Recovery

Most changes should be additive. Backend migrations must use safe guards such as `IF NOT EXISTS` where appropriate and must not delete dating actions, matches, profiles, or photos. If a migration partially fails in local development, inspect the applied schema before rerunning; do not drop production-like data to recover unless the user explicitly authorizes it.

Repeated likes, passes, unmatches, and match creation attempts must remain safe. A duplicate like should not create duplicate matches or chats. A repeated unmatch should return a stable inactive state or a clear not-active response. App retries after network failure should not duplicate actions or leave the deck in an impossible state.

If the frontend implementation is interrupted, Friends, Meetings, Groups, Chats, and non-dating profile flows should remain usable. Dating tabs should fail closed with loading or error states rather than crashing the app. If backend changes are deployed before app changes, existing app requests should either remain compatible or return clear errors that the app can handle.

## Artifacts and Notes

Initial audit anchors:

    /home/michaelroddy/repos/project_radeon/internal/dating/store.go
    /home/michaelroddy/repos/project_radeon/internal/dating/ranker.go
    /home/michaelroddy/repos/project_radeon/internal/dating/cache_store.go
    /home/michaelroddy/repos/project_radeon/schema/base.sql
    /home/michaelroddy/repos/project_radeon_app/src/api/client.ts
    /home/michaelroddy/repos/project_radeon_app/src/screens/main/DiscoverScreen.tsx
    /home/michaelroddy/repos/project_radeon_app/src/components/discover/DatingDeck.tsx
    /home/michaelroddy/repos/project_radeon_app/src/components/discover/DatingLikesScreen.tsx
    /home/michaelroddy/repos/project_radeon_app/src/components/discover/DatingProfileEditorScreen.tsx

This plan builds on earlier checked-in plans:

    exec_plans/DATING_MATCH_SYSTEM_EXECPLAN.md
    exec_plans/dating-profile-separation.md

Those older plans document the first implementation of Dating actions/matches and the later separation of dating profiles from community profiles. This plan is the next production pass and should supersede their remaining future-work notes where they overlap.

## Interfaces and Dependencies

Backend public dating profile responses should not expose owner-only settings. At completion, app-facing API types should be conceptually separated like this:

    MyDatingProfile:
      id, user_id, display_name, age, bio, relationship_goal, interested_in_genders,
      age_min, age_max, distance_km, paused, completed_at, height_cm, work,
      education, kids_status, interests, photos, prompt_answers, created_at, updated_at

    PublicDatingProfile:
      id, user_id, display_name, age, bio, relationship_goal, distance_km when relevant,
      height_cm, work, education, kids_status, interests, photos, prompt_answers,
      last_active_at when product-approved

    DatingMatch:
      id, profile, chat_id, status, matched_at, updated_at, last_message_preview,
      unread_count when available

App API functions in `src/api/client.ts` should include or retain:

    getMyDatingProfile()
    updateMyDatingProfile(input)
    uploadDatingProfilePhoto(input)
    deleteDatingProfilePhoto(photoId)
    reorderDatingProfilePhotos(photoIds)
    discoverDatingProfiles(params)
    recordDatingAction(input)
    listDatingLikes(params)
    listDatingMatches(params)
    getDatingMatch(matchId)
    unmatchDatingMatch(matchId)
    reportDatingProfile(profileId, reason)
    blockDatingProfile(profileId)

The app should use existing React Native and Expo dependencies already in the project. Do not add a new navigation framework. Do not add a new external state library. Use the existing API client, React state/hooks, existing query/cache patterns, `react-native-gesture-handler`, and `react-native-reanimated` if gesture behavior needs to be extended. Use the existing design tokens from `src/theme`, and keep Dating UI components visually premium while still consistent with the rest of the app.

## Revision Notes

2026-05-29: Created the initial production Dating experience ExecPlan after auditing the current implementation and discussing the desired product direction. The plan focuses on the core dating loop, safety, performance, UI polish, and subscription readiness without introducing advanced dating features prematurely.
