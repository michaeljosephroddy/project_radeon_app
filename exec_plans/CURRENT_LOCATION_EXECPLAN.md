# Current Location Tracking

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Users currently have a single location — a `city` string set at onboarding and manually editable in their profile. This is their "based" location (home city). The `lat`/`lng` columns on `users` are also set at onboarding and never updated.

This means a user travelling to another city is ranked as if they are still at home, and their `can_meet` support response says "I'm based in Dublin" even when they're in London.

This change introduces a second location layer:

- **Based location** (`city`, `lat`, `lng`) — unchanged, manually set, shown on profile as permanent home
- **Current location** (`current_lat`, `current_lng`, `current_city`, `location_updated_at`) — silently updated every time the app opens, using whatever location permission has already been granted

The ranking algorithm for both support requests and discovery prefers `current_lat`/`current_lng` when available, falling back to `lat`/`lng`. The profile shows "Currently in X" as a secondary label when `current_city` differs from `city` and the update is recent. The `can_meet` support response message uses `current_city` when fresh, falling back to `city`.

The update is entirely silent — no permission prompt is shown (only already-granted permission is used), no UI state changes, no user action required.

## Progress

- [ ] DB migration 029 — add `current_lat`, `current_lng`, `current_city`, `location_updated_at` to `users`
- [ ] Backend — new `PATCH /users/me/location` endpoint (accepts lat, lng, city)
- [ ] Backend — update `ListVisibleSupportRequests` to prefer `current_lat`/`current_lng` over `lat`/`lng`
- [ ] Backend — update `discoverRanked` (or equivalent) to prefer `current_lat`/`current_lng` over `lat`/`lng`
- [ ] Backend — expose `current_city` and `location_updated_at` on the `User` response type
- [ ] Frontend — new `updateMyCurrentLocation` API function in `client.ts`
- [ ] Frontend — add `current_city` and `location_updated_at` to `User` type in `client.ts`
- [ ] Frontend — silent location sync on app open in `AppNavigator.tsx`
- [ ] Frontend — "Currently in X" label on profile when fresh and different from base city
- [ ] Frontend — use `current_city` (when fresh) in `buildCanMeetMessage`

## Surprises & Discoveries

_Nothing recorded yet._

## Decision Log

- Decision: Location sync fires on every foreground transition via `AppState`, not just after login.
  Rationale: Auth persists across app launches, so a `useEffect([user?.id])` only fires once after login. A user who opens the app daily would never get their location updated. `AppState 'active'` events cover cold launch, return from background, and app switching — exactly the moments when "user just opened the app" is true.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Location update is fully silent — no UI, no permission prompt.
  Rationale: Asking for permission on every app open is intrusive. The update only fires when permission has already been granted. Users who denied permission at onboarding continue using their base coords. Users can always open the app and get their proximity ranking updated without any friction.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: `city` / `lat` / `lng` (based location) are not touched by the current-location update.
  Rationale: Based location is the user's intentional home declaration. It should only change when the user explicitly edits it. Overwriting it silently would confuse users who see their "city" change without understanding why.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: "Currently in X" shown on profile only when `location_updated_at` is within 24 hours AND `current_city` differs from `city`.
  Rationale: A stale "Currently in London" from a trip three weeks ago is misleading. 24h ensures the label is only shown when the device was opened recently in that location. If the user is back home and opens the app, `current_city` will match `city` and the label disappears naturally.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Ranking uses `current_lat`/`current_lng` whenever non-null, with no freshness gate.
  Rationale: Even a week-old current location is almost certainly more accurate than onboarding coordinates from months ago. If the user hasn't opened the app recently enough for fresh coords, they're not actively using the app, so ranking precision is less important. Avoid freshness logic in SQL to keep the query simple.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: `can_meet` message uses `current_city` only when `location_updated_at` is within 24 hours. Falls back to `city`.
  Rationale: A stale `current_city` is worse than the base city in a message — it could tell a requester you're nearby when you're not. 24h freshness ensures the message reflects where you actually are today.
  Date/Author: 2026-04-24 / michaeljosephroddy

## Outcomes & Retrospective

_Nothing recorded yet._

---

## Context and Orientation

### Repository layout

Backend at `/home/michaelroddy/repos/project_radeon/`:

    migrations/                              — next file is 029_current_location.sql
    internal/user/handler.go                 — user profile handlers; add UpdateMyCurrentLocation here
    internal/user/store.go                   — user DB queries; add UpdateCurrentLocation, check discover query for lat/lng usage
    internal/support/store.go               — ListVisibleSupportRequests; update viewer_data CTE lat/lng references

Frontend at `/home/michaelroddy/repos/project_radeon_app/`:

    src/api/client.ts                        — User type, add updateMyCurrentLocation function
    src/navigation/AppNavigator.tsx          — app open hook; add silent location sync here
    src/screens/main/ProfileTabScreen.tsx    — profile display; add "Currently in X" label
    src/screens/main/SupportScreen.tsx       — buildCanMeetMessage; use current_city when fresh
    src/utils/location.ts                    — getDeviceCoords already exists; add reverseGeocode helper

### Location freshness check (frontend)

```ts
function isLocationFresh(updatedAt: string | null | undefined): boolean {
    if (!updatedAt) return false;
    return Date.now() - new Date(updatedAt).getTime() < 24 * 60 * 60 * 1000;
}
```

Used in both the profile "Currently in" label and `buildCanMeetMessage`.

### Ranking SQL change (viewer_data CTE)

Both `ListVisibleSupportRequests` (support/store.go) and the discover query use a `viewer_data` CTE that selects `u.lat` and `u.lng`. Replace with:

```sql
COALESCE(u.current_lat, u.lat) AS lat,
COALESCE(u.current_lng, u.lng) AS lng,
```

No other changes needed — the haversine calculation downstream already uses these aliased columns.

---

## Plan of Work

### Step 1 — Database migration

Create `migrations/029_current_location.sql`:

```sql
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS current_lat  double precision,
    ADD COLUMN IF NOT EXISTS current_lng  double precision,
    ADD COLUMN IF NOT EXISTS current_city text,
    ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;
```

### Step 2 — Backend: store

In `internal/user/store.go`, add a new function:

```go
func (s *pgStore) UpdateCurrentLocation(ctx context.Context, userID uuid.UUID, lat, lng float64, city string) error {
    _, err := s.pool.Exec(ctx,
        `UPDATE users
         SET current_lat = $2, current_lng = $3, current_city = $4, location_updated_at = NOW()
         WHERE id = $1`,
        userID, lat, lng, city,
    )
    return err
}
```

Add it to the `Querier` interface.

In `internal/user/store.go`, update the `GetUser` / `GetMe` query to SELECT `current_city` and `location_updated_at` and scan them into the `User` struct.

In `internal/user/handler.go` (or wherever the `User` struct lives), add:
- `CurrentCity        *string    \`json:"current_city,omitempty"\``
- `LocationUpdatedAt  *time.Time \`json:"location_updated_at,omitempty"\``

In `internal/support/store.go`, update the `viewer_data` CTE in `ListVisibleSupportRequests`:
```sql
-- replace:
u.lat,
u.lng,
-- with:
COALESCE(u.current_lat, u.lat) AS lat,
COALESCE(u.current_lng, u.lng) AS lng,
```

In the discover store (find the ranked discover query), apply the same COALESCE to viewer lat/lng.

### Step 3 — Backend: handler

In `internal/user/handler.go`, add `UpdateMyCurrentLocation`:

```go
func (h *Handler) UpdateMyCurrentLocation(w http.ResponseWriter, r *http.Request) {
    userID := middleware.CurrentUserID(r)
    var input struct {
        Lat  float64 `json:"lat"`
        Lng  float64 `json:"lng"`
        City string  `json:"city"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        response.Error(w, http.StatusBadRequest, "invalid request body")
        return
    }
    if err := h.db.UpdateCurrentLocation(r.Context(), userID, input.Lat, input.Lng, input.City); err != nil {
        response.Error(w, http.StatusInternalServerError, "could not update location")
        return
    }
    w.WriteHeader(http.StatusNoContent)
}
```

Register the route: `PATCH /users/me/location`.

### Step 4 — Frontend: API client (`src/api/client.ts`)

Add to the `User` interface:
```ts
current_city?: string | null;
location_updated_at?: string | null;
```

Add a new function:
```ts
export async function updateMyCurrentLocation(data: {
    lat: number;
    lng: number;
    city: string;
}): Promise<void> {
    await request('/users/me/location', { method: 'PATCH', body: JSON.stringify(data) });
}
```

### Step 5 — Frontend: location utility (`src/utils/location.ts`)

Add a `reverseGeocode` helper alongside `getDeviceCoords`:

```ts
import * as Location from 'expo-location';

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        return place?.city ?? place?.subregion ?? place?.region ?? null;
    } catch {
        return null;
    }
}
```

### Step 6 — Frontend: silent sync on every foreground (`src/navigation/AppNavigator.tsx`)

Logins persist across app launches, so `useEffect([user?.id])` only fires once after login — not on subsequent opens. Use `AppState` to detect every foreground transition instead.

```ts
useEffect(() => {
    if (!user) return;

    const syncLocation = () => {
        void (async () => {
            const coords = await getDeviceCoords();
            if (!coords) return;
            const city = await reverseGeocode(coords.latitude, coords.longitude);
            if (!city) return;
            await api.updateMyCurrentLocation({
                lat: coords.latitude,
                lng: coords.longitude,
                city,
            }).catch(() => {}); // silent — never surface errors to the user
        })();
    };

    // Fire immediately on mount (covers cold launch)
    syncLocation();

    // Fire every time the app returns to foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') syncLocation();
    });

    return () => subscription.remove();
}, [user?.id]);
```

`AppState` is imported from `react-native`. The dependency on `user?.id` ensures the effect is re-registered on login/logout. `AppState.addEventListener('change')` covers: returning from background, switching back from another app, and screen wake.

### Step 7 — Frontend: profile display (`src/screens/main/ProfileTabScreen.tsx`)

Add `isLocationFresh` helper and show "Currently in X" beneath the base city when conditions are met:

```ts
function isLocationFresh(updatedAt: string | null | undefined): boolean {
    if (!updatedAt) return false;
    return Date.now() - new Date(updatedAt).getTime() < 24 * 60 * 60 * 1000;
}
```

In the location section of the profile edit/view, below the existing city display:
```tsx
{user.current_city
    && isLocationFresh(user.location_updated_at)
    && user.current_city !== user.city
    ? <Text style={styles.currentLocationLabel}>Currently in {user.current_city}</Text>
    : null}
```

Add a `currentLocationLabel` style: smaller, secondary text colour.

### Step 8 — Frontend: `can_meet` message (`src/screens/main/SupportScreen.tsx`)

Update `buildCanMeetMessage` to accept and use current city:

```ts
function buildCanMeetMessage(currentCity: string | null | undefined, baseCity: string | null | undefined): string {
    const city = currentCity ?? baseCity;
    const location = city ? `I'm based in ${city}` : "I'm close by";
    return `Hey, I saw your support request. ${location} and happy to meet up in person if that would help.`;
}
```

And in `handleRespond`, pass both:
```ts
buildCanMeetMessage(
    isLocationFresh(user?.location_updated_at) ? user?.current_city : null,
    user?.city,
)
```

---

## Validation and Acceptance

The feature is complete when:

1. Opening the app with location permission granted silently updates `current_lat`, `current_lng`, `current_city`, and `location_updated_at` on the backend — no UI change visible.
2. Opening the app without location permission (or denied) does nothing — no error, no prompt.
3. A user whose `current_city` differs from `city` and `location_updated_at` is within 24h sees "Currently in X" on their profile.
4. A user whose `current_city` matches `city`, or whose `location_updated_at` is older than 24h, sees no "Currently in" label.
5. The support ranking for that user uses `current_lat`/`current_lng` for the proximity score.
6. The `can_meet` message uses `current_city` when fresh, falls back to `city`, falls back to "close by".
7. TypeScript compiles with no new errors.
8. Backend compiles and existing tests pass.
