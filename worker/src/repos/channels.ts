/**
 * Channels repository.
 */

import type { ChannelRow } from '../types';
import { nowIso } from '../lib/util';

export const channels = {
  async listActive(db: D1Database): Promise<ChannelRow[]> {
    const { results } = await db
      .prepare('SELECT * FROM channels WHERE is_active = 1 ORDER BY name ASC')
      .all<ChannelRow>();
    return results ?? [];
  },

  async listAll(db: D1Database): Promise<ChannelRow[]> {
    const { results } = await db.prepare('SELECT * FROM channels ORDER BY name ASC').all<ChannelRow>();
    return results ?? [];
  },

  async findBySlug(db: D1Database, slug: string): Promise<ChannelRow | null> {
    return db.prepare('SELECT * FROM channels WHERE slug = ?').bind(slug).first<ChannelRow>();
  },

  async findActiveBySlug(db: D1Database, slug: string): Promise<ChannelRow | null> {
    return db.prepare('SELECT * FROM channels WHERE slug = ? AND is_active = 1').bind(slug).first<ChannelRow>();
  },

  /** Idempotent channel upsert for seeds: inserts if absent, refreshes display fields, never clobbers moderation state. */
  async ensure(db: D1Database, seed: { id: string; slug: string; name: string; username: string; description: string; accent: string }): Promise<void> {
    await db
      .prepare(
        `INSERT INTO channels (id, slug, name, username, description, accent, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (slug) DO UPDATE SET name = excluded.name, username = excluded.username, updated_at = excluded.updated_at`
      )
      .bind(seed.id, seed.slug, seed.name, seed.username, seed.description, seed.accent, nowIso(), nowIso())
      .run();
  },

  async markSynced(db: D1Database, slug: string, lastMessageId: number): Promise<void> {
    await db
      .prepare(
        `UPDATE channels
         SET last_synced_at = ?, last_message_id = MAX(last_message_id, ?),
             post_count = (SELECT COUNT(*) FROM posts WHERE posts.channel_id = channels.id AND posts.status = 'published'),
             updated_at = ?
         WHERE slug = ?`
      )
      .bind(nowIso(), lastMessageId, nowIso(), slug)
      .run();
  },

  async count(db: D1Database): Promise<number> {
    const r = await db.prepare('SELECT COUNT(*) AS n FROM channels WHERE is_active = 1').first<{ n: number }>();
    return r?.n ?? 0;
  },

  async syncSummary(db: D1Database): Promise<{ slug: string; name: string; username: string; is_active: number; last_synced_at: string | null; last_message_id: number; post_count: number }[]> {
    const { results } = await db
      .prepare(
        `SELECT slug, name, username, is_active, last_synced_at, last_message_id,
                (SELECT COUNT(*) FROM posts WHERE posts.channel_id = channels.id AND posts.status = 'published') AS post_count
         FROM channels ORDER BY name ASC`
      )
      .all();
    return (results ?? []) as never;
  },
};
