'use client';

/**
 * Silent bookkeeping for one devotional, plus the progress bar at the top of the window.
 *
 * - Records the visit (for "Recently read" and "Continue reading").
 * - Offers to resume from where the reader stopped last time.
 * - Marks the devotional finished when the reader reaches its end — but only after they have
 *   been on the page long enough to have read it, so a short article that fits on screen is not
 *   "finished" the moment it opens. Finishing credits the day toward the reading streak.
 *
 * Everything is stored on the device (`lib/reader-data.ts`); nothing is sent anywhere.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { historyStore, resumePoint } from '@/lib/reader-data';
import { trackProgress, type TrackedDevotional } from '@/lib/reader-actions';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function ReadingTracker({
  slug,
  title,
  date,
  audience,
  targetId,
  readingMinutes,
}: TrackedDevotional & {
  /** Element whose scroll extent counts as "the devotional". */
  targetId: string;
  readingMinutes: number;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = document.getElementById(targetId);
    if (!element) return;
    const current: TrackedDevotional = { slug, title, date, audience };
    const openedAt = Date.now();
    // A quarter of the estimated reading time, at least 15 seconds and at most 75.
    const minDwell = Math.min(75_000, Math.max(15_000, readingMinutes * 60_000 * 0.25));

    const previous = historyStore.read()[current.slug];
    const resumeAt = resumePoint(previous);
    trackProgress(current, { progress: previous?.progress ?? 0, position: previous?.position ?? 0 }, { allowComplete: false });

    const scrollToFraction = (fraction: number) => {
      const top = element.getBoundingClientRect().top + window.scrollY + element.offsetHeight * fraction - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };
    if (resumeAt !== null) {
      toast('Continue where you left off?', {
        description: `You were ${Math.round(resumeAt * 100)}% of the way through.`,
        action: { label: 'Resume', onClick: () => scrollToFraction(resumeAt) },
        duration: 9000,
      });
    }

    let frame = 0;
    let lastSaved = 0;
    let latest = { progress: previous?.progress ?? 0, position: previous?.position ?? 0 };
    let finished = Boolean(previous?.completedAt);

    const save = () => {
      const streak = trackProgress(current, latest, { allowComplete: Date.now() - openedAt >= minDwell });
      if (streak !== null && !finished) {
        finished = true;
        toast.success('Finished — well done!', {
          description: streak > 1 ? `That’s a ${streak}-day reading streak.` : 'Your reading streak has started.',
          duration: 4500,
        });
      }
    };

    const measure = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const height = Math.max(1, rect.height);
      const seen = clamp01((window.innerHeight - rect.top) / height);
      const position = clamp01((96 - rect.top) / height);
      latest = { progress: Math.max(latest.progress, seen), position };
      setProgress(seen);
      const now = Date.now();
      if (now - lastSaved > 1500) {
        lastSaved = now;
        save();
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    // Re-check once the minimum dwell has passed: a reader who reached the end early and then
    // stopped scrolling should still get the credit.
    const dwellTimer = window.setTimeout(() => {
      if (latest.progress >= 0.9) save();
    }, minDwell + 250);

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(dwellTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [targetId, readingMinutes, slug, title, date, audience]);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[3px] pointer-events-none" aria-hidden="true" data-print-hide="">
      <div
        className="h-full bg-gradient-to-r from-primary to-primary-glow transition-[width] duration-150 ease-out"
        style={{ width: `${Math.round(progress * 1000) / 10}%` }}
      />
    </div>
  );
}
