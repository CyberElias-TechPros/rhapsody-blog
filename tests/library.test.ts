import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/library/route';
import { getAllDevotionals } from '@/lib/content';
import { getAllResourceSlugs, getResourceBySlug } from '@/lib/resources';
import { getAllSlugs as getAllKidsSlugs, getIssue } from '@/lib/kids';
import type { LibraryItem } from '@/lib/types';

/**
 * `GET /api/library` — the lookup behind the saved shelf.
 *
 * Saving is local, so all the browser has is a list of slugs, and the reason this route exists is
 * the alternative it replaces: shipping 850 articles to a phone so ten bookmarks can have titles.
 * These tests therefore check both halves of that bargain — every saved thing resolves to a card,
 * whichever corpus it came from, and the answer stays card-sized.
 */

interface LibraryResponse {
  items: LibraryItem[];
  unknown: string[];
  error?: { code: string; message: string };
}

async function call(slugs?: string): Promise<{ status: number; body: LibraryResponse; headers: Headers }> {
  const url = new URL('https://rhapsody.example/api/library');
  if (slugs !== undefined) url.searchParams.set('slugs', slugs);
  const response = GET(new Request(url.toString()));
  return { status: response.status, body: (await response.json()) as LibraryResponse, headers: response.headers };
}

const devotional = getAllDevotionals()[0];
const resourceSlug = getAllResourceSlugs()[0];
const kidsSlug = getAllKidsSlugs()[0];

describe('the empty request', () => {
  it('answers an empty shelf rather than an error', async () => {
    for (const query of [undefined, '']) {
      const { status, body } = await call(query);
      expect(status).toBe(200);
      expect(body.items).toEqual([]);
      expect(body.unknown).toEqual([]);
    }
  });

  it('ignores the separators a saved list can be made of', async () => {
    const { body } = await call(' , , ');
    expect(body.items).toEqual([]);
  });
});

describe('resolving a saved slug', () => {
  it('labels a saved devotional with its day and audience', async () => {
    const { status, body } = await call(devotional.slug);
    expect(status).toBe(200);
    expect(body.items).toHaveLength(1);
    const [item] = body.items;
    expect(item.kind).toBe('devotional');
    expect(item.title).toBe(devotional.title);
    expect(item.href).toBe(`/devotionals/${devotional.slug}`);
    expect(item.label).toBe(devotional.audienceLabel);
    expect(item.date).toBe(devotional.date);
    expect(item.meta).toContain('min read');
    expect(item.excerpt.length).toBeGreaterThan(0);
  });

  it('labels a saved book with what kind of thing it is', async () => {
    const resource = getResourceBySlug(resourceSlug)!;
    const { body } = await call(resourceSlug);
    const [item] = body.items;
    expect(item.kind).toBe('resource');
    expect(item.title).toBe(resource.title);
    expect(item.href).toBe(`/resources/${resourceSlug}`);
    expect(item.label).toBe(resource.kindLabel);
    expect(item.meta).toContain('min listen');
  });

  it("labels a saved kids' issue with its month", async () => {
    const issue = getIssue(kidsSlug)!;
    const { body } = await call(kidsSlug);
    const [item] = body.items;
    expect(item.kind).toBe('kids');
    expect(item.title).toBe(issue.title);
    expect(item.href).toBe(`/kids/${kidsSlug}`);
    expect(item.meta).toContain('pages');
    expect(item.meta).toContain(String(issue.year));
  });

  it('answers all three corpora in one request, in the order asked', async () => {
    const { body } = await call([resourceSlug, devotional.slug, kidsSlug].join(','));
    expect(body.items.map((item) => item.kind)).toEqual(['resource', 'devotional', 'kids']);
    expect(body.items.map((item) => item.slug)).toEqual([resourceSlug, devotional.slug, kidsSlug]);
    expect(body.unknown).toEqual([]);
  });

  it('trims and de-duplicates, because localStorage holds whatever was tapped', async () => {
    const { body } = await call(` ${devotional.slug} ,${devotional.slug}, ${resourceSlug} `);
    expect(body.items.map((item) => item.slug)).toEqual([devotional.slug, resourceSlug]);
  });
});

describe('slugs that no longer resolve', () => {
  it('reports them instead of dropping them silently', async () => {
    // A draft that was unpublished, or a renamed file, is still on somebody's shelf.
    const { status, body } = await call(`2026-01-01-gone-forever,${devotional.slug}`);
    expect(status).toBe(200);
    expect(body.unknown).toEqual(['2026-01-01-gone-forever']);
    expect(body.items).toHaveLength(1);
  });

  it('answers an entirely unknown shelf as a list, not an error', async () => {
    const { status, body } = await call('nope,also-nope');
    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.unknown).toEqual(['nope', 'also-nope']);
  });
});

describe('limits', () => {
  it('refuses an absurd list with a code the page can explain', async () => {
    const { status, body, headers } = await call(Array.from({ length: 201 }, (_, i) => `slug-${i}`).join(','));
    expect(status).toBe(400);
    expect(body.error?.code).toBe('TOO_MANY_SLUGS');
    expect(body.error?.message).toMatch(/200/);
    expect(headers.get('Cache-Control')).toBe('no-store');
  });

  it('accepts a shelf right at the limit', async () => {
    const { status, body } = await call(Array.from({ length: 200 }, (_, i) => `slug-${i}`).join(','));
    expect(status).toBe(200);
    expect(body.unknown).toHaveLength(200);
  });
});

describe('the size of the answer', () => {
  it('is a card, never the article', async () => {
    const { body, headers } = await call([devotional.slug, resourceSlug, kidsSlug].join(','));
    expect(headers.get('Content-Type')).toContain('application/json');
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(
        ['date', 'excerpt', 'href', 'kind', 'label', 'meta', 'slug', 'title'].sort()
      );
      // The whole point of the route: no bodies, no message arrays, no sections.
      expect(JSON.stringify(item).length).toBeLessThan(600);
    }
  });

  it('is cacheable at the edge, because the corpus only changes on a deploy', async () => {
    const { headers } = await call(devotional.slug);
    expect(headers.get('Cache-Control')).toContain('s-maxage');
  });
});
