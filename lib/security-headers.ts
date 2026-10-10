/**
 * Security headers for every response, applied in `next.config.ts`.
 *
 * Lives in `lib/` rather than inside the config file so the policy is testable
 * (`tests/ads.test.ts` fails if an ad domain is dropped and the ads silently stop serving).
 *
 * `script-src` has to allow `'unsafe-inline'`: the App Router streams its RSC payload as inline
 * `<script>` tags on every document, so a `'self'`-only policy would break hydration. To go back
 * to a nonce-based policy, generate a nonce in `proxy.ts`, forward it as a request header and
 * reference it here; Next applies it to the scripts it injects.
 */

/**
 * Origins AdSense needs to execute from. Google rotates and adds hosts (the `adtrafficquality`
 * ones are recent), so if the console ever reports a CSP violation for an ad script, add that
 * origin here rather than loosening the whole directive.
 */
export const AD_SCRIPT_ORIGINS = [
  'https://pagead2.googlesyndication.com', // the loader itself (`adsbygoogle.js`)
  'https://tpc.googlesyndication.com', // creative rendering
  'https://www.googlesyndication.com',
  'https://adservice.google.com', // ad selection
  'https://www.google.com',
  'https://googleads.g.doubleclick.net',
  'https://www.googletagservices.com',
  'https://ep1.adtrafficquality.google',
  'https://ep2.adtrafficquality.google',
];

/** Ad creatives render in cross-origin iframes, so they need `frame-src` (not just `script-src`). */
export const AD_FRAME_ORIGINS = [
  'https://pagead2.googlesyndication.com',
  'https://tpc.googlesyndication.com',
  'https://www.googlesyndication.com',
  'https://adservice.google.com',
  'https://www.google.com',
  'https://googleads.g.doubleclick.net',
];

/**
 * React's development runtime uses `eval()` to reconstruct component stacks; without
 * `'unsafe-eval'` every dev render logs "eval() is not supported in this environment". It is
 * added for `next dev` only — the production policy stays strict (React never evals there).
 */
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const scriptSources = ["script-src 'self' 'unsafe-inline'", ...(IS_PRODUCTION ? [] : ["'unsafe-eval'"]), ...AD_SCRIPT_ORIGINS];

export const contentSecurityPolicy = [
  "default-src 'self'",
  scriptSources.join(' '),
  ["style-src 'self' 'unsafe-inline'", 'https://fonts.googleapis.com'].join(' '),
  ["font-src 'self'", 'https://fonts.gstatic.com'].join(' '),
  // `img-src`/`connect-src`/`media-src` already allow any https origin, which covers ad
  // creatives, impression beacons and the ad-traffic-quality pings.
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https:",
  "media-src 'self' https:",
  ['frame-src', ...AD_FRAME_ORIGINS].join(' '),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

export const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
];
