/**
 * The reader's actions, as functions over the local stores. Components call these; the rules
 * themselves are the pure functions in `lib/reader-data.ts`.
 */

import {
  creditDay,
  currentStreak,
  daysStore,
  historyStore,
  localDateKey,
  recordProgress,
  uncreditDay,
  unmarkRead,
  type HistoryEntry,
} from '@/lib/reader-data';

export type TrackedDevotional = Pick<HistoryEntry, 'slug' | 'title' | 'date' | 'audience'>;

/** Save progress; returns the streak when this update finished the devotional, else `null`. */
export function trackProgress(
  entry: TrackedDevotional,
  reading: { progress: number; position?: number },
  options: { allowComplete?: boolean } = {}
): number | null {
  const now = Date.now();
  const { history, completedNow } = recordProgress(historyStore.read(), entry, reading, now, options);
  historyStore.write(history);
  if (!completedNow) return null;
  const today = localDateKey(now);
  const days = creditDay(daysStore.read(), today);
  daysStore.write(days);
  return currentStreak(days, today);
}

/** "Mark as read": finishes the devotional now; returns the streak. */
export function markAsRead(entry: TrackedDevotional): number {
  const now = Date.now();
  const previous = historyStore.read()[entry.slug];
  const { history, completedNow } = recordProgress(
    historyStore.read(),
    entry,
    { progress: 1, position: previous?.position ?? 0 },
    now,
    { markRead: true }
  );
  historyStore.write(history);
  const today = localDateKey(now);
  const days = completedNow ? creditDay(daysStore.read(), today) : daysStore.read();
  if (completedNow) daysStore.write(days);
  return currentStreak(days, today);
}

/** "Mark as unread": forgets the completion, and today's credit if it was earned today. */
export function markAsUnread(slug: string): void {
  const previous = historyStore.read()[slug];
  historyStore.update((history) => unmarkRead(history, slug));
  if (previous?.completedAt) {
    const day = localDateKey(previous.completedAt);
    if (day === localDateKey(Date.now())) daysStore.update((days) => uncreditDay(days, day));
  }
}
