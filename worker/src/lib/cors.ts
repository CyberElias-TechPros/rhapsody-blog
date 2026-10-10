/**
 * CORS: allow-list of frontend origins (Vercel prod/preview + localhost dev).
 * Configured via the ALLOWED_ORIGINS var (comma separated). Vercel preview URLs
 * (*.vercel.app) are matched per-suffix so branch previews work without redeploying the Worker.
 */

const VERCEL_PREVIEW_SUFFIX = '.vercel.app';

export function allowedOrigin(requestOrigin: string | null, allowedList: string | undefined): string | null {
  if (!requestOrigin) return null;
  const list = (allowedList ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.includes(requestOrigin.toLowerCase())) return requestOrigin;
  if (list.includes('*')) return requestOrigin;
  try {
    const u = new URL(requestOrigin);
    if (u.hostname.endsWith(VERCEL_PREVIEW_SUFFIX) && list.includes(`*${VERCEL_PREVIEW_SUFFIX}`)) {
      return requestOrigin;
    }
    if (u.hostname.endsWith(VERCEL_PREVIEW_SUFFIX) && list.length > 0 && list.includes('vercel-previews')) {
      return requestOrigin;
    }
  } catch {
    return null;
  }
  return null;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'false', // Authorization: Bearer — cookies never used
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
