export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyPassword, signJwt, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import { SessionUser } from '@/lib/types';
import {
  rateLimit,
  clientIp,
  tooManyRequests,
  isSameOrigin,
  crossOriginRejected,
} from '@/lib/security';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  current_level: number;
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return crossOriginRejected();
  }

  // Throttle by IP to cap online brute force regardless of the target account.
  const ipLimit = rateLimit({
    key: `login:ip:${clientIp(req)}`,
    limit: 20,
    windowMs: 15 * 60 * 1000, // 15 minutes
  });
  if (!ipLimit.ok) {
    return tooManyRequests(ipLimit.retryAfter);
  }

  let body: { username: string; password: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  // Also throttle per username so one targeted account can't be hammered from a botnet.
  const userLimit = rateLimit({
    key: `login:user:${username.toLowerCase()}`,
    limit: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
  });
  if (!userLimit.ok) {
    return tooManyRequests(userLimit.retryAfter);
  }

  const rows = await sql<UserRow[]>`
    SELECT id, username, password_hash, current_level FROM users WHERE username = ${username}
  `;
  const row = rows[0];

  if (!row) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const sessionUser: SessionUser = {
    id: row.id,
    username: row.username,
    currentLevel: row.current_level,
  };

  const token = signJwt({ uid: row.id, username: row.username });

  const res = NextResponse.json({ user: sessionUser }, { status: 200 });
  res.cookies.set(COOKIE_NAME, token, cookieOptions());
  return res;
}
