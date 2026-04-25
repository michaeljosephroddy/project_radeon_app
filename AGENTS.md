# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npx expo start       # Start Expo dev server
npx run:ios          # Run in iOS simulator
npx run:android      # Run in Android emulator
npx run:web          # Run in web browser
```

No dedicated test or lint commands are configured.

### API URL configuration

Set the backend URL via environment variable:

```bash
# .env
EXPO_PUBLIC_API_URL=http://192.168.8.14:8080
```

Platform-specific defaults when the env var is unset:
- **Android emulator**: `http://10.0.2.2:8080`
- **iOS simulator / web**: `http://localhost:8080`

## Architecture

Project Radeon is a React Native/Expo app for a sober social community. It is a frontend that communicates with a Go backend at `EXPO_PUBLIC_API_URL`.

### Layer overview

```
Screens → useAuth hook / API client → Go backend
                ↓
     expo-secure-store (encrypted token)
```

**`src/api/client.ts`** — Single API module. All network calls go here. The base `request()` function injects the auth token, handles errors, and expects `{ data: T }` responses. Screens never call `fetch` directly.

**`src/hooks/useAuth.tsx`** — React Context that holds global auth state (`user`, `isAuthenticated`, `isLoading`). Restores session from encrypted storage on app launch. All screens consume this via `useAuth()`.

**`src/navigation/`** — Two navigators:
- `AuthNavigator`: Shows Login or Register based on auth state.
- `AppNavigator`: Tab-based main app (feed, people, meetups, chats). Tabs use a custom indicator rather than React Navigation's default tab bar. Chat drill-down and the ProfileSheet modal are managed here, not via stack navigation.

**`src/screens/`** — Each screen is self-contained: owns its local state, fetches its own data, and calls API client functions directly. Navigation uses callbacks passed as props rather than React Navigation's `navigation.push`.

**`src/components/`** — Shared UI: `Avatar` (initials + deterministic color from name hash), `ProfileSheet`, `ConnectionSheet`.

**`src/utils/theme.ts`** — Screen-facing theme entry point and compatibility shim over `src/theme/*`, which holds the authoritative design tokens (current primary `#0d6efd`), typography, spacing, border radii, avatar palette, and helpers (`getInitials`, `getAvatarColors`, `timeAgo`).

### Key patterns

- **No external state library** — React Context + hooks only.
- **Callback-based navigation** — screens receive `onPress`/`onClose` props; AppNavigator owns chat and sheet state.
- **Optimistic updates** — some actions (e.g., likes) update local state before the API responds.
- **Path alias** — `@/*` maps to `src/*` (configured in `tsconfig.json` and Babel).

---

## Coding standards

### TypeScript

- Always use explicit types for function parameters and return values. Avoid `any` — use `unknown` and narrow it, or define a proper interface.
- Define shared types in `src/api/client.ts` alongside the API functions that return them. Never inline ad-hoc object shapes across multiple files.
- Use `interface` for object shapes that describe data (API responses, props). Use `type` for unions, intersections, and aliases.
- Props interfaces are named after the component: `interface ProfileScreenProps`, not `interface Props` unless the file has only one component.
- Never use non-null assertion (`!`) unless the value is genuinely guaranteed non-null at that point. Prefer optional chaining (`?.`) and nullish coalescing (`??`).

### Components

- One component per file. File name matches the component name exactly (`ProfileScreen.tsx` exports `ProfileScreen`).
- Keep components focused. If a component exceeds ~150 lines, consider extracting sub-components or moving logic into a custom hook.
- Extract repeated JSX patterns (3+ uses) into a shared component in `src/components/`. Don't duplicate layout or styling inline.
- All shared UI goes in `src/components/`. Screen-specific sub-components can live in the same screen file if they are small and not reused elsewhere.
- Avoid inline styles (`style={{ marginTop: 8 }}`). All styles live in the `StyleSheet.create` block at the bottom of the file, using design tokens from `src/utils/theme.ts`.

### Hooks and state

- Extract non-trivial data-fetching or business logic into a custom hook (`useChats`, `useProfile`) rather than bloating a screen component.
- Co-locate state as close to where it is used as possible. Only lift state up when two or more siblings need it.
- Clean up side effects: every `useEffect` that sets up a subscription, timer, or listener must return a cleanup function.
- Never call hooks conditionally or inside loops.

### API client

- All network calls go through `src/api/client.ts`. Screens and hooks import from there — they never call `fetch` directly.
- Each API function has an explicit TypeScript return type matching the backend response shape.
- Add new endpoints in the same grouping pattern already in the file (Auth, Users, Feed, Connections, Meetups, Chats, Interests).

### Styling

- All colours, font sizes, spacing values, and border radii come from `src/utils/theme.ts`. Never hardcode `#hex`, `px`, or magic numbers in a component file, except for truly one-off values that have no semantic meaning.
- Use `StyleSheet.create` for every style block — never pass plain objects as style props.
- Safe area handling: use `SafeAreaView` with explicit `edges` rather than hardcoded padding. Top edge is handled by `AppNavigator`; screens that replace the tab bar (chat, profile) must handle the bottom edge themselves.

### Error handling

- Catch errors at the call site and show user-facing feedback (`Alert.alert`) for actions the user triggered. Silent `catch {}` is acceptable only for background refreshes where failure is non-critical.
- Never swallow errors in API client functions — let them throw so callers can decide how to handle them.

### File and folder organisation

```
src/
  api/          # client.ts only — all fetch calls and shared types
  components/   # reusable UI components
  hooks/        # custom hooks (useAuth, and future data hooks)
  navigation/   # AppNavigator, AuthNavigator
  screens/
    auth/       # Login, Register
    main/       # Feed, People, Meetups, Chats, Chat, Profile
  utils/        # theme.ts and any pure utility functions
```

- Don't create new top-level folders without a clear reason. Fit new code into the existing structure first.
- Group by feature/layer, not by file type. Don't create a `types/` folder — types live next to the code that uses them.

### General

- Prefer early returns to deeply nested conditionals.
- Remove dead code, commented-out blocks, and unused imports before considering a task done.
- Don't add comments that restate what the code does. Only comment on non-obvious *why*, not *what*.
- Keep functions small and single-purpose. If a function needs a comment to explain what it does, it should probably be split or renamed.

### Workflow
- Always plan before writing code
- Present a plan and wait for approval before implementing
- Break tasks into steps and confirm each one

### ExecPlans

- When writing complex features or significant refactors, use an ExecPlan (as described in PLANS.md) from design to implementation.
- ExecPlan files live in `exec_plans/` — create new ones there, not in the project root.
