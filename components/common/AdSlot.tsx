'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT, AD_SLOTS, ADS_ENABLED, type AdPosition } from '@/lib/ads';
import { cn } from '@/lib/utils';

/**
 * A hand-placed AdSense unit.
 *
 * The element is the standard `ins.adsbygoogle` from Google's snippet; the `push({})` that asks
 * AdSense to fill it runs once per element in an effect (pushing twice for the same node throws
 * "All ins elements already have ads", which StrictMode's double-mount would otherwise trigger).
 * The queue exists before the loader script arrives, so ordering between this and `AdScript`
 * doesn't matter.
 *
 * Three rules shape it:
 * - **No slot id, no render.** Positions can ship before the ad units are created in AdSense;
 *   an unconfigured slot renders nothing rather than an empty box.
 * - **Height is reserved** so a filling ad doesn't push the reading plans or the next-day links
 *   down the page (Core Web Vitals, and it stops mis-clicks).
 * - **Never inside the devotional.** Callers place these around the article, not between the
 *   scripture and the prayer.
 */
export function AdSlot({
  position,
  slot,
  className,
  minHeight = 90,
  format = 'auto',
  label = true,
}: {
  /** Which configured slot id to use (see `AD_SLOTS` in `lib/ads.ts`). */
  position: AdPosition;
  /** Overrides `AD_SLOTS[position]` — handy for a one-off unit. */
  slot?: string;
  className?: string;
  minHeight?: number;
  /** `auto` lets AdSense pick; `fluid` suits in-feed positions between cards. */
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  label?: boolean;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const ins = useRef<HTMLModElement>(null);
  const id = slot ?? AD_SLOTS[position];

  useEffect(() => {
    if (!id) return;
    const element = ins.current;
    if (!element || element.dataset.adProcessed === 'true') return;
    element.dataset.adProcessed = 'true';
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Blocked, already filled, or the loader never arrived — collapse instead of showing a gap.
      element.dataset.adFailed = 'true';
      if (wrapper.current) wrapper.current.hidden = true;
    }
  }, [id]);

  if (!ADS_ENABLED || !id) return null;

  return (
    <div
      ref={wrapper}
      // `ad-slot` lets focus mode and print hide every unit without knowing where they are.
      className={cn('ad-slot w-full', className)}
      style={{ minHeight }}
      aria-label="Advertisement"
      data-focus-hide=""
    >
      {label && (
        <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 select-none">
          Advertisement
        </p>
      )}
      <ins
        ref={ins}
        className="adsbygoogle block"
        style={{ display: 'block', minHeight }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={id}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
