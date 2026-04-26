# Rebalance App-Wide Color Usage Around Semantic Bootstrap Roles

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

`PLANS.md` lives at `/home/michaelroddy/repos/project_radeon_app/PLANS.md` and this document must be maintained in accordance with it.

## Purpose / Big Picture

After this change, the app should feel more intentional and easier to read because each Bootstrap-derived color has a stable meaning instead of `primary` doing almost everything. The brand blue `#0d6efd` will remain the signature accent, but it will no longer dominate every screen surface, badge, chip, and state. A user should be able to infer meaning from color across the whole product: primary for the main action, success for confirmed positive state, warning for caution or pending state, info for discovery and context, secondary for neutral structure, and danger for destructive actions.

The visible proof is that the app becomes calmer and more legible without losing its identity. On the Meetups, Discover, Support, Feed, and Chats tabs, blue should highlight the most important action or active navigation state rather than flooding the screen. Waitlist states should read as warning, confirmed participation as success, discovery and context metadata as info or neutral, and destructive actions as danger. The product should still feel like one coherent app, but with clearer hierarchy and less repetition of the same accent.

## Progress

- [x] (2026-04-26 22:10Z) Create this ExecPlan with the semantic color model, rollout scope, and validation criteria.
- [x] (2026-04-26 22:19Z) Audit current app-wide usage of `primary`, `success`, `warning`, `info`, `secondary`, and `danger` across shared components and major screens.
- [x] (2026-04-26 22:25Z) Define a semantic color contract in the theme layer and document which UI meanings map to which tokens.
- [x] (2026-04-26 22:28Z) Add shared semantic variants for common reusable UI primitives such as segmented controls, buttons, and contextual hero accents.
- [x] (2026-04-26 22:32Z) Rebalance high-frequency shared components so `primary` is reserved more often for active/highest-priority emphasis. Implemented: `SegmentedControl`, `PrimaryButton`, `HeroCard`, shared discover filter chips. Remaining: audit more shared primitives if future screens still feel overly blue.
- [x] (2026-04-26 22:38Z) Rebalance Meetups to use `primary`, `success`, `warning`, `info`, `secondary`, and `danger` according to the semantic contract.
- [x] (2026-04-26 22:39Z) Rebalance Discover to reduce primary overuse and shift contextual discovery cues toward `info` or neutral treatments.
- [x] (2026-04-26 22:40Z) Rebalance Support so top-level navigation and contextual accents lean on semantic tones instead of default primary-heavy treatments.
- [ ] (2026-04-26 22:41Z) Rebalance Feed, Chats, Profile, onboarding, and auth surfaces so the same semantic rules apply app-wide. Completed: Profile request tabs and onboarding identity segmented control. Remaining: Feed, Chats, auth, and any residual high-primary surfaces.
- [ ] (2026-04-26 22:42Z) Run a manual multi-screen design pass on device or simulator to verify that contrast, hierarchy, and meaning improved instead of regressing. Completed: `npx tsc --noEmit`. Remaining: visual verification on device/simulator.

## Surprises & Discoveries

- Observation: The app already has a full Bootstrap-style token family, including `primary`, `success`, `warning`, `danger`, `info`, `secondary`, and `textOn.*`.
    Evidence: `src/theme/colors.ts` defines all of these tokens, including subtle variants such as `primarySubtle`, `successSubtle`, and `dangerSubtle`.

- Observation: The current issue is not a missing palette. It is uncontrolled assignment of palette roles.
    Evidence: `src/screens`, `src/components`, and feature-specific files repeatedly use `Colors.primary` for cards, chips, badges, icons, summary sections, active state, and action buttons, especially in Meetups and Discover.

- Observation: Some shared components already have partial semantic support, but the system is incomplete.
    Evidence: `src/components/ui/PrimaryButton.tsx` already supports multiple variants, while other shared components such as segmented controls and feature chips still hard-code primary-heavy treatments.

- Observation: `SegmentedControl` was one of the biggest drivers of app-wide blue saturation because it used a solid primary fill for every active state regardless of context.
    Evidence: The component was used across Meetups, Support, Profile, and onboarding, and its original `buttonActive` style always set `backgroundColor: Colors.primary` and `borderColor: Colors.primary`.

- Observation: A first-wave rollout can deliver a meaningful improvement without touching every single screen if the shared primitives and the most primary-heavy features are handled first.
    Evidence: The semantic rebalance touched shared controls plus Meetups, Discover, Support, Profile, and onboarding, which collectively account for much of the over-accenting identified in the audit.

## Decision Log

- Decision: Keep Bootstrap blue `#0d6efd` as the brand anchor.
    Rationale: The user explicitly wants to preserve Bootstrap primary as the main color. The goal is not rebranding; it is semantic rebalance and hierarchy.
    Date/Author: 2026-04-26 / Codex

- Decision: Solve this at the semantic-design-system level, not screen by screen only.
    Rationale: The same overuse pattern appears across Meetups, Discover, Support, Feed, Chats, onboarding, and auth. Fixing only one screen would reintroduce inconsistency later.
    Date/Author: 2026-04-26 / Codex

- Decision: Use semantic color roles with strict meaning.
    Rationale: This keeps the palette scalable and predictable. Users learn the app faster when color signals intent rather than acting as decoration.
    Date/Author: 2026-04-26 / Codex

- Decision: Make segmented controls mostly subtle by default instead of solid-filled.
    Rationale: Segmented controls indicate local selection state, not usually the app’s single highest-priority CTA. Using subtle active fills reduces saturation while keeping state legible.
    Date/Author: 2026-04-26 / Codex

- Decision: Treat Meetups and Discover as the first mandatory rollout targets, with Support, Profile, and onboarding as the same-pass secondary targets.
    Rationale: Those surfaces were the clearest examples of primary overuse and provided the largest visible improvement for the smallest amount of code churn.
    Date/Author: 2026-04-26 / Codex

## Outcomes & Retrospective

The first semantic rebalance wave is implemented. The raw Bootstrap palette was preserved, but the app now uses it more intentionally in shared controls and in the most primary-heavy feature surfaces. `SegmentedControl` now supports semantic tones with subtle active fills rather than forcing solid primary for every active state. `PrimaryButton` gained broader semantic variants, `HeroCard` now supports contextual eyebrow tones, and discover filter chips now use `info` semantics instead of default primary.

Meetups received the largest rebalancing pass: top controls now use info or secondary tones, discovery chips and summary surfaces moved away from solid blue, meetup cards now use info-toned date and category accents instead of default primary, meetup detail metadata uses info, and meetup form structure and auxiliary controls are no longer built around large primary blocks. Discover also reduced primary overuse in contextual recovery-milestone cues, while Support, Profile, and onboarding picked up semantic segmented-control tones so they no longer inherit the same default blue emphasis everywhere.

This was intentionally a first wave, not the entire app. Feed, Chats, auth, and any remaining legacy high-primary surfaces still need a follow-up pass if the goal is complete semantic consistency. The code is type-safe after the changes, but the remaining acceptance work is a manual design review on device or simulator.

## Context and Orientation

The frontend app lives in `/home/michaelroddy/repos/project_radeon_app`. It already has a centralized theme token layer in `src/theme/` and a compatibility layer in `src/utils/theme.ts`. The theme defines the raw palette, while screens and components import `Colors` from `src/utils/theme.ts`.

The current palette is in `src/theme/colors.ts`. It already defines:

- `primary` as Bootstrap blue `#0d6efd`
- `success` as Bootstrap green `#198754`
- `danger` as Bootstrap red `#dc3545`
- `warning` as Bootstrap amber `#ffc107`
- `info` as Bootstrap cyan `#0dcaf0`
- `secondary` as Bootstrap gray `#6c757d`

It also defines `primarySubtle`, `successSubtle`, and `dangerSubtle`, plus text-on-color variants in `textOn`. The palette itself is not the problem. The problem is how screens assign those colors. Many screens use `Colors.primary` for actions, active state, section accents, chips, badges, summary cards, and iconography all at once.

In this plan, a "semantic color role" means a stable mapping between a user-facing meaning and a color token. For example, "destructive action" should consistently mean `danger`, while "confirmed positive state" should consistently mean `success`. A "structural surface" means a neutral container such as a card, chip shell, or section background whose main purpose is layout rather than emphasis. A "context accent" means a non-destructive, non-primary highlight used to convey metadata like distance, event type, or discovery context.

The most relevant files are:

- `src/theme/colors.ts`, which defines the actual palette.
- `src/utils/theme.ts`, which exposes the compatibility `Colors` object used by screens.
- `src/components/ui/PrimaryButton.tsx`, which already supports semantic button variants and can act as a reference.
- `src/components/ui/SegmentedControl.tsx`, `src/components/ui/SearchBar.tsx`, `src/components/ui/HeroCard.tsx`, and other reusable components that strongly affect app-wide perception.
- Screen-level files in `src/screens/main/` such as `DiscoverScreen.tsx`, `MeetupsScreen.tsx`, `SupportScreen.tsx`, `FeedScreen.tsx`, `ChatsScreen.tsx`, and profile screens.
- Feature components such as `src/components/events/*` and `src/components/discover/*`, where much of the current primary overuse is concentrated.

## Plan of Work

Start with an audit instead of editing colors ad hoc. Read through `src/theme/colors.ts`, `src/utils/theme.ts`, and the shared UI components that appear most frequently across the app. Then search for direct `Colors.primary`, `Colors.success`, `Colors.warning`, `Colors.danger`, `Colors.info`, and `Colors.secondary` usage across `src/screens/` and `src/components/`. Classify each use into one of these meanings: primary action, active selection, confirmed state, warning state, destructive state, context/discovery accent, neutral structure, or decorative accent. The audit output does not need to become a separate file, but the plan and implementation should be updated to reflect the most common misuse patterns.

Once the audit is done, define the semantic color contract in the theme layer. Do not change the raw palette values unless contrast testing proves one must move. Instead, add or document semantic aliases and usage rules. At minimum, the contract should state:

- `primary`: the highest-priority action or active navigation state
- `secondary`: neutral structure, subdued controls, inactive shells
- `success`: confirmed participation, accepted state, completion, positive resolution
- `warning`: pending, caution, waitlist, limited availability, recoverable risk
- `info`: discovery, metadata, location, contextual accents, non-critical emphasis
- `danger`: deletion, irreversible actions, refusal, failure states

Then update shared components before feature screens. If segmented controls, chips, pills, or highlighted cards remain primary-heavy, each feature screen will keep looking overly blue even if screen-local styles are cleaned up. Add reusable semantic variants where necessary. For example, segmented controls may need a less saturated active shell in some contexts, while chips and badges may need neutral, info, success, warning, and danger variants. Avoid creating a huge component library; the goal is a small set of shared primitives with clear semantics.

After shared primitives are ready, roll out the rebalance feature by feature. Begin with Meetups and Discover because they currently show the strongest blue saturation and are the easiest places for users to feel fatigue from over-accenting. In Meetups, reserve primary for manage or main CTA actions and active navigation, use success for attendance-confirmed states, warning for waitlist and caution states, info for discovery and location context, secondary for neutral structure, and danger only for destructive affordances. In Discover, move context-oriented discovery cues toward info or primarySubtle treatments instead of solid primary blocks.

Next rebalance Support, where semantic color is especially important. Accepted or helpful responses should use success, urgency and limited availability should use warning or danger depending on severity, and general browsing structure should remain neutral. Then move to Feed, Chats, Profile, onboarding, and auth surfaces. The goal is not to make every screen colorful; it is to make each color mean something stable whenever it appears.

Throughout the rollout, prefer subtle backgrounds and borders over solid fills for lower-priority accents. Blue should remain the brand anchor, but most passive surfaces should be neutral or subtle. Use solid fills mainly for true CTAs, strongly active controls, and clearly stateful badges. If a component currently uses solid primary for a decorative reason only, downgrade it to `primarySubtle`, `info`, `secondary`, or a neutral surface depending on the meaning.

## Concrete Steps

Work from `/home/michaelroddy/repos/project_radeon_app` on a dedicated branch:

    git checkout -b feature/app-semantic-color-rebalance

Audit the palette and current usage:

    sed -n '1,220p' src/theme/colors.ts
    sed -n '1,220p' src/utils/theme.ts
    rg -n "Colors\\.primary|Colors\\.success|Colors\\.warning|Colors\\.danger|Colors\\.info|Colors\\.secondary" src/screens src/components

Inspect shared primitives before feature-specific files:

    sed -n '1,220p' src/components/ui/PrimaryButton.tsx
    sed -n '1,220p' src/components/ui/SegmentedControl.tsx
    sed -n '1,220p' src/components/ui/SearchBar.tsx
    sed -n '1,220p' src/components/ui/HeroCard.tsx

Inspect the first rollout targets:

    sed -n '1,260p' src/screens/main/MeetupsScreen.tsx
    sed -n '1,260p' src/components/events/MeetupCard.tsx
    sed -n '1,240p' src/components/events/MeetupForm.tsx
    sed -n '1,260p' src/screens/main/DiscoverScreen.tsx
    sed -n '1,220p' src/components/discover/DiscoverActiveFiltersBar.tsx

Run validation after each meaningful wave of changes:

    npx tsc --noEmit

Expected result:

    TypeScript exits successfully with no diagnostics.

For manual visual verification:

    npx expo start

Then open the app and compare the visual hierarchy across Meetups, Discover, Support, Feed, Chats, Profile, onboarding, and auth.

## Validation and Acceptance

Validation must prove both semantic consistency and visual improvement. First run `npx tsc --noEmit` and expect a clean TypeScript build. Then manually inspect the app on a simulator or device.

In Meetups, the highest-emphasis action should still be immediately obvious, but list cards, category chips, metadata pills, and summary panels should no longer all compete with the same blue treatment. Confirmed attendance should read as success, waitlist as warning, and destructive actions as danger. In Discover, context cues and filters should feel cleaner and less saturated, with primary reserved for the most important interaction. In Support, urgency and successful helper outcomes should clearly separate from each other. In Feed and Chats, brand blue should still exist for active interactions, but passive surfaces should not feel like brand advertisements.

Acceptance means a human can move across at least five major screens and observe a stable meaning for each color family:

- blue means the main action or active selection
- green means confirmed positive state
- amber means caution, pending, or waitlist
- cyan means context or discovery accent
- gray means structure or inactive state
- red means destructive or severe state

The app should feel more composed, not more colorful. If the palette rebalance makes any screen feel noisy, the correct response is to reduce accenting, not to add more colors.

## Idempotence and Recovery

This work should be implemented in small waves and can be repeated safely. Re-running `npx tsc --noEmit` is always safe. If a shared-component change creates visual regressions across many screens, revert that component-level change before continuing with feature-level tweaks. Prefer additive semantic variants over deleting working code immediately. If a feature area proves too large for one pass, stop after a coherent wave such as shared primitives plus Meetups and Discover, then update this ExecPlan to mark the remaining feature areas explicitly.

Do not change raw theme values casually during rollout. The primary goal is semantic reassignment, not palette churn. If one raw token must change for contrast reasons, document the rationale in `Decision Log` and verify all screens using it.

## Artifacts and Notes

Key evidence at the time this plan was written:

    src/theme/colors.ts
        The full Bootstrap-style palette already exists, including primary, success, warning, danger, info, secondary, and subtle variants.

    src/components/ui/PrimaryButton.tsx
        Already supports multiple semantic action variants and can serve as the model for other shared UI.

    src/screens/main/MeetupsScreen.tsx and src/components/events/*
        Contain repeated solid primary accents across filters, chips, action states, and section treatments.

    src/screens/main/DiscoverScreen.tsx and src/components/discover/*
        Contain repeated primary accents for discovery context and filter UI, where softer info or subtle treatments may be more appropriate.

These notes are a starting orientation, not a substitute for the audit and implementation steps above.

## Interfaces and Dependencies

Use the existing theme system in `src/theme/` and the compatibility exports in `src/utils/theme.ts`. Do not introduce a new theming library. Reuse and extend existing shared UI components where possible.

At the end of implementation, the following conditions should hold:

- `src/theme/colors.ts` continues to define the raw palette and any necessary subtle variants.
- `src/utils/theme.ts` exposes stable semantic tokens or aliases that screen code can rely on.
- Shared primitives such as buttons, segmented controls, pills, chips, and highlighted surfaces support semantic variants where needed.
- Feature screens rely less on one-off `Colors.primary` styling and more on semantic roles that match the design contract.

If a new helper or component variant is introduced, place it in the existing theme or shared-component structure rather than creating a new top-level design-system folder.

Revision note: Created on 2026-04-26 to drive an app-wide semantic color rebalance after identifying that Bootstrap primary is being used as a generic accent across many screens instead of being reserved for the highest-priority interaction and active state.

Revision note: Updated on 2026-04-26 after implementing the first rollout wave to record completed shared-component, Meetups, Discover, Support, Profile, and onboarding changes, and to note that Feed, Chats, auth, and manual visual QA still remain.
