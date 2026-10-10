import { getDevotionalsByAudience } from '@/lib/content';
import { buildFeed } from '@/lib/rss';

/**
 * RSS 2.0 for the published corpus — one item per daily devotional, full text included.
 *
 * The feed is the adult edition, which is what the channel is named after and what a subscriber
 * expects each morning; the readers' editions are browsed at `/devotionals?audience=teens`.
 */
export function GET() {
  const xml = buildFeed(getDevotionalsByAudience('adults'));
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}

export const dynamic = 'force-static';
