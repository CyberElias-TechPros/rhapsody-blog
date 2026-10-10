/**
 * Admin/editor routes — moderation, sync, stats, subscribers, users, audit trail.
 *
 * Authorization matrix (enforced here, never trusted from the UI):
 *   editor: stats, sync, posts moderation, subscribers view/export
 *   admin:  everything an editor can + users management, subscriber delete, audit log
 */

import { z } from 'zod';
import type { Router } from '../lib/router';
import type { Ctx } from '../context';
import { ApiError, json, noContent } from '../lib/http';
import { parseBody, parseQuery } from '../lib/validation';
import { requireRole } from '../lib/jwt';
import { buildFtsQuery, posts as postsRepo } from '../repos/posts';
import { channels as channelsRepo } from '../repos/channels';
import { users as usersRepo } from '../repos/users';
import { subscribers as subscribersRepo } from '../repos/subscribers';
import { audit, recentAudit } from '../repos/audit';
import { syncAllChannels, syncChannel } from '../services/telegram/sync';
import { deleteMediaObject } from '../services/media';
import { channelDto, postDetailDto, postDto } from '../db';
import { safeJsonParse } from '../lib/util';
import { LIMITS, rateLimit } from '../lib/ratelimit';
import type { Role } from '../types';

const editor = (ctx: Ctx) => requireRole(ctx, 'editor', 'admin');
const adminOnly = (ctx: Ctx) => requireRole(ctx, 'admin');

const listPostsSchema = z.object({
  channel: z.string().trim().max(80).optional(),
  status: z.enum(['published', 'draft', 'hidden']).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const patchPostSchema = z
  .object({
    title: z.string().trim().min(5).max(200).optional(),
    excerpt: z.string().trim().max(500).optional(),
    status: z.enum(['published', 'draft', 'hidden']).optional(),
    tags: z.array(z.string().trim().regex(/^[a-z0-9#][a-z0-9_ -]{0,30}$/i)).max(15).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

const patchUserSchema = z
  .object({
    role: z.enum(['user', 'editor', 'admin']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.isActive !== undefined, { message: 'No fields to update' });

function auditAction(ctx: Ctx, action: string, resource: string, resourceId?: string, meta?: Record<string, unknown>) {
  ctx.execution.waitUntil(
    audit(ctx.env, {
      actorId: ctx.user?.id,
      actorEmail: ctx.user?.email,
      action,
      resource,
      resourceId,
      meta,
      ip: ctx.clientIp,
    })
  );
}

export function registerAdminRoutes(router: Router): void {
  router.get('/api/admin/stats', async (ctx: Ctx) => {
    editor(ctx);
    const [postCounts, userCounts, subscriberCount, channelCount, sync] = await Promise.all([
      postsRepo.counts(ctx.env.DB),
      usersRepo.counts(ctx.env.DB),
      subscribersRepo.countActive(ctx.env.DB),
      channelsRepo.count(ctx.env.DB),
      channelsRepo.syncSummary(ctx.env.DB),
    ]);
    return json({
      posts: postCounts,
      users: userCounts,
      subscribers: subscriberCount,
      channels: channelCount,
      channelSync: sync,
    });
  });

  router.post('/api/admin/sync', async (ctx: Ctx) => {
    editor(ctx);
    await rateLimit(ctx.env, 'admin-sync', ctx.user!.id, LIMITS.adminSync);
    const results = await syncAllChannels(ctx.env, ctx.execution.waitUntil.bind(ctx.execution));
    auditAction(ctx, 'admin.sync_all', 'channel', undefined, {
      channels: results.length,
      created: results.reduce((n, r) => n + r.created, 0),
    });
    return json({ results });
  });

  router.post('/api/admin/sync/:slug', async (ctx: Ctx) => {
    editor(ctx);
    await rateLimit(ctx.env, 'admin-sync', ctx.user!.id, LIMITS.adminSync);
    const channel = await channelsRepo.findBySlug(ctx.env.DB, ctx.params.slug);
    if (!channel) throw ApiError.notFound('Channel not found');
    const result = await syncChannel(ctx.env, channel, ctx.execution.waitUntil.bind(ctx.execution));
    auditAction(ctx, 'admin.sync_channel', 'channel', channel.slug, { created: result.created, error: result.error });
    return json({ result });
  });

  router.get('/api/admin/posts', async (ctx: Ctx) => {
    editor(ctx);
    const { channel, status, q, page, limit } = parseQuery(ctx.url, listPostsSchema);
    const { rows, total } = await postsRepo.list(
      ctx.env.DB,
      { channelSlug: channel, status, fts: q ? buildFtsQuery(q) : null, like: q ? q : null },
      'new',
      limit,
      (page - 1) * limit
    );
    return json({
      items: rows.map((r) => ({ ...postDto(r, ctx.env, ctx.origin), status: r.status, telegramUrl: r.telegram_url })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  router.patch('/api/admin/posts/:id', async (ctx: Ctx) => {
    editor(ctx);
    const patch = await parseBody(ctx.request, patchPostSchema);
    const before = await postsRepo.getById(ctx.env.DB, ctx.params.id);
    if (!before) throw ApiError.notFound('Post not found');
    const row = await postsRepo.update(ctx.env.DB, before.id, patch);
    if (!row) throw ApiError.notFound('Post not found');
    auditAction(ctx, 'admin.post_update', 'post', row.id, { fields: Object.keys(patch), status: row.status });
    return json({ post: postDetailDto(row, ctx.env, ctx.origin) });
  });

  router.delete('/api/admin/posts/:id', async (ctx: Ctx) => {
    editor(ctx);
    const row = await postsRepo.delete(ctx.env.DB, ctx.params.id);
    if (!row) throw ApiError.notFound('Post not found');
    if (row.cover_key) ctx.execution.waitUntil(deleteMediaObject(ctx.env, row.cover_key));
    auditAction(ctx, 'admin.post_delete', 'post', row.id, { title: row.title });
    return noContent();
  });

  router.get('/api/admin/subscribers', async (ctx: Ctx) => {
    editor(ctx);
    const { format, limit, offset } = parseQuery(
      ctx.url,
      z.object({
        format: z.enum(['json', 'csv']).default('json'),
        limit: z.coerce.number().int().min(1).max(5000).default(500),
        offset: z.coerce.number().int().min(0).default(0),
      })
    );
    const rows = await subscribersRepo.list(ctx.env.DB, limit, offset);
    const total = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM subscribers').first<{ n: number }>();
    if (format === 'csv') {
      const csv = [
        'email,channels,created_at,unsubscribed_at',
        ...rows.map((r) =>
          [r.email, JSON.stringify(safeJsonParse<string[]>(r.channels, [])).replace(/,/g, ';'), r.created_at, r.unsubscribed_at ?? '']
            .map((f) => `"${String(f).replace(/"/g, '""')}"`)
            .join(',')
        ),
      ].join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="subscribers.csv"',
        },
      });
    }
    return json({
      items: rows.map((r) => ({
        email: r.email,
        channels: safeJsonParse<string[]>(r.channels, []),
        createdAt: r.created_at,
        unsubscribedAt: r.unsubscribed_at,
      })),
      total: total?.n ?? 0,
    });
  });

  router.delete('/api/admin/subscribers/:email', async (ctx: Ctx) => {
    adminOnly(ctx);
    const email = z.string().trim().toLowerCase().parse(ctx.params.email);
    const removed = await subscribersRepo.remove(ctx.env.DB, email);
    if (!removed) throw ApiError.notFound('Subscriber not found');
    auditAction(ctx, 'admin.subscriber_delete', 'subscriber', email);
    return noContent();
  });

  router.get('/api/admin/users', async (ctx: Ctx) => {
    adminOnly(ctx);
    const { limit, offset } = parseQuery(
      ctx.url,
      z.object({
        limit: z.coerce.number().int().min(1).max(200).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      })
    );
    const rows = await usersRepo.list(ctx.env.DB, limit, offset);
    return json({
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        isActive: r.is_active === 1,
        lastLoginAt: r.last_login_at,
        createdAt: r.created_at,
      })),
      total: (await usersRepo.counts(ctx.env.DB)).total,
    });
  });

  router.patch('/api/admin/users/:id', async (ctx: Ctx) => {
    const actor = adminOnly(ctx);
    const patch = await parseBody(ctx.request, patchUserSchema);
    const target = await ctx.env.DB.prepare('SELECT id, role, is_active FROM users WHERE id = ?').bind(ctx.params.id).first<{ id: string; role: Role; is_active: number }>();
    if (!target) throw ApiError.notFound('User not found');

    // Guardrails against lockout/abuse by the actor themselves:
    if (target.id === actor.id && (patch.role === 'user' || patch.isActive === false)) {
      throw ApiError.badRequest('You cannot demote or deactivate your own account');
    }
    if (patch.role === 'user' && target.role === 'admin') {
      const { admins } = await usersRepo.counts(ctx.env.DB);
      if (admins <= 1) throw ApiError.badRequest('Refusing to demote the last remaining admin');
    }

    if (patch.role && patch.role !== target.role) await usersRepo.setRole(ctx.env.DB, target.id, patch.role);
    if (patch.isActive !== undefined && (patch.isActive ? 1 : 0) !== target.is_active) {
      await usersRepo.setActive(ctx.env.DB, target.id, patch.isActive);
    }
    auditAction(ctx, 'admin.user_update', 'user', target.id, { ...patch });
    return json({ ok: true });
  });

  router.get('/api/admin/audit', async (ctx: Ctx) => {
    adminOnly(ctx);
    const { limit } = parseQuery(ctx.url, z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }));
    const rows = await recentAudit(ctx.env.DB, limit);
    return json({
      items: rows.map((r) => ({
        id: r.id,
        actorEmail: r.actor_email,
        action: r.action,
        resource: r.resource,
        resourceId: r.resource_id,
        meta: safeJsonParse<Record<string, unknown>>(r.meta, {}),
        ip: r.ip,
        createdAt: r.created_at,
      })),
    });
  });
}
