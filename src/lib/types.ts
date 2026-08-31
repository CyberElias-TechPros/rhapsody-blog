/**
 * API contract types — mirrors the Cloudflare Worker DTOs (worker/src/types.ts).
 * Keep both in sync; the Worker's `postDto`/`channelDto` mappers are the source of truth.
 */

export type Role = 'user' | 'editor' | 'admin';
export type PostStatus = 'published' | 'draft' | 'hidden';

export interface Channel {
  slug: string;
  name: string;
  username: string;
  telegramUrl: string;
  description: string;
  accent: string;
  postCount: number;
  lastSyncedAt: string | null;
}

export interface PostListItem {
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

export interface PostDetail extends PostListItem {
  content: string;
  telegramUrl: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface ListResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type PostSort = 'new' | 'old' | 'popular';

export interface PostListParams {
  channel?: string;
  q?: string;
  tag?: string;
  page?: number;
  limit?: number;
  sort?: PostSort;
}

export interface SubscriberRow {
  email: string;
  channels: string[];
  createdAt: string;
  unsubscribedAt: string | null;
}

export interface AdminStats {
  posts: { total: number; published: number; hidden: number; draft: number };
  users: { total: number; admins: number };
  subscribers: number;
  channels: number;
  channelSync: Array<{
    slug: string;
    name: string;
    username: string;
    is_active: number;
    last_synced_at: string | null;
    last_message_id: number;
    post_count: number;
  }>;
}

export interface SyncResult {
  channel: string;
  fetched: number;
  created: number;
  skipped: number;
  syncedAt: string;
  error?: string;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  meta: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

/** Shape returned by the admin posts endpoint (worker repos/posts.ts toAdminDto). */
export interface AdminPostRow {
  id: string;
  channelSlug: string;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  status: PostStatus;
  views: number;
  telegramMessageId: number;
  telegramUrl: string;
  tags: string[];
  publishedAt: string;
  updatedAt: string;
}
