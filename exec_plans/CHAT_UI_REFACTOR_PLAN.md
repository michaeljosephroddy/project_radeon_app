# Refactor chat layout for instant keyboard snapping and stable list rendering

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with [PLANS.md](PLANS.md).

## Purpose / Big Picture

The chat screen currently moves with visual transforms when the keyboard opens. That makes the interface feel soft and inaccurate because the thread viewport does not actually resize; only the pixels move. After this refactor, the composer will snap to the keyboard, the message list will reserve real layout space for the keyboard and composer, and the screen will only auto-scroll when there is actual overflow that would otherwise hide messages. The observable result is that opening the keyboard in a short conversation leaves the messages fixed at the top, while opening it in a long conversation immediately keeps the latest messages visible without sliding the whole screen.

## Progress

- [x] (2026-04-21 11:05Z) Audited `src/screens/main/ChatScreen.tsx`, `src/screens/main/chat/MessageThreadList.tsx`, `src/screens/main/chat/MessageComposerDock.tsx`, `src/screens/main/chat/useKeyboardInsetAnimation.ts`, and `src/screens/main/ChatsScreen.tsx`.
- [x] (2026-04-21 11:18Z) Created the branch `chat-performance-refactor`.
- [x] (2026-04-21 11:28Z) Designed the replacement architecture: keyboard metrics hook, absolute composer dock, and list bottom inset derived from real layout values instead of transforms.
- [x] (2026-04-21 11:54Z) Implemented the new chat container, composer, and thread list behavior with layout-based keyboard handling.
- [x] (2026-04-21 11:58Z) Ran `npx tsc --noEmit` successfully and inspected the diff for removed transform-based files and new keyboard viewport logic.

## Surprises & Discoveries

- Observation: `FlashList` is not available in `package.json`, so this refactor needs to stay within the existing dependency set unless a new package install is approved separately.
  Evidence: `package.json` only lists React Native core list tooling.

- Observation: The current chat keyboard behavior is driven by `react-native-reanimated` transforms rather than layout changes, which means the measured list viewport does not match the visible viewport during keyboard transitions.
  Evidence: `src/screens/main/chat/useKeyboardInsetAnimation.ts` applies `translateY` to both the thread and composer.

## Decision Log

- Decision: Keep the refactor within the existing dependency set and optimize `FlatList` instead of adding `FlashList`.
  Rationale: The repository does not currently include `FlashList`, and the requested behavior can be achieved with better layout ownership and a stable `FlatList` configuration.
  Date/Author: 2026-04-21 / Codex

- Decision: Move the draft state into the composer component.
  Rationale: Typing should not re-render the parent chat container or cause extra work in the message list subtree.
  Date/Author: 2026-04-21 / Codex

- Decision: Replace transform-based keyboard motion with a keyboard overlap value derived from native keyboard events and safe-area math.
  Rationale: The interface needs mechanical snapping, not animation, and the list needs real geometry in order to make correct overflow decisions.
  Date/Author: 2026-04-21 / Codex

## Outcomes & Retrospective

The refactor replaced transform-based keyboard motion with real layout math. `ChatScreen` now measures the composer, derives a bottom inset from `composerHeight + keyboardOverlap`, and gives that value to the thread list so the visible viewport changes immediately when the keyboard opens. The composer now owns its own draft state, which keeps typing work out of the parent screen. `MessageThreadList` keeps scroll preservation for prepends, snaps to the latest message only when the user is already near the bottom, and uses a more aggressive `FlatList` configuration for chat workloads. TypeScript validation passed, but manual device validation is still needed to confirm the final feel on both iOS and Android keyboards.

## Context and Orientation

`src/navigation/AppNavigator.tsx` renders `ChatScreen` as an absolute overlay above the tab content. `src/screens/main/ChatScreen.tsx` is the screen container. `src/screens/main/chat/useChatThreadController.ts` owns message fetch and optimistic send state. `src/screens/main/chat/MessageThreadList.tsx` renders the thread and manages scroll behavior. `src/screens/main/chat/MessageComposerDock.tsx` renders the input area. The current code also includes `src/screens/main/chat/useKeyboardInsetAnimation.ts` and `src/screens/main/chat/ChatBody.tsx`, which were introduced to move the UI with transforms rather than by resizing layout.

In this repository, “bottom inset” means the amount of vertical space the list must reserve at its bottom so content is not covered by an overlay. After the refactor, the bottom inset is defined as the measured composer height plus the current keyboard overlap. “Keyboard overlap” means the visible height of the keyboard above the safe area at the bottom of the screen.

## Plan of Work

Update `src/screens/main/ChatScreen.tsx` so it owns keyboard overlap state, measures the composer height, and renders the thread list and composer in a single relative layout. Add a new hook in `src/screens/main/chat/useKeyboardViewport.ts` that listens to keyboard events and returns a discrete overlap value. Rewrite `src/screens/main/chat/MessageComposerDock.tsx` so it owns its draft state, reports its measured height upward, and sends messages without dismissing the keyboard. Rewrite `src/screens/main/chat/MessageThreadList.tsx` to reserve bottom space with `contentContainerStyle`, preserve offset when prepending older messages, and snap to the latest message only when the user is already near the bottom. Update `src/screens/main/chat/useChatThreadController.ts` to remove keyboard dismissal and expose retryable load errors. Remove the obsolete transform-based files once `ChatScreen` no longer depends on them. Make a small callback-stability cleanup in `src/screens/main/ChatsScreen.tsx` while the chat review context is open.

## Concrete Steps

From `/home/michaelroddy/repos/project_radeon_app`:

1. Create the working branch.
   Expected transcript:

       $ git checkout -b chat-performance-refactor
       Switched to a new branch 'chat-performance-refactor'

2. Edit the chat container, hook, composer, controller, and thread list modules to use layout-based keyboard handling.

3. Run TypeScript validation.
   Expected transcript:

       $ npx tsc --noEmit
       [no output on success]

4. Inspect the diff to confirm the obsolete transform files were removed and the chat screen now uses layout-based insets.

## Validation and Acceptance

Run `npx tsc --noEmit` in `/home/michaelroddy/repos/project_radeon_app` and expect no TypeScript errors. Start the app with `npx expo start`, open a chat with only a few messages, focus the composer, and verify that the header stays fixed, the composer jumps directly above the keyboard, and the short message list remains static at the top instead of sliding upward. Open a chat with enough messages to overflow, focus the composer, and verify that the latest messages remain visible above the composer without a sliding animation. Send a message while the keyboard is open and verify that the composer stays focused and the thread updates without the whole screen re-rendering visually.

## Idempotence and Recovery

These edits are additive and safe to repeat. Re-running `npx tsc --noEmit` is harmless. If the layout refactor introduces regressions, the safe rollback is to revert only the chat-related files changed on the `chat-performance-refactor` branch; no database or environment changes are involved.

## Artifacts and Notes

The final diff should show the removal of `src/screens/main/chat/useKeyboardInsetAnimation.ts` and `src/screens/main/chat/ChatBody.tsx`, plus a new `src/screens/main/chat/useKeyboardViewport.ts`.

## Interfaces and Dependencies

In `src/screens/main/chat/useKeyboardViewport.ts`, define:

    export function useKeyboardViewport(bottomInset: number): number;

This function must return the keyboard overlap above the safe area.

In `src/screens/main/chat/MessageThreadList.tsx`, define:

    export interface MessageThreadListHandle {
        snapToLatest(animated?: boolean): void;
    }

The thread list must accept a numeric `bottomInset` prop and reserve that space in its `contentContainerStyle`.

In `src/screens/main/chat/MessageComposerDock.tsx`, define props that include:

    sending: boolean;
    recipientLabel: string;
    keyboardOffset: number;
    safeAreaBottomInset: number;
    onHeightChange: (height: number) => void;
    onSendMessage: (body: string) => Promise<void>;

Revision note: Updated after implementation and TypeScript validation to capture the final architecture and current validation status.
