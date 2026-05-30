# Migrate the App to Real Screen Navigation

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `PLANS.md` in the repository root. Any contributor implementing this plan must update this file as discoveries are made, decisions change, or milestones are completed.

## Purpose / Big Picture

The app currently uses a custom navigation shell in `src/navigation/AppNavigator.tsx` where many pages are shown by setting local state and conditionally rendering overlays, modals, or replacement views. This has started to show visible flicker in high-value flows, especially Dating, because screens are mounted, unmounted, hidden, and re-rendered manually instead of using a real navigation stack. After this migration, app sections such as Dating Likes, Dating Matches, Dating Profile, Chat, User Profile, Group Detail, Meetup Detail, Notifications, and Create flows will be real navigation screens with consistent native-style transitions and predictable back behavior.

The user-visible outcome is that pressing between app pages feels smooth and stable. The current screen remains coherent while the next screen transitions in, list and image content no longer appears to "render into place" during the transition, and the app has a navigation structure that can support deep links, analytics, notification routing, and future subscription-critical Dating workflows.

## Progress

- [x] (2026-05-29 Europe/Dublin) Investigated the current app shell and confirmed that `AppNavigator` keeps top-level tabs mounted but uses hand-managed conditional overlays for detail screens.
- [x] (2026-05-29 Europe/Dublin) Investigated Dating flicker and confirmed that Dating sub-surfaces are currently state-swapped inside `src/screens/main/DiscoverScreen.tsx`.
- [x] (2026-05-29 Europe/Dublin) Authored this ExecPlan for a production-grade React Navigation migration.
- [x] (2026-05-29 Europe/Dublin) Started implementation from a clean `feature/real-screen-navigation` branch based on `main`; the superseded `feature/smooth-screen-overlays` experiment was stashed and not used as a base.
- [x] (2026-05-29 Europe/Dublin) Installed React Navigation dependencies and added `NavigationContainer` through `src/navigation/RootNavigation.tsx`.
- [x] (2026-05-29 Europe/Dublin) Added an initial native root stack while preserving the existing custom app shell and visual tab bar.
- [x] (2026-05-29 Europe/Dublin) Migrated Chat to a root native stack route for callers that pass a loaded `Chat`.
- [x] (2026-05-29 Europe/Dublin) Migrated Dating Likes, Dating Matches, and Dating Profile Editor entry points to root native stack routes.
- [x] (2026-05-30 Europe/Dublin) Migrated Chat-by-id loading, User Profile, Notifications, Group Detail, Group Comments, Meetup Detail, Recovery Meeting Detail, and Create flows to root native stack route wrappers.
- [x] (2026-05-30 Europe/Dublin) Added a root Feed Comments route so comments opened from pushed User Profile screens still work.
- [x] (2026-05-30 Europe/Dublin) Added a typed `MainTabs` focus handoff so notification mentions return to Feed and focus the referenced post/comment.
- [x] (2026-05-30 Europe/Dublin) Removed obsolete manual full-screen overlay state from `AppNavigator` for chat, user profile, notifications, group/meetup details, compose, and create flows.
- [x] (2026-05-30 Europe/Dublin) Removed the old Dating Likes, Matches, and Profile Editor full-screen replacement branches from `DiscoverScreen`; these now open through root stack routes only.
- [x] (2026-05-30 Europe/Dublin) Preserved the Dating Likes Plus gate in the route screen and restored silent local-to-remote image handoff for Dating profile photo uploads.
- [x] (2026-05-30 Europe/Dublin) Ran `npm run typecheck`; TypeScript completed with exit code 0.
- [x] (2026-05-30 Europe/Dublin) Ran `git diff --check`; no whitespace errors were reported.
- [x] (2026-05-30 Europe/Dublin) Migrated Dating profile option editors from the internal `editingSection` swap to a nested native stack with `DatingProfileMain` and `DatingProfileSection` screens.
- [x] (2026-05-30 Europe/Dublin) Replaced the remaining custom app shell with React Navigation bottom tabs and per-tab native stacks while preserving the existing visual bottom tab bar, center create button, top header, notifications entry point, and own-profile entry point.
- [x] (2026-05-30 Europe/Dublin) Migrated Dating profile detail opening from the Discover deck to the root `DatingProfileDetail` route and removed the old inline Dating profile detail modal path from `DiscoverScreen`.
- [x] (2026-05-30 Europe/Dublin) Ran `npm run typecheck`; TypeScript completed with exit code 0 after the nested-tab migration.
- [x] Migrate Dating profile section editors to real stack screens with shared unsaved draft state.
- [x] Migrate high-impact shared detail screens such as Chat, User Profile, Group Detail, Meetup Detail, Recovery Meeting Detail, Notifications, and Create flows.
- [x] Remove obsolete manual overlay state from `AppNavigator` and `DiscoverScreen`.
- [ ] Perform manual smoothness checks on device.

## Surprises & Discoveries

- Observation: The main Feed, Discover, Community, Chats, and Profile tabs originally stayed mounted using `tabVisible` and `tabHidden` wrappers in `src/navigation/AppNavigator.tsx`; that compatibility shell has now been replaced by React Navigation bottom tabs with `detachInactiveScreens={false}` and `lazy={false}`.
    Evidence: `AppNavigator` now creates `MainTabs`, `FeedStack`, `DiscoverStack`, `CommunityStack`, `ChatsStack`, and `ProfileStack` navigators, and renders the existing visual tab bar through a custom `tabBar`.

- Observation: The flicker reported in Dating is not isolated to a single component. It is caused by a broader pattern of local boolean state controlling full-screen pages and overlays.
    Evidence: `DiscoverScreen` has state such as `datingLikesOpen`, `datingMatchesOpen`, and `datingProfileEditorOpen`; before this plan, these values drove early `return` blocks or overlay-style rendering rather than route transitions.

- Observation: The app currently does not use React Navigation. `AuthNavigator` and `AppNavigator` are local React components that switch screens with `useState`.
    Evidence: `package.json` does not list `@react-navigation/native`, `@react-navigation/native-stack`, or `@react-navigation/bottom-tabs`; `App.tsx` imports custom `AuthNavigator`, `OnboardingNavigator`, and `AppNavigator`.

- Observation: The first implementation pass can safely introduce React Navigation without replacing the entire custom app shell in one step.
    Evidence: `src/navigation/RootNavigation.tsx` now wraps the authenticated app in `NavigationContainer` and registers root native stack routes while `AppNavigator` continues to preserve the existing visual app shell during migration.

- Observation: The largest app-wide flicker source was the old full-screen overlay state in `AppNavigator`, not the mounted tab panes themselves.
    Evidence: After the migration, `AppNavigator` no longer stores `openChat`, `openUserProfile`, `pendingDM`, `createPostOpen`, `createGroupOpen`, `createSupportRequestOpen`, `createMeetupOpen`, `openMeetup`, `openRecoveryMeeting`, `openGroupId`, or `notificationsOpen`.

- Observation: Dating profile option editors no longer use the internal `editingSection` swap.
    Evidence: `DatingProfileEditorScreen` now renders `DatingProfileEditorStack` with `DatingProfileMain` and `DatingProfileSection`, and no longer contains `editingSection`, `shouldRestoreEditScroll`, or the scroll-restore `requestAnimationFrame` path.

- Observation: The Discover dating deck no longer owns a local Dating profile detail modal.
    Evidence: `DiscoverScreen` accepts `onOpenDatingProfile`, and `DiscoverHomeScreen` routes selected dating profiles to `DatingProfileDetail` with `profileId` and `initialProfile`.

## Decision Log

- Decision: Use React Navigation as the production navigation system rather than continuing to build custom overlay transitions.
    Rationale: React Navigation provides mature native-style stack transitions, back gestures, screen lifecycle controls, route params, deep-link support, and a standard model understood by React Native developers. This reduces long-term fragility compared with more manual overlay state.
    Date/Author: 2026-05-29 / Codex

- Decision: Use a root native stack with nested bottom tabs and nested native stacks per tab.
    Rationale: The app needs persistent bottom tabs for primary sections, but drill-down pages should be real stack screens. A nested structure allows Feed, Discover, Community, Chats, and Profile to retain independent navigation histories while still supporting global screens such as Chat, User Profile, and Notifications.
    Date/Author: 2026-05-29 / Codex

- Decision: Migrate Dating first.
    Rationale: Dating is subscription-critical and is where the flicker is most visible. Migrating this area first proves the architecture against the highest-value flow while keeping the initial migration scope manageable.
    Date/Author: 2026-05-29 / Codex

- Decision: Preserve the existing visual bottom tab design by implementing a custom React Navigation tab bar.
    Rationale: The current app has a branded custom bottom tab layout with a center create button. React Navigation can drive navigation state while a custom `tabBar` component preserves the existing look.
    Date/Author: 2026-05-29 / Codex

- Decision: Introduce React Navigation as a root stack around the existing app shell before replacing the shell itself.
    Rationale: This reduces migration risk by allowing high-value routes such as Chat and Dating screens to move to native stack transitions while the existing tab bar and top-level screen composition remain stable. The full nested-tab conversion remains a later milestone.
    Date/Author: 2026-05-29 / Codex

- Decision: Temporarily allow root Dating route wrappers to own their own query/action hooks.
    Rationale: Extracting all Dating state from `DiscoverScreen` into shared route-aware state is a larger follow-up. Route wrappers let the app start using real stack screens immediately, then the duplicate remaining `DiscoverScreen` local state can be removed once all Dating flows have moved.
    Date/Author: 2026-05-29 / Codex

- Decision: Keep global shared detail screens on the root stack while using per-tab stacks for each primary tab.
    Rationale: Chat, user profiles, notifications, comments, Dating detail, group detail, meetup detail, and create flows can be opened from multiple tabs. Keeping them in the root stack avoids duplicating route registrations while the primary tabs still get real tab navigation and independent stack roots.
    Date/Author: 2026-05-30 / Codex

## Outcomes & Retrospective

The high-impact shared detail flows and Dating top-level surfaces now use React Navigation native stack routes instead of local full-screen replacement state. The primary app shell now uses React Navigation bottom tabs with per-tab native stack roots, while preserving the existing visual tab bar, top header, notification badge, center create action, and own-profile shortcut.

Static validation passed. The remaining unchecked item is manual smoothness validation on a simulator or physical device, because transition quality cannot be honestly verified from TypeScript or shell output alone.

## Context and Orientation

This is an Expo React Native app in `/home/michaelroddy/repos/project_radeon_app`. The entry point is `App.tsx`. It mounts global providers for gesture handling, safe areas, keyboard behavior, React Query persistence, authentication, popups, chat realtime, and notifications. Inside those providers, `RootNavigator` chooses between the unauthenticated auth flow, onboarding, or the authenticated app shell.

The authenticated app shell is currently `src/navigation/AppNavigator.tsx`. Despite the name, it is not a React Navigation navigator. It is a custom component that stores local state such as `activeTab`, `openChat`, `openUserProfile`, `openMeetup`, `openGroupId`, `notificationsOpen`, and many create-flow booleans. It renders main tabs and full-screen overlays manually.

The auth flow is currently `src/navigation/AuthNavigator.tsx`, which toggles between `LoginScreen` and `RegisterScreen` using `useState`. Onboarding is `src/navigation/OnboardingNavigator.tsx`, which should be inspected before implementation because it may also be a custom local flow.

The most problematic flow for smoothness is Dating inside `src/screens/main/DiscoverScreen.tsx`. That file currently owns internal Dating state for Likes, Matches, Profile editor, filters, selected profile modals, match modals, photo upload state, and discover/deck data. Dating sub-surfaces are currently not separate screens. They are conditional render branches inside the Discover screen.

React Query is already used for data fetching. API types and network calls live in `src/api/client.ts`. Query hooks live in `src/hooks/queries/`. A production navigation migration should continue to use React Query for data and should avoid passing large mutable API objects through navigation params when an id is enough.

For this plan, "real screen navigation" means screens are registered with React Navigation as `Stack.Screen` or `Tab.Screen` entries. A "stack" is an ordered set of screens where navigating pushes a new screen on top and the back action pops it off. A "tab navigator" is a set of top-level sections controlled by the bottom tab bar. A "route param" is a small serializable value passed to a screen when navigating, such as `{ profileId: "abc" }`.

## Plan of Work

Start by installing React Navigation and its required native dependencies. This app already has `react-native-gesture-handler` and `react-native-safe-area-context`, but it does not currently have React Navigation packages or `react-native-screens`. Use React Navigation's native stack for smooth platform transitions and bottom tabs for persistent app sections.

Create a new navigation type file at `src/navigation/types.ts`. Define route param lists for the root stack, each tab stack, and the bottom tabs. Use explicit TypeScript route names and params. For example, Dating profile detail routes should take a `profileId` when possible, while transition-only screens can temporarily accept a minimal snapshot such as username/avatar if the existing screen requires it during migration.

Wrap the authenticated app in `NavigationContainer` in `App.tsx` or inside a new `src/navigation/RootNavigation.tsx`. The cleanest structure is to create `RootNavigation.tsx` and keep `App.tsx` focused on providers. `RootNavigation` should still choose between auth, onboarding, and authenticated app based on `useAuth()`, but the authenticated app should become a real navigator.

Build `MainTabsNavigator` in `src/navigation/MainTabsNavigator.tsx`. It should use `createBottomTabNavigator` and a custom tab bar component that preserves the existing visual design from `AppNavigator`: Feed, Discover, center Create button, Community, and Chats. If the current own-profile shortcut in the top bar remains important, keep it in a shared header component or expose it as a Profile route reachable from the top bar. Do not lose notification badges, the center create button, or the bottom-tab hiding behavior for full-screen detail pages.

Build one stack per tab. Create files such as `src/navigation/stacks/FeedStackNavigator.tsx`, `src/navigation/stacks/DiscoverStackNavigator.tsx`, `src/navigation/stacks/CommunityStackNavigator.tsx`, `src/navigation/stacks/ChatsStackNavigator.tsx`, and `src/navigation/stacks/ProfileStackNavigator.tsx`. Each stack should use `createNativeStackNavigator` with `headerShown: false` at first because most existing screens already render `ScreenHeader` or are controlled by the existing top bar. Later, headers can be standardized using native stack headers if desired.

Migrate Dating inside `DiscoverStackNavigator` first. The initial Discover stack should have screens for `DiscoverHome`, `DatingLikes`, `DatingMatches`, `DatingProfileEditor`, `DatingProfileSection`, `DatingProfileDetail`, and possibly `DatingFilters`. `DiscoverHome` should render the existing `DiscoverScreen` but with props that call `navigation.navigate(...)` instead of toggling local open state. Then extract Dating Likes, Matches, and Profile editor surfaces from `DiscoverScreen` into route screens or wrapper screens that use the existing components `DatingLikesScreen`, `DatingMatchesScreen`, and `DatingProfileEditorScreen`.

For Dating Profile option editors, replace the internal `editingSection` overlay/swap pattern with a route. `DatingProfileEditorScreen` should open a `DatingProfileSection` route with a section key such as `{ section: "bio" }`. The section screen should read and update shared draft state. Because React Navigation route screens are separate components, the draft state must move out of the single editor component. Use a local context provider for the Dating profile edit session, for example `src/components/discover/DatingProfileEditSession.tsx`, or keep the editor and section screens under a parent route that provides context. This prevents losing unsaved edits while moving between main edit and section screens.

After Dating works smoothly, migrate high-impact app-wide detail screens out of `AppNavigator` state. Chat should be a real screen in `ChatsStackNavigator` or a root stack screen if it can be opened from multiple tabs. User Profile should be a shared root stack screen because it opens from Feed, Discover, Community, Comments, and Profile. Group Detail belongs to `CommunityStackNavigator`, Meetup Detail belongs to Community or Discover depending on source, Recovery Meeting Detail belongs to Discover/Meetings, Notifications can be a root stack screen, and Create flows can be root stack modal-style screens or tab-stack screens depending on final UX.

Finally, delete obsolete manual overlay state from `AppNavigator`. The old component can be reduced to either a thin compatibility wrapper around the new navigators or removed entirely. Do not leave two competing navigation systems for the same route once a screen has migrated.

## Concrete Steps

Begin from a clean repository state. If currently on an experimental branch such as `feature/smooth-screen-overlays`, either finish and merge only deliberately accepted work or discard it before starting this migration. This plan supersedes the custom overlay experiment.

From `/home/michaelroddy/repos/project_radeon_app`, create a branch:

    git checkout main
    git pull --ff-only
    git checkout -b feature/real-screen-navigation

Install dependencies. Exact package versions should be resolved by the project package manager, but the dependencies required are React Navigation native, native stack, bottom tabs, and native screens support:

    npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens

Run the static check immediately after installation:

    npm run typecheck

If TypeScript fails because navigation types are not yet imported correctly, continue to the setup milestone and run typecheck again after adding the navigator files. If installation changes native dependencies, restart Expo completely before manual testing.

Create `src/navigation/types.ts` with route param lists. Keep names explicit and stable. The initial shape should include at least:

    export type RootStackParamList = {
        MainTabs: undefined;
        UserProfile: { userId: string; username?: string; avatarUrl?: string };
        Notifications: undefined;
        Chat: { chatId: string } | { chat: import('../api/client').Chat };
        ComposeDM: { recipientId: string; username: string; avatarUrl?: string };
        CreatePost: undefined;
        CreateGroup: undefined;
        CreateSupportRequest: undefined;
        CreateMeetup: { meetupId?: string };
    };

    export type MainTabParamList = {
        FeedTab: undefined;
        DiscoverTab: undefined;
        CommunityTab: undefined;
        ChatsTab: undefined;
        ProfileTab: undefined;
    };

    export type DiscoverStackParamList = {
        DiscoverHome: undefined;
        DatingLikes: undefined;
        DatingMatches: undefined;
        DatingProfileEditor: undefined;
        DatingProfileSection: { section: string };
        DatingProfileDetail: { profileId: string };
        RecoveryMeetingDetail: { meetingId: string };
    };

The exact route list can grow during implementation. Update this ExecPlan when the list changes.

Create `src/navigation/RootNavigation.tsx`, `src/navigation/MainTabsNavigator.tsx`, and stack navigator files. Move the header and bottom tab visual logic out of `AppNavigator.tsx` carefully. The first milestone should only prove that the app boots and tabs switch using React Navigation with existing screens.

Update `App.tsx` to mount the new root navigation inside existing providers. Keep `GestureHandlerRootView`, `SafeAreaProvider`, `KeyboardProvider`, `PersistQueryClientProvider`, `AuthProvider`, `AppPopupProvider`, `ChatRealtimeProvider`, and `NotificationProvider` in the same relative order unless a dependency explicitly requires otherwise.

For Dating, update `DiscoverScreen` so the "Liked you", "Matches", "Profile", and "Filters" actions do not set local full-screen booleans. Instead, accept callbacks or use the navigation prop to navigate to stack screens. The preferred intermediate approach is props, because it keeps `DiscoverScreen` testable and avoids importing navigation hooks deep into large screens:

    <DiscoverScreen
        isActive={isFocused}
        onOpenDatingLikes={() => navigation.navigate('DatingLikes')}
        onOpenDatingMatches={() => navigation.navigate('DatingMatches')}
        onOpenDatingProfile={() => navigation.navigate('DatingProfileEditor')}
    />

If prop drilling becomes too wide, use `useNavigation` only at screen boundary components rather than inside small reusable components.

Create wrapper screens for `DatingLikesScreen`, `DatingMatchesScreen`, and `DatingProfileEditorScreen` under `src/screens/main/dating/` or `src/screens/main/` following existing project organization. These wrappers should own query hooks or receive data from a shared Dating hook. They should render existing components and use `navigation.goBack()` for back behavior.

Move Dating profile section editing to a route only after the main Dating profile editor works as a screen. Introduce a shared edit-session context if unsaved draft state would otherwise be lost. The acceptance requirement is that a user can edit Bio, go back to the main profile editor, open Interests, and still see the Bio draft unchanged before saving.

Migrate app-wide detail screens in later milestones. For each screen, replace one `AppNavigator` local state value with a route, update all open callbacks to call `navigation.navigate`, and remove the old state after all callers are migrated. Do not migrate all detail screens in one commit; commit after each coherent group.

## Milestones

Milestone 1 proves React Navigation can own the app shell without changing feature behavior. At the end of this milestone, the app boots, the auth/onboarding/authenticated selection still works, and the bottom tabs switch through React Navigation while preserving the current visual style. Run `npm run typecheck` and manually start Expo with `npx expo start`. Navigate between Feed, Discover, Community, Chats, and Profile. There should be no obvious visual regression in the tab bar or top header.

Milestone 2 migrates Dating surface navigation. At the end of this milestone, pressing Dating `Liked you`, `Matches`, and `Profile` pushes real stack screens. The Dating deck remains the Discover stack's base screen. Back gestures and header back buttons return to the Dating deck. There should be no local `datingLikesOpen`, `datingMatchesOpen`, or `datingProfileEditorOpen` screen replacement logic left in `DiscoverScreen`.

Milestone 3 migrates Dating profile section editing. At the end of this milestone, tapping Bio, Interests, Relationship goal, Gender, Prompts, and similar profile rows navigates to real `DatingProfileSection` screens. The user can go back without a flicker or scroll jump because React Navigation owns the transition. Unsaved draft state must persist across these routes until the user saves or leaves the profile editor.

Milestone 4 migrates shared detail screens. At the end of this milestone, Chat, User Profile, Notifications, Group Detail, Meetup Detail, Recovery Meeting Detail, and Create flows are real routes instead of manual overlays in `AppNavigator`. This milestone can be split into multiple commits. Each commit should remove one group of obsolete local state and verify its open/back behavior.

Milestone 5 removes obsolete custom navigation code. At the end of this milestone, `src/navigation/AppNavigator.tsx` is either deleted or reduced to a temporary compatibility export that renders the new navigator. Any old screen overlay primitive added during earlier experimentation should be deleted if it is no longer used. Run `rg "Open|Visible|Overlay|ScreenOverlay|datingLikesOpen|openChat|openMeetup"` to look for stale manual routing state and remove it where route navigation now owns the flow.

## Validation and Acceptance

Always run static validation from `/home/michaelroddy/repos/project_radeon_app`:

    npm run typecheck

The expected result is TypeScript exiting with code 0 and no diagnostic output after the command banner.

Manual validation must be done on a real device or simulator because the main success criterion is transition quality. Start the app:

    npx expo start

Then verify these behaviors:

Open Discover, switch to Dating, press `Liked you`, then back. The Dating deck should remain stable behind the route transition. There should be no blank frame, no flicker of the app header, and no full-screen loader flash if cached likes exist.

Press `Matches`, open a matched user's profile, then back twice. The route stack should behave predictably and the Matches list should not remount from empty unless there is genuinely no cached data.

Press `Profile`, open Bio, type text, go back, open Interests, go back, and confirm the Bio draft is still present. Save the profile and confirm success feedback still works.

Open Chat from Chats, User Profile from Feed or Discover, Group Detail from Community, Meetup Detail from Community, Notifications from the top bar, and Create Post from the center create button. Each should open as a real screen with native back behavior, and returning should reveal the previous tab in the same scroll/data state.

The migration is accepted only when the app no longer depends on local boolean flags in `AppNavigator` or `DiscoverScreen` to represent full-screen pages that should be routes.

## Idempotence and Recovery

The dependency installation step is safe to rerun; `npm install` will update `package-lock.json` consistently. If navigation package installation causes a broken state, restore the last committed `package.json` and `package-lock.json`, remove `node_modules`, run `npm install`, and repeat the dependency step.

The migration should be done in small commits. If a migrated screen misbehaves, revert that screen's commit rather than reverting the whole branch. Keep old callback props in place temporarily while migrating callers; remove them only after all call sites have moved to route navigation.

Do not delete `AppNavigator.tsx` until all routes it currently owns have been migrated and validated. Keeping a compatibility wrapper during the migration is safer than removing the old shell early.

If React Navigation route types become difficult to satisfy, do not use `any`. Add explicit route param types in `src/navigation/types.ts` and use the correct `NativeStackScreenProps` or `CompositeScreenProps` type aliases near each screen wrapper.

## Artifacts and Notes

Current evidence from the pre-migration inspection:

    App.tsx imports custom AuthNavigator, OnboardingNavigator, and AppNavigator.
    package.json currently does not list @react-navigation/native.
    src/navigation/AppNavigator.tsx stores local screen state such as openChat, openMeetup, openGroupId, notificationsOpen, and datingSurfaceOpen.
    src/screens/main/DiscoverScreen.tsx stores datingLikesOpen, datingMatchesOpen, and datingProfileEditorOpen.

Expected typecheck transcript after successful implementation:

    > project-radeon@1.0.0 typecheck
    > tsc --noEmit

No further output should appear and the command should exit with code 0.

## Interfaces and Dependencies

Use these dependencies:

`@react-navigation/native` provides the core `NavigationContainer` and navigation state.

`@react-navigation/native-stack` provides stack screens with platform-native transitions. This should be preferred for full-screen pages because it is smoother and less JS-heavy than hand-built animations.

`@react-navigation/bottom-tabs` provides tab navigation. Use a custom `tabBar` render function to preserve the current tab bar design and center create button.

`react-native-screens` improves native screen performance and is required for native stack behavior. Enable it if needed according to the library's setup, but do not add extra global side effects unless the current version requires it.

Keep these existing libraries and patterns:

React Query remains the data layer. Route screens should fetch by id using existing query hooks or new query hooks in `src/hooks/queries/`.

`src/api/client.ts` remains the only API client. Do not fetch directly in navigation code.

`ScreenHeader` can remain the visible header component initially. Native stack headers should be disabled with `headerShown: false` until the app is ready for a separate header standardization pass.

Use route params for ids and small display snapshots only. Do not pass large mutable objects through route params as the final design because stale object params are a source of bugs when cached data updates.

## Revision Notes

2026-05-29 / Codex: Initial ExecPlan authored after investigating visible Dating transition flicker and app-wide custom overlay navigation. The plan intentionally supersedes the experimental custom overlay approach because the user requested a production-grade real screen navigation architecture.
