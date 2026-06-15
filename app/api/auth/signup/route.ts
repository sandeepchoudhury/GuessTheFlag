export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword, signJwt, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import { SessionUser } from '@/lib/types';

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
  let body: SignupBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { username, password, confirmPassword } = body;

  // Validation
  if (!username || username.length < 3 || username.length > 30) {
    return NextResponse.json({ error: 'Username must be 3-30 characters' }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
  }

  // Check username exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const result = db
    .prepare('INSERT INTO users (username, password_hash, current_level) VALUES (?, ?, 1)')
    .run(username, passwordHash);

  const newUser = db
    .prepare('SELECT id, username, current_level FROM users WHERE id = ?')
    .get(result.lastInsertRowid) as UserRow;

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
