# Support Discovery Simplification

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

This plan builds directly on `SUPPORT_REQUEST_RANKING_EXECPLAN.md` (migration 027, now complete). The ranking algorithm exists but is over-complicated by support modes that were trying to pre-match supporters to request types. This change removes that pre-matching entirely, makes location scoring universal, and introduces a clearer in-person request type.

Four decisions together:

1. **Remove support modes** — the `support_mode` column is dropped from `users`. Availability is a single boolean: you are either available to support or you are not. The algorithm decides relevance; the supporter decides in the moment which cards to act on.

2. **Universal location scoring** — the location proximity bonus in `ListVisibleSupportRequests` currently fires only when `support_mode = 'nearby'`. With modes gone, it fires for all viewers who have coordinates set. Nearby requests naturally rise for everyone, seamlessly.

3. **`need_company` → `need_in_person_help`** — replaces the vague "need company" type with an explicit in-person signal. Existing rows are migrated. The response type `nearby` is renamed to `can_meet` to match.

4. **Response buttons by request type, not supporter mode** — `can_chat` and `check_in_later` appear on all cards. `can_meet` ("I can meet up") appears only on `need_in_person_help` cards. No pre-declaration from the supporter required.

## Progress

- [x] (2026-04-24) DB migration 028 — drop `support_mode` from `users`, rename `need_company` → `need_in_person_help` in `support_requests`, rename `nearby` → `can_meet` in `support_responses`
- [x] (2026-04-24) Backend — remove `support_mode` from `SupportProfile` struct and `Querier` interface
- [x] (2026-04-24) Backend — update `GetSupportProfile` / `UpdateSupportProfile` (drop mode param and column references)
- [x] (2026-04-24) Backend — update `validSupportRequestTypes` map (`need_company` → `need_in_person_help`)
- [x] (2026-04-24) Backend — update `validSupportResponseTypes` map (`nearby` → `can_meet`)
- [x] (2026-04-24) Backend — update `ListVisibleSupportRequests` (remove `support_mode` from viewer CTE, make location bonus unconditional)
- [x] (2026-04-24) Backend — remove mode-gating from `CreateSupportResponse` handler (line ~392 in store.go: `profile.SupportMode != input.ResponseType` check)
- [x] (2026-04-24) Backend — update handler tests
- [x] (2026-04-24) Frontend — update `SupportRequest['type']` union in `client.ts` (`need_company` → `need_in_person_help`)
- [x] (2026-04-24) Frontend — update `SupportResponse['response_type']` union in `client.ts` (`nearby` → `can_meet`)
- [x] (2026-04-24) Frontend — remove `support_mode` from `SupportProfile` type in `client.ts`
- [x] (2026-04-24) Frontend — remove `support_mode` from `updateMySupportProfile` params in `client.ts`
- [x] (2026-04-24) Frontend — remove `supportMode` state, `DEFAULT_SUPPORT_MODES`, `handleSelectSupportMode`, `getSupportModeLabel` from `SupportScreen.tsx`
- [x] (2026-04-24) Frontend — simplify `handleToggleAvailability` (no longer sets a default mode)
- [x] (2026-04-24) Frontend — simplify availability card to toggle + description only (remove chip selector)
- [x] (2026-04-24) Frontend — update `SUPPORT_TYPE_LABELS` (`need_company` → `need_in_person_help`: "Need in-person help")
- [x] (2026-04-24) Frontend — update `SUPPORT_RESPONSE_LABELS` (`nearby` → `can_meet`: "I can meet up")
- [x] (2026-04-24) Frontend — update `SupportRequestCard` props (remove `supportMode`, simplify button logic)
- [x] (2026-04-24) Frontend — update `getSupportResponseSummary` (`nearby` → `can_meet`)
- [x] (2026-04-24) Frontend — update `SupportScreenProps` and `SupportMode` type alias

## Surprises & Discoveries

_Nothing recorded yet._

## Decision Log

- Decision: `support_mode` dropped entirely — availability is on/off only.
  Rationale: Mode declaration was pre-matching supporters to requests before they had seen them. The algorithm (location + urgency + recency) handles relevance. Supporters self-select which cards to act on in the moment. The mode picker added friction at the worst time (turning availability on) with questionable ranking benefit.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: Location bonus made universal (applied to all viewers with coordinates, not just `nearby` mode).
  Rationale: With modes removed, location can no longer be gated. Proximity is a useful signal for all support types — a nearby person can chat, check in later, or meet up. The half-life of 300km keeps the signal soft enough not to disadvantage rural users.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: `need_company` replaced by `need_in_person_help` (not kept alongside it).
  Rationale: The two types overlap too much. "Need company" is ambiguous — it could mean a text conversation or physical presence. "Need in-person help" is unambiguous and makes the `can_meet` response button placement logical.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: `nearby` response type renamed to `can_meet`.
  Rationale: "Nearby" as a response type was named after the old support mode it was paired with. With that mode gone, the name is semantically wrong. `can_meet` is clearer about what the responder is offering.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: `can_meet` response button scoped to `need_in_person_help` cards only.
  Rationale: Offering "I can meet up" on a "Need to talk" card is noise — the requester asked for a conversation, not a meetup. Scoping keeps response options honest and matched to what was asked.
  Date/Author: 2026-04-24 / michaeljosephroddy

- Decision: No request-type-based ranking boost — all types compete equally on urgency, location, and recency.
  Rationale: `need_in_person_help` is not inherently more urgent than `need_to_talk`. Urgency is declared by the requester via the urgency picker. Type-based boosting would undermine that signal.
  Date/Author: 2026-04-24 / michaeljosephroddy

## Outcomes & Retrospective

_Nothing recorded yet._

---

## Context and Orientation

Builds on: `SUPPORT_REQUEST_RANKING_EXECPLAN.md` (migration 027, fully complete).

### Repository layout

Backend at `/home/michaelroddy/repos/project_radeon/`:

    internal/support/store.go       — Querier interface (lines 19–31), valid type maps (lines 38–60), SupportProfile struct (line 62), ListVisibleSupportRequests with location bonus (line 287)
    internal/support/handler.go     — UpdateMySupportProfile (line 153), CreateSupportResponse mode-gate check (line ~392)
    internal/support/handler_test.go
    migrations/                     — next file is 028_support_simplification.sql

Frontend at `/home/michaelroddy/repos/project_radeon_app/`:

    src/api/client.ts               — SupportRequest type, SupportProfile type, updateMySupportProfile
    src/screens/main/SupportScreen.tsx — supportMode state (line 377), DEFAULT_SUPPORT_MODES (line 86), availabilityCard (line 754), SupportRequestCard response button logic (lines 201–206)

### Scoring algorithm (after this change)

**All viewers** (no mode gate):

| Signal | Weight | Calculation |
|---|---|---|
| Urgency | 0.40 | `right_now` = 0.40, `soon` = 0.20, `when_you_can` = 0.0 |
| Sobriety band match | 0.25 | Same band = 0.25, adjacent band = 0.125, else 0.0 |
| Recency decay | 0.20 | `0.20 × EXP(-hours_since_created / 24)` |
| Location proximity | `0.30 × EXP(-dist_km / 300)` | Applied when both viewer and requester have lat/lng — no mode gate |

Priority visibility lift (paid feature) remains: requests with active `priority_visibility` sort above all scored results.

### Response button matrix (after this change)

| Request type | I can chat | Check in later | I can meet up |
|---|---|---|---|
| need_to_talk | ✓ | ✓ | — |
| need_distraction | ✓ | ✓ | — |
| need_encouragement | ✓ | ✓ | — |
| need_in_person_help | ✓ | ✓ | ✓ |

---

## Plan of Work

### Step 1 — Database migration

Create `migrations/028_support_simplification.sql`:

```sql
-- Drop support_mode from users (modes are removed entirely)
ALTER TABLE users
    DROP COLUMN IF EXISTS support_mode;

-- Rename need_company → need_in_person_help in support_requests
UPDATE support_requests
    SET type = 'need_in_person_help'
    WHERE type = 'need_company';

-- Rename nearby → can_meet in support_responses
UPDATE support_responses
    SET response_type = 'can_meet'
    WHERE response_type = 'nearby';
```

Run with `go run ./cmd/migrate up` from the backend repo root.

### Step 2 — Backend: valid type maps and structs

In `internal/support/store.go`:

**`validSupportRequestTypes` map** (line ~38–45):
- Remove `"need_company": true`
- Add `"need_in_person_help": true`

**`validSupportResponseTypes` map** (line ~51–55):
- Remove `"nearby": true`
- Add `"can_meet": true`

**`SupportProfile` struct** (line ~62):
- Remove `SupportMode string` field

**`Querier` interface** (line ~19–31):
- `UpdateSupportProfile` signature: remove the `mode string` parameter — becomes `UpdateSupportProfile(ctx, userID, available bool)`

### Step 3 — Backend: store functions

**`GetSupportProfile`**:
- Remove `COALESCE(support_mode, '')` from SELECT
- Remove `&p.SupportMode` from Scan

**`UpdateSupportProfile`**:
- Remove `support_mode = $3` SET clause and the `mode` parameter
- Remove `COALESCE(support_mode, '')` from RETURNING
- Remove `&p.SupportMode` from Scan

**`ListVisibleSupportRequests`** — update the `viewer_data` CTE and location bonus:

Remove `u.support_mode` from the viewer_data SELECT. Change the location bonus from:
```sql
WHEN (SELECT support_mode FROM viewer_data) = 'nearby'
     AND (SELECT lat FROM viewer_data) IS NOT NULL
     ...
THEN 0.30 * EXP(...)
```
To:
```sql
WHEN (SELECT lat FROM viewer_data) IS NOT NULL
     AND (SELECT lng FROM viewer_data) IS NOT NULL
     AND c.req_lat IS NOT NULL
     AND c.req_lng IS NOT NULL
THEN 0.30 * EXP(...)
```

Also update the score weights to match the new algorithm (urgency 0.40, sobriety 0.25, recency 0.20 — the location bonus `0.30` remains additive on top).

### Step 4 — Backend: handler

**`UpdateMySupportProfile` handler** (line ~153):
- Remove `SupportMode string` from the input struct
- Remove `mode` variable and validation
- Call `h.db.UpdateSupportProfile(r.Context(), userID, input.IsAvailableToSupport)` with no mode arg

**`CreateSupportResponse` handler** (line ~383–392):
- Remove the mode-gate check: `if profile.SupportMode != "" && profile.SupportMode != input.ResponseType`
- The check was preventing a `check_in_later`-mode supporter from responding `can_chat`. With modes gone, any available supporter can use any response type valid for the request type.

Update handler tests to match new signatures.

### Step 5 — Frontend: API types (`src/api/client.ts`)

**`SupportRequest` interface**:
- `type` union: replace `'need_company'` with `'need_in_person_help'`

**`SupportResponse` interface**:
- `response_type` union: replace `'nearby'` with `'can_meet'`

**`SupportProfile` interface**:
- Remove `support_mode` field

**`updateMySupportProfile` function**:
- Remove `support_mode` from the params type and request body

### Step 6 — Frontend: SupportScreen (`src/screens/main/SupportScreen.tsx`)

**Remove entirely:**
- `DEFAULT_SUPPORT_MODES` constant (line 86)
- `supportMode` state variable (line 377)
- `setSupportMode` calls everywhere
- `handleSelectSupportMode` function (line 719)
- `getSupportModeLabel` function (line 158)
- `SupportMode` type alias (line 34: `type SupportMode = SupportResponseType`)

**Update `SUPPORT_TYPE_LABELS`:**
- `need_company: 'Need company'` → `need_in_person_help: 'Need in-person help'`

**Update `SUPPORT_RESPONSE_LABELS`:**
- `nearby: 'Nearby'` → `can_meet: 'I can meet up'`

**Update `getSupportResponseSummary`:**
- `nearbyCount` variable: filter on `response_type === 'can_meet'`
- Label: `'nearby'` string → `'can meet up'`

**Update `handleToggleAvailability`:**
- Remove `nextMode` / `previousMode` logic
- Call `api.updateMySupportProfile({ is_available_to_support: next })` only
- Remove `setSupportMode` calls from the try/catch

**Update `availabilityCard`:**
- Remove the `availabilityModesLabel`, chip `selectorWrap`, and `availabilityModesHint` entirely
- Keep only the header row (title, description text, toggle button)

**Update `SupportRequestCard` props interface:**
- Remove `supportMode: SupportMode | ''`

**Update `SupportRequestCard` component:**
- Remove `supportMode` param from destructuring
- Remove `canChatEnabled`, `checkInLaterEnabled`, `nearbyEnabled` derived booleans
- New logic:
  ```ts
  const canMeet = request.type === 'need_in_person_help';
  ```
- Show "I can chat" button always (when `canRespond`)
- Show "Check in later" button always (when `canRespond`)
- Show "I can meet up" button only when `canMeet && canRespond`

**Update all `SupportRequestCard` usages** — remove `supportMode` prop.

**Remove unused styles:**
- `availabilityModesLabel`, `availabilityModesHint`, `availabilityModeChipMuted`, `availabilityModeChipTextMuted`

---

## Validation and Acceptance

The feature is complete when:

1. Creating a support request shows `need_in_person_help` as an option ("Need in-person help") and `need_company` is gone.
2. The availability card shows only the on/off toggle — no mode chips.
3. All support request cards show "I can chat" and "Check in later" buttons.
4. Only `need_in_person_help` cards show an "I can meet up" button.
5. Toggling availability on/off no longer sends or stores a mode.
6. The ranked feed surfaces nearby requests higher for all viewers (not just those who had selected `nearby` mode).
7. Priority-boosted requests still appear above all ranked results.
8. TypeScript compiles with no new errors (`npx tsc --noEmit`).
9. Backend handler tests pass with the new signatures.
