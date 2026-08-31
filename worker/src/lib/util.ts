/**
 * Small utilities shared across the Worker.
 */

/** ISO-8601 UTC truncated to seconds — matches the SQL default format so string ordering == temporal ordering. */
export const nowIso = (d: Date = new Date()): string => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

export const isoOr = (d: Date | null | undefined): string | null => (d ? nowIso(d) : null);

/** Canonical ISO for a possibly-ms string produced elsewhere. */
export const normalizeIso = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length === 0) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : nowIso(new Date(t));
};

export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed === null || parsed === undefined ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

export const slugify = (input: string): string =>
  input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');

/** Basic timing-safe comparison of equal-expectation byte arrays. */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export const fromHex = (hex: string): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Escape user-provided text before embedding into HTML fragments. */
export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const truncate = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
