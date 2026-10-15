'use client';

/**
 * One month as a calendar, every day linking to its devotional. Days the reader has finished get
 * a tick (from their local history), today is ringed, and days still to come are marked —
 * readable ahead, because the printed edition is too.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CheckCircle2, CornerDownLeft } from 'lucide-react';
import { useHydrated, useLocalStore } from '@/hooks/useLocalStore';
import { historyStore } from '@/lib/reader-data';
import { cn } from '@/lib/utils';

export interface CalendarCell {
  date: string;
  slug: string;
  title: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarGrid({ month, days, today }: { month: string; days: CalendarCell[]; today: string }) {
  const history = useLocalStore(historyStore);
  const hydrated = useHydrated();
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const offset = first.getUTCDay();
  const byDate = new Map(days.map((day) => [day.date, day]));
  const cells: Array<{ day: number; date: string } | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, date: `${month}-${String(day).padStart(2, '0')}` };
    }),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground" aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-2">
            {weekday}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Days of the month">
        {cells.map((cell, index) => {
          if (!cell) return <li key={`blank-${index}`} aria-hidden="true" />;
          const entry = byDate.get(cell.date);
          const read = hydrated && entry ? Boolean(history[entry.slug]?.completedAt) : false;
          const opened = hydrated && entry ? Boolean(history[entry.slug]) : false;
          const isToday = cell.date === today;
          const upcoming = cell.date > today;
          if (!entry) {
            return (
              <li key={cell.date} className="min-h-[4.5rem] sm:min-h-[6.5rem] rounded-xl border border-dashed border-border/60 p-2 text-left text-xs text-muted-foreground/60">
                {cell.day}
              </li>
            );
          }
          return (
            <li key={cell.date}>
              <Link
                href={`/devotionals/${entry.slug}`}
                title={entry.title}
                className={cn(
                  'group flex h-full min-h-[4.5rem] sm:min-h-[6.5rem] flex-col rounded-xl border p-2 text-left transition-all hover:border-primary/50 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  isToday ? 'border-primary bg-primary/10 ring-1 ring-primary/40' : 'border-border/70 bg-card',
                  upcoming && 'opacity-80'
                )}
              >
                <span className="flex items-center justify-between">
                  <span className={cn('text-sm font-semibold', isToday && 'text-primary')}>{cell.day}</span>
                  {read ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500" aria-label="Read" />
                  ) : opened ? (
                    <span className="h-2 w-2 rounded-full bg-primary/60" aria-label="Started" />
                  ) : null}
                </span>
                <span className="mt-1 hidden sm:block text-xs leading-snug text-muted-foreground group-hover:text-foreground line-clamp-3">
                  {entry.title}
                </span>
                <span className="sr-only">
                  {entry.title}
                  {isToday ? ' (today)' : ''}
                  {read ? ' — read' : ''}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "Go to a date": any day, in the chosen edition, via `/go/[date]`. */
export function DateJump({ audience, defaultDate, min, max }: { audience: string; defaultDate: string; min: string; max: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultDate);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!value) return;
    router.push(`/go/${value}${audience === 'adults' ? '' : `?audience=${audience}`}`);
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2" aria-label="Go to a date">
      <label htmlFor="date-jump" className="text-sm font-medium">
        Go to a date
      </label>
      <input
        id="date-jump"
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        Open <CornerDownLeft className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}
