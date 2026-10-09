/**
 * Uniform HTTP error + response envelope.
 * Errors: { error: { code, message, details? } } — the same envelope the old Express API used,
 * so the frontend contract never had a breaking rename.
 */

export const REQUEST_ID_HEADER = 'x-request-id';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = status === 500 ? 'INTERNAL' : 'ERROR',
    public readonly details?: unknown
  ) {
    super(message);
  }

  static badRequest(msg = 'Bad request', details?: unknown) {
    return new ApiError(400, msg, 'VALIDATION', details);
  }
  static unauthorized(msg = 'Authentication required') {
    return new ApiError(401, msg, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'Forbidden') {
    return new ApiError(403, msg, 'FORBIDDEN');
  }
  static notFound(msg = 'Not found') {
    return new ApiError(404, msg, 'NOT_FOUND');
  }
  static conflict(msg = 'Conflict') {
    return new ApiError(409, msg, 'CONFLICT');
  }
  static tooManyRequests(msg = 'Too many requests', retryAfterSec?: number) {
    return new ApiError(429, msg, 'RATE_LIMITED', retryAfterSec ? { retryAfter: retryAfterSec } : undefined);
  }
}

const COMMON_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(COMMON_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  // Responses may be personalized (Authorization) — default to no-store; callers override for cacheable GETs.
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function json(
  data: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  });
}

export const noContent = (): Response => new Response(null, { status: 204 });

export function errorResponse(err: unknown, requestId: string): Response {
  if (err instanceof ApiError) {
    const body: Record<string, unknown> = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error = { ...(body.error as object), details: err.details };
    const headers: Record<string, string> = {};
    if (err.status === 429) {
      const d = err.details as { retryAfter?: number } | undefined;
      if (d?.retryAfter) headers['Retry-After'] = String(d.retryAfter);
    }
    return json(body, { status: err.status, headers });
  }
  // Never leak internals for unexpected failures.
  return json({ error: { code: 'INTERNAL', message: 'Something went wrong', requestId } }, { status: 500 });
}
