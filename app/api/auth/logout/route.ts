export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';
import { isSameOrigin, crossOriginRejected } from '@/lib/security';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return crossOriginRejected();
  }
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
