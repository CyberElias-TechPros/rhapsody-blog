/**
 * Auth routes: register, login, me, logout-all, password change.
 *
 * Security notes:
 * - Generic 401 message for bad credentials; timing equalized via users.verify (KDF even for
 *   unknown emails); login/register are rate-limited per IP (see ratelimit.ts).
 * - Registration is instant-activation by design (no SMTP dependency for the public read tier);
 *   privileged roles are only assigned by an existing admin via /api/admin/users.
 * - Every issued token embeds `token_version`; /logout-all and admin deactivation bump it,
 *   instantly invalidating all outstanding tokens for the user.
 */

import { z } from 'zod';
import type { Router } from '../lib/router';
import type { Ctx } from '../context';
import { ApiError, json, noContent } from '../lib/http';
import { parseBody } from '../lib/validation';
import { signToken } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { users } from '../repos/users';
import { userDto } from '../db';
import { audit } from '../repos/audit';
import { clientIp, LIMITS, rateLimit } from '../lib/ratelimit';

const emailSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email('Invalid email address').refine((v) => v.length <= 255, 'Email too long')
);

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: z.string().min(10).max(128),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(10).max(128),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });

export function registerAuthRoutes(router: Router): void {
  router.post('/api/auth/register', async (ctx: Ctx) => {
    await rateLimit(ctx.env, 'register', ctx.clientIp, LIMITS.register);
    const { name, email, password } = await parseBody(ctx.request, registerSchema);

    if (await users.findByEmail(ctx.env.DB, email)) {
      throw ApiError.conflict('An account with this email already exists');
    }
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await users.create(ctx.env.DB, { id, name, email, passwordHash, role: 'user' });

    const row = await users.findByEmail(ctx.env.DB, email);
    if (!row) throw new ApiError(500, 'Account creation failed', 'INTERNAL');

    ctx.execution.waitUntil(
      audit(ctx.env, { actorId: id, actorEmail: email, action: 'auth.register', resource: 'user', resourceId: id, ip: ctx.clientIp })
    );
    const token = await signToken(ctx.env, { id, role: 'user', tokenVersion: row.token_version });
    return json({ user: userDto(row), token }, { status: 201 });
  });

  router.post('/api/auth/login', async (ctx: Ctx) => {
    const { email, password } = await parseBody(ctx.request, loginSchema);
    // Throttle per IP *and* per target account so a spray over many accounts is also bounded.
    const ip = ctx.clientIp;
    await rateLimit(ctx.env, 'login-ip', ip, LIMITS.login);
    await rateLimit(ctx.env, 'login-email', email, LIMITS.login);

    const user = await users.verify(ctx.env.DB, email, password);
    if (!user) {
      ctx.execution.waitUntil(audit(ctx.env, { action: 'auth.login_failed', resource: 'user', meta: { email }, ip }));
      throw ApiError.unauthorized('Invalid email or password');
    }

    ctx.execution.waitUntil(users.touchLogin(ctx.env.DB, user.id));
    ctx.execution.waitUntil(
      audit(ctx.env, { actorId: user.id, actorEmail: user.email, action: 'auth.login', resource: 'user', resourceId: user.id, ip })
    );
    const token = await signToken(ctx.env, { id: user.id, role: user.role, tokenVersion: user.token_version });
    return json({ user: userDto(user), token });
  });

  router.get('/api/auth/me', async (ctx: Ctx) => {
    if (!ctx.user) throw ApiError.unauthorized();
    const row = await users.findByEmail(ctx.env.DB, ctx.user.email);
    if (!row) throw ApiError.unauthorized('Invalid session');
    return json({ user: userDto(row) });
  });

  /** Invalidate every outstanding token for the current user (all devices). */
  router.post('/api/auth/logout-all', async (ctx: Ctx) => {
    if (!ctx.user) throw ApiError.unauthorized();
    await users.bumpTokenVersion(ctx.env.DB, ctx.user.id);
    ctx.execution.waitUntil(
      audit(ctx.env, { actorId: ctx.user.id, actorEmail: ctx.user.email, action: 'auth.logout_all', resource: 'user', resourceId: ctx.user.id, ip: ctx.clientIp })
    );
    return noContent();
  });

  /** Self-service password change (email-based reset requires an external provider — see README). */
  router.post('/api/auth/password-change', async (ctx: Ctx) => {
    if (!ctx.user) throw ApiError.unauthorized();
    await rateLimit(ctx.env, 'password-change', ctx.user.id, LIMITS.passwordChange);
    const { currentPassword, newPassword } = await parseBody(ctx.request, passwordChangeSchema);
    const row = await users.findByEmail(ctx.env.DB, ctx.user.email);
    if (!row) throw ApiError.unauthorized('Invalid session');
    if (!(await verifyPassword(currentPassword, row.password_hash))) {
      throw ApiError.unauthorized('Current password is incorrect');
    }
    await users.setPassword(ctx.env.DB, row.id, await hashPassword(newPassword), true);
    const updated = await users.findByEmail(ctx.env.DB, row.email);
    if (!updated) throw ApiError.unauthorized('Invalid session');
    ctx.execution.waitUntil(
      audit(ctx.env, { actorId: row.id, actorEmail: row.email, action: 'auth.password_change', resource: 'user', resourceId: row.id, ip: ctx.clientIp })
    );
    // Re-issue for *this* device; all other sessions were just invalidated.
    const token = await signToken(ctx.env, { id: row.id, role: row.role, tokenVersion: updated.token_version });
    return json({ ok: true, token });
  });
}
