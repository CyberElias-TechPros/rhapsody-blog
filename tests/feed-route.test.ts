import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDevotionalsByAudience, getReleasedDevotionals, isReleased } from '@/lib/content';

afterEach(() => vi.useRealTimers());

describe('released days', () => {
  it('holds back days later in the month', () => {
    const all = getDevotionalsByAudience('adults');
    const released = getReleasedDevotionals('adults', '2026-10-15');
    expect(released.every((post) => post.date <= '2026-10-15')).toBe(true);
    expect(all.some((post) => !isReleased(post, '2026-10-15'))).toBe(true);
    expect(released[0].date).toBe('2026-10-15');
  });
});

describe('GET /feed.xml', () => {
  it('carries only days that have arrived in the site zone, newest first', async () => {
    // 23:30 UTC on the 14th is already the 15th in Lagos.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T23:30:00Z'));
    const { GET } = await import('@/app/feed.xml/route');
    const xml = await GET().text();
    const dates = [...xml.matchAll(/<link>[^<]*\/devotionals\/(\d{4}-\d{2}-\d{2})-/g)].map((m) => m[1]);
    expect(dates.length).toBeGreaterThan(10);
    expect(dates[0]).toBe('2026-10-15');
    expect(dates.every((date) => date <= '2026-10-15')).toBe(true);
  });
});
