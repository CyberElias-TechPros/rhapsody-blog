'use client';

/**
 * Tick off a day's Bible-reading-plan portion. Progress is kept per printed day (the devotional's
 * slug), so the 1-year and 2-year plans can be followed independently; /me and /reading-plans
 * show the running totals.
 */

import { Check } from 'lucide-react';
import { useHydrated, useLocalStore } from '@/hooks/useLocalStore';
import { planStore } from '@/lib/reader-data';
import { cn } from '@/lib/utils';

export function PlanCheck({
  slug,
  date,
  which,
  portion,
  className,
}: {
  slug: string;
  date: string;
  which: 'one' | 'two';
  /** The passage, for the accessible label ("Mark 1 Kings 9 as read"). */
  portion: string;
  className?: string;
}) {
  const plan = useLocalStore(planStore);
  const hydrated = useHydrated();
  const done = hydrated && Boolean(plan[slug]?.[which]);

  const toggle = () => {
    planStore.update((all) => {
      const mark = { ...(all[slug] ?? { date }) };
      if (mark[which]) delete mark[which];
      else mark[which] = Date.now();
      if (!mark.one && !mark.two) {
        const { [slug]: _removed, ...rest } = all;
        return rest;
      }
      return { ...all, [slug]: mark };
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={done}
      aria-label={`${done ? 'Unmark' : 'Mark'} ${portion} as read (${which === 'one' ? '1-year' : '2-year'} plan)`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        done
          ? 'border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary',
        className
      )}
      data-print-hide=""
    >
      <Check className={cn('w-3.5 h-3.5', done ? 'opacity-100' : 'opacity-50')} aria-hidden="true" />
      {done ? 'Read' : 'Mark read'}
    </button>
  );
}
