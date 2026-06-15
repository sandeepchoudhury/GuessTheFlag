export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { hashPassword, signJwt, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import { SessionUser } from '@/lib/types';
import {
  rateLimit,
  clientIp,
  tooManyRequests,
  isSameOrigin,
  crossOriginRejected,
} from '@/lib/security';

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const MIN_PASSWORD_LENGTH = 10;

interface SignupBody {
  username: string;
  password: string;
  confirmPassword: string;
}

interface UserRow {
  id: number;
  username: string;
  current_level: number;
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return crossOriginRejected();
  }

  // Throttle account creation per IP to blunt automated signup / enumeration abuse.
  const rl = rateLimit({
    key: `signup:ip:${clientIp(req)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  });
  if (!rl.ok) {
    return tooManyRequests(rl.retryAfter);
  }

  let body: SignupBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const { password, confirmPassword } = body;

  // Validation
  if (!username || username.length < 3 || username.length > 30) {
    return NextResponse.json({ error: 'Username must be 3-30 characters' }, { status: 400 });
  }
  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { error: 'Username may only contain letters, numbers, and . _ -' },
      { status: 400 },
    );
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
  }

  // Check username exists
  const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const inserted = await sql<UserRow[]>`
    INSERT INTO users (username, password_hash, current_level)
    VALUES (${username}, ${passwordHash}, 1)
    RETURNING id, username, current_level
  `;
  const newUser = inserted[0];

  const sessionUser: SessionUser = {
    id: newUser.id,
    username: newUser.username,
    currentLevel: newUser.current_level,
  };

  const token = signJwt({ uid: newUser.id, username: newUser.username });

  const res = NextResponse.json({ user: sessionUser }, { status: 201 });
  res.cookies.set(COOKIE_NAME, token, cookieOptions());
  return res;
}
