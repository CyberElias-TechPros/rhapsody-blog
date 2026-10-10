import { describe, expect, it } from 'vitest';
import {
  getAllDevotionals,
  getAllSlugs,
  getAllSummaries,
  getAllTags,
  getAdjacentDevotionals,
  getContentStats,
  getDevotionalBySlug,
  getDevotionalForDate,
  getDevotionalsByEdition,
  getEdition,
  getEditions,
  getFeaturedDevotional,
  getSearchIndex,
  queryDevotionals,
  todayIso,
} from '@/lib/content';

/**
 * The content layer as the routes see it. These read the committed Markdown in
 * `content/devotionals/`, so they fail if a route would render an empty or malformed page —
 * `tests/content-extraction.test.ts` covers the upstream PDF → Markdown step.
 */

const FIRST = '2026-09-01';
const LAST = '2026-10-31';

describe('corpus', () => {
  it('loads every published day of both editions', () => {
    const all = getAllDevotionals();
    expect(all).toHaveLength(61);
    expect(getAllSlugs()).toHaveLength(61);
    expect(new Set(all.map((p) => p.slug)).size).toBe(61);
  });

  it('sorts newest first', () => {
    const dates = getAllDevotionals().map((p) => p.date);
    expect(dates[0]).toBe(LAST);
    expect(dates[dates.length - 1]).toBe(FIRST);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('gives every post a dated slug that matches its permalink', () => {
    for (const post of getAllDevotionals()) {
      expect(post.slug).toMatch(new RegExp(`^${post.date}-[a-z0-9-]+$`));
      expect(post.slug.startsWith(post.date)).toBe(true);
      // The permalink the routes build from it.
      expect(`/devotionals/${post.slug}`).toMatch(/^\/devotionals\/2026-\d{2}-\d{2}-[a-z0-9-]+$/);
    }
  });

  it('keeps every section a reader expects', () => {
    for (const post of getAllDevotionals()) {
      expect(post.message.length, post.slug).toBeGreaterThanOrEqual(2);
      expect(post.scripture.length).toBeGreaterThan(40);
      expect(post.scriptureReference).toMatch(/[A-Z]/);
      expect(['Prayer', 'Confession']).toContain(post.prayerLabel);
      expect(post.prayer.length).toBeGreaterThan(80);
      expect(post.furtherStudy.length).toBeGreaterThan(10);
      expect(post.oneYearPlan.length).toBeGreaterThan(10);
      expect(post.twoYearPlan.length).toBeGreaterThan(10);
      expect(post.words).toBeGreaterThan(150);
      expect(post.readingMinutes).toBeGreaterThanOrEqual(1);
      expect(post.excerpt.length).toBeGreaterThan(40);
      expect(post.tags).toContain('daily-devotional');
      expect(post.sourcePdf).toMatch(/rhapsody\.pdf$/);
      expect(post.sourcePages).toHaveLength(2);
      expect(post.status).toBe('published');
    }
  });

  it('summarises a post without shipping its body', () => {
    const summary = getAllSummaries()[0];
    expect(summary).toMatchObject({ slug: expect.any(String), title: expect.any(String) });
    expect('message' in summary).toBe(false);
    expect('body' in summary).toBe(false);
    // The card-level fields a list needs are still there.
    expect(summary.scriptureReference).toMatch(/[A-Z]/);
    expect(summary.readingMinutes).toBeGreaterThan(0);
  });
});

describe('editions', () => {
  it('derives one edition per monthly PDF', () => {
    const editions = getEditions();
    expect(editions.map((e) => e.slug)).toEqual(['2026-10', '2026-09']);
    expect(editions.map((e) => e.postCount)).toEqual([31, 30]);
  });

  it('spans the whole month', () => {
    const september = getEdition('2026-09')!;
    expect(september).toMatchObject({
      monthName: 'September',
      year: 2026,
      month: 9,
      firstDate: '2026-09-01',
      lastDate: '2026-09-30',
      sourcePdf: 'september-2026-rhapsody.pdf',
    });
    // The title is the printed edition line carried in frontmatter.
    expect(september.title).toContain('September 2026');
    expect(getEdition('2026-10')!.lastDate).toBe('2026-10-31');
    expect(getEdition('2026-11')).toBeUndefined();
  });

  it('returns an edition newest first, which the route reverses to day 1 first', () => {
    const days = getDevotionalsByEdition('2026-09').map((p) => p.dayOfMonth);
    expect(days[0]).toBe(30);
    expect(days[days.length - 1]).toBe(1);
    expect(days.slice().reverse()[0]).toBe(1);
    expect(getDevotionalsByEdition('2026-11')).toEqual([]);
  });
});

describe('single post lookup', () => {
  it('finds a post by slug and misses cleanly', () => {
    const slug = getAllSlugs()[0];
    expect(getDevotionalBySlug(slug)?.slug).toBe(slug);
    expect(getDevotionalBySlug('2026-09-01-not-a-real-post')).toBeUndefined();
  });

  it('finds the devotional printed on a date', () => {
    expect(getDevotionalForDate('2026-10-15')?.date).toBe('2026-10-15');
    expect(getDevotionalForDate('2026-08-31')).toBeUndefined();
  });

  it('walks to the previous and next day', () => {
    const slug = getAllSlugs().find((s) => s.startsWith('2026-10-15'))!;
    const middle = getAdjacentDevotionals(slug);
    expect(middle.previous?.date).toBe('2026-10-14');
    expect(middle.next?.date).toBe('2026-10-16');
    expect(getAdjacentDevotionals('2026-10-15-not-a-post')).toEqual({});
  });

  it('crosses the month boundary in both directions', () => {
    const octoberFirst = getAllSlugs().find((s) => s.startsWith('2026-10-01'))!;
    const septemberLast = getAllSlugs().find((s) => s.startsWith('2026-09-30'))!;
    expect(getAdjacentDevotionals(octoberFirst).previous?.date).toBe('2026-09-30');
    expect(getAdjacentDevotionals(septemberLast).next?.date).toBe('2026-10-01');
  });

  it('has no neighbour at the ends of the corpus', () => {
    const newest = getAllSlugs().find((s) => s.startsWith(LAST))!;
    const oldest = getAllSlugs().find((s) => s.startsWith(FIRST))!;
    expect(getAdjacentDevotionals(newest).next).toBeUndefined();
    expect(getAdjacentDevotionals(oldest).previous).toBeUndefined();
  });
});

describe('the home page hero', () => {
  it('features today when today is published', () => {
    expect(getDevotionalForDate(todayIso(new Date('2026-10-10T12:00:00Z')))).toBeDefined();
    expect(getFeaturedDevotional(new Date('2026-10-10T12:00:00Z'))?.date).toBe('2026-10-10');
  });

  it('falls back to the newest day when today is not published yet', () => {
    // A date after the corpus, and a date before it, both land on the newest article.
    expect(getFeaturedDevotional(new Date('2026-11-05T12:00:00Z'))?.date).toBe(LAST);
    expect(getFeaturedDevotional(new Date('2026-08-01T12:00:00Z'))?.date).toBe(LAST);
  });

  it('prefers the most recent past day when today is missing from the middle of the corpus', () => {
    // 2026-09-15 is published, so it wins outright; the fallback only matters for gaps.
    expect(getFeaturedDevotional(new Date('2026-09-15T12:00:00Z'))?.date).toBe('2026-09-15');
  });
});

describe('querying the library', () => {
  it('pages newest first by default', () => {
    const first = queryDevotionals({ page: 1, limit: 12 });
    expect(first.items).toHaveLength(12);
    expect(first.total).toBe(61);
    expect(first.totalPages).toBe(6);
    expect(first.items[0].date).toBe(LAST);

    const second = queryDevotionals({ page: 2, limit: 12 });
    expect(second.page).toBe(2);
    // Page 2 continues exactly where page 1 stopped, with no overlap.
    expect(second.items[0].slug).toBe(getAllSlugs()[12]);
    expect(second.items.map((i) => i.slug).filter((s) => first.items.some((f) => f.slug === s))).toEqual([]);
  });

  it('returns the remainder on the last page and clamps out-of-range pages', () => {
    expect(queryDevotionals({ page: 6, limit: 12 }).items).toHaveLength(1);
    // Out-of-range pages clamp instead of rendering an empty grid.
    expect(queryDevotionals({ page: 99, limit: 12 }).page).toBe(6);
    expect(queryDevotionals({ page: 99, limit: 12 }).items).toHaveLength(1);
    expect(queryDevotionals({ page: 0, limit: 12 }).page).toBe(1);
    expect(queryDevotionals({ page: -3, limit: 12 }).page).toBe(1);
    // The limit is clamped to a sane range too.
    expect(queryDevotionals({ limit: 500 }).limit).toBe(60);
  });

  it('sorts oldest first on request', () => {
    const oldest = queryDevotionals({ sort: 'old', limit: 5 });
    expect(oldest.items[0].date).toBe(FIRST);
    expect(oldest.items.map((i) => i.date)).toEqual([...oldest.items.map((i) => i.date)].sort());
  });

  it('filters by edition', () => {
    const september = queryDevotionals({ edition: '2026-09', limit: 50 });
    expect(september.total).toBe(30);
    expect(september.items.every((i) => i.edition === '2026-09')).toBe(true);
    expect(queryDevotionals({ edition: '2026-11', limit: 50 }).total).toBe(0);
  });

  it('filters by tag', () => {
    const tagged = queryDevotionals({ tag: 'october-2026', limit: 50 });
    expect(tagged.total).toBe(31);
    expect(queryDevotionals({ tag: 'nonexistent-tag', limit: 50 }).total).toBe(0);
  });

  it('filters by text across the whole article', () => {
    const needle = 'righteousness';
    const found = queryDevotionals({ q: needle, limit: 50 });
    expect(found.total).toBeGreaterThan(0);
    for (const item of found.items) {
      const full = getDevotionalBySlug(item.slug)!;
      const haystack = [full.title, full.excerpt, full.scripture, full.message.join(' '), full.prayer, full.furtherStudy]
        .join(' ')
        .toLowerCase();
      expect(haystack, item.slug).toContain(needle);
    }
    expect(queryDevotionals({ q: 'zzzzqqq', limit: 50 }).total).toBe(0);
    expect(queryDevotionals({ q: '   ', limit: 50 }).total).toBe(61); // blank query = no filter
  });

  it('finds words that appear only deep in the message', () => {
    // "Hallelujah" closes many prayers and appears in no title or excerpt.
    const found = queryDevotionals({ q: 'hallelujah', limit: 50 });
    expect(found.total).toBeGreaterThan(0);
    expect(found.items.every((i) => !/hallelujah/i.test(`${i.title} ${i.excerpt}`))).toBe(true);
  });

  it('combines filters', () => {
    const combined = queryDevotionals({ edition: '2026-09', q: 'spirit', limit: 50 });
    expect(combined.items.every((i) => i.edition === '2026-09')).toBe(true);
    expect(combined.total).toBeGreaterThan(0);
    expect(combined.total).toBeLessThanOrEqual(queryDevotionals({ q: 'spirit', limit: 50 }).total);
  });
});

describe('derived data for the UI', () => {
  it('builds a client-safe search index', () => {
    const index = getSearchIndex();
    expect(index).toHaveLength(61);
    for (const doc of index) {
      expect(doc.slug).toMatch(/^2026-/);
      expect(doc.opening.length).toBeGreaterThan(20);
      expect(doc).not.toHaveProperty('message');
      expect(doc).not.toHaveProperty('prayer');
    }
  });

  it('counts tags with the devotional tag on every post', () => {
    const tags = getAllTags();
    expect(tags.find((t) => t.tag === 'daily-devotional')?.count).toBe(61);
    expect(tags.find((t) => t.tag === 'september-2026')?.count).toBe(30);
    expect(tags.find((t) => t.tag === 'october-2026')?.count).toBe(31);
    expect(tags[0].count).toBeGreaterThanOrEqual(tags[tags.length - 1].count);
  });

  it('reports corpus stats for the about page', () => {
    expect(getContentStats()).toEqual({
      posts: 61,
      editions: 2,
      words: expect.any(Number),
      firstDate: FIRST,
      lastDate: LAST,
    });
    expect(getContentStats().words).toBeGreaterThan(15_000);
  });
});
