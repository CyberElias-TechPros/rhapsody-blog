/**
 * Typed API client for the Cloudflare Worker API in `/worker`.
 *
 * The blog content itself never goes through this client — posts are Markdown on disk (see
 * `lib/content.ts`). This module only serves the dynamic features the Worker still owns:
 * accounts, the admin console and newsletter subscriptions.
 *
 * - Base URL: NEXT_PUBLIC_API_URL (production) or "/api" (dev — next.config.ts rewrites
 *   same-origin /api to the local wrangler dev server when WORKER_DEV_URL is set).
 * - Auth: Bearer token from localStorage. Deliberately NOT a cookie: the frontend is on
 *   Vercel and the API on Cloudflare; Safari blocks third-party cookies, so cross-site
 *   auth cookies are unreliable. The CSP (see next.config.ts) is the XSS mitigation.
 * - Errors: every failure becomes an `ApiError` with the Worker's envelope fields
 *   ({ error: { code, message, details } }), so screens can render *real* messages.
 * - On 401 for an authenticated call the client fires `meaning:unauthorized` so the
 *   AuthProvider can drop a stale session (expired/revoked token).
 */

import type {
  AdminStats,
  AdminPostRow,
  AdminUserRow,
  AuditEntry,
  Channel,
  ListResponse,
  PostDetail,
  PostListItem,
  PostListParams,
  SubscriberRow,
  SyncResult,
  User,
} from './types';

export const API_BASE: string = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '');

/** True only in a browser — every storage access goes through this so SSR never throws. */
export const isBrowser = (): boolean => typeof window !== 'undefined';

const TOKEN_KEY = 'meaning.auth.token';

export const UNAUTHORIZED_EVENT = 'meaning:unauthorized';

export function getStoredToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (!isBrowser()) return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — session-only login degrades gracefully */
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, signal } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getStoredToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'Network error — check your connection or the API health.');
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const ct = res.headers.get('content-type') ?? '';
  try {
    payload = ct.includes('json') ? await res.json() : await res.text();
  } catch {
    /* keep payload null */
  }

  if (!res.ok) {
    const env = (payload ?? {}) as { error?: { code?: string; message?: string; details?: Record<string, string[]> } };
    if (res.status === 401 && auth) {
      setStoredToken(null);
      if (isBrowser()) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      res.status,
      env.error?.code ?? `HTTP_${res.status}`,
      env.error?.message ?? fallbackMessage(res.status),
      env.error?.details
    );
  }
  return payload as T;
}

function fallbackMessage(status: number): string {
  if (status === 404) return 'Not found';
  if (status === 429) return 'Too many requests — please slow down.';
  if (status >= 500) return 'The service had a problem. Please try again shortly.';
  return 'Request failed';
}

const qs = (params: Record<string, string | number | undefined | null>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export interface AuthResult {
  user: User;
  token: string;
}

export const api = {
  health: () => request<{ ok: boolean; db: string }>('/health'),

  channels: {
    list: (signal?: AbortSignal) => request<{ channels: Channel[] }>('/channels', { signal }),
    get: (slug: string, signal?: AbortSignal) => request<{ channel: Channel }>(`/channels/${encodeURIComponent(slug)}`, { signal }),
  },

  posts: {
    list: (params: PostListParams = {}, signal?: AbortSignal) =>
      request<ListResponse<PostListItem>>(`/posts${qs(params as Record<string, string | number | undefined>)}`, { signal }),
    get: (channelSlug: string, slug: string, signal?: AbortSignal) =>
      request<{ post: PostDetail; related: PostListItem[] }>(`/posts/${encodeURIComponent(channelSlug)}/${encodeURIComponent(slug)}`, { signal }),
  },

  auth: {
    register: (name: string, email: string, password: string) =>
      request<AuthResult>('/auth/register', { method: 'POST', body: { name, email, password } }),
    login: (email: string, password: string) =>
      request<AuthResult>('/auth/login', { method: 'POST', body: { email, password } }),
    me: () => request<{ user: User }>('/auth/me', { auth: true }),
    logoutAll: () => request<void>('/auth/logout-all', { method: 'POST', auth: true }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean; token: string }>('/auth/password-change', { method: 'POST', body: { currentPassword, newPassword }, auth: true }),
  },

  me: {
    bookmarks: (signal?: AbortSignal) => request<{ items: PostListItem[] }>('/me/bookmarks', { auth: true, signal }),
    bookmarkIds: (signal?: AbortSignal) => request<{ ids: string[] }>('/me/bookmarks/ids', { auth: true, signal }),
    addBookmark: (postId: string) => request<{ ok: boolean }>(`/me/bookmarks/${postId}`, { method: 'POST', auth: true }),
    removeBookmark: (postId: string) => request<void>(`/me/bookmarks/${postId}`, { method: 'DELETE', auth: true }),
    follows: (signal?: AbortSignal) => request<{ items: Channel[]; slugs: string[] }>('/me/follows', { auth: true, signal }),
    follow: (channelSlug: string) => request<{ ok: boolean }>(`/me/follows/${encodeURIComponent(channelSlug)}`, { method: 'POST', auth: true }),
    unfollow: (channelSlug: string) => request<void>(`/me/follows/${encodeURIComponent(channelSlug)}`, { method: 'DELETE', auth: true }),
  },

  subscribers: {
    subscribe: (email: string, channels: string[] = []) =>
      request<{ subscriber: { email: string; channels: string[] } }>('/subscribers', { method: 'POST', body: { email, channels } }),
  },

  admin: {
    stats: () => request<AdminStats>('/admin/stats', { auth: true }),
    syncAll: () => request<{ results: SyncResult[] }>('/admin/sync', { method: 'POST', auth: true }),
    syncChannel: (slug: string) => request<{ result: SyncResult }>(`/admin/sync/${encodeURIComponent(slug)}`, { method: 'POST', auth: true }),
    posts: (params: { channel?: string; status?: string; q?: string; page?: number; limit?: number } = {}) =>
      request<ListResponse<AdminPostRow>>(`/admin/posts${qs(params)}`, { auth: true }),
    patchPost: (id: string, patch: { title?: string; excerpt?: string; status?: string; tags?: string[] }) =>
      request<{ post: PostDetail }>(`/admin/posts/${id}`, { method: 'PATCH', body: patch, auth: true }),
    deletePost: (id: string) => request<void>(`/admin/posts/${id}`, { method: 'DELETE', auth: true }),
    subscribers: (params: { limit?: number; offset?: number } = {}) =>
      request<{ items: SubscriberRow[]; total: number }>(`/admin/subscribers${qs(params)}`, { auth: true }),
    exportSubscribersCsv: () => fetchBlob('/admin/subscribers?format=csv'),
    deleteSubscriber: (email: string) => request<void>(`/admin/subscribers/${encodeURIComponent(email)}`, { method: 'DELETE', auth: true }),
    users: () => request<{ items: AdminUserRow[]; total: number }>('/admin/users', { auth: true }),
    patchUser: (id: string, patch: { role?: string; isActive?: boolean }) =>
      request<{ ok: boolean }>(`/admin/users/${id}`, { method: 'PATCH', body: patch, auth: true }),
    audit: (limit = 50) => request<{ items: AuditEntry[] }>(`/admin/audit${qs({ limit })}`, { auth: true }),
  },
};

/** Authenticated file download (CSV export) → triggers a browser save. */
async function fetchBlob(path: string): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(API_BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, `HTTP_${res.status}`, 'Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'subscribers.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
