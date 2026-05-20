# Build production Dating matches and swipe deck

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` in the app repository and `/home/michaelroddy/repos/project_radeon/PLANS.md` in the backend repository.

## Purpose / Big Picture

SoberSpace currently has a Dating tab concept, but Dating discovery still behaves like ordinary people discovery. After this change, users who opted into Dating can browse one profile at a time, swipe or tap to like/pass, and receive a real match when two people like each other. A match creates or reuses a normal one-to-one chat so the result is actionable immediately. Friends discovery remains recovery/community oriented, and Dating remains opt-in.

## Progress

- [x] (2026-05-20T11:15Z) Confirmed existing app Discover tab shape, backend discover routes, existing chat creation/reuse behavior, blocks/reports, friendships, and notification primitives.
- [x] (2026-05-20T11:15Z) Locked product decisions: mutual matches auto-create chat, existing friends are excluded from Dating, Dating off keeps matches/chats but blocks new actions, unmatch closes chat, passes are permanent, and new matches notify in-app/push.
- [x] (2026-05-20T11:31Z) Added backend schema, migration `073_dating_match_system.sql`, and `internal/dating` package with discover, preview, action, match, and unmatch behavior.
- [x] (2026-05-20T11:31Z) Wired backend routes and added handler tests for filter parsing, action validation, match notification, and unmatch route IDs.
- [x] (2026-05-20T11:31Z) Added app API client types/functions and Dating discover query hooks.
- [x] (2026-05-20T11:31Z) Added Dating swipe deck UI and match modal.
- [x] (2026-05-20T11:31Z) Wired Discover Dating tab to the deck, filters, optimistic like/pass, match modal, and chat opening.
- [x] (2026-05-20T11:32Z) Ran final app and backend validation: app typecheck, backend full Go test suite, and whitespace diff checks passed.
- [x] (2026-05-20T13:08Z) Added backend seed support for 76 Dating-enabled mock profiles plus seeded incoming likes to the test user.
- [x] (2026-05-20T13:22Z) Replaced Dating discover's simple profile-completeness/newest ordering with an explainable ranker using distance, activity, shared interests, profile completeness, sobriety similarity, and new-profile freshness.

## Surprises & Discoveries

- Observation: Direct chat reuse currently lives in the chat handler, while `internal/chats.pgStore.CreateChat` always inserts a new chat.
    Evidence: `internal/chats/handler.go` checks `FindDirectChat` before calling `CreateChat`, but `internal/chats/store.go` inserts a new row in `CreateChat`.

- Observation: The backend already has discover impressions but no persisted dating action or match model.
    Evidence: `schema/base.sql` defines `discover_impressions`, `friendships`, `chats`, `user_blocks`, and `user_reports`, but no `dating_actions` or `dating_matches` tables.

- Observation: Dating must ignore Friends search state after the top-level tab split.
    Evidence: `DiscoverScreen` keeps `searchText` in component state while changing tabs, so Dating empty copy and query state must derive search only when `activeTab === 'friends'`.

## Decision Log

- Decision: Dating gets its own backend package and API routes under `/dating`.
    Rationale: Dating has different exclusion rules from Friends discovery and should not overload `/users/discover` with swipe/match semantics.
    Date/Author: 2026-05-20 / Codex

- Decision: A mutual Dating like creates or reuses a normal direct chat.
    Rationale: Matches should be immediately actionable and use the existing Chats tab instead of a parallel messaging system.
    Date/Author: 2026-05-20 / User + Codex

- Decision: Accepted friends are excluded from Dating discovery.
    Rationale: The Dating tab should focus on new romantic connections and avoid duplicate friend/dating relationships for MVP.
    Date/Author: 2026-05-20 / User + Codex

- Decision: Passes are permanent.
    Rationale: Passing should be a clear boundary and should keep the swipe deck from recycling profiles unexpectedly.
    Date/Author: 2026-05-20 / User + Codex

- Decision: Turning Dating off keeps existing matches and chats.
    Rationale: Dating mode is a discoverability/new-action preference, not a destructive account cleanup action.
    Date/Author: 2026-05-20 / User + Codex

- Decision: Unmatching closes the associated direct chat.
    Rationale: Unmatch is an explicit boundary action; closing the chat avoids continued contact through a Dating-created thread.
    Date/Author: 2026-05-20 / User + Codex

- Decision: Dating mock users live in the backend seed generator, not in the app.
    Rationale: The swipe deck should exercise the real `/dating/discover` and `/dating/actions` APIs, including opt-in checks, filters, distance, and mutual-like match creation.
    Date/Author: 2026-05-20 / Codex

- Decision: Dating ranking is explainable and strict-filtered for v1, with no Plus boost and no swipe-learning.
    Rationale: Romantic discovery should be trust-oriented and predictable before introducing personalization from likes/passes or paid visibility effects.
    Date/Author: 2026-05-20 / User + Codex

## Outcomes & Retrospective

Implemented backend schema, API routes, match/action logic, explainable Dating ranking, notifications, backend dating seed data, app API client functions, Dating query hooks, the one-card Dating deck, and match modal/chat handoff. Validation passed with `npm run typecheck`, `GOCACHE=/tmp/go-build go test ./...`, and `git diff --check` in both repositories. Remaining gap: manual Expo QA against a running backend with the latest seed data applied.

## Context and Orientation

The app repository is `/home/michaelroddy/repos/project_radeon_app`. The backend repository is `/home/michaelroddy/repos/project_radeon`. The app talks to the backend through `src/api/client.ts`. The Discover screen is `src/screens/main/DiscoverScreen.tsx`; it currently has top tabs `Friends`, `Meetings`, and `Dating`, with Dating shown only when the current user has `connection_intents` containing `dating`.

The backend is a Go API. Routes are wired in `cmd/api/main.go`. User discovery lives in `internal/user`. Direct chats live in `internal/chats`. Notifications live in `internal/notifications`. Blocks and reports already exist through `user_blocks` and `user_reports`. Accepted friends are stored in `friendships`.

In this plan, a Dating action is a persisted decision by one user about another user: either `like` or `pass`. A Dating match is created when two users both have `like` actions toward each other. A pass suppresses the target permanently from that viewer's Dating deck. A match is active until one user unmatches.

## Plan of Work

First, add backend persistence. Create migration `073_dating_match_system.sql` and mirror it in `schema/base.sql`. Add `dating_actions` with actor, target, action, timestamps, and a unique actor-target pair. Add `dating_matches` with a sorted user pair, status, chat_id, matched_at, updated_at, unmatched_at, and unmatched_by. Add indexes for actor actions, target likes, active matches per user, and chat lookup.

Second, add `internal/dating`. The handler should expose discover, preview, action, match list/detail, and unmatch endpoints. The store should validate Dating opt-in for actor and target, exclude blocked users and accepted friends, upsert actions, create exactly one match on mutual likes, find or create one direct active chat for a match, and close the chat when unmatching. New match notifications should use the existing notification service with a `dating.match` notification type.

Third, wire routes in `cmd/api/main.go`. Instantiate a dating store and handler, then mount `/dating/discover`, `/dating/discover/preview`, `/dating/actions`, `/dating/matches`, `/dating/matches/{id}`, and `/dating/matches/{id}/unmatch` inside the protected API group.

Fourth, update the app API client. Add Dating types and functions to `src/api/client.ts`: `discoverDatingUsers`, `previewDatingDiscover`, `recordDatingAction`, `listDatingMatches`, `getDatingMatch`, and `unmatchDatingMatch`. The dating discover params should reuse non-search discover filters and cursor pagination.

Fifth, add the Dating deck UI. The Dating tab in `DiscoverScreen` should show a filter button and active filter chips, no search bar, and one profile card at a time. Use `react-native-gesture-handler` and `react-native-reanimated` for swipe gestures, and include visible Pass, profile, and Like buttons for accessibility. Likes and passes optimistically advance the deck. A mutual match opens a match modal with `Send message` and `Keep browsing`.

## Concrete Steps

Work from the app repository branch `feature/connection-intent-dating-mode-execplan` and backend branch `feature/dating-match-system`.

Backend validation commands:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/go-build go test ./internal/dating
    GOCACHE=/tmp/go-build go test ./internal/user
    GOCACHE=/tmp/go-build go test ./internal/chats
    GOCACHE=/tmp/go-build go test ./...

App validation command:

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck

## Validation and Acceptance

Backend acceptance: `POST /dating/actions` with a pass suppresses a profile. A one-way like does not create a match. A reciprocal like returns `matched: true` and a `chat_id`. Duplicate likes return the same active match/chat. `GET /dating/discover` never returns self, blocked users, accepted friends, targets already liked/passed by the viewer, active matches, or users without Dating enabled. `POST /dating/matches/{id}/unmatch` marks the match unmatched and closes the associated chat.

App acceptance: A Dating-enabled user sees the Dating tab. The Dating tab has filters but no search. The tab displays one card at a time. Swiping/tapping pass advances the card and suppresses that user. Swiping/tapping like advances the card. A mutual like displays a match modal. `Send message` opens the existing chat screen. Turning Dating off hides the Dating tab.

## Idempotence and Recovery

The schema changes are additive. The action upsert and match unique pair constraints make repeated likes safe. If app work fails midway, Friends and Meetings tabs should remain unchanged. If backend matching fails after action storage, retrying the same like should either create the missing match or return the existing action/match without duplicating rows.

## Artifacts and Notes

Initial evidence:

    internal/chats/handler.go reuses direct chats through FindDirectChat before CreateChat.
    internal/chats/store.go CreateChat always inserts a new chat row.
    schema/base.sql has discover_impressions, friendships, user_blocks, user_reports, chats, and chat_members.
    schema/base.sql has no dating_actions or dating_matches before this plan.

## Interfaces and Dependencies

Backend response from `POST /dating/actions`:

    {
      "action": "like" | "pass",
      "matched": boolean,
      "match": DatingMatch | null,
      "chat": Chat | null
    }

`DatingMatch` contains `id`, `user`, `chat_id`, `status`, `matched_at`, and optional `unmatched_at`.

The app should use `react-native-gesture-handler` and `react-native-reanimated`, already present in `package.json`, for card swipes. Do not add a new gesture library.
