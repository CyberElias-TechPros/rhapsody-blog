'use client';

/**
 * Keeps a page that says "today" honest after midnight.
 *
 * The home page is rendered per request (`export const dynamic = 'force-dynamic'`), so a fresh
 * load always shows the right day. But a devotional is often read from a tab left open overnight,
 * a phone that never reloads, or a kiosk — and for those the server render is a snapshot that
 * goes stale at midnight. This component watches the clock and asks the router for a new render
 * when the day turns over, so the hero changes without the reader doing anything.
 *
 * It renders nothing and touches nothing else: no state, no markup, no layout shift.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { msUntilNextMidnight, siteTimeZone, todayIso } from '@/lib/time';

/** A second past midnight, so the server has certainly turned the day over too. */
const GRACE_MS = 1_500;

export function DayRollover({ date }: { date: string }) {
  const router = useRouter();

  useEffect(() => {
    const zone = siteTimeZone();
    let timer: number | undefined;

    const stale = () => todayIso(new Date(), zone) !== date;
    const check = () => {
      if (stale()) router.refresh();
    };
    const arm = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        check();
        // Re-arm either way: if the refresh did not change the day (a deploy mid-render, a clock
        // that disagrees with the server), the watcher must not go quiet for the rest of the day.
        arm();
      }, msUntilNextMidnight(new Date(), zone) + GRACE_MS);
    };

    // A tab that has been backgrounded for days is already stale the moment it is looked at.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    check();
    arm();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [date, router]);

  return null;
}
