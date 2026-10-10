// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  AD_FRAME_ORIGINS,
  AD_SCRIPT_ORIGINS,
  contentSecurityPolicy,
  securityHeaders,
} from '@/lib/security-headers';

/**
 * Ads are the one third-party on an otherwise fully static site, so three things are worth
 * locking down:
 *
 * 1. **The CSP** — an ad domain dropped from `script-src` or `frame-src` stops ads serving
 *    silently, with no build error and no test failure anywhere else.
 * 2. **The component** — the `ins.adsbygoogle` markup AdSense expects, pushed exactly once per
 *    element (a second push throws), and nothing rendered at all when unconfigured or disabled.
 * 3. **The placement policy** — no unit may sit inside a devotional, and none on the signed-in
 *    or auth pages. Asserted against the route sources, because a careless edit there is the
 *    most likely regression and the least visible one.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

async function withAdsEnv<T>(env: Record<string, string>, fn: (mods: { ads: typeof import('@/lib/ads'); AdSlot: typeof import('@/components/common/AdSlot').AdSlot }) => Promise<T> | T): Promise<T> {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  try {
    const ads = await import('@/lib/ads');
    const { AdSlot } = await import('@/components/common/AdSlot');
    return await fn({ ads, AdSlot });
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
    cleanup();
  }
}

afterEach(() => {
  delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle;
});

describe('AdSense configuration', () => {
  it('ships the publisher id from the site snippet', async () => {
    await withAdsEnv({}, ({ ads }) => {
      expect(ads.ADSENSE_CLIENT).toBe('ca-pub-9117572925263537');
      expect(ads.ADSENSE_PUBLISHER_ID).toBe('pub-9117572925263537');
    });
  });

  it('is off outside production unless explicitly enabled', async () => {
    // Tests run with NODE_ENV=test, which is the same branch development takes.
    await withAdsEnv({}, ({ ads }) => expect(ads.ADS_ENABLED).toBe(false));
    await withAdsEnv({ NEXT_PUBLIC_ADS_ENABLED: 'true' }, ({ ads }) => expect(ads.ADS_ENABLED).toBe(true));
    await withAdsEnv({ NEXT_PUBLIC_ADS_ENABLED: 'false' }, ({ ads }) => expect(ads.ADS_ENABLED).toBe(false));
  });

  it('leaves every manual slot unconfigured until an id is provided', async () => {
    await withAdsEnv({}, ({ ads }) => {
      expect(ads.AD_SLOTS).toEqual({ feed: '', article: '', page: '' });
      expect(ads.FEED_AD_EVERY).toBeGreaterThan(1);
    });
    await withAdsEnv(
      { NEXT_PUBLIC_ADSENSE_SLOT_FEED: '111', NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE: '222', NEXT_PUBLIC_ADSENSE_SLOT_PAGE: '333' },
      ({ ads }) => expect(ads.AD_SLOTS).toEqual({ feed: '111', article: '222', page: '333' })
    );
  });
});

describe('Content-Security-Policy', () => {
  const directives = Object.fromEntries(
    contentSecurityPolicy.split('; ').map((d) => [d.split(' ')[0], d])
  );

  it('lets the AdSense loader and its creatives execute', () => {
    for (const origin of AD_SCRIPT_ORIGINS) expect(directives['script-src'], origin).toContain(origin);
    expect(directives['script-src']).toContain('https://pagead2.googlesyndication.com');
  });

  it('lets ad iframes render', () => {
    expect(directives['frame-src']).toBeDefined();
    for (const origin of AD_FRAME_ORIGINS) expect(directives['frame-src'], origin).toContain(origin);
  });

  it('still allows the ad beacons and creative images', () => {
    expect(directives['connect-src']).toContain('https:');
    expect(directives['img-src']).toContain('https:');
  });

  it('keeps the rest of the policy locked down', () => {
    expect(directives['object-src']).toBe("object-src 'none'");
    expect(directives['frame-ancestors']).toBe("frame-ancestors 'none'");
    expect(directives['base-uri']).toBe("base-uri 'self'");
    expect(directives['form-action']).toBe("form-action 'self'");
    expect(directives['default-src']).toBe("default-src 'self'");
    // The App Router streams inline RSC scripts, so this one cannot be tightened without nonces.
    expect(directives['script-src']).toContain("'unsafe-inline'");
    expect(contentSecurityPolicy).toContain('upgrade-insecure-requests');
  });

  it('is applied to every response through the header list', () => {
    const csp = securityHeaders.find((h) => h.key === 'Content-Security-Policy');
    expect(csp?.value).toBe(contentSecurityPolicy);
    expect(securityHeaders.map((h) => h.key)).toContain('Strict-Transport-Security');
  });
});

describe('ads.txt', () => {
  it('authorises Google for this publisher', () => {
    const lines = read('public/ads.txt').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    expect(lines).toHaveLength(1);
    const [system, publisher, relationship, tag] = lines[0].split(',').map((v) => v.trim());
    expect(system).toBe('google.com');
    expect(publisher).toBe('pub-9117572925263537');
    expect(relationship).toBe('DIRECT');
    expect(tag).toBe('f08c47fec0942fa0'); // Google's TAG id — the same for every publisher
  });

  it('matches the publisher id used by the loader script', async () => {
    await withAdsEnv({}, ({ ads }) => {
      expect(read('public/ads.txt')).toContain(ads.ADSENSE_PUBLISHER_ID);
    });
  });
});

describe('<AdSlot />', () => {
  it('renders nothing when ads are disabled', async () => {
    await withAdsEnv({ NEXT_PUBLIC_ADSENSE_SLOT_FEED: '111' }, ({ AdSlot }) => {
      const { container } = render(<AdSlot position="feed" />);
      expect(container.innerHTML).toBe('');
    });
  });

  it('renders nothing when no slot id is configured', async () => {
    await withAdsEnv({ NEXT_PUBLIC_ADS_ENABLED: 'true' }, ({ AdSlot }) => {
      const { container } = render(<AdSlot position="feed" />);
      expect(container.innerHTML).toBe('');
    });
  });

  it('renders the AdSense unit with the client and slot ids', async () => {
    await withAdsEnv({ NEXT_PUBLIC_ADS_ENABLED: 'true', NEXT_PUBLIC_ADSENSE_SLOT_FEED: '1234567890' }, ({ AdSlot, ads }) => {
      const { container } = render(<AdSlot position="feed" />);
      const ins = container.querySelector('ins.adsbygoogle');
      expect(ins).not.toBeNull();
      expect(ins!.getAttribute('data-ad-client')).toBe(ads.ADSENSE_CLIENT);
      expect(ins!.getAttribute('data-ad-slot')).toBe('1234567890');
      expect(ins!.getAttribute('data-ad-format')).toBe('auto');
      expect(ins!.getAttribute('data-full-width-responsive')).toBe('true');
      expect(container.querySelector('[aria-label="Advertisement"]')).not.toBeNull();
      // Height is reserved so a filling ad cannot shift the page.
      expect(ins!.getAttribute('style')).toContain('min-height');
    });
  });

  it('accepts a slot override and a format', async () => {
    await withAdsEnv({ NEXT_PUBLIC_ADS_ENABLED: 'true' }, ({ AdSlot }) => {
      const { container } = render(<AdSlot position="article" slot="9999" format="fluid" label={false} />);
      expect(container.querySelector('ins')!.getAttribute('data-ad-slot')).toBe('9999');
      expect(container.querySelector('ins')!.getAttribute('data-ad-format')).toBe('fluid');
      expect(container.textContent).not.toContain('Advertisement');
    });
  });

  it('queues exactly one fill per element, and nothing on re-render', async () => {
    await withAdsEnv({ NEXT_PUBLIC_ADS_ENABLED: 'true', NEXT_PUBLIC_ADSENSE_SLOT_FEED: '1234567890' }, ({ AdSlot }) => {
      window.adsbygoogle = [];
      const { rerender } = render(<AdSlot position="feed" />);
      expect(window.adsbygoogle).toHaveLength(1);
      rerender(<AdSlot position="feed" />);
      // A second push for the same element makes AdSense throw; the dataset guard prevents it.
      expect(window.adsbygoogle).toHaveLength(1);
    });
  });

  it('creates the queue if the loader script has not arrived yet', async () => {
    await withAdsEnv({ NEXT_PUBLIC_ADS_ENABLED: 'true', NEXT_PUBLIC_ADSENSE_SLOT_FEED: '1234567890' }, ({ AdSlot }) => {
      expect(window.adsbygoogle).toBeUndefined();
      render(<AdSlot position="feed" />);
      expect(window.adsbygoogle).toHaveLength(1);
    });
  });

  it('collapses instead of leaving a gap when the push is rejected', async () => {
    await withAdsEnv({ NEXT_PUBLIC_ADS_ENABLED: 'true', NEXT_PUBLIC_ADSENSE_SLOT_FEED: '1234567890' }, ({ AdSlot }) => {
      window.adsbygoogle = {
        push() {
          throw new Error('ads blocked');
        },
      } as unknown as unknown[];
      const { container } = render(<AdSlot position="feed" />);
      const wrapper = container.querySelector('[aria-label="Advertisement"]') as HTMLElement;
      expect(wrapper.hidden).toBe(true);
      expect(container.querySelector('ins')!.getAttribute('data-ad-failed')).toBe('true');
    });
  });
});

describe('placement policy', () => {
  it('never puts a unit between the scripture and the reading plans', () => {
    const article = read('app/(public)/devotionals/[slug]/page.tsx');
    const scripture = article.indexOf('<ScriptureCard');
    const message = article.indexOf('<Markdown');
    const prayer = article.indexOf('<ClosingCard');
    const plans = article.indexOf('<ReadingPlansCard');
    const firstAd = article.indexOf('<AdSlot');

    expect(scripture).toBeGreaterThan(-1);
    expect(message).toBeGreaterThan(scripture);
    expect(prayer).toBeGreaterThan(message);
    expect(plans).toBeGreaterThan(prayer);
    // The first unit on an article page comes after the whole devotional.
    expect(firstAd).toBeGreaterThan(plans);
  });

  it('does not render ads inside the article Markdown', () => {
    expect(read('components/Markdown.tsx')).not.toContain('adsbygoogle');
    expect(read('components/devotional/Sections.tsx')).not.toContain('AdSlot');
  });

  it('keeps signed-in and auth pages out of the public ad group entirely', () => {
    // They sit directly under app/, so the group layout — and the AdSense loader — never wraps
    // them. Auto ads cannot place a unit on a page that never loads the script.
    const root = fs.readdirSync(path.join(ROOT, 'app'));
    expect(root).toContain('(public)');
    for (const route of ['login', 'register', 'account', 'admin']) {
      expect(root, route).toContain(route);
      expect(fs.existsSync(path.join(ROOT, 'app/(public)', route)), route).toBe(false);
    }
  });

  it('keeps signed-in and auth pages ad-free', () => {
    for (const file of [
      'app/login/page.tsx',
      'app/register/page.tsx',
      'app/account/page.tsx',
      'app/admin/page.tsx',
      'components/screens/LoginScreen.tsx',
      'components/screens/RegisterScreen.tsx',
      'components/screens/AccountScreen.tsx',
      'components/screens/AdminScreen.tsx',
    ]) {
      expect(read(file), file).not.toContain('AdSlot');
    }
  });

  it('keeps the feed and the sitemap free of ad markup', () => {
    expect(read('lib/rss.ts')).not.toContain('adsbygoogle');
    expect(read('app/feed.xml/route.ts')).not.toContain('AdSlot');
  });

  it('places units on the public content pages', () => {
    for (const file of [
      'app/(public)/page.tsx',
      'app/(public)/devotionals/page.tsx',
      'app/(public)/devotionals/[slug]/page.tsx',
      'app/(public)/editions/[edition]/page.tsx',
      'app/(public)/search/page.tsx',
      'components/search/SearchClient.tsx',
      'app/(public)/about/page.tsx',
    ]) {
      const hasSlot = read(file).includes('<AdSlot');
      // /search renders its results in the client component, so either file satisfies it.
      if (file === 'app/(public)/search/page.tsx') {
        expect(hasSlot || read('components/search/SearchClient.tsx').includes('<AdSlot')).toBe(true);
      } else {
        expect(hasSlot, file).toBe(true);
      }
    }
  });

  it('loads the AdSense script once, from the public route group', () => {
    expect(read('app/(public)/layout.tsx')).toContain('<AdScript />');
    // Not in the root layout: that would put auto ads on the signed-in pages too.
    expect(read('app/layout.tsx')).not.toContain('AdScript');
    const script = read('components/common/AdScript.tsx');
    expect(script).toContain('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=');
    expect(script).toContain("crossOrigin=\"anonymous\"");
    // Only the root layout may load it, or a page would request the loader twice.
    for (const file of ['app/(public)/page.tsx', 'app/(public)/devotionals/page.tsx', 'app/(public)/devotionals/[slug]/page.tsx']) {
      expect(read(file), file).not.toContain('AdScript');
    }
  });

  it('serves the snippet as a real <script async> in the head, not a client-injected one', () => {
    // AdSense verifies a site by looking at the *served* markup, and Auto ads need the loader
    // early. `next/script`'s afterInteractive strategy only emits a <link rel="preload"> in the
    // HTML and injects the tag after hydration, which is why the plain element is used here.
    const script = read('components/common/AdScript.tsx');
    expect(script).not.toContain("from 'next/script'");
    expect(script).toMatch(/<script\s+async/);
    // Rendered once. React 19 hoists an `async` script with a `src` into the served <head> and
    // de-duplicates it by src, so the component can sit in the body of the group layout
    // (inside a hand-rendered <head> React warns about a script in a component tree).
    const layouts = ['app/layout.tsx', 'app/(public)/layout.tsx'].map(read).join('\n');
    expect(layouts.match(/<AdScript \/>/g)).toHaveLength(1);
  });
});
