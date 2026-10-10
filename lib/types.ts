/**
 * Content model for the blog.
 *
 * Two worlds live side by side:
 *
 * 1. `Devotional` — the published corpus. Every daily article from the monthly PDF editions,
 *    extracted into `content/devotionals/*.md` by `scripts/extract-devotionals.mjs` and read
 *    straight off disk at build time. This is the blog.
 * 2. The Worker DTOs below (`Channel`, `PostListItem`, `AdminStats`, …) — unchanged from the
 *    Cloudflare Worker API in `/worker`, which still owns accounts, the admin console and
 *    newsletter subscribers. Only screens that talk to that API import them.
 */

/* ------------------------------------------------------------------ content (this repo) */

import type { AudienceId } from './audiences';

export type { AudienceId } from './audiences';

export type ClosingLabel = 'Prayer' | 'Confession';

/**
 * A section some audience prints that the adult edition has no field for — the teens edition's
 * `Speak` and `Act`. They travel as label + text instead of as new keys per section, so a family
 * that prints something else does not need a new field.
 */
export interface DevotionalSection {
  label: string;
  text: string;
}

export interface Devotional {
  /** Dated permalink slug: `2026-09-01-the-name-that-rules-heaven-and-earth`. */
  slug: string;
  title: string;
  /** The all-caps headline exactly as printed in the edition — kept for provenance. */
  titleOriginal: string;
  /** `yyyy-mm-dd`, the day the devotional is for. */
  date: string;
  weekday: string;
  dayOfMonth: number;
  /** `yyyy-mm` — the edition this article belongs to. */
  edition: string;
  editionTitle: string;
  /** Which edition family this article belongs to; defaults to `adults` in the content layer. */
  audience: AudienceId;
  /** `For Teens` and friends — the audience name as the edition prints it. */
  audienceLabel: string;
  author: string;
  series: string;
  kind: string;
  excerpt: string;
  /** Opening scripture, quoted in full. */
  scripture: string;
  /** e.g. `Matthew 28:18` — parsed out of the closing parenthesis. */
  scriptureReference: string;
  /** The parenthetical line under the title, when the edition prints one. */
  subtitle?: string;
  /** Most days close with a PRAYER; some close with a CONFESSION instead. */
  prayerLabel: ClosingLabel;
  prayer: string;
  /** The audience's own closing sections (`Speak`, `Act`), in the order the page prints them. */
  extras: DevotionalSection[];
  furtherStudy: string;
  oneYearPlan: string;
  twoYearPlan: string;
  readingMinutes: number;
  tags: string[];
  /** Which PDF the article came from, and which two pages of it. */
  sourcePdf: string;
  sourcePages: number[];
  source: string;
  status: 'published' | 'draft';
  /** The article message only (Markdown), without the closing sections. */
  message: string[];
  /** The full Markdown body: message + prayer + further study + reading plans. */
  body: string;
  words: number;
}

/** A card-sized view of a devotional — enough for lists, without loading the body. */
export type DevotionalSummary = Omit<Devotional, 'body' | 'message'>;

export interface Edition {
  slug: string;
  title: string;
  /** `October 2026 · For Teens` on an audience's edition, plain `October 2026` on the adult one. */
  audienceTitle: string;
  audience: AudienceId;
  audienceLabel: string;
  year: number;
  month: number;
  monthName: string;
  postCount: number;
  firstDate: string;
  lastDate: string;
  sourcePdf: string;
}

export type DevotionalSort = 'new' | 'old';

export interface DevotionalQuery {
  edition?: string;
  audience?: AudienceId;
  tag?: string;
  q?: string;
  sort?: DevotionalSort;
  page?: number;
  limit?: number;
}

/** An edition listing grouped under the audience it was written for. */
export interface AudienceGroup {
  audience: AudienceId;
  label: string;
  shortLabel: string;
  series: string;
  blurb: string;
  postCount: number;
  editions: Edition[];
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** The compact payload shipped to the client so `/search` can filter without a server round-trip. */
export interface SearchDoc {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  edition: string;
  editionTitle: string;
  audience: AudienceId;
  audienceLabel: string;
  weekday: string;
  scriptureReference: string;
  tags: string[];
  readingMinutes: number;
  /** Opening words of the message, so searches can match the article itself. */
  opening: string;
}

/* ------------------------------------------------------------------ Worker API contract */

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
