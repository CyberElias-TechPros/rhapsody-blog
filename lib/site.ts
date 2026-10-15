/**
 * Site-wide identity + navigation. Everything the layout, metadata, sitemap, RSS feed and
 * Open Graph tags need in one place.
 *
 * The site is named after the devotional it publishes, because that is what readers search for
 * ("rhapsody of realities today", "rhapsody of realities 15 october 2026"). It is an independent
 * reader site, so `disclaimer` says so wherever the name appears prominently (footer, about, FAQ):
 * using the publication's name to describe the content is fair; implying we *are* the publisher
 * would mislead readers and breach AdSense's misrepresentation policy.
 */

import { resolveSiteUrl } from './site-url';

export const SITE = {
  name: 'Rhapsody of Realities',
  /** Home-screen label and tight spots (≤ 12 characters so launchers do not truncate it). */
  shortName: 'Rhapsody',
  tagline: 'Daily Devotional by Pastor Chris Oyakhilome',
  description:
    'Read Rhapsody of Realities today — the daily devotional by Pastor Chris Oyakhilome: the message, opening scripture, prayer and confession, further study and the 1-year and 2-year Bible reading plans, with TeeVo for teens and the Early Readers and Kids editions. Free to read, listen to and share.',
  /**
   * Canonical origin: `NEXT_PUBLIC_SITE_URL`, else Vercel's production domain, else localhost
   * (see `lib/site-url.ts`). Inside a Next build `next.config.ts` has already inlined the resolved
   * value as `NEXT_PUBLIC_SITE_URL`, so server and browser bundles agree.
   */
  url: resolveSiteUrl({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  }),
  author: 'Pastor Chris Oyakhilome',
  series: 'Rhapsody of Realities',
  publisher: 'LoveWorld Publishing',
  /** The printed edition's ISSN, as it appears on every monthly issue. */
  issn: '1596-6984',
  locale: 'en_GB',
  /** Site-wide social card, drawn at build time by `app/og.png/route.tsx`. */
  ogImage: '/og.png',
  /** The publisher's own site, apps and translations — linked wherever we point to "the official edition". */
  officialUrl: 'https://rhapsodyofrealities.org',
  /** Where the printed and e-book editions (and their PDFs) are sold. */
  officialStoreUrl: 'https://loveworldpublishing.com/collections/rhapsody-of-realities',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Rhapsody_of_Realities',
  /** Public repository: corrections and bug reports can be filed as issues. */
  repoUrl: 'https://github.com/CyberElias-TechPros/rhapsody-blog',
  /**
   * Where readers (and the publisher) can write to the site. Optional: without it, /contact
   * routes corrections to the repository's issue tracker and official matters to the publisher.
   */
  contactEmail: (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '').trim(),
  /** Where the published corpus comes from — shown on /about and in every post footer. */
  attribution:
    'Articles are taken from the Rhapsody of Realities monthly editions by Pastor Chris Oyakhilome, © LoveWorld Publishing. Reproduced here with attribution; all rights remain with the publisher.',
  /** Shown in the footer, on /about and in the FAQ. Keep it short and unambiguous. */
  disclaimer:
    'An independent reader site — not an official website of LoveWorld Publishing, Christ Embassy or the Rhapsody of Realities ministry. For the official edition, apps and translations, visit rhapsodyofrealities.org.',
} as const;

/**
 * Domain-ownership proofs for third-party services, as `<meta name>` → `content`. The root layout
 * renders each one as a plain `<meta>` in the served `<head>` of every page, the home page
 * included. Where a service also accepts a file, it sits in `public/` with the same value, and
 * `tests/site-verification.test.ts` fails if the two drift apart or either one disappears. A
 * service that re-checks and no longer finds its proof un-verifies the domain.
 */
export const SITE_VERIFICATION = {
  // Okecbot. The same code is served as /okecbot-verification.txt.
  'okecbot-site-verification': 'okb-bg6acdifhqi8y75xtkrtm5ucaymdwxua',
} as const satisfies Record<string, string>;

export interface NavLink {
  href: string;
  label: string;
  /** One line under the label in the "More" menu and the mobile sheet. */
  hint?: string;
}

/**
 * The main navigation. "Today" comes first because it is the reason anyone opens the site, and
 * there is no "Home" item: the logo is the home link. The bar fits five labels plus "More" next
 * to the search box at 1024px; everything else lives in `MORE_LINKS`, and the mobile sheet shows
 * both lists (plus Home).
 */
export const NAV_LINKS: readonly NavLink[] = [
  { href: '/today', label: 'Today' },
  { href: '/devotionals', label: 'Devotionals' },
  { href: '/teevo', label: 'TeeVo' },
  { href: '/kids', label: 'Kids' },
  { href: '/reading-plans', label: 'Bible plan' },
];

export const MORE_LINKS: readonly NavLink[] = [
  { href: '/early-readers', label: 'Early Readers', hint: 'Rhapsody for children aged 6–12' },
  { href: '/editions', label: 'Monthly editions', hint: 'Every month, day by day' },
  { href: '/calendar', label: 'Calendar', hint: 'Jump to any date' },
  { href: '/bible', label: 'By Bible book', hint: 'Devotionals on Romans, John, Psalms…' },
  { href: '/resources', label: 'Books & resources', hint: 'Books by Pastor Chris' },
  { href: '/me', label: 'My Rhapsody', hint: 'Streak, notes, history and settings' },
  { href: '/faq', label: 'FAQ', hint: 'Questions readers ask' },
  { href: '/about', label: 'About', hint: 'What this site is' },
];

/** Absolute URL helper used by canonical tags, sitemap.xml and the RSS feed. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** `rhapsodyofrealities.org` — a URL as people say it, for link text. */
export function displayHost(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/^www\./, '');
}
