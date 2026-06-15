import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { SessionUser } from '@/lib/types';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const COOKIE_NAME = 'gtf_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export function signJwt(payload: { uid: number; username: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyJwt(token: string): { uid: number; username: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: number; username: string };
    return decoded;
  } catch {
    return null;
  }
}

export function getUserFromCookie(): SessionUser | null {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = verifyJwt(token);
    if (!payload) return null;

    const row = db
      .prepare('SELECT id, username, current_level FROM users WHERE id = ?')
      .get(payload.uid) as { id: number; username: string; current_level: number } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      currentLevel: row.current_level,
    };
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge: number = COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    secure: process.env.NODE_ENV === 'production',
  };
}

export { COOKIE_NAME };
