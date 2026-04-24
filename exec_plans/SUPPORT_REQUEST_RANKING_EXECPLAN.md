# Support Request Urgency and Ranked Discovery

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Right now support requests are shown to all viewers in a flat list ordered by recency and a paid priority boost. There is no personalisation — every viewer sees the same list regardless of their location, sobriety timeline, or what kind of support they can offer.

This change does three things together:

1. **Urgency** — requesters can flag their request with one of three urgency levels (`when_you_can | soon | right_now`), shown as a badge on the card. This is set at creation and cannot be changed.

2. **Community-wide visibility** — the `audience` field is removed. All requests are visible to the whole community. The ranking algorithm handles relevance instead of a hard audience filter.

3. **Ranked discovery** — `ListVisibleSupportRequests` replaces its flat `ORDER BY sort_at DESC` with a scored ranking algorithm. The four signals are: urgency (0.40), sobriety band match (0.35), recency decay (0.25), plus a conditional location bonus (`+0.30 × EXP(-distance_km / 300)`) applied only when the viewer's `support_mode` is `nearby`.

Support requests also move from auto-expiring to staying open until the requester manually closes them. A "posted X ago" timestamp on the card lets the community judge staleness naturally.

The `support_modes` array on users is simplified to a single `support_mode` string — users pick one mode that represents what they can best offer.

## Progress

- [x] (2026-04-24) DB migration 027 — add `urgency` to `support_requests`, convert `support_modes` → `support_mode`, make `expires_at` nullable, drop `audience`
- [x] (2026-04-24) Backend — update `SupportRequest` type and `Querier` interface
- [x] (2026-04-24) Backend — update `CreateSupportRequest` (accept urgency, remove audience/expires_at)
- [x] (2026-04-24) Backend — update `ListVisibleSupportRequests` with ranked scoring algorithm
- [x] (2026-04-24) Backend — update `GetSupportProfile` / `UpdateSupportProfile` (support_mode string)
- [x] (2026-04-24) Backend — update handler (parse urgency, remove audience param, remove expiry check)
- [x] (2026-04-24) Backend — update handler tests and logic tests
- [x] (2026-04-24) Frontend — update `SupportRequest` type in `client.ts` (add urgency, remove audience/expires_at)
- [x] (2026-04-24) Frontend — update `createSupportRequest` API function
- [x] (2026-04-24) Frontend — update `SupportProfile` type and `updateMySupportProfile` API function
- [x] (2026-04-24) Frontend — urgency picker in support request create flow
- [x] (2026-04-24) Frontend — remove audience picker and duration picker from create flow
- [x] (2026-04-24) Frontend — urgency badge on support request card (right_now = red, soon = amber)
- [x] (2026-04-24) Frontend — "posted X ago" timestamp already present on card via `timeAgo(created_at)`
- [x] (2026-04-24) Frontend — single-select support mode in support profile settings
- [ ] Frontend — warn `nearby` users in settings if no location permission

## Surprises & Discoveries

_Nothing recorded yet._

## Decision Log

- Decision: Audience picker removed — all requests visible to the whole community.
  Rationale: The audience filter was doing a crude approximation of what the ranking algorithm handles properly. A `friends` audience hides requests from potentially helpful strangers and causes zero-visibility in sparse networks. Ranking surfaces local and friend requests near the top without hiding them from the broader community.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: `support_modes []string` simplified to `support_mode string` — users pick one mode.
  Rationale: Users selecting all modes made the signal meaningless for ranking. A single mode forces an honest declaration of what they can best offer and keeps the data clean.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Urgency cannot be changed after a request is created.
  Rationale: Prevents abuse and keeps the signal trustworthy. May be revisited in a future iteration.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Auto-expiry removed. Requests stay open until manually closed by the requester.
  Rationale: Forced expiry felt artificial and penalised users who forgot to close resolved requests. A "posted X ago" timestamp lets the community self-assess staleness. A silent background archive can be added later if pile-up becomes a problem.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Location bonus is conditional on `support_mode = 'nearby'` only.
  Rationale: Chat and check-in support have no geographic constraint. Applying location scoring to all viewers would disadvantage rural users and distort results for modes where proximity is irrelevant.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Priority visibility (`priority_visibility` / `priority_expires_at`) is preserved as a hard pre-sort lift above the ranking score.
  Rationale: This is a paid feature with an existing contract. It must continue to surface boosted requests above organically ranked ones regardless of score.
  Date/Author: 2026-04-24 / michaeljosephroddy

## Outcomes & Retrospective

_Nothing recorded yet._

---

## Context and Orientation

### Repository layout

Backend is a separate Go service at `/home/michaelroddy/repos/project_radeon/`. Key files:

    internal/support/store.go      — All support request DB queries. Core ranking logic goes here.
    internal/support/handler.go    — HTTP handlers. Parse urgency param, remove audience param.
    internal/support/handler_test.go — Mock querier tests.
    internal/support/logic.go      — Business logic (expiry calculation etc — review for changes).
    migrations/                    — Numbered SQL migration files.

Frontend is the React Native / Expo app at `/home/michaelroddy/repos/project_radeon_app/`. Key files:

    src/api/client.ts                         — SupportRequest type, createSupportRequest, SupportProfile type.
    src/screens/main/SupportScreen.tsx        — Main support list screen (if exists).
    src/screens/support/                      — Support request create flow screens.
    src/components/SupportRequestCard.tsx     — Card component (if exists) — add badge and timestamp.
    src/utils/theme.ts                        — Design tokens for badge colours.

### Scoring algorithm

`ListVisibleSupportRequests` replaces `ORDER BY sort_at DESC` with a scored CTE, following the same pattern as `discoverRanked` in `internal/user/store.go`.

**Base score (all viewers):**

| Signal | Weight | Calculation |
|---|---|---|
| Urgency | 0.40 | `right_now` = 0.40, `soon` = 0.20, `when_you_can` = 0.0 |
| Sobriety band match | 0.35 | Same band = 0.35, adjacent band = 0.175, else 0.0 |
| Recency decay | 0.25 | `0.25 × EXP(-hours_since_created / 24)` |

**Conditional location bonus (`nearby` viewers only):**

```
+ 0.30 × EXP(-distance_km / 300)
```

Applied only when viewer's `support_mode = 'nearby'` AND both viewer and requester have `lat`/`lng` set. Half-life of 300km — a request 300km away adds ~0.11, a request 5km away adds ~0.30.

**Priority visibility lift:**

Requests with `priority_visibility = true AND priority_expires_at > NOW()` sort above all scored results. Implemented by ordering on a derived `is_priority` boolean first, then `score DESC`, then `sr.id` as tiebreaker.

**Sobriety bands** (same as discover algorithm):

| Band | Days sober |
|---|---|
| 1 | 0 – 29 |
| 2 | 30 – 89 |
| 3 | 90 – 364 |
| 4 | 365 – 729 |
| 5 | 730 – 1824 |
| 6 | 1825+ |

---

## Plan of Work

### Step 1 — Database migration

Create `migrations/027_support_request_urgency.sql`:

```sql
-- Add urgency to support_requests
ALTER TABLE support_requests
    ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'when_you_can';

-- Make expires_at nullable (requests no longer auto-expire)
ALTER TABLE support_requests
    ALTER COLUMN expires_at DROP NOT NULL;

-- Set expires_at to NULL for any currently open requests so they stay visible
UPDATE support_requests SET expires_at = NULL WHERE status = 'open';

-- Drop audience column
ALTER TABLE support_requests
    DROP COLUMN IF EXISTS audience;

-- Convert support_modes array to single support_mode string
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS support_mode text;

UPDATE users
    SET support_mode = support_modes[1]
    WHERE array_length(support_modes, 1) > 0;

ALTER TABLE users
    DROP COLUMN IF EXISTS support_modes;
```

Run with `go run ./cmd/migrate up` from the backend repo root.

### Step 2 — Backend: types and Querier interface

In `internal/support/` update the `SupportRequest` struct:
- Add `Urgency string` field
- Remove `Audience` field (or keep as unexported if referenced elsewhere — check)

Update `SupportProfile` struct:
- Change `SupportModes []string` to `SupportMode string`

Update `Querier` interface:
- `CreateSupportRequest` signature — replace `audience string` param with `urgency string`, remove `expiresAt time.Time` param (or make it a pointer and pass nil)
- `UpdateSupportProfile` — change `modes []string` to `mode string`

### Step 3 — Backend: store

**`CreateSupportRequest`** — remove `audience` and `expiresAt` params, add `urgency`. Update the INSERT:
- Remove `audience` and `expires_at` from the INSERT column list
- Add `urgency` to the INSERT column list
- Update RETURNING and Scan accordingly

**`ListVisibleSupportRequests`** — replace the current query with a scored CTE:

```sql
WITH viewer_data AS (
    SELECT
        u.support_mode,
        u.lat,
        u.lng,
        CASE WHEN u.sober_since IS NOT NULL
            THEN EXTRACT(EPOCH FROM (NOW() - u.sober_since::timestamptz)) / 86400.0
            ELSE NULL
        END AS days_sober
    FROM users u WHERE u.id = $1
),
viewer_band AS (
    SELECT CASE
        WHEN (SELECT days_sober FROM viewer_data) IS NULL    THEN NULL
        WHEN (SELECT days_sober FROM viewer_data) < 30       THEN 1
        WHEN (SELECT days_sober FROM viewer_data) < 90       THEN 2
        WHEN (SELECT days_sober FROM viewer_data) < 365      THEN 3
        WHEN (SELECT days_sober FROM viewer_data) < 730      THEN 4
        WHEN (SELECT days_sober FROM viewer_data) < 1825     THEN 5
        ELSE 6
    END AS band
),
candidates AS (
    SELECT
        sr.id,
        sr.requester_id,
        sr.type,
        sr.message,
        sr.status,
        sr.urgency,
        sr.response_count,
        sr.created_at,
        sr.priority_visibility,
        sr.priority_expires_at,
        u.username,
        u.avatar_url,
        u.city,
        u.lat AS req_lat,
        u.lng AS req_lng,
        CASE
            WHEN u.sober_since IS NULL THEN NULL
            WHEN EXTRACT(EPOCH FROM (NOW() - u.sober_since::timestamptz)) / 86400.0 < 30   THEN 1
            WHEN EXTRACT(EPOCH FROM (NOW() - u.sober_since::timestamptz)) / 86400.0 < 90   THEN 2
            WHEN EXTRACT(EPOCH FROM (NOW() - u.sober_since::timestamptz)) / 86400.0 < 365  THEN 3
            WHEN EXTRACT(EPOCH FROM (NOW() - u.sober_since::timestamptz)) / 86400.0 < 730  THEN 4
            WHEN EXTRACT(EPOCH FROM (NOW() - u.sober_since::timestamptz)) / 86400.0 < 1825 THEN 5
            ELSE 6
        END AS cand_band,
        EXISTS(
            SELECT 1 FROM support_responses own_res
            WHERE own_res.support_request_id = sr.id
              AND own_res.responder_id = $1
        ) AS has_responded
    FROM support_requests sr
    JOIN users u ON u.id = sr.requester_id
    WHERE sr.status = 'open'
      AND sr.requester_id != $1
      AND ($2::timestamptz IS NULL OR sr.created_at < $2)
)
SELECT
    c.id,
    c.requester_id,
    c.username,
    c.avatar_url,
    c.city,
    c.type,
    c.message,
    c.status,
    c.urgency,
    c.response_count,
    c.created_at,
    c.priority_visibility,
    c.priority_expires_at,
    c.has_responded,
    false AS is_own_request,
    c.created_at AS sort_at,
    (
        -- Urgency
        CASE c.urgency
            WHEN 'right_now'    THEN 0.40
            WHEN 'soon'         THEN 0.20
            ELSE 0.0
        END
        -- Sobriety band match
        + CASE
            WHEN (SELECT band FROM viewer_band) IS NULL OR c.cand_band IS NULL THEN 0.0
            WHEN (SELECT band FROM viewer_band) = c.cand_band                  THEN 0.35
            WHEN ABS((SELECT band FROM viewer_band) - c.cand_band) = 1         THEN 0.175
            ELSE 0.0
          END
        -- Recency decay (24h half-life)
        + 0.25 * EXP(-EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 86400.0)
        -- Location bonus for nearby viewers only
        + CASE
            WHEN (SELECT support_mode FROM viewer_data) = 'nearby'
                 AND (SELECT lat FROM viewer_data) IS NOT NULL
                 AND (SELECT lng FROM viewer_data) IS NOT NULL
                 AND c.req_lat IS NOT NULL
                 AND c.req_lng IS NOT NULL
            THEN 0.30 * EXP(-(
                2.0 * 6371.0 * ASIN(SQRT(
                    POWER(SIN(RADIANS((c.req_lat - (SELECT lat FROM viewer_data)) / 2.0)), 2)
                    + COS(RADIANS((SELECT lat FROM viewer_data))) * COS(RADIANS(c.req_lat))
                    * POWER(SIN(RADIANS((c.req_lng - (SELECT lng FROM viewer_data)) / 2.0)), 2)
                ))
            ) / 300.0)
            ELSE 0.0
          END
    ) AS score,
    CASE
        WHEN c.priority_visibility = true
             AND c.priority_expires_at IS NOT NULL
             AND c.priority_expires_at > NOW()
        THEN true
        ELSE false
    END AS is_priority
FROM candidates c
CROSS JOIN viewer_band
ORDER BY is_priority DESC, score DESC, c.id
LIMIT $3
```

Note: cursor pagination (`$2::timestamptz`) is preserved for the `before` param. The `sort_at` column in the scan is kept for backward compatibility with `scanSupportRequests`.

**`GetSupportProfile` / `UpdateSupportProfile`** — update SELECT/UPDATE to read/write `support_mode` (single text column) instead of `support_modes` (array).

**`FetchSupportSummary`** — remove the `audience` filter conditions from the WHERE clause, since all requests are now community-wide.

**`GetSupportRequest`** — remove `audience` from SELECT if present.

### Step 4 — Backend: handler

In `internal/support/handler.go`:

- `CreateSupportRequest` handler — parse `urgency` from request body, remove `audience` parsing. Pass `urgency` to store method. Remove `expiresAt` calculation.
- `UpdateSupportProfile` handler — change `Modes []string` input field to `Mode string`.
- Remove any audience-related constants or validation.

Update handler tests in `handler_test.go` to match new signatures.

### Step 5 — Frontend: API types

In `src/api/client.ts`:

**`SupportRequest` interface:**
- Add `urgency: 'when_you_can' | 'soon' | 'right_now'`
- Remove `audience` field
- Remove `expires_at` field (no longer meaningful — remove from type and any UI that references it)

**`SupportProfile` interface:**
- Change `support_modes: string[]` to `support_mode: string`

**`createSupportRequest` function:**
- Add `urgency: SupportRequest['urgency']` to params
- Remove `audience` from params
- Update request body

**`updateSupportProfile` function:**
- Change `support_modes?: string[]` to `support_mode?: string` in params

### Step 6 — Frontend: support request create flow

Find the screen(s) responsible for creating a support request (likely in `src/screens/support/` or inline in a modal). Make two changes:

1. **Remove audience picker** — delete the `friends | city | community` selector entirely.

2. **Add urgency picker** — show three options upfront before submission:

| Option | Label | Badge colour |
|---|---|---|
| `when_you_can` | Whenever you can | No badge (default, quiet) |
| `soon` | Soon | Amber / warning tone |
| `right_now` | Right now | Red / urgent tone |

Use `Colors` from `theme.ts` for badge colours — map to existing semantic colours (warning/error tones). The picker should be visually prominent since it's the most important input after the message. Default selection is `when_you_can`.

Pass selected urgency to `api.createSupportRequest`.

### Step 7 — Frontend: support request card

In the support request card component (find by searching for `SupportRequest` renders in `src/components/` or `src/screens/`):

1. **Urgency badge** — show a small coloured pill badge for `soon` and `right_now` only. `when_you_can` shows nothing. Badge sits near the request type label or top-right of the card.

2. **"Posted X ago" timestamp** — replace any expiry countdown with `timeAgo(request.created_at)` using the existing `timeAgo` utility from `src/utils/theme.ts` (or `src/utils/date.ts` — check which file has it). Show in secondary text colour.

3. Remove any reference to `expires_at` from the card.

### Step 8 — Frontend: support profile settings

Find the screen where users set their support availability and modes. Change the multi-select for support modes to a single-select (radio group style). Three options:

| Value | Label |
|---|---|
| `can_chat` | I can chat |
| `check_in_later` | I can check in later |
| `nearby` | I can meet nearby |

If the user selects `nearby` and location permission has not been granted, show an inline warning: "Enable location so we can match you with nearby requests." Tapping the warning should call `getDeviceCoords()` from `src/utils/location.ts` to trigger the permission prompt.

---

## Concrete Steps

Run migration from backend repo root:

```bash
cd /home/michaelroddy/repos/project_radeon
go run ./cmd/migrate up
```

Restart the Go server after backend changes. Restart Expo dev server after frontend changes:

```bash
npx expo start --clear
```

---

## Validation and Acceptance

The feature is complete when:

1. Creating a support request shows a three-option urgency picker and no audience picker.
2. `right_now` and `soon` badges appear on cards. `when_you_can` shows no badge.
3. Cards show "posted X ago" with no expiry countdown.
4. Support requests from all community members appear in the list (not filtered by audience).
5. A viewer with `support_mode = nearby` and location granted sees local requests ranked higher.
6. A viewer with `can_chat` or `check_in_later` sees urgency + sobriety + recency driving ranking with no location bias.
7. Priority-boosted requests still appear at the top above all ranked results.
8. Support profile settings shows a single-mode selector. `nearby` selection shows a location warning when no permission is granted.
9. TypeScript compiles with no new errors (`npx tsc --noEmit`).
