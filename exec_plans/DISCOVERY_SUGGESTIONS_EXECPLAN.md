# Ranked User Suggestions in the Discover Screen

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Right now the Discover screen shows a flat, unordered list of community members. After this change, the existing 2-column card grid is driven by a five-signal ranking algorithm: users who are nearby, share interests, have mutual connections, are at a similar sobriety milestone, and have been recently active appear first. Pagination is unchanged (20 users per page). A "People you might know" heading sits above the grid when not searching. When a search query is active the original username-match ordering is preserved. The net effect is that the default browse view surfaces the most relevant people rather than a cold undifferentiated list, with no change to the UI layout users already know.

The ranking runs entirely in the backend (Go service at `EXPO_PUBLIC_API_URL`) inside the existing `GET /users/discover` endpoint. The frontend passes device coordinates alongside the existing filters and renders results as before.

## Progress

- [x] (2026-04-24) Add five-signal ranking to `GET /users/discover` in Go backend (search path unchanged).
- [x] (2026-04-24) Add `migration 026_user_coordinates.sql` — `lat`/`lng` columns on `users` table.
- [x] (2026-04-24) Update `UpdateUser` (store + handler + interface + tests) to persist `lat`/`lng`.
- [x] (2026-04-24) Update `LocationStep` to save device coordinates when onboarding.
- [x] (2026-04-24) Add `lat`/`lng` params to `discoverUsers` API function and `useDiscover` hook.
- [x] (2026-04-24) Add device location fetch utility `src/utils/location.ts`.
- [x] (2026-04-24) Wire device coords into `DiscoverScreen`, pass to `useDiscover`.
- [x] (2026-04-24) Add "People you might know" heading above grid in non-search view.
- [x] (2026-04-24) Reorder signal weights: distance 0.30, interests 0.25, mutuals 0.20, milestone 0.15, recency 0.10.
- [x] (2026-04-24) Validate end-to-end: ranked grid renders, location permission prompt fires once, pagination consistent.

## Surprises & Discoveries

_Nothing recorded yet._

## Decision Log

- Decision: Score computation belongs in the backend, not the frontend.
  Rationale: Scoring requires data the frontend does not have (mutual connection counts, last-active timestamps, full interest lists of other users). Doing it server-side also means the algorithm can improve without a client release.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Ranking is merged into the existing `GET /users/discover` endpoint, not a separate `/users/suggestions` endpoint.
  Rationale: A separate endpoint would duplicate the "get users" codepath and require the frontend to choose between endpoints by context. Merging keeps one source of truth — when a search query is present, username-match ordering is used; when browsing, the scoring query runs. A `/users/suggestions` endpoint was prototyped and then removed in favour of this approach.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: The ranked results replace the separate horizontal strip. The existing 2-column grid is used as-is.
  Rationale: The strip was a separate scroll area that added UI complexity and duplicated state. Driving the existing grid with ranked results achieves the same goal with no change to the UI layout users already know.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Device lat/lng is sent per-request, not stored permanently on the user profile.
  Rationale: Sending coordinates per-request gives accurate distance scoring from wherever the user currently is. Coordinates are rounded to 2 decimal places (~1 km) in the frontend before being used as a TanStack Query cache key to prevent minor GPS drift from busting the cache on every call.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: No random jitter in the score.
  Rationale: Jitter was considered to prevent the same list appearing on every load. For paginated results it is harmful — it can cause the same user to appear on two different pages if the score shifts between requests. Ordering is deterministic; the list will naturally shift over time as sobriety milestones advance, new connections are made, and activity recency changes.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Signal weights reordered to: distance 0.30, interest overlap 0.25, mutual connections 0.20, sobriety milestone 0.15, activity recency 0.10.
  Rationale: Interests and mutual connections are stronger trust signals for a sober community than sobriety milestone alone. Distance remains the primary signal since local support is the core value proposition.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Ranking is visible to all users (free and Plus). The Plus paywall only gates the advanced filters.
  Rationale: Ranking is a core discovery feature that benefits community growth; gating it would reduce the app's social utility for free users.
  Date/Author: 2026-04-24 / michaeljosephroddy

## Outcomes & Retrospective

_Nothing recorded yet._

---

## Context and Orientation

### Repository layout

This is a React Native / Expo application. All source lives under `src/`. The key areas touched by this plan:

    src/api/client.ts              — All network calls. Add new API function here.
    src/query/queryKeys.ts         — TanStack Query cache keys. Add suggestions key here.
    src/hooks/queries/useDiscover.ts — Pattern to follow when writing useSuggestions.
    src/hooks/queries/             — All data-fetching hooks live here.
    src/screens/main/DiscoverScreen.tsx — Discover tab screen. Add the strip here.
    src/components/                — Shared UI. New SuggestionsStrip goes here.
    src/utils/                     — Pure utilities. Add location helper here.
    src/screens/onboarding/LocationStep.tsx  — Reference for expo-location usage.
    src/screens/main/MeetupsScreen.tsx       — Another reference for expo-location.

The backend is a separate Go service reachable at the URL stored in `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:8080` on iOS/web, `http://10.0.2.2:8080` on Android emulator). This plan specifies the exact HTTP contract the backend must implement; the Go implementation itself is outside this repository.

### TanStack Query ("React Query")

"TanStack Query" is a library that manages server data fetching, caching, and re-fetching in React. When you call `useQuery` or `useInfiniteQuery` you give it a `queryKey` (a stable array used as a cache key) and a `queryFn` (the async function that actually fetches). The library handles loading/error states, deduplicates in-flight requests, and re-fetches on tab focus. All query keys in this project live in `src/query/queryKeys.ts`.

### expo-location

`expo-location` (already installed at version `~55.1.8`) lets the app ask for permission to read the device's GPS coordinates and retrieve them. The pattern used in `LocationStep.tsx` (lines 33–39) and `MeetupsScreen.tsx` (lines 397–403) is:

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    // pos.coords.latitude, pos.coords.longitude

### Scoring signals

The `discoverRanked` function in `internal/user/store.go` ranks candidate users by a weighted sum of five signals. When a search query is present, the original username-match ordering is used instead and scoring is skipped entirely.

1. **Distance (weight 0.30)** — How close the candidate is to the requesting user. Calculated from lat/lng sent in the request using the Haversine formula. Score decays exponentially with a 50 km half-life (full score at 0 km, ~37% at 50 km, ~14% at 100 km). Zero if either user has no coordinates.

2. **Interest overlap (weight 0.25)** — Jaccard similarity: `|shared interests| / |all interests combined|`. Two users with three shared interests out of four total score 0.75.

3. **Mutual connections (weight 0.20)** — Count of users who are friends with both the requester and the candidate. Score saturates at 5 mutual friends.

4. **Sobriety milestone band (weight 0.15)** — Both users' sobriety dates are bucketed into six bands: 0–29 days, 30–89 days, 90–364 days, 1–2 years, 2–5 years, 5+ years. Same band = full score (0.15), adjacent band = half score (0.075), further apart = zero. Zero if either user has no sober date.

5. **Activity recency (weight 0.10)** — Whether the candidate has posted in the last 7 days. Full score if yes, zero if no.

Scoring is deterministic — no random jitter. This ensures consistent ordering across pages so a user never appears on page 2 if they should be on page 1. The ranked list will naturally shift over time as sobriety milestones advance, connections are made, and activity changes.

---

## Plan of Work

### Step 1 — Backend: new `GET /users/suggestions` endpoint

This is a Go backend change outside this repository. The implementer must add a new route that:

- Requires a valid Bearer token (same auth middleware as `/users/discover`).
- Accepts optional query parameters: `lat` (float), `lng` (float), `limit` (int, default 8, max 20).
- Returns a JSON object in the shape `{ "data": [ ...User ] }` where each User object matches the existing user response shape already used by `/users/discover` (includes `id`, `username`, `avatar_url`, `is_plus`, `subscription_tier`, `city`, `country`, `bio`, `interests`, `sober_since`, `created_at`, `friendship_status`, `friend_count`).
- Applies the five-signal scoring algorithm described in the "Scoring signals" section above.
- Excludes the requesting user, already-connected friends, and blocked users.
- Returns HTTP 200 with up to `limit` results (may return fewer if the community is small).
- Returns HTTP 401 if no valid token.

Example request:

    GET /users/suggestions?lat=53.3498&lng=-6.2603&limit=8
    Authorization: Bearer <token>

Example response (abbreviated):

    {
      "data": [
        {
          "id": "abc123",
          "username": "soberSarah",
          "avatar_url": null,
          "interests": ["hiking", "yoga"],
          "sober_since": "2023-06-01",
          "city": "Dublin",
          "country": "Ireland",
          "friendship_status": "none",
          "friend_count": 12,
          ...
        }
      ]
    }

### Step 2 — Location utility (`src/utils/location.ts`)

Create a new file `src/utils/location.ts` that exports a single async function `getDeviceCoords`. It requests foreground location permission (if not already granted) and returns the lat/lng, or `null` if permission is denied or an error occurs. The function should never throw — it must catch and return `null` on failure so callers can proceed without coordinates (the suggestions endpoint still works without them; it just cannot apply distance scoring).

    export interface Coords {
        latitude: number;
        longitude: number;
    }

    export async function getDeviceCoords(): Promise<Coords | null>

Follow the same pattern as `LocationStep.tsx` lines 33–39 using `Location.requestForegroundPermissionsAsync()` and `Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })`. Wrap in try/catch. Import `* as Location from 'expo-location'`.

### Step 3 — API function (`src/api/client.ts`)

Add a new exported function after the `discoverUsers` function (around line 417). Keep it in the same "Users" grouping section. The function signature:

    export async function getSuggestedUsers(params?: {
        lat?: number;
        lng?: number;
        limit?: number;
    }): Promise<User[]>

Inside, build a `URLSearchParams` the same way `discoverUsers` does, appending `lat`, `lng`, and `limit` if provided. Call `request<{ data: User[] }>(`/users/suggestions${suffix}`)` and return `response.data ?? []`. Note the response shape uses `data` as a top-level array key, not the `{ items, page, has_more }` paginated shape — suggestions are a fixed-size non-paginated list.

### Step 4 — Query key (`src/query/queryKeys.ts`)

In `queryKeys.ts`, add a `suggestions` entry. Looking at the existing `discover` entry as a pattern, add:

    suggestions: (params?: { lat?: number; lng?: number }) =>
        ['suggestions', params ?? {}] as const,

This ensures that if the user's coordinates change, the cache key changes and a fresh fetch occurs.

### Step 5 — Hook (`src/hooks/queries/useSuggestions.ts`)

Create `src/hooks/queries/useSuggestions.ts`. This hook:

- Takes an optional `coords` parameter of type `{ latitude: number; longitude: number } | null`.
- Uses `useQuery` (not `useInfiniteQuery` — suggestions are not paginated).
- Uses `queryKeys.suggestions({ lat: coords?.latitude, lng: coords?.longitude })` as the key.
- Calls `api.getSuggestedUsers({ lat: coords?.latitude, lng: coords?.longitude, limit: 8 })` as the query function.
- Sets `staleTime` to `1000 * 60 * 5` (5 minutes) — suggestions do not need to refresh on every focus.
- Accepts an `enabled` boolean parameter (default `true`) and passes it to the query so the Discover screen can delay fetching until the tab is actually visible, following the `useLazyActivation` pattern already used in `DiscoverScreen`.

Export signature:

    export function useSuggestions(
        coords: { latitude: number; longitude: number } | null,
        enabled?: boolean
    ): UseQueryResult<User[], Error>

### Step 6 — SuggestionsStrip component (`src/components/SuggestionsStrip.tsx`)

Create `src/components/SuggestionsStrip.tsx`. This is a self-contained horizontal scrolling strip. It receives:

    interface SuggestionsStripProps {
        users: api.User[];
        friendedIds: Set<string>;
        onOpenUserProfile: (p: { userId: string; username: string; avatarUrl?: string }) => void;
        onFriend: (id: string) => void;
    }

Render a `ScrollView` with `horizontal` and `showsHorizontalScrollIndicator={false}`. For each user, render a `SuggestionCard` sub-component (can live in the same file since it is not reused elsewhere) showing:

- The user's avatar (use the existing `Avatar` component from `src/components/Avatar`).
- Username (truncated to one line).
- A small location or milestone label below the username (city, or sobriety milestone from `getRecoveryMilestone` in `src/utils/date.ts` — whichever is available, milestone taking priority).
- A "Connect" button using an `Ionicons` `person-add-outline` icon that calls `onFriend`. Replace with a `checkmark` icon when `friendedIds` contains this user's id.

Card dimensions: 100 wide × 140 tall with `borderRadius` from `Radii.lg`. Use `Colors`, `Typography`, `Spacing`, and `Radii` from `src/utils/theme.ts` for all styling — no hardcoded values.

The strip also needs a section header: a `Text` label reading "People you might know" styled with `Typography.sizes.md`, `fontWeight: '600'`, `Colors.light.textPrimary`, with `paddingHorizontal: Spacing.md` and `paddingBottom: Spacing.sm`.

If `users` is an empty array, the component renders `null` — do not show the section header with nothing under it.

### Step 7 — Wire into DiscoverScreen (`src/screens/main/DiscoverScreen.tsx`)

This is the most involved change. The existing screen already has `isActive`, `useAuth`, `useDiscover`, `friendedIds`, and `handleFriend`. The additions:

**Add state and effects at the top of `DiscoverScreen`:**

Import `getDeviceCoords` from `src/utils/location.ts`. Import `useSuggestions` from `src/hooks/queries/useSuggestions`. Import `SuggestionsStrip` from `src/components/SuggestionsStrip`.

Add a `coords` state:

    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

In a `useEffect` that runs once when the screen activates (`hasActivated` becomes true), call `getDeviceCoords()` and store the result in `coords`:

    useEffect(() => {
        if (!hasActivated) return;
        getDeviceCoords().then(setCoords);
    }, [hasActivated]);

Add the suggestions query:

    const suggestionsQuery = useSuggestions(coords, hasActivated);
    const suggestedUsers = suggestionsQuery.data ?? [];

**Modify the rendered JSX:**

The screen currently returns a `View` containing `PlusFeatureSheet`, `View style={styles.controls}` (search + filters), and a `FlatList` for the grid. The `SuggestionsStrip` should appear between the controls and the grid, but only when the user is not actively searching (`!isSearching`) and the strip has results.

Find the return statement. Between the controls `View` and the `FlatList`, add:

    {!isSearching && suggestedUsers.length > 0 && (
        <SuggestionsStrip
            users={suggestedUsers}
            friendedIds={friendedIds}
            onOpenUserProfile={onOpenUserProfile}
            onFriend={handleFriend}
        />
    )}

The `friendedIds` state already exists. The `handleFriend` callback already exists and calls `api.sendFriendRequest`. Both can be reused directly — no duplication needed.

Note: `handleFriend` currently takes an `id: string`. `SuggestionsStrip` calls `onFriend(id)` with the same signature, so this is compatible without modification.

---

## Concrete Steps

Run all commands from the repository root (`/home/michaelroddy/repos/project_radeon_app`) unless stated otherwise.

**After the backend endpoint is deployed or running locally:**

1. Start the backend Go server (outside this repo — follow the backend's own README).

2. Start the Expo dev server:

        npx expo start

3. Open the app in iOS simulator or Android emulator and log in with a test account that has `city`, `interests`, and `sober_since` set (an account created through onboarding will have these).

4. Navigate to the Discover tab. Observe that:
   - A location permission prompt fires on first load (iOS: "Allow While Using App", Android: runtime permission dialog).
   - After granting permission, a "People you might know" horizontal strip appears above the user grid.
   - Tapping a card in the strip opens the UserProfile sheet (the same sheet that opens from the grid).
   - The connect button on a strip card changes from `person-add-outline` to `checkmark` after tapping, matching the grid card behavior.

5. Deny location permission on a fresh install (revoke in device settings and restart). Observe that:
   - The suggestions strip still appears (backend falls back to interest + milestone + mutual-connections scoring, omitting distance).
   - No crash or error occurs.

6. While searching (type any text in the search bar), observe that the suggestions strip disappears — this is correct, as the user is in active search mode.

---

## Validation and Acceptance

The feature is complete and correct when all of the following are true:

1. The "People you might know" strip renders on the Discover tab for a logged-in user who has not yet connected with everyone in the community.

2. The strip is absent when the search bar contains text.

3. Tapping a suggestion card opens the same `UserProfileScreen` sheet that a grid card opens.

4. Tapping the connect button on a suggestion card sends a friend request (the button icon changes to a checkmark and the backend `POST /users/{id}/friend-request` is called exactly once).

5. Revoking location permission and reopening the app results in the strip still appearing (no crash, suggestions are returned based on non-location signals).

6. The strip does not appear when the backend returns zero suggestions (e.g., all community members are already friends).

7. TypeScript compiles with no new errors: run `npx tsc --noEmit` and confirm zero errors.

---

## Idempotence and Recovery

All changes in this plan are additive. No existing functions, hooks, or components are modified beyond adding new JSX and import statements to `DiscoverScreen.tsx`. If the backend endpoint is unavailable, `getSuggestedUsers` will throw and `useSuggestions` will set `isError: true`; the strip simply renders nothing because `suggestedUsers` defaults to `[]`. There is no risk of breaking the existing discover grid or search.

If you need to roll back, remove the `SuggestionsStrip` JSX block from `DiscoverScreen.tsx` and delete the four new files (`location.ts`, `useSuggestions.ts`, `SuggestionsStrip.tsx`, and the additions to `client.ts` and `queryKeys.ts`). No database migrations or persistent state changes are involved on the frontend.

---

## Artifacts and Notes

Key reference patterns already in the codebase:

Location permission + coords fetch (from `MeetupsScreen.tsx` lines 397–403):

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') { ... return; }
    const position = await Location.getCurrentPositionAsync({});
    // position.coords.latitude, position.coords.longitude

Infinite query hook pattern (from `src/hooks/queries/useDiscover.ts`):

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.discoverUsers({ ...params, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
        staleTime: DISCOVER_STALE_TIME,
        enabled,
    });

For `useSuggestions`, use `useQuery` instead of `useInfiniteQuery` since suggestions are not paginated.

User type (from `src/api/client.ts` lines 85–101) — confirms that `interests`, `sober_since`, `city`, `friendship_status` are all available in the response and can be used directly in `SuggestionsStrip` without extra API calls.

---

## Interfaces and Dependencies

### New files

`src/utils/location.ts`:

    import * as Location from 'expo-location';
    export interface Coords { latitude: number; longitude: number; }
    export async function getDeviceCoords(): Promise<Coords | null>

`src/hooks/queries/useSuggestions.ts`:

    import { useQuery, UseQueryResult } from '@tanstack/react-query';
    import * as api from '../../api/client';
    import { queryKeys } from '../../query/queryKeys';
    export function useSuggestions(
        coords: { latitude: number; longitude: number } | null,
        enabled?: boolean
    ): UseQueryResult<api.User[], Error>

`src/components/SuggestionsStrip.tsx`:

    import * as api from '../api/client';
    interface SuggestionsStripProps {
        users: api.User[];
        friendedIds: Set<string>;
        onOpenUserProfile: (p: { userId: string; username: string; avatarUrl?: string }) => void;
        onFriend: (id: string) => void;
    }
    export function SuggestionsStrip(props: SuggestionsStripProps): React.ReactElement | null

### Modified files

`src/api/client.ts` — add `getSuggestedUsers` after `discoverUsers` (line ~417).

`src/query/queryKeys.ts` — add `suggestions` key after `discover` key.

`src/screens/main/DiscoverScreen.tsx` — add `coords` state, `useEffect` for location, `useSuggestions` call, and `SuggestionsStrip` JSX.

### External dependencies

`expo-location` — already installed at `~55.1.8`. No new packages required.

`@tanstack/react-query` — already installed and used throughout hooks. No new packages required.
