/**
 * Posts repository — all query building goes through bound parameters only.
 * User-controlled filter values never touch the SQL string.
 */

import type { PostRow, PostStatus } from '../types';
import { nowIso } from '../lib/util';

const POST_COLUMNS = `id, channel_id, channel_slug, channel_name, telegram_message_id, telegram_url,
  title, slug, excerpt, content, cover_url, cover_key, tags, published_at, reading_minutes,
  status, views, created_at, updated_at`;

/**
 * Turn free-text into a safe FTS5 MATCH expression: word tokens only, prefix-matched.
 * This removes all FTS operator syntax (&, |, ", :, NEAR, …) from user input, so a
 * crafted query can never break the MATCH clause.
 */
export function buildFtsQuery(raw: string): string | null {
  const tokens = raw.toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu)?.slice(0, 8) ?? [];
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replace(/"/g, '')}"*`).join(' AND ');
}

export interface PostListFilters {
  channelSlug?: string;
  status?: PostStatus;
  tag?: string;
  fts?: string | null;
  like?: string | null;
}

export interface ListResult {
  rows: PostRow[];
  total: number;
}

const sortSql = (sort: 'new' | 'old' | 'popular'): string =>
  sort === 'popular' ? 'p.views DESC, p.published_at DESC' : sort === 'old' ? 'p.published_at ASC' : 'p.published_at DESC';

function where(f: PostListFilters): { clause: string; binds: (string | number)[]; joins: string } {
  const parts: string[] = [];
  const binds: (string | number)[] = [];
  let joins = '';
  if (f.channelSlug) {
    parts.push('p.channel_slug = ?');
    binds.push(f.channelSlug);
  }
  if (f.status) {
    parts.push('p.status = ?');
    binds.push(f.status);
  }
  if (f.tag) {
    // tags stored as a JSON array of strings — indexed lookup is impractical in SQLite;
    // exact-quoted LIKE is safe because we control the quoting and bind the value.
    parts.push('p.tags LIKE ?');
    binds.push(`%"${f.tag.replace(/[%_\\]/g, '')}"%`);
  }
  if (f.fts) {
    joins = 'JOIN posts_fts ON posts_fts.rowid = p.rowid';
    parts.push('posts_fts MATCH ?');
    binds.push(f.fts);
  } else if (f.like) {
    const pattern = `%${f.like.replace(/[%_\\]/g, '')}%`;
    parts.push('(p.title LIKE ? ESCAPE \'\\\' OR p.excerpt LIKE ? ESCAPE \'\\\' OR p.content LIKE ? ESCAPE \'\\\')');
    binds.push(pattern, pattern, pattern);
  }
  return { clause: parts.length ? `WHERE ${parts.join(' AND ')}` : '', binds, joins };
}

export const posts = {
  async list(db: D1Database, f: PostListFilters, sort: 'new' | 'old' | 'popular', limit: number, offset: number): Promise<ListResult> {
    const { clause, binds, joins } = where(f);
    const countRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM posts p ${joins} ${clause}`)
      .bind(...binds)
      .first<{ n: number }>();
    const total = countRow?.n ?? 0;
    const { results } = await db
      .prepare(`SELECT p.${POST_COLUMNS.split(',').join(', p.')} FROM posts p ${joins} ${clause} ORDER BY ${sortSql(sort)} LIMIT ? OFFSET ?`)
      .bind(...binds, limit, offset)
      .all<PostRow>();
    return { rows: results ?? [], total };
  },

  /** Atomically bumps + returns the views counter (a single UPDATE…RETURNING — no read-modify-write race). */
  async getPublishedWithView(db: D1Database, channelSlug: string, slug: string): Promise<PostRow | null> {
    const row = await db
      .prepare(
        `UPDATE posts SET views = views + 1, updated_at = updated_at
         WHERE channel_slug = ? AND slug = ? AND status = 'published'
         RETURNING ${POST_COLUMNS}`
      )
      .bind(channelSlug, slug)
      .first<PostRow>();
    return row ?? null;
  },

  async getByChannelAndSlug(db: D1Database, channelSlug: string, slug: string): Promise<PostRow | null> {
    return db
      .prepare(`SELECT ${POST_COLUMNS} FROM posts WHERE channel_slug = ? AND slug = ?`)
      .bind(channelSlug, slug)
      .first<PostRow>();
  },

  async getById(db: D1Database, id: string): Promise<PostRow | null> {
    return db.prepare(`SELECT ${POST_COLUMNS} FROM posts WHERE id = ?`).bind(id).first<PostRow>();
  },

  async related(db: D1Database, channelSlug: string, excludeId: string, limit: number): Promise<PostRow[]> {
    const { results } = await db
      .prepare(
        `SELECT ${POST_COLUMNS} FROM posts
         WHERE channel_slug = ? AND status = 'published' AND id != ?
         ORDER BY published_at DESC LIMIT ?`
      )
      .bind(channelSlug, excludeId, limit)
      .all<PostRow>();
    return results ?? [];
  },

  /** Idempotent insert used by the sync. Returns true when a new row was created. */
  async insertIfAbsent(db: D1Database, p: Omit<PostRow, 'created_at' | 'updated_at' | 'views' | 'status'> & { status?: PostStatus }): Promise<boolean> {
    const res = await db
      .prepare(
        `INSERT OR IGNORE INTO posts (
           id, channel_id, channel_slug, channel_name, telegram_message_id, telegram_url,
           title, slug, excerpt, content, cover_url, cover_key, tags, published_at,
           reading_minutes, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        p.id, p.channel_id, p.channel_slug, p.channel_name, p.telegram_message_id, p.telegram_url,
        p.title, p.slug, p.excerpt, p.content, p.cover_url, p.cover_key, p.tags, p.published_at,
        p.reading_minutes, p.status ?? 'published', nowIso(), nowIso()
      )
      .run();
    return (res.meta?.changes ?? 0) > 0;
  },

  async setCoverKey(db: D1Database, id: string, key: string): Promise<void> {
    await db.prepare('UPDATE posts SET cover_key = ? WHERE id = ? AND cover_key = \'\'').bind(key, id).run();
  },

  async update(
    db: D1Database,
    id: string,
    patch: { title?: string; excerpt?: string; status?: PostStatus; tags?: string[] }
  ): Promise<PostRow | null> {
    const sets: string[] = [];
    const binds: (string | number)[] = [];
    if (patch.title !== undefined) { sets.push('title = ?'); binds.push(patch.title); }
    if (patch.excerpt !== undefined) { sets.push('excerpt = ?'); binds.push(patch.excerpt); }
    if (patch.status !== undefined) { sets.push('status = ?'); binds.push(patch.status); }
    if (patch.tags !== undefined) { sets.push('tags = ?'); binds.push(JSON.stringify(patch.tags)); }
    if (sets.length === 0) return posts.getById(db, id);
    sets.push('updated_at = ?');
    binds.push(nowIso());
    await db.prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run();
    return posts.getById(db, id);
  },

  async delete(db: D1Database, id: string): Promise<PostRow | null> {
    const row = await db.prepare(`DELETE FROM posts WHERE id = ? RETURNING ${POST_COLUMNS}`).bind(id).first<PostRow>();
    return row ?? null;
  },

  async counts(db: D1Database): Promise<{ total: number; published: number; hidden: number; draft: number }> {
    const r = await db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
                SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END) AS hidden,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft
         FROM posts`
      )
      .first<{ total: number; published: number | null; hidden: number | null; draft: number | null }>();
    return { total: r?.total ?? 0, published: r?.published ?? 0, hidden: r?.hidden ?? 0, draft: r?.draft ?? 0 };
  },

  /** Latest N published posts for sitemap/indexing. */
  async recentForSitemap(db: D1Database, limit: number): Promise<{ channel_slug: string; slug: string; updated_at: string; published_at: string }[]> {
    const { results } = await db
      .prepare(
        `SELECT channel_slug, slug, updated_at, published_at FROM posts
         WHERE status = 'published' ORDER BY published_at DESC LIMIT ?`
      )
      .bind(limit)
      .all<{ channel_slug: string; slug: string; updated_at: string; published_at: string }>();
    return results ?? [];
  },

  /** Recompute denormalized post_count per channel (cheap: channels ≤ dozens). */
  async refreshChannelCounts(db: D1Database): Promise<void> {
    await db
      .prepare(
        `UPDATE channels SET post_count = (
           SELECT COUNT(*) FROM posts WHERE posts.channel_id = channels.id AND posts.status = 'published'
         )`
      )
      .run();
  },

  async listForAdmin(db: D1Database, f: PostListFilters, limit: number, offset: number): Promise<ListResult> {
    return posts.list(db, f, 'new', limit, offset);
  },

  async idsByChannel(db: D1Database, channelId: string): Promise<{ id: string; cover_key: string }[]> {
    const { results } = await db
      .prepare('SELECT id, cover_key FROM posts WHERE channel_id = ?')
      .bind(channelId)
      .all<{ id: string; cover_key: string }>();
    return results ?? [];
  },
};
