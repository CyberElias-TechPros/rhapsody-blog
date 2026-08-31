/**
 * Meaning API — Cloudflare Worker entry.
 *
 * Request pipeline:
 *   request-id → CORS (preflight) → auth resolution (JWT→user row, when header present) →
 *   route match → handler → uniform error envelope + security headers → structured access log.
 *
 * Bindings (see wrangler.jsonc):
 *   DB (D1)         — relational data + FTS5 search
 *   RATE_LIMITS(KV) — soft abuse counters (no-op when unbound)
 *   MEDIA (R2)      — mirrored Telegram cover images (optional; falls back to source URLs)
 *   Cron            — "every 15 min" Telegram sync (failure-isolated per channel)
 */

import type { Env } from './types';
import type { Ctx } from './context';
import { Router } from './lib/router';
import { errorResponse, withSecurityHeaders, REQUEST_ID_HEADER, ApiError, json } from './lib/http';
import { ZodError } from 'zod';
import { zodDetails } from './lib/validation';
import { allowedOrigin, corsHeaders } from './lib/cors';
import { authenticate } from './lib/jwt';
import { logError, logInfo } from './lib/logging';
import { clientIp, LIMITS, rateLimit } from './lib/ratelimit';
import { registerAuthRoutes } from './routes/auth';
import { registerPostRoutes } from './routes/posts';
import { registerMeRoutes } from './routes/me';
import { registerSubscriberRoutes } from './routes/subscribers';
import { registerAdminRoutes } from './routes/admin';
import { registerMiscRoutes } from './routes/misc';
import { scheduleBootstrap } from './services/bootstrap';
import { syncAllChannels } from './services/telegram/sync';

const router = new Router();
registerMiscRoutes(router);
registerAuthRoutes(router);
registerPostRoutes(router);
registerMeRoutes(router);
registerSubscriberRoutes(router);
registerAdminRoutes(router);

export default {
  async fetch(request: Request, env: Env, execution: ExecutionContext): Promise<Response> {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const cors = corsHeaders(allowedOrigin(request.headers.get('origin'), env.ALLOWED_ORIGINS));

    try {
      scheduleBootstrap(env, execution);

      // Global soft limiter for anonymous reads (per IP). Authenticated traffic uses tighter
      // per-route limits; hard enforcement belongs in the Cloudflare WAF (documented).
      if (request.method === 'GET' && url.pathname.startsWith('/api/') && !request.headers.get('authorization')) {
        await rateLimit(env, 'public-read', clientIp(request), LIMITS.publicRead);
      }

      if (request.method === 'OPTIONS') {
        return finish(new Response(null, { status: 204 }), cors, requestId);
      }

      // Resolve the caller (if any) before routing so handlers can enforce authorization.
      const user = await authenticate(env, request);

      const { handler, params } = router.match(request.method, url.pathname);
      const ctx: Ctx = {
        request,
        url,
        params,
        env,
        execution,
        requestId,
        clientIp: clientIp(request),
        user,
        origin: url.origin,
      };

      const response = await handler(ctx);
      return finish(response, cors, requestId);
    } catch (err) {
      if (err instanceof ZodError) {
        // Params/query validated inside handlers get the same envelope as body validation.
        return finish(
          json({ error: { code: 'VALIDATION', message: 'Validation failed', details: zodDetails(err) } }, { status: 400 }),
          cors,
          requestId
        );
      }
      if (!(err instanceof ApiError) || err.status >= 500) {
        logError('request failed', {
          requestId,
          path: url.pathname,
          method: request.method,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
      return finish(errorResponse(err, requestId), cors, requestId);
    } finally {
      logInfo('access', {
        rid: requestId,
        method: request.method,
        path: url.pathname,
        ms: Date.now() - started,
      });
    }
  },

  /** Cron trigger: scheduled Telegram sync. Errors are per-channel isolated inside syncAll. */
  async scheduled(event: ScheduledEvent, env: Env, execution: ExecutionContext): Promise<void> {
    logInfo('cron: telegram sync starting', { cron: event.cron });
    const results = await syncAllChannels(env, execution.waitUntil.bind(execution));
    const created = results.reduce((n, r) => n + r.created, 0);
    const failed = results.filter((r) => r.error).length;
    logInfo('cron: telegram sync complete', { channels: results.length, created, failed });
  },
};

function finish(res: Response, cors: Record<string, string>, requestId: string): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) if (v) headers.set(k, v);
  headers.set(REQUEST_ID_HEADER, requestId);
  return withSecurityHeaders(new Response(res.body, { status: res.status, statusText: res.statusText, headers }));
}
