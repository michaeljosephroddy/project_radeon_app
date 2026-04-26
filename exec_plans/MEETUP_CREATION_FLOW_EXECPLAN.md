# Turn Meetup Creation Into a Guided Multi-Step Flow

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

`PLANS.md` lives at `/home/michaelroddy/repos/project_radeon_app/PLANS.md` and this document must be maintained in accordance with it.

## Purpose / Big Picture

After this work, creating an event should feel guided and premium instead of like filling out one long admin form. A user should be able to move through a short sequence of focused steps, go back without losing what they typed, skip optional sections, and finish on a clear review screen that explains whether they are publishing a live event or saving a draft. The same step components should also support editing drafts and editing already-published events, while preserving the existing rule that published events are edited in place and are never demoted back into drafts.

The visible proof is straightforward. In the Meetups tab, press Create and expect a step-based flow with progress, Back, Next, and Skip where appropriate. Fill only the required pieces and skip co-hosts or attendance details; the flow should still reach Review. Save a draft and reopen it; the step data should be prefilled. Publish a new event and then manage a published event; the same grouped steps should be reused, but the final action should say `Save changes` for a live event instead of showing draft-only controls.

## Progress

- [x] (2026-04-26 21:07Z) Read `PLANS.md`, inspect the current meetup creation and management files, and create this ExecPlan.
- [x] (2026-04-26 21:23Z) Define the final step model, validation boundaries, and local state machine contract for the flow.
- [x] (2026-04-26 21:34Z) Split the current meetup form into a flow wrapper, shared flow layout, and dedicated step components plus a review step.
- [x] (2026-04-26 21:38Z) Reuse the step components for create, draft edit, and published-event edit while preserving the existing Option A lifecycle rules.
- [x] (2026-04-26 21:41Z) Add step-level validation, skip rules, review summaries, and review-stage draft/save/publish actions that match the current backend contract.
- [x] (2026-04-26 21:43Z) Refactor `MeetupsScreen` to use shared meetup creation types and utilities with the new flow-based `MeetupForm`.
- [ ] (2026-04-26 21:44Z) Run manual Expo verification for create, draft, publish, and manage scenarios. Completed: `npx tsc --noEmit`. Remaining: device/simulator walkthrough.

## Surprises & Discoveries

- Observation: The current meetup form already contains most of the right data groups for a wizard. The problem is presentation, not missing fields.
    Evidence: `src/components/events/MeetupForm.tsx` already clusters the inputs into Basics, Format, Timing, Location, Attendance, and Co-hosts sections inside a single scroll view.

- Observation: The current create path is tightly coupled to `MeetupsScreen`, which already owns image upload, submit semantics, and edit state.
    Evidence: `src/screens/main/MeetupsScreen.tsx` owns `editingMeetup`, `formValues`, `submitting`, `uploadingCover`, `localCoverPreviewUri`, `validateMeetupForm(...)`, and the create/update API calls.

- Observation: A route-per-step approach would fight the app’s existing navigation model.
    Evidence: This repository uses callback-based screen composition in `src/navigation/AppNavigator.tsx` rather than a deep React Navigation stack, and `MeetupsScreen` currently swaps internal views with local state.

- Observation: The old meetup form had a hidden product gap: `visibility` already existed in state and the API payload, but users could not change it anywhere in the UI.
    Evidence: `src/screens/main/MeetupsScreen.tsx` and `src/api/client.ts` already tracked `visibility`, while the previous `src/components/events/MeetupForm.tsx` never rendered a visibility control.

## Decision Log

- Decision: Build the meetup creation wizard as one screen with an internal step state machine, not as a stack of separate navigation routes.
    Rationale: The repository already favors local screen state and callback-driven overlays. A local state machine keeps draft values, validation state, and skip/back behavior in one place and avoids introducing a second navigation model just for event creation.
    Date/Author: 2026-04-26 / Codex

- Decision: Keep the flow grouped into seven steps instead of making every field its own page.
    Rationale: The current form naturally groups into a small set of decisions: what the event is, what format it uses, when it happens, where it happens, how attendance works, who co-hosts it, and a final review. More screens would feel slow and performative rather than helpful.
    Date/Author: 2026-04-26 / Codex

- Decision: Reuse the same step components for create, draft edit, and published-event edit, but give them different wrapper actions.
    Rationale: The data model is the same across these modes. The product difference is in final actions and copy: new and draft events can save drafts or publish, while published events edit in place and finish with `Save changes`.
    Date/Author: 2026-04-26 / Codex

- Decision: Do not add backend schema changes for the first flow refactor.
    Rationale: The existing meetups API already supports the required payload shape, draft status, cover upload, and co-host IDs. This refactor is primarily about flow architecture and UX, not about changing the event model.
    Date/Author: 2026-04-26 / Codex

- Decision: Keep draft state in memory for the first implementation, with explicit save actions to the backend, and do not add app-restart recovery yet.
    Rationale: The user asked for guided creation with skip/back, not offline recovery. In-memory state is enough to make the flow robust inside one session, and it keeps the first pass smaller and safer.
    Date/Author: 2026-04-26 / Codex

- Decision: Surface meetup visibility in the new `Format` step instead of leaving it as a hidden default.
    Rationale: The data model already supports `public` versus `unlisted`, and the new flow is the right moment to make that choice explicit without adding backend work.
    Date/Author: 2026-04-26 / Codex

## Outcomes & Retrospective

The implementation now replaces the old one-page meetup form with a seven-step local flow inside the existing Create surface. The new flow keeps the app’s callback-driven architecture intact, preserves current cover upload and co-host behavior, and moves draft/publish/save decisions to the review step where they are much less confusing. Create, draft edit, and published-event edit all reuse the same step components, but their final actions still honor the existing lifecycle rules: drafts remain unpublished-only, and live events are edited in place.

The main remaining gap is manual device verification. TypeScript passes, but the flow still needs a hands-on pass in Expo to confirm the step transitions, date picker behavior, review edit jumps, and published-event editing feel right on device. A likely follow-up after that manual pass is a second UX iteration around location quality, especially if the product eventually wants place search or local draft recovery across app restarts.

## Context and Orientation

The meetup feature already exists in a large, partially modular form. A novice implementing this plan needs to understand where the current responsibilities live before splitting them apart.

`src/screens/main/MeetupsScreen.tsx` is the orchestration layer for the entire meetups tab. It renders Discover, Hosting, Going, and Create views based on internal state. It also owns the current meetup form state, the active editing target, cover image upload, validation, and the final create/update calls into the API client. When a user presses `Create`, the screen does not navigate to a new route; it changes `activeView` and renders `MeetupForm`.

`src/components/events/MeetupForm.tsx` is the current long-form UI. It already contains the field groups that will become wizard steps: Basics, Format, Timing, Location, Attendance, and Co-hosts. It also already uses the platform date/time picker and the current co-host picker. The file is therefore the best source of step-level content, but it is the wrong final shape because everything is rendered inside one `ScrollView`.

`src/api/client.ts` defines the `Meetup`, `MeetupUpsertInput`, `MeetupStatus`, `MeetupEventType`, `MeetupVisibility`, and `MeetupCategory` types plus the `createMeetup(...)`, `updateMeetup(...)`, `publishMeetup(...)`, `deleteMeetup(...)`, and `uploadMeetupCoverImage(...)` functions. The wizard must continue using this API client; screens in this repository do not call `fetch` directly.

The phrase “Option A lifecycle rules” refers to the rule established in the recent meetup stabilization work: drafts are unpublished events only, and published events are edited in place. In concrete terms, that means the flow may show `Save draft` and `Publish event` for new or draft events, but it must not present a way to turn a live event back into a draft.

The phrase “internal step state machine” means a small local controller that always knows which step the user is on, which steps are skippable, whether the current step is valid enough to move forward, and what the next action should do. In this repository that should be a custom hook, not a reducer in a global store and not a navigation stack.

## Plan of Work

Start by extracting meetup creation state out of the current one-screen form rendering path and into a dedicated flow controller. In `src/screens/main/MeetupsScreen.tsx`, keep responsibility for opening the flow, loading the current meetup when editing, and calling API mutations, but stop rendering all fields inline through one long form. Introduce a new wrapper component such as `src/components/events/MeetupCreationFlow.tsx` or a new screen-level child under `src/screens/main/` that receives the existing `MeetupFormValues`, categories, friends, cover upload actions, and submit handlers from `MeetupsScreen`. This wrapper should own the current step, the step order, the back/next/skip actions, and the review summary layout.

Create a dedicated hook, preferably `src/hooks/useMeetupCreationFlow.ts`, that defines the canonical step list and the rules for movement between steps. The hook should expose the current step key, the index, the total count, booleans such as `canGoBack`, `canSkip`, and `canAdvance`, plus handlers for `nextStep()`, `previousStep()`, `skipStep()`, and `goToStep(stepKey)`. The hook should also expose a lightweight validation result for the current step only. Do not validate the entire event on every keypress. The current full-form `validateMeetupForm(...)` logic in `MeetupsScreen.tsx` should remain as the final submit gate, but step-level guards should be added so the user cannot progress past clearly incomplete required sections.

Split `src/components/events/MeetupForm.tsx` into focused step components instead of keeping a single scrolling form. The safest shape is one file per step under `src/components/events/creation/`: `MeetupStepBasics.tsx`, `MeetupStepFormat.tsx`, `MeetupStepSchedule.tsx`, `MeetupStepLocation.tsx`, `MeetupStepAttendance.tsx`, `MeetupStepHosts.tsx`, and `MeetupStepReview.tsx`. Each step should receive only the slice of props it needs plus the shared `MeetupFormValues` and `onChange(...)` contract already used by the current form. The existing date picker, cover upload controls, and co-host picker logic should move into the relevant step components rather than being rewritten from scratch.

Add a shared flow layout component such as `src/components/events/creation/MeetupFlowLayout.tsx`. This file should render the step title, descriptive helper text, progress indicator, and the bottom action area. The bottom action area needs stable semantics. Every step should show `Back` when it is not the first step. Optional steps should also show `Skip`. Intermediate steps should show `Next`. The review step should switch the bottom actions based on mode: a new or draft event shows primary `Publish event` and secondary `Save draft`; a published event shows primary `Save changes` and places destructive actions like `Cancel event` or `Delete draft` in a lower-emphasis control, not side-by-side with the main CTA.

Update `MeetupsScreen.tsx` so create and edit modes choose different entry behavior. For a brand-new event, opening Create should initialize `defaultFormValues(user)` and enter the flow at the Basics step. For draft editing, open the same flow but prefill `meetupToFormValues(...)` and set the mode to `draft`. For published-event editing, open the same flow with mode `published`, but the flow should still end with `Save changes`, never `Save draft`. Preserve the existing cover image preview behavior by keeping `localCoverPreviewUri` in `MeetupsScreen` and passing it down.

Keep backend interactions explicit and unchanged where possible. `MeetupsScreen.tsx` should still own the final call to `api.createMeetup(...)`, `api.updateMeetup(...)`, or `api.publishMeetup(...)`, because those choices depend on whether the user is creating a new event, editing a draft, or editing a published event. The flow layer should remain presentation and state-management logic, not a second network layer. If the current code mixes form rendering and mutation branching too tightly, extract a small helper such as `submitMeetupDraft(values, mode, editingMeetup)` to keep responsibilities readable.

Finally, tune the UI for forgiveness. The flow should allow users to back up without losing data, skip optional sections like Attendance and Co-hosts, and jump from the Review step back into a specific section to edit it. The Review step should present a concise event summary card plus section summaries with `Edit` affordances. This is the point where the flow becomes better than a long form: the user sees what is missing, what is optional, and what will happen when they publish.

## Concrete Steps

Work from `/home/michaelroddy/repos/project_radeon_app` on a dedicated branch:

    git checkout -b feature/meetup-creation-flow

Inspect and keep open the current sources that define the behavior being refactored:

    sed -n '1,260p' src/components/events/MeetupForm.tsx
    sed -n '1,320p' src/screens/main/MeetupsScreen.tsx
    sed -n '320,760p' src/screens/main/MeetupsScreen.tsx
    sed -n '560,760p' src/api/client.ts

Create the new flow files and move step-specific UI into them. The exact filenames may vary, but the repository should end with a dedicated flow hook plus dedicated step components. After each extraction, run:

    cd /home/michaelroddy/repos/project_radeon_app
    npx tsc --noEmit

Expected result:

    TypeScript exits successfully with no diagnostics.

When the flow compiles, start Expo for manual verification:

    cd /home/michaelroddy/repos/project_radeon_app
    npx expo start

Then open the Meetups tab and exercise the scenarios described in the validation section below.

During implementation, keep this plan current. After each milestone, add a dated line to `Progress`, record any changed assumptions in `Decision Log`, and note any unexpected UI or state behavior in `Surprises & Discoveries`.

## Validation and Acceptance

The first acceptance test is flow structure. Open the Meetups tab, press `Create`, and confirm the app shows a guided sequence rather than one long scrolling form. The screen should display a clear step title, progress such as `1 of 7`, and bottom actions that match the current position. Press `Next` on a required step with missing data and expect targeted validation on that step. Press `Skip` on Co-hosts or Attendance and expect the flow to advance without error.

The second acceptance test is state continuity. Enter a title, description, category, and cover image on the Basics step. Move forward to later steps, then press `Back` repeatedly. The previously entered values must still be present. Change the format to `online`, move to Location, and verify the location requirements adapt so the user is prompted for the online link rather than a physical venue. Change back to `in_person` and confirm the venue fields return.

The third acceptance test is lifecycle correctness. Create a new event, move through the flow, and save it as a draft from the Review step. Reopen it from Drafts and confirm the flow is prefilled and the primary actions remain `Publish event` and `Save draft`. Publish it and confirm it moves into the published organizer inventory. Then manage that same live event and confirm the flow ends with `Save changes`, not `Save draft`, and that saving changes keeps the event published.

The fourth acceptance test is review quality. On the Review step, the user should see enough information to verify the event before publishing: title, category, date/time, location or online details, attendance limits, and selected co-hosts. Each summary section should have an `Edit` affordance that returns the user to the relevant step. Publishing from Review should create a visible live event in Discover and organizer Upcoming, while saving a draft should keep it out of Discover.

The fifth acceptance test is regression safety. Cover upload, date/time pickers, co-host selection, and validation that already existed in the old form must still work inside the new flow. Run `npx tsc --noEmit` and expect a clean exit. During manual use, there should be no screen flashes when moving between steps because the flow is local UI state, not a series of network transitions.

## Idempotence and Recovery

This refactor should be done incrementally and is safe to repeat. Extracting the step components one at a time and running `npx tsc --noEmit` after each extraction is the intended recovery path if the UI breaks halfway through. Because the backend contract is not changing in the first pass, there is no migration risk and no database recovery work.

If the flow refactor becomes unstable, the safe fallback is to keep the new hook and step components but temporarily render them behind the current `activeView === 'create'` branch while leaving the old `MeetupForm` intact until the new flow reaches parity. That parallel period is acceptable as long as only one path is user-visible at a time. If you discover that app-restart draft recovery is necessary, do not improvise a half-persistent solution; instead, update this plan to add explicit local persistence using the repository’s existing storage conventions in a follow-up pass.

## Artifacts and Notes

Important current excerpts that shape this plan:

    src/components/events/MeetupForm.tsx
        Renders hero, then Basics, Format, Timing, Location, Attendance, and Co-hosts
        inside one ScrollView. The grouped sections already exist and should become steps.

    src/screens/main/MeetupsScreen.tsx
        Owns defaultFormValues(...), meetupToFormValues(...), validateMeetupForm(...),
        cover upload, and create/update/publish branching. This file remains the orchestration
        layer after the refactor, but it should stop rendering the full form directly.

    src/screens/main/MeetupsScreen.tsx
        Uses internal state like activeView and editingMeetup rather than deep stack navigation.
        The new flow should respect that architecture instead of introducing a parallel routing model.

The existing long form is not wasted work. It is the source material for the wizard. The implementation goal is to preserve working field behavior while changing the user experience from one heavy page into a short, guided sequence.

## Interfaces and Dependencies

Continue using the current frontend stack only: React, React Native, Expo, React Query, Expo Image Picker, and the existing app theme utilities from `src/utils/theme.ts`. Do not add a new global state library or a second navigation framework.

At the end of implementation, the following interfaces now exist in the app repository:

- A dedicated flow hook in `src/hooks/useMeetupCreationFlow.ts` that exposes a typed step key union, the current step, progress metadata, and movement handlers.
- A dedicated flow wrapper component in `src/components/events/MeetupForm.tsx` backed by `src/components/events/creation/MeetupFlowLayout.tsx`.
- Individual step components for Basics, Format, Schedule, Location, Attendance, Co-hosts, and Review under `src/components/events/creation/`.
- A mode contract that distinguishes `create`, `draft`, and `published` editing states without changing the underlying `MeetupUpsertInput` API shape.
- The existing submit path in `src/screens/main/MeetupsScreen.tsx` updated so the new flow can call into `createMeetup(...)`, `updateMeetup(...)`, `publishMeetup(...)`, `deleteMeetup(...)`, and `uploadMeetupCoverImage(...)` without duplicating network logic.

The backend repository is a dependency but does not need new schema or endpoint work for the first pass. This plan assumes the current API contract remains valid and that published-event editing continues to obey the existing “edit in place” rule.

Revision note: Created on 2026-04-26 to plan the conversion of meetup creation from a single long form into a guided multi-step flow with skip/back behavior, review, and mode-specific publish/save semantics.

Revision note: Updated on 2026-04-26 after implementation to record the shipped flow architecture, the newly surfaced visibility control, and the remaining manual Expo verification work.
