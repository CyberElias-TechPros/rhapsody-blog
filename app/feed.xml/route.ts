import { getReleasedDevotionals, siteTimeZone, todayIso } from '@/lib/content';
import { buildFeed } from '@/lib/rss';

/**
 * RSS 2.0 for the published corpus — one item per daily devotional, full text included.
 *
 * Only days that have *arrived* are in the feed. A monthly edition is extracted whole, so the
 * corpus holds the 31st on the 1st; a feed built from all of it handed subscribers the rest of the
 * month the day it was deployed, instead of one devotional each morning. The route is
 * regenerated hourly (ISR), so a new day appears within the hour after midnight in the site zone.
 *
 * The feed is the adult edition, which is what the channel is named after and what a subscriber
 * expects each morning; TeeVo and Early Readers have their own pages (`/teevo`, `/early-readers`).
 */
export const revalidate = 3600;

export function GET() {
  const xml = buildFeed(getReleasedDevotionals('adults', todayIso(new Date(), siteTimeZone())));
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
