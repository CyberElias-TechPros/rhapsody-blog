'use client';

/**
 * "My notes" under a devotional — a thought, a prayer, a confession to come back to. Autosaves
 * as the reader types, on this device only; every note is listed on /me and included in the
 * data export.
 */

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, Copy, NotebookPen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useHydrated, useLocalStore } from '@/hooks/useLocalStore';
import { NOTE_MAX_LENGTH, notesStore } from '@/lib/reader-data';

export function NotesCard({ slug, title, date }: { slug: string; title: string; date: string }) {
  const notes = useLocalStore(notesStore);
  const hydrated = useHydrated();
  const saved = notes[slug];
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<number | undefined>(undefined);
  const fieldId = useId();
  const value = draft ?? saved?.text ?? '';

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const persist = (text: string) => {
    notesStore.update((all) => {
      if (!text.trim()) {
        const { [slug]: _removed, ...rest } = all;
        return rest;
      }
      return { ...all, [slug]: { slug, title, date, text: text.slice(0, NOTE_MAX_LENGTH), updatedAt: Date.now() } };
    });
    setStatus('saved');
  };

  const onChange = (text: string) => {
    setDraft(text);
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => persist(text), 600);
  };

  const remove = () => {
    if (!window.confirm('Delete your note for this devotional?')) return;
    window.clearTimeout(timer.current);
    setDraft('');
    persist('');
    setStatus('idle');
    toast('Note deleted');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${value}`);
      toast.success('Note copied');
    } catch {
      toast.error('Could not copy — select the text and copy it instead.');
    }
  };

  const updated = saved?.updatedAt
    ? new Date(saved.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <section aria-labelledby={`${fieldId}-heading`} className="mt-10 rounded-2xl border border-border/70 bg-card px-6 py-5" data-print-hide="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${fieldId}-heading`} className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold font-sans">
          <NotebookPen className="w-3.5 h-3.5" aria-hidden="true" /> My notes
        </h2>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {status === 'saving' ? 'Saving…' : status === 'saved' || (hydrated && updated) ? (
            <span className="inline-flex items-center gap-1">
              <Check className="w-3 h-3" aria-hidden="true" /> Saved on this device{updated ? ` · ${updated}` : ''}
            </span>
          ) : (
            'Private — stays on this device'
          )}
        </p>
      </div>
      <label htmlFor={fieldId} className="sr-only">
        Your notes on “{title}”
      </label>
      <textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (draft !== null && status === 'saving') {
            window.clearTimeout(timer.current);
            persist(draft);
          }
        }}
        maxLength={NOTE_MAX_LENGTH}
        rows={value ? Math.min(12, Math.max(4, value.split('\n').length + 1)) : 3}
        placeholder="What is the Word saying to you today? Write a thought, a prayer or a confession to remember…"
        className="mt-3 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-base leading-relaxed placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Link href="/me#notes" className="text-xs text-primary hover:underline">
          All my notes →
        </Link>
        {value.trim() && (
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={copy}>
              <Copy className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> Copy
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> Delete
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
