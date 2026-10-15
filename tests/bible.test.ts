import { describe, expect, it } from 'vitest';
import {
  BIBLE_BOOKS,
  bibleGatewayUrl,
  bookOfReference,
  extractReferences,
  findBook,
  referenceSortKey,
  splitReferences,
  stripTrailingReference,
} from '@/lib/bible';

const refs = (text: string) =>
  splitReferences(text)
    .filter((s) => s.type === 'ref')
    .map((s) => (s.type === 'ref' ? [s.text, s.query, s.version ?? ''] : []));

describe('the canon', () => {
  it('has 66 books in order with unique slugs', () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(BIBLE_BOOKS[0].name).toBe('Genesis');
    expect(BIBLE_BOOKS[65].name).toBe('Revelation');
    expect(new Set(BIBLE_BOOKS.map((b) => b.slug)).size).toBe(66);
    expect(findBook('psalm')?.slug).toBe('psalms');
    expect(findBook('Song of Songs')?.slug).toBe('song-of-solomon');
  });
});

describe('splitReferences', () => {
  it('links every reference in further-study and reading-plan lines', () => {
    expect(refs('Romans 5:17; 2 Corinthians 5:21')).toEqual([
      ['Romans 5:17', 'Romans 5:17', ''],
      ['2 Corinthians 5:21', '2 Corinthians 5:21', ''],
    ]);
    expect(refs('Philippians 2:19-3:1-11, John 3:22-36, 1 Kings 9').map((r) => r[1])).toEqual([
      'Philippians 2:19-3:1-11',
      'John 3:22-36',
      '1 Kings 9',
    ]);
  });

  it('never swallows the number that starts the next book', () => {
    expect(refs('Isaiah 61-63, 1 Kings 9').map((r) => r[1])).toEqual(['Isaiah 61-63', '1 Kings 9']);
  });

  it('carries the book over to bare chapter:verse continuations and keeps translations', () => {
    expect(refs('Romans 5:17, 8:1; 12:2').map((r) => r[1])).toEqual(['Romans 5:17', 'Romans 8:1', 'Romans 12:2']);
    expect(refs('Psalm 23:1 NKJV')).toEqual([['Psalm 23:1 NKJV', 'Psalms 23:1', 'NKJV']]);
  });

  it('leaves ordinary words alone (case-sensitive, needs a chapter)', () => {
    expect(refs('the acts 2 numbers 3 of a job 1 well done')).toEqual([]);
  });

  it('round-trips the text exactly', () => {
    const text = 'Read John 3:16, 18. Then Song of Solomon 2:4 and 1 John 4:4 (NIV).';
    expect(splitReferences(text).map((s) => s.text).join('')).toBe(text);
    expect(extractReferences(text)).toEqual(['John 3:16,18', 'Song of Solomon 2:4', '1 John 4:4']);
  });
});

describe('helpers', () => {
  it('finds the book an opening scripture is in, and sorts by chapter and verse', () => {
    expect(bookOfReference('Deuteronomy 1:6-7 NLT')?.name).toBe('Deuteronomy');
    expect(bookOfReference('nothing here')).toBeUndefined();
    expect(referenceSortKey('Romans 8:26 NKJV')).toEqual([45, 8, 26]);
  });

  it('builds BibleGateway links', () => {
    expect(bibleGatewayUrl('Romans 5:17', 'NKJV')).toBe('https://www.biblegateway.com/passage/?search=Romans%205%3A17&version=NKJV');
    expect(bibleGatewayUrl('John 3:16')).toContain('version=KJV');
  });

  it('strips the reference the edition prints inside the verse', () => {
    expect(stripTrailingReference('But now the righteousness of God … the prophets (Romans 3:21).')).toBe(
      'But now the righteousness of God … the prophets.'
    );
    expect(stripTrailingReference('A verse with no reference.')).toBe('A verse with no reference.');
    expect(stripTrailingReference('Keep this (and that).')).toBe('Keep this (and that).');
  });
});
