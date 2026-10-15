import { ImageResponse } from 'next/og';
import { OG_SIZE, SiteOgCard, loadOgFonts } from '@/lib/og/card';
import { SITE, displayHost } from '@/lib/site';

/**
 * `GET /og.png` — the site-wide social card (`SITE.ogImage`), drawn at build time so it always
 * carries the current name. It replaces a stock JPEG that still showed a previous project's brand.
 */

export const dynamic = 'force-static';

export async function GET() {
  return new ImageResponse(<SiteOgCard host={displayHost(SITE.url)} />, {
    ...OG_SIZE,
    fonts: await loadOgFonts(),
    headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
  });
}
