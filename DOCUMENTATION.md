# Guess the Flag — Functional & Technical Documentation

> Generated: 2026-06-11. Last updated: 2026-06-20. All facts are verified directly against source code.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose and Scope](#2-purpose-and-scope)
3. [Functional Documentation](#3-functional-documentation)
   - 3.1 [User Flows](#31-user-flows)
   - 3.2 [Game Rules](#32-game-rules)
   - 3.3 [Difficulty Tiers and Levels](#33-difficulty-tiers-and-levels)
4. [Technical Architecture](#4-technical-architecture)
   - 4.1 [Tech Stack](#41-tech-stack)
   - 4.2 [File and Directory Layout](#42-file-and-directory-layout)
5. [Database Schema](#5-database-schema)
6. [API Endpoint Reference](#6-api-endpoint-reference)
7. [Key Modules](#7-key-modules)
   - 7.1 [lib/db.ts](#71-libdbts)
   - 7.2 [lib/auth.ts](#72-libauthts)
   - 7.3 [lib/game.ts](#73-libgamets)
   - 7.4 [lib/countries.ts](#74-libcountriests)
   - 7.5 [lib/types.ts](#75-libtypests)
   - 7.6 [lib/security.ts](#76-libsecurityts)
   - 7.7 [lib/version.ts](#77-libversionts)
8. [UI Pages](#8-ui-pages)
9. [Setup and Running](#9-setup-and-running)
10. [Running the Test Suite](#10-running-the-test-suite)
11. [Environment Variables](#11-environment-variables)
12. [Security Notes](#12-security-notes)
13. [Known Limitations and Accepted Trade-offs](#13-known-limitations-and-accepted-trade-offs)
14. [Diagrams](#14-diagrams)
    - 14.1 [Use Case Diagram](#141-use-case-diagram)
    - 14.2 [Activity Diagram — Full Game Flow](#142-activity-diagram--full-game-flow)
    - 14.3 [Sequence Diagram — Game Round](#143-sequence-diagram--game-round)
    - 14.4 [Functional Flow Diagram](#144-functional-flow-diagram)
    - 14.5 [Component Diagram](#145-component-diagram)

---

## 1. Overview

**Guess the Flag** is a self-hosted, browser-based educational game where registered users identify national flags from multiple-choice options. The application is a single Next.js 14 App Router project that serves both the UI and API from one codebase. Progress is persisted per user in a Supabase Postgres database accessed via the `postgres` npm library. All flag images are served as local SVG assets — no external network calls occur during gameplay.

---

## 2. Purpose and Scope

| Dimension | Detail |
|-----------|--------|
| Domain | Geography / flag-recognition education |
| Target users | Anyone who wants to learn to identify world flags |
| Deployment model | Single-server Node.js process (Next.js production build) |
| Data persistence | Supabase Postgres via `DATABASE_URL` (connection string) |
| Authentication | Username + password; JWT stored in an httpOnly cookie |
| Country coverage | 197 countries (all sovereign states) across 5 difficulty tiers |
| Out of scope | Multiplayer, leaderboards, social features, mobile-native app |

---

## 3. Functional Documentation

### 3.1 User Flows

#### Signup

1. User visits `/` — server component checks for a valid `gtf_token` cookie; if none, redirects to `/login`.
2. From `/login`, the user clicks "Sign up" to navigate to `/signup`.
3. The signup form collects username (3–30 characters, alphanumeric plus `.`, `_`, `-`), password (minimum 10 characters), and a confirmation password. Client-side pre-validation checks that the two password fields match before submitting.
4. The form POSTs to `POST /api/auth/signup`. On success (HTTP 201), the server sets the `gtf_token` cookie and the browser is redirected to `/dashboard`.
5. If the username is already taken, the API returns 409 and an inline error is shown.

#### Login

1. User visits `/login`.
2. The form collects username and password and POSTs to `POST /api/auth/login`.
3. On success (HTTP 200), the `gtf_token` cookie is set and the browser redirects to `/dashboard`.
4. Wrong credentials produce a 401 and an inline error message.

#### Dashboard

1. The dashboard page (`/dashboard`) is a server component. It reads the session via `getUserFromCookie()`. If no valid session exists, the user is redirected to `/login`.
2. The page queries `user_progress` directly from the database (via `lib/db.ts` imported in the server component) and renders a grid of level cards.
3. Each card displays:
   - Level number and difficulty tier label (Beginner / Easy / Medium / Hard / Expert / Expert Mix)
   - A badge: "Completed" (green), "Unlocked" (accent), or "Locked" (grey)
   - Attempt count (if > 0)
   - A "Start Level" or "Play Again" link (for unlocked/completed), or a locked message
4. The current level banner shows the active level and the pass requirement ("Score 15/15 to advance!").
5. A "Sign Out" button (client component `LogoutButton.tsx`) POSTs to `POST /api/auth/logout` and redirects to `/login`.

#### Gameplay

1. Navigating to `/game/[level]` (client component) triggers a `GET /api/game/start?level=N` request on mount.
   - If the level is locked (`level > user.currentLevel`), the API returns 403 and the page shows an error with a link back to the dashboard.
2. The game HUD shows, in order: a "Back to Dashboard" exit link, the live score, question counter ("Q X / 15"), a progress bar, and a countdown timer. The exit link is rendered only during the `playing`/`feedback` phases (not on loading/error/results screens) and navigates straight to `/dashboard` with no `fetch`/submit call — `POST /api/game/submit` is the sole writer of `user_progress`/`users.current_level` in the app, so leaving mid-round via this link records no attempt and does not change progress.
3. For each question:
   - A flag SVG is displayed centrally.
   - Four option buttons (country names, shuffled) are presented in a 2×2 grid.
   - The user has 15 seconds to click an answer. If the timer reaches zero, the answer is recorded as `null` (incorrect) and the game auto-advances.
   - On selecting an answer, the chosen button flashes green (correct) or red (wrong), and the correct answer is always highlighted. After an 800 ms feedback delay, the next question loads.
4. After question 15, the accumulated answers are submitted via `POST /api/game/submit`. A loading spinner is shown during submission.

#### Level Completion (Results Screen)

After submission the results screen renders:

- **Pass (15/15):** A trophy icon, "Level Up!" animated text, the score, a congratulations message showing the newly unlocked level number, a "Play Level N+1" link, and a "Dashboard" link.
- **Fail (< 15/15):** A "retry" icon, the score, an encouraging message ("You need 15/15 to pass. Keep trying!"), a "Retry Level N" **button** (`<button onClick>`, not a navigation link — see below), and a "Dashboard" link.

**Retry behavior (in-place reload, no navigation).** The "Retry Level N" control on the fail branch is a `<button>` wired to a `resetAndReload` callback in the game page, not a `<Link>`. Because the failed round's URL (`/game/[level]`) is identical to the retry target, a same-URL `<Link>` would have been a App-Router no-op (the route's data-loading effect is keyed on `[level]`, which does not change, so it would never re-fire) — this was a real, fixed bug. `resetAndReload` instead: clears the pending feedback timeout and the countdown timer interval (preventing a stale timeout from the just-finished round firing after reset), resets all round state (`results`, `answers`, `currentIndex`, `score`, `selectedAnswer`, `timeLeft`, `errorMsg`) and sets the phase to `loading`, then re-fetches `GET /api/game/start?level=N` and transitions to `playing` (or `error` on failure) — all without a full page navigation or component remount. The pass-branch "Play Level N+1" link and both results-screen "Dashboard" links are unaffected and remain plain `<Link>` navigations.

In both cases, a full answer key is rendered below. Each of the 15 rows shows:
- A thumbnail of the flag
- The correct country name
- The user's answer (or "Timed out" if null)
- A green checkmark or red cross icon

---

### 3.2 Game Rules

| Rule | Value |
|------|-------|
| Questions per level | 15 |
| Options per question | 4 (multiple choice, single correct) |
| Timer per question | 15 seconds |
| Timeout behavior | Answer recorded as `null`; counts as incorrect |
| Pass threshold | **100% — score must equal 15 out of 15** |
| Feedback delay | 800 ms before advancing to next question |
| Level advancement | Only on a perfect pass; `users.current_level` is incremented by 1 |
| Retry on fail | User may retry the same level unlimited times |
| Completed levels | Can be replayed (via "Play Again") but do not re-lock on re-play |
| Flag source | Local SVGs from `/public/flags/<iso>.svg`; no network calls during play |
| Grading authority | Server-side only — the server re-derives correct answers from the DB by `countryId` |

---

### 3.3 Difficulty Tiers and Levels

Levels 1–5 each map to a single difficulty tier. Levels 6 and above draw from a combined tier 4+5 pool (120 countries).

| Level | Tier | Label | Example Countries |
|-------|------|-------|-------------------|
| 1 | 1 | Beginner | United States, France, Japan, Brazil, Germany |
| 2 | 2 | Easy | Norway, Ireland, South Africa, Thailand, Ukraine |
| 3 | 3 | Medium | Hungary, Nigeria, Philippines, Cuba, Iran |
| 4 | 4 | Hard | Kazakhstan, Latvia, Nepal, Ghana, Slovenia |
| 5 | 5 | Expert | Kiribati, Bhutan, Nauru, Eswatini, Tajikistan |
| 6+ | 4+5 | Expert Mix | Combined pool of 120 tier-4 and tier-5 countries |

Each tier has at least 20 countries (tier 1: 20, tier 2: 20, tier 3: 37, tier 4: 58, tier 5: 62), ensuring that any level can always draw 15 question countries plus 3 unique distractors per question.

---

## 4. Technical Architecture

### 4.1 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | ^14.2.35 |
| Language | TypeScript | ^5.4.0 |
| UI | React | ^18.3.0 |
| Database | Supabase Postgres via `postgres` (npm) | ^3.4.5 |
| Password hashing | bcryptjs | ^2.4.3 |
| Session tokens | jsonwebtoken | ^9.0.2 |
| Styling | Vanilla CSS Modules + globals.css | — |
| Script runner | tsx | ^4.7.0 |
| Runtime | Node.js | 26.x (tested) |

The `postgres` library is used with `{ prepare: false }` because Supabase's transaction pooler (port 6543) does not support prepared statements. All DB calls are `async/await`. The `export const runtime = 'nodejs'` directive is present on every API route to prevent Next.js from routing them through the Edge runtime.

### 4.2 File and Directory Layout

```
guess-the-flag/
├── app/
│   ├── globals.css                    # CSS custom properties, resets, keyframe animations
│   ├── layout.tsx                     # Root layout (server) — sets <html lang="en">, metadata
│   ├── page.tsx                       # Root redirect: /dashboard or /login
│   ├── login/
│   │   ├── page.tsx                   # Login form (client component)
│   │   └── login.module.css           # Shared styles for login + signup card
│   ├── signup/
│   │   └── page.tsx                   # Signup form (client component, reuses login.module.css)
│   ├── dashboard/
│   │   ├── page.tsx                   # Dashboard (server component)
│   │   ├── LogoutButton.tsx           # Logout button (client component)
│   │   └── dashboard.module.css
│   ├── game/
│   │   ├── [level]/page.tsx           # Game screen (client component)
│   │   └── game.module.css
│   └── api/
│       ├── auth/
│       │   ├── signup/route.ts        # POST /api/auth/signup
│       │   ├── login/route.ts         # POST /api/auth/login
│       │   ├── logout/route.ts        # POST /api/auth/logout
│       │   └── me/route.ts            # GET  /api/auth/me
│       ├── game/
│       │   ├── start/route.ts         # GET  /api/game/start?level=N
│       │   └── submit/route.ts        # POST /api/game/submit
│       └── progress/
│           └── route.ts               # GET  /api/progress
├── lib/
│   ├── db.ts                          # postgres client singleton (Supabase Postgres)
│   ├── auth.ts                        # Auth helpers (hash, JWT, cookie)
│   ├── game.ts                        # buildQuestions(), tiersForLevel(), constants
│   ├── countries.ts                   # MASTER_COUNTRIES static data
│   ├── countryNames.ts                # Localized country names (hi/bn/pa)
│   ├── i18n.ts                        # Locale type, UI dictionaries, t(), cookie helpers
│   ├── security.ts                    # Rate limiter + CSRF origin check
│   ├── version.ts                     # APP_VERSION constant, kept in sync with package.json
│   └── types.ts                       # Shared TypeScript interfaces
├── scripts/
│   ├── download-flags.ts              # One-time: downloads 197 SVGs from flagcdn.com
│   └── seed.ts                        # One-time: populates countries table
├── tests/
│   ├── gtf.test.ts                    # 74-test suite (node:test runner)
│   └── tsconfig.json                  # Test-specific TS config (commonjs, react jsx)
├── public/
│   └── flags/                         # 197 local SVG flag files (e.g. us.svg, jp.svg)
├── next.config.js                     # Security headers; no external package overrides
├── tsconfig.json                      # strict:true, @/* path alias, bundler moduleResolution
├── package.json
└── .gitignore                         # node_modules, .next, .env*
```

Note: there is no `data/` directory. The SQLite database has been replaced by Supabase Postgres; all persistence is remote.

---

## 5. Database Schema

The schema targets Postgres (Supabase) and is defined in **`db/schema.sql`**. There is
no local schema bootstrap in `lib/db.ts` — the `db.ts` module only opens a connection.
The tables must be created once in the Supabase project by applying `db/schema.sql`
(via the Supabase SQL editor or a migration tool) before the seed script is run.

The schema as committed in `db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text        NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  current_level integer     NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS countries (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            text    NOT NULL,
  iso_code        text    NOT NULL UNIQUE,    -- lowercase ISO 3166-1 alpha-2 (e.g. 'us')
  flag_path       text    NOT NULL,           -- e.g. '/flags/us.svg'
  difficulty_tier integer NOT NULL CHECK (difficulty_tier BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS user_progress (
  id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level_id  integer NOT NULL,
  completed integer NOT NULL DEFAULT 0,    -- 0 = not completed, 1 = completed (integer boolean)
  attempts  integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, level_id)
);
```

**Column notes:**

- `users.current_level`: the next level the user is allowed to play. Starts at 1. Incremented to `level + 1` when a user passes `level` (if `level >= current_level` at submission time).
- `countries.flag_path`: always `/flags/<iso_code>.svg`; this is a relative URL path served from the Next.js `public/` directory.
- `user_progress.completed`: integer used as a boolean (0/1). The upsert on pass sets it to 1; a failed attempt preserves the existing value.
- `user_progress.attempts`: incremented on every submission (pass or fail).
- Cascade delete: deleting a user also removes their `user_progress` rows.

**Upsert syntax used in route handlers (Postgres `ON CONFLICT`):**

```sql
-- On pass:
INSERT INTO user_progress (user_id, level_id, completed, attempts)
VALUES ($1, $2, 1, 1)
ON CONFLICT (user_id, level_id)
DO UPDATE SET completed = 1, attempts = user_progress.attempts + 1;

-- On fail:
INSERT INTO user_progress (user_id, level_id, completed, attempts)
VALUES ($1, $2, 0, 1)
ON CONFLICT (user_id, level_id)
DO UPDATE SET attempts = user_progress.attempts + 1;
```

---

## 6. API Endpoint Reference

All routes require `export const runtime = 'nodejs'`. Auth-protected routes resolve the session via `getUserFromCookie()` (reads the `gtf_token` httpOnly cookie, verifies the JWT, and fetches the current user row from Postgres). Error responses always have the shape `{ "error": "<message>" }`.

State-changing POST routes (`/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/game/submit`) perform a same-origin check on the `Origin` header before any other logic and return 403 `{ "error": "Cross-origin request rejected" }` if it fails.

---

### POST /api/auth/signup

Creates a new user account and issues a session cookie.

**Rate limit:** 5 requests per IP per hour. Exceeding the limit returns 429 with a `Retry-After` header.

**Request body (JSON):**
```json
{
  "username": "string",          // 3–30 characters, alphanumeric + . _ - only; trimmed
  "password": "string",          // minimum 10 characters
  "confirmPassword": "string"    // must match password
}
```

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 201 | Success | `{ "user": { "id": number, "username": string, "currentLevel": 1 } }` |
| 400 | Invalid JSON | `{ "error": "Invalid JSON" }` |
| 400 | Username length violation | `{ "error": "Username must be 3-30 characters" }` |
| 400 | Username contains invalid characters | `{ "error": "Username may only contain letters, numbers, and . _ -" }` |
| 400 | Password too short | `{ "error": "Password must be at least 10 characters" }` |
| 400 | Passwords mismatch | `{ "error": "Passwords do not match" }` |
| 403 | Cross-origin request | `{ "error": "Cross-origin request rejected" }` |
| 409 | Username already taken | `{ "error": "Username already taken" }` |
| 429 | Rate limit exceeded | `{ "error": "Too many requests. Please try again later." }` |

On success, sets `Set-Cookie: gtf_token=<JWT>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` (Max-Age=604800 = 7 days). The `Secure` flag is added only when `NODE_ENV === 'production'`.

---

### POST /api/auth/login

Authenticates an existing user and issues a session cookie.

**Rate limits:** 20 requests per IP per 15 minutes; 10 requests per username per 15 minutes (checked in that order). Either limit returning exhausted yields 429 with a `Retry-After` header.

**Request body (JSON):**
```json
{
  "username": "string",
  "password": "string"
}
```

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Success | `{ "user": { "id": number, "username": string, "currentLevel": number } }` |
| 400 | Invalid JSON | `{ "error": "Invalid JSON" }` |
| 400 | Missing fields | `{ "error": "Username and password required" }` |
| 401 | Unknown username | `{ "error": "Invalid credentials" }` |
| 401 | Wrong password | `{ "error": "Invalid credentials" }` |
| 403 | Cross-origin request | `{ "error": "Cross-origin request rejected" }` |
| 429 | Rate limit exceeded | `{ "error": "Too many requests. Please try again later." }` |

On success, sets the same `gtf_token` cookie as signup.

---

### POST /api/auth/logout

Clears the session cookie. Requires a same-origin `Origin` header (if present).

**Request body:** None.

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ "ok": true }` |
| 403 | `{ "error": "Cross-origin request rejected" }` |

Sets `Set-Cookie: gtf_token=; Path=/; Max-Age=0` to expire the cookie immediately.

---

### GET /api/auth/me

Returns the current user from the session cookie. Used by the client to check auth status.

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Valid session | `{ "user": { "id": number, "username": string, "currentLevel": number } }` |
| 401 | No cookie or invalid/expired JWT | `{ "error": "Unauthorized" }` |

---

### GET /api/game/start?level=N

Returns 15 questions for the specified level. Auth required.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `level` | integer >= 1 | The level to play |

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Success | See below |
| 400 | Missing, non-integer, or < 1 level | `{ "error": "Invalid level parameter" }` |
| 401 | Not authenticated | `{ "error": "Unauthorized" }` |
| 403 | `level > user.currentLevel` | `{ "error": "Level is locked" }` |

**Success body (`StartGameResponse`):**
```json
{
  "level": 1,
  "questions": [
    {
      "countryId": 5,
      "flagPath": "/flags/br.svg",
      "options": ["Brazil", "Argentina", "Chile", "Colombia"],
      "correctOption": "Brazil"
    }
  ]
}
```

Note: `correctOption` is returned in the response (needed for immediate client-side feedback rendering). Server-side grading on submit does not trust any client-sent correct answers — it re-derives them from the DB using `countryId`.

---

### POST /api/game/submit

Grades a completed game session, persists progress, and optionally advances the user's level. Auth required. Requires a same-origin `Origin` header (if present).

**Request body (JSON):**
```json
{
  "level": 1,
  "answers": [
    { "countryId": 5, "answer": "Brazil" },
    { "countryId": 12, "answer": null }
  ]
}
```

`answer: null` represents a timeout (counted as incorrect).

**Validation:** `level` must be a non-zero integer satisfying `1 <= level <= user.currentLevel`. This upper bound prevents arbitrary level-jumping via a crafted request body.

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Always on valid request | See below |
| 400 | Invalid JSON | `{ "error": "Invalid JSON" }` |
| 400 | `level` out of bounds, non-integer, or `answers` not array | `{ "error": "Invalid request body" }` |
| 401 | Not authenticated | `{ "error": "Unauthorized" }` |
| 403 | Cross-origin request | `{ "error": "Cross-origin request rejected" }` |

**Success body (`SubmitGameResponse`):**
```json
{
  "score": 15,
  "total": 15,
  "passed": true,
  "newCurrentLevel": 2,
  "answerKey": [
    {
      "countryId": 5,
      "flagPath": "/flags/br.svg",
      "correctOption": "Brazil",
      "userAnswer": "Brazil",
      "isCorrect": true
    }
  ]
}
```

**Pass logic (verified from source):**
```
passed = (score === total) && (total === 15)
```

Both conditions must hold — submitting fewer than 15 answers cannot produce a pass. On pass, `user_progress` is upserted with `completed = 1, attempts + 1`. If `level >= user.current_level` at submission time, `users.current_level` is set to `level + 1`. On fail, `user_progress` is upserted with `attempts + 1` (completed value is not reset if it was previously 1).

**Grading implementation — batched, single round-trip (performance fix).** Grading previously issued one `SELECT ... WHERE id = ${countryId}` Postgres round-trip per submitted answer (an N+1 pattern — 15 serial round-trips against the transaction pooler, the root cause of a 3–5 second results-screen load). It now issues a single batched query, `SELECT id, name, iso_code, flag_path FROM countries WHERE id = ANY(${ids})` (with `ids` derived from `answers.map(a => a.countryId)`), loads the rows into an in-memory `Map` keyed by `id`, and grades by iterating `answers` (preserving submission order) and looking up each country from the map. The `ids` array is passed as a single bound Postgres array parameter via the `postgres` library's tagged-template syntax — not string-interpolated — so this introduces no new SQL-injection surface (confirmed safe by penetration test, finding F1). An empty `answers` array short-circuits to `rows = []` rather than issuing a malformed `ANY('{}')` query. Grading semantics are otherwise unchanged from the prior per-row implementation: an unknown/non-existent `countryId` is skipped via `continue` (not counted in `score` or `total`, and `ANY()` does not error on it); a `countryId` repeated across multiple answer entries is graded independently per submission (each entry looked up and judged on its own, not deduplicated); localized-or-English name matching and the `passed` rule are byte-for-byte identical to the pre-rewrite behavior. Covered by 5 new integration tests (unknown-id skip, duplicate-id independent grading with order assertions, empty-answers, all-null-timeout, and a level-bound regression guard) — see [Section 10](#10-running-the-test-suite).

**Known low-severity hardening gaps (not yet implemented; from penetration test, see [Section 12](#12-security-notes)):** the route validates that `answers` is an array but does not cap its length (F2) or validate the shape of its elements (F3). Both are pre-existing gaps newly in scope on the changed lines, rated Low, and explicitly **not implemented** in this batch.

---

### GET /api/progress

Returns the authenticated user's full progress summary. Auth required.

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Success | See below |
| 401 | Not authenticated | `{ "error": "Unauthorized" }` |

**Success body:**
```json
{
  "currentLevel": 3,
  "levels": [
    { "level": 1, "completed": true,  "attempts": 2 },
    { "level": 2, "completed": true,  "attempts": 1 },
    { "level": 3, "completed": false, "attempts": 0 },
    { "level": 4, "completed": false, "attempts": 0 },
    { "level": 5, "completed": false, "attempts": 0 }
  ]
}
```

The `levels` array always includes entries from 1 through `max(currentLevel, 5)`. Levels with no `user_progress` row default to `completed: false, attempts: 0`.

---

## 7. Key Modules

### 7.1 lib/db.ts

Exports a `postgres` client singleton connected to Supabase Postgres via the `DATABASE_URL` environment variable. The module throws immediately at import time if `DATABASE_URL` is not set, so a misconfigured deployment fails fast rather than silently.

```typescript
import postgres from 'postgres';
const sql = postgres(connectionString, { prepare: false });
export default sql;
```

`{ prepare: false }` is required because Supabase's transaction pooler (port 6543) does not support the Postgres extended query protocol (prepared statements). All queries use tagged-template literals, which the `postgres` library parameterizes automatically — no string interpolation of user data occurs.

**Export:** `export default sql` — a `postgres` tagged-template query function.

There is no local schema bootstrap. Tables must exist in the Supabase project before first use. The `data/app.db` SQLite file and WAL pragmas from the previous implementation have been removed entirely.

---

### 7.2 lib/auth.ts

Provides all authentication primitives.

| Export | Signature | Description |
|--------|-----------|-------------|
| `hashPassword` | `(pw: string) => Promise<string>` | bcryptjs hash, salt rounds = 10 |
| `verifyPassword` | `(pw: string, hash: string) => Promise<boolean>` | bcryptjs compare |
| `signJwt` | `({ uid, username }) => string` | Signs a JWT with `getJwtSecret()`, expires in 7 days |
| `verifyJwt` | `(token: string) => { uid, username } \| null` | Verifies and decodes; returns null on any error |
| `getUserFromCookie` | `() => Promise<SessionUser \| null>` | Reads `gtf_token` via Next.js `cookies()`, calls `verifyJwt`, fetches `id/username/current_level` from Postgres |
| `cookieOptions` | `(maxAge?) => object` | Returns cookie attribute object: httpOnly, sameSite=lax, path=/, maxAge, secure (prod only) |
| `COOKIE_NAME` | `'gtf_token'` | The cookie name constant |

**`getJwtSecret()` (internal helper, fail-closed):** Reads `process.env.JWT_SECRET`. If the variable is unset or empty and `NODE_ENV === 'production'`, it throws `Error('JWT_SECRET environment variable must be set in production')`. Outside production it falls back to `'dev-secret-change-me'`. The function is called lazily (only when a token is signed or verified), so `next build` — which runs with `NODE_ENV=production` but without runtime secrets — is unaffected.

`getUserFromCookie` is now `async` because the Postgres query it issues is asynchronous. It can only be called inside a Next.js request context.

---

### 7.3 lib/game.ts

All question-generation logic lives here.

**Constants (all exported):**
- `QUESTIONS_PER_LEVEL = 15`
- `OPTIONS_PER_QUESTION = 4`
- `TIMER_SECONDS = 15`

**`tiersForLevel(level: number): number[]`**

Returns the set of `difficulty_tier` values to query for a given level:
- `level` 1–5 → `[level]` (single-tier)
- `level` >= 6 → `[4, 5]` (combined Hard + Expert pool)

**`buildQuestions(level: number, locale?: Locale): Promise<Question[]>`**

1. Calls `tiersForLevel(level)` to get the tier set.
2. Queries all `countries` rows matching `WHERE difficulty_tier = ANY($1)` via a tagged-template parameterized query (array parameter, not string interpolation).
3. Fisher-Yates shuffles the pool, takes up to 15 as question countries.
4. For each question country:
   - Filters the pool to exclude the correct country.
   - Fisher-Yates shuffles the remaining pool, takes the first 3 as distractors.
   - Combines the correct country name + 3 distractor names and Fisher-Yates shuffles the 4 options.
   - Country names are localized via `localizedCountryName()` from `lib/countryNames.ts` using the `locale` parameter (defaults to `'en'`).
5. Returns a `Question[]` with `countryId`, `flagPath`, `options` (shuffled 4 strings), and `correctOption`.

Edge case: if the pool has fewer than 15 entries (not possible with the current 20-per-tier dataset), the function returns as many questions as available without crashing.

---

### 7.4 lib/countries.ts

Exports a single constant: `MASTER_COUNTRIES: CountryEntry[]`.

Each entry:
```typescript
interface CountryEntry {
  name: string;   // e.g. 'Brazil'
  iso: string;    // lowercase ISO 3166-1 alpha-2, e.g. 'br'
  tier: 1 | 2 | 3 | 4 | 5;
}
```

The array contains 197 entries covering all sovereign states (tiers 1-5: 20/20/37/58/62). It is the authoritative source for:
- `scripts/seed.ts` (populates the `countries` table)
- `scripts/download-flags.ts` (downloads SVGs from flagcdn.com)

The `flag_path` in the DB is derived at seed time as `/flags/${iso}.svg` and is never re-computed at runtime.

---

### 7.5 lib/types.ts

Shared TypeScript interfaces used across API routes, pages, and the game module.

```typescript
SessionUser       { id, username, currentLevel }
Country           { id, name, flagPath, difficultyTier }
Question          { countryId, flagPath, options: string[], correctOption }
StartGameResponse { level, questions: Question[] }
SubmitAnswer      { countryId, answer: string | null }
AnswerKeyItem     { countryId, flagPath, correctOption, userAnswer, isCorrect }
SubmitGameResponse{ score, total, passed, newCurrentLevel, answerKey: AnswerKeyItem[] }
```

---

### 7.6 lib/security.ts

Provides two security capabilities used by the auth and game API routes: an in-memory rate limiter and a CSRF same-origin check.

#### Rate limiter

A fixed-window in-memory rate limiter backed by a `Map<string, Bucket>` singleton in the module scope.

| Export | Signature | Description |
|--------|-----------|-------------|
| `rateLimit` | `(opts: RateLimitOptions) => RateLimitResult` | Checks and increments a named bucket. Returns `{ ok: true }` if within limit, `{ ok: false, retryAfter: number }` if exceeded. |
| `clientIp` | `(req: NextRequest) => string` | Extracts client IP from `X-Forwarded-For` or `X-Real-IP` headers; falls back to `'unknown'`. |
| `tooManyRequests` | `(retryAfter: number) => NextResponse` | Returns a 429 response with `Retry-After` header and JSON body. |

`RateLimitOptions`:
- `key`: unique bucket identifier (e.g. `login:ip:1.2.3.4`, `login:user:alice`, `signup:ip:1.2.3.4`)
- `limit`: maximum requests permitted in the window
- `windowMs`: window duration in milliseconds

**Limits applied:**

| Endpoint | Bucket | Limit | Window |
|----------|--------|-------|--------|
| `POST /api/auth/login` | `login:ip:<ip>` | 20 | 15 min |
| `POST /api/auth/login` | `login:user:<username>` | 10 | 15 min |
| `POST /api/auth/signup` | `signup:ip:<ip>` | 5 | 1 hour |

**Caveat:** The store is in-process memory. On a multi-instance or serverless deployment (e.g. Vercel), each instance maintains its own independent store and limits are not globally enforced. For global enforcement, replace the `Map` with a shared backend such as Redis or Upstash — the call sites do not need to change.

#### CSRF same-origin check

| Export | Signature | Description |
|--------|-----------|-------------|
| `isSameOrigin` | `(req: NextRequest) => boolean` | Returns `true` if the `Origin` header is absent or matches the `Host` header. |
| `crossOriginRejected` | `() => NextResponse` | Returns a 403 response with `{ "error": "Cross-origin request rejected" }`. |

This check is applied on all state-changing POST routes (`/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/game/submit`) as a second CSRF layer alongside `SameSite=lax`. Requests that omit `Origin` (non-browser clients, same-origin navigations) are permitted — browsers always send `Origin` on cross-origin POSTs, so cross-site forgery attempts are still rejected.

---

### 7.7 lib/version.ts

A new, minimal module exporting a single constant:

```typescript
export const APP_VERSION = '0.1.0';
```

Kept manually in sync with `package.json`'s `"version"` field (also `0.1.0` as of this writing). It exists so the login page can render a build/version string without importing `package.json` directly into a client component. Consumed only by `app/login/page.tsx`, which renders `v{APP_VERSION}` (e.g. `v0.1.0`) as static text below the "Sign up" footer line, inside the login card. Not rendered on `/signup` or `/dashboard`. No i18n key is associated with it (the version string is locale-neutral by design). The penetration test classified this as an Info-level, accepted version disclosure (finding F4) — see [Section 12](#12-security-notes).

---

## 8. UI Pages

| Route | Component type | Render strategy | Auth guard |
|-------|---------------|-----------------|------------|
| `/` | Server | Redirect only | None (checks cookie) |
| `/login` | Client | CSR | None |
| `/signup` | Client | CSR | None |
| `/dashboard` | Server | SSR | `getUserFromCookie()` → redirect `/login` |
| `/game/[level]` | Client | CSR | API call returns 401/403 |

**`/dashboard`** directly queries Postgres (via `lib/db.ts` imported in the server component) rather than calling `/api/progress`. The API endpoint is provided as a separate JSON interface for programmatic access.

**`/game/[level]`** manages its own state machine with phases: `loading → playing → feedback → results | error`. Timer and feedback timeout refs are cleaned up on unmount via `useEffect` return functions.

**CSS architecture:** All layout and component styles use CSS Modules. Global tokens (colors, spacing, typography, animations) are defined in `app/globals.css` as CSS custom properties. Four keyframe animations are defined globally: `levelUp`, `shimmer`, `fadeIn`, `pulse`. No CSS framework or utility library is used.

---

## 9. Setup and Running

### Prerequisites

- Node.js >= 18 (tested on Node 26.x)
- npm
- A Supabase project with the schema from Section 5 applied (tables: `users`, `countries`, `user_progress`)

### Install dependencies

```bash
npm install
```

### One-time setup (required before first run)

Both commands are idempotent and safe to re-run.

```bash
# Download 197 SVG flag files from flagcdn.com into public/flags/
npm run download:flags

# Populate the countries table in Supabase Postgres
npm run seed
```

`npm run seed` uses `INSERT INTO ... ON CONFLICT (iso_code) DO NOTHING`, so re-running it will not create duplicate rows. The flag download script skips files that already exist.

The seed script requires `DATABASE_URL` to be set in the environment (or in a `.env` file at the project root) before running.

### Development server

```bash
npm run dev
# Application available at http://localhost:3000
```

### Production build and start

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

### Notes on first run

- `public/flags/` must be populated before the application is used; flags will show broken image icons if the directory is empty.
- There is no local database file to create. The Postgres schema must be applied to the Supabase project before first use.
- `DATABASE_URL` must be set in the environment. The application throws at startup if it is missing.

---

## 10. Running the Test Suite

The suite uses the Node.js built-in `node:test` runner, executed via `tsx`.

```bash
./node_modules/.bin/tsx --tsconfig tests/tsconfig.json --test tests/gtf.test.ts
```

**Pre-conditions:**
- `DATABASE_URL` must be set so the test runner can reach Supabase.
- `npm run download:flags` and `npm run seed` must have been run (several tests open the DB read-only and expect the countries table to be populated).
- `npm run build` must produce a `.next/BUILD_ID` (the integration suite boots a production server on port 3099; it auto-runs `npm run build` if the build artifact is absent).

**Test suites and counts:**

| Suite | Tests | What is covered |
|-------|-------|-----------------|
| `lib/countries.ts` | 6 | Count, tier distribution, ISO uniqueness, flag files on disk |
| `lib/auth.ts — hashPassword/verifyPassword` | 3 | Bcrypt roundtrip, salting |
| `lib/auth.ts — signJwt/verifyJwt` | 4 | JWT roundtrip, tampered secret, expired token |
| `DB / seed integrity` | 10 | Schema columns, row counts, tier distribution |
| `lib/game.ts — buildQuestions` | 37 | tiersForLevel helper; per-level: count, option uniqueness, correct inclusion, no duplicate IDs, tier correctness, flagPath format; level-6 multi-tier |
| `API integration` | 13 | Full E2E auth, level locking, game start, all-correct pass, progress endpoint, lock release, partial-correct fail |
| `API integration — batched-grading equivalence` | 5 | Added for the `submit` route's N+1 → single `ANY()` query rewrite: unknown-`countryId` skip without crashing `ANY()`, duplicate-`countryId` graded independently per submission with order preserved, empty-`answers` array (`total`/`score` = 0), all-15 timed-out (`null`) answers score 0, and a level-bound regression guard (`level: 99999` still rejected after the rewrite) |
| **Total** | **74** | **All passed** |

Test users are created with a timestamped username prefix (`testuser_<epoch>`) and deleted by the `after` hook (`DELETE FROM users WHERE username LIKE 'testuser_%'`). The real database is used (and cleaned up); no test-specific database is provisioned.

---

## 11. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | None | Supabase Postgres connection string (transaction pooler URL, port 6543). The application throws immediately on import of `lib/db.ts` if this is unset. |
| `JWT_SECRET` | **Production** | `'dev-secret-change-me'` | HMAC secret for signing JWTs. Must be overridden in any deployed environment. In production, the application throws when the first token is signed or verified if this is unset. |
| `NODE_ENV` | No | `'development'` | Set to `'production'` by Next.js build/start. Controls the `Secure` flag on the session cookie and the fail-closed behavior of `getJwtSecret()`. |

Create a `.env` file at the project root (already in `.gitignore`) for local development:

```
DATABASE_URL=postgres://...
JWT_SECRET=<random string>
```

No `.env` file is committed to version control.

---

## 12. Security Notes

### What is implemented correctly

- **Password hashing:** bcryptjs with salt rounds = 10. Raw passwords are never logged or returned. `verifyPassword` uses `bcrypt.compare`, which is timing-safe.
- **JWT security:** Tokens are signed with `JWT_SECRET` via the lazy `getJwtSecret()` helper that throws in production if the variable is unset (fail-closed). Tokens have a 7-day expiry and are verified on every protected request. `verifyJwt` returns `null` for expired, malformed, or differently-signed tokens.
- **Cookie security:** `gtf_token` is `httpOnly` (JavaScript cannot read it), `SameSite=lax` (CSRF mitigation), `path=/`, `maxAge=7d`, and `Secure` in production. Logout uses `maxAge=0` to expire the cookie immediately.
- **SQL injection prevention:** All queries use the `postgres` library's tagged-template syntax (e.g. `` sql`SELECT ... WHERE id = ${id}` ``). The library parameterizes values automatically — no string interpolation of user data reaches the database. The `ANY($1)` array parameter in `buildQuestions` is also handled safely by the library.
- **Server-side grading:** `POST /api/game/submit` looks up the correct answer for each `countryId` from the database. It does not trust any client-sent "correct" values. The `correctOption` field returned by `GET /api/game/start` is used only for client-side feedback rendering.
- **Level access enforcement:** `GET /api/game/start` checks `level > user.currentLevel` (loaded fresh from the DB) and returns 403. `POST /api/game/submit` additionally rejects any `level` that is not a positive integer in the range `[1, user.currentLevel]`, preventing arbitrary level-jumping via a crafted body.
- **Auth guards:** Every protected route handler calls `getUserFromCookie()` and returns 401 if the result is null. No route relies on the client sending a user ID.
- **Rate limiting:** Login is capped at 20 requests/15 min per IP and 10 requests/15 min per username. Signup is capped at 5 requests/hour per IP. Both return 429 with `Retry-After` when exhausted.
- **CSRF defense-in-depth:** All state-changing POST routes check the `Origin` header against `Host` via `isSameOrigin()` in `lib/security.ts`. Requests with no `Origin` (direct API clients, same-origin navigations) pass; cross-origin POSTs are rejected with 403.
- **Security headers:** `next.config.js` injects the following headers on every response:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
  - `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  - (`'unsafe-inline'` for `style-src` and `script-src` is required by Next.js 14's CSS Modules injection and hydration inline scripts; the app itself does not use `dangerouslySetInnerHTML` or `eval`.)

### Production deployment checklist

1. Set `DATABASE_URL` to the Supabase transaction pooler connection string.
2. Set `JWT_SECRET` to a cryptographically random string (e.g. `openssl rand -hex 32`). The application throws in production if this is absent.
3. Ensure `NODE_ENV=production` so the `Secure` cookie flag is active (requires HTTPS).
4. Rotate the Supabase database password from its initial value to a strong random credential, and store it only in the host's secret manager (never in `.env` files committed to version control).
5. Consider placing the application behind a reverse proxy (nginx, Caddy) to handle TLS termination.

### Penetration test findings (2026-06-15, pre-launch)

An authorized pre-launch security assessment (static source review + local dynamic
testing; no production Supabase or external host was touched) was run against the
post-Supabase-migration codebase. The architecture was found fundamentally sound —
parameterized SQL throughout (no SQLi), identity always derived from the JWT rather
than client input (no IDOR), httpOnly/Secure cookies, bcrypt with generic login
errors, no `dangerouslySetInnerHTML`/`eval` (no XSS sink), and **no `service_role`
key exposed to the client**.

**Remediation status (2026-06-15):** all findings except C1 have been fixed in code.
C1 is an operational action (password rotation) the owner must perform in Supabase.

| ID | Severity | Finding | Location | Status |
|----|----------|---------|----------|--------|
| C1 | **Critical** | Live Supabase DB password in plaintext on disk, weak value (`guesstheflag123`). `.env` is gitignored and **not** in git history (not leaked via repo), but the credential is trivially guessable and the pooler endpoint is internet-reachable. | `.env:1` | **Open** — owner must rotate the password and move the secret to the host's secret manager. |
| H2 | **High** | Arbitrary level unlock in submit. `level` from the request body was only checked truthy — never bounded — then used in `UPDATE users SET current_level = level + 1`. With enumerable correct `countryId`s, a user could POST `level: 99999` and skip the entire progression. | `app/api/game/submit/route.ts` | **Fixed** — submit now rejects unless `Number.isInteger(level) && 1 <= level <= user.currentLevel`. Also closes the `level` type-confusion. |
| H3 | **High** | No rate limiting / lockout on auth endpoints; signup's 409 "Username already taken" is a username-enumeration oracle. | `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts` | **Fixed** — added `lib/security.ts` rate limiter: login 20/15min per IP + 10/15min per username; signup 5/hour per IP. |
| M4 | Medium | `JWT_SECRET` falls back to hardcoded `'dev-secret-change-me'`. If unset in production, anyone can forge a token for any user. | `lib/auth.ts` | **Fixed** — `getJwtSecret()` throws in production when `JWT_SECRET` is missing (resolved lazily so `next build` is unaffected); dev fallback retained for local use only. |
| M5 | Medium | No security headers (empty `next.config.js`: no HSTS/CSP/X-Frame-Options → clickjackable) and `npm audit` flags High-severity vulns in `next@14.2.35`. | `next.config.js`, `package.json` | **Fixed (headers)** — `next.config.js` now sends HSTS, CSP (`frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. **Deferred (deps)** — see note below. |
| L6 | Low | Weak password policy (6-char minimum only); worse combined with H3. | `app/api/auth/signup/route.ts` | **Fixed** — minimum raised to 10 characters. |
| L7 | Low | Username content unvalidated (control chars, homoglyphs, whitespace-only). | `app/api/auth/signup/route.ts` | **Fixed** — username trimmed and constrained to `^[A-Za-z0-9_.-]+$`. |
| L8 | Low | State-changing POSTs rely on cookie auth with no CSRF token. | `lib/security.ts`, auth/game POST routes | **Fixed** — added a same-origin (`Origin`-header) check on signup, login, logout, and game/submit as defence-in-depth atop `SameSite=lax`. |

**Notes on residual items:**

- **M5 (dependency advisories):** `next@14.2.35` is already the latest 14.2.x release;
  the outstanding `npm audit` advisories only have a fix in Next 16 (a breaking major
  upgrade). They are **not exploitable in this app's configuration** — it uses the App
  Router (not the Pages-Router i18n middleware path), does not use `next/image` remote
  optimization, has no `beforeInteractive` scripts, and the postcss advisory is
  build-time only. A Next 16 upgrade is recommended as a separate, tested effort (it
  also requires renaming the `next.config.js` keys per the Known Limitations section).
- **Rate limiter scope:** `lib/security.ts` uses an in-memory store, appropriate for a
  single-server deployment. On a multi-instance / serverless host (e.g. Vercel), move
  the store to a shared backend (Redis / Upstash) for the limits to be global.

### Penetration test findings (2026-06-20, 4-item bug-fix batch)

A follow-up authorized pre-launch review re-scoped to the 4-item bug-fix batch (retry
button, batched `submit` grading, HUD exit link, version text) against `main`. The
previously-accepted items (C1 weak DB password, the "crafted client can submit
known-correct countryIds" trade-off, the timer anti-pattern) were re-checked for
regression and confirmed unaffected by this batch. **Verdict: PASS — no Critical or
High findings.**

| ID | Severity | Finding | Location | Status |
|----|----------|---------|----------|--------|
| F1 | Info | `WHERE id = ANY(${ids})` SQL-injection safety — verified the array is sent as a single bound Postgres parameter, never string-interpolated; not exploitable. | `app/api/game/submit/route.ts` | No action |
| F2 | Low | No upper bound on `answers.length`. An authenticated, same-origin request could submit an oversized `answers` array, causing an unbounded array/Map allocation. Pre-existing gap (the prior N+1 loop had the same exposure, arguably worse), now in scope on the changed lines. | `app/api/game/submit/route.ts` | **Open** — recommended fix: reject `answers.length > 15` (the game is fixed at 15 questions) before querying. |
| F3 | Low | No element-shape validation on `answers[]`. A malformed element (e.g. `null` in the array) throws an unhandled `TypeError`, surfacing as a generic 500. Not a true regression (the prior per-row loop would have thrown identically) but newly exercised by the `.map()` introduced in this batch. | `app/api/game/submit/route.ts` | **Open** — recommended fix: validate each element has an integer `countryId` and a `null`-or-string `answer` before grading. |
| F4 | Info | Version disclosure (`v0.1.0`) on the public login page. Own application version only, not a framework/dependency version; no CVE-mappable signal. | `lib/version.ts`, `app/login/page.tsx` | Accept |
| F5 | Info | "Back to Dashboard" exit path verified to record no progress (only `POST /api/game/submit` writes `user_progress`/`current_level`); no IDOR or auth regression; retry path does not weaken the server-side H2 level-bound check. | `app/game/[level]/page.tsx` | No action |

**F2 and F3 are explicitly not yet implemented.** Both are Low severity and were
recommended as a single small, surgical follow-up edit (length cap + element-shape
guard, combinable in one validation check) but were left out of this batch per the
pipeline's no-loop-back-for-Low rule. Track as a fast-follow hardening item.

---

## 13. Known Limitations and Accepted Trade-offs

### Accepted by design (spec-documented)

**Client can spoof a perfect score via crafted POST body.** `POST /api/game/submit` computes `total` from the number of submitted answers that match a valid `countryId`, and `passed` from `score === total && total === 15`. A client could POST 15 entries all referencing a single valid `countryId` with the correct answer repeated. The spec explicitly calls this out as an accepted trade-off for an educational game: "do not over-engineer anti-cheat." The H2 fix (level-bound validation) prevents this from being combined with arbitrary progression jumps, but the score-spoofing vector within a legitimately unlocked level remains by design.

**Correct answers returned to client on game start.** `GET /api/game/start` returns `correctOption` in each question object so the game page can render immediate feedback without an extra round-trip. This is a deliberate UX choice; the spec acknowledges it. Server-side grading is not weakened by it.

### Low-severity issues (identified in review)

**No countryId validation on submit.** The submit handler does not verify that submitted `countryId` values are unique or belong to the tiers associated with `level`. If ever desired, validate that the 15 IDs are distinct and all have `difficulty_tier IN (tiersForLevel(level))`.

**React anti-pattern in timer effect.** In `app/game/[level]/page.tsx`, `handleAnswer(null)` is called from inside a `setTimeLeft` state updater callback. This works in production (the interval is already cleared before the call), but it can double-invoke under React's StrictMode in development. No functional bug was observed.

### Infrastructure limitations

**Single-process rate limiting.** The rate limiter in `lib/security.ts` uses an in-memory `Map`. On multi-instance or serverless deployments, each process tracks its own counts; limits are not globally enforced. Replace with a shared Redis/Upstash store if deploying to a horizontally scaled environment.

**Supabase dependency.** The application requires an active Supabase project and internet connectivity to the Supabase pooler endpoint. There is no offline or self-hosted database option without changing `lib/db.ts`.

**`next.config.js` uses the Next.js 14 API.** The `experimental.serverComponentsExternalPackages` key is no longer present (it was used for `better-sqlite3` which has been removed). If the project is upgraded to Next.js 15, review the `next.config.js` key names for any renamed options.

**No password reset or account management.** There is no "forgot password" flow. Passwords can only be changed by directly updating the database.

---

## 14. Diagrams

### 14.1 Use Case Diagram

```
+-------------------------------------------------------+
|                   Guess the Flag System               |
|                                                       |
|  +----------+                                         |
|  |          |--- Sign Up --------------------------->|
|  |          |--- Log In  --------------------------->|
|  |          |--- Log Out --------------------------->|
|  |          |--- View Dashboard (levels/progress) -->|
|  |  Player  |--- Start Level (unlocked only) ------->|
|  |  (User)  |--- Answer Question ------------------->|
|  |          |--- Timeout (auto-answer null) -------->|
|  |          |--- Submit Game ----------------------->|
|  |          |--- View Results / Answer Key --------->|
|  |          |--- Retry Level ----------------------->|
|  |          |--- Play Next Level (on pass) --------->|
|  +----------+                                         |
|                                                       |
|  +----------+                                         |
|  |  Admin / |--- Run download:flags (one-time) ---->  |
|  |  Operator|--- Run seed (one-time) --------------> |
|  +----------+                                         |
+-------------------------------------------------------+
```

### 14.2 Activity Diagram — Full Game Flow

```
[User visits /]
      |
      v
 Has valid gtf_token?
  /          \
Yes           No
  |            |
  v            v
[/dashboard] [/login]
                |
                v
        Enter credentials
                |
                v
        POST /api/auth/login
                |
         Credentials valid?
          /          \
        No            Yes
         |             |
    Show error     Set cookie
                       |
                       v
                 [/dashboard]
                       |
                 Click "Start Level N"
                       |
                       v
              GET /api/game/start?level=N
                       |
                  Level locked?
                  /         \
                Yes           No
                 |             |
              403 error    Load 15 questions
                               |
                     +---------+
                     |
                     v
               [Question loop: i = 1..15]
                     |
               Display flag + 4 options
                     |
                   Timer (15s)
                  /        \
            Timeout         User clicks option
               |                  |
          answer = null      answer = string
                  \               /
                   v             v
              Record {countryId, answer}
                           |
                     Show feedback (800ms)
                           |
                     i < 15?
                    /       \
                  Yes         No
                   |           |
                (next Q)  POST /api/game/submit
                                    |
                           score === 15?
                           /          \
                         Yes            No
                          |              |
                    Level Up!        Fail screen
                    Unlock next      Show answer key
                    level            [Retry / Dashboard]
                    Show answer key
                    [Next Level / Dashboard]
```

### 14.3 Sequence Diagram — Game Round

```
Browser (client)          Next.js Server          Supabase Postgres
       |                        |                        |
       |-- GET /game/[level] -->|                        |
       |<-- HTML (client page)--|                        |
       |                        |                        |
       |-- GET /api/game/start  |                        |
       |      ?level=N -------->|                        |
       |                        |-- getUserFromCookie()  |
       |                        |-- SELECT users         |
       |                        |<-- user row ----------|
       |                        |                        |
       |                        |-- buildQuestions(N)    |
       |                        |-- SELECT countries     |
       |                        |   WHERE tier = ANY(…)  |
       |                        |<-- pool rows ---------/
       |                        |                        |
       |<-- 200 StartGameResponse|                       |
       |    (15 questions) -----|                        |
       |                        |                        |
       |  [user answers 15 Qs]  |                        |
       |                        |                        |
       |-- POST /api/game/submit|                        |
       |   { level, answers } ->|                        |
       |                        |-- origin check         |
       |                        |-- getUserFromCookie()  |
       |                        |-- SELECT users         |
       |                        |<-- user row ----------|
       |                        |                        |
       |                        |-- for each countryId:  |
       |                        |   SELECT countries     |
       |                        |<-- name, flag_path ---|
       |                        |   (grade answer)       |
       |                        |                        |
       |                        |-- UPSERT user_progress |
       |                        |-- UPDATE users         |
       |                        |   current_level (pass) |
       |                        |<-- ok ----------------|
       |                        |                        |
       |<-- 200 SubmitGameResponse                       |
       |    (score, passed,      |                       |
       |     answerKey) ---------|                       |
       |                        |                        |
       |  [show results screen] |                        |
```

### 14.4 Functional Flow Diagram

```
  MASTER_COUNTRIES (lib/countries.ts)
         |
         +---> scripts/download-flags.ts ---> public/flags/*.svg
         |
         +---> scripts/seed.ts
                     |
                     v
              Supabase Postgres [countries table]
                     |
                     +<--- lib/db.ts (postgres singleton via DATABASE_URL)
                     |
         +-----------+-----------+
         |           |           |
         v           v           v
  lib/auth.ts   lib/game.ts  API routes
    hashPw       buildQs()   (use sql
    verifyPw     tiersFor       singleton)
    signJwt      Level()
    verifyJwt
    getUser
    FromCookie

  lib/security.ts (rate limit + CSRF origin check)
         |
         v
    app/api/** (POST route handlers)
         |
    +----+----+----+----+----+----+
    |    |    |    |    |    |    |
  signup login logout me start submit progress
    |                        |      |
    +------------------------+------+
                             |
                        app/game/[level]/page.tsx
                        app/dashboard/page.tsx
                        app/login/page.tsx
                        app/signup/page.tsx
```

### 14.5 Component Diagram

```
+--------------------------------------------------+
|  Next.js App                                      |
|                                                   |
|  [Server Components]       [Client Components]   |
|  app/page.tsx              app/login/page.tsx     |
|  app/layout.tsx            app/signup/page.tsx    |
|  app/dashboard/page.tsx    app/game/[level]/      |
|        |                       page.tsx           |
|        |                   app/dashboard/         |
|        |                       LogoutButton.tsx   |
|        |                                          |
|  [API Route Handlers — Node.js runtime]           |
|  api/auth/signup    api/auth/login                |
|  api/auth/logout    api/auth/me                   |
|  api/game/start     api/game/submit               |
|  api/progress                                     |
|        |                                          |
|  +-----+-----------------------------------+      |
|  |           lib/                          |      |
|  |  db.ts <-- auth.ts    game.ts           |      |
|  |    |         |          |               |      |
|  |    |      bcryptjs   countries.ts       |      |
|  |    |      jsonwebtoken  types.ts        |      |
|  |    |      security.ts  countryNames.ts  |      |
|  |    |      i18n.ts                       |      |
|  +----+-----------------------------------+      |
|       |                                          |
|  [Supabase Postgres — via DATABASE_URL]          |
|    users | countries | user_progress             |
|                                                   |
|  [Static Assets]                                 |
|    public/flags/*.svg (197 files)                 |
+--------------------------------------------------+

External dependencies (one-time setup only):
  scripts/download-flags.ts --> https://flagcdn.com/<iso>.svg
  (Never called during runtime)
```

---

*End of documentation.*
