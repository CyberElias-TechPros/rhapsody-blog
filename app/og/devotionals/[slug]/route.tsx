import { ImageResponse } from 'next/og';
import { getAllSlugs, getDevotionalBySlug } from '@/lib/content';
import { AUDIENCES } from '@/lib/audiences';
import { formatDayMonthYear } from '@/lib/format';
import { DevotionalOgCard, OG_SIZE, loadOgFonts } from '@/lib/og/card';
import { AUDIENCE_SEARCH_NAME } from '@/lib/seo';
import { SITE, displayHost } from '@/lib/site';

/**
 * `GET /og/devotionals/[slug]` — one social card per devotional, prerendered at build time like
 * the article itself: series, date, title and opening scripture. The article's metadata points
 * `og:image` and `twitter:image` here.
 */

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

const AUDIENCE_LINE = {
  adults: 'Daily devotional',
  teens: 'TeeVo · the daily devotional for teens',
  'early-readers': 'For early readers (6–12)',
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getDevotionalBySlug(slug);
  if (!post) return new Response('Not found', { status: 404 });

  return new ImageResponse(
    (
      <DevotionalOgCard
        series={post.audience === 'adults' ? SITE.series : AUDIENCE_SEARCH_NAME[post.audience].replace(/^Rhapsody of Realities /, 'Rhapsody ')}
        audienceLine={AUDIENCE_LINE[post.audience] ?? AUDIENCES[post.audience].label}
        dateLine={`${post.weekday}, ${formatDayMonthYear(post.date)}`}
        title={post.title}
        scripture={post.scripture}
        reference={post.scriptureReference}
        host={displayHost(SITE.url)}
      />
    ),
    {
      ...OG_SIZE,
      fonts: await loadOgFonts(),
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    }
  );
}
