/**
 * Users repository. Raw rows are never returned to clients — mapping happens in routes/db.ts,
 * and password_hash is excluded from every list query.
 */

import type { Role, UserRow } from '../types';
import { nowIso } from '../lib/util';
import { hashPassword, verifyPassword, type PasswordHash } from '../lib/password';

export interface UserAdminRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewUser {
  id: string;
  name: string;
  email: string;
  passwordHash: PasswordHash;
  role: Role;
}

export const users = {
  async findByEmail(db: D1Database, email: string): Promise<UserRow | null> {
    return db.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).first<UserRow>();
  },

  async create(db: D1Database, user: NewUser): Promise<void> {
    await db
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(user.id, user.name, user.email.toLowerCase(), user.passwordHash, user.role, nowIso(), nowIso())
      .run();
  },

  /** Returns the user only when credentials are valid and the account is active. */
  async verify(db: D1Database, email: string, password: string): Promise<UserRow | null> {
    const user = await users.findByEmail(db, email);
    if (!user) {
      // Run the KDF anyway so response time does not reveal whether the email exists.
      await verifyPassword(password, 'pbkdf2-sha256$250000$00$00');
      return null;
    }
    const ok = await verifyPassword(password, user.password_hash);
    return ok && user.is_active ? user : null;
  },

  async touchLogin(db: D1Database, id: string): Promise<void> {
    await db
      .prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(nowIso(), nowIso(), id)
      .run();
  },

  async setPassword(db: D1Database, id: string, passwordHash: string, bumpTokenVersion: boolean): Promise<void> {
    const q = bumpTokenVersion
      ? 'UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?'
      : 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?';
    await db.prepare(q).bind(passwordHash, nowIso(), id).run();
  },

  async bumpTokenVersion(db: D1Database, id: string): Promise<void> {
    await db
      .prepare('UPDATE users SET token_version = token_version + 1, updated_at = ? WHERE id = ?')
      .bind(nowIso(), id)
      .run();
  },

  async counts(db: D1Database): Promise<{ total: number; admins: number }> {
    const total = await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
    const admins = await db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).first<{ n: number }>();
    return { total: total?.n ?? 0, admins: admins?.n ?? 0 };
  },

  async list(db: D1Database, limit: number, offset: number): Promise<UserAdminRow[]> {
    const { results } = await db
      .prepare(
        `SELECT id, name, email, role, is_active, last_login_at, created_at, updated_at
         FROM users ORDER BY created_at DESC, name ASC LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<UserAdminRow>();
    return results ?? [];
  },

  async setRole(db: D1Database, id: string, role: Role): Promise<void> {
    await db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').bind(role, nowIso(), id).run();
  },

  /** Deactivating also bumps token_version → all sessions for that user die immediately. */
  async setActive(db: D1Database, id: string, active: boolean): Promise<void> {
    const q = active
      ? 'UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?'
      : 'UPDATE users SET is_active = 0, token_version = token_version + 1, updated_at = ? WHERE id = ?';
    await db.prepare(q).bind(nowIso(), id).run();
  },

  hashPassword,
};
