# Standardize App Text, Icon, Avatar, and Touch Target Sizing

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document must be maintained in accordance with `PLANS.md` in the repository root.

## Purpose / Big Picture

The app currently has a solid dark visual style, but text sizes, icon sizes, avatar sizes, and control heights drift from screen to screen. A user can move from Feed to Comments to Dating to Settings and see controls that solve the same problem at slightly different sizes. After this change, the app will still keep its current style, but it will use one deliberate sizing system: readable body text, stable title hierarchy, consistent icon roles, predictable avatar sizes, and touch targets that are comfortable on mobile.

The visible result is verified by opening common app areas such as Feed, Comments, Chats, Profile, Dating, Settings, Meetups, and Support. Comparable items should feel the same size. A row title should look like a row title everywhere, small metadata should not vary randomly, action icons should share a role-based size, and tappable controls should keep a minimum 44 point height unless they are passive decorative marks.

## Progress

- [x] (2026-05-30T13:52:39Z) Created branch `feature/app-sizing-consistency` from clean `main`.
- [x] (2026-05-30T13:52:39Z) Researched current mobile guidance and audited local theme files plus direct sizing usage.
- [x] (2026-05-30T13:52:39Z) Added this ExecPlan to define the sizing migration before implementation.
- [x] (2026-05-30T14:22:00Z) Added semantic text, icon, avatar, and target-size tokens.
- [x] (2026-05-30T14:36:00Z) Migrated shared UI primitives to the semantic sizing tokens.
- [x] (2026-05-30T15:03:00Z) Migrated high-traffic screens and removed avoidable hardcoded sizing.
- [x] (2026-05-30T15:07:00Z) Validated with `npm run typecheck` and a final hardcoded-size audit.

## Surprises & Discoveries

- Observation: The app already has a good foundation for text sizing.
    Evidence: `src/theme/typography.ts` defines `body` as 16 point text with 24 point line height, `screenTitle` as 17/22, and `cardTitle` as 16/22.

- Observation: The biggest sizing drift is not raw text size; it is icon and avatar sizing.
    Evidence: A read-only search found Ionicons and MaterialCommunityIcons at many sizes including 10, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, and 52. Avatar sizes include 30, 32, 34, 36, 38, 40, 42, 44, 58, 88, and 92.

- Observation: Font scaling appears to be enabled by default.
    Evidence: A search for `allowFontScaling`, `maxFontSizeMultiplier`, `Text.defaultProps`, and `TextInput.defaultProps` found no global disabling. This is good because React Native text scaling defaults to respecting system accessibility text settings.

- Observation: The broad migration was mostly import-safe, but one token replacement needed correction during validation.
    Evidence: `UserProfileScreen` initially referenced `TextStyles.display.fontSize`; `TextStyles` exposes `displayTitle`, so the profile avatar font was corrected to `TextStyles.displayTitle.fontSize` before typecheck.

- Observation: Final JSX and style audits no longer find direct numeric icon, avatar, avatar prop, or badge font sizing in the migrated app surface.
    Evidence: `rg -n "fontSize:\\s*[0-9]+|avatarSize=\\{[0-9]+\\}|iconSize=\\{[0-9]+\\}|size=\\{[0-9]+\\}|fontSize=\\{[0-9]+\\}" src/components src/screens src/navigation` returned no remaining results after the migration.

## Decision Log

- Decision: Keep the current body size family instead of making the app larger everywhere.
    Rationale: The app already has `body` at 16/24, which matches Material 3 body-large guidance and is close to Apple’s 17 point default. The app is a dense social product, so forcing every row to 17 would reduce scan efficiency. The better standard is 16 for readable body copy and 15 for compact dense rows where the existing design already expects density.
    Date/Author: 2026-05-30 / Codex

- Decision: Add semantic `IconSizes`, `AvatarSizes`, and `TargetSizes` tokens rather than replacing every number with a raw scale name.
    Rationale: Numbers like 18 and 20 are hard to interpret without role. A semantic token such as `IconSizes.row` or `AvatarSizes.list` tells future contributors why the size exists and where to reuse it.
    Date/Author: 2026-05-30 / Codex

- Decision: Preserve dynamic text scaling and avoid globally disabling `allowFontScaling`.
    Rationale: React Native’s `Text` component defaults to respecting system text size settings. Apple recommends supporting Dynamic Type, and disabling scaling globally would make the app less accessible. If a compact control breaks at large text sizes later, use layout changes or a narrowly scoped maximum multiplier rather than a global opt-out.
    Date/Author: 2026-05-30 / Codex

- Decision: Add a few extra avatar roles for real recurring UI contexts rather than leaving raw one-off avatar numbers in screens.
    Rationale: The app uses compact stacked attendee avatars, mini chat/header avatars, small support reply avatars, medium person rows, and onboarding avatars. Naming these roles in `AvatarSizes` keeps screen code readable and avoids hidden drift.
    Date/Author: 2026-05-30 / Codex

## Outcomes & Retrospective

Implemented the sizing token migration across shared UI, navigation, feed/post components, comments, dating surfaces, chat surfaces, profile surfaces, settings, onboarding, groups, meetups, and support screens. The app keeps its existing compact dark styling, but repeated icon, avatar, target-size, and row text roles now flow through `src/theme` rather than per-screen numeric choices.

The final typecheck passed with `npm run typecheck`. The final direct JSX audit found no remaining numeric `size={...}` or `Avatar size={...}` cases in `src/components`, `src/screens`, or `src/navigation`. Local `StyleSheet` measurements still contain layout-specific values, which are outside the scope of this pass.

## Context and Orientation

This repository is an Expo React Native app. The sizing system lives in `src/theme/typography.ts` and `src/theme/layout.ts`, and is re-exported from `src/theme/index.ts`. Most screens and shared components import from `src/theme`, so sizing standards should be added there before screen-level migration begins.

Text roles are already partially defined. `Typography.sizes` contains raw size names such as `xs`, `sm`, `base`, `md`, `lg`, `xl`, `xxl`, and `xxxl`. `TextStyles` gives semantic roles such as `displayTitle`, `screenTitle`, `sectionTitle`, `cardTitle`, `secondary`, `caption`, `button`, `chip`, `input`, `postBody`, and `commentBody`. This plan should strengthen those roles without creating a second competing typography system.

Control sizing is mostly in `src/theme/layout.ts`. `ControlHeights.default` is 44, `ControlHeights.large` is 48, `ControlSizes.iconButtonLarge` is 44, and `ControlSizes.listRowMinHeight` is 52. These are already close to platform guidance. This work should add semantic exports for icon, avatar, and target sizes rather than weakening existing control tokens.

External guidance used for this plan is summarized here so future contributors do not need the browser context. Apple says controls should measure at least 44 by 44 points and text should be at least 11 points. Apple’s typography guidance lists iOS and iPadOS default text at 17 points and minimum at 11 points, and recommends supporting larger accessibility text sizes. Material 3 commonly uses body-large text at 16 point size and 24 point line height. React Native `Text` defaults to allowing font scaling, and exposes `maxFontSizeMultiplier` for cases where a specific text element needs a cap. WCAG 2.2 has a web minimum target size of 24 by 24 CSS pixels, but native mobile app controls should generally use the larger 44 to 48 point target standard.

## Plan of Work

First, update the token layer. In `src/theme/layout.ts`, add `IconSizes`, `AvatarSizes`, and `TargetSizes`. Keep `ControlSizes` intact. Icon roles are: `badge` 12, `inline` 16, `row` 18, `tool` 20, `header` 24, `hero` 28, `primaryAction` 30, and `brand` 52. Avatar roles are: `stack` 22, `tiny` 30, `mini` 32, `comment` 34, `compact` 36, `medium` 40, `list` 44, `feature` 58, `hero` 88, `profilePhoto` 112, and `onboarding` 120. Target roles are: `minimum` 44, `comfortable` 48, and `compact` 36 for non-primary chips that still have enough surrounding spacing. Re-export the new tokens from `src/theme/index.ts`.

Second, strengthen `src/theme/typography.ts`. Do not create a new raw scale. Keep the existing sizes, but add any missing semantic roles needed by screens, such as `rowTitle`, `rowDescription`, `heroTitle`, and `priceTitle` only if they replace repeated existing local styles. Prefer updating components to existing `TextStyles` before adding new roles.

Third, migrate shared UI components. Start with `ScreenHeader`, `PrimaryButton`, `TextField`, `SearchBar`, `SegmentedControl`, `CardActionMenu`, `InfoNoticeCard`, `EmptyState`, `SurfaceCard`, `Avatar` usage sites where the size is fixed, and composer style modules. The goal is that repeated primitives use the new sizing names, making downstream screen migration smaller.

Fourth, migrate high-traffic screens in stable groups. Feed and comments should use shared post/comment text roles and icon sizes. Chats should use shared list avatar and row title sizes. Profile and Settings should use row and section roles. Dating should keep its distinctive large profile and purchase screens but replace arbitrary icon/avatar values with semantic equivalents. Meetups and Support should follow list and row standards.

Fifth, audit and validate. Run searches for direct `fontSize`, `Ionicons size`, `MaterialCommunityIcons size`, and `Avatar size` usage. Some local numbers should remain because not every visual measurement is a reusable standard, but repeated role-based values should move to tokens. Run `npm run typecheck`. If the app can be manually opened, visually check Feed, Comments, Chats, Profile, Dating, Settings, Meetups, and Support at normal text size, then repeat a quick check with larger system text if available.

## Concrete Steps

Run all commands from the repository root:

    cd /home/michaelroddy/repos/project_radeon_app

Check the branch and working tree:

    git status --short --branch

Add tokens in `src/theme/layout.ts`, then ensure `src/theme/index.ts` exports them. Audit imports and migrate references with `rg`:

    rg -n "Ionicons|MaterialCommunityIcons|Avatar|fontSize:|lineHeight:" src/components src/screens src/navigation

Run static validation:

    npm run typecheck

Expected successful output includes:

    > project-radeon@1.0.0 typecheck
    > tsc --noEmit

with exit code 0 and no TypeScript diagnostics.

Actual validation on 2026-05-30:

    npm run typecheck

completed with exit code 0 and no TypeScript diagnostics.

## Validation and Acceptance

The work is accepted when `npm run typecheck` passes and a final audit shows the common repeated sizes are semantic. Specifically, shared components should no longer hardcode common icon sizes such as 18, 20, 22, or 24 when those values represent row, tool, or header icons. Common avatar usage should use `AvatarSizes.comment`, `AvatarSizes.compact`, `AvatarSizes.list`, `AvatarSizes.feature`, or `AvatarSizes.hero` when the size maps to one of those roles. Text used for standard UI roles should prefer `TextStyles` over local `fontSize` declarations.

User-visible acceptance is visual consistency. Feed, comments, chats, profile rows, dating edit rows, settings rows, meetup rows, and support rows should look like they are using the same sizing language. The app should not become globally larger or more spaced out; density should remain appropriate for a social app.

## Idempotence and Recovery

Most edits are token replacement and can be repeated safely. If a screen looks worse after migration, revert only that screen’s local change and record the reason in `Decision Log`. If a token proves too broad, add a more precise semantic token rather than changing a token in a way that silently shifts many unrelated screens. The branch can be abandoned safely because no backend or data migrations are involved.

## Artifacts and Notes

Initial audit summaries:

    fontSize token usage:
      83 Typography.sizes.sm
      32 Typography.sizes.base
      29 Typography.sizes.xs
      19 Typography.sizes.lg
      18 Typography.sizes.xxl
      13 Typography.sizes.md
      10 Typography.sizes.xl

    Icon size spread:
      10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28, 30, 32, 52

    Avatar size spread:
      30, 32, 34, 36, 38, 40, 42, 44, 58, 88, 92

## Interfaces and Dependencies

No new external dependencies are required. The new public theme exports should be:

    IconSizes.badge: number
    IconSizes.inline: number
    IconSizes.row: number
    IconSizes.tool: number
    IconSizes.header: number
    IconSizes.hero: number
    IconSizes.primaryAction: number
    IconSizes.brand: number

    AvatarSizes.stack: number
    AvatarSizes.tiny: number
    AvatarSizes.mini: number
    AvatarSizes.comment: number
    AvatarSizes.compact: number
    AvatarSizes.medium: number
    AvatarSizes.list: number
    AvatarSizes.feature: number
    AvatarSizes.hero: number
    AvatarSizes.profilePhoto: number
    AvatarSizes.onboarding: number

    TargetSizes.minimum: number
    TargetSizes.comfortable: number
    TargetSizes.compact: number

These should be exported from `src/theme/layout.ts` and `src/theme/index.ts`. Components should import them from `src/theme`.
