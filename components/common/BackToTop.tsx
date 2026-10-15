'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Appears after a couple of screens of scrolling; bottom-left, clear of the player and toasts. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      setVisible(window.scrollY > window.innerHeight * 2);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('main')?.focus({ preventScroll: true });
      }}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      data-print-hide=""
      data-focus-hide=""
      className={cn(
        'fixed bottom-5 left-5 z-30 grid h-11 w-11 place-items-center rounded-full border border-border bg-background/90 text-foreground shadow-soft backdrop-blur transition-all hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        visible ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3'
      )}
    >
      <ArrowUp className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}
