import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_ORIGIN, resolveSiteUrl } from '@/lib/site-url';

/**
 * The canonical origin feeds every absolute URL the site emits. A production deploy without
 * NEXT_PUBLIC_SITE_URL once shipped http://localhost:3000 in robots.txt, sitemap.xml, the feed,
 * every canonical/og:image tag and on the share cards themselves; these pin the fallback that
 * makes a Vercel build correct by default.
 */

const PROD_HOST = 'rhapsody.freegameplay.site';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

/** Import a module fresh, as a build with exactly these variables would evaluate it. */
async function importWithEnv<T>(env: Record<string, string>, load: () => Promise<T>): Promise<T> {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return load();
}

describe('resolveSiteUrl', () => {
  it('prefers an explicit NEXT_PUBLIC_SITE_URL, without its trailing slash', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://rhapsody.example/', VERCEL_PROJECT_PRODUCTION_URL: PROD_HOST })).toBe(
      'https://rhapsody.example'
    );
  });

  it("falls back to Vercel's production domain, adding the scheme Vercel leaves off", () => {
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: PROD_HOST })).toBe(`https://${PROD_HOST}`);
  });

  it('treats a blank NEXT_PUBLIC_SITE_URL as unset', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: '   ', VERCEL_PROJECT_PRODUCTION_URL: PROD_HOST })).toBe(`https://${PROD_HOST}`);
  });

  it('gives a bare host https:// (so metadataBase cannot throw) and keeps an explicit http://', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'rhapsody.example' })).toBe('https://rhapsody.example');
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'http://192.168.1.20:3000/' })).toBe('http://192.168.1.20:3000');
  });

  it('uses localhost only when nothing is configured (local builds, tests)', () => {
    expect(resolveSiteUrl({})).toBe(LOCAL_ORIGIN);
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: '' })).toBe(LOCAL_ORIGIN);
  });
});

describe('a Vercel build without NEXT_PUBLIC_SITE_URL', () => {
  const vercelEnv = { NEXT_PUBLIC_SITE_URL: '', VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: PROD_HOST };

  it('builds canonical, robots.txt and sitemap URLs on the production domain', async () => {
    const { SITE, absoluteUrl } = await importWithEnv(vercelEnv, () => import('@/lib/site'));
    expect(SITE.url).toBe(`https://${PROD_HOST}`);
    expect(absoluteUrl('/sitemap.xml')).toBe(`https://${PROD_HOST}/sitemap.xml`);

    const { default: robots } = await import('@/app/robots');
    const rules = robots();
    expect(rules.sitemap).toBe(`https://${PROD_HOST}/sitemap.xml`);
    expect(rules.host).toBe(`https://${PROD_HOST}/`);
  });

  it('has next.config inline the same origin for every bundle, without a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { default: config } = await importWithEnv(vercelEnv, () => import('@/next.config'));
    expect(config.env?.NEXT_PUBLIC_SITE_URL).toBe(`https://${PROD_HOST}`);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns in the build log if Vercel exposes no production domain either', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { default: config } = await importWithEnv({ ...vercelEnv, VERCEL_PROJECT_PRODUCTION_URL: '' }, () =>
      import('@/next.config')
    );
    expect(config.env?.NEXT_PUBLIC_SITE_URL).toBe(LOCAL_ORIGIN);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_SITE_URL'));
  });
});

describe('other builds without NEXT_PUBLIC_SITE_URL', () => {
  const bare = { NEXT_PUBLIC_SITE_URL: '', VERCEL: '', VERCEL_PROJECT_PRODUCTION_URL: '', CI: '' };

  it('stay quiet on a developer machine, where localhost is the right answer', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { default: config } = await importWithEnv(bare, () => import('@/next.config'));
    expect(config.env?.NEXT_PUBLIC_SITE_URL).toBe(LOCAL_ORIGIN);
    expect(warn).not.toHaveBeenCalled();
  });

  it('flag a CI build, whose output would carry localhost if it were ever deployed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await importWithEnv({ ...bare, CI: 'true' }, () => import('@/next.config'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(LOCAL_ORIGIN));
  });

  it('honour an explicit origin everywhere, over the Vercel domain', async () => {
    const { default: config } = await importWithEnv(
      { ...bare, NEXT_PUBLIC_SITE_URL: 'https://rhapsody.example/', VERCEL_PROJECT_PRODUCTION_URL: PROD_HOST },
      () => import('@/next.config')
    );
    expect(config.env?.NEXT_PUBLIC_SITE_URL).toBe('https://rhapsody.example');
    const { SITE } = await import('@/lib/site');
    expect(SITE.url).toBe('https://rhapsody.example');
  });
});
