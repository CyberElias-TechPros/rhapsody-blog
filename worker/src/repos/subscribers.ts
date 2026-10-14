/**
 * Subscribers repository.
 */

import { nowIso } from '../lib/util';

export interface SubscriberRow {
  email: string;
  channels: string;
  source: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const subscribers = {
  async upsert(db: D1Database, email: string, channelList: string[], source: string): Promise<void> {
    await db
      .prepare(
        `INSERT INTO subscribers (email, channels, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (email) DO UPDATE SET
           channels = excluded.channels,
           unsubscribed_at = NULL,
           updated_at = excluded.updated_at`
      )
      .bind(email.toLowerCase(), JSON.stringify(channelList), source, nowIso(), nowIso())
      .run();
  },

  async unsubscribe(db: D1Database, email: string): Promise<boolean> {
    const res = await db
      .prepare('UPDATE subscribers SET unsubscribed_at = ?, updated_at = ? WHERE email = ? AND unsubscribed_at IS NULL')
      .bind(nowIso(), nowIso(), email.toLowerCase())
      .run();
    return (res.meta?.changes ?? 0) > 0;
  },

  async remove(db: D1Database, email: string): Promise<boolean> {
    const res = await db.prepare('DELETE FROM subscribers WHERE email = ?').bind(email.toLowerCase()).run();
    return (res.meta?.changes ?? 0) > 0;
  },

  /** Everyone who has not unsubscribed, oldest first, one page at a time. */
  async listActive(db: D1Database, limit: number, offset: number): Promise<SubscriberRow[]> {
    const { results } = await db
      .prepare('SELECT * FROM subscribers WHERE unsubscribed_at IS NULL ORDER BY created_at LIMIT ? OFFSET ?')
      .bind(limit, offset)
      .all<SubscriberRow>();
    return results ?? [];
  },

  async countActive(db: D1Database): Promise<number> {
    const r = await db.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE unsubscribed_at IS NULL').first<{ n: number }>();
    return r?.n ?? 0;
  },

  async list(db: D1Database, limit: number, offset: number): Promise<SubscriberRow[]> {
    const { results } = await db
      .prepare('SELECT * FROM subscribers ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(limit, offset)
      .all<SubscriberRow>();
    return results ?? [];
  },
};
