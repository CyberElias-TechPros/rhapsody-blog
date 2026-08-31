/**
 * Per-user routes: bookmarks and channel follows. Authorization is ownership-scoped by
 * construction — every query filters on the authenticated user id; there is no way to read
 * or mutate another user's collections.
 */

import { z } from 'zod';
import type { Router } from '../lib/router';
import type { Ctx } from '../context';
import { ApiError, json, noContent } from '../lib/http';
import { requireUser } from '../lib/jwt';
import { bookmarks, follows } from '../repos/bookmarks';
import { posts as postsRepo } from '../repos/posts';
import { channels as channelsRepo } from '../repos/channels';
import { channelDto, postDto } from '../db';

const postIdParam = z.string().uuid('Invalid post id');
const slugParam = z.string().trim().regex(/^[a-z0-9-]{1,80}$/, 'Invalid channel slug');

export function registerMeRoutes(router: Router): void {
  router.get('/api/me/bookmarks', async (ctx: Ctx) => {
    const user = requireUser(ctx);
    const rows = await bookmarks.listPostRows(ctx.env.DB, user.id, 100);
    return json({ items: rows.map((r) => postDto(r, ctx.env, ctx.origin)) });
  });

  router.get('/api/me/bookmarks/ids', async (ctx: Ctx) => {
    const user = requireUser(ctx);
    return json({ ids: await bookmarks.ids(ctx.env.DB, user.id) });
  });

  router.post('/api/me/bookmarks/:postId', async (ctx: Ctx) => {
    const user = requireUser(ctx);
    const postId = postIdParam.parse(ctx.params.postId);
    const post = await postsRepo.getById(ctx.env.DB, postId);
    if (!post || post.status !== 'published') throw ApiError.notFound('Post not found');
    await bookmarks.add(ctx.env.DB, user.id, postId);
    return json({ ok: true }, { status: 201 });
  });

  router.delete('/api/me/bookmarks/:postId', async (ctx: Ctx) => {
    const user = requireUser(ctx);
    await bookmarks.remove(ctx.env.DB, user.id, postIdParam.parse(ctx.params.postId));
    return noContent();
  });

  router.get('/api/me/follows', async (ctx: Ctx) => {
    const user = requireUser(ctx);
    const rows = await follows.channelRows(ctx.env.DB, user.id);
    return json({ items: rows.map(channelDto), slugs: rows.map((r) => r.slug) });
  });

  router.post('/api/me/follows/:channelSlug', async (ctx: Ctx) => {
    const user = requireUser(ctx);
    const slug = slugParam.parse(ctx.params.channelSlug);
    const channel = await channelsRepo.findActiveBySlug(ctx.env.DB, slug);
    if (!channel) throw ApiError.notFound('Channel not found');
    await follows.add(ctx.env.DB, user.id, slug);
    return json({ ok: true }, { status: 201 });
  });

  router.delete('/api/me/follows/:channelSlug', async (ctx: Ctx) => {
    const user = requireUser(ctx);
    await follows.remove(ctx.env.DB, user.id, slugParam.parse(ctx.params.channelSlug));
    return noContent();
  });
}
