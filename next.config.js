/** @type {import('next').NextConfig} */

// In development, `next dev` (webpack HMR + React Fast Refresh) evaluates modules with
// eval(), which requires 'unsafe-eval' in the CSP. Production (`next start`) is compiled
// ahead-of-time and uses no eval, so it keeps the locked-down policy with no 'unsafe-eval'.
const isDev = process.env.NODE_ENV !== 'production';

// Applied to every response. 'unsafe-inline' is required for Next.js 14's hydration
// inline scripts and CSS Modules style injection; the app uses no inline styles of its
// own and loads only same-origin assets, so the policy is otherwise locked down.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      "font-src 'self'",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
