import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGES_CACHE } from '@/components/pwa/offline';

/**
 * `public/sw.js` is a plain script for the browser. Evaluate it with a stub `self` and a
 * CommonJS-style `module`, and test the routing decision it exports.
 */
function loadWorker() {
  const source = readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
  const fakeModule = { exports: {} as Record<string, unknown> };
  const self = { location: new URL('https://rhapsody.example/sw.js?v=abc123'), addEventListener: () => {} };
  new Function('self', 'module', source)(self, fakeModule);
  return fakeModule.exports as {
    routeFor: (url: URL, request: { mode?: string; destination?: string; headers?: { get(name: string): string | null } }) => string;
    PAGES_CACHE: string;
    STATIC_CACHE: string;
    VERSION: string;
  };
}

const worker = loadWorker();
const headers = (values: Record<string, string> = {}) => ({ get: (name: string) => values[name] ?? null });
const route = (href: string, request: { mode?: string; destination?: string; headers?: ReturnType<typeof headers> } = {}) =>
  worker.routeFor(new URL(href, 'https://rhapsody.example'), { headers: headers(), ...request });

describe('service worker', () => {
  it('versions its static cache by build and shares the page cache name with the app', () => {
    expect(worker.VERSION).toBe('abc123');
    expect(worker.STATIC_CACHE).toBe('rhapsody-static-abc123');
    expect(worker.PAGES_CACHE).toBe(PAGES_CACHE);
  });

  it('serves page navigations network-first (with offline fallback)', () => {
    expect(route('/devotionals/2026-10-11-x', { mode: 'navigate' })).toBe('page');
    expect(route('/', { mode: 'navigate' })).toBe('page');
  });

  it('never touches APIs, auth, admin, other origins or router payloads', () => {
    expect(route('/api/today', { mode: 'navigate' })).toBe('bypass');
    expect(route('/admin', { mode: 'navigate' })).toBe('bypass');
    expect(route('/account/settings', { mode: 'navigate' })).toBe('bypass');
    expect(route('/login', { mode: 'navigate' })).toBe('bypass');
    expect(route('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')).toBe('bypass');
    expect(route('/devotionals/x?_rsc=1a2b')).toBe('bypass');
    expect(route('/devotionals/x', { headers: headers({ RSC: '1' }) })).toBe('bypass');
    expect(route('/sw.js')).toBe('bypass');
  });

  it('caches hashed assets, images and icons', () => {
    expect(route('/_next/static/chunks/app.js')).toBe('static');
    expect(route('/og/devotionals/2026-10-11-x')).toBe('image');
    expect(route('/hero-light.jpg', { destination: 'image' })).toBe('image');
    expect(route('/manifest.webmanifest')).toBe('asset');
    expect(route('/icon-192.png')).toBe('asset');
  });
});
