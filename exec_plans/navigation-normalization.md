# Normalize Full-Screen App Flows Into React Navigation

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `PLANS.md` in the repository root.

## Purpose / Big Picture

The app should behave consistently when a user opens a full-screen surface. Full-screen pages such as profile friends, profile edit, onboarding steps, meetup review, and group reporting should be owned by React Navigation instead of hidden behind local state switches. After this change, Android hardware back, header back buttons, and future deep links or notifications will behave predictably across these areas.

The user-visible outcome is that profile subpages, onboarding steps, meetup form/review, and group reporting all open as navigation routes. In-app segmented tabs such as Discover Friends/Meetings/Dating and Community Reach Out/Groups/Meetups remain local tabs because they are sections of one page rather than separate pages.

## Progress

- [x] (2026-05-30T20:27Z) Audited navigation-owned screens versus local-state full-screen flows.
- [x] (2026-05-30T20:27Z) Identified remaining conversion targets: profile edit/friends/requests, onboarding steps, meetup form/review, group report, and create support request.
- [x] (2026-05-30T20:27Z) Convert onboarding from local step state to a native stack.
- [x] (2026-05-30T20:27Z) Convert profile edit/friends/requests into profile stack routes.
- [x] (2026-05-30T20:35Z) Convert meetup create/review into navigation routes.
- [x] (2026-05-30T20:35Z) Convert group report into a route instead of an embedded branch inside group detail.
- [x] (2026-05-30T20:35Z) Reconnect or remove `CreateSupportRequestScreen`.
- [x] (2026-05-30T21:22Z) Convert group admin into a root stack route.
- [x] (2026-05-30T21:22Z) Extract support request management into its own route-owned screen.
- [x] (2026-05-30T21:22Z) Remove the unreachable embedded meetup create/review pane from `MeetupsScreen`.
- [x] (2026-05-30T20:27Z) Ran `npm run typecheck` after onboarding and profile conversion; it passed.
- [x] (2026-05-30T20:35Z) Run Android export smoke.
- [x] (2026-05-30T21:22Z) Re-ran `npm run typecheck` and Android export after the remaining route conversions.

## Surprises & Discoveries

- Observation: Settings legal/support documents were already converted to navigation screens before this plan, but profile edit/friends/requests were still controlled by `ProfileTabScreen` local `subView` state.
    Evidence: `src/screens/main/ProfileTabScreen.tsx` defines `type SubView = 'profile' | 'edit-profile' | 'friends' | 'requests'` and calls `setSubView(...)`.
- Observation: `CreateSupportRequestScreen` is exported but not mounted by any navigator or discovered call site.
    Evidence: `rg "CreateSupportRequestScreen" src` only finds the screen file and no navigator route.
- Observation: The standalone `CreateMeetupScreen` is the active create/manage entry point from the global create menu and meetup manage actions.
    Evidence: `RootNavigation` mounts `CreateMeetup`, `CreateMenuScreen` calls `navigation.replace('CreateMeetup')`, and `AppNavigator` navigates manage actions to `CreateMeetup`.
- Observation: `MeetupsScreen` still contains an older embedded create pane, but the visible segmented control only exposes Discover, Hosting, and Going.
    Evidence: `MeetupsScreen` segmented items do not include `create`, and `rg "setActiveView\\('create'" src/screens/main/MeetupsScreen.tsx` found no current entry point.

## Decision Log

- Decision: Keep in-screen segmented controls local rather than making every tab a route.
    Rationale: Discover tabs, Community tabs, group-detail tabs, and dating editor tabs are sections inside one screen. Routing them would add complexity without improving back behavior.
    Date/Author: 2026-05-30 / Codex
- Decision: Convert only full-screen surfaces with their own header/back behavior.
    Rationale: These are the screens where users expect Android hardware back and header back to behave consistently.
    Date/Author: 2026-05-30 / Codex
- Decision: Remove `CreateSupportRequestScreen` instead of reconnecting it.
    Rationale: The product direction moved immediate help to Reach Out and left community support as regular group/thread behavior. Reconnecting the old support-request creator would reintroduce the older urgent-request model.
    Date/Author: 2026-05-30 / Codex
- Decision: Convert the active standalone meetup create/manage route and remove the unreachable embedded create pane in `MeetupsScreen`.
    Rationale: The active app entry points all use `CreateMeetupScreen`, and keeping a second local create/review implementation creates future navigation and maintenance risk.
    Date/Author: 2026-05-30 / Codex

## Outcomes & Retrospective

Implemented. Profile edit/friends/requests are now profile-stack routes, onboarding is a native stack, the active meetup create/review flow is a nested native stack, group reporting and group admin are root routes, support request management is route-owned, the disconnected legacy create-support-request screen was removed, and the unreachable meetup embedded create pane was removed. Validation passed with `npm run typecheck` and Android export.

## Context and Orientation

The React Native app uses React Navigation in `src/navigation`. `RootNavigation.tsx` owns the authenticated root stack. `AppNavigator.tsx` owns the bottom tabs and nested tab stacks. `AuthNavigator.tsx` owns login, registration, and legal document screens. `OnboardingNavigator.tsx` currently uses local state instead of React Navigation.

Before this plan, `SettingsScreen` and its child pages were moved into the profile stack. The remaining inconsistent full-screen flows are profile edit/friends/requests in `src/screens/main/ProfileTabScreen.tsx`, onboarding steps in `src/navigation/OnboardingNavigator.tsx`, meetup review in `src/screens/main/CreateMeetupScreen.tsx` and `src/screens/main/MeetupsScreen.tsx`, group reporting in `src/screens/main/groups/GroupDetailScreen.tsx`, and the currently unreachable `src/screens/main/CreateSupportRequestScreen.tsx`.

## Plan of Work

First, replace the onboarding local step index with a native stack navigator. Each onboarding step remains the same component, but `onNext` and `onBack` call `navigation.navigate(...)` and `navigation.goBack()` instead of incrementing local state.

Second, change `ProfileTabScreen` so the visible full-screen mode is passed in by the profile stack rather than stored internally. `AppNavigator.tsx` will add routes for profile edit, friends, and requests. The profile home buttons navigate to those routes.

Third, make meetup review a navigation route for the standalone create meetup flow. If the embedded create flow inside `MeetupsScreen` is still active, convert or simplify it so review/back behavior is not local stage switching.

Fourth, move group reporting to a route. `GroupDetailScreen` will request navigation to a report route instead of rendering `GroupReportScreen` through a local branch.

Fifth, decide whether to reconnect `CreateSupportRequestScreen` to navigation or remove it. If reconnecting, add a root stack route and a clear entry point. If removing, delete the screen only if no API or UI depends on it.

## Concrete Steps

Run these commands from `/home/michaelroddy/repos/project_radeon_app`.

    npm run typecheck
    HOME=/tmp/project_radeon_expo_home EXPO_HOME=/tmp/project_radeon_expo_home npx expo export --platform android --output-dir /tmp/project_radeon_app_navigation_export_$(date +%s)

## Validation and Acceptance

TypeScript must pass with no errors. Android export must bundle successfully. Manual acceptance is that Settings, profile friends, profile requests, profile edit, onboarding next/back, meetup review/back, and group report/back all use the same push/back navigation behavior.

## Idempotence and Recovery

All edits are source-code changes on the current feature branch. If a route conversion causes type errors, revert only the affected files or continue by restoring the prior component callback shape. Do not reset the repository.

## Artifacts and Notes

- `npm run typecheck` passed.
- Android export passed and wrote bundle output to `/tmp/project_radeon_app_navigation_export_1780173355`.
- Follow-up `npm run typecheck` passed after group admin/support management routing.
- Follow-up Android export passed and wrote bundle output to `/tmp/project_radeon_app_navigation_export_1780176148`.

## Interfaces and Dependencies

Use `@react-navigation/native-stack`, already installed and used by the app. Do not add a new navigation library. Keep route param types close to the navigator that owns the routes unless a root-level route needs to be referenced by multiple modules.
