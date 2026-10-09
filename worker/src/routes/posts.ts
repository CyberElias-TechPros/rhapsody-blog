/**
 * Public content routes: post listing (with FTS search + pagination + sort), post detail
 * (atomic view counting), channels, and a public sync-status stamp for the homepage.
 */

import { z } from 'zod';
import type { Router } from '../lib/router';
import type { Ctx } from '../context';
import { ApiError, json } from '../lib/http';
import { parseQuery } from '../lib/validation';
import { posts as postsRepo } from '../repos/posts';
import { channels as channelsRepo } from '../repos/channels';
import { buildFtsQuery } from '../repos/posts';
import { channelDto, postDetailDto, postDto } from '../db';
import { cachedResponse } from '../lib/cache';

const listQuerySchema = z.object({
  channel: z.string().trim().min(1).max(80).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  tag: z.string().trim().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  sort: z.enum(['new', 'old', 'popular']).default('new'),
});

export function registerPostRoutes(router: Router): void {
  router.get('/api/posts', async (ctx: Ctx) =>
    cachedResponse(ctx, { ttlSec: 60 }, async () => {
      const { channel, q, tag, page, limit, sort } = parseQuery(ctx.url, listQuerySchema);
      const fts = q ? buildFtsQuery(q) : null;
      const like = q && !fts ? q : null; // too short for FTS tokens → LIKE fallback

      const { rows, total } = await postsRepo.list(
        ctx.env.DB,
        { channelSlug: channel, status: 'published', tag, fts, like },
        sort,
        limit,
        (page - 1) * limit
      );
      return json({
        items: rows.map((r) => postDto(r, ctx.env, ctx.origin)),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    })
  );

  /**
   * Post detail. NOT edge-cached: every hit must run the atomic view increment so counts
   * reflect reality (data-consistency over cache win — list endpoints carry the caching instead).
   */
  router.get('/api/posts/:channelSlug/:slug', async (ctx: Ctx) => {
    const { channelSlug, slug } = ctx.params;
    let post = await postsRepo.getPublishedWithView(ctx.env.DB, channelSlug, slug);
    if (!post) {
      // A prefetch/bot may hit the same URL twice; make sure we 404 only when it truly isn't published.
      const existing = await postsRepo.getByChannelAndSlug(ctx.env.DB, channelSlug, slug);
      if (!existing || existing.status !== 'published') throw ApiError.notFound('Post not found');
      post = existing; // was just published between the two queries — serve without double counting
    }
    const related = await postsRepo.related(ctx.env.DB, channelSlug, post.id, 3);
    return json({
      post: postDetailDto(post, ctx.env, ctx.origin),
      related: related.map((r) => postDto(r, ctx.env, ctx.origin)),
    });
  });

  router.get('/api/channels', async (ctx: Ctx) =>
    cachedResponse(ctx, { ttlSec: 120 }, async () => {
      const rows = await channelsRepo.listActive(ctx.env.DB);
      return json({ channels: rows.map(channelDto) });
    })
  );

  router.get('/api/channels/:slug', async (ctx: Ctx) => {
    const row = await channelsRepo.findActiveBySlug(ctx.env.DB, ctx.params.slug);
    if (!row) throw ApiError.notFound('Channel not found');
    return json({ channel: channelDto(row) });
  });
}
