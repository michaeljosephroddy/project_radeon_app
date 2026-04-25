# Standardize App Screen Chrome and UI Structure

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document must be maintained in accordance with [PLANS.md](../PLANS.md).

This plan builds on `exec_plans/STYLING_UNIFICATION_EXECPLAN.md` and `exec_plans/STYLING_REFINEMENT_EXECPLAN.md`. Those earlier plans introduced the first shared UI primitives and identified some remaining drift, but they do not fully cover the cross-screen standardization work requested here. This file is the primary plan for the remaining UI unification effort. All context needed to execute the work is repeated here so the plan stands on its own.

## Purpose / Big Picture

The app already feels like one product, but it does not yet behave like one visual system. A user can move from Feed to Comments to direct messages to Profile and see different header sizing, different composer heights, different section labels, different content gutters, and different card rhythms even when those surfaces are serving the same job. After this change, the app will still look like the same product, but it will feel deliberate: comparable screens will share the same spacing rules, the same header treatment, the same composer sizing, the same form controls, and the same informational card structure.

The user-visible result is straightforward to verify. After implementation, open the app and move through these routes: Login and Register, Feed and Comments, Chats and an open thread, Compose DM, Meetups browse and meetup detail, Support browse and create, Profile and Settings, and another user’s profile. The header height, title sizing, body gutters, composer size, and section-label rhythm should feel stable instead of changing from screen to screen.

## Progress

- [x] (2026-04-25 21:53Z) Audited the current codebase across auth, onboarding, tab screens, detail screens, and overlay screens to identify UI inconsistencies in headers, layout, spacing, sizing, positioning, and screen structure.
- [x] (2026-04-25 21:53Z) Reviewed `exec_plans/STYLING_UNIFICATION_EXECPLAN.md` and `exec_plans/STYLING_REFINEMENT_EXECPLAN.md` and decided to create a broader follow-on ExecPlan instead of forcing those narrower plans to absorb the full app-wide standardization scope.
- [x] (2026-04-25 22:15Z) Milestone 1 complete. Added semantic `Header`, `ContentInsets`, and `Composer` theme tokens, semantic typography roles, `screenStandards`, `composerStandards`, and the shared `ScreenHeader`, `SectionLabel`, and `InfoNoticeCard` primitives.
- [x] (2026-04-25 22:15Z) Milestone 2 complete. Migrated Settings, Compose DM, chat, user profile, meetup detail, profile subviews, support preview, and meetup preview headers onto shared chrome, and replaced the profile request tabs with `SegmentedControl`.
- [x] (2026-04-25 22:15Z) Milestone 3 complete. Standardized the DM, chat, comments, and feed composers around shared composer metrics and migrated auth, onboarding, and profile edit forms onto `TextField` and `PrimaryButton`.
- [x] (2026-04-25 22:15Z) Milestone 4 complete. Replaced duplicated `feedNotice` and `screenNote` cards with `InfoNoticeCard`, routed repeated list/detail paddings through `screenStandards`, and deleted the unused `src/components/Card.tsx` primitive.
- [x] (2026-04-25 22:15Z) Milestone 5 complete. Aligned the remaining high-drift screens, replaced the last hardcoded Discover accent tint with a tokenized value, and updated `AGENTS.md` so the documented accent direction matches the active theme.
- [~] (2026-04-25 22:15Z) Milestone 6 partially complete. `npx tsc --noEmit` passes after the migration. Manual `npx expo start` route-by-route visual verification has not been performed from this CLI session.

## Surprises & Discoveries

- Observation: the repository already has a partial shared UI layer, so the remaining problem is not “create a design system from scratch”; it is “finish migrating the rest of the app onto the shared system.”
    Evidence: `src/components/ui/PrimaryButton.tsx`, `src/components/ui/TextField.tsx`, `src/components/ui/SearchBar.tsx`, `src/components/ui/SegmentedControl.tsx`, `src/components/ui/SurfaceCard.tsx`, `src/components/ui/HeroCard.tsx`, and `src/components/ui/EmptyState.tsx` already exist and are already used by several main screens.

- Observation: the app currently has two styling entry points and two card systems, which makes it easy for screens to drift even when engineers think they are “using the theme.”
    Evidence: `src/theme/*` defines the real tokens, `src/utils/theme.ts` is a compatibility wrapper exposing `Colors.light.*`, `src/components/Card.tsx` defines one unused card primitive, and `src/components/ui/SurfaceCard.tsx` plus `src/styles/commonStyles.ts` define another surface path.

- Observation: header drift is no longer about spacing alone; most header containers already use the same padding, but title sizing and structure still vary between comparable screens.
    Evidence: `src/navigation/AppNavigator.tsx` uses a 15-point page title, `src/screens/main/SettingsScreen.tsx`, `src/screens/main/ComposeDMScreen.tsx`, `src/screens/main/chat/ChatHeader.tsx`, and `src/screens/main/MeetupDetailScreen.tsx` also use 15-point titles, `src/components/CommentsModal.tsx` uses 13-point title text, and `src/screens/main/UserProfileScreen.tsx` uses a 12-point title.

- Observation: composer drift is the most visible inconsistency because the app presents three different text-entry systems for nearly the same user action.
    Evidence: `src/screens/main/ComposeDMScreen.tsx` uses a 44-point pill input with a 42 by 42 send button and 15-point text, `src/screens/main/ChatScreen.tsx` renders a similar pattern through GiftedChat, `src/components/CommentsModal.tsx` uses a 40-point input and 38 by 38 send button with 11-point text, and `src/screens/main/FeedScreen.tsx` uses a custom smaller post composer with a separate attach button and smaller type.

- Observation: the repo documentation and the actual theme disagree on the product accent direction, so “standardization” will remain unstable unless the code and instructions are aligned.
    Evidence: `AGENTS.md` describes `#7F77DD` as the primary purple, `src/theme/colors.ts` sets `Colors.primary` to `#0d6efd`, and `src/screens/main/DiscoverScreen.tsx` still hardcodes `rgba(127,119,221,0.12)` for the active filter state.

- Observation: the shared header abstraction covered more screens than the original audit list once preview flows were included.
    Evidence: `ScreenHeader` ended up replacing not only Settings, chat, DM, user profile, meetup detail, and profile subviews, but also the review headers in `src/screens/main/SupportScreen.tsx` and `src/screens/main/MeetupsScreen.tsx`.

- Observation: the feed composer could not be made identical to chat and comment composers without losing the image-preview affordance and lightweight post framing, but it could still be normalized around the same metrics.
    Evidence: `src/screens/main/FeedScreen.tsx` now keeps its card-based structure while using the shared composer height, input padding, attach-button size, and action-button sizing from the shared theme and composer standards.

- Observation: `CommentsModal` can share header and composer chrome without sharing the full container implementation.
    Evidence: the modal now uses `ScreenHeader` and `composerStandards`, but it keeps its keyboard-controller-specific wrapper and animated bottom padding logic in `ComposerPadding`.

## Decision Log

- Decision: create a new ExecPlan instead of stretching `exec_plans/STYLING_REFINEMENT_EXECPLAN.md`.
    Rationale: the earlier refinement plan is useful but narrower than the current request. The user asked for a thorough app-wide audit and a full standardization path across layout, spacing, sizing, positioning, and screen structure, including screens that the earlier plan did not fully cover.
    Date/Author: 2026-04-25 / Codex

- Decision: preserve the existing visual language and standardize structure before considering any broader visual redesign.
    Rationale: the request is about consistency, not a rebrand. The app already has a recognizable dark theme and shared component base. The safest path is to unify repeated patterns without introducing a fresh aesthetic direction mid-refactor.
    Date/Author: 2026-04-25 / Codex

- Decision: treat `src/theme/*` as the authoritative token source and treat `src/utils/theme.ts` as the compatibility boundary during the migration.
    Rationale: many screens still import `Colors.light.*`, `Spacing`, `Typography`, and `Radii` from `src/utils/theme.ts`. Replacing that import surface in one pass would add avoidable churn. The code should centralize truth in `src/theme/*` while keeping `src/utils/theme.ts` stable until the migration is done.
    Date/Author: 2026-04-25 / Codex

- Decision: standardize headers through a shared `ScreenHeader` component, but keep the root tab header in `src/navigation/AppNavigator.tsx` as its own primary-navigation header.
    Rationale: the tab header serves a different job than overlay and detail headers because it includes the SoberSpace wordmark and the current user avatar. The overlay and detail headers are structurally identical and should share one component. The tab header should share the same tokens, but not necessarily the same JSX.
    Date/Author: 2026-04-25 / Codex

- Decision: standardize composers through shared tokens and shared style modules rather than one single wrapper component.
    Rationale: `ChatScreen` is constrained by GiftedChat, `CommentsModal` is constrained by the keyboard-controller layout, `ComposeDMScreen` is a plain screen, and `FeedScreen` includes attachment preview behavior. A shared component would accumulate too many specialized props. Shared composer metrics and style recipes are the lower-risk abstraction.
    Date/Author: 2026-04-25 / Codex

- Decision: general form controls should default to `TextField` and `PrimaryButton`, while message and comment composers should remain a separate UI family.
    Rationale: auth and create forms need standard input and CTA treatment, but a composer is a conversational control with different height, radius, and accessory behavior. Treating both as one control would either make forms too chat-like or composers too small.
    Date/Author: 2026-04-25 / Codex

- Decision: remove duplicated note-card and surface patterns only after the shared replacements exist and are in active use.
    Rationale: the app already has multiple repeated structures such as `screenNote`, `feedNotice`, and local secondary surfaces. The migration should be additive first and subtractive second so each stage stays reversible.
    Date/Author: 2026-04-25 / Codex

- Decision: keep the feed composer as a variant surface instead of forcing it into the exact same shell as chat and comments.
    Rationale: the feed needs inline image preview and a text `Post` action rather than an icon-only send button. Standardizing the measurements and action sizing captured the consistency win without breaking the feed-specific interaction model.
    Date/Author: 2026-04-25 / Codex

- Decision: use `ScreenHeader` for preview and review flows even when the previous implementation used a bespoke back-chevron row.
    Rationale: those screens are still full-screen overlays solving the same structural problem. Reusing the same header chrome reduces drift and keeps preview flows from becoming another parallel header family.
    Date/Author: 2026-04-25 / Codex

## Outcomes & Retrospective

Implementation is now in place across the highest-drift screen families. The theme exposes semantic header, composer, typography, and content-inset tokens; the shared layer now includes `ScreenHeader`, `SectionLabel`, and `InfoNoticeCard`; and the main drift surfaces were migrated onto those primitives instead of keeping coordinated copies. The migration also removed the unused `src/components/Card.tsx` path and aligned `AGENTS.md` with the active theme tokens.

The biggest user-visible consistency wins landed in three areas. Overlay and detail screens now share one header system. Conversational composers now share one size and type rhythm across DM, chat, and comments, with the feed composer normalized as a deliberate variant instead of an undersized outlier. Auth, onboarding, and profile editing now default to the same `TextField` and `PrimaryButton` primitives rather than bespoke input and CTA chrome.

Static validation is complete: `npx tsc --noEmit` passes. Manual visual validation is still outstanding. The remaining local differences are intentional rather than accidental: the root tab header remains its own primary-navigation shell, and the feed composer remains a card-based variant so it can keep image preview and post-specific actions while still using the shared metrics.

## Context and Orientation

This repository is an Expo and React Native frontend. The app’s navigation shell lives in `src/navigation/AppNavigator.tsx`, which renders the five main tabs and overlays full-screen replacements such as chat threads, a DM compose screen, user profiles, meetup detail, and profile/settings subviews. In this plan, a “primary tab screen” means a screen rendered directly inside the main tab content area, such as Feed, Discover, Support, Meetups, or Chats. An “overlay or detail screen” means a full-screen replacement that sits on top of the tab content, such as `ComposeDMScreen`, `ChatScreen`, `UserProfileScreen`, `MeetupDetailScreen`, `ProfileTabScreen`, or `SettingsScreen`.

The theme is split across two layers. `src/theme/colors.ts`, `src/theme/layout.ts`, and `src/theme/typography.ts` define the real tokens. `src/utils/theme.ts` is the compatibility shim that most screens import. It re-exports the newer token set while also exposing the legacy `Colors.light.*` shape. The migration in this plan must continue to use `src/utils/theme.ts` as the screen-facing import surface until the codebase no longer depends on the compatibility shape.

The repository already has a first generation of shared UI primitives under `src/components/ui/`. `PrimaryButton`, `TextField`, `SearchBar`, `SegmentedControl`, `SurfaceCard`, `HeroCard`, and `EmptyState` are real, working components and should be reused rather than replaced. This plan is not permission to invent a parallel component family. It is permission to finish the job and route the remaining screens through the components and shared styles the app already has.

The screens with the highest remaining drift are `src/components/CommentsModal.tsx`, `src/screens/main/ComposeDMScreen.tsx`, `src/screens/main/ChatScreen.tsx`, `src/screens/main/UserProfileScreen.tsx`, `src/screens/main/ProfileTabScreen.tsx`, `src/screens/main/SettingsScreen.tsx`, `src/screens/main/FeedScreen.tsx`, and the remaining local surface patterns in `src/screens/main/SupportScreen.tsx` and `src/screens/main/MeetupsScreen.tsx`. The auth screens in `src/screens/auth/LoginScreen.tsx` and `src/screens/auth/RegisterScreen.tsx` also still hand-roll inputs and buttons instead of using the shared form controls.

In this plan, “screen chrome” means the persistent interface elements that define the structure of a screen before any content loads: headers, safe-area padding, standard content gutters, list bottom padding, section labels, note cards, and bottom composers. “Composer” means the text-entry row used to post a comment, send a message, or write a feed post. “Informational note card” means the muted rounded surface used for non-interactive explanatory text such as `feedNotice` and `screenNote`.

There is no repository-defined test or lint command. The safe validation commands are `npx tsc --noEmit` for static type checking and `npx expo start` for manual verification in the simulator or on a device. Manual route-by-route verification is mandatory for this plan because the user’s requirement is visual and structural, not just type-level.

The implementation should standardize around four screen families. Primary tab screens should keep their tab-shell behavior but share the same content gutter rules, note-card structure, list bottom padding, and section-label rhythm. Overlay and detail screens should share one header structure and one content-body rhythm. Composers should share one text-entry standard for conversational surfaces. Forms should default to the shared input and button primitives unless there is a demonstrated reason to diverge.

## Plan of Work

### Milestone 1: Freeze the UI standards in the theme and shared style layer

Start by codifying the standards that the rest of the migration will follow. Edit `src/theme/layout.ts` to add three small semantic exports: `Header`, `ContentInsets`, and `Composer`. `Header` should hold the shared vertical padding, back-button icon size, and side-slot width used by overlay and detail headers. `ContentInsets` should hold the standard horizontal gutter for main screens, the wider auth and onboarding gutter, the standard list bottom padding value currently repeated as `32`, and the standard form and detail bottom padding value currently repeated as `40`. `Composer` should hold the minimum input height, the maximum input height, the send-button size, and the standard input paddings used for message and comment surfaces. Re-export these additions from `src/theme/index.ts` and from `src/utils/theme.ts`.

In the same milestone, extend `src/theme/typography.ts` with a few missing semantic text roles. Do not enlarge the raw `sizes` map or create a new arbitrary scale. Add named roles for the patterns that are repeatedly drifting: a screen-title style for overlay and detail headers, a section-label style for the small tracked labels above grouped sections, a form-label style, and a meta-text style. These roles must be exported through `src/theme/index.ts` and then through `src/utils/theme.ts` so screens can stop reaching for `Typography.sizes.*` when a semantic role already exists.

Then create two small shared style modules. Add `src/styles/screenStandards.ts` for shared screen-level scaffolding such as standard list content padding, standard form content padding, and the shared section-label text style. Add `src/styles/composerStandards.ts` for the bottom-composer row, the pill text input, the circular send button, the smaller attach button used by the feed, and the disabled states. These files should export explicit names, not anonymous style bags. The goal is that any screen implementing a header, section label, or composer can pull its metrics and base styles from one place without importing another screen’s stylesheet.

This milestone is complete when the project still type-checks, no screens have changed behavior yet, and the new theme and style exports are available for the migration work that follows.

### Milestone 2: Standardize overlay and detail headers and the top-of-screen structure

Create `src/components/ui/ScreenHeader.tsx`. This component should own the repeated overlay and detail header structure: optional back button on the left, centered title or custom center content, optional trailing slot on the right, standard horizontal and vertical padding, and a bottom border. The prop surface should remain narrow. It needs an `onBack` callback, a plain `title` string for the common case, an optional `centerContent` node for cases like chat headers that include an avatar and name, and an optional `trailing` slot when a screen needs a right-side control. The component should use the new `Header` metrics and the semantic title typography added in Milestone 1.

Migrate the screens that are currently solving the same header problem in parallel. Replace the local header containers in `src/screens/main/SettingsScreen.tsx`, `src/screens/main/ComposeDMScreen.tsx`, `src/screens/main/chat/ChatHeader.tsx`, `src/screens/main/UserProfileScreen.tsx`, `src/screens/main/MeetupDetailScreen.tsx`, and the top and sub headers in `src/screens/main/ProfileTabScreen.tsx`. The goal is not to make every header visually identical in content; it is to make their chrome identical in structure and metrics. `ChatHeader` and `ComposeDMScreen` can still render avatar-plus-name center content, but the spacing and title treatment must come from the same shared component instead of local copy-pasted styles.

At the same time, create `src/components/ui/SectionLabel.tsx` and use it anywhere the app is rendering the small tracked section heading that names a grouped block of content. Likely targets include `SettingsScreen`, `ProfileTabScreen`, `UserProfileScreen`, `MeetupDetailScreen`, `ChatsScreen`, and any uppercase support or meetup labels that are semantically the same pattern. Do not use `SectionLabel` for larger inline headings like “Attendees”; it is only for the small repeated label treatment.

`ProfileTabScreen` currently uses a custom incoming and outgoing request tab control even though `SegmentedControl` already exists. Replace that bespoke tab row with `SegmentedControl` in this milestone so the profile request view stops carrying its own sub-navigation chrome.

This milestone is complete when all overlay and detail screens share the same header height, border, icon sizing, and title rhythm, and when the profile request tabs use the same segmented-control system already used elsewhere in the app.

### Milestone 3: Standardize composers and general form controls

Apply `src/styles/composerStandards.ts` to the conversational input surfaces first. Update `src/screens/main/ComposeDMScreen.tsx` to use the shared composer row, pill input, and send button styles. Update the GiftedChat render hooks inside `src/screens/main/ChatScreen.tsx` to use the same shared composer input and send-button treatment through `renderComposer` and `renderSend`. Update `src/components/CommentsModal.tsx` so its bottom composer matches the same minimum input height, font size, horizontal padding, radius, and send-button size. The container behavior in `CommentsModal` should remain local because it is tied to the keyboard-controller animation, but the visible chrome must come from the shared composer standards.

`src/screens/main/FeedScreen.tsx` needs special handling because it is the only composer that supports an image preview and a text “Post” action instead of a circular send icon. Keep the feed’s local behavior and preview handling, but route its input size, attach-button size, text size, border treatment, and action control height through the same composer metrics defined in Milestone 1. The post composer does not need to become visually identical to a message composer, but it must stop feeling like a smaller unrelated control.

Once conversational composers are aligned, standardize the general form controls. Make `TextField` and `PrimaryButton` the default for non-conversational forms. Migrate the handcrafted auth controls in `src/screens/auth/LoginScreen.tsx` and `src/screens/auth/RegisterScreen.tsx`. Migrate the create and edit forms that still hand-roll their control chrome when the existing shared primitives would be a better fit, including `src/screens/onboarding/LocationStep.tsx`, the editable sections in `src/screens/main/ProfileTabScreen.tsx`, the create flow in `src/screens/main/MeetupsScreen.tsx`, and the create and check-in-later flows in `src/screens/main/SupportScreen.tsx`. If `TextField` needs one or two small extensions to support these flows cleanly, make those extensions inside `TextField` instead of reverting to new custom `TextInput` chrome in each screen.

This milestone is complete when message, comment, and DM composers share the same core size and type scale, and when auth and create forms are consistently using the app’s shared input and button primitives instead of local reimplementations.

### Milestone 4: Standardize informational cards, shared surfaces, and screen scaffolding

Create `src/components/ui/InfoNoticeCard.tsx` for the muted explanatory card pattern currently duplicated as `feedNotice` in `src/screens/main/FeedScreen.tsx` and `screenNote` in both `src/screens/main/SupportScreen.tsx` and `src/screens/main/MeetupsScreen.tsx`. The component should accept a title, a description, and an optional style override. Its surface treatment should come from `SurfaceCard` or the same surface recipe `SurfaceCard` uses, not from another new card implementation. Once the component exists, replace those local note-card definitions.

Use `src/styles/screenStandards.ts` to normalize the repeated content padding patterns that currently appear as ad hoc `padding: Spacing.md`, `paddingBottom: 32`, and `paddingBottom: 40` across many screens. The main targets are `src/screens/main/FeedScreen.tsx`, `src/screens/main/ChatsScreen.tsx`, `src/screens/main/SupportScreen.tsx`, `src/screens/main/MeetupsScreen.tsx`, `src/screens/main/MeetupDetailScreen.tsx`, `src/screens/main/SettingsScreen.tsx`, and any full-screen forms or previews that are using the same padding recipe under different local style names. Do not force every screen into one giant shared layout object; use the standards module for the repeated, clearly identical padding contracts.

Consolidate on `SurfaceCard` for neutral rounded surfaces. Review `src/components/Card.tsx` and the use of `commonStyles.card`. If `Card.tsx` is truly unused, delete it in this milestone. Keep `commonStyles` only for patterns that are genuinely style-only and still reused, such as centered loading or empty states. The goal is that a future contributor has one obvious surface primitive to reach for instead of guessing between `Card`, `SurfaceCard`, or a local rounded `View`.

This milestone is complete when note cards and generic surfaces no longer exist as three or four local variants of the same shape, and when the repeated bottom paddings and body gutters are expressed through shared names instead of copied measurements.

### Milestone 5: Migrate the remaining high-drift screens and remove redundant local styling systems

With the foundations in place, do a focused cleanup pass through the highest-drift screens. In `src/screens/main/UserProfileScreen.tsx`, align the header title treatment, section labels, action buttons, and post-card spacing with the new standards without rewriting the profile content model. In `src/screens/main/ProfileTabScreen.tsx`, align the top bar, subheaders, row action buttons, and grouped editable sections so they feel like the same app family as Settings and UserProfile rather than a separate sub-application. In `src/screens/main/DiscoverScreen.tsx`, replace the hardcoded purple active-chip background with a token-based value, and use the same section-label and note-card system as the rest of the app where the semantics match. In `src/screens/main/ChatsScreen.tsx`, `src/screens/main/SupportScreen.tsx`, and `src/screens/main/MeetupsScreen.tsx`, remove stale local style definitions that duplicate the newly shared header, notice, segmented-control, input, or section-label patterns.

Align the auth wordmarks and any obviously equivalent onboarding title treatments where they should match. `LoginScreen` and `RegisterScreen` should not disagree about the app wordmark size. Onboarding can remain its own family because it has different goals and a wider gutter, but it should still use the same CTA, input, and text-role logic where a screen is solving the same problem as auth or create forms.

Use this milestone to remove leftover hardcoded colors and unexplained measurements that were called out in the audit. The aim is not to eliminate every numeric literal in the repo, because some values truly are one-off. The aim is to remove literals from repeated interface elements that now have a shared home. If a value still exists in more than one screen after this pass and describes the same thing, move it into the theme or shared style layer instead of leaving it duplicated.

This milestone is complete when the codebase no longer has parallel local implementations of headers, section labels, composers, and informational note cards in the migrated screens, and when the remaining local styles are clearly screen-specific rather than accidental clones.

### Milestone 6: Validate the entire app and update the living sections

Run a full type-check with `npx tsc --noEmit`, then run the app with `npx expo start` and perform a manual route-by-route verification pass. The point of this milestone is not simply to ensure that the app compiles. The point is to confirm that the user-visible result matches the request: screens that should feel equivalent now share the same rhythm, control sizing, and structure.

Update `Progress` as each screen family lands. Record any unexpected layout constraints, keyboard edge cases, or places where a shared abstraction had to be narrowed in `Surprises & Discoveries`. Record any intentional deviation from the standards in `Decision Log`. Once the migration is complete, add a real `Outcomes & Retrospective` entry describing what changed, what remained local, and why.

## Concrete Steps

Run all commands from the repository root:

    cd /home/michaelroddy/repos/project_radeon_app

Before editing, re-read the current token layer and the high-drift screens:

    sed -n '1,200p' src/theme/layout.ts
    sed -n '1,200p' src/theme/typography.ts
    sed -n '1,120p' src/utils/theme.ts
    sed -n '1,220p' src/components/ui/TextField.tsx
    sed -n '1,220p' src/components/ui/PrimaryButton.tsx
    sed -n '1,220p' src/screens/main/ComposeDMScreen.tsx
    sed -n '520,640p' src/components/CommentsModal.tsx
    sed -n '548,590p' src/screens/main/ChatScreen.tsx
    sed -n '560,670p' src/screens/main/FeedScreen.tsx
    sed -n '280,320p' src/screens/main/UserProfileScreen.tsx
    sed -n '820,920p' src/screens/main/ProfileTabScreen.tsx

After Milestone 1 and after every later milestone, run:

    npx tsc --noEmit

Expected result:

    The command exits with code 0 and prints no new TypeScript errors.

During the migration, use ripgrep to prove whether an older local pattern is still in use before deleting it. For example:

    rg -n "screenNote|feedNotice|headerTitle|composerInput|sendButton|components/Card" src

After Milestone 2, start the app:

    npx expo start

Verify the overlay and detail headers by opening Settings, Compose DM, a chat thread, a meetup detail screen, the profile subviews, and another user’s profile. The headers should share the same height, padding, border, back icon size, and title rhythm.

After Milestone 3, verify conversational and form controls by moving through Feed, Comments, Compose DM, an open chat thread, Login, Register, Support create, Meetups create, and Profile editing. The inputs should feel like members of the same control family instead of isolated one-off controls.

After Milestone 4 and Milestone 5, verify the note-card and screen-scaffolding consistency by comparing Feed, Support, Meetups, Settings, and detail screens side-by-side.

## Validation and Acceptance

Acceptance is behavioral and visual.

Run `npx tsc --noEmit` from `/home/michaelroddy/repos/project_radeon_app` and expect it to pass with no new errors.

Run `npx expo start` and manually verify the following route matrix.

Start with auth. Open Login, then Register. The wordmark, content gutter, input treatment, and CTA sizing should feel like the same auth family. The screens can differ in copy, but not in arbitrary form structure or control sizing.

Move to the social composer surfaces. Open Feed, expand the post composer, then open a post’s Comments modal, then open a DM compose screen, then open an existing chat thread. The bottom input surfaces should share the same input height, the same text scale, the same radius logic, and the same send-action size. Feed may still show an attachment affordance and text Post button, but it must no longer feel smaller or denser than comments and chat for no reason.

Move to overlay and detail screens. Open Settings, Meetup Detail, your own Profile subviews, and another user’s profile. Headers should share one visual system. The user should not feel a title-size drop or padding shift just because they moved between comparable full-screen surfaces.

Move to the explanatory and grouped-content surfaces. Compare Feed’s note card, Meetups’ note card, Support’s note card, and any grouped section labels in Settings or Profile. The surfaces should now share the same card rhythm and the same label logic.

Move across tab screens. Feed, Chats, Support, Meetups, and Discover should share the same overall body gutter logic and list-bottom rhythm except where the tab bar or an overlay legitimately changes the available space.

The work is accepted only if comparable screen families look and behave consistent with one another and if the code expresses that consistency through shared tokens, shared styles, and shared primitives rather than through a new round of coordinated copy-paste.

## Idempotence and Recovery

This plan is safe to execute incrementally because it contains no schema changes, no data migrations, and no network contract changes. The migration should stay additive until the shared replacements are in use. Create the tokens, shared styles, and shared components first. Switch one screen family at a time. Delete old local patterns only after ripgrep confirms that the shared replacement is the one in use.

Do not remove `src/utils/theme.ts` during this work. It is the compatibility boundary that keeps the migration manageable. Do not delete `src/components/Card.tsx` until `rg -n "components/Card" src` returns no results. Do not widen `PrimaryButton`, `TextField`, or `SearchBar` with screen-specific boolean props if a narrower helper or style module would solve the problem more cleanly. If an abstraction starts growing screen-specific conditionals, split it rather than carrying the complexity forward.

If a migrated screen looks wrong, revert that screen first and keep the foundation work if it is still sound. The purpose of this plan is to reduce drift, not to force all screens through one helper before the helper has proven itself.

## Artifacts and Notes

The audit that produced this plan found three concrete drift examples that should continue to guide implementation.

Header drift today:

    src/navigation/AppNavigator.tsx      pageTitle: Typography.sizes.lg
    src/screens/main/SettingsScreen.tsx  headerTitle: Typography.sizes.lg
    src/screens/main/ComposeDMScreen.tsx headerName: Typography.sizes.lg
    src/screens/main/chat/ChatHeader.tsx headerName: Typography.sizes.lg
    src/components/CommentsModal.tsx     headerTitle: Typography.sizes.md
    src/screens/main/UserProfileScreen.tsx headerTitle: Typography.sizes.base

Composer drift today:

    src/screens/main/ComposeDMScreen.tsx
        input minHeight 44, send button 42 x 42, text size lg

    src/components/CommentsModal.tsx
        input minHeight 40, send button 38 x 38, text size sm

    src/screens/main/FeedScreen.tsx
        compose input text size base, attach button 34 x 34, custom post pill

Theme drift today:

    AGENTS.md says the primary color is #7F77DD.
    src/theme/colors.ts sets Colors.primary to #0d6efd.
    src/screens/main/DiscoverScreen.tsx hardcodes rgba(127,119,221,0.12) for active chips.

Surface duplication today:

    src/components/Card.tsx
    src/styles/commonStyles.ts -> commonStyles.card
    src/components/ui/SurfaceCard.tsx
    src/screens/main/FeedScreen.tsx -> feedNotice
    src/screens/main/SupportScreen.tsx -> screenNote
    src/screens/main/MeetupsScreen.tsx -> screenNote

These examples are not exhaustive, but they are the clearest proof that the remaining work is systemic rather than isolated.

## Interfaces and Dependencies

Do not add a third-party UI kit, styling library, or design-token package. This work must stay inside the existing React Native and Expo stack and must reuse the current `src/theme`, `src/utils/theme.ts`, and `src/components/ui` structure.

At the end of Milestone 1, the following theme exports must exist and be reachable through `src/utils/theme.ts`:

    Header
    ContentInsets
    Composer

At the end of Milestone 1, the following style modules must exist:

    src/styles/screenStandards.ts
    src/styles/composerStandards.ts

At the end of Milestone 2, the following shared components must exist:

    src/components/ui/ScreenHeader.tsx
    src/components/ui/SectionLabel.tsx

At the end of Milestone 4, the following shared component must exist:

    src/components/ui/InfoNoticeCard.tsx

`ScreenHeader` should expose a narrow, explicit prop interface:

    interface ScreenHeaderProps {
      onBack?: () => void;
      title?: string;
      centerContent?: React.ReactNode;
      trailing?: React.ReactNode;
    }

`SectionLabel` should expose a narrow text-oriented prop interface:

    interface SectionLabelProps {
      children: React.ReactNode;
      style?: StyleProp<TextStyle>;
    }

`InfoNoticeCard` should expose a semantic card interface:

    interface InfoNoticeCardProps {
      title: string;
      description: string;
      style?: StyleProp<ViewStyle>;
    }

`composerStandards.ts` should export named styles or style groups for the shared conversational input family, including the row chrome, the pill input, the circular send button, and the smaller secondary icon button used by feed attachments. Those names must be stable and descriptive enough that a future contributor can recognize them without opening another screen to compare styles.

Revision note: created on 2026-04-25 after a full app-wide UI audit to give the remaining standardization work a single implementation plan that is broader than the earlier styling plans and explicit about the remaining cross-screen drift.
