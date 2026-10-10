import type { NextConfig } from 'next';

/**
 * The blog itself is fully static: every devotional is a Markdown file in `content/devotionals`
 * generated from the monthly PDF editions by `npm run content:extract`.
 *
 * The Cloudflare Worker in `/worker` still owns the *dynamic* features (accounts, admin,
 * newsletter subscribers). In local development `WORKER_DEV_URL` turns on a same-origin
 * rewrite so the browser only ever talks to Next, exactly like the old Vite proxy did:
 *
 *   WORKER_DEV_URL=http://127.0.0.1:8787 npm run dev
 *
 * In production set `NEXT_PUBLIC_API_URL` to the deployed Worker instead (see .env.example).
 */
const workerDevUrl = process.env.WORKER_DEV_URL?.replace(/\/+$/, '');

/**
 * Security headers carried over from the old `vercel.json`.
 *
 * `script-src` has to allow `'unsafe-inline'`: the App Router streams its RSC payload as
 * inline `<script>` tags on every document, so a `'self'`-only policy would break hydration.
 * Everything else stays locked down — no plugins, no framing, no cross-origin leaks. To go
 * back to a nonce-based policy, generate a nonce in `proxy.ts`, forward it as a request
 * header and reference it here; Next applies it to the scripts it injects.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      'img-src \'self\' data: blob: https:',
      "connect-src 'self' https:",
      "media-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // The sandbox preview (and Vercel preview URLs) hit the dev server from another origin.
  allowedDevOrigins: ['*.e2b.app', '*.vercel.app'],

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/_next/static/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/(favicon.ico|og.jpg)', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
    ];
  },

  async rewrites() {
    if (!workerDevUrl) return [];
    return [
      { source: '/api/:path*', destination: `${workerDevUrl}/api/:path*` },
      { source: '/media/:path*', destination: `${workerDevUrl}/media/:path*` },
    ];
  },
};

export default nextConfig;
