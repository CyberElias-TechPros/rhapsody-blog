/**
 * Shared environment + domain types for the Meaning API Worker.
 */

export interface Env {
  DB: D1Database;
  /** KV used for abuse-protection counters (soft, non-atomic). */
  RATE_LIMITS?: KVNamespace;
  /** R2 bucket holding mirrored Telegram media (covers, etc.). */
  MEDIA?: R2Bucket;

  // Secrets (wrangler secret put / .dev.vars)
  JWT_SECRET: string;
  JWT_EXPIRES_IN?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;

  // Vars (wrangler.jsonc [vars])
  ALLOWED_ORIGINS?: string;
  SITE_URL?: string;
  MEDIA_PUBLIC_URL?: string;
  MAX_UPLOAD_BYTES?: string;

  // Optional outbound email provider for digests (see README).
  EMAIL_API_URL?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
}

export type Role = 'user' | 'editor' | 'admin';
export type PostStatus = 'published' | 'draft' | 'hidden';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  is_active: number;
  token_version: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelRow {
  id: string;
  slug: string;
  name: string;
  username: string;
  description: string;
  accent: string;
  is_active: number;
  last_synced_at: string | null;
  last_message_id: number;
  post_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostRow {
  id: string;
  channel_id: string;
  channel_slug: string;
  channel_name: string;
  telegram_message_id: number;
  telegram_url: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_url: string;
  cover_key: string;
  tags: string;
  published_at: string;
  reading_minutes: number;
  status: PostStatus;
  views: number;
  created_at: string;
  updated_at: string;
}

/** Public post shape (list items — no `content`). */
export interface PostDto {
  id: string;
  channelSlug: string;
  channelName: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string;
  readingMinutes: number;
  tags: string[];
  views: number;
  coverUrl: string | null;
}

/** Public post shape (detail — includes content + source attribution). */
export interface PostDetailDto extends PostDto {
  content: string;
  telegramUrl: string;
}

export interface ChannelDto {
  slug: string;
  name: string;
  username: string;
  telegramUrl: string;
  description: string;
  accent: string;
  postCount: number;
  lastSyncedAt: string | null;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tokenVersion: number;
}

export const EDITOR_ROLES: Role[] = ['editor', 'admin'];
