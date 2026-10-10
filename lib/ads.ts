/**
 * Google AdSense configuration.
 *
 * Two layers, matching how AdSense itself works:
 *
 * 1. **Auto ads** — the loader script alone (`components/common/AdScript.tsx`) lets Google place
 *    ads automatically across the site. This is live as soon as the script ships; no slot ids
 *    needed.
 * 2. **Manual units** — `AdSlot` renders an `<ins class="adsbygoogle">` at a position chosen for
 *    this content. Each position needs a slot id from AdSense → Ads → By ad unit → *Create new
 *    ad unit* → responsive. Paste it below or set the matching `NEXT_PUBLIC_*` env var; until a
 *    slot id exists the position renders nothing at all (no empty box, no layout shift).
 *
 * Positions are deliberately few and never interrupt a devotional: nothing sits between the
 * opening scripture and the closing prayer.
 *
 * `ads.txt` (in `public/`) authorises Google to sell inventory for this domain — AdSense flags
 * sites without it as "needs attention", so it ships with the same publisher id.
 */

declare global {
  interface Window {
    /** AdSense's queue: pushes are accepted before the loader script arrives. */
    adsbygoogle?: unknown[];
  }
}

/** `ca-pub-…` from the AdSense snippet. */
export const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? 'ca-pub-9117572925263537';

/** The same id in `ads.txt` form (`pub-…`). */
export const ADSENSE_PUBLISHER_ID = ADSENSE_CLIENT.replace(/^ca-/, '');

/**
 * Whether to serve ads at all.
 *
 * Production by default. `NEXT_PUBLIC_ADS_ENABLED` overrides in either direction — `true` to
 * check placements on a preview or dev server, `false` to keep a staging deploy ad-free (useful:
 * clicking your own ads, even by accident, is an AdSense policy violation).
 */
export const ADS_ENABLED = (() => {
  const override = process.env.NEXT_PUBLIC_ADS_ENABLED;
  if (override === 'true') return true;
  if (override === 'false') return false;
  return process.env.NODE_ENV === 'production';
})();

/**
 * Manual ad-unit slot ids, keyed by position. Empty means "not created yet" — the position then
 * renders nothing, so the site can ship before the units exist.
 */
export const AD_SLOTS = {
  /** In-feed: home grid, library, edition day lists, search results. */
  feed: process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED ?? '',
  /** Below the article, after the reading plans and attribution. */
  article: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE ?? '',
  /** Bottom of standalone pages such as /about. */
  page: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PAGE ?? '',
} as const;

export type AdPosition = keyof typeof AD_SLOTS;

/** How often an in-feed unit repeats through a card grid. */
export const FEED_AD_EVERY = 6;
