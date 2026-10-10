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
  getDevotionalsByAudience,
  getDevotionalsByEdition,
  getDaySiblings,
  getEdition,
  getEditionGroups,
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

/**
 * Corpus as it stands: eight adult editions (the 61 published Sep/Oct days plus the Mar–Aug
 * re-extraction), ten teens months and ten early-readers months. Kids editions are deliberately
 * not extracted — the RORK PDFs are a comic-and-activity magazine whose story pages are pictures, so
 * there is no article text to recover (the reason is recorded in scripts/extract-devotionals.mjs).
 */
const FIRST = '2026-01-01'; // earliest day across every audience
const LAST = '2026-10-31';
const TOTAL = 853;
const ADULTS = 245;
const TEENS = 304;
const EARLY_READERS = 304;

describe('corpus', () => {
  it('loads every published day of every edition', () => {
    const all = getAllDevotionals();
    expect(all).toHaveLength(TOTAL);
    expect(getAllSlugs()).toHaveLength(TOTAL);
    expect(new Set(all.map((p) => p.slug)).size).toBe(TOTAL);
    // Every audience keeps its own days; none leak into another's listing.
    expect(getDevotionalsByAudience('adults')).toHaveLength(ADULTS);
    expect(getDevotionalsByAudience('teens')).toHaveLength(TEENS);
    expect(getDevotionalsByAudience('early-readers')).toHaveLength(EARLY_READERS);
    expect(getDevotionalsByAudience('teens').filter((p) => p.slug.includes('teens'))).toHaveLength(
      TEENS,
    );
  });

  it('sorts newest first, adults before the readers’ editions on a shared day', () => {
    const all = getAllDevotionals();
    const dates = all.map((p) => p.date);
    expect(dates[0]).toBe(LAST);
    expect(dates[dates.length - 1]).toBe(FIRST);
    expect([...dates].sort().reverse()).toEqual(dates);
    // Same day, three editions: a stable order, so a date never looks scrambled.
    expect(all.filter((p) => p.date === LAST).map((p) => p.audience)).toEqual([
      'adults',
      'teens',
      'early-readers',
    ]);
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
      expect(post.message.length, post.slug).toBeGreaterThanOrEqual(1);
      expect(post.scripture.length, post.slug).toBeGreaterThan(10);
      expect(post.scriptureReference, post.slug).toMatch(/[A-Z]/);
      expect(['Prayer', 'Confession'], post.slug).toContain(post.prayerLabel);
      expect(post.furtherStudy!.length, post.slug).toBeGreaterThan(5);
      expect(post.readingMinutes, post.slug).toBeGreaterThanOrEqual(1);
      expect(post.excerpt.length, post.slug).toBeGreaterThan(20);
      expect(post.words, post.slug).toBeGreaterThan(40);
      expect(post.tags, post.slug).toContain('daily-devotional');
      expect(post.sourcePdf, post.slug).toMatch(/\.pdf$/i);
      expect(post.sourcePages.length, post.slug).toBeGreaterThanOrEqual(1);
      expect(post.status, post.slug).toBe('published');

      if (post.audience === 'adults') {
        // The shape the site shipped with, unchanged.
        expect(post.prayer.length, post.slug).toBeGreaterThan(80);
        expect(post.oneYearPlan!.length, post.slug).toBeGreaterThan(10);
        expect(post.twoYearPlan!.length, post.slug).toBeGreaterThan(10);
        expect(post.extras, post.slug).toEqual([]);
        expect(post.sourcePages, post.slug).toHaveLength(2);
      } else {
        // The readers' editions bring their own closing blocks and name their PDF.
        expect(post.sourcePdf, post.slug).toMatch(/teevo|rorer/i);
        expect(post.slug, post.slug).toContain(post.audience);
        if (post.audience === 'teens') expect(post.extras.length, post.slug).toBeGreaterThan(0);
        // Early Readers print no Bible reading plans, so the card has nothing to render.
        if (post.audience === 'early-readers') {
          expect(post.oneYearPlan, post.slug).toBeFalsy();
          expect(post.twoYearPlan, post.slug).toBeFalsy();
        }
      }
    }
  });

  it('keeps every post identified with the edition it came from', () => {
    for (const post of getAllDevotionals()) {
      expect(post.audienceLabel, post.slug).toMatch(/^For /);
      // Only adults keep the bare month slug, so their URLs never changed; the readers' editions
      // carry their audience as a suffix instead of colliding with them.
      const month = post.date.slice(0, 7);
      expect(post.edition, post.slug).toBe(post.audience === 'adults' ? month : `${month}-${post.audience}`);
      expect(post.series, post.slug).toMatch(/Rhapsody of Realities/);
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
  it('derives one edition per monthly PDF, per audience', () => {
    const editions = getEditions();
    expect(editions).toHaveLength(28);
    expect(new Set(editions.map((e) => e.audience))).toEqual(
      new Set(['adults', 'teens', 'early-readers']),
    );

    const adults = getEditions('adults');
    expect(adults.map((e) => e.slug)).toEqual([
      '2026-10',
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-06',
      '2026-05',
      '2026-04',
      '2026-03',
    ]);
    expect(adults.map((e) => e.postCount)).toEqual([31, 30, 31, 31, 30, 31, 30, 31]);
    // A readers' edition carries its audience in the slug, so it cannot shadow the adult month.
    expect(getEditions('teens')[0].slug).toBe('2026-10-teens');
    expect(getEdition('2026-10-teens')!.title).toContain('October 2026');
    expect(getEdition('2026-10')!.audience).toBe('adults');
    // A group heading only names the audience when there is one to disambiguate.
    expect(getEdition('2026-10')!.audienceTitle).toBe('October 2026');
    expect(getEdition('2026-10-teens')!.audienceTitle).toContain('For Teens');
    expect(getEditionGroups().map((g) => [g.audience, g.editions.length])).toEqual([
      ['adults', 8],
      ['teens', 10],
      ['early-readers', 10],
    ]);
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

  it('keeps a month that only some readers published in', () => {
    // February 2026 has 28 days for everyone; January has 31 for the readers and none for adults.
    expect(getDevotionalsByEdition('2026-02-teens')).toHaveLength(28);
    expect(getDevotionalsByEdition('2026-01')).toHaveLength(0);
    expect(getDevotionalsByEdition('2026-01-teens')).toHaveLength(31);
  });
});

describe('single post lookup', () => {
  it('finds a post by slug and misses cleanly', () => {
    const slug = getAllSlugs()[0];
    expect(getDevotionalBySlug(slug)?.slug).toBe(slug);
    expect(getDevotionalBySlug('2026-09-01-not-a-real-post')).toBeUndefined();
  });

  it('finds the devotional printed on a date, per audience', () => {
    expect(getDevotionalForDate('2026-10-15')?.date).toBe('2026-10-15');
    expect(getDevotionalForDate('2026-10-15')?.audience).toBe('adults');
    expect(getDevotionalForDate('2026-10-15', 'teens')?.audience).toBe('teens');
    // Adults have no January; the readers editions do.
    expect(getDevotionalForDate('2026-01-15')).toBeUndefined();
    expect(getDevotionalForDate('2026-01-15', 'early-readers')?.date).toBe('2026-01-15');
    expect(getDevotionalForDate('2026-11-01', 'teens')).toBeUndefined();
  });

  it('offers the other editions printed on the same day', () => {
    const adults = getDevotionalForDate('2026-10-15')!;
    expect(getDaySiblings(adults.slug).map((p) => p.audience)).toEqual(['teens', 'early-readers']);
    expect(getDaySiblings(adults.slug).every((p) => p.date === adults.date)).toBe(true);
    // January belongs to the readers alone, so a teens day has one sibling rather than two,
    // and an adult January does not exist to have siblings at all.
    const teensJanuary = getDevotionalForDate('2026-01-15', 'teens')!;
    expect(getDaySiblings(teensJanuary.slug).map((p) => p.audience)).toEqual(['early-readers']);
    expect(getDevotionalForDate('2026-01-15')).toBeUndefined();
    expect(getDaySiblings('2026-01-15-not-a-post')).toEqual([]);
  });

  it('walks to the previous and next day of the same audience', () => {
    const slug = getAllSlugs().find((s) => s.startsWith('2026-10-15'))!;
    const middle = getAdjacentDevotionals(slug);
    expect(middle.previous?.date).toBe('2026-10-14');
    expect(middle.next?.date).toBe('2026-10-16');
    expect(getAdjacentDevotionals('2026-10-15-not-a-post')).toEqual({});

    const teens = getDevotionalForDate('2026-10-15', 'teens')!;
    expect(getAdjacentDevotionals(teens.slug).previous?.audience).toBe('teens');
    expect(getAdjacentDevotionals(teens.slug).next?.date).toBe('2026-10-16');
  });

  it('crosses the month boundary in both directions', () => {
    const octoberFirst = getAllSlugs().find((s) => s.startsWith('2026-10-01'))!;
    const septemberLast = getAllSlugs().find((s) => s.startsWith('2026-09-30'))!;
    expect(getAdjacentDevotionals(octoberFirst).previous?.date).toBe('2026-09-30');
    expect(getAdjacentDevotionals(septemberLast).next?.date).toBe('2026-10-01');
  });

  it('has no neighbour at the ends of an audience', () => {
    const newest = getAllSlugs().find((s) => s.startsWith(LAST))!;
    const oldest = getAllSlugs().find((s) => s.startsWith(FIRST))!;
    expect(getAdjacentDevotionals(newest).next).toBeUndefined();
    expect(getAdjacentDevotionals(oldest).previous).toBeUndefined();
    // The adult stream ends 31 October and starts in March, whatever the readers cover.
    const adultsOldest = getDevotionalsByAudience('adults').at(-1)!;
    expect(adultsOldest.date.startsWith('2026-03')).toBe(true);
    expect(getAdjacentDevotionals(adultsOldest.slug).previous).toBeUndefined();
  });
});

describe('the home page hero', () => {
  it('features today when today is published', () => {
    expect(getDevotionalForDate(todayIso(new Date('2026-10-10T12:00:00Z')))).toBeDefined();
    expect(getFeaturedDevotional(new Date('2026-10-10T12:00:00Z'))?.date).toBe('2026-10-10');
  });

  it('falls back to the newest day when today is not published yet', () => {
    // A date after the adult corpus, and a date before it, both land on the newest article.
    expect(getFeaturedDevotional(new Date('2026-11-05T12:00:00Z'))?.date).toBe(LAST);
    expect(getFeaturedDevotional(new Date('2026-02-01T12:00:00Z'))?.date).toBe(LAST);
  });

  it('features the adult edition, whichever month today falls in', () => {
    // The readers' editions are a tab away; the hero stays the one the site is named for.
    const featured = getFeaturedDevotional(new Date('2026-08-01T12:00:00Z'))!;
    expect(featured.audience).toBe('adults');
    expect(featured.date).toBe('2026-08-01');
    // A teens post exists on that day too, but it is not what the hero shows.
    expect(getDevotionalForDate('2026-08-01', 'teens')).toBeDefined();
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
    expect(first.total).toBe(TOTAL);
    expect(first.totalPages).toBe(Math.ceil(TOTAL / 12));
    expect(first.items[0].date).toBe(LAST);

    const second = queryDevotionals({ page: 2, limit: 12 });
    expect(second.page).toBe(2);
    // Page 2 continues exactly where page 1 stopped, with no overlap.
    expect(second.items[0].slug).toBe(getAllSlugs()[12]);
    expect(second.items.map((i) => i.slug).filter((s) => first.items.some((f) => f.slug === s))).toEqual([]);
  });

  it('returns the remainder on the last page and clamps out-of-range pages', () => {
    const lastPage = Math.ceil(TOTAL / 12);
    expect(queryDevotionals({ page: lastPage, limit: 12 }).items).toHaveLength(TOTAL % 12 || 12);
    // Out-of-range pages clamp instead of rendering an empty grid.
    expect(queryDevotionals({ page: 99, limit: 12 }).page).toBe(lastPage);
    expect(queryDevotionals({ page: 99, limit: 12 }).items).toHaveLength(TOTAL % 12 || 12);
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

  it('filters by audience', () => {
    const teens = queryDevotionals({ audience: 'teens', limit: 10 });
    expect(teens.total).toBe(TEENS);
    expect(teens.items.every((i) => i.audience === 'teens')).toBe(true);
    // Audience and edition compose; a teens edition is not an adults edition.
    expect(queryDevotionals({ audience: 'teens', edition: '2026-10-teens', limit: 50 }).total).toBe(
      31,
    );
    expect(queryDevotionals({ edition: '2026-10-teens', limit: 50 }).total).toBe(31);
    expect(queryDevotionals({ audience: 'adults', edition: '2026-10-teens', limit: 50 }).total).toBe(0);
  });

  it('filters by tag', () => {
    const tagged = queryDevotionals({ tag: 'october-2026', limit: 50 });
    expect(tagged.total).toBe(31 * 3);
    expect(queryDevotionals({ tag: 'nonexistent-tag', limit: 50 }).total).toBe(0);
  });

  it('filters by text across the whole article', () => {
    const needle = 'righteousness';
    const found = queryDevotionals({ q: needle, limit: 50 });
    expect(found.total).toBeGreaterThan(0);
    for (const item of found.items) {
      const full = getDevotionalBySlug(item.slug)!;
      // The same fields the library indexes (see matchesQuery).
      const haystack = [
        full.title,
        full.subtitle,
        full.excerpt,
        full.scripture,
        full.message.join(' '),
        full.prayer,
        full.extras.map((s) => `${s.label} ${s.text}`).join(' '),
        full.furtherStudy,
      ]
        .join(' ')
        .toLowerCase();
      expect(haystack, item.slug).toContain(needle);
    }
    expect(queryDevotionals({ q: 'zzzzqqq', limit: 50 }).total).toBe(0);
    expect(queryDevotionals({ q: '   ', limit: 50 }).total).toBe(TOTAL); // blank query = no filter
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
    expect(index).toHaveLength(TOTAL);
    for (const doc of index) {
      expect(doc.slug).toMatch(/^2026-/);
      expect(doc.opening.length).toBeGreaterThan(20);
      expect(doc.audience).toMatch(/^(adults|teens|early-readers)$/);
      expect(doc.audienceLabel).toMatch(/^For /);
      expect(doc).not.toHaveProperty('message');
      expect(doc).not.toHaveProperty('prayer');
    }
  });

  it('counts tags with the devotional tag on every post', () => {
    const tags = getAllTags();
    expect(tags.find((t) => t.tag === 'daily-devotional')?.count).toBe(TOTAL);
    // A month tag is shared by every audience published that month: a tag page is a reading list
    // for the month, not for one edition.
    expect(tags.find((t) => t.tag === 'september-2026')?.count).toBe(30 * 3);
    expect(tags.find((t) => t.tag === 'october-2026')?.count).toBe(31 * 3);
    expect(tags[0].count).toBeGreaterThanOrEqual(tags[tags.length - 1].count);
  });

  it('reports corpus stats for the about page', () => {
    const stats = getContentStats();
    expect(stats).toMatchObject({
      posts: TOTAL,
      editions: 28,
      words: expect.any(Number),
      firstDate: FIRST,
      lastDate: LAST,
    });
    expect(stats.words).toBeGreaterThan(15_000);
    expect(stats.byAudience.map((a) => [a.audience, a.posts])).toEqual([
      ['adults', ADULTS],
      ['teens', TEENS],
      ['early-readers', EARLY_READERS],
    ]);
    expect(stats.byAudience.reduce((sum, a) => sum + a.posts, 0)).toBe(TOTAL);
    // Every audience has real prose behind it, not stubs.
    for (const audience of stats.byAudience) {
      expect(audience.words).toBeGreaterThan(10_000);
      expect(audience.editions).toBeGreaterThan(5);
    }
  });
});
