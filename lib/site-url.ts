/**
 * The site's canonical origin: the one every absolute URL is built from — canonical tags,
 * `og:url` and `og:image` (through `metadataBase`), the domain printed on the share cards,
 * JSON-LD, sitemap.xml, robots.txt and the RSS feed.
 *
 * Resolved in this order:
 *
 * 1. `NEXT_PUBLIC_SITE_URL`, when set. An explicit choice always wins.
 * 2. `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets on every build to the project's
 *    production domain (the shortest custom domain attached to the project, else its
 *    `*.vercel.app` one). Preview builds get the production domain too, deliberately: a canonical
 *    tag or share card should never name a login-protected preview URL.
 * 3. `http://localhost:3000`, for local builds and the test suite.
 *
 * Without step 2, a Vercel deploy that nobody had given `NEXT_PUBLIC_SITE_URL` shipped
 * `http://localhost:3000` in every canonical tag, share card and sitemap entry — silently, because
 * nothing breaks for a visitor; only crawlers and link previews notice.
 *
 * This module has no imports so `next.config.ts` can call it at build time and inline the result
 * into the server and browser bundles alike (see `env` there).
 */

export const LOCAL_ORIGIN = 'http://localhost:3000';

export type SiteUrlEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
};

export function resolveSiteUrl(env: SiteUrlEnv): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim() || env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return configured ? normaliseOrigin(configured) : LOCAL_ORIGIN;
}

/**
 * `rhapsody.example/` → `https://rhapsody.example`. Vercel's variables carry no scheme, and a
 * hand-typed bare host would otherwise make `new URL()` (`metadataBase`) throw and fail the build;
 * an explicit `http://` (a LAN or local host) is kept as typed.
 */
function normaliseOrigin(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, '');
}
