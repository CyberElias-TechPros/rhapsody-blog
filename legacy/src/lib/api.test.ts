import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, getStoredToken, setStoredToken, UNAUTHORIZED_EVENT } from './api';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('api client', () => {
  it('parses the worker error envelope into ApiError with details', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { code: 'VALIDATION', message: 'Invalid input', details: { email: ['Invalid email'] } } })
    );
    const err = await api.auth.register('x', 'not-an-email', 'short').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
    expect(err.details?.email).toEqual(['Invalid email']);
  });

  it('maps network failure to status 0 NETWORK', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await api.health().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe('NETWORK');
  });

  it('falls back to a generic message when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502 bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }));
    const err = await api.channels.list().catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.code).toBe('HTTP_502');
    expect(err.message).toMatch(/service had a problem/i);
  });

  it('clears the token and broadcasts unauthorized on an authed 401', async () => {
    setStoredToken('stale-token');
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Session expired' } }));
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    const err = await api.me.bookmarks().catch((e) => e);
    expect(err.status).toBe(401);
    expect(getStoredToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it('sends Authorization header only for authed endpoints', async () => {
    setStoredToken('tok-123');
    fetchMock.mockImplementation(async (url: string) => jsonResponse(200, url.includes('admin') ? { ok: true } : { channels: [] }));

    await api.channels.list();
    const publicCall = fetchMock.mock.calls[0][1] as RequestInit;
    expect((publicCall.headers as Record<string, string>).Authorization).toBeUndefined();

    await api.admin.stats().catch(() => undefined);
    const adminCall = fetchMock.mock.calls[1][1] as RequestInit;
    expect((adminCall.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('serializes query params, skipping empty ones', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, totalPages: 1 }));
    await api.posts.list({ q: '  faith ', channel: '', page: 2, limit: 12 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/posts?');
    expect(url).toContain('q=++faith'); // URLSearchParams space encoding — value still round-trips
    expect(url).toContain('page=2');
    expect(url).not.toContain('channel=');
  });

  it('treats 204 as void success', async () => {
    setStoredToken('tok');
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.me.removeBookmark('p1')).resolves.toBeUndefined();
  });
});
