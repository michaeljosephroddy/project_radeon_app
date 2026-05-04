# Frontend code health cleanup

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root. It is intentionally scoped to cleanup that preserves user-visible behavior while making the React Native app easier to maintain.

## Purpose / Big Picture

The SoberSpace mobile app has several large screens, recent icon and keyboard changes, and a shared API client. This cleanup makes the frontend easier to change without altering product behavior. A user should see the same app, with the already-requested icon, splash, and keyboard fixes included, while developers should see clearer code and passing TypeScript validation.

## Progress

- [x] (2026-05-04T08:58:52Z) Confirmed frontend cleanup will stay on the current `feature/update-soberspace-icon` branch and include existing icon, splash, and keyboard changes.
- [x] (2026-05-04T08:58:52Z) Created this ExecPlan.
- [x] (2026-05-04T09:04:06Z) Ran baseline `npx tsc --noEmit`; it passed.
- [x] (2026-05-04T09:04:06Z) Cleaned small frontend issues with low behavior risk: fixed group create button indentation, moved avatar frame sizing out of JSX, added a `typecheck` script, and corrected stale frontend repo instructions.
- [x] (2026-05-04T09:04:06Z) Re-ran `npm run typecheck`; it passed.
- [x] (2026-05-04T09:04:06Z) Recorded final outcome and remaining larger refactor candidates.

## Surprises & Discoveries

- Observation: The frontend already has uncommitted icon, splash, and keyboard changes on `feature/update-soberspace-icon`.
    Evidence: `git status --short --branch` lists native icon assets, `app.json`, splash files, `GroupCreateScreen.tsx`, and `GroupCreatePostScreen.tsx`.
- Observation: `npx tsc --noEmit` is the effective frontend validation command but was not exposed as an npm script.
    Evidence: `package.json` had `start`, `android`, `ios`, and `web`, but no typecheck script.
- Observation: `AGENTS.md` still described an older `src/utils/theme.ts` shim and old run commands.
    Evidence: The actual repo has `src/theme/`, and package scripts are `npm run ios`, `npm run android`, and `npm run web`.

## Decision Log

- Decision: Keep frontend cleanup on the current branch instead of branching from the current state.
    Rationale: The user explicitly said not to branch from the current frontend state and to include the frontend changes in cleanup.
    Date/Author: 2026-05-04 / Codex.
- Decision: Limit frontend cleanup to low-risk source hygiene in this pass.
    Rationale: The app has large screens and no visual regression suite; broad extraction would carry higher risk than the current request warrants in the same branch as asset and keyboard changes.
    Date/Author: 2026-05-04 / Codex.

## Outcomes & Retrospective

Frontend cleanup completed for this pass. The app branch now includes the existing icon/splash/keyboard work plus a small code-health cleanup: a discoverable `npm run typecheck` script, cleaner avatar frame styling, corrected group create form indentation, and current repository instructions. Larger refactors remain intentionally deferred because the app has large screen files but no visual regression suite in this repo.

## Context and Orientation

This is an Expo React Native app. `src/api/client.ts` contains API response types and all network calls. `src/navigation/AppNavigator.tsx` owns tab navigation and modal-like overlays. Screens live under `src/screens/`, reusable components under `src/components/`, hooks under `src/hooks/`, and design tokens under `src/theme/`. The current branch already contains app icon, splash background, and keyboard behavior changes requested earlier in the session.

## Plan of Work

Start with validation so any existing TypeScript issues are known. Then make low-risk cleanup edits only: remove stale imports, remove dead code, improve obvious silent error handling where it does not change product flow, tighten duplicated layout constants, and update stale local documentation if discovered. Avoid broad extraction of the largest screens unless a small extraction is clearly mechanical and validated.

## Concrete Steps

Run from `/home/michaelroddy/repos/project_radeon_app`:

    npx tsc --noEmit

Then edit focused files with `apply_patch`. After each cleanup group, run:

    npx tsc --noEmit

## Validation and Acceptance

Acceptance is `npx tsc --noEmit` exiting with code 0. The app should retain existing behavior, including the new app icon assets, `#07090c` splash background, group create keyboard spacer, and group create post keyboard wrapper.

## Idempotence and Recovery

All cleanup edits are normal source changes. If a change is wrong, revert only the affected file hunk rather than resetting the worktree, because the branch includes user-requested uncommitted asset and keyboard changes.

## Artifacts and Notes

Validation transcript summary:

    npm run typecheck
    > project-radeon@1.0.0 typecheck
    > tsc --noEmit

The command exited with code 0.

## Interfaces and Dependencies

No new runtime dependencies are planned. Existing dependencies include Expo, React Native, React Query, `react-native-keyboard-controller`, and Reanimated.
