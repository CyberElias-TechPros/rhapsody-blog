/**
 * Bookmarks + channel follows (registered readers).
 */

import type { PostRow, ChannelRow } from '../types';

export const bookmarks = {
  async listPostRows(db: D1Database, userId: string, limit: number): Promise<PostRow[]> {
    const { results } = await db
      .prepare(
        `SELECT p.* FROM bookmarks b JOIN posts p ON p.id = b.post_id
         WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT ?`
      )
      .bind(userId, limit)
      .all<PostRow>();
    return results ?? [];
  },

  async ids(db: D1Database, userId: string): Promise<string[]> {
    const { results } = await db.prepare('SELECT post_id FROM bookmarks WHERE user_id = ?').bind(userId).all<{ post_id: string }>();
    return (results ?? []).map((r) => r.post_id);
  },

  async add(db: D1Database, userId: string, postId: string): Promise<void> {
    await db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, post_id) VALUES (?, ?)').bind(userId, postId).run();
  },

  async remove(db: D1Database, userId: string, postId: string): Promise<void> {
    await db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').bind(userId, postId).run();
  },
};

export const follows = {
  async channelRows(db: D1Database, userId: string): Promise<ChannelRow[]> {
    const { results } = await db
      .prepare(
        `SELECT c.* FROM channel_follows f JOIN channels c ON c.id = f.channel_id
         WHERE f.user_id = ? ORDER BY c.name ASC`
      )
      .bind(userId)
      .all<ChannelRow>();
    return results ?? [];
  },

  async slugs(db: D1Database, userId: string): Promise<string[]> {
    const { results } = await db
      .prepare('SELECT c.slug FROM channel_follows f JOIN channels c ON c.id = f.channel_id WHERE f.user_id = ?')
      .bind(userId)
      .all<{ slug: string }>();
    return (results ?? []).map((r) => r.slug);
  },

  async add(db: D1Database, userId: string, channelSlug: string): Promise<boolean> {
    const res = await db
      .prepare(
        `INSERT OR IGNORE INTO channel_follows (user_id, channel_id)
         SELECT ?, id FROM channels WHERE slug = ?`
      )
      .bind(userId, channelSlug)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  },

  async remove(db: D1Database, userId: string, channelSlug: string): Promise<void> {
    await db
      .prepare(
        `DELETE FROM channel_follows
         WHERE user_id = ? AND channel_id = (SELECT id FROM channels WHERE slug = ?)`
      )
      .bind(userId, channelSlug)
      .run();
  },
};
