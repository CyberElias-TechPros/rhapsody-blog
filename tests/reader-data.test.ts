import { describe, expect, it } from 'vitest';
import {
  COMPLETION_THRESHOLD,
  DEFAULT_PREFS,
  READING_PREFS_SCRIPT,
  creditDay,
  currentStreak,
  daysReadInMonth,
  inProgress,
  localDateKey,
  longestStreak,
  normalisePrefs,
  planCounts,
  pushRecentSearch,
  recentDateKeys,
  recordProgress,
  resumePoint,
  trimHistory,
  uncreditDay,
  unmarkRead,
  type History,
} from '@/lib/reader-data';

const entry = { slug: '2026-10-11-righteousness', title: 'Righteousness', date: '2026-10-11', audience: 'adults' as const };

describe('streaks', () => {
  const days = { '2026-10-10': 1, '2026-10-11': 2, '2026-10-12': 1, '2026-10-14': 1, '2026-10-15': 1 };

  it('counts consecutive days ending today', () => {
    expect(currentStreak(days, '2026-10-15')).toBe(2);
  });

  it('keeps yesterday’s streak alive until the day is over', () => {
    expect(currentStreak({ '2026-10-13': 1, '2026-10-14': 1 }, '2026-10-15')).toBe(2);
    expect(currentStreak({ '2026-10-12': 1 }, '2026-10-15')).toBe(0);
  });

  it('finds the longest run, across month boundaries', () => {
    expect(longestStreak(days)).toBe(3);
    expect(longestStreak({ '2026-09-29': 1, '2026-09-30': 1, '2026-10-01': 1 })).toBe(3);
    expect(longestStreak({})).toBe(0);
  });

  it('counts days in a month and lists recent dates oldest first', () => {
    expect(daysReadInMonth(days, '2026-10')).toBe(5);
    expect(recentDateKeys('2026-10-02', 3)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('credits and un-credits a day', () => {
    expect(creditDay({ '2026-10-15': 1 }, '2026-10-15')).toEqual({ '2026-10-15': 2 });
    expect(uncreditDay({ '2026-10-15': 1 }, '2026-10-15')).toEqual({});
    expect(uncreditDay({ '2026-10-15': 2 }, '2026-10-15')).toEqual({ '2026-10-15': 1 });
  });

  it('uses the reader’s local calendar date', () => {
    expect(localDateKey(new Date(2026, 9, 15, 23, 59))).toBe('2026-10-15');
    expect(localDateKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});

describe('recordProgress', () => {
  it('only lets progress grow, while the position follows the reader', () => {
    let { history } = recordProgress({}, entry, { progress: 0.6, position: 0.5 }, 1000);
    ({ history } = recordProgress(history, entry, { progress: 0.3, position: 0.2 }, 2000));
    expect(history[entry.slug]).toMatchObject({ progress: 0.6, position: 0.2, firstReadAt: 1000, lastReadAt: 2000 });
    expect(history[entry.slug].completedAt).toBeUndefined();
  });

  it('finishes once at the threshold — and not twice', () => {
    const first = recordProgress({}, entry, { progress: COMPLETION_THRESHOLD }, 1000);
    expect(first.completedNow).toBe(true);
    const again = recordProgress(first.history, entry, { progress: 1 }, 5000);
    expect(again.completedNow).toBe(false);
    expect(again.history[entry.slug].completedAt).toBe(1000);
  });

  it('does not finish before the reader has had time to read (allowComplete: false)', () => {
    const early = recordProgress({}, entry, { progress: 1 }, 1000, { allowComplete: false });
    expect(early.completedNow).toBe(false);
    expect(early.history[entry.slug].completedAt).toBeUndefined();
  });

  it('marks as read explicitly, and can be undone', () => {
    const { history, completedNow } = recordProgress({}, entry, { progress: 0.1 }, 1000, { markRead: true });
    expect(completedNow).toBe(true);
    expect(history[entry.slug].progress).toBe(1);
    const undone = unmarkRead(history, entry.slug);
    expect(undone[entry.slug].completedAt).toBeUndefined();
    expect(undone[entry.slug].progress).toBeLessThan(COMPLETION_THRESHOLD);
  });

  it('offers a resume point only mid-article and only when unfinished', () => {
    const base = { ...entry, firstReadAt: 1, lastReadAt: 1, progress: 0.5 };
    expect(resumePoint({ ...base, position: 0.45 })).toBe(0.45);
    expect(resumePoint({ ...base, position: 0.02 })).toBeNull();
    expect(resumePoint({ ...base, position: 0.97 })).toBeNull();
    expect(resumePoint({ ...base, position: 0.45, completedAt: 2 })).toBeNull();
    expect(resumePoint(undefined)).toBeNull();
  });

  it('lists unfinished reading newest first and trims old history', () => {
    const history: History = {
      a: { ...entry, slug: 'a', firstReadAt: 1, lastReadAt: 10, progress: 0.5, position: 0.5 },
      b: { ...entry, slug: 'b', firstReadAt: 1, lastReadAt: 20, progress: 0.3, position: 0.3 },
      c: { ...entry, slug: 'c', firstReadAt: 1, lastReadAt: 30, progress: 1, position: 1, completedAt: 30 },
    };
    expect(inProgress(history).map((e) => e.slug)).toEqual(['b', 'a']);
    expect(Object.keys(trimHistory(history, 2)).sort()).toEqual(['b', 'c']);
  });
});

describe('preferences, plan and searches', () => {
  it('normalises stored preferences, rejecting anything unexpected', () => {
    expect(normalisePrefs({ size: 'xl', font: 'legible', leading: 'loose', width: 'wide', version: 'NKJV' })).toEqual({
      size: 'xl',
      font: 'legible',
      leading: 'loose',
      width: 'wide',
      version: 'NKJV',
    });
    expect(normalisePrefs({ size: 'huge', version: 'XYZ' })).toEqual(DEFAULT_PREFS);
    expect(normalisePrefs(null)).toEqual(DEFAULT_PREFS);
  });

  it('ships a pre-paint script that only ever sets known values', () => {
    expect(READING_PREFS_SCRIPT).toContain("localStorage.getItem('rhapsody.prefs.v1')");
    expect(READING_PREFS_SCRIPT).toContain('try{');
    expect(() => new Function(READING_PREFS_SCRIPT)).not.toThrow();
  });

  it('counts plan portions', () => {
    expect(planCounts({ a: { date: '1', one: 1 }, b: { date: '2', one: 2, two: 3 } })).toEqual({ one: 2, two: 1 });
  });

  it('keeps recent searches unique, newest first and capped', () => {
    let list: string[] = [];
    for (const term of ['grace', 'Holy Spirit', 'GRACE', 'x', ' love ', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6']) list = pushRecentSearch(list, term);
    expect(list[0]).toBe('a6');
    expect(list).toHaveLength(8);
    expect(list.filter((t) => t.toLowerCase() === 'grace')).toHaveLength(1);
    expect(list).not.toContain('x');
    expect(list).toContain('love');
  });
});
