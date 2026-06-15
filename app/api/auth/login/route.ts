export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyPassword, signJwt, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import { SessionUser } from '@/lib/types';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  current_level: number;
}

export async function POST(req: NextRequest) {
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

  const row = db
    .prepare('SELECT id, username, password_hash, current_level FROM users WHERE username = ?')
    .get(username) as UserRow | undefined;

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
