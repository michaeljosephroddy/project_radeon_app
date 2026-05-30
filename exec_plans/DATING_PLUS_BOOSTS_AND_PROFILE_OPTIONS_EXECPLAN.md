# Dating Plus, Boosts, And Expanded Profile Options

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `PLANS.md` in this repository. It is self-contained so a future contributor can implement the feature without relying on chat history.

## Purpose / Big Picture

SoberSpace should offer a dating upgrade that feels native to a sober social app: useful advanced compatibility filters, visibility tools, and profile details that help people understand sober lifestyle fit before matching. After this work, a user can fill out richer dating profile details, browse with basic filters for free, upgrade to SoberSpace Plus for advanced filters and likes-you visibility, and buy one-off Spotlights to show their profile to more compatible people for a short period.

The product inspiration is the screenshot sets at `/home/michaelroddy/Downloads/j` and `/home/michaelroddy/Downloads/k`, which show dating preferences, optional profile details, subscription benefits, boost purchase sheets, and profile-adjacent "Get more" monetization hubs. The implementation must not copy Hinge or Tinder styling, copy, or brand structure. It should use SoberSpace's dark theme, current typography and spacing tokens, sober compatibility framing, and the existing dating profile editor pattern.

## Progress

- [x] (2026-05-30T10:54Z) Reviewed the screenshot set and identified three feature groups: dating preferences, profile option pickers, and subscription/boost monetization.
- [x] (2026-05-30T10:54Z) Decided to use one subscription tier plus one-off boost products instead of two subscription tiers.
- [x] (2026-05-30T10:54Z) Created this ExecPlan with pricing, product scope, backend/app implementation milestones, and validation criteria.
- [x] (2026-05-30T11:37Z) Added backend enforcement for the free daily Dating like limit, returning HTTP 402 when Plus is required for more likes.
- [x] (2026-05-30T11:37Z) Added a backend migration, Go types, parsing, validation, SQL scan/update support, and tests for expanded Dating profile options.
- [x] (2026-05-30T11:37Z) Added app API typings, editor rows, section editors, profile preview rows, and public profile detail rows for the expanded Dating profile options.
- [x] (2026-05-30T11:37Z) Added a SoberSpace Plus screen with target plan pricing, benefits, Spotlight catalogue, navigation, and 402 daily-like-limit routing.
- [x] (2026-05-30T12:22Z) Reviewed `/home/michaelroddy/Downloads/k` screenshots and decided the next monetization surface should be a third Dating profile editor tab named `Get more`, not a new bottom tab.
- [x] (2026-05-30T13:18Z) Created backend Spotlight purchase/inventory/activation migration, store APIs, routes, cache pass-through, discovery ranking weight, and tests.
- [x] (2026-05-30T13:18Z) Added the Dating profile editor `Get more` tab with Plus plans, benefits, Spotlight/Super Spotlight inventory, activation state, and setup-required purchase CTAs.
- [x] (2026-05-30T13:18Z) Added app API types/functions and React Query hooks for Spotlight status and activation.
- [x] (2026-05-30T13:18Z) Applied backend migration `106_dating_spotlights.sql` locally.
- [x] (2026-05-30T13:42Z) Added backend Plus-gated advanced Dating filters for dating intentions, height, family plans, vices, sober lifestyle, recovery approach, nightlife comfort, and substance boundaries.
- [x] (2026-05-30T13:42Z) Added app advanced Dating filter UI with Plus-locked rows for free users and usable filter controls for Plus users.
- [x] (2026-05-30T14:05Z) Added subscription savings labels and the auto-renewal/cancellation disclaimer to the SoberSpace Plus surfaces.
- [x] (2026-05-30T14:22Z) Redesigned the Dating profile editor `Get more` tab around a simpler profile-status header, quick action tiles, and Free versus Plus comparison card.
- [x] (2026-05-30T14:35Z) Removed Standout Like references from the app plan, Get More UI, and Plus benefit copy.
- [x] (2026-05-30T13:18Z) Add real Spotlight inventory and activation state to the `Get more` tab.
- [ ] Integrate real App Store / Google Play products and receipt validation.
- [x] (2026-05-30T13:18Z) Validate implemented backend/app slices with backend tests, app typecheck, and local migration.

## Surprises & Discoveries

- Observation: The screenshots separate ongoing subscription value from one-off visibility boosts.
    Evidence: Subscription screens list unlimited likes, see likes, more preferences, and sorting; boost sheets separately sell 1-hour boosts and 24-hour superboosts.
- Observation: The existing app already has `subscription_tier`, `subscription_status`, and `is_plus` fields on `User` in `src/api/client.ts`, so the frontend has a place to show entitlement state once the backend enforces it.
    Evidence: `src/api/client.ts` includes `is_plus?: boolean`, `subscription_tier?: string | null`, and `subscription_status?: string | null` in `User`.
- Observation: A prior plan, `exec_plans/freemium_plus_entitlements.md`, says billing, pricing, checkout, receipt validation, and webhooks are future work. This plan fills in the dating-specific monetization and pricing details and should be treated as the next-stage plan for dating monetization.
    Evidence: That plan explicitly states "Billing provider, pricing, checkout, receipt validation, and webhooks are separate future work."
- Observation: Store billing provider setup is not present in the Expo app yet.
    Evidence: The implementation added product IDs, target display prices, and purchase entry points, but purchase actions intentionally show setup-required messaging until App Store / Google Play products and server-side validation are connected.
- Observation: The screenshots in `/home/michaelroddy/Downloads/k` place monetization close to the user's profile and profile-completion surface, rather than only in a modal paywall.
    Evidence: Hinge shows a profile-area `Get more` tab alongside safety/profile tabs, and Tinder shows boosts, super-like inventory, and subscriptions on the profile screen.
- Observation: Spotlight inventory can now be activated, but inventory still needs to be granted by manual/admin rows or a future billing provider.
    Evidence: Migration `106_dating_spotlights.sql` creates purchase and inventory tables, while the app purchase CTAs still show setup-required messaging until receipt validation or webhooks are connected.

## Decision Log

- Decision: Ship one paid tier named `SoberSpace Plus` first, not Plus plus a second priority tier.
    Rationale: One tier is easier to explain, test, price, and enforce. A second tier would add entitlement and pricing complexity before there is evidence that users need a higher paid segment.
    Date/Author: 2026-05-30 / Codex
- Decision: Use one-off purchases for visibility boosts, separate from subscription.
    Rationale: Subscription should buy ongoing utility such as advanced filters and seeing likes. Boosts are episodic visibility tools and fit better as consumable purchases.
    Date/Author: 2026-05-30 / Codex
- Decision: Price SoberSpace Plus and boosts close to the screenshot/Hinge reference while relying on store-localized product prices in production.
    Rationale: The user requested pricing "pretty much the same as Hinge." App Store and Google Play should supply localized display prices, while product IDs and target price tiers anchor the intended amounts.
    Date/Author: 2026-05-30 / Codex
- Decision: Adapt generic dating-app fields into sober-specific language where substance use or recovery context is involved.
    Rationale: SoberSpace must avoid normalizing substance use in a way that conflicts with the product's sober community purpose. Fields like "Drugs" and "Marijuana" should become "Substance boundaries" or "Nightlife comfort" rather than direct clones.
    Date/Author: 2026-05-30 / Codex
- Decision: Do not hardcode exact Hinge copy, visual hierarchy, or brand styling.
    Rationale: The product can reuse mechanics, but the UI should be original and consistent with SoberSpace's dark interface, current chips, rows, and screen headers.
    Date/Author: 2026-05-30 / Codex
- Decision: Put `Get more` inside the Dating profile editor as a third tab beside `Edit` and `Preview`.
    Rationale: This keeps monetization tied to the Dating profile context, matches the profile-adjacent pattern from the new screenshots, and avoids adding another bottom tab. Dating paywall entry points can later deep-link to this tab.
    Date/Author: 2026-05-30 / Codex
- Decision: Build real boost inventory and activation before real checkout.
    Rationale: Store billing is not configured yet, but backend inventory, activation, expiry, and discovery ranking are valuable product infrastructure that can be tested without pretending purchases work.
    Date/Author: 2026-05-30 / Codex

## Outcomes & Retrospective

Implementation is complete except for live billing provider integration. Shipped so far: richer Dating profile options, app editing/display support, a SoberSpace Plus paywall surface, product/benefit catalogue, backend enforcement for the free daily like limit, the Dating profile editor `Get more` tab, backend Spotlight inventory/activation/ranking infrastructure, and Plus-gated advanced Dating filters. Deferred: real billing checkout, receipt validation, and store/provider webhooks.

## Context and Orientation

There are two repositories involved.

The app repository is `/home/michaelroddy/repos/project_radeon_app`. It is a React Native / Expo app. All API types and network calls live in `src/api/client.ts`. Dating profile editing is implemented in `src/components/discover/DatingProfileEditorScreen.tsx`. Dating discovery and filters are in `src/screens/main/DiscoverScreen.tsx`, `src/components/discover/DiscoverFilterSheet.tsx`, and `src/hooks/useDiscoverFilters.ts`. Dating likes and matches screens are under `src/components/discover/` and `src/screens/main/dating/`. Navigation is owned by `src/navigation/`.

The backend repository is `/home/michaelroddy/repos/project_radeon`. It is a Go REST API. Dating code lives in `internal/dating/handler.go`, `internal/dating/store.go`, `internal/dating/types.go`, and related tests. Database migrations live in `migrations/`, and `schema/base.sql` is the full reference schema. User subscription fields already exist on user responses, but billing and receipt validation are not yet implemented.

Terms used in this plan:

`SoberSpace Plus` means the single recurring subscription tier. A user is Plus when the backend says their subscription tier is `plus` and status is active.

`Spotlight` means a one-off consumable purchase that temporarily gives the user's dating profile higher visibility. It is equivalent to a "boost" mechanic but named in SoberSpace language.

`Super Spotlight` means a longer Spotlight, intended to last 24 hours.

`Entitlement` means a backend-enforced permission derived from subscription and purchase state, such as "can view likes-you list" or "has unlimited dating likes." The app may hide or lock UI, but the backend must be the source of truth.

`Advanced filter` means a dating/discovery filter only available to Plus users. Free users can see locked rows and upgrade prompts, but backend requests using locked filters must be rejected or ignored with a clear entitlement response.

`Get more` means the monetization hub shown as the third tab in the Dating profile editor, beside `Edit` and `Preview`. It is not a bottom tab. It should include subscription benefits, plan options, Spotlight inventory/purchase entries, and Super Spotlight entries.

## Product Definition

Free dating should remain useful. A free user can create a dating profile, discover dating profiles, pass profiles, send a limited number of likes per day, match when likes are mutual, and chat with matches. Free filters should include interested in, age range, distance, relationship goal, and broad location.

SoberSpace Plus should unlock ongoing utility:

See everyone who likes you. This means the full likes-you list is available, not just a preview.

More or unlimited likes. The existing older plan suggested 10 likes per day for Free. Keep that unless product changes it. Plus removes the daily like cap.

Advanced sober compatibility filters. These should include shared interests, sobriety lifestyle, recovery approach, nightlife comfort, substance boundaries, height, education, family plans, politics, religion, languages, zodiac, communication style, love style, workout, and social media style where available.

Sort incoming likes. Sorting should include newest, nearby, shared interests, sober compatibility, and recently active if the backend can support it efficiently.

One monthly Spotlight credit, if billing and consumable accounting are ready. If monthly credit adds too much complexity for the first release, defer it and keep Spotlights as separate purchases.

One-off purchase products should be:

Spotlight: one hour of increased visibility.

Three Spotlights bundle: three one-hour Spotlights usable at any time.

Super Spotlight: 24 hours of stronger visibility.

Two Super Spotlights bundle: two 24-hour Super Spotlights usable at any time.

The app should frame these around sober compatibility, not vanity. Example SoberSpace-style copy: "Be shown to more compatible sober daters" and "Get seen by people whose dating goals and sober lifestyle fit yours." Do not use exact screenshot copy such as "Send and see all the likes you want" or "Boost your profile for more views."

The primary app surface for these products should be the Dating profile editor's `Get more` tab. Existing locked surfaces, such as Likes You and daily-like-limit errors, may keep opening the current full SoberSpace Plus screen until initial-tab deep-linking is implemented. Once deep-linking is available, route those entry points to the `Get more` tab with the relevant section focused.

The `Get more` tab should include:

- A concise profile-context header, using existing Dating profile data where available.
- A profile completion prompt or progress row if the data is already available cheaply.
- Quick inventory tiles for Spotlights, Super Spotlights, and Plus.
- A SoberSpace Plus comparison card showing Free versus Plus for core benefits.
- Plan options using the existing target product IDs and target prices until live store metadata exists.
- Spotlight and Super Spotlight product cards with inventory count and activation state once the backend supports it.
- Clear setup-required purchase messaging while billing is not connected.

## Pricing

Use App Store and Google Play localized prices in production. The app must display the store-provided localized price string, not hardcoded euro text. The target product price tiers should track the screenshot/Hinge reference closely.

SoberSpace Plus subscription products:

- `soberspace_plus_weekly`: target reference price approximately €17.99 per week.
- `soberspace_plus_monthly`: target reference price approximately €30.99 per month.
- `soberspace_plus_3_month`: target reference price approximately €59.99 per 3 months, displayed as about €19.99 per month where store rules allow.
- `soberspace_plus_6_month`: target reference price approximately €89.99 per 6 months, displayed as about €14.99 per month where store rules allow.

Spotlight one-off products:

- `spotlight_1`: target reference price approximately €8.49 for one hour.
- `spotlight_3`: target reference price approximately €24.99 total, equivalent to about €8.33 each.
- `super_spotlight_1`: target reference price approximately €26.99 for 24 hours.
- `super_spotlight_2`: target reference price approximately €37.99 total, equivalent to about €18.99 each.

Store product configuration must be documented in the implementation PR. If exact price points are not available in a region, choose the closest available store tier and rely on localized price display. Backend should store product IDs and entitlement effects, not localized prices.

## Expanded Dating Profile Options

The existing dating profile already has photos, bio, interests, relationship goal, interested genders, relationship type, gender, sexuality, pronouns, ethnicity, children, pets, religious belief, languages, political view, vices, height, work, education, and prompts.

Add the following generic dating-app-inspired fields, adapted to SoberSpace:

`zodiac`: single choice with the twelve zodiac signs. This is lightweight and optional.

`family_plans`: single choice with wants children, does not want children, open to children, not sure, prefer not to say. Keep this distinct from `children_status`, which describes current child status.

`communication_style`: multi-select or single-select. Start as multi-select with max 3. Options: big texter, phone caller, voice note person, video chatter, slow responder, better in person.

`love_style`: multi-select or single-select. Start as multi-select with max 3. Options: quality time, words of affirmation, acts of service, physical touch, thoughtful gestures, steady support.

`workout`: single choice. Options: every day, often, sometimes, occasionally, never.

`social_media`: single choice. Options: off the grid, passive scroller, socially active, creator.

Add SoberSpace-specific fields:

`sober_lifestyle`: single choice. Options: alcohol-free, fully sober, sober curious, California sober, supporting someone sober, prefer not to say. Product and safety should review whether "California sober" belongs in the community. If not, remove it before implementation.

`recovery_approach`: multi-select with max 3. Options: meetings, therapy, faith-based, fitness, mindfulness, community support, self-guided, prefer not to say.

`nightlife_comfort`: single choice. Options: avoid bars, okay if alcohol is nearby, depends on the setting, prefer quiet plans, prefer not to say.

`substance_boundaries`: multi-select with max 4. Options: no alcohol around me, no smoking, no recreational drugs, sober venues preferred, ask me first. This replaces directly copying "Drugs" and "Marijuana" as separate fields.

These fields are optional and should not be required for profile completion. They should appear in the dating profile editor under grouped sections, in the dating profile preview, in public dating profile details, and in Plus advanced filters where useful.

## Plan of Work

Milestone 1 adds backend subscription and product foundations. In `/home/michaelroddy/repos/project_radeon`, create migrations for subscription purchases, consumable purchases, boost inventory, and active boost windows. Keep the existing `users.subscription_tier` and `users.subscription_status` fields as the summary state for user responses. Add entitlement helpers in a shared backend package or in the relevant domain packages. The backend must be able to answer whether a user is Plus, how many free dating likes remain today, whether they can view the full likes-you list, and whether they have active Spotlight visibility.

Milestone 2 implements dating profile fields. Add database columns to `dating_profiles`, check constraints, Go types, update request parsing, validation helpers, SQL update and scan logic, public profile mapping, and tests. Then mirror those fields in `src/api/client.ts` and add editor sections in `DatingProfileEditorScreen.tsx`. Use the existing focused section editor and chip components. Do not add new top-level folders.

Milestone 3 implements advanced filters and paywalls. Update `DiscoverFilterSheet`, `useDiscoverFilters`, query keys, API payload types, and backend dating discover query handling. Free users should see locked advanced filter rows with a SoberSpace Plus upsell. If a free user somehow sends Plus-only filters, the backend must return a clear entitlement error rather than silently giving paid behavior.

Milestone 4 implements the Dating profile editor `Get more` tab. Add `get_more` to the editor tab union and segmented control in `src/components/discover/DatingProfileEditorScreen.tsx`. Render a native-feeling monetization hub using SoberSpace colors, icons, existing UI primitives, and the existing product catalogue in `src/utils/datingMonetization.ts`. The tab should include Plus, Spotlight, Super Spotlight, and inventory placeholders. It must not copy Hinge or Tinder layout exactly. Purchase CTAs should use setup-required messaging until store billing is connected.

Milestone 5 implements Spotlights. Add backend tables and routes for Spotlight inventory and active Spotlight windows. Users should see their available inventory and active Spotlight expiry in the `Get more` tab. Activation should consume inventory exactly once and return the active window. Backend ranking should promote active Spotlight profiles in dating discovery while still respecting safety, blocks, dating completion, distance, age, gender, and other filters. Spotlights must not show a user to people they should not be eligible for.

Milestone 6 integrates billing. Choose one in-app purchase approach and document it. The likely path for Expo is RevenueCat or Expo-compatible native in-app purchase modules. Backend must validate purchases server-side through provider webhooks or receipt verification and must not trust app-only purchase state. Store product IDs should be constants in one app module and one backend module.

Milestone 7 hardens analytics, safety, and recovery behavior. Log paywall impressions, purchase starts, purchase success/failure, Spotlight activation, and advanced filter lock taps. Ensure no recovery meetings, peer support, safety tools, account deletion, reporting, or blocking features are paywalled. Add copy review for substance-related profile fields.

## Concrete Steps

Start each repository from a clean main branch:

    cd /home/michaelroddy/repos/project_radeon_app
    git status --short --branch
    git switch -c feature/dating-plus-boosts

    cd /home/michaelroddy/repos/project_radeon
    git status --short --branch
    git switch -c feature/dating-plus-boosts

Before implementation, read:

    /home/michaelroddy/repos/project_radeon_app/AGENTS.md
    /home/michaelroddy/repos/project_radeon/AGENTS.md
    /home/michaelroddy/repos/project_radeon_app/exec_plans/freemium_plus_entitlements.md
    /home/michaelroddy/repos/project_radeon_app/exec_plans/dating-profile-expanded-details.md

Backend implementation should proceed in small migrations and tests. After each backend milestone, run:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project-radeon-go-build go test ./internal/dating

When backend work is complete, run:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project-radeon-go-build go test ./...

App implementation should proceed in small type-safe edits. After each app milestone, run:

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck

If UI screens are implemented, start the app and manually verify flows:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

Open the app, navigate to Dating, edit a profile, open advanced filters, tap locked filters as a free user, open the Plus paywall, and open the Spotlight purchase sheet.

For the next slice, manually verify:

    Open Dating profile editor
    Switch between Edit, Preview, and Get more
    Tap Plus plan CTAs and confirm setup-required messaging
    Tap Spotlight/Super Spotlight CTAs and confirm setup-required messaging
    If backend Spotlight state is implemented, activate available inventory and confirm expiry state appears

## Validation and Acceptance

Backend acceptance:

A free user can send dating likes until the daily free limit is reached. The next like returns a structured entitlement or paywall error, and the app can distinguish this from a generic failure.

A Plus user can send likes beyond the free daily limit.

A free user cannot fetch the full likes-you list. A Plus user can fetch it.

A free user cannot use Plus-only advanced filters. A Plus user can use them.

A user with an active Spotlight appears higher in eligible dating discovery results, but never bypasses blocks, reports, incomplete dating profiles, paused dating profiles, gender/age/distance eligibility, or safety restrictions.

Spotlight consumables can be purchased, stored, activated, consumed exactly once, and expired automatically by time checks.

App acceptance:

The dating profile editor shows the new optional fields in grouped sections and saves them successfully.

The dating profile editor shows `Edit`, `Preview`, and `Get more` tabs. `Get more` renders without disrupting editing or preview state.

The public dating profile detail screen and preview show only filled optional fields.

The advanced filter sheet shows free filters normally and Plus filters as locked when the user is free.

Tapping a locked advanced filter opens a SoberSpace Plus upsell using SoberSpace styling and copy.

The `Get more` tab shows weekly, monthly, 3-month, and 6-month products. In production it must use localized store prices; before billing integration it may show target reference pricing with setup-required CTAs.

The `Get more` tab shows one-hour and 24-hour Spotlight options, inventory, active expiry state, and activation CTA once backend Spotlight state exists.

Commands must pass:

    cd /home/michaelroddy/repos/project_radeon
    GOCACHE=/tmp/project-radeon-go-build go test ./...

    cd /home/michaelroddy/repos/project_radeon_app
    npm run typecheck

## Idempotence and Recovery

Migrations must use `ADD COLUMN IF NOT EXISTS` and `DROP CONSTRAINT IF EXISTS` where appropriate, matching current migration style. Do not modify already-applied migrations. If a migration fails locally, fix it with a new migration or correct the unapplied local migration before it is shared; do not edit production-applied migrations.

Backend purchase processing must be idempotent. A store webhook or receipt can arrive more than once, so purchase records need a unique provider transaction ID. Reprocessing the same transaction should not grant duplicate boosts or duplicate subscription periods.

Spotlight activation must be idempotent where possible. If the activation request is retried after success, the backend should return the current active Spotlight rather than consuming a second item.

If billing provider integration is blocked, ship the entitlement, UI, and backend gating behind a development-only feature flag with mocked product metadata, and document the blocked provider setup in this ExecPlan before stopping.

## Artifacts and Notes

Screenshot-derived reference features from `/home/michaelroddy/Downloads/j`:

Dating preferences screenshots show free member preferences and locked subscriber preferences. Free rows include interested in, neighbourhood, distance, age range, ethnicity, religion, and relationship type. Locked rows include height, dating intentions, children, family plans, drugs, smoking, marijuana, drinking, politics, and education.

Profile option screenshots show bottom-sheet pickers with chip options for communication style, workout, social media, and zodiac. The implementation should use SoberSpace's focused editor screens or bottom sheets, not the exact visual treatment.

Subscription screenshots show weekly, monthly, 3-month, and 6-month subscription products and benefits such as unlimited likes, seeing likes, more preferences, standouts, sorting likes, enhanced recommendations, skip the line, and priority likes.

Boost screenshots show one-hour boosts, 24-hour superboosts, bundles, a carousel card pattern, and a select CTA. SoberSpace should translate this into Spotlight and Super Spotlight without copying the sheet design.

Screenshot-derived reference features from `/home/michaelroddy/Downloads/k`:

Hinge shows a profile-area `Get more` tab with a large subscription card, then product rows for boosts and roses. Tinder shows profile completion, quick inventory tiles for super likes and boosts, and a subscription comparison card. SoberSpace should adapt these mechanics into the Dating profile editor's `Get more` tab, using Spotlights and SoberSpace Plus language instead of Hinge/Tinder naming.

## Interfaces and Dependencies

Backend product and entitlement interfaces should be explicit. In `/home/michaelroddy/repos/project_radeon/internal/subscriptions` or another appropriate package, define a helper that can be reused by dating and meetups:

    type Entitlements struct {
        IsPlus bool
        DatingDailyLikeLimit int
        HasUnlimitedDatingLikes bool
        CanViewDatingLikes bool
        CanUseAdvancedDatingFilters bool
        HasDatingPriority bool
    }

    type Service interface {
        GetEntitlements(ctx context.Context, userID uuid.UUID) (Entitlements, error)
    }

Dating store APIs should support active boosts:

    type ActiveSpotlight struct {
        UserID uuid.UUID
        Kind string
        StartsAt time.Time
        EndsAt time.Time
    }

    func (s *pgStore) ActivateSpotlight(ctx context.Context, userID uuid.UUID, inventoryID uuid.UUID) (*ActiveSpotlight, error)
    func (s *pgStore) GetActiveSpotlight(ctx context.Context, userID uuid.UUID) (*ActiveSpotlight, error)

App product IDs should live in one module, for example `src/billing/products.ts`, with stable constants:

    SOBERSPACE_PLUS_WEEKLY
    SOBERSPACE_PLUS_MONTHLY
    SOBERSPACE_PLUS_3_MONTH
    SOBERSPACE_PLUS_6_MONTH
    SPOTLIGHT_1
    SPOTLIGHT_3
    SUPER_SPOTLIGHT_1
    SUPER_SPOTLIGHT_2

App purchase UI should use existing components where possible: `ScreenHeader`, `PrimaryButton`, `SegmentedControl`, existing theme tokens, and icons from `@expo/vector-icons` unless the app standardizes on another icon package. Avoid adding a new visual design system.

The app currently stores product metadata in `src/utils/datingMonetization.ts`. Keep using that module for the immediate `Get more` tab. If real billing integration adds store SDK concerns later, move or re-export these constants from a dedicated billing module without changing product IDs.

Backend must remain the enforcement boundary. The app can show locked UI based on `User.is_plus`, but all protected API routes must check entitlements server-side.

## Revision Notes

2026-05-30 / Codex: Initial ExecPlan created from dating-app screenshots and product discussion. It records the decision to use one subscription tier, Hinge-like reference pricing through localized store products, one-off Spotlight purchases, expanded dating profile options, and SoberSpace-specific sober compatibility fields.

2026-05-30 / Codex: Updated after reviewing `/home/michaelroddy/Downloads/k`. The next app surface is now a `Get more` tab inside the Dating profile editor, with backend Spotlight inventory/activation planned before real checkout integration.
