# Guess the Flag — Functional & Technical Documentation

> Generated: 2026-06-11. All facts are verified directly against source code.

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

**Guess the Flag** is a self-hosted, browser-based educational game where registered users identify national flags from multiple-choice options. The application is a single Next.js 14 App Router project that serves both the UI and API from one codebase. Progress is persisted per user in a local SQLite database. All flag images are served as local SVG assets — no external network calls occur during gameplay.

---

## 2. Purpose and Scope

| Dimension | Detail |
|-----------|--------|
| Domain | Geography / flag-recognition education |
| Target users | Anyone who wants to learn to identify world flags |
| Deployment model | Single-server Node.js process (Next.js production build) |
| Data persistence | SQLite file at `data/app.db` |
| Authentication | Username + password; JWT stored in an httpOnly cookie |
| Country coverage | 197 countries (all sovereign states) across 5 difficulty tiers |
| Out of scope | Multiplayer, leaderboards, social features, mobile-native app |

---

## 3. Functional Documentation

### 3.1 User Flows

#### Signup

1. User visits `/` — server component checks for a valid `gtf_token` cookie; if none, redirects to `/login`.
2. From `/login`, the user clicks "Sign up" to navigate to `/signup`.
3. The signup form collects username (3–30 characters), password (minimum 6 characters), and a confirmation password. Client-side pre-validation checks that the two password fields match before submitting.
4. The form POSTs to `POST /api/auth/signup`. On success (HTTP 201), the server sets the `gtf_token` cookie and the browser is redirected to `/dashboard`.
5. If the username is already taken, the API returns 409 and an inline error is shown.

#### Login

1. User visits `/login`.
2. The form collects username and password and POSTs to `POST /api/auth/login`.
3. On success (HTTP 200), the `gtf_token` cookie is set and the browser redirects to `/dashboard`.
4. Wrong credentials produce a 401 and an inline error message.

#### Dashboard

1. The dashboard page (`/dashboard`) is a server component. It reads the session via `getUserFromCookie()`. If no valid session exists, the user is redirected to `/login`.
2. The page queries `user_progress` directly from SQLite and renders a grid of level cards.
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
2. The game HUD shows: live score, question counter ("Q X / 15"), a progress bar, and a countdown timer.
3. For each question:
   - A flag SVG is displayed centrally.
   - Four option buttons (country names, shuffled) are presented in a 2×2 grid.
   - The user has 15 seconds to click an answer. If the timer reaches zero, the answer is recorded as `null` (incorrect) and the game auto-advances.
   - On selecting an answer, the chosen button flashes green (correct) or red (wrong), and the correct answer is always highlighted. After an 800 ms feedback delay, the next question loads.
4. After question 15, the accumulated answers are submitted via `POST /api/game/submit`. A loading spinner is shown during submission.

#### Level Completion (Results Screen)

After submission the results screen renders:

- **Pass (15/15):** A trophy icon, "Level Up!" animated text, the score, a congratulations message showing the newly unlocked level number, a "Play Level N+1" button, and a "Dashboard" link.
- **Fail (< 15/15):** A "retry" icon, the score, an encouraging message ("You need 15/15 to pass. Keep trying!"), a "Retry Level N" button, and a "Dashboard" link.

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
| Framework | Next.js App Router | ^14.2.0 |
| Language | TypeScript | ^5.4.0 |
| UI | React | ^18.3.0 |
| Database | SQLite via better-sqlite3 | ^12.10.0 |
| Password hashing | bcryptjs | ^2.4.3 |
| Session tokens | jsonwebtoken | ^9.0.2 |
| Styling | Vanilla CSS Modules + globals.css | — |
| Script runner | tsx | ^4.7.0 |
| Runtime | Node.js | 26.x (tested) |

better-sqlite3 is synchronous by design. All DB calls in route handlers are blocking but fast — appropriate for a single-user or lightly concurrent deployment. The `export const runtime = 'nodejs'` directive is present on every API route to prevent Next.js from routing them through the Edge runtime.

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
│   ├── db.ts                          # SQLite singleton + schema bootstrap
│   ├── auth.ts                        # Auth helpers (hash, JWT, cookie)
│   ├── game.ts                        # buildQuestions(), tiersForLevel(), constants
│   ├── countries.ts                   # MASTER_COUNTRIES static data
│   └── types.ts                       # Shared TypeScript interfaces
├── scripts/
│   ├── download-flags.ts              # One-time: downloads 100 SVGs from flagcdn.com
│   └── seed.ts                        # One-time: populates countries table
├── tests/
│   ├── gtf.test.ts                    # 70-test suite (node:test runner)
│   └── tsconfig.json                  # Test-specific TS config (commonjs, react jsx)
├── public/
│   └── flags/                         # 100 local SVG flag files (e.g. us.svg, jp.svg)
├── data/
│   └── app.db                         # SQLite database file (runtime-created)
├── next.config.js                     # experimental.serverComponentsExternalPackages: ['better-sqlite3']
├── tsconfig.json                      # strict:true, @/* path alias, bundler moduleResolution
├── package.json
└── .gitignore                         # node_modules, .next, /data/*.db*
```

---

## 5. Database Schema

The schema is bootstrapped by `lib/db.ts` on first import using `CREATE TABLE IF NOT EXISTS`. The database file lives at `data/app.db` (created automatically if the `data/` directory does not exist).

```sql
-- WAL journal mode and foreign key enforcement are set at connection open.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  current_level INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS countries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  iso_code        TEXT    NOT NULL UNIQUE,      -- lowercase ISO 3166-1 alpha-2 (e.g. 'us')
  flag_path       TEXT    NOT NULL,             -- e.g. '/flags/us.svg'
  difficulty_tier INTEGER NOT NULL CHECK (difficulty_tier BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS user_progress (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level_id  INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,         -- 0 = not completed, 1 = completed
  attempts  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, level_id)
);
```

**Column notes:**

- `users.current_level`: the next level the user is allowed to play. Starts at 1. Incremented to `level + 1` when a user passes `level` (if `level >= current_level` at submission time).
- `countries.flag_path`: always `/flags/<iso_code>.svg`; this is a relative URL path served from the Next.js `public/` directory.
- `user_progress.completed`: SQLite integer used as a boolean (0/1). An upsert on pass sets it to 1; a failed attempt preserves the existing value.
- `user_progress.attempts`: incremented on every submission (pass or fail).
- Cascade delete: deleting a user also removes their `user_progress` rows.

---

## 6. API Endpoint Reference

All routes require `export const runtime = 'nodejs'`. Auth-protected routes resolve the session via `getUserFromCookie()` (reads the `gtf_token` httpOnly cookie, verifies the JWT, and fetches the current user row from SQLite). Error responses always have the shape `{ "error": "<message>" }`.

---

### POST /api/auth/signup

Creates a new user account and issues a session cookie.

**Request body (JSON):**
```json
{
  "username": "string",          // 3–30 characters, must be unique
  "password": "string",          // minimum 6 characters
  "confirmPassword": "string"    // must match password
}
```

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 201 | Success | `{ "user": { "id": number, "username": string, "currentLevel": 1 } }` |
| 400 | Invalid JSON | `{ "error": "Invalid JSON" }` |
| 400 | Username length violation | `{ "error": "Username must be 3-30 characters" }` |
| 400 | Password too short | `{ "error": "Password must be at least 6 characters" }` |
| 400 | Passwords mismatch | `{ "error": "Passwords do not match" }` |
| 409 | Username already taken | `{ "error": "Username already taken" }` |

On success, sets `Set-Cookie: gtf_token=<JWT>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` (Max-Age=604800 = 7 days). The `Secure` flag is added only when `NODE_ENV === 'production'`.

---

### POST /api/auth/login

Authenticates an existing user and issues a session cookie.

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

On success, sets the same `gtf_token` cookie as signup.

---

### POST /api/auth/logout

Clears the session cookie.

**Request body:** None.

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ "ok": true }` |

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
    // ... 14 more
  ]
}
```

Note: `correctOption` is returned in the response (needed for immediate client-side feedback rendering). Server-side grading on submit does not trust any client-sent correct answers — it re-derives them from the DB using `countryId`.

---

### POST /api/game/submit

Grades a completed game session, persists progress, and optionally advances the user's level. Auth required.

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

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Always on valid request | See below |
| 400 | Invalid JSON | `{ "error": "Invalid JSON" }` |
| 400 | Missing `level` or `answers` not array | `{ "error": "Invalid request body" }` |
| 401 | Not authenticated | `{ "error": "Unauthorized" }` |

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
    // ... 14 more
  ]
}
```

**Pass logic (verified from source):**
```
passed = (score === total) && (total === 15)
```

Both conditions must hold — submitting fewer than 15 answers cannot produce a pass. On pass, `user_progress` is upserted with `completed = 1, attempts + 1`. If `level >= user.current_level` at submission time, `users.current_level` is set to `level + 1`. On fail, `user_progress` is upserted with `attempts + 1` (completed value is not reset if it was previously 1).

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

Opens (and on first run creates) the SQLite database at `data/app.db`. The `data/` directory is created with `fs.mkdirSync` if absent. A module-level singleton `db` is exported.

Configuration applied at connection open:
- `PRAGMA journal_mode = WAL` — Write-Ahead Logging for better concurrent read performance.
- `PRAGMA foreign_keys = ON` — Enforces the `REFERENCES users(id) ON DELETE CASCADE` constraint in `user_progress`.

The schema DDL is executed once via `db.exec(...)` using `CREATE TABLE IF NOT EXISTS`, making repeated imports (and server restarts) safe.

**Export:** `export default db` — a `better-sqlite3` `Database` instance.

---

### 7.2 lib/auth.ts

Provides all authentication primitives.

| Export | Signature | Description |
|--------|-----------|-------------|
| `hashPassword` | `(pw: string) => Promise<string>` | bcryptjs hash, salt rounds = 10 |
| `verifyPassword` | `(pw: string, hash: string) => Promise<boolean>` | bcryptjs compare |
| `signJwt` | `({ uid, username }) => string` | Signs a JWT with `JWT_SECRET`, expires in 7 days |
| `verifyJwt` | `(token: string) => { uid, username } \| null` | Verifies and decodes; returns null on any error |
| `getUserFromCookie` | `() => SessionUser \| null` | Reads `gtf_token` via Next.js `cookies()`, calls `verifyJwt`, fetches `id/username/current_level` from DB |
| `cookieOptions` | `(maxAge?) => object` | Returns cookie attribute object: httpOnly, sameSite=lax, path=/, maxAge, secure (prod only) |
| `COOKIE_NAME` | `'gtf_token'` | The cookie name constant |

`JWT_SECRET` is read from `process.env.JWT_SECRET` with a fallback of `'dev-secret-change-me'`. The fallback allows local development without a `.env.local` file but must be overridden in production.

`getUserFromCookie` calls `cookies()` from `next/headers`, which only works inside a Next.js request context. It cannot be called from tests or scripts outside the server. Pure functions (`hashPassword`, `verifyPassword`, `signJwt`, `verifyJwt`) can be imported freely.

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

**`buildQuestions(level: number): Question[]`**

1. Calls `tiersForLevel(level)` to get the tier set.
2. Queries all `countries` rows matching `WHERE difficulty_tier IN (...)` using parameterized placeholders (array length determines placeholder count).
3. Fisher-Yates shuffles the pool, takes up to 15 as question countries.
4. For each question country:
   - Filters the pool to exclude the correct country.
   - Fisher-Yates shuffles the remaining pool, takes the first 3 as distractors.
   - Combines correct country name + 3 distractor names and Fisher-Yates shuffles the 4 options.
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

## 8. UI Pages

| Route | Component type | Render strategy | Auth guard |
|-------|---------------|-----------------|------------|
| `/` | Server | Redirect only | None (checks cookie) |
| `/login` | Client | CSR | None |
| `/signup` | Client | CSR | None |
| `/dashboard` | Server | SSR | `getUserFromCookie()` → redirect `/login` |
| `/game/[level]` | Client | CSR | API call returns 401/403 |

**`/dashboard`** directly queries SQLite (via `lib/db.ts` imported in the server component) rather than calling `/api/progress`. The API endpoint is provided as a separate JSON interface for programmatic access.

**`/game/[level]`** manages its own state machine with phases: `loading → playing → feedback → results | error`. Timer and feedback timeout refs are cleaned up on unmount via `useEffect` return functions.

**CSS architecture:** All layout and component styles use CSS Modules. Global tokens (colors, spacing, typography, animations) are defined in `app/globals.css` as CSS custom properties. Four keyframe animations are defined globally: `levelUp`, `shimmer`, `fadeIn`, `pulse`. No CSS framework or utility library is used.

---

## 9. Setup and Running

### Prerequisites

- Node.js >= 18 (tested on Node 26.3.0)
- npm

### Install dependencies

```bash
npm install
```

### One-time setup (required before first run)

Both commands are idempotent and safe to re-run.

```bash
# Download 100 SVG flag files from flagcdn.com into public/flags/
npm run download:flags

# Bootstrap the SQLite schema and populate the countries table
npm run seed
```

The seed script uses `INSERT OR IGNORE`, so re-running it will not create duplicate rows. The flag download script skips files that already exist.

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

- `data/app.db` is created automatically by `lib/db.ts` when the application (or seed script) first imports the database module.
- `public/flags/` must be populated before the application is used; flags will show broken image icons if the directory is empty.
- The `data/` directory and `*.db*` files are git-ignored by `.gitignore`.

---

## 10. Running the Test Suite

The suite uses the Node.js built-in `node:test` runner, executed via `tsx`.

```bash
./node_modules/.bin/tsx --tsconfig tests/tsconfig.json --test tests/gtf.test.ts
```

**Pre-conditions:**
- `npm run download:flags` and `npm run seed` must have been run (several tests open `data/app.db` read-only).
- `npm run build` must produce a `.next/BUILD_ID` (the integration suite boots a production server on port 3099; it auto-runs `npm run build` if the build artifact is absent).

**Test suites and counts:**

| Suite | Tests | What is covered |
|-------|-------|-----------------|
| `lib/countries.ts` | 6 | Count, tier distribution, ISO uniqueness, flag files on disk |
| `lib/auth.ts — hashPassword/verifyPassword` | 3 | Bcrypt roundtrip, salting |
| `lib/auth.ts — signJwt/verifyJwt` | 4 | JWT roundtrip, tampered secret, expired token |
| `DB / seed integrity` | 10 | Schema columns, row counts, tier distribution, WAL mode |
| `lib/game.ts — buildQuestions` | 37 | tiersForLevel helper; per-level: count, option uniqueness, correct inclusion, no duplicate IDs, tier correctness, flagPath format; level-6 multi-tier |
| `API integration` | 13 | Full E2E auth, level locking, game start, all-correct pass, progress endpoint, lock release, partial-correct fail |
| **Total** | **70** | **All passed** |

Test users are created with a timestamped username prefix (`testuser_<epoch>`) and deleted by the `after` hook (`DELETE FROM users WHERE username LIKE 'testuser_%'`). The real database is not otherwise mutated.

---

## 11. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Production | `'dev-secret-change-me'` | HMAC secret for signing JWTs. Must be overridden in any deployed environment. |
| `NODE_ENV` | No | `'development'` | Set to `'production'` by Next.js build/start. Controls the `Secure` flag on the session cookie. |

No `.env` file is committed. Create a `.env.local` file for local overrides if desired (already in `.gitignore`).

---

## 12. Security Notes

### What is implemented correctly

- **Password hashing:** bcryptjs with salt rounds = 10. Raw passwords are never logged or returned. `verifyPassword` uses `bcrypt.compare`, which is timing-safe.
- **JWT security:** Tokens are signed with `JWT_SECRET`, have a 7-day expiry, and are verified on every protected request. `verifyJwt` returns `null` for expired, malformed, or differently-signed tokens.
- **Cookie security:** `gtf_token` is `httpOnly` (JavaScript cannot read it), `SameSite=lax` (CSRF mitigation), `path=/`, `maxAge=7d`, and `Secure` in production. Logout uses `maxAge=0` to expire the cookie immediately.
- **SQL injection prevention:** All queries use `better-sqlite3` prepared statements with bound parameters. The dynamic `IN (?, ?)` clause in `buildQuestions` generates placeholders from array length and binds values separately — no string interpolation of user data.
- **Server-side grading:** `POST /api/game/submit` looks up the correct answer for each `countryId` from the database. It does not trust any client-sent "correct" values. The `correctOption` field returned by `GET /api/game/start` is used only for client-side feedback rendering.
- **Level access enforcement:** `GET /api/game/start` checks `level > user.currentLevel` (loaded fresh from the DB) and returns 403. The client's claim of which level to play cannot bypass this.
- **Auth guards:** Every protected route handler calls `getUserFromCookie()` and returns 401 if the result is null. No route relies on the client sending a user ID.

### Production deployment checklist

1. Set `JWT_SECRET` to a cryptographically random string (e.g. `openssl rand -hex 32`).
2. Ensure `NODE_ENV=production` so the `Secure` cookie flag is active (requires HTTPS).
3. Protect the `data/` directory from direct web access (not an issue with Next.js; the directory is outside `public/`).
4. Consider placing the application behind a reverse proxy (nginx, Caddy) to handle TLS termination.

---

## 13. Known Limitations and Accepted Trade-offs

### Accepted by design (spec-documented)

**Client can spoof a perfect score via crafted POST body.** `POST /api/game/submit` computes `total` from the number of submitted answers that match a valid `countryId`, and `passed` from `score === total && total === 15`. A client could POST 15 entries all referencing a single valid `countryId` with the correct answer repeated. The spec (section 6) explicitly calls this out as an accepted trade-off for an educational game: "do not over-engineer anti-cheat."

**Correct answers returned to client on game start.** `GET /api/game/start` returns `correctOption` in each question object so the game page can render immediate feedback without an extra round-trip. This is a deliberate UX choice; the spec acknowledges it. Server-side grading is not weakened by it.

### Low-severity issues (identified in review)

**No countryId validation on submit.** The submit handler does not verify that submitted `countryId` values are unique or belong to the tiers associated with `level`. If ever desired, validate that the 15 IDs are distinct and all have `difficulty_tier IN (tiersForLevel(level))`.

**React anti-pattern in timer effect.** In `app/game/[level]/page.tsx`, `handleAnswer(null)` is called from inside a `setTimeLeft` state updater callback. This works in production (the interval is already cleared before the call), but it can double-invoke under React's StrictMode in development. No functional bug was observed.

### Infrastructure limitations

**Single-file SQLite.** The application is designed for single-server deployment. SQLite's WAL mode supports multiple concurrent readers and one writer, which is adequate for personal or small-group use. It is not suitable for distributed/multi-process deployment.

**No HTTPS or rate limiting built in.** The application provides no built-in rate limiting on auth endpoints (signup/login). A reverse proxy or middleware layer should handle this for any public deployment.

**better-sqlite3 requires a native build.** The `better-sqlite3` package compiles a C++ addon. The package.json pins `^12.10.0` (rather than the originally specced 9.x) because v12 provides prebuilt binaries for Node.js 26. On other Node.js versions, a native build toolchain (python, make, a C++ compiler) may be required.

**`next.config.js` uses the Next.js 14 key.** `experimental.serverComponentsExternalPackages` is correct for Next.js 14. If the project is upgraded to Next.js 15, this key must be changed to `serverExternalPackages` (at the top level, not under `experimental`).

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
Browser (client)          Next.js Server          SQLite (app.db)
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
       |                        |   WHERE tier IN (...)  |
       |                        |<-- 20 rows -----------|
       |                        |                        |
       |<-- 200 StartGameResponse|                       |
       |    (15 questions) -----|                        |
       |                        |                        |
       |  [user answers 15 Qs]  |                        |
       |                        |                        |
       |-- POST /api/game/submit|                        |
       |   { level, answers } ->|                        |
       |                        |-- getUserFromCookie()  |
       |                        |-- SELECT users         |
       |                        |<-- user row ----------|
       |                        |                        |
       |                        |-- for each countryId:  |
       |                        |   SELECT countries     |
       |                        |<-- name, flag_path ---|
       |                        |   (grade answer)       |
       |                        |                        |
       |                        |-- UPSERT user_progress|
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
              data/app.db [countries table]
                     |
                     +<--- lib/db.ts (singleton, schema bootstrap)
                     |
         +-----------+-----------+
         |           |           |
         v           v           v
  lib/auth.ts   lib/game.ts  API routes
    hashPw       buildQs()   (use db
    verifyPw     tiersFor       singleton)
    signJwt      Level()
    verifyJwt
    getUser
    FromCookie
         |
         v
    app/api/** (route handlers)
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
|  |    |                                   |      |
|  +----+-----------------------------------+      |
|       |                                          |
|  [SQLite — data/app.db]                          |
|    users | countries | user_progress             |
|                                                   |
|  [Static Assets]                                 |
|    public/flags/*.svg (100 files)                 |
+--------------------------------------------------+

External dependencies (one-time setup only):
  scripts/download-flags.ts --> https://flagcdn.com/<iso>.svg
  (Never called during runtime)
```

---

*End of documentation.*
