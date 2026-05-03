# Polish Groups Support Workflows

This ExecPlan is a living document. It follows `PLANS.md` in this repository and must keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Purpose / Big Picture

This work makes the community support group feel production-ready. A user should be able to create a support request without keyboard overlap, scroll without the create button blocking content, offer private help distinctly from public replies, close a request and see it leave the open group feed, manage their own support requests from the group, understand who administers a group, share formatted group invites through chat, know where reports go, and search groups by richer filters without client-side full-list scans.

## Progress

- [x] (2026-05-03 00:00Z) Investigated app and backend code paths for group support requests, invite creation, reporting, admin inbox, filters, and keyboard handling.
- [x] (2026-05-03 00:05Z) Created `feature/polish-groups-support` branches in `/home/michaelroddy/repos/project_radeon_app` and `/home/michaelroddy/repos/project_radeon`.
- [x] (2026-05-03 00:45Z) Implemented backend contract changes for admin previews, invite previews, report inbox, filtered support group posts, group type/visibility filters, and partial country/city search.
- [x] (2026-05-03 01:20Z) Implemented app UI changes for keyboard insets, floating action visibility, support management, offer/reply polish, badges, admin/about, invite cards, reports, and filters.
- [x] (2026-05-03 01:25Z) Ran focused backend and app validation.

## Surprises & Discoveries

- Observation: Closing a support request updates `support_requests.status`, but group post listing still attaches closed support requests to `need_support` posts.
    Evidence: `/home/michaelroddy/repos/project_radeon/internal/groups/store.go` attaches support requests by ID without filtering status, while the app invalidates queries rather than removing the card optimistically.
- Observation: Report submission says reports enter a moderation queue, but the app has no report queue surface.
    Evidence: `GroupReportScreen` submits to `/groups/{id}/report`; `GroupAdminScreen` has only `Requests` and `Inbox` tabs.
- Observation: Invites are cryptographically sound but poorly presented.
    Evidence: the backend hashes invite tokens and only returns the raw token once, while `GroupAboutTab` renders that raw token as selectable text.
- Observation: The app branch compiles after the UI changes.
    Evidence: `npx tsc --noEmit` completed with exit code 0.
- Observation: The backend group/support/notification packages still pass after the contract changes.
    Evidence: `GOCACHE=/tmp/go-build-cache go test ./internal/groups ./internal/support ./internal/notifications` completed with exit code 0.

## Decision Log

- Decision: Use `react-native-keyboard-controller` through the existing `useGradualKeyboardInset` hook for the create support request screen.
    Rationale: The user explicitly requested this approach and the post composer already validates it as a local pattern.
    Date/Author: 2026-05-03 / Codex
- Decision: Keep private support offers and public replies as separate actions.
    Rationale: Offers create a requester-controlled private support path; replies are public thread participation. Combining them would confuse moderation and requester consent.
    Date/Author: 2026-05-03 / Codex
- Decision: Make backend filtering authoritative for open community support requests.
    Rationale: Removing closed cards only in the app would hide the symptom for one screen but leave stale behavior for notifications, pagination, and later clients.
    Date/Author: 2026-05-03 / Codex

## Outcomes & Retrospective

The implementation now covers the requested polish across app and backend. The remaining work is manual multi-user verification against a migrated local database because invite acceptance, report routing, and offer acceptance involve several authenticated users and notification state.

## Context and Orientation

The app repository is `/home/michaelroddy/repos/project_radeon_app`. Group discovery is in `src/screens/main/GroupsScreen.tsx`, group detail is in `src/screens/main/groups/GroupDetailScreen.tsx`, support request creation is in `src/screens/main/CreateSupportRequestScreen.tsx`, shared support cards are in `src/components/support/SupportRequestCard.tsx`, group query hooks are in `src/hooks/queries/useGroups.ts`, and app API types live in `src/api/client.ts`.

The backend repository is `/home/michaelroddy/repos/project_radeon`. Group HTTP handlers are in `internal/groups/handler.go`, group database access is in `internal/groups/store.go`, group types are in `internal/groups/types.go`, and migrations are in `migrations/`. Support request state changes are in `internal/support/store.go` and `internal/support/handler.go`.

A support request is a record created by someone asking for help. A public reply is a visible comment-like response. A support offer is a private offer of direct help; the requester must accept it before a support chat opens.

## Plan of Work

First, update the backend so app screens can rely on correct server behavior. Add fields for group owner/admin previews, add invite preview metadata and report listing/review APIs, exclude closed support request posts from the open community support feed, and improve group filter matching for typed country/city searches. Add indexes where partial matching would otherwise scan too much data.

Second, update the app contracts and query hooks to match the backend. Add typed API functions for invite preview, report listing/review, and expanded group filters.

Third, update the app screens. `CreateSupportRequestScreen` should use `useGradualKeyboardInset` with an animated spacer, `GroupDetailScreen` should get a community support management surface and use a scroll-aware FAB, `SupportRequestCard` should show semantic badges and an explicit offer CTA, `GroupAboutTab` should show admins and formatted invite share UI, `GroupAdminScreen` should add reports, and `GroupsScreen` should support typed advanced filters.

## Concrete Steps

Run backend validation from `/home/michaelroddy/repos/project_radeon`:

    GOCACHE=/tmp/go-build-cache go test ./internal/groups ./internal/support ./internal/notifications

Run app validation from `/home/michaelroddy/repos/project_radeon_app`:

    npx tsc --noEmit

If Expo needs manual verification, start it from `/home/michaelroddy/repos/project_radeon_app`:

    npx expo start

## Validation and Acceptance

Closing a support request from the community support group must make the card disappear from the open group feed after the mutation completes and remain visible in the user's own request history. Creating a support request must keep the message field and submit button visible above the keyboard on iOS and Android. A non-owner viewing an open support request must see a private offer action and a separate public reply action. Group About must name the owner/admins, show formatted invite information, and accurately state reports go to group admins/moderators. Admins must see submitted reports in the admin center. Group filters must accept typed country/city partial matches and preserve cursor pagination.

## Idempotence and Recovery

All migrations are additive. Re-running app queries and backend tests is safe. If a branch already exists, continue on it rather than creating a second branch. Do not reset user changes; inspect and adapt if files are dirty.

## Artifacts and Notes

Validation evidence:

    /home/michaelroddy/repos/project_radeon_app$ npx tsc --noEmit
    exit code 0

    /home/michaelroddy/repos/project_radeon$ GOCACHE=/tmp/go-build-cache go test ./internal/groups ./internal/support ./internal/notifications
    ok  	github.com/project_radeon/api/internal/groups
    ok  	github.com/project_radeon/api/internal/support
    ok  	github.com/project_radeon/api/internal/notifications
