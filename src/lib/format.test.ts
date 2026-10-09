import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, formatDateShort, timeAgo } from './format';

describe('date formatting', () => {
  it('formats valid ISO timestamps', () => {
    expect(formatDate('2026-03-03T08:00:00Z')).toMatch(/March 3, 2026/);
    expect(formatDateShort('2026-03-03T08:00:00Z')).toMatch(/Mar 3, 2026/);
  });

  it('returns empty string (never NaN) for missing or malformed values', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDateShort('0000-13-45')).toBe('');
    expect(timeAgo('garbage')).toBe('');
  });

  it('timeAgo describes recent dates and guards future drift', () => {
    expect(timeAgo(new Date(Date.now() - 3 * 60_000).toISOString())).toBe('3 minutes ago');
    expect(timeAgo(new Date(Date.now() + 3_600_000).toISOString())).toBe('just now');
  });

  it('formatCount localises and guards NaN', () => {
    expect(formatCount(1200)).toBe((1200).toLocaleString());
    expect(formatCount(null)).toBe('0');
    expect(formatCount(Number.NaN)).toBe('0');
  });
});
