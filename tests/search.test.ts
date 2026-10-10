import { describe, expect, it } from 'vitest';
import { scoreDoc, searchDocs, tokenize } from '@/lib/search';
import type { SearchDoc } from '@/lib/types';

/**
 * Search is client-side and index-based: the server ships a compact `SearchDoc[]` and the
 * browser filters it, so `/search` works with no API and no round-trip. Ranking therefore has
 * to be predictable — title hits beat body hits, and every query token must match.
 */

const doc = (overrides: Partial<SearchDoc> = {}): SearchDoc => ({
  slug: '2026-10-15-the-righteousness-of-god',
  title: 'The Righteousness of God',
  excerpt: 'Righteousness is a gift, not a wage.',
  date: '2026-10-15',
  edition: '2026-10',
  editionTitle: 'October 2026 Edition',
  audience: 'adults',
  audienceLabel: 'For Adults',
  weekday: 'Thursday',
  scriptureReference: 'Romans 3:22',
  tags: ['daily-devotional', 'rhapsody-of-realities', 'october-2026'],
  readingMinutes: 3,
  opening: 'Many believers struggle to receive the gift of righteousness because they are still trying to earn it.',
  ...overrides,
});

describe('tokenize', () => {
  it('lower-cases, splits on punctuation and drops stop words', () => {
    expect(tokenize('  Righteousness, of GOD! ')).toEqual(['righteousness', 'god']);
    expect(tokenize('the spirit and the word')).toEqual(['spirit', 'word']);
    // Contractions stay intact, so "God's" is one searchable token.
    expect(tokenize("God’s grace")).toEqual(['god’s', 'grace']);
  });

  it('drops single characters and empty fragments', () => {
    expect(tokenize('a b 1 -- x')).toEqual([]);
  });

  it('returns nothing for blank or symbol-only queries', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('---')).toEqual([]);
  });

  it('keeps repeated tokens, which scoring treats as one signal', () => {
    expect(tokenize('grace grace GRACE')).toEqual(['grace', 'grace', 'grace']);
    expect(scoreDoc(doc(), tokenize('grace grace'), 'grace grace')).toEqual(
      scoreDoc(doc(), tokenize('grace'), 'grace')
    );
  });
});

describe('scoreDoc', () => {
  const tokens = ['righteousness'];

  it('matches on the title with the highest weight', () => {
    expect(scoreDoc(doc(), tokens, 'righteousness')?.matchedOn).toBe('title');
  });

  it('matches the scripture reference', () => {
    expect(scoreDoc(doc({ title: 'Another topic' }), ['romans'], 'romans')?.matchedOn).toBe('scripture');
  });

  it('matches the article opening and the excerpt', () => {
    expect(scoreDoc(doc({ title: 'Another topic' }), ['earn'], 'earn')?.matchedOn).toBe('message');
    expect(scoreDoc(doc({ title: 'Another topic', opening: 'A plain sentence.' }), ['wage'], 'wage')?.matchedOn).toBe('excerpt');
  });

  it('matches tags and edition metadata', () => {
    expect(scoreDoc(doc({ title: 'Another topic' }), ['october'], 'october')?.matchedOn).toBe('tag');
  });

  it('returns null when no field matches', () => {
    expect(scoreDoc(doc(), ['zzzzqqq'], 'zzzzqqq')).toBeNull();
  });

  it('ranks a doc matching every token above one matching only some', () => {
    // Ranking is OR-with-weights, not AND filtering: a devotional is never hidden because one
    // query word is absent, but full matches float to the top.
    const both = scoreDoc(doc(), ['righteousness', 'gift'], 'righteousness gift')!;
    const partial = scoreDoc(doc({ title: 'Another topic' }), ['righteousness', 'zzz'], 'righteousness zzz')!;
    expect(both.score).toBeGreaterThan(partial.score);
    expect(partial.score).toBeGreaterThan(0);
  });

  it('scores a title hit above a body hit', () => {
    const titleHit = scoreDoc(doc(), tokens, 'righteousness')!.score;
    const bodyHit = scoreDoc(doc({ title: 'Another topic' }), tokens, 'righteousness')!.score;
    expect(titleHit).toBeGreaterThan(bodyHit);
  });

  it('scores a whole-phrase hit above scattered tokens', () => {
    const phrase = scoreDoc(doc(), ['gift', 'righteousness'], 'gift of righteousness')!.score;
    const scattered = scoreDoc(doc({ title: 'Another topic', excerpt: 'Nothing related.' }), ['gift', 'righteousness'], 'gift of righteousness')!.score;
    expect(phrase).toBeGreaterThan(scattered);
  });
});

describe('searchDocs', () => {
  const docs = [
    doc(),
    doc({
      slug: '2026-10-16-righteousness-lived-out',
      title: 'Righteousness Lived Out',
      opening: 'Righteousness is not only received, it is walked in.',
      excerpt: 'Walk in it daily.',
    }),
    doc({
      slug: '2026-09-02-grace-alone',
      title: 'Grace Alone',
      opening: 'Grace is the source of everything we have in Christ.',
      excerpt: 'Grace, not effort.',
      date: '2026-09-02',
    }),
  ];

  it('returns nothing for a blank query', () => {
    expect(searchDocs(docs, '')).toEqual([]);
    expect(searchDocs(docs, '   ')).toEqual([]);
  });

  it('ranks best matches first', () => {
    const results = searchDocs(docs, 'righteousness');
    expect(results.map((r) => r.doc.slug)).toEqual(['2026-10-15-the-righteousness-of-god', '2026-10-16-righteousness-lived-out']);
    expect(results[0].matchedOn).toBe('title');
  });

  it('breaks ties by newest date', () => {
    const results = searchDocs(docs, 'grace');
    expect(results.every((r) => r.score > 0)).toBe(true);
    const equalScore = results.filter((r) => r.score === results[0].score).map((r) => r.doc.date);
    expect(equalScore).toEqual([...equalScore].sort().reverse());
  });

  it('respects the limit', () => {
    expect(searchDocs(docs, 'righteousness', 1)).toHaveLength(1);
  });

  it('exposes what the UI needs to render a result', () => {
    const [hit] = searchDocs(docs, 'righteousness');
    expect(hit.score).toBeGreaterThan(0);
    expect(['title', 'scripture', 'message', 'excerpt', 'tag', 'date']).toContain(hit.matchedOn);
    // The whole doc rides along, so the client renders a card without another lookup.
    expect(hit.doc).toMatchObject({
      slug: expect.any(String),
      title: expect.any(String),
      excerpt: expect.any(String),
      date: expect.any(String),
    });
  });

  it('finds a word that appears only inside the article', () => {
    const results = searchDocs(docs, 'walked');
    expect(results.map((r) => r.doc.slug)).toEqual(['2026-10-16-righteousness-lived-out']);
    expect(results[0].matchedOn).toBe('message');
  });
});

describe('audience', () => {
  it('matches the audience name, so “teens” is a search and not only a filter', () => {
    const docs = [doc(), doc({ slug: '2026-10-15-teens-x', title: 'A Teen Reading', audience: 'teens', audienceLabel: 'For Teens' })];
    const found = searchDocs(docs, 'teens');
    expect(found).toHaveLength(1);
    expect(found[0].doc.slug).toBe('2026-10-15-teens-x');
  });
});
