'use client';

/**
 * The returning reader's strip on the home page: the reading streak, the devotional they left
 * half-read, and this month's tally. Renders nothing for a first-time visitor (no layout shift
 * for them, and nothing pretending to know a reader it has never seen).
 */

import Link from 'next/link';
import { BookOpenCheck, Flame, PlayCircle } from 'lucide-react';
import { useLocalStore, useLocalToday } from '@/hooks/useLocalStore';
import { currentStreak, daysReadInMonth, daysStore, historyStore, inProgress } from '@/lib/reader-data';

export function ContinueReading() {
  const today = useLocalToday();
  const history = useLocalStore(historyStore);
  const days = useLocalStore(daysStore);
  if (!today) return null;

  const streak = currentStreak(days, today);
  const month = daysReadInMonth(days, today.slice(0, 7));
  const resume = inProgress(history, 1)[0];
  if (!resume && !streak && !month) return null;

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 animate-fade-in" aria-label="Your reading">
      {streak > 0 && (
        <Link
          href="/me"
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm hover:border-primary/40 transition-colors"
        >
          <Flame className="w-4 h-4 text-orange-500" aria-hidden="true" />
          <span>
            <strong className="font-semibold">{streak}</strong>-day streak
            {days[today] ? '' : ' — read today to keep it'}
          </span>
        </Link>
      )}
      {month > 0 && (
        <Link
          href="/me"
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm hover:border-primary/40 transition-colors"
        >
          <BookOpenCheck className="w-4 h-4 text-primary" aria-hidden="true" />
          {month} {month === 1 ? 'day' : 'days'} read this month
        </Link>
      )}
      {resume && (
        <Link
          href={`/devotionals/${resume.slug}`}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/15 transition-colors"
        >
          <PlayCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            Continue “{resume.title}” · {Math.round(resume.progress * 100)}%
          </span>
        </Link>
      )}
    </div>
  );
}
