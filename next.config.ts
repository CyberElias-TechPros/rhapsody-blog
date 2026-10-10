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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // The sandbox preview (and Vercel preview URLs) hit the dev server from another origin.
  allowedDevOrigins: ['*.e2b.app', '*.vercel.app'],

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    const headers = [{ source: '/(.*)', headers: securityHeaders }];
    // Immutable hashed-asset caching is a production concern; Next warns that a custom
    // Cache-Control on /_next/static interferes with development, so it is skipped in dev.
    if (process.env.NODE_ENV === 'production') {
      headers.push(
        { source: '/_next/static/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
        { source: '/(favicon.ico|og.jpg)', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] }
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
