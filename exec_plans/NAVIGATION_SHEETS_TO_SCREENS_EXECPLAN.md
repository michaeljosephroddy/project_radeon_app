# Navigation Sheets To Screens ExecPlan

## Goal

Move sheet-like and modal-like app surfaces that represent real workflows into React Navigation screens. Keep true alerts as modal UI. Fix create-route exits so focused inputs dismiss before native route transitions reveal the tab bar.

## Scope

- Add keyboard-safe navigation exit helpers.
- Convert the create menu from a transparent modal into a normal screen.
- Convert discover, meetup, and recovery meeting filters from React Native modals into navigation screens.
- Convert the dating prompt picker from a React Native modal into a screen inside the dating profile editor stack.

## Implementation Steps

1. Add keyboard-safe navigation helpers and use them for create route back/success handlers.
2. Change `CreateMenu` from `transparentModal` to a standard stack screen with full-screen styling.
3. Add root stack routes for `DiscoverFilters`, `MeetupFilters`, and `RecoveryMeetingFilters`.
4. Refactor filter components so they render screen content directly instead of owning `Modal`.
5. Wire route-level filter state through lightweight module stores so screens can apply/cancel without passing callbacks in route params.
6. Add a dating prompt picker route backed by the existing dating profile edit session state.
7. Run `npm run typecheck`.

## Validation

- Open and close the create menu.
- Close create post/group/support/meetup with keyboard open.
- Open, reset, apply, and cancel Discover filters.
- Open, reset, apply, and cancel Meetup filters.
- Open, reset, apply, and cancel Recovery Meeting filters.
- Add a dating prompt and return to the profile editor.
- Confirm the tab bar does not glitch after keyboard dismissal.

## Rollback

Revert the route additions and restore the previous modal component usage. The filter component refactors should preserve the original props and behavior, so rollback is isolated to screen wrappers and navigation wiring.
