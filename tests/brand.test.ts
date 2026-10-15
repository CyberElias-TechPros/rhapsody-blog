import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';
import { MORE_LINKS, NAV_LINKS, SITE } from '@/lib/site';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

/**
 * The site is called Rhapsody of Realities. Earlier names ("Meaning", from the project this grew
 * out of, and "Devotional") reached users through stray assets — the share image, the icon label,
 * the Worker's unsubscribe page. These checks keep them from coming back.
 */
describe('brand', () => {
  it('is named Rhapsody of Realities everywhere it is declared', () => {
    expect(SITE.name).toBe('Rhapsody of Realities');
    expect(SITE.shortName).toBe('Rhapsody');
    const m = manifest();
    expect(m.name).toBe('Rhapsody of Realities');
    expect(m.short_name).toBe('Rhapsody');
    expect(read('public/icon.svg')).toContain('aria-label="Rhapsody of Realities');
  });

  it('says plainly that it is independent of the publisher', () => {
    expect(SITE.disclaimer).toMatch(/independent/i);
    expect(SITE.disclaimer).toMatch(/not an official/i);
    expect(read('components/layout/Footer.tsx')).toContain('SITE.disclaimer');
  });

  it('has no leftover brand in user-facing files', () => {
    for (const file of ['worker/src/routes/subscribers.ts', 'lib/site.ts', 'app/layout.tsx', 'lib/rss.ts', 'app/manifest.ts']) {
      expect(read(file), file).not.toMatch(/\bMeaning\b/);
    }
    expect(existsSync(path.join(root, 'public/og.jpg'))).toBe(false);
    expect(SITE.ogImage).toBe('/og.png');
    expect(existsSync(path.join(root, 'app/og.png/route.tsx'))).toBe(true);
  });

  it('ships the raster icons the manifest promises', () => {
    for (const icon of manifest().icons ?? []) {
      expect(existsSync(path.join(root, 'public', icon.src)), icon.src).toBe(true);
    }
    expect(existsSync(path.join(root, 'public/apple-touch-icon.png'))).toBe(true);
  });

  it('links every landing page from the navigation', () => {
    const hrefs = [...NAV_LINKS, ...MORE_LINKS].map((link) => link.href);
    for (const href of ['/today', '/teevo', '/early-readers', '/kids', '/reading-plans', '/calendar', '/bible', '/faq', '/me']) {
      expect(hrefs).toContain(href);
    }
  });
});
