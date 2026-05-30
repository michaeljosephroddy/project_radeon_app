# Reach Out Support Signals

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `PLANS.md` in this repository and the backend repository at `/home/michaelroddy/repos/project_radeon`.

## Purpose / Big Picture

Reach Out gives sober community members a lightweight way to ask for immediate support without turning the Community Support group into an urgent queue. A user can start a short-lived signal, friends with alerts enabled can be notified, other users can see the signal in Community, and a responder can open a direct chat.

## Progress

- [x] (2026-05-30) Created additive backend tables for support signals and support signal responses.
- [x] (2026-05-30) Added backend routes for active signals, my active signal, create, respond, resolve, and cancel.
- [x] (2026-05-30) Added notification preference support for Reach Out alerts.
- [x] (2026-05-30) Added app API functions, query hooks, Community Reach Out tab, Create menu entry, and Create Reach Out screen.
- [x] (2026-05-30) Simplified the Community Support group path so it no longer switches into the legacy urgent support request UI.
- [x] (2026-05-30) Added global Reach Out avatar markers through one shared active-signal provider and the shared `Avatar` component.
- [x] (2026-05-30) Added focused Reach Out notification navigation and an opt-in helper alert preference for non-friend notifications.
- [x] (2026-05-30) Added targeted backend handler tests for signal creation validation, daily limit handling, normalization, and invalid response ids.
- [x] (2026-05-30) Removed Reach Out notes from backend storage, API contracts, notification copy, and the create/view UI.
- [x] (2026-05-30) Replaced the heart avatar badge with a red avatar ring for active Reach Out users.
- [x] (2026-05-30) Hardened Reach Out notifications with reason-aware alert copy, reason payloads, response chat payload checks, fanout integration tests, and non-heart notification icons.

## Surprises & Discoveries

- Observation: Current support requests are deeply coupled to group posts and offer/accept management screens.
    Evidence: `GroupDetailScreen.tsx` previously rendered `SupportRequestCard` for Community Support posts and had a My Requests tab.

- Observation: Go tests need a writable cache in this environment.
    Evidence: running `go test` without `GOCACHE=/tmp/project_radeon_go_cache` attempted to write under a read-only home cache.

- Observation: A global app provider is a safer first implementation for avatar markers than per-row backend decoration.
    Evidence: all relevant app surfaces already render the shared `Avatar` component, so one active-signal query can decorate feed, comments, chats, profile, discover, groups, and meetups without adding many backend joins or app-side per-row fetches.

## Decision Log

- Decision: Keep legacy support request tables and API routes intact.
    Rationale: Reach Out replaces the user-facing urgent path, but deleting legacy data/API in the same change would increase migration risk.
    Date/Author: 2026-05-30 / Codex

- Decision: Responding to a signal returns a `chat_id`, then the app loads the existing chat summary.
    Rationale: This reuses the established chat API and avoids duplicating chat response shapes in the support package.
    Date/Author: 2026-05-30 / Codex

- Decision: Friend notification fanout is capped at 100 recipients for v1.
    Rationale: It prevents one Reach Out signal from producing unbounded notification work.
    Date/Author: 2026-05-30 / Codex

- Decision: Use a shared Reach Out status provider plus the shared `Avatar` component for global markers.
    Rationale: This satisfies the user-visible “marked across the app” behavior without an expensive fetch per avatar. Backend list-decoration can still be added later if a screen needs richer marker metadata beyond the active badge.
    Date/Author: 2026-05-30 / Codex

- Decision: Add `reach_out_helper_alerts` as a separate opt-in preference for non-friends.
    Rationale: Friend alerts should remain enabled by default, while broader helper alerts should require explicit consent.
    Date/Author: 2026-05-30 / Codex

- Decision: Do not store a free-text note on Reach Out signals.
    Rationale: The feature should stay lightweight and option-driven, with details moving into the responder chat instead of another urgent public text surface.
    Date/Author: 2026-05-30 / Codex

## Outcomes & Retrospective

The full planned Reach Out feature is implemented across the backend and mobile app. Users can create, view, respond to, cancel, and resolve Reach Out signals. Friend alerts are enabled by default, non-friend helper alerts are opt-in, notification taps can focus a signal or open chat, and active users are marked with a red avatar ring through the shared `Avatar` component.

Reach Out notifications now include reason-aware copy, carry the selected reason in `support.signal` payloads, carry chat ids in `support.signal_response` payloads, and use Reach Out-specific notification list icons instead of the generic heart treatment.

## Context and Orientation

The app repo is `/home/michaelroddy/repos/project_radeon_app`. App API calls live in `src/api/client.ts`, Community UI lives in `src/screens/main/CommunityHubScreen.tsx`, and navigation is in `src/navigation/`.

The backend repo is `/home/michaelroddy/repos/project_radeon`. Support HTTP handlers live in `internal/support/handler.go`, support storage lives in `internal/support/`, and routes are registered in `cmd/api/main.go`.

## Plan of Work

The backend adds `support_signals` and `support_signal_responses`. A signal has one active row per user, expires after two hours, and can be resolved or cancelled. The active list excludes blocked users, deleted users, and the current user. Responding creates or reuses a direct chat and records an idempotent response.

The app adds Reach Out as the first Community tab and replaces the old Create menu support request entry with Reach Out. The new screen lists active signals, shows the current user's live signal, and opens chat when responding. A shared Reach Out status provider loads active signals once and the shared `Avatar` component renders a red ring for active users across the app.

## Concrete Steps

Backend validation:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project_radeon_go_cache go test ./...

App validation:

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck

Manual verification:

    Start the backend and Expo app. Sign in as two users who are friends. User A creates a Reach Out signal from Create. User B opens Community > Reach Out, taps Message, and lands in a direct chat. User A can resolve or cancel the live signal.

## Validation and Acceptance

Acceptance is met when backend tests pass, app typecheck passes, and the manual two-user flow works. The Reach Out tab should show active signals, the Create flow should no longer say Support request, and Community Support should behave like a regular group feed rather than an urgent support offer queue.

Current validation evidence:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project_radeon_go_cache go test ./...
    # passed

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck
    # passed

## Idempotence and Recovery

The migration is additive and does not drop legacy support request tables. If signal fanout becomes noisy during testing, temporarily reduce the query limit in `CreateSupportSignalNotifications` and record that change in the Decision Log.

## Artifacts and Notes

The implementation intentionally keeps old support request API functions available until a later cleanup confirms no app or backend clients still depend on them.

Revision note: The plan was updated on 2026-05-30 after completing global avatar markers, focused signal notification navigation, helper alert opt-in, targeted backend tests, note removal, the red avatar ring marker, and notification hardening.

## Interfaces and Dependencies

Backend endpoints:

    GET /support/signals/active
    GET /support/signals/mine
    POST /support/signals
    POST /support/signals/{id}/respond
    POST /support/signals/{id}/resolve
    POST /support/signals/{id}/cancel

App API functions:

    getActiveSupportSignals()
    getMySupportSignal()
    createSupportSignal()
    respondToSupportSignal()
    resolveSupportSignal()
    cancelSupportSignal()
