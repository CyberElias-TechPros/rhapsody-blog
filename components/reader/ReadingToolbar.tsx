'use client';

/**
 * The tools that sit under a devotional's headline: reading settings ("Aa"), focus mode, mark as
 * read and print. Each works without an account or a network connection.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Circle, Maximize2, Minimize2, Printer, Type, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ReadingSettingsPanel } from '@/components/reader/ReadingSettingsPanel';
import { useHydrated, useLocalStore } from '@/hooks/useLocalStore';
import { markAsRead, markAsUnread, type TrackedDevotional } from '@/lib/reader-actions';
import { historyStore } from '@/lib/reader-data';
import { cn } from '@/lib/utils';

/** "Aa": a non-modal panel, so the text behind it re-flows live as settings change. */
export function ReadingSettingsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        data-shortcut="settings"
        title="Reading settings (text size, font, theme)"
      >
        <Type className="w-4 h-4 mr-1.5" aria-hidden="true" /> Aa
      </Button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Reading settings"
          className="absolute left-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-border bg-popover p-5 shadow-elegant animate-scale-in"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="font-serif text-lg font-semibold">Reading settings</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Close reading settings"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <ReadingSettingsPanel />
        </div>
      )}
    </div>
  );
}

/** Focus mode hides everything but the article; Esc or the floating button brings it back. */
export function FocusModeButton() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (on) root.dataset.focus = 'on';
    else delete root.dataset.focus;
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOn(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      delete root.dataset.focus;
    };
  }, [on]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={on}
        onClick={() => setOn((value) => !value)}
        data-shortcut="focus"
        title="Focus mode — hide everything but the devotional (F)"
      >
        <Maximize2 className="w-4 h-4 mr-1.5" aria-hidden="true" /> Focus
      </Button>
      {on && (
        <button
          type="button"
          onClick={() => setOn(false)}
          className="fixed top-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 text-sm shadow-soft backdrop-blur hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          data-print-hide=""
        >
          <Minimize2 className="w-4 h-4" aria-hidden="true" /> Exit focus
        </button>
      )}
    </>
  );
}

export function MarkReadButton({ entry }: { entry: TrackedDevotional }) {
  const history = useLocalStore(historyStore);
  const hydrated = useHydrated();
  const done = hydrated && Boolean(history[entry.slug]?.completedAt);

  const toggle = () => {
    if (done) {
      markAsUnread(entry.slug);
      toast('Marked as unread');
      return;
    }
    const streak = markAsRead(entry);
    toast.success('Marked as read', {
      description: streak > 1 ? `${streak}-day reading streak — keep going!` : 'Your reading streak has started.',
    });
  };

  return (
    <Button
      type="button"
      variant={done ? 'secondary' : 'outline'}
      size="sm"
      onClick={toggle}
      aria-pressed={done}
      data-shortcut="read"
      title={done ? 'Mark as unread' : 'Mark as read (counts toward your streak)'}
    >
      {done ? (
        <CheckCircle2 className="w-4 h-4 mr-1.5 text-green-600 dark:text-green-500" aria-hidden="true" />
      ) : (
        <Circle className="w-4 h-4 mr-1.5" aria-hidden="true" />
      )}
      {done ? 'Read' : 'Mark as read'}
    </Button>
  );
}

export function PrintButton() {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => window.print()} title="Print or save as PDF">
      <Printer className="w-4 h-4 mr-1.5" aria-hidden="true" /> Print
    </Button>
  );
}

export function ReadingToolbar({ entry }: { entry: TrackedDevotional }) {
  return (
    <div role="toolbar" aria-label="Reading tools" className="flex flex-wrap items-center gap-2">
      <ReadingSettingsButton />
      <FocusModeButton />
      <MarkReadButton entry={entry} />
      <PrintButton />
    </div>
  );
}
