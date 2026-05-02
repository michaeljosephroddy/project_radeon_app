# Reflections Refactor — Production-Grade Journal


This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` at the repository root.


## Purpose / Big Picture


After this refactor, Project Radeon's daily reflection feature feels like a real journaling product instead of a single oversized screen. A user opening the feature sees today's reflection if they already wrote one — not a blank composer that silently creates a duplicate row. While composing, the keyboard rises and falls smoothly under the action dock with no stop-short on dismiss, the same animation pattern the post composer already uses. If they close the app mid-write, their draft is recovered next time. On their profile, a streak ("7 days in a row") rewards consistent journaling and the history list shares its query cache with the in-app history view.

A contributor opening the codebase finds `DailyReflectionScreen.tsx` (currently 1021 lines) split into focused sub-150-line files in a new `src/screens/main/reflection/` directory, with explicit return types and a single source of truth for the editing form (a `useReflectionForm` hook). The doubled `gratefulFor` / `detailGratefulFor` state pairs are gone. The view state machine is no longer a chain of nested ternaries.

To see this working: open the app, navigate to the reflection feature, type something, dismiss the keyboard with a swipe, and watch the action dock track the keyboard the entire way down. Re-open the feature later the same day and confirm it goes straight to detail view, not a blank editor. Force-quit mid-write and reopen to confirm the draft survives. Visit your own profile, switch to the Reflections tab, and verify the streak count matches the consecutive days you have entries for.


## Progress


- [x] (2026-05-02) Milestone 1 — Keyboard pattern migration on `DailyReflectionScreen` (editor + detail). Also updated review and history views for the bottom-safe-area redistribution.
- [x] (2026-05-02) Milestone 2 — Today-reflection awareness. `useTodayReflection` fires on mount (gated by `!initialReflectionId`); a one-shot `useRef` routes the user to detail view when today already exists. Save path now uses `useSaveTodayReflectionMutation` (upsert), and that hook also caches the reflection by id.
- [x] (2026-05-02) Milestone 3 — Added `getLocalDateString` helper to `src/utils/date.ts`. `useUpdateReflectionMutation` now uses it instead of `new Date().toISOString().slice(0, 10)` (the only such site in the codebase, verified via grep).
- [ ] Milestone 4 — Unify the `useReflectionHistory` limit so screen and profile tab share cache.
- [ ] Milestone 5 — Split `DailyReflectionScreen.tsx` into `src/screens/main/reflection/`; introduce `useReflectionForm`.
- [ ] Milestone 6 — Drafts with debounced autosave (`useReflectionDraft`).
- [ ] Milestone 7 — Streak computation + display on the Profile reflections tab.

Use timestamps when checking items off, e.g. `- [x] (2026-05-02 14:00Z) Milestone 1 complete.`


## Surprises & Discoveries


- Observation (2026-05-02, M1): The screen root used `<SafeAreaView edges={['bottom']}>`, providing bottom safe-area to all four views uniformly. Migrating only the editor and detail views to the spacer pattern would have left a doubled cushion (animated spacer + safe-area inset) in those two views. Resolved by dropping `edges={['bottom']}` at the root and redistributing per view: editor and detail rely on the animated spacer (closedHeight = `max(insets.bottom, Spacing.sm)`), review adds a static `<View style={{ height: bottomSafeSpace }} />` after its dock, and history adds `insets.bottom` to its content padding.
    Evidence: edits to `src/screens/main/DailyReflectionScreen.tsx` lines 213-214 (root) and per-view bodies; `npx tsc --noEmit` clean after the change.

- Observation (2026-05-02, M1): The `actionDock` style was shared across editor, review, and detail with `position: 'absolute'`. Flattening it to flex flow affected all three at once. Review view did not need keyboard tracking but did still need an action dock above the safe-area, so the shared style stays shared — only its positioning props were dropped.
    Evidence: single edit to the `actionDock` StyleSheet entry; behavior preserved in all three views.


## Decision Log


- Decision: Keep the explicit "Review" step for now (do not collapse Write → Save direct).
    Rationale: The user has not made a product call on this yet. Removing it is straightforward but reversible only by re-adding UI; safer to leave intact and revisit. Streak and drafts work do not depend on this decision.
    Date/Author: 2026-05-02 / Claude (initial plan).

- Decision: Place the new screen modules under `src/screens/main/reflection/`, mirroring the existing `src/screens/main/createPost/` pattern, rather than `src/components/reflection/`.
    Rationale: The reflection screen is screen-specific composition. The existing convention is to colocate screen sub-components beside the screen, not to lift them to global `components/`.
    Date/Author: 2026-05-02 / Claude (initial plan).

- Decision: Compute streak client-side from the first `listReflections` page rather than adding a server endpoint.
    Rationale: Streak is derivable from the existing data and the first page (20 items) covers 20-day streaks comfortably. If streaks longer than 20 days become common, escalate to a server endpoint as a follow-up.
    Date/Author: 2026-05-02 / Claude (initial plan).

- Decision (M1): Drop `<SafeAreaView edges={['bottom']}>` at the screen root and have each view handle its own bottom safe-area, instead of keeping the SafeAreaView and adjusting `closedHeight` to compensate.
    Rationale: Matches CreatePostScreen's pattern exactly. Keeping the SafeAreaView would have required either a negative `openedOffset` (subtract `insets.bottom` when keyboard is up) or per-view conditional padding — both more fragile than the chosen redistribution. Each view explicitly stating its bottom space also makes the intent legible.
    Date/Author: 2026-05-02 / Claude (M1 execution).

- Decision (M2): Use a `useRef<boolean>` ("hasRoutedToTodayRef") to fire the today-routing effect exactly once per screen mount, rather than re-deriving from `view`/`composedBody` alone.
    Rationale: Without the ref, the effect would re-fire whenever the user explicitly entered write mode again (via the "create new" icon → `openWrite` resets `selectedReflection` and `composedBody`). The ref captures the user's intent across re-renders within the same mount. Resets on unmount, which is the correct lifecycle.
    Date/Author: 2026-05-02 / Claude (M2 execution).

- Decision (M2): Drop the `useCreateReflectionMutation` import entirely from `DailyReflectionScreen` rather than keeping it dormant for hypothetical back-fill.
    Rationale: Dead imports rot. The hook is still exported from `useReflections.ts` and can be re-imported when an explicit back-fill flow is built. CLAUDE.md prefers deleting unused code over preserving it speculatively.
    Date/Author: 2026-05-02 / Claude (M2 execution).


## Outcomes & Retrospective


- Milestone 1 (2026-05-02): Editor and detail views no longer wrap in `KeyboardAvoidingView`; both drive an `Animated.View` spacer via `useGradualKeyboardInset`, matching CreatePostScreen's behavior. Review and history views were rewired in the same pass to absorb the safe-area cushion that the screen-root `SafeAreaView` previously provided. Added `keyboardDismissMode="interactive"` and the iOS auto-inset disablers to both editing scrolls. `tsc --noEmit` clean. Manual verification still pending — to be done in the simulator before merge.

- Milestone 2 (2026-05-02): `DailyReflectionScreen` now consults `useTodayReflection` on mount (gated by `!initialReflectionId`). When today's reflection exists and the user has not started typing, the screen routes once to detail view via a `useRef` flag. Save path swapped from `useCreateReflectionMutation` to `useSaveTodayReflectionMutation`; that mutation now also writes `queryKeys.reflection(id)` cache for parity. `tsc --noEmit` clean. Net effect: re-opening the reflection feature after writing earlier today no longer creates a duplicate row.

- Milestone 3 (2026-05-02): `getLocalDateString` lives at the top of `src/utils/date.ts` with a docstring explaining the UTC vs local trap. The single offender in `useUpdateReflectionMutation` now calls it. A repo-wide grep confirmed no other `toISOString().slice(0, 10)` usages exist. `tsc --noEmit` clean.


## Context and Orientation


Project Radeon is a React Native / Expo client (TypeScript) that talks to a Go backend at `EXPO_PUBLIC_API_URL`. There is no global state library — `react-query` (via `@tanstack/react-query`) caches server data and React Context covers auth. All HTTP calls flow through `src/api/client.ts`; screens never call `fetch` directly.

The reflection feature today consists of these files:

    src/api/client.ts                                — getTodayReflection, upsertTodayReflection,
                                                       createReflection, listReflections, getReflection,
                                                       updateReflection, deleteReflection, shareReflection.
                                                       Type DailyReflection has fields id, user_id,
                                                       reflection_date (YYYY-MM-DD local string),
                                                       grateful_for, on_mind, blocking_today, body,
                                                       prompt_key, prompt_text, shared_post_id.
    src/hooks/queries/useReflections.ts              — useTodayReflection, useReflectionHistory(limit),
                                                       useReflection(id), useSaveTodayReflectionMutation
                                                       (currently UNUSED), useCreateReflectionMutation,
                                                       useUpdateReflectionMutation,
                                                       useDeleteReflectionMutation,
                                                       useShareReflectionMutation.
    src/query/queryKeys.ts                           — reflections() / todayReflection() /
                                                       reflectionHistory(limit) / reflection(id).
    src/screens/main/DailyReflectionScreen.tsx       — 1021-line monolith with views write | review |
                                                       history | detail. Two KeyboardAvoidingView
                                                       blocks (lines 309 and 617) using
                                                       behavior="translate-with-padding". Action dock
                                                       at position absolute / bottom: 0.
    src/screens/main/profile/ReflectionsTab.tsx      — Profile tab list of reflections (192 lines).
    src/utils/reflections.ts                         — REFLECTION_QUESTIONS labels, helpers.
    src/utils/date.ts                                — Date utilities. NO local-YYYY-MM-DD helper today.
    src/navigation/AppNavigator.tsx                  — Owns reflectionOpen / openReflectionId state and
                                                       the openSavedReflection / handleReflectionSaved
                                                       callbacks (lines 172-211).
    src/hooks/useGradualKeyboardInset.ts             — The "Beto pattern" hook: useKeyboardHandler from
                                                       react-native-keyboard-controller writes a Reanimated
                                                       shared value height each frame. Already wired into
                                                       CreatePostScreen.
    src/hooks/useCreatePostDrafts.ts                 — Reference implementation for drafts: AsyncStorage
                                                       under STORAGE_KEY_PREFIX = "drafts:create-post:",
                                                       debounced save at 300ms.

The "Beto pattern" (named after the author of the codewithbeto.dev blog post the team modeled it on): instead of wrapping the screen in `KeyboardAvoidingView`, render content normally and place an `Animated.View` at the bottom of the column whose `height` tracks `keyboardHeight + cushion` on the UI thread via a Reanimated shared value. The toolbar / action dock sits above this animated spacer and is pushed up as the spacer grows.

Definitions:

    "Action dock" — the bottom button bar (Review / Save / Delete / Share). Today it is
                    position: absolute, bottom: 0 inside KeyboardAvoidingView. After Milestone 1
                    it becomes a flex sibling above an animated spacer.
    "Hero"        — the small header block inside each view that shows the date label and
                    prompt title.
    "Reflection date" — a local-calendar YYYY-MM-DD string from the backend, NOT a UTC instant.
                        Misinterpreting it as UTC causes timezone bugs in early-morning hours.


## Plan of Work


Each milestone is independently shippable. Land them in a separate commit (or PR) so the diff stays narrow and reviewable.


### Milestone 1 — Keyboard pattern migration on `DailyReflectionScreen`


Goal: the action dock tracks the keyboard smoothly all the way to dismiss, matching the post composer.

Touch only `src/screens/main/DailyReflectionScreen.tsx`. Drop the import of `KeyboardAvoidingView` from `react-native-keyboard-controller`. In `ReflectionEditor` (around line 296) and `ReflectionDetailView` (around line 600), replace the `<KeyboardAvoidingView style={styles.keyboardView} behavior="translate-with-padding">` wrapper with a plain `<View style={styles.keyboardView}>` whose children are: the `ScrollView`, the action dock (now in flex flow, not absolute), and an `Animated.View` whose style comes from `useAnimatedStyle(() => ({ height: keyboardInset.height.value }))`.

Wire the hook at the screen level (or per view, but screen-level is simpler):

    import { useGradualKeyboardInset } from "../../hooks/useGradualKeyboardInset";
    import Animated, { useAnimatedStyle } from "react-native-reanimated";
    import { useSafeAreaInsets } from "react-native-safe-area-context";
    import { Spacing } from "../../theme";

    const insets = useSafeAreaInsets();
    const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
    const { height: keyboardInset } = useGradualKeyboardInset({
        closedHeight: bottomSafeSpace,
        openedOffset: Spacing.sm,
    });
    const spacerStyle = useAnimatedStyle((): { height: number } => ({
        height: keyboardInset.value,
    }));

In the styles, remove the `position: 'absolute'` / `left: 0 / right: 0 / bottom: 0` from `actionDock`, and remove the `paddingBottom: 156` cushion from `writeContent` / `detailContent` / `reviewContent` — that padding only exists today to clear the absolute dock.

On the `<ScrollView>` inside the editor and detail view, add the iOS auto-inset disabling props that `ComposerCanvas` already uses (otherwise iOS's native keyboard auto-content-inset competes with the Reanimated worklet and the scroll position jumps):

    automaticallyAdjustContentInsets={false}
    automaticallyAdjustKeyboardInsets={false}
    contentInsetAdjustmentBehavior="never"

Keep `keyboardShouldPersistTaps="handled"` and add `keyboardDismissMode="interactive"` to the editor's ScrollView so swipe-to-dismiss tracks the finger smoothly.

For the multi-input scroll-into-view issue (the editor has three multiline fields stacked; tapping the third can leave the caret behind the dock), accept it as a known limitation in this milestone and address it in Milestone 5 once the editor is its own file with a `ScrollView` ref. Do not bolt it on here.

Acceptance: open the editor, raise the keyboard, swipe-to-dismiss — the dock follows the finger 1:1 down to rest. Without this milestone, the dock visibly stops short ~26px above its rest position while the keyboard finishes closing.


### Milestone 2 — Today-reflection awareness


Goal: opening the reflection feature when one already exists for today goes to detail view, not blank editor; saving today uses upsert, so re-saving updates in place.

Edit `src/screens/main/DailyReflectionScreen.tsx`:

  - Add `useTodayReflection` to the imports from `../../hooks/queries/useReflections`.
  - In the screen body, fire `const todayQuery = useTodayReflection(isActive && !initialReflectionId);`. The `!initialReflectionId` gate ensures we don't override an explicit "open this saved one" navigation.
  - Add a `useEffect` that, when `todayQuery.data` arrives, sets `selectedReflection` to it, sets `detailBackCloses` to true, and switches `view` to `'detail'` — but only if `view === 'write'` and the user has not started typing (check `composedBody.length === 0`).
  - Replace `useCreateReflectionMutation` with `useSaveTodayReflectionMutation` for the save path inside `handleConfirmSave`. The hook already exists in `src/hooks/queries/useReflections.ts:34` and is currently unused; verify its onSuccess updates both `queryKeys.todayReflection()` and invalidates `queryKeys.reflections()`. Adjust if needed.
  - The `createReflection` API stays available for future "back-fill an old day" flows but is no longer the primary path.

Edit `src/hooks/queries/useReflections.ts`:

  - Confirm `useSaveTodayReflectionMutation` already calls `setQueryData(queryKeys.todayReflection(), reflection)` and invalidates `reflections()`. If not, add it.

Acceptance: open the reflection feature, write and save. Close it. Re-open from the same entry point — the screen lands directly on the detail view of today's reflection. Edit and save — the reflection updates in place; no second row appears in history.


### Milestone 3 — Local-date helper and timezone fix


Goal: editing a reflection in the user's early-morning hours correctly identifies it as today, not a different UTC day.

Edit `src/utils/date.ts`. Add an exported helper:

    export function getLocalDateString(date: Date = new Date()): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

Edit `src/hooks/queries/useReflections.ts`. In `useUpdateReflectionMutation` `onSuccess` (currently line 76), replace:

    if (reflection.reflection_date === new Date().toISOString().slice(0, 10)) {

with:

    if (reflection.reflection_date === getLocalDateString()) {

(import `getLocalDateString` from `'../../utils/date'`). Audit the rest of the file and any reflection-related code for the same `.toISOString().slice(0, 10)` pattern and replace.

Acceptance: at 1:00 AM local time (where local date and UTC date disagree), edit today's reflection; the today cache (`queryKeys.todayReflection()`) updates correctly. The pre-fix bug is invisible during normal-hour testing — to verify, set the device clock manually or mock `Date` in a unit test if one is added.


### Milestone 4 — Unified history cache key


Goal: `ReflectionsTab` (Profile) and `ReflectionHistoryView` (DailyReflectionScreen history) share their cache, so opening one warms the other.

Both call `useReflectionHistory(limit, ...)` but with different limits (20 and 18). The query key today is `['reflections', 'history', { limit }]`, which means different limits produce separate caches.

Edit `src/screens/main/DailyReflectionScreen.tsx` — change `useReflectionHistory(18, ...)` to `useReflectionHistory(20, ...)`. Page size of 20 matches what the profile tab requests; choosing the same value across the app is sufficient.

Optional follow-up if you want truly shared cache regardless of `limit`: edit `src/query/queryKeys.ts` to drop `{ limit }` from the key (`reflectionHistory: () => ['reflections', 'history'] as const`) and pass limit only as a `queryFn` parameter. Defer this unless it becomes necessary.

Acceptance: in React Query devtools (or via observable behavior), opening the history view inside `DailyReflectionScreen` does not trigger a refetch if `ReflectionsTab` was visited within `staleTime` (30 seconds today). Both surfaces show the same first page without independent network calls.


### Milestone 5 — File split and `useReflectionForm`


Goal: `DailyReflectionScreen.tsx` becomes a slim shell (target under 200 lines) that routes between separately-defined view components in `src/screens/main/reflection/`. The doubled form state collapses into a single hook.

Create the directory `src/screens/main/reflection/` and the following files. Each new file should declare explicit return types on every exported function (`React.ReactElement`) and on internal helpers — a CLAUDE.md requirement that the current monolith violates.

    src/screens/main/reflection/ReflectionEditor.tsx        — write view (compose three prompts +
                                                              dock with Review button).
    src/screens/main/reflection/ReflectionReviewView.tsx    — review view (read-only preview +
                                                              dock with Edit/Save).
    src/screens/main/reflection/ReflectionDetailView.tsx    — saved view (editable three prompts +
                                                              dock with Delete/Share/Save).
    src/screens/main/reflection/ReflectionHistoryView.tsx   — grouped-by-month list of reflections.
    src/screens/main/reflection/ReflectionPromptFields.tsx  — shared 3-input form used by editor
                                                              and detail.
    src/screens/main/reflection/ReflectionField.tsx         — single labeled multiline field.
    src/screens/main/reflection/utils.ts                    — composeReflectionBody, getGratefulFor,
                                                              getOnMind, getBlockingToday,
                                                              groupReflectionsByMonth.

`DailyReflectionScreen.tsx` keeps the `ReflectionView` type and the view-routing switch but imports the children from the new directory.

Create `src/hooks/useReflectionForm.ts` with this shape:

    export interface ReflectionFormValues {
        gratefulFor: string;
        onMind: string;
        blockingToday: string;
    }

    export interface UseReflectionFormResult {
        values: ReflectionFormValues;
        setField: (field: keyof ReflectionFormValues, value: string) => void;
        reset: (next?: ReflectionFormValues) => void;
        composedBody: string;        // memoized join of non-empty fields with REFLECTION_QUESTIONS labels
        isDirty: boolean;             // true if any field differs from the initial seed
        isEmpty: boolean;             // true if all fields are blank
    }

    export function useReflectionForm(
        initial: ReflectionFormValues = { gratefulFor: '', onMind: '', blockingToday: '' },
    ): UseReflectionFormResult;

Use it twice in the screen — once seeded with `''` for the editor, once seeded from `selectedReflection` for the detail view. The current `useEffect` that copies a selected reflection into the detail buffer (today around line 81-86) is replaced by passing `getReflectionAnswerEntries(selectedReflection)` into `useReflectionForm`'s reset method when `selectedReflection` changes.

Extract the back-button logic out of the nested ternary at lines 216-220 into a helper inside `DailyReflectionScreen.tsx` or in `utils.ts`:

    function getBackHandler(view: ReflectionView, detailBackCloses: boolean,
                            onBack: () => void, setView: (v: ReflectionView) => void): () => void {
        switch (view) {
            case 'detail':  return detailBackCloses ? onBack : () => setView('history');
            case 'review':
            case 'history': return () => setView('write');
            case 'write':   return onBack;
        }
    }

Acceptance: a contributor can read each new file in under a minute. `DailyReflectionScreen.tsx` is comfortably below 200 lines. Behavior is unchanged: the test plan is "do nothing differently from Milestone 1" — same keyboard behavior, same save flow, same history view, but in fewer lines per file.


### Milestone 6 — Drafts with debounced autosave


Goal: a user mid-write whose app force-quits or crashes recovers their text on next open.

Create `src/hooks/useReflectionDraft.ts`, modeled on `src/hooks/useCreatePostDrafts.ts` but simpler (only ever one in-flight today draft per user, not a list). Storage key: `drafts:reflection:{userId}:{localDate}`. Debounce: 300ms (match the post composer).

    export interface ReflectionDraft {
        gratefulFor: string;
        onMind: string;
        blockingToday: string;
        updatedAt: number;
    }

    export interface UseReflectionDraftResult {
        draft: ReflectionDraft | null;        // hydrated draft from storage, or null
        isHydrated: boolean;                   // true once initial AsyncStorage read completes
        save: (values: ReflectionDraft) => void;     // debounced
        clear: () => Promise<void>;            // call on successful save
    }

    export function useReflectionDraft(userId: string | null): UseReflectionDraftResult;

Wire into `ReflectionEditor`: after `useReflectionForm` is initialized, on hydrate, if a draft exists and `useTodayReflection` returns null, seed the form from the draft. On every `setField`, call `save({ ...values, updatedAt: Date.now() })`. On `handleConfirmSave` success, call `clear()`. On `handleBack` with empty composedBody, also `clear()`. On `handleBack` with non-empty content, leave the draft in storage so it's recovered next time.

Show a small "Recovered from draft" banner the first time a draft is loaded so the user understands why their text is there. Hide on first edit.

Acceptance: open the editor, type three sentences across all fields, force-quit the app (or kill the simulator), reopen — the editor opens in write mode pre-populated with the typed text and a banner. Save successfully — the banner disappears and the next open lands on detail view (Milestone 2 behavior).


### Milestone 7 — Streaks on the profile tab


Goal: the Profile → Reflections tab shows a streak count above the list ("7 days in a row"), reinforcing daily journaling.

Add a helper to `src/utils/reflections.ts`:

    export function computeReflectionStreak(
        items: api.DailyReflection[],
        today: string = getLocalDateString(),
    ): number;

Logic: sort items descending by `reflection_date`; if the most recent date is today or yesterday, count consecutive prior days backward (each day must equal previousDay - 1). Stop at the first gap. Return the count. Treat "yesterday" as eligible so a user who has not yet journaled today still sees their current streak.

Edit `src/screens/main/profile/ReflectionsTab.tsx` — render a streak header above the list when `reflections.length > 0`:

    <View style={styles.streakBanner}>
        <Ionicons name="flame" size={18} color={Colors.primary} />
        <Text style={styles.streakText}>{streakLabel(streak)}</Text>
    </View>

with `streakLabel(n)` rendering "Start your streak today" for `n === 0`, "1 day" for `n === 1`, and "{n} days in a row" otherwise. Compute streak as `useMemo(() => computeReflectionStreak(reflections), [reflections])`.

Document the limitation (see Decision Log): if the user's streak exceeds the first page (20 items today), the on-screen streak under-reports. Note this and treat it as acceptable for v1; if real users exceed 20 days, escalate to a server-side counter.

Acceptance: write a reflection on three consecutive days (or seed via an admin tool if available); the Reflections tab shows "3 days in a row." Skip a day, write again — streak resets to "1 day".


## Concrete Steps


All commands run from the repository root: `/home/michaelroddy/repos/project_radeon_app`.

Setup (once, if not already done):

    npm install

Per-milestone iteration:

    # Edit files as described in Plan of Work for the current milestone.
    npx expo start    # dev server; press i for iOS sim, a for Android, w for web

Type-check after each milestone (no dedicated lint or test command is configured in this repo, per CLAUDE.md):

    npx tsc --noEmit

Expect zero errors. If `tsc` reports new errors after a milestone, fix before moving on.

Commit per milestone with a message in the project's existing style (short imperative title, optional body):

    git add <files>
    git commit -m "Migrate reflection screen to gradual keyboard inset"
    # ...continue per milestone with appropriately-scoped titles.

When all milestones land and the branch is ready for review, push:

    git push -u origin feature/reflections-refactor-execplan

Open a PR against `main`. The PR description should reference this ExecPlan and summarize the milestone list with their completion timestamps from the Progress section.


## Validation and Acceptance


Behavior to verify in a running app (iOS simulator is fine; Android emulator is recommended for the keyboard work since Android's keyboard timing differs from iOS):

  1. Keyboard close: open the editor, raise the keyboard, swipe down to dismiss. The action dock should track the finger continuously to its rest position. Without Milestone 1, the dock parks ~26px above rest and the keyboard finishes closing under it.

  2. Today awareness: write and save a reflection. Close the screen entirely. Re-open from the same entry point (the reflection button in `AppNavigator`). The screen should land on the detail view of today's reflection — not a blank editor. Without Milestone 2, the second open creates a duplicate row.

  3. Timezone correctness: hard to verify manually outside the early-morning window. Add a unit test if you wire up Jest later, or visually confirm the today cache stays correct after editing. Without Milestone 3, edits between local-midnight and UTC-midnight may fail to update the today cache.

  4. Cache sharing: open the Profile → Reflections tab, then open the in-app history view. Network panel should show no second `GET /reflections?limit=20` within 30 seconds of the first. Without Milestone 4, both surfaces fetch independently.

  5. File split: `wc -l src/screens/main/DailyReflectionScreen.tsx` reports under 200. Each new file in `src/screens/main/reflection/` is under 200. `tsc --noEmit` is clean.

  6. Drafts: open editor, type, force-quit the simulator (Cmd+Shift+H twice on iOS sim, swipe up). Re-open the app and the screen — the editor pre-populates with the typed text and shows a "Recovered from draft" banner. Save — banner disappears; next open lands on detail.

  7. Streak: with three consecutive days of reflections (today, yesterday, day before), Profile → Reflections tab shows "3 days in a row." Delete yesterday's reflection — streak drops to "1 day".

There are no automated tests configured in this repository (per `CLAUDE.md`). All validation is manual + `tsc --noEmit`.


## Idempotence and Recovery


Every milestone is additive and reversible by `git revert`. If a milestone is interrupted partway:

  - For Milestone 1: the screen's two `KeyboardAvoidingView` wrappers can coexist with the new pattern temporarily (e.g. migrate `ReflectionEditor` first, leave `ReflectionDetailView` for a later commit). Each can be tested independently.

  - For Milestone 5 (file split): land the new files first as additive copies; cut over `DailyReflectionScreen.tsx` imports last. If the cutover fails to compile, the originals are still in the file's history.

  - For Milestone 6 (drafts): `AsyncStorage` writes are best-effort. If the storage read fails (e.g. corrupted JSON), `useReflectionDraft` should swallow the error and return `draft: null`. Do not crash the screen on hydrate failure.

If the entire branch needs to roll back: `git checkout main` and `git push -d origin feature/reflections-refactor-execplan` once merged work has been verified to deliver the milestones intended. Until merge, the branch is local + remote and can be safely deleted.


## Artifacts and Notes


Reference snippets the implementer can copy/adapt.

Beto-pattern wiring at the top of `ReflectionEditor`:

    import Animated, { useAnimatedStyle } from 'react-native-reanimated';
    import { useSafeAreaInsets } from 'react-native-safe-area-context';
    import { useGradualKeyboardInset } from '../../hooks/useGradualKeyboardInset';
    import { Spacing } from '../../theme';

    const insets = useSafeAreaInsets();
    const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
    const { height: keyboardInset } = useGradualKeyboardInset({
        closedHeight: bottomSafeSpace,
        openedOffset: Spacing.sm,
    });
    const spacerStyle = useAnimatedStyle((): { height: number } => ({
        height: keyboardInset.value,
    }));

JSX skeleton replacing the KAV in editor and detail:

    <View style={styles.keyboardView}>
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.writeContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustContentInsets={false}
            automaticallyAdjustKeyboardInsets={false}
            contentInsetAdjustmentBehavior="never"
        >
            {/* hero + ReflectionPromptFields */}
        </ScrollView>
        <View style={styles.actionDock}>
            {/* dock buttons */}
        </View>
        <Animated.View style={spacerStyle} />
    </View>

Streak helper sketch (Milestone 7):

    export function computeReflectionStreak(
        items: api.DailyReflection[],
        today: string = getLocalDateString(),
    ): number {
        if (items.length === 0) return 0;
        const sorted = [...items].sort((a, b) =>
            b.reflection_date.localeCompare(a.reflection_date),
        );
        const yesterday = shiftLocalDate(today, -1);
        if (sorted[0].reflection_date !== today &&
            sorted[0].reflection_date !== yesterday) return 0;
        let streak = 1;
        let cursor = sorted[0].reflection_date;
        for (let i = 1; i < sorted.length; i++) {
            const expectedPrev = shiftLocalDate(cursor, -1);
            if (sorted[i].reflection_date !== expectedPrev) break;
            cursor = expectedPrev;
            streak++;
        }
        return streak;
    }

`shiftLocalDate` is a small helper that adds n days to a YYYY-MM-DD string in local-calendar terms. Add it to `src/utils/date.ts` alongside `getLocalDateString` if not already present.


## Interfaces and Dependencies


Libraries already present (no new installs required):

  - `react-native-keyboard-controller` — provides `useKeyboardHandler` consumed by `useGradualKeyboardInset`. Mounted globally via `KeyboardProvider` in `App.tsx`.
  - `react-native-reanimated` — provides `useSharedValue`, `useAnimatedStyle`. Worklet-based UI-thread animation.
  - `@tanstack/react-query` — server-state caching. Persisted via `@tanstack/react-query-persist-client` in `App.tsx`.
  - `@react-native-async-storage/async-storage` — used by `useCreatePostDrafts`; reuse for `useReflectionDraft`.

Hooks introduced or repurposed by this plan:

  - `useReflectionForm(initial?: ReflectionFormValues): UseReflectionFormResult` — new, replaces the doubled `gratefulFor` / `detailGratefulFor` state pairs.
  - `useReflectionDraft(userId: string | null): UseReflectionDraftResult` — new, mirrors `useCreatePostDrafts` for the editor.
  - `useTodayReflection(enabled)` — already exists; newly wired into `DailyReflectionScreen`.
  - `useSaveTodayReflectionMutation()` — already exists, currently dead code; becomes the editor's save path.

Utilities introduced:

  - `getLocalDateString(date?: Date): string` in `src/utils/date.ts`.
  - `shiftLocalDate(date: string, days: number): string` in `src/utils/date.ts` (Milestone 7).
  - `computeReflectionStreak(items, today?): number` in `src/utils/reflections.ts` (Milestone 7).

API surface from `src/api/client.ts` is unchanged; this refactor is client-side only.


## Future Work (out of scope for this plan)


Document but do not implement here. Each becomes its own ExecPlan when prioritized.

  - Drop the explicit "Review" step in favor of instant save with always-editing detail. Pure UX call; depends on user-testing and product preference.
  - Calendar / heatmap month view replacing the grouped list.
  - Cross-entry full-text search; requires a backend `GET /reflections?q=` parameter.
  - Mood / tag metadata per reflection.
  - Server-side streak endpoint for users with streaks longer than one page.
  - Ramp-up: prefetch a tapped reflection in the navigator so detail view opens instantly instead of with a spinner.
  - Skeleton component for the detail-view loading state.


## Revision Log


  - 2026-05-02 — Initial plan authored. Scope: 7 milestones covering keyboard parity, correctness fixes, structural refactor, drafts, and streaks. Future-work items recorded but not scheduled.
