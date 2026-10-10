/**
 * Lazy per-isolate bootstrap: ensure seed channels exist and (when configured) create the
 * default admin. Workers have no "startup hook" — running this in fetch via waitUntil keeps
 * cold starts fast while remaining idempotent (INSERT OR IGNORE + unique constraints make
 * concurrent bootstraps from parallel isolates safe).
 */

import type { Env } from '../types';
import { logInfo, logWarn } from '../lib/logging';
import { channels as channelsRepo } from '../repos/channels';
import { users } from '../repos/users';
import { hashPassword } from '../lib/password';
import { DEFAULT_CHANNELS } from './telegram/sync';

let bootstrapPromise: Promise<void> | null = null;

export function scheduleBootstrap(env: Env, execution: ExecutionContext): void {
  bootstrapPromise ??= runBootstrap(env)
    .catch((err) => {
      // Retry on the next request; never crash traffic for a bootstrap hiccup.
      bootstrapPromise = null;
      logWarn('bootstrap: failed — will retry', { error: String(err) });
    });
  execution.waitUntil(bootstrapPromise);
}

/** Test hook: reset the memo so unit/integration tests can force re-bootstrap. */
export function _resetBootstrapForTests(): void {
  bootstrapPromise = null;
}

async function runBootstrap(env: Env): Promise<void> {
  for (const c of DEFAULT_CHANNELS) {
    await channelsRepo.ensure(env.DB, c);
  }
  const { admins } = await users.counts(env.DB);
  if (admins === 0) {
    const email = env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = env.ADMIN_PASSWORD;
    if (email && password && password.length >= 12) {
      const id = crypto.randomUUID();
      try {
        await users.create(env.DB, { id, name: 'Administrator', email, passwordHash: await hashPassword(password), role: 'admin' });
        logInfo('bootstrap: default admin created', { email });
      } catch (err) {
        // Unique constraint violation = another isolate raced us — fine.
        logWarn('bootstrap: admin creation skipped', { error: String(err) });
      }
    } else if (email || password) {
      logWarn('bootstrap: ADMIN_EMAIL/ADMIN_PASSWORD incomplete or too short (min 12) — no admin created');
    }
  }
}
