/**
 * Subscriber routes (email digest list).
 *
 * - Subscribe is idempotent (upsert) and rate-limited per IP.
 * - Unsubscribe is a signed-token GET link so future digest emails can contain a working
 *   one-click unsubscribe (RFC 8058 style) without exposing login.
 * - Actual delivery is provider-pluggable (EMAIL_* env); the list is the durable source of truth.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Router } from '../lib/router';
import type { Ctx } from '../context';
import { ApiError, json } from '../lib/http';
import { parseBody, parseQuery } from '../lib/validation';
import { LIMITS, clientIp, rateLimit } from '../lib/ratelimit';
import { subscribers as subscribersRepo } from '../repos/subscribers';

const emailInput = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email('Invalid email address').refine((v) => v.length <= 255, 'Email too long')
);

const subscribeSchema = z.object({
  email: emailInput,
  channels: z.array(z.string().trim().regex(/^[a-z0-9-]{1,80}$/)).max(20).default([]),
});

const UNSUB_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

/** Deterministic signed capability for one-click unsubscribe. */
export function makeUnsubscribeToken(secret: string, email: string, exp: number): string {
  return createHmac('sha256', secret).update(`${email}:${Math.floor(exp / UNSUB_TTL_SEC)}`).digest('base64url');
}

function verifyUnsubscribeToken(secret: string, email: string, token: string): boolean {
  // The token is derived from a ~30-day time bucket, so a link emailed late in one bucket would
  // fail the moment the bucket rolled over. Accept the previous bucket too: the TTL still expires,
  // but an unsubscribe never fails for a reason the reader cannot act on.
  const now = Date.now();
  return [makeUnsubscribeToken(secret, email, now), makeUnsubscribeToken(secret, email, now - UNSUB_TTL_SEC * 1000)].some(
    (candidate) => {
      try {
        return timingSafeEqual(Buffer.from(candidate), Buffer.from(token));
      } catch {
        return false;
      }
    }
  );
}

const emailSchema = emailInput;

const unsubQuerySchema = z.object({
  email: z.string().min(3).max(255),
  token: z.string().min(10).max(200),
});

export function registerSubscriberRoutes(router: Router): void {
  router.post('/api/subscribers', async (ctx: Ctx) => {
    await rateLimit(ctx.env, 'subscribe', clientIp(ctx.request), LIMITS.subscribe);
    const { email, channels } = await parseBody(ctx.request, subscribeSchema);

    // Only accept channel slugs that actually exist (prevents list pollution).
    const active = await ctx.env.DB.prepare('SELECT slug FROM channels WHERE is_active = 1').all<{ slug: string }>();
    const known = new Set((active.results ?? []).map((r) => r.slug));
    const filtered = channels.filter((c) => known.has(c));

    await subscribersRepo.upsert(ctx.env.DB, email, filtered, 'site');
    // NOTE: the unsubscribe link (makeUnsubscribeToken) is composed server-side when a digest
    // email is rendered — it is deliberately NOT returned to the public subscribe caller,
    // otherwise anyone could obtain (and use) unsubscribe links for known addresses.
    return json({ subscriber: { email, channels: filtered } }, { status: 201 });
  });

  /** GET link target — returns a tiny HTML page (browser-friendly) rather than JSON. */
  router.get('/api/subscribers/unsubscribe', async (ctx: Ctx) => {
    const { email, token } = parseQuery(ctx.url, unsubQuerySchema);
    let ok = false;
    if (ctx.env.JWT_SECRET) ok = verifyUnsubscribeToken(ctx.env.JWT_SECRET, email, token);
    if (!ok) throw ApiError.forbidden('Invalid or expired unsubscribe link');

    await subscribersRepo.unsubscribe(ctx.env.DB, emailSchema.parse(email));
    return new Response(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Unsubscribed — Rhapsody of Realities</title>
       <body style="font-family:system-ui;max-width:40rem;margin:8rem auto;padding:0 1.5rem;color:#231a12">
       <h1>You have been unsubscribed</h1>
       <p>You will no longer receive the daily Rhapsody of Realities devotional by email. Changed your mind? Re-subscribe any time on
       <a href="/">the site</a>.</p></body>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  });
}
