/**
 * Edge caching helper for cacheable public GET endpoints.
 *
 * Uses the Workers cache API (Cloudflare edge, per-colo). Only unauthenticated GETs are
 * stored — never cache anything that varies by `user` or `Authorization`.
 */

import type { Ctx } from '../context';

const CACHE_KEY_PREFIX = 'apiv1';

interface CacheOptions {
  /** edge TTL in seconds */
  ttlSec: number;
}

function cacheKey(ctx: Ctx): Request | null {
  if (ctx.request.method !== 'GET') return null;
  if (ctx.request.headers.get('authorization')) return null; // personalized or in-flight auth
  if (ctx.url.searchParams.get('nocache') === '1') return null;
  return new Request(`${ctx.url.toString()}|${CACHE_KEY_PREFIX}`, { headers: ctx.request.headers });
}

export async function cachedResponse(ctx: Ctx, opts: CacheOptions, produce: () => Promise<Response>): Promise<Response> {
  const key = cacheKey(ctx);
  if (key) {
    try {
      const hit = await caches.default.match(key);
      if (hit) return withAge(hit, opts.ttlSec);
    } catch {
      /* cache API best-effort */
    }
  }

  const response = await produce();
  if (key && response.ok) {
    const stored = new Response(response.body, response);
    stored.headers.set('Cache-Control', `public, max-age=15, s-maxage=${opts.ttlSec}, stale-while-revalidate=120`);
    const put = caches.default.put(key, stored.clone());
    ctx.execution.waitUntil(put.catch(() => undefined));
    return putResponseHeaders(stored, opts.ttlSec);
  }
  return response;
}

function putResponseHeaders(res: Response, ttlSec: number): Response {
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', `public, max-age=15, s-maxage=${ttlSec}, stale-while-revalidate=120`);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function withAge(res: Response, ttlSec: number): Response {
  const headers = new Headers(res.headers);
  headers.set('Age', '0');
  headers.set('X-Cache', 'HIT');
  headers.set('Cache-Control', `public, max-age=15, s-maxage=${ttlSec}, stale-while-revalidate=120`);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Invalidate everything cacheable (channels/posts lists). Best-effort; called after admin mutations. */
export function invalidateContentCaches(ctx: Ctx): void {
  // The Workers cache API cannot purge by prefix from a Worker; entries expire within their TTL
  // (s-maxage ≤ 120s), which is acceptable for a 15-minute-sync content site.
  // If stronger invalidation is needed, use the Purge API (zone token) — deliberately not
  // embedded in the Worker to keep zone-scoped API tokens out of the runtime.
  void ctx;
}
