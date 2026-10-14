/**
 * Site-wide identity + navigation. Everything the layout, metadata, sitemap, RSS feed and
 * Open Graph tags need in one place.
 */

export const SITE = {
  name: 'Devotional',
  shortName: 'Devotional',
  tagline: 'The daily devotional, published as a blog.',
  description:
    'Every daily devotional from the Rhapsody of Realities monthly editions — the article, the opening scripture, the closing prayer, further study and the Bible reading plans — readable, searchable and shareable.',
  /** Canonical origin. Falls back to localhost so `next build` and previews never emit a blank URL. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
  author: 'Pastor Chris Oyakhilome',
  series: 'Rhapsody of Realities',
  publisher: 'LoveWorld Publishing',
  locale: 'en_GB',
  ogImage: '/og.jpg',
  /** Where the published corpus comes from — shown on /about and in every post footer. */
  attribution:
    'Articles are taken from the Rhapsody of Realities monthly editions by Pastor Chris Oyakhilome, © LoveWorld Publishing. Reproduced here with attribution; all rights remain with the publisher.',
} as const;

/**
 * The main navigation. "Today" comes first because it is the reason anyone opens the site, and
 * there is no "Home" item: the logo is the home link, and the bar has to fit six labels next to
 * a search box at 1024px. The mobile sheet adds Home back, where there is room for it.
 */
export const NAV_LINKS = [
  { href: '/today', label: 'Today' },
  { href: '/devotionals', label: 'Devotionals' },
  { href: '/editions', label: 'Editions' },
  { href: '/kids', label: 'For Kids' },
  { href: '/resources', label: 'Resources' },
  { href: '/about', label: 'About' },
] as const;

/** Absolute URL helper used by canonical tags, sitemap.xml and the RSS feed. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url}${path.startsWith('/') ? '' : '/'}${path}`;
}
