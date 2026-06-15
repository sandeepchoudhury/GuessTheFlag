import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * Adequate for the single-server deployment this app targets. For a multi-instance
 * deployment, swap the backing store for a shared one (e.g. Redis / Upstash) — the
 * call sites do not need to change.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Unique bucket key, e.g. `login:ip:1.2.3.4`. */
  key: string;
  /** Max requests permitted within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (only meaningful when `ok` is false). */
  retryAfter: number;
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from common proxy headers; falls back to a shared bucket. */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function tooManyRequests(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

/**
 * CSRF defense-in-depth for cookie-authenticated, state-changing requests.
 *
 * `SameSite=lax` already blocks cross-site POSTs in modern browsers; this adds a
 * server-side origin check as a second layer. Requests with no `Origin` header
 * (non-browser clients, same-origin navigations) are allowed — browsers always send
 * `Origin` on cross-origin POSTs, so CSRF attempts are still rejected.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function crossOriginRejected(): NextResponse {
  return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
}
