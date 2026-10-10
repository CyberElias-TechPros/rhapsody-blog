/**
 * Stateless JWT access tokens (HS256 via `jose`) + user rows for verification.
 *
 * Design:
 * - `ver` (token_version) is checked against the users row on every authenticated request.
 *   Bumping `token_version` (logout-all, deactivation by an admin) instantly invalidates all
 *   previously issued tokens — the cheap alternative to a session table.
 * - Tokens are carried via `Authorization: Bearer` (not cookies): the frontend lives on
 *   Vercel and the API on Cloudflare, so first-party cookies are unreliable (Safari ITP blocks
 *   third-party cookies). localStorage + strict CSP + short-ish expiry is the pragmatic choice.
 */

import { jwtVerify, SignJWT } from 'jose';
import type { Env, AuthedUser, UserRow } from '../types';
import { ApiError } from './http';

interface JwtPayload {
  sub: string;
  role: string;
  ver: number;
}

const secret = (env: Env): Uint8Array => {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    // Fail loudly server-side; clients only see a generic 500.
    throw new ApiError(500, 'Server is missing a strong JWT_SECRET', 'MISCONFIGURED');
  }
  return new TextEncoder().encode(env.JWT_SECRET);
};

export async function signToken(env: Env, user: { id: string; role: string; tokenVersion: number }): Promise<string> {
  return await new SignJWT({ role: user.role, ver: user.tokenVersion })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN || '7d')
    .sign(secret(env));
}

async function verifyToken(env: Env, token: string): Promise<JwtPayload> {
  try {
    const { payload } = await jwtVerify(token, secret(env), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string' || typeof payload.ver !== 'number') {
      throw new Error('bad claims');
    }
    return { sub: payload.sub, role: payload.role, ver: payload.ver };
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

/** Verify the Authorization header (if present). Returns null for anonymous requests. Throws 401 for bad tokens. */
export async function authenticate(env: Env, request: Request): Promise<AuthedUser | null> {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const payload = await verifyToken(env, token);

  const row = await env.DB.prepare(
    'SELECT id, name, email, role, is_active, token_version FROM users WHERE id = ?'
  )
    .bind(payload.sub)
    .first<Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'is_active' | 'token_version'>>();

  if (!row || !row.is_active || row.token_version !== payload.ver) throw ApiError.unauthorized('Invalid session');
  return { id: row.id, name: row.name, email: row.email, role: row.role, tokenVersion: row.token_version };
}

export function requireUser(ctx: { user: AuthedUser | null }): AuthedUser {
  if (!ctx.user) throw ApiError.unauthorized('Authentication required');
  return ctx.user;
}

export function requireRole(ctx: { user: AuthedUser | null }, ...roles: string[]): AuthedUser {
  const user = requireUser(ctx);
  if (!roles.includes(user.role)) throw ApiError.forbidden();
  return user;
}
