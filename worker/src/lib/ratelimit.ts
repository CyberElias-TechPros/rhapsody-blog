/**
 * KV-backed fixed-window counters for abuse protection (soft limits).
 *
 * Note: `get`+`put` is not atomic, so under heavy parallelism the limit is approximate.
 * For hard enforcement, configure Cloudflare Rate Limiting rules / WAF managed rules on the
 * zone — this layer exists to stop casual scripted abuse (login brute force, spam subscribe).
 * If the RATE_LIMITS binding is absent (e.g. minimal local setup) the limiter is a no-op
 * rather than failing requests.
 */

import type { Env } from '../types';
import { ApiError } from './http';
import { logWarn } from './logging';

export interface LimitSpec {
  /** requests allowed per window */
  limit: number;
  /** window size in seconds */
  windowSec: number;
}

export const LIMITS = {
  login: { limit: 10, windowSec: 900 },
  register: { limit: 5, windowSec: 3600 },
  passwordChange: { limit: 5, windowSec: 3600 },
  subscribe: { limit: 10, windowSec: 3600 },
  publicRead: { limit: 300, windowSec: 60 },
  adminSync: { limit: 6, windowSec: 600 },
} as const satisfies Record<string, LimitSpec>;

const windowBucket = (windowSec: number): number => Math.floor(Date.now() / 1000 / windowSec);

export async function rateLimit(env: Env, scope: string, ident: string, spec: LimitSpec): Promise<void> {
  const kv = env.RATE_LIMITS;
  if (!kv) return;
  const key = `rl:${scope}:${ident}:${windowBucket(spec.windowSec)}`;
  try {
    const current = Number((await kv.get(key)) ?? '0');
    if (current >= spec.limit) {
      const toWindowEnd = spec.windowSec - (Math.floor(Date.now() / 1000) % spec.windowSec);
      throw ApiError.tooManyRequests('Too many requests — please slow down', toWindowEnd);
    }
    // +2s margin so the previous bucket cannot overlap incorrectly with KV propagation.
    await kv.put(key, String(current + 1), { expirationTtl: spec.windowSec + 2 });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // KV unavailable — degrade open, but surface for operators.
    logWarn('rate_limit: KV failure — limiter disabled for this request', { scope, error: String(err) });
  }
}

/** Best-effort client IP from Cloudflare metadata. */
export const clientIp = (request: Request): string =>
  request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? 'unknown';
