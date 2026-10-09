/**
 * Misc public routes: health probe, sitemap.xml, R2 media streaming.
 */

import type { Router } from '../lib/router';
import type { Ctx } from '../context';
import { ApiError, json } from '../lib/http';
import { channels as channelsRepo } from '../repos/channels';
import { posts as postsRepo } from '../repos/posts';
import { getMediaObject, isValidMediaKey } from '../services/media';
import { escapeHtml } from '../lib/util';

export function registerMiscRoutes(router: Router): void {
  router.get('/api/health', async (ctx: Ctx) => {
    let db: 'up' | 'down' = 'down';
    try {
      await ctx.env.DB.prepare('SELECT 1 AS ok').first();
      db = 'up';
    } catch {
      /* health must answer even when D1 misbehaves */
    }
    return json({ ok: db === 'up', db, ts: new Date().toISOString() });
  });

  /** Dynamic XML sitemap (public posts + channels + core pages). */
  router.get('/sitemap.xml', async (ctx: Ctx) => {
    const site = (ctx.env.SITE_URL || ctx.origin).replace(/\/+$/, '');
    const rows = await postsRepo.recentForSitemap(ctx.env.DB, 5000);
    const chans = await channelsRepo.listActive(ctx.env.DB);

    const urls: string[] = [];
    const add = (loc: string, lastmod?: string | null, priority = '0.5') =>
      urls.push(
        `<url><loc>${escapeHtml(site + loc)}</loc>${lastmod ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : ''}<changefreq>daily</changefreq><priority>${priority}</priority></url>`
      );

    add('/', undefined, '1.0');
    add('/blog', undefined, '0.9');
    add('/search', undefined, '0.3');
    add('/about', undefined, '0.3');
    for (const c of chans) add(`/channels/${c.slug}`, c.updated_at, '0.7');
    for (const p of rows) add(`/blog/${p.channel_slug}/${p.slug}`, p.updated_at || p.published_at, '0.6');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  });

  /** Stream a mirrored cover from R2 (immutable caching). */
  router.get('/media/*', async (ctx: Ctx) => {
    const key = ctx.params.wildcard ?? '';
    if (!isValidMediaKey(key)) throw ApiError.notFound('Not found');
    const obj = await getMediaObject(ctx.env, key);
    if (!obj || !obj.body) throw ApiError.notFound('Not found');
    const headers: Record<string, string> = {
      'Content-Type': obj.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    if (obj.etag) headers.ETag = `"${obj.etag.replace(/"/g, '')}"`;
    return new Response(obj.body, { headers });
  });
}
