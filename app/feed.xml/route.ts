import { getAllDevotionals } from '@/lib/content';
import { buildFeed } from '@/lib/rss';

/** RSS 2.0 for the published corpus — one item per daily devotional, full text included. */
export function GET() {
  const xml = buildFeed(getAllDevotionals());
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}

export const dynamic = 'force-static';
