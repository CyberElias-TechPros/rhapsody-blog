/**
 * R2 media handling: mirror Telegram CDN cover images into our own bucket.
 *
 * Why: Telegram's t.me preview CDN URLs are proxy links that expire — storing them verbatim
 * (as the Express version did) silently breaks covers over time. Mirroring to R2 at sync
 * time makes covers permanent. Failures degrade gracefully to the original URL.
 */

import type { Env } from '../types';
import { logWarn } from '../lib/logging';

const MAX_BYTES_DEFAULT = 5 * 1024 * 1024;

const EXT_PATTERN = /\.(jpe?g|png|webp|gif)(?:[?#]|$)/i;

/** Validate an R2 key we generated ourselves (guards /media/* against traversal). */
export const isValidMediaKey = (key: string): boolean =>
  /^covers\/[a-z0-9][a-z0-9_-]{0,63}\/\d{1,12}\.(jpg|jpeg|png|webp|gif)$/.test(key);

export function mediaKeyFor(channelSlug: string, messageId: number, sourceUrl: string): string | null {
  const ext = sourceUrl.match(EXT_PATTERN)?.[1]?.toLowerCase();
  if (!ext) return null; // unknown media type (video sticker etc.) — don't mirror blindly
  const normalized = ext === 'jpeg' ? 'jpg' : ext;
  return `covers/${channelSlug}/${messageId}.${normalized}`;
}

/**
 * Download + store a cover object. Returns true on success. Safe to call inside waitUntil.
 */
export async function mirrorCover(env: Env, sourceUrl: string, key: string): Promise<boolean> {
  if (!env.MEDIA) return false;
  try {
    const res = await fetch(sourceUrl, { cf: { cacheTtl: 3600, cacheEverything: true } as RequestInitCfProperties });
    if (!res.ok || !res.body) return false;

    const limit = parseInt(env.MAX_UPLOAD_BYTES || '', 10) || MAX_BYTES_DEFAULT;
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > limit) return false;

    const buf = await readCapped(res.body, limit);
    if (!buf) return false;

    const contentType = res.headers.get('content-type') ?? guessContentType(key);
    await env.MEDIA.put(key, buf, {
      httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
    });
    return true;
  } catch (err) {
    logWarn('media: mirror failed', { key, error: String(err) });
    return false;
  }
}

async function readCapped(body: ReadableStream<Uint8Array>, limit: number): Promise<ArrayBuffer | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out.buffer;
}

const guessContentType = (key: string): string => {
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
};

export interface MediaObject {
  body: ReadableStream<Uint8Array> | null;
  contentType: string;
  etag: string | null;
}

export async function getMediaObject(env: Env, key: string): Promise<MediaObject | null> {
  if (!env.MEDIA) return null;
  const obj = await env.MEDIA.get(key);
  if (!obj) return null;
  // A full R2 `get` includes the body; the type surface for that varies across
  // workers-types revisions, so normalize to a minimal shape here.
  const body = (obj as unknown as { body?: ReadableStream<Uint8Array> }).body ?? null;
  return {
    body,
    contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
    etag: obj.etag ?? null,
  };
}

export async function deleteMediaObject(env: Env, key: string): Promise<void> {
  if (!env.MEDIA || !key) return;
  try {
    await env.MEDIA.delete(key);
  } catch (err) {
    logWarn('media: delete failed', { key, error: String(err) });
  }
}
