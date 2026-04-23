# Unify Styling With A Small Internal UI System

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document must be maintained in accordance with [PLANS.md](/home/michaelroddy/repos/project_radeon_app/PLANS.md).

## Purpose / Big Picture

The app already has useful design tokens, but repeated styling patterns are scattered across the main screens. After this change, the frontend should use a small shared UI layer for the repeated pieces that already exist everywhere: cards, search fields, empty states, segmented controls, buttons, and shared input styling. A user should not see a visual redesign when this work is complete. The visible improvement is consistency: screens should look the same as they do now, but future UI work should require fewer copy-pasted styles and fewer one-off edits across multiple screens.

The goal is not to introduce Tailwind, Bootstrap, Material, or any third-party design system. The goal is to standardize the current React Native styling approach around `StyleSheet.create`, the existing token system, and a handful of internal reusable components.

## Progress

- [x] (2026-04-23 14:25Z) Audited the current styling direction and repeated patterns across `FeedScreen`, `DiscoverScreen`, `ChatsScreen`, `MeetupsScreen`, `SupportScreen`, `UserProfileScreen`, and `MeetupDetailScreen`.
- [x] (2026-04-23 14:25Z) Confirmed the current token entry point is `src/utils/theme.ts`, which is acting as a compatibility shim over `src/theme`.
- [x] (2026-04-23 14:25Z) Identified the first centralization targets: segmented tab controls, hero cards, search bars, empty states, form inputs, and primary action buttons.
- [ ] Create a stable shared styling layer under `src/components/ui/` and `src/styles/` without changing screen behavior.
- [ ] Migrate the main screens to the shared primitives in small batches and verify there is no visual regression.
- [ ] Remove obsolete per-screen duplicated style blocks once each screen is fully migrated.

## Surprises & Discoveries

- Observation: the app already has two theme entry points: `src/theme` and the compatibility wrapper in `src/utils/theme.ts`.
    Evidence: `src/utils/theme.ts` re-exports typography and spacing from `../theme` and also remaps `Colors.light.*` to the newer token structure.

- Observation: duplication is concentrated in a small set of patterns rather than the whole style surface.
    Evidence: repeated style names and structures appear in `src/screens/main/MeetupsScreen.tsx`, `src/screens/main/SupportScreen.tsx`, `src/screens/main/ChatsScreen.tsx`, `src/screens/main/DiscoverScreen.tsx`, `src/screens/main/FeedScreen.tsx`, and `src/screens/main/MeetupDetailScreen.tsx`, especially `segmentRow`, `heroCard`, `searchBar`, `empty`, `input`, and `primaryButton`.

- Observation: the repo standard of keeping `StyleSheet.create` blocks at the bottom of each file is still workable if shared primitives own the repeated styles.
    Evidence: screen files already centralize styles locally; the maintainability issue is repetition, not an inability to express styles with `StyleSheet.create`.

## Decision Log

- Decision: keep the React Native `StyleSheet.create` approach and do not adopt Tailwind-style utilities or third-party UI kits.
    Rationale: the current codebase is already structured around tokens plus `StyleSheet.create`, and a migration to another styling paradigm would be larger, riskier, and less consistent with the repository conventions than building a small internal UI system.
    Date/Author: 2026-04-23 / Codex

- Decision: centralize only repeated patterns, not every single style.
    Rationale: over-abstracting one-off layout details would make screens harder to read. The right unit of reuse here is the repeated JSX plus its semantic styling, not every margin and flex rule.
    Date/Author: 2026-04-23 / Codex

- Decision: treat `src/utils/theme.ts` as the compatibility boundary during the refactor.
    Rationale: many existing screens already depend on `Colors.light.*`, `Spacing`, `Typography`, and `Radii` from `src/utils/theme.ts`. Replacing that contract first would create unnecessary churn before the shared primitives exist.
    Date/Author: 2026-04-23 / Codex

## Outcomes & Retrospective

This plan has not been implemented yet. The outcome of this planning pass is a phased refactor path that preserves the current visual design while reducing styling duplication. The main lesson from the audit is that the app does not need a large design-system rewrite; it needs a restrained internal UI layer that codifies the patterns already present.

## Context and Orientation

This repository is an Expo / React Native frontend. Styling is currently split across two layers.

The first layer is token definition. The current token entry point used by most screens is `src/utils/theme.ts`. That file is a compatibility shim that forwards typography and spacing from `src/theme`, remaps radii, and exposes an older `Colors.light.*` shape on top of the newer token model. Any refactor must preserve this import surface until the screens have been migrated gradually.

The second layer is per-screen `StyleSheet.create` blocks. The app’s major screens each define a large local style object. This is acceptable for screen-specific layout, but it becomes hard to maintain when identical patterns are repeated with slightly different names or small variations. The repeated patterns are most visible in these files:

- `src/screens/main/FeedScreen.tsx`
- `src/screens/main/DiscoverScreen.tsx`
- `src/screens/main/ChatsScreen.tsx`
- `src/screens/main/MeetupsScreen.tsx`
- `src/screens/main/MeetupDetailScreen.tsx`
- `src/screens/main/SupportScreen.tsx`
- `src/screens/main/UserProfileScreen.tsx`

The duplicated UI patterns already present in those screens are:

- A segmented top control used to switch between browse, my items, create, and similar subviews.
- A “hero card” near the top of the screen with an eyebrow label, title, and supporting text.
- Search rows with one or two `TextInput` fields and an action trigger.
- Empty states with a primary sentence and muted secondary text.
- Shared form inputs, including multiline text areas.
- Primary buttons and their disabled states.

The target architecture should add two new layers without changing the navigation or query model:

- `src/styles/` for reusable style objects and semantic style factories that stay close to token usage.
- `src/components/ui/` for reusable building-block components that own the repeated JSX and styling together.

The words “primitive” and “shared component” in this plan mean a reusable internal React Native component such as a button, input field, card container, or segmented control. They do not mean a third-party component library.

## Plan of Work

The first milestone is token stabilization. Review `src/theme` and `src/utils/theme.ts`, and make `src/utils/theme.ts` the explicit compatibility layer for the migration. Add any missing semantic aliases there instead of forcing screens to invent local color or spacing decisions. Examples include a consistent input border color, muted surface background, hero-card surface, and standard focus text colors if needed. Do not change screen imports yet beyond what the shared components need.

The second milestone is shared style infrastructure. Create `src/styles/commonStyles.ts` and keep it intentionally small. This file should export a `StyleSheet` with only the layout patterns that are truly repeated without much behavior: centered loading containers, empty-state containers, common card padding, and common row spacing. If a pattern needs props or variants, do not force it into `commonStyles`; move it into a shared component instead.

The third milestone is reusable UI components. Create `src/components/ui/` and add the first five shared building blocks:

- `PrimaryButton.tsx`
- `TextField.tsx`
- `EmptyState.tsx`
- `SegmentedControl.tsx`
- `SurfaceCard.tsx`

`PrimaryButton` should cover the existing filled accent button pattern and disabled state. `TextField` should standardize input styling and multiline behavior while still allowing screen-specific props. `EmptyState` should render the common title-plus-description pattern seen in multiple screens. `SegmentedControl` should replace the repeated segmented toggle rows in meetups and support. `SurfaceCard` should own the repeated rounded card container and let screens place their own content inside.

The fourth milestone is search and hero patterns. Add `SearchBar.tsx` and `HeroCard.tsx` under `src/components/ui/`. `HeroCard` should render the eyebrow, title, and supporting text layout that currently appears in discover, support, meetups, and meetup detail. `SearchBar` should support the two existing shapes in the app: a single-input search row and a split search row with a second location field plus action trigger.

The fifth milestone is incremental screen migration. Do not refactor all screens at once. Start with the screens where duplication is heaviest and structure is already close to shared patterns:

1. `src/screens/main/SupportScreen.tsx`
2. `src/screens/main/MeetupsScreen.tsx`
3. `src/screens/main/ChatsScreen.tsx`
4. `src/screens/main/DiscoverScreen.tsx`
5. `src/screens/main/MeetupDetailScreen.tsx`
6. `src/screens/main/FeedScreen.tsx`

For each screen, replace the repeated JSX and local styles with the shared primitives, then delete only the now-unused local style entries. Keep screen-specific layout local. If a pattern cannot be migrated cleanly without adding too much conditional behavior to a shared component, stop and keep that piece local. The purpose of the refactor is simplification, not maximal abstraction.

The sixth milestone is cleanup and documentation. Once the first migration batch is complete, review the shared components for overlap and rename props to make them semantic rather than screen-specific. Update this ExecPlan with what was actually shared, what remained local, and why.

## Concrete Steps

All commands below should be run from the frontend repository root:

    cd /home/michaelroddy/repos/project_radeon_app

Start by reading the current token shim and the high-duplication screens:

    sed -n '1,240p' src/utils/theme.ts
    sed -n '1,240p' src/screens/main/DiscoverScreen.tsx
    sed -n '220,760p' src/screens/main/MeetupsScreen.tsx
    sed -n '360,1160p' src/screens/main/SupportScreen.tsx

Create the shared styles and UI component directories:

    mkdir -p src/styles src/components/ui

Implement the first batch of shared files, then run:

    npx tsc --noEmit

Expected result:

    TypeScript exits with code 0 and no new errors.

After each migrated screen, run the app:

    npx expo start

Open the major screens in the simulator or device and verify that segmented controls, hero cards, search bars, empty states, and primary buttons still match the current appearance and interaction behavior.

## Validation and Acceptance

This work is accepted only if it is observable that styling has become more centralized without changing the app’s user-visible behavior unexpectedly.

Validation must include all of the following:

Run `npx tsc --noEmit` from `/home/michaelroddy/repos/project_radeon_app` after every milestone and expect it to pass.

Start the app with `npx expo start` and manually verify these flows:

- Feed still renders its empty state and action styling correctly.
- Discover still renders its hero card, search row, and empty state correctly.
- Chats still renders its search row and empty state correctly.
- Meetups still renders its segmented control, hero card, search row, create form inputs, and empty states correctly.
- Support still renders its segmented control, hero card, form inputs, and empty states correctly.
- Meetup detail still renders its hero card and primary action button correctly.

Acceptance is behavioral:

- No screen loses layout structure or interaction behavior because a shared component became too generic.
- Repeated visual patterns are visibly consistent across the screens that already shared the same design language.
- At least the first migration batch removes duplicated local styles for segmented controls, hero cards, empty states, inputs, and primary buttons from the migrated screens.
- New screens can reasonably reuse the new UI primitives without copy-pasting style blocks from existing screens.

## Idempotence and Recovery

This refactor should be performed incrementally and safely. Each shared component should be added before any screen is forced to consume it. That makes the work retryable: if one screen migration becomes messy, revert only that screen and keep the shared primitive if it is still useful.

Do not remove `src/utils/theme.ts` during this refactor. That file is the compatibility layer that lets the migration proceed in phases. Do not rename token exports mid-migration unless every current consumer has been updated in the same commit.

If a shared component starts accumulating too many screen-specific boolean props, stop and split it. That is a sign the abstraction is too broad and should be narrowed before proceeding.

## Artifacts and Notes

Examples of duplication that justify this plan:

    src/screens/main/MeetupsScreen.tsx
        segmentRow
        heroCard
        input
        primaryButton
        empty

    src/screens/main/SupportScreen.tsx
        segmentRow
        heroCard
        input
        empty

    src/screens/main/ChatsScreen.tsx
        searchBar
        empty

    src/screens/main/DiscoverScreen.tsx
        heroCard
        empty

This plan intentionally starts from the patterns that are already repeated instead of inventing a larger component system up front.

## Interfaces and Dependencies

Use only the existing React Native / Expo stack already present in this repository. Do not add NativeWind, Bootstrap wrappers, Material component libraries, Ionic packages, or another third-party design system.

At the end of the first implementation milestone, these files should exist:

    src/styles/commonStyles.ts
    src/components/ui/PrimaryButton.tsx
    src/components/ui/TextField.tsx
    src/components/ui/EmptyState.tsx
    src/components/ui/SegmentedControl.tsx
    src/components/ui/SurfaceCard.tsx

At the end of the second implementation milestone, these files should also exist:

    src/components/ui/SearchBar.tsx
    src/components/ui/HeroCard.tsx

Each shared component must accept typed props with explicit interfaces. Keep them narrow. For example, `PrimaryButton` should expose a clear interface for label, press handler, disabled state, loading state, and optional variant, rather than becoming a generic catch-all wrapper over every possible button style in the app.

Revision note: created on 2026-04-23 to give the styling refactor a phased, repo-specific path after auditing repeated patterns in the current frontend.
