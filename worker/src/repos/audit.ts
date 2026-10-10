/**
 * Audit log — actor/action/resource/metadata for sensitive operations.
 * Written fire-and-forget via ctx.execution.waitUntil from route handlers.
 */

import type { Env } from '../types';
import { logWarn } from '../lib/logging';
import { nowIso } from '../lib/util';

export interface AuditEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

export async function audit(env: Env, entry: AuditEntry): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_id, actor_email, action, resource, resource_id, meta, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        entry.actorId ?? null,
        entry.actorEmail ?? null,
        entry.action,
        entry.resource,
        entry.resourceId ?? null,
        JSON.stringify(entry.meta ?? {}),
        entry.ip ?? null,
        nowIso()
      )
      .run();
  } catch (err) {
    // Audit failure must never break the user-facing operation, but must be loud in logs.
    logWarn('audit: failed to persist', { action: entry.action, error: String(err) });
  }
}

export interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  meta: string;
  ip: string | null;
  created_at: string;
}

export async function recentAudit(db: D1Database, limit: number): Promise<AuditRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<AuditRow>();
  return results ?? [];
}
