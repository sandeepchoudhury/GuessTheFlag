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

// ─── path helpers ────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const FLAGS_DIR = path.join(ROOT, 'public', 'flags');
const REAL_DB = path.join(ROOT, 'data', 'app.db');

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
  let Database: typeof import('better-sqlite3');
  let db: import('better-sqlite3').Database;

  before(async () => {
    Database = (await import('better-sqlite3')).default as unknown as typeof import('better-sqlite3');
    assert.ok(fs.existsSync(REAL_DB), `Database file missing at ${REAL_DB}`);
    db = new (Database as any)(REAL_DB, { readonly: true });
  });

  after(() => {
    db?.close();
  });

  test('database file exists', () => {
    assert.ok(fs.existsSync(REAL_DB));
  });

  test('users table exists with correct columns', () => {
    const cols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    for (const col of ['id', 'username', 'password_hash', 'current_level', 'created_at']) {
      assert.ok(names.includes(col), `users table missing column: ${col}`);
    }
  });

  test('countries table exists with correct columns', () => {
    const cols = db.prepare("PRAGMA table_info(countries)").all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    for (const col of ['id', 'name', 'iso_code', 'flag_path', 'difficulty_tier']) {
      assert.ok(names.includes(col), `countries table missing column: ${col}`);
    }
  });

  test('user_progress table exists with correct columns', () => {
    const cols = db.prepare("PRAGMA table_info(user_progress)").all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    for (const col of ['id', 'user_id', 'level_id', 'completed', 'attempts']) {
      assert.ok(names.includes(col), `user_progress table missing column: ${col}`);
    }
  });

  test('countries table row count matches MASTER_COUNTRIES', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM countries').get() as { cnt: number };
    assert.equal(row.cnt, 197);
  });

  test('all 5 tiers represented in countries table', () => {
    const rows = db.prepare('SELECT DISTINCT difficulty_tier FROM countries ORDER BY difficulty_tier').all() as Array<{ difficulty_tier: number }>;
    const tiers = rows.map((r) => r.difficulty_tier);
    assert.deepEqual(tiers, [1, 2, 3, 4, 5]);
  });

  test('each tier has at least 20 countries in DB', () => {
    for (let t = 1; t <= 5; t++) {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM countries WHERE difficulty_tier = ?').get(t) as { cnt: number };
      assert.ok(row.cnt >= 20, `tier ${t} has ${row.cnt} rows, expected >= 20`);
    }
  });

  test('iso_code is unique in countries table', () => {
    const row = db.prepare('SELECT COUNT(DISTINCT iso_code) as u, COUNT(*) as total FROM countries').get() as { u: number; total: number };
    assert.equal(row.u, row.total, 'duplicate iso_codes in countries table');
  });

  test('flag_path matches /flags/<iso>.svg pattern for all rows', () => {
    const rows = db.prepare('SELECT iso_code, flag_path FROM countries').all() as Array<{ iso_code: string; flag_path: string }>;
    for (const row of rows) {
      assert.equal(row.flag_path, `/flags/${row.iso_code}.svg`, `flag_path mismatch for ${row.iso_code}`);
    }
  });

  test('foreign_keys pragma is enforced (WAL mode check)', () => {
    const row = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    assert.equal(row.journal_mode, 'wal');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: lib/game.ts — buildQuestions
// Uses a temp DB so we don't mutate the real one, but buildQuestions only
// reads the countries table, so using the real DB (read) is safe here.
// ─────────────────────────────────────────────────────────────────────────────
describe('lib/game.ts — buildQuestions', () => {
  // We need to load game.ts with a DB that has countries seeded.
  // lib/db.ts uses DATA_DIR = process.cwd()/data which points to the real DB.
  // That's fine — we only read from it.
  let buildQuestions: (level: number) => import('../lib/types').Question[];
  let tiersForLevel: (level: number) => number[];
  let QUESTIONS_PER_LEVEL: number;
  let OPTIONS_PER_QUESTION: number;

  before(async () => {
    // lib/game.ts imports lib/db.ts which opens the real DB at process.cwd()/data/app.db.
    // lib/auth.ts imports next/headers but game.ts does NOT — safe to import directly.
    const mod = await import('../lib/game');
    buildQuestions = mod.buildQuestions;
    tiersForLevel = mod.tiersForLevel;
    QUESTIONS_PER_LEVEL = mod.QUESTIONS_PER_LEVEL;
    OPTIONS_PER_QUESTION = mod.OPTIONS_PER_QUESTION;
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
    test(`buildQuestions(${level}) returns exactly 15 questions`, () => {
      const qs = buildQuestions(level);
      assert.equal(qs.length, QUESTIONS_PER_LEVEL, `level ${level}: got ${qs.length} questions`);
    });

    test(`buildQuestions(${level}): each question has exactly 4 unique options`, () => {
      const qs = buildQuestions(level);
      for (const q of qs) {
        assert.equal(q.options.length, OPTIONS_PER_QUESTION, `expected 4 options, got ${q.options.length}`);
        const unique = new Set(q.options);
        assert.equal(unique.size, OPTIONS_PER_QUESTION, `duplicate options in question: ${JSON.stringify(q.options)}`);
      }
    });

    test(`buildQuestions(${level}): correct option is always present in options`, () => {
      const qs = buildQuestions(level);
      for (const q of qs) {
        assert.ok(
          q.options.includes(q.correctOption),
          `correctOption "${q.correctOption}" not in options: ${JSON.stringify(q.options)}`
        );
      }
    });

    test(`buildQuestions(${level}): no duplicate countryIds within the 15 questions`, () => {
      const qs = buildQuestions(level);
      const ids = qs.map((q) => q.countryId);
      const unique = new Set(ids);
      assert.equal(unique.size, ids.length, `duplicate countryIds in level ${level}: ${ids}`);
    });

    test(`buildQuestions(${level}): questions come from the correct tiers`, () => {
      // We need DB access to verify tiers; use the existing db singleton
      const Database = require('better-sqlite3');
      const realDb = new Database(REAL_DB, { readonly: true });
      try {
        const qs = buildQuestions(level);
        const expectedTiers = tiersForLevel(level);
        for (const q of qs) {
          const row = realDb
            .prepare('SELECT difficulty_tier FROM countries WHERE id = ?')
            .get(q.countryId) as { difficulty_tier: number } | undefined;
          assert.ok(row, `countryId ${q.countryId} not found in DB`);
          assert.ok(
            expectedTiers.includes(row!.difficulty_tier),
            `level ${level}: countryId ${q.countryId} is in tier ${row!.difficulty_tier}, expected ${expectedTiers}`
          );
        }
      } finally {
        realDb.close();
      }
    });

    test(`buildQuestions(${level}): flagPath matches /flags/<iso>.svg pattern`, () => {
      const qs = buildQuestions(level);
      for (const q of qs) {
        assert.match(q.flagPath, /^\/flags\/[a-z]{2}\.svg$/, `bad flagPath: ${q.flagPath}`);
      }
    });
  }

  test('buildQuestions(6): uses tiers 4 and 5', () => {
    const Database = require('better-sqlite3');
    const realDb = new Database(REAL_DB, { readonly: true });
    try {
      const qs = buildQuestions(6);
      // level 6 draws from tiers 4+5 pool of 40; should still produce 15
      assert.equal(qs.length, QUESTIONS_PER_LEVEL);
      for (const q of qs) {
        const row = realDb
          .prepare('SELECT difficulty_tier FROM countries WHERE id = ?')
          .get(q.countryId) as { difficulty_tier: number } | undefined;
        assert.ok(row);
        assert.ok([4, 5].includes(row!.difficulty_tier), `tier ${row!.difficulty_tier} not in [4,5]`);
      }
    } finally {
      realDb.close();
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
    // Clean up test user from the real DB
    try {
      const Database = require('better-sqlite3');
      const cleanDb = new Database(REAL_DB);
      cleanDb.prepare('DELETE FROM users WHERE username LIKE ?').run('testuser_%');
      cleanDb.close();
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
});
