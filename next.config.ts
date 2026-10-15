import type { NextConfig } from 'next';
import { securityHeaders } from './lib/security-headers';
import { LOCAL_ORIGIN, resolveSiteUrl } from './lib/site-url';

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

/**
 * The canonical origin, resolved once here, where the whole build environment is visible —
 * including Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, which a browser bundle could never read —
 * and inlined below as `NEXT_PUBLIC_SITE_URL` so every bundle sees the same value.
 */
const siteUrl = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});

// A CI or deploy build that fell all the way back to localhost ships that address in every
// canonical tag and share card, and nothing a visitor sees looks wrong, so say it in the build
// log. Best effort: on Vercel these hints are system variables too, like the production domain.
if (siteUrl === LOCAL_ORIGIN && (process.env.VERCEL || process.env.CI)) {
  console.warn(
    `⚠ NEXT_PUBLIC_SITE_URL is not set and no Vercel production domain is available: canonical URLs, ` +
      `share cards, sitemap.xml and the feed will point at ${LOCAL_ORIGIN}. Fine for a CI check; wrong for a public deploy.`
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_SITE_URL: siteUrl,
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
