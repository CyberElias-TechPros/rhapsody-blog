import type { NextConfig } from 'next';
import { securityHeaders } from './lib/security-headers';

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
 * Identifies this build to the service worker: `PwaProvider` registers `/sw.js?v=<id>`, so each
 * deploy installs a fresh worker that drops the previous build's static cache.
 */
const buildId =
  (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? '').slice(0, 12) ||
  Date.now().toString(36);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },

  // The sandbox preview (and Vercel preview URLs) hit the dev server from another origin.
  allowedDevOrigins: ['*.e2b.app', '*.vercel.app'],

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    const headers = [
      { source: '/(.*)', headers: securityHeaders },
      // The worker script itself must always be revalidated, or browsers keep an old one for
      // up to a day; the `?v=` query already makes each build's URL unique.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, max-age=0' }] },
    ];
    // Immutable hashed-asset caching is a production concern; Next warns that a custom
    // Cache-Control on /_next/static interferes with development, so it is skipped in dev.
    if (process.env.NODE_ENV === 'production') {
      headers.push(
        { source: '/_next/static/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
        {
          source: '/(favicon.ico|icon.svg|icon-192.png|icon-512.png|icon-maskable-512.png|apple-touch-icon.png)',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
        }
      );
    }
    return headers;
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
