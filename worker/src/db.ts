/**
 * D1 helpers + row→DTO mapping. DTOs are deliberately narrow: never return raw rows.
 */

import type { ChannelDto, ChannelRow, Env, PostDetailDto, PostDto, PostRow } from './types';
import { safeJsonParse } from './lib/util';

export function postDto(row: PostRow, env: Env, origin: string): PostDto {
  return {
    id: row.id,
    channelSlug: row.channel_slug,
    channelName: row.channel_name,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    publishedAt: row.published_at,
    readingMinutes: row.reading_minutes,
    tags: safeJsonParse<string[]>(row.tags, []),
    views: row.views,
    coverUrl: coverUrl(row, env, origin),
  };
}

export function postDetailDto(row: PostRow, env: Env, origin: string): PostDetailDto {
  return {
    ...postDto(row, env, origin),
    content: row.content,
    telegramUrl: row.telegram_url,
  };
}

/** Prefer the R2-mirrored cover (permanent); fall back to the original Telegram CDN URL. */
function coverUrl(row: PostRow, env: Env, origin: string): string | null {
  if (row.cover_key) {
    const base = env.MEDIA_PUBLIC_URL?.replace(/\/+$/, '');
    return base ? `${base}/${row.cover_key}` : `${origin}/media/${row.cover_key}`;
  }
  return row.cover_url || null;
}

export function channelDto(row: ChannelRow): ChannelDto {
  return {
    slug: row.slug,
    name: row.name,
    username: row.username,
    telegramUrl: `https://t.me/s/${row.username}`,
    description: row.description,
    accent: row.accent,
    postCount: row.post_count,
    lastSyncedAt: row.last_synced_at,
  };
}

export const userDto = (row: {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}): { id: string; name: string; email: string; role: string; createdAt: string } => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
});
