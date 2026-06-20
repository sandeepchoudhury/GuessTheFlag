/**
 * GuessTheFlag test suite
 * Uses Node.js built-in test runner (node:test) via tsx.
 *
 * Run:  cd <project-root> && node --test --require tsx/cjs tests/gtf.test.ts
 * Or:   ./node_modules/.bin/tsx --test tests/gtf.test.ts
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { execSync, spawn, ChildProcess } from 'node:child_process';
import postgres from 'postgres';

// ─── path helpers ────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const FLAGS_DIR = path.join(ROOT, 'public', 'flags');

// ─── global teardown ─────────────────────────────────────────────────────────
// lib/db opens a postgres connection pool at module load (imported transitively
// via lib/game/lib/auth). It is never closed by app code, so without this the
// open pool keeps the event loop alive and the test runner hangs after all tests
// pass. Close it once the whole suite is done.
after(async () => {
  try {
    const sql = (await import('../lib/db')).default;
    await sql.end();
  } catch {
    // lib/db may not have been imported (e.g. DATABASE_URL unset) — nothing to close
  }
});

// ─── helpers ─────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function fetchJson(
  url: string,
  opts: RequestInit = {}
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const res = await fetch(url, opts);
  let body: unknown;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  return { status: res.status, body, headers };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: lib/countries.ts
// ─────────────────────────────────────────────────────────────────────────────
describe('lib/countries.ts', () => {
  // Dynamic import to avoid Next.js path alias issues at tsx level;
  // tsconfig paths are resolved by tsx automatically.
  let MASTER_COUNTRIES: Array<{ name: string; iso: string; tier: 1 | 2 | 3 | 4 | 5 }>;

  before(async () => {
    const mod = await import('../lib/countries');
    MASTER_COUNTRIES = mod.MASTER_COUNTRIES;
  });

  test('exports the full sovereign-state list', () => {
    assert.equal(MASTER_COUNTRIES.length, 197);
  });

  test('has 5 tiers', () => {
    const tiers = new Set(MASTER_COUNTRIES.map((c) => c.tier));
    assert.equal(tiers.size, 5);
    for (let t = 1; t <= 5; t++) assert.ok(tiers.has(t as 1), `tier ${t} missing`);
  });

  test('each tier has at least 20 countries', () => {
    for (let t = 1; t <= 5; t++) {
      const count = MASTER_COUNTRIES.filter((c) => c.tier === t).length;
      assert.ok(count >= 20, `tier ${t} has ${count} countries, expected >= 20`);
    }
  });

  test('every country has hi/bn/pa translations', async () => {
    const { COUNTRY_NAMES } = await import('../lib/countryNames');
    for (const c of MASTER_COUNTRIES) {
      const tr = COUNTRY_NAMES[c.iso];
      assert.ok(tr, `missing translations for ${c.iso} (${c.name})`);
      for (const lang of ['hi', 'bn', 'pa'] as const) {
        assert.ok(tr[lang] && tr[lang].length > 0, `missing ${lang} name for ${c.iso}`);
      }
    }
  });

  test('all ISO codes are unique', () => {
    const isos = MASTER_COUNTRIES.map((c) => c.iso);
    const unique = new Set(isos);
    assert.equal(unique.size, isos.length, 'duplicate ISO codes found');
  });

  test('all ISO codes are lowercase two-letter strings', () => {
    for (const c of MASTER_COUNTRIES) {
      assert.match(c.iso, /^[a-z]{2}$/, `invalid iso code: ${c.iso}`);
    }
  });

  test('flag files exist in public/flags for every country', () => {
    const missing: string[] = [];
    for (const c of MASTER_COUNTRIES) {
      const flagFile = path.join(FLAGS_DIR, `${c.iso}.svg`);
      if (!fs.existsSync(flagFile)) {
        missing.push(c.iso);
      }
    }
    assert.deepEqual(missing, [], `Missing flag files: ${missing.join(', ')}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: lib/auth.ts — pure functions only (no next/headers)
// ─────────────────────────────────────────────────────────────────────────────
describe('lib/auth.ts — hashPassword / verifyPassword', () => {
  let hashPassword: (pw: string) => Promise<string>;
  let verifyPassword: (pw: string, hash: string) => Promise<boolean>;

  before(async () => {
    // Import only bcryptjs directly to test the same logic without pulling in
    // next/headers (which breaks outside a Next.js request context).
    // Handle CJS default interop: the module may be on .default under ESM dynamic import.
    const bcryptMod = await import('bcryptjs');
    const bcrypt: typeof import('bcryptjs') = (bcryptMod as any).default ?? bcryptMod;
    hashPassword = (pw: string) => bcrypt.hash(pw, 10);
    verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
  });

  test('hash and verify roundtrip — correct password returns true', async () => {
    const hash = await hashPassword('correcthorsebattery');
    const ok = await verifyPassword('correcthorsebattery', hash);
    assert.equal(ok, true);
  });

  test('hash and verify roundtrip — wrong password returns false', async () => {
    const hash = await hashPassword('correcthorsebattery');
    const ok = await verifyPassword('wrong-password', hash);
    assert.equal(ok, false);
  });

  test('two hashes of the same password differ (salting)', async () => {
    const h1 = await hashPassword('same-password');
    const h2 = await hashPassword('same-password');
    assert.notEqual(h1, h2);
  });
});

describe('lib/auth.ts — signJwt / verifyJwt', () => {
  let signJwt: (payload: { uid: number; username: string }) => string;
  let verifyJwt: (token: string) => { uid: number; username: string } | null;

  before(async () => {
    const mod = await import('../lib/auth');
    signJwt = mod.signJwt;
    verifyJwt = mod.verifyJwt;
  });

  test('sign and verify roundtrip returns original payload', () => {
    const payload = { uid: 42, username: 'testuser' };
    const token = signJwt(payload);
    const decoded = verifyJwt(token);
    assert.ok(decoded, 'decoded should not be null');
    assert.equal(decoded!.uid, 42);
    assert.equal(decoded!.username, 'testuser');
  });

  test('verifyJwt returns null for a garbage token', () => {
    const result = verifyJwt('not.a.valid.jwt');
    assert.equal(result, null);
  });

  test('verifyJwt returns null for a token signed with wrong secret', async () => {
    const jwtMod = await import('jsonwebtoken');
    const jwt: typeof import('jsonwebtoken') = (jwtMod as any).default ?? jwtMod;
    const wrongToken = jwt.sign({ uid: 1, username: 'x' }, 'wrong-secret', {
      expiresIn: '7d',
    });
    const result = verifyJwt(wrongToken);
    assert.equal(result, null);
  });

  test('verifyJwt returns null for an expired token', async () => {
    const jwtMod = await import('jsonwebtoken');
    const jwt: typeof import('jsonwebtoken') = (jwtMod as any).default ?? jwtMod;
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';
    const expiredToken = jwt.sign({ uid: 1, username: 'x' }, secret, {
      expiresIn: '-1s', // already expired
    });
    const result = verifyJwt(expiredToken);
    assert.equal(result, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: DB / seed integrity
// ─────────────────────────────────────────────────────────────────────────────
describe('DB / seed integrity', () => {
  let sql: ReturnType<typeof postgres>;

  before(async () => {
    sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  });

  after(async () => {
    await sql.end();
  });

  test('users table exists with correct columns', async () => {
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND table_schema = 'public'
    `;
    const names = cols.map((c) => c.column_name);
    for (const col of ['id', 'username', 'password_hash', 'current_level', 'created_at']) {
      assert.ok(names.includes(col), `users table missing column: ${col}`);
    }
  });

  test('countries table exists with correct columns', async () => {
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'countries' AND table_schema = 'public'
    `;
    const names = cols.map((c) => c.column_name);
    for (const col of ['id', 'name', 'iso_code', 'flag_path', 'difficulty_tier']) {
      assert.ok(names.includes(col), `countries table missing column: ${col}`);
    }
  });

  test('user_progress table exists with correct columns', async () => {
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'user_progress' AND table_schema = 'public'
    `;
    const names = cols.map((c) => c.column_name);
    for (const col of ['id', 'user_id', 'level_id', 'completed', 'attempts']) {
      assert.ok(names.includes(col), `user_progress table missing column: ${col}`);
    }
  });

  test('countries table row count matches MASTER_COUNTRIES', async () => {
    const rows = await sql<{ cnt: number }[]>`SELECT COUNT(*)::int AS cnt FROM countries`;
    assert.equal(rows[0].cnt, 197);
  });

  test('all 5 tiers represented in countries table', async () => {
    const rows = await sql<{ difficulty_tier: number }[]>`
      SELECT DISTINCT difficulty_tier FROM countries ORDER BY difficulty_tier
    `;
    const tiers = rows.map((r) => r.difficulty_tier);
    assert.deepEqual(tiers, [1, 2, 3, 4, 5]);
  });

  test('each tier has at least 20 countries in DB', async () => {
    for (let t = 1; t <= 5; t++) {
      const rows = await sql<{ cnt: number }[]>`
        SELECT COUNT(*)::int AS cnt FROM countries WHERE difficulty_tier = ${t}
      `;
      assert.ok(rows[0].cnt >= 20, `tier ${t} has ${rows[0].cnt} rows, expected >= 20`);
    }
  });

  test('iso_code is unique in countries table', async () => {
    const rows = await sql<{ u: number; total: number }[]>`
      SELECT COUNT(DISTINCT iso_code)::int AS u, COUNT(*)::int AS total FROM countries
    `;
    assert.equal(rows[0].u, rows[0].total, 'duplicate iso_codes in countries table');
  });

  test('flag_path matches /flags/<iso>.svg pattern for all rows', async () => {
    const rows = await sql<{ iso_code: string; flag_path: string }[]>`
      SELECT iso_code, flag_path FROM countries
    `;
    for (const row of rows) {
      assert.equal(row.flag_path, `/flags/${row.iso_code}.svg`, `flag_path mismatch for ${row.iso_code}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: lib/game.ts — buildQuestions
// ─────────────────────────────────────────────────────────────────────────────
describe('lib/game.ts — buildQuestions', () => {
  let buildQuestions: (level: number, locale?: import('../lib/i18n').Locale) => Promise<import('../lib/types').Question[]>;
  let tiersForLevel: (level: number) => number[];
  let QUESTIONS_PER_LEVEL: number;
  let OPTIONS_PER_QUESTION: number;
  let sql: ReturnType<typeof postgres>;

  before(async () => {
    const mod = await import('../lib/game');
    buildQuestions = mod.buildQuestions;
    tiersForLevel = mod.tiersForLevel;
    QUESTIONS_PER_LEVEL = mod.QUESTIONS_PER_LEVEL;
    OPTIONS_PER_QUESTION = mod.OPTIONS_PER_QUESTION;
    sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  });

  after(async () => {
    await sql.end();
  });

  // tiersForLevel helper
  test('tiersForLevel: levels 1-5 return single matching tier', () => {
    for (let l = 1; l <= 5; l++) {
      assert.deepEqual(tiersForLevel(l), [l]);
    }
  });

  test('tiersForLevel: level 6 returns [4, 5]', () => {
    assert.deepEqual(tiersForLevel(6), [4, 5]);
  });

  test('tiersForLevel: level 10 returns [4, 5]', () => {
    assert.deepEqual(tiersForLevel(10), [4, 5]);
  });

  // buildQuestions
  for (let lvl = 1; lvl <= 5; lvl++) {
    const level = lvl; // capture for closure
    test(`buildQuestions(${level}) returns exactly 15 questions`, async () => {
      const qs = await buildQuestions(level);
      assert.equal(qs.length, QUESTIONS_PER_LEVEL, `level ${level}: got ${qs.length} questions`);
    });

    test(`buildQuestions(${level}): each question has exactly 4 unique options`, async () => {
      const qs = await buildQuestions(level);
      for (const q of qs) {
        assert.equal(q.options.length, OPTIONS_PER_QUESTION, `expected 4 options, got ${q.options.length}`);
        const unique = new Set(q.options);
        assert.equal(unique.size, OPTIONS_PER_QUESTION, `duplicate options in question: ${JSON.stringify(q.options)}`);
      }
    });

    test(`buildQuestions(${level}): correct option is always present in options`, async () => {
      const qs = await buildQuestions(level);
      for (const q of qs) {
        assert.ok(
          q.options.includes(q.correctOption),
          `correctOption "${q.correctOption}" not in options: ${JSON.stringify(q.options)}`
        );
      }
    });

    test(`buildQuestions(${level}): no duplicate countryIds within the 15 questions`, async () => {
      const qs = await buildQuestions(level);
      const ids = qs.map((q) => q.countryId);
      const unique = new Set(ids);
      assert.equal(unique.size, ids.length, `duplicate countryIds in level ${level}: ${ids}`);
    });

    test(`buildQuestions(${level}): questions come from the correct tiers`, async () => {
      const qs = await buildQuestions(level);
      const expectedTiers = tiersForLevel(level);
      for (const q of qs) {
        const rows = await sql<{ difficulty_tier: number }[]>`
          SELECT difficulty_tier FROM countries WHERE id = ${q.countryId}
        `;
        assert.ok(rows[0], `countryId ${q.countryId} not found in DB`);
        assert.ok(
          expectedTiers.includes(rows[0].difficulty_tier),
          `level ${level}: countryId ${q.countryId} is in tier ${rows[0].difficulty_tier}, expected ${expectedTiers}`
        );
      }
    });

    test(`buildQuestions(${level}): flagPath matches /flags/<iso>.svg pattern`, async () => {
      const qs = await buildQuestions(level);
      for (const q of qs) {
        assert.match(q.flagPath, /^\/flags\/[a-z]{2}\.svg$/, `bad flagPath: ${q.flagPath}`);
      }
    });
  }

  test('buildQuestions(6): uses tiers 4 and 5', async () => {
    const qs = await buildQuestions(6);
    // level 6 draws from tiers 4+5 pool of 40; should still produce 15
    assert.equal(qs.length, QUESTIONS_PER_LEVEL);
    for (const q of qs) {
      const rows = await sql<{ difficulty_tier: number }[]>`
        SELECT difficulty_tier FROM countries WHERE id = ${q.countryId}
      `;
      assert.ok(rows[0]);
      assert.ok([4, 5].includes(rows[0].difficulty_tier), `tier ${rows[0].difficulty_tier} not in [4,5]`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: API Integration Tests
// Starts the Next.js production server, exercises via fetch.
// Test users are cleaned up in the `after` hook.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_USER = `testuser_${Date.now()}`;
const TEST_PASS = 'TestPass123';
const PORT = 3099;
const BASE = `http://localhost:${PORT}`;

describe('API integration', () => {
  let serverProc: ChildProcess;
  let authCookie = '';
  let startResponse: {
    level: number;
    questions: Array<{
      countryId: number;
      flagPath: string;
      options: string[];
      correctOption: string;
    }>;
  };

  async function waitForServer(maxMs = 60000): Promise<void> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${BASE}/api/auth/me`);
        if (res.status === 401 || res.status === 200) return; // server up
      } catch {
        // not ready yet
      }
      await sleep(500);
    }
    throw new Error('Server did not start within timeout');
  }

  before(async () => {
    // Build first if .next doesn't exist
    const nextDir = path.join(ROOT, '.next');
    if (!fs.existsSync(path.join(nextDir, 'BUILD_ID'))) {
      console.log('  [setup] Building Next.js app (this may take ~30s)...');
      execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
    }

    console.log(`  [setup] Starting Next.js on port ${PORT}...`);
    serverProc = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProc.stdout?.on('data', (d: Buffer) => {
      // uncomment to debug: process.stdout.write('[server] ' + d.toString());
    });
    serverProc.stderr?.on('data', (d: Buffer) => {
      // uncomment to debug: process.stderr.write('[server-err] ' + d.toString());
    });

    await waitForServer(90000);
    console.log('  [setup] Server ready.');
  });

  after(async () => {
    // Clean up test user from the Postgres DB
    try {
      const cleanSql = postgres(process.env.DATABASE_URL!, { prepare: false });
      await cleanSql`DELETE FROM users WHERE username LIKE 'testuser_%'`;
      await cleanSql.end();
    } catch (e) {
      console.error('  [teardown] cleanup error:', e);
    }

    if (serverProc) {
      serverProc.kill('SIGTERM');
      // give it a moment to exit
      await sleep(1000);
    }
  });

  test('GET /api/auth/me without cookie returns 401', async () => {
    const r = await fetchJson(`${BASE}/api/auth/me`);
    assert.equal(r.status, 401);
    assert.equal((r.body as any).error, 'Unauthorized');
  });

  test('POST /api/auth/signup creates user and sets cookie', async () => {
    const r = await fetchJson(`${BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS, confirmPassword: TEST_PASS }),
    });
    assert.equal(r.status, 201, `signup failed: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(body.user, 'response should have user');
    assert.equal(body.user.username, TEST_USER);
    assert.equal(body.user.currentLevel, 1);

    // Extract Set-Cookie header
    const setCookie = r.headers['set-cookie'];
    assert.ok(setCookie, 'No Set-Cookie header in signup response');
    authCookie = setCookie.split(';')[0]; // gtf_token=<value>
    assert.ok(authCookie.startsWith('gtf_token='), `Cookie does not start with gtf_token=: ${authCookie}`);
  });

  test('POST /api/auth/signup with duplicate username returns 409', async () => {
    const r = await fetchJson(`${BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS, confirmPassword: TEST_PASS }),
    });
    assert.equal(r.status, 409);
  });

  test('POST /api/auth/login sets cookie and returns user', async () => {
    const r = await fetchJson(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS }),
    });
    assert.equal(r.status, 200, `login failed: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.user.username, TEST_USER);

    const setCookie = r.headers['set-cookie'];
    assert.ok(setCookie, 'No Set-Cookie in login response');
    // Update authCookie from login
    authCookie = setCookie.split(';')[0];
  });

  test('POST /api/auth/login with bad credentials returns 401', async () => {
    const r = await fetchJson(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER, password: 'wrongpassword' }),
    });
    assert.equal(r.status, 401);
  });

  test('GET /api/auth/me with valid cookie returns user', async () => {
    const r = await fetchJson(`${BASE}/api/auth/me`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(r.status, 200, `me failed: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.user.username, TEST_USER);
    assert.equal(body.user.currentLevel, 1);
  });

  test('GET /api/game/start?level=1 without auth returns 401', async () => {
    const r = await fetchJson(`${BASE}/api/game/start?level=1`);
    assert.equal(r.status, 401);
  });

  test('GET /api/game/start?level=2 as new user (currentLevel=1) returns 403', async () => {
    const r = await fetchJson(`${BASE}/api/game/start?level=2`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(r.status, 403, `expected 403 for locked level, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  test('GET /api/game/start?level=1 returns 15 questions with correct structure', async () => {
    const r = await fetchJson(`${BASE}/api/game/start?level=1`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(r.status, 200, `game/start failed: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.level, 1);
    assert.equal(body.questions.length, 15);

    const firstQ = body.questions[0];
    assert.ok(typeof firstQ.countryId === 'number');
    assert.ok(typeof firstQ.flagPath === 'string');
    assert.ok(Array.isArray(firstQ.options) && firstQ.options.length === 4);
    assert.ok(typeof firstQ.correctOption === 'string');
    assert.ok(firstQ.options.includes(firstQ.correctOption));

    startResponse = body;
  });

  test('POST /api/game/submit with all correct answers passes and advances level', async () => {
    assert.ok(startResponse, 'startResponse not set; game/start test must have run first');

    const answers = startResponse.questions.map((q) => ({
      countryId: q.countryId,
      answer: q.correctOption,
    }));

    const r = await fetchJson(`${BASE}/api/game/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({ level: 1, answers }),
    });

    assert.equal(r.status, 200, `submit failed: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.score, 15, `score should be 15, got ${body.score}`);
    assert.equal(body.total, 15);
    assert.equal(body.passed, true);
    assert.equal(body.newCurrentLevel, 2, `currentLevel should advance to 2, got ${body.newCurrentLevel}`);
    assert.equal(body.answerKey.length, 15);
  });

  test('GET /api/progress shows level 1 completed after passing', async () => {
    const r = await fetchJson(`${BASE}/api/progress`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(r.status, 200, `progress failed: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.currentLevel, 2);
    const level1 = body.levels.find((l: any) => l.level === 1);
    assert.ok(level1, 'level 1 entry missing from progress');
    assert.equal(level1.completed, true);
    assert.ok(level1.attempts >= 1);
  });

  test('GET /api/game/start?level=2 now unlocked after level 1 pass', async () => {
    const r = await fetchJson(`${BASE}/api/game/start?level=2`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(r.status, 200, `expected 200 for unlocked level 2, got ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.level, 2);
    assert.equal(body.questions.length, 15);
  });

  test('POST /api/game/submit with a wrong answer does not advance level', async () => {
    // Start level 2 game
    const startR = await fetchJson(`${BASE}/api/game/start?level=2`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(startR.status, 200);
    const startBody = startR.body as any;

    // Submit with first answer wrong (null = timeout)
    const answers = startBody.questions.map((q: any, i: number) => ({
      countryId: q.countryId,
      answer: i === 0 ? null : q.correctOption,
    }));

    const r = await fetchJson(`${BASE}/api/game/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({ level: 2, answers }),
    });

    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.passed, false, 'should not pass with a wrong answer');
    assert.equal(body.score, 14, `expected score 14, got ${body.score}`);
    // currentLevel should stay at 2 (not advance to 3)
    assert.equal(body.newCurrentLevel, 2, `level should stay 2, got ${body.newCurrentLevel}`);
  });

  // ── Batched-grading equivalence (item 2: N+1 loop → single ANY() query) ────
  // These exercise the exact edge cases called out in the spec/changes for the
  // submit-route rewrite: an unknown countryId must be skipped (not crash the
  // ANY() query), a duplicate countryId must be graded independently per
  // submission (map lookup reused, not deduped away), and an empty answers
  // array must not error and must report total === 0 / passed === false.

  test('POST /api/game/submit skips an unknown countryId without crashing ANY()', async () => {
    const startR = await fetchJson(`${BASE}/api/game/start?level=2`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(startR.status, 200);
    const startBody = startR.body as any;

    const UNKNOWN_ID = 999999999; // does not exist in countries table
    const answers = [
      { countryId: UNKNOWN_ID, answer: 'Does Not Matter' },
      ...startBody.questions
        .slice(1)
        .map((q: any) => ({ countryId: q.countryId, answer: q.correctOption })),
    ];

    const r = await fetchJson(`${BASE}/api/game/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ level: 2, answers }),
    });

    assert.equal(r.status, 200, `submit failed: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    // Unknown id is skipped entirely (not pushed into answerKey, not counted in total)
    assert.equal(body.total, 14, `expected total 14 (15 submitted, 1 unknown skipped), got ${body.total}`);
    assert.equal(body.score, 14, `expected score 14, got ${body.score}`);
    assert.equal(body.passed, false, 'total !== 15, so passed must be false even though all known answers are correct');
    assert.equal(body.answerKey.length, 14);
    assert.ok(
      body.answerKey.every((a: any) => a.countryId !== UNKNOWN_ID),
      'unknown countryId must not appear in answerKey'
    );
  });

  test('POST /api/game/submit grades a duplicate countryId independently per submission', async () => {
    const startR = await fetchJson(`${BASE}/api/game/start?level=2`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(startR.status, 200);
    const startBody = startR.body as any;

    // Build 15 answers but repeat question[0]'s countryId for question[1] as well,
    // once with the correct answer and once with a wrong answer — the map-based
    // lookup must resolve both independently (same country row, different
    // submission outcome), not collapse/dedupe them.
    const q0 = startBody.questions[0];
    const rest = startBody.questions.slice(2).map((q: any) => ({ countryId: q.countryId, answer: q.correctOption }));

    const answers = [
      { countryId: q0.countryId, answer: q0.correctOption }, // correct
      { countryId: q0.countryId, answer: 'Definitely Wrong Country Name' }, // same id, wrong answer
      ...rest,
    ];

    const r = await fetchJson(`${BASE}/api/game/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ level: 2, answers }),
    });

    assert.equal(r.status, 200, `submit failed: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.total, 15, 'total counts both duplicate submissions (order preserved)');
    assert.equal(body.score, 14, 'one of the two duplicate-id submissions is correct, the other wrong');
    assert.equal(body.passed, false);
    assert.equal(body.answerKey.length, 15);
    // Order preserved: first two entries both reference q0's countryId
    assert.equal(body.answerKey[0].countryId, q0.countryId);
    assert.equal(body.answerKey[1].countryId, q0.countryId);
    assert.equal(body.answerKey[0].isCorrect, true);
    assert.equal(body.answerKey[1].isCorrect, false);
  });

  test('POST /api/game/submit with empty answers array returns total 0 and passed false', async () => {
    const r = await fetchJson(`${BASE}/api/game/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ level: 2, answers: [] }),
    });

    assert.equal(r.status, 200, `submit failed: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.total, 0);
    assert.equal(body.score, 0);
    assert.equal(body.passed, false);
    assert.deepEqual(body.answerKey, []);
  });

  test('POST /api/game/submit with all 15 timed-out (null) answers scores 0', async () => {
    const startR = await fetchJson(`${BASE}/api/game/start?level=2`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(startR.status, 200);
    const startBody = startR.body as any;

    const answers = startBody.questions.map((q: any) => ({ countryId: q.countryId, answer: null }));

    const r = await fetchJson(`${BASE}/api/game/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ level: 2, answers }),
    });

    assert.equal(r.status, 200, `submit failed: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.total, 15);
    assert.equal(body.score, 0, 'null answers must never be graded correct');
    assert.equal(body.passed, false);
    assert.ok(body.answerKey.every((a: any) => a.isCorrect === false));
    assert.ok(body.answerKey.every((a: any) => a.userAnswer === null));
  });

  test('POST /api/game/submit rejects level beyond currentLevel (level-bound check unaffected by batching)', async () => {
    const r = await fetchJson(`${BASE}/api/game/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ level: 99999, answers: [] }),
    });
    assert.equal(r.status, 400, `expected 400 for out-of-bound level, got ${r.status}: ${JSON.stringify(r.body)}`);
  });
});
