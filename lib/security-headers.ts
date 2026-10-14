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
 * origin here rather than loosening the whole directive. A violation for an ad *frame* — same
 * symptom, but the directive named in the message is `frame-src` — goes in `AD_FRAME_ORIGINS`
 * below instead.
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
  // The Sodar verification frame (`sodar2.js`) that Ad Traffic Quality opens next to every
  // filled unit. Framing it from a policy that only lists the creative hosts above gets it
  // blocked, and the block then surfaces as a second, noisier error from `sodar2.js` itself:
  //   "Failed to execute 'postMessage' … target origin ('https://ep2.adtrafficquality.google')
  //    does not match the recipient window's origin ('null')"
  // — the recipient is `null` precisely because the frame never loaded. Allowing the frame
  // clears both. Google serves Sodar from either endpoint, so both are listed, matching
  // `AD_SCRIPT_ORIGINS`.
  'https://ep1.adtrafficquality.google',
  'https://ep2.adtrafficquality.google',
];

/**
 * Origins that execute scripts on the site but are not ours and not ads.
 *
 * Cloudflare Web Analytics is injected *at the edge*: when automatic setup is on for the zone,
 * Cloudflare appends `<script defer src="https://static.cloudflareinsights.com/beacon.min.js/…"
 * data-cf-beacon=…>` to every HTML response it serves. The tag therefore never appears anywhere
 * in this repository, and the only way to keep it from tripping the CSP is to allow its host
 * here. Without it the console reports a violation on every page view and analytics collect
 * nothing. Its telemetry POSTs need no extra allowance — `connect-src` already permits any
 * https origin.
 *
 * Self-host the beacon or turn automatic injection off instead? Then drop this origin and the
 * policy tightens back up; nothing else depends on it.
 */
export const ANALYTICS_SCRIPT_ORIGINS = ['https://static.cloudflareinsights.com'];

/**
 * React's development runtime uses `eval()` to reconstruct component stacks; without
 * `'unsafe-eval'` every dev render logs "eval() is not supported in this environment". It is
 * added for `next dev` only — the production policy stays strict (React never evals there).
 */
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const scriptSources = [
  "script-src 'self' 'unsafe-inline'",
  ...(IS_PRODUCTION ? [] : ["'unsafe-eval'"]),
  ...AD_SCRIPT_ORIGINS,
  ...ANALYTICS_SCRIPT_ORIGINS,
];

export const contentSecurityPolicy = [
  "default-src 'self'",
  scriptSources.join(' '),
  ["style-src 'self' 'unsafe-inline'", 'https://fonts.googleapis.com'].join(' '),
  ["font-src 'self'", 'https://fonts.gstatic.com'].join(' '),
  // `img-src`/`connect-src`/`media-src` already allow any https origin, which covers ad
  // creatives, impression beacons, the ad-traffic-quality pings and the Cloudflare Web
  // Analytics RUM posts.
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
