# 🏴 Guess the Flag

A web-based educational game: identify countries by their flags across five
escalating difficulty levels. Built with the Next.js App Router, it serves both
the UI and the API from a single application and ships with all flag assets
locally — no third-party calls during gameplay.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Features

- 🎯 **197 countries** — all UN member states plus Vatican City, Palestine, Kosovo, and Taiwan, organised into five difficulty tiers.
- 🪜 **Progressive levels** — each level has 15 questions; a perfect **15/15** is required to unlock the next level. Levels 1–5 map to tiers 1–5; level 6+ draws from a combined tier 4+5 pool.
- ⏱️ **Timed questions** — 15 seconds per question (a timeout counts as wrong), 4 options each.
- ✅ **Server-side grading** — answers are re-graded from the database, so the score can't be faked from the client.
- 🌍 **Multilingual UI** — English, Hindi (हिन्दी), Bengali (বাংলা), and Punjabi (ਪੰਜਾਬੀ), with localized country names.
- 🔐 **Accounts & progress** — sign up / log in with password hashing and a JWT session cookie; progress is persisted per user.
- 🖼️ **Offline flag assets** — flag SVGs are stored locally, so no network requests are made during play.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 14** (App Router, TypeScript) |
| Database | **PostgreSQL** (e.g. Supabase) via the [`postgres`](https://www.npmjs.com/package/postgres) library with parameterized tagged-template queries |
| Auth | `bcryptjs` password hashing + JWT in an httpOnly cookie |
| Styling | CSS Modules + a global stylesheet (no UI framework) |
| Flags | Local SVGs under `public/flags/<iso>.svg` |

## Getting Started

### Prerequisites

- Node.js 18+
- A PostgreSQL database (a Supabase project works well)

### 1. Install

```bash
git clone https://github.com/sandeepchoudhury/GuessTheFlag.git
cd GuessTheFlag
npm install
```

### 2. Configure environment

Create a `.env` file in the project root (this file is gitignored and must
**never** be committed):

```bash
# PostgreSQL connection string.
# If using the Supabase transaction pooler (port 6543), keep prepared
# statements disabled in the client config (already handled in lib/db.ts).
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# Secret used to sign JWT session tokens. Use a long, random value.
# Required in production — the app refuses to start auth without it.
JWT_SECRET="replace-with-a-long-random-string"
```

> **Security:** never put real credentials in source control, screenshots, or
> issues. Use your host's secret manager (e.g. Vercel Environment Variables) for
> production, and rotate any secret that has ever been exposed.

### 3. Initialize the database

Apply the schema (in `db/schema.sql`) to your database once, then download the
flag assets and seed the countries table:

```bash
npm run download:flags   # fetch flag SVGs into public/flags (one-time)
npm run seed             # populate the countries table (needs DATABASE_URL)
```

### 4. Run

```bash
npm run dev              # development server at http://localhost:3000
# or
npm run build && npm start   # production build + server
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Start the production server (after `build`) |
| `npm run lint` | Run ESLint |
| `npm run download:flags` | Download flag SVGs (one-time / after adding countries) |
| `npm run seed` | (Re)populate the `countries` table |

### Tests

The integration suite builds the app and starts its own server; database-backed
tests require a reachable `DATABASE_URL`:

```bash
npm run build
./node_modules/.bin/tsx --tsconfig tests/tsconfig.json --test tests/gtf.test.ts
```

## Project Structure

```
app/
  api/            Route handlers (auth, game, progress)
  dashboard/      Level selection / progress dashboard
  game/[level]/   Gameplay screen
  login/  signup/ Auth pages
  globals.css     Global styles
components/        Shared client components (e.g. LanguageSwitcher)
lib/              Domain logic: countries, i18n, game, db, auth, security
db/schema.sql     PostgreSQL schema (users / countries / user_progress)
public/flags/     Flag SVG assets
scripts/          download-flags, seed
tests/            Test suite
```

To add or re-tier countries, edit `lib/countries.ts` (the source of truth), then
run `npm run download:flags` and `npm run seed`.

## Security Notes

- Passwords are hashed with bcrypt; sessions use a signed, httpOnly JWT cookie
  (marked `Secure` in production).
- Grading is performed server-side from the database.
- Login and signup are rate-limited and protected by a same-origin (CSRF) check.
- Security headers (HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`) are sent from `next.config.js`. The
  Content-Security-Policy is strict in production and only relaxes `unsafe-eval`
  in development (needed by the Next.js dev server).

For any deployment, set `JWT_SECRET` and `DATABASE_URL` via your host's secret
manager — not in committed files.

## Contributing

Issues and pull requests are welcome. Please keep credentials and any personal
data out of issues, screenshots, and commits.

## License

Released under the [MIT License](LICENSE).

> Note: flag artwork and country data are sourced from third parties and may
> carry their own terms; verify before redistribution.
