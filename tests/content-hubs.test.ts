import { describe, expect, it } from 'vitest';
import {
  getAllDevotionals,
  getAvailableMonths,
  getBibleBookIndex,
  getCalendarMonth,
  getDevotionalsByBook,
  getRandomDevotional,
  getSameBookDevotionals,
  resolveDate,
} from '@/lib/content';
import { bookOfReference } from '@/lib/bible';

describe('devotionals by Bible book', () => {
  const index = getBibleBookIndex();

  it('accounts for every devotional whose opening scripture names a book', () => {
    const withBook = getAllDevotionals().filter((post) => bookOfReference(post.scriptureReference));
    expect(index.reduce((sum, entry) => sum + entry.count, 0)).toBe(withBook.length);
    expect(withBook.length).toBeGreaterThan(getAllDevotionals().length * 0.95);
  });

  it('lists books in canonical order, and each book’s days in chapter order', () => {
    const orders = index.map((entry) => entry.book.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    const romans = getDevotionalsByBook('romans');
    expect(romans.length).toBeGreaterThan(10);
    const chapters = romans.map((post) => Number(/Romans\s+(\d+)/.exec(post.scriptureReference)?.[1]));
    expect([...chapters].sort((a, b) => a - b)).toEqual(chapters);
  });

  it('suggests other days from the same book, in the same audience', () => {
    const post = getDevotionalsByBook('romans')[0];
    const { book, posts } = getSameBookDevotionals(post, 3);
    expect(book?.slug).toBe('romans');
    expect(posts.every((other) => other.slug !== post.slug && other.audience === post.audience)).toBe(true);
  });
});

describe('calendar and dates', () => {
  it('knows which months it covers and returns a month in date order', () => {
    const months = getAvailableMonths('adults');
    expect(months.length).toBeGreaterThan(0);
    const days = getCalendarMonth(months[months.length - 1], 'adults');
    expect(days.length).toBeGreaterThan(20);
    expect(days.map((d) => d.date)).toEqual([...days.map((d) => d.date)].sort());
  });

  it('resolves a date exactly, or to the nearest earlier day', () => {
    const post = getAllDevotionals().find((p) => p.audience === 'teens')!;
    expect(resolveDate(post.date, 'teens')?.slug).toBe(post.slug);
    const beforeEverything = resolveDate('1999-01-01', 'adults');
    expect(beforeEverything).toBeDefined();
  });

  it('picks a random released day, deterministically when asked', () => {
    const first = getRandomDevotional('adults', '2026-10-15', () => 0);
    const last = getRandomDevotional('adults', '2026-10-15', () => 0.9999);
    expect(first && first.date <= '2026-10-15').toBe(true);
    expect(last && last.date <= '2026-10-15').toBe(true);
    expect(first?.slug).not.toBe(last?.slug);
  });
});
