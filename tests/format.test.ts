import { describe, expect, it } from 'vitest';
import { formatCount, formatDayHeading, formatDate, formatDateShort, formatWords, timeAgo } from '@/lib/format';

/**
 * Every date on the site comes from a `yyyy-mm-dd` frontmatter string, so these helpers must be
 * strict about parsing and never leak "Invalid Date" into a rendered page.
 */

describe('formatDate', () => {
  it('renders the long form used in article headers', () => {
    expect(formatDate('2026-09-01')).toBe('September 1, 2026');
    expect(formatDate('2026-10-31')).toBe('October 31, 2026');
  });

  it('renders the short form used on cards', () => {
    expect(formatDateShort('2026-09-01')).toBe('Sep 1, 2026');
  });

  it('returns an empty string rather than "Invalid Date"', () => {
    for (const bad of ['', null, undefined, 'not-a-date', '2026-13-45']) {
      expect(formatDate(bad)).toBe('');
      expect(formatDateShort(bad)).toBe('');
      expect(formatDayHeading(bad)).toBe('');
    }
  });
});

describe('formatDayHeading', () => {
  it('matches the weekday printed in the edition', () => {
    // 2026-09-01 was a Tuesday and 2026-10-10 a Saturday — the extractor asserts the same.
    expect(formatDayHeading('2026-09-01')).toBe('Tuesday, September 1');
    expect(formatDayHeading('2026-10-10')).toBe('Saturday, October 10');
  });
});

describe('timeAgo', () => {
  it('describes elapsed time', () => {
    expect(timeAgo(new Date(Date.now() - 60 * 60 * 1000).toISOString())).toBe('1 hour ago');
    expect(timeAgo(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())).toBe('3 days ago');
  });

  it('treats a future timestamp as now', () => {
    expect(timeAgo(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toBe('just now');
  });

  it('is empty for missing or invalid input', () => {
    expect(timeAgo('')).toBe('');
    expect(timeAgo(undefined)).toBe('');
    expect(timeAgo('garbage')).toBe('');
  });
});

describe('counts', () => {
  it('separates thousands', () => {
    expect(formatCount(61)).toBe('61');
    expect(formatCount(20564)).toBe('20,564');
    expect(formatCount(1000000)).toBe('1,000,000');
  });

  it('falls back to zero for missing values', () => {
    expect(formatCount(null)).toBe('0');
    expect(formatCount(undefined)).toBe('0');
    expect(formatCount(Number.NaN)).toBe('0');
  });

  it('formats word counts the same way', () => {
    expect(formatWords(20564)).toBe('20,564');
    expect(formatWords(null)).toBe('0');
  });
});
