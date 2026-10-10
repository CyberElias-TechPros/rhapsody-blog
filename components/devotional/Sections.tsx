import { BookMarked, BookOpen, HandHeart, Layers } from 'lucide-react';
import type { Devotional } from '@/lib/types';

/**
 * The closing sections of a daily devotional, rendered as cards rather than plain Markdown so
 * they read the way the printed edition does: scripture first, then the article, then the
 * prayer/confession, further study and the two Bible reading plans.
 */

export function ScriptureCard({ text, reference }: { text: string; reference?: string }) {
  if (!text) return null;
  return (
    <figure className="mt-10">
      <figcaption className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-3">
        <BookMarked className="w-3.5 h-3.5" aria-hidden="true" /> Opening scripture
      </figcaption>
      <blockquote className="scripture-card">
        <p>{text}</p>
        {reference && (
          <footer className="mt-3 not-italic font-sans text-sm text-muted-foreground">— {reference}</footer>
        )}
      </blockquote>
    </figure>
  );
}

export function ClosingCard({ label, text }: { label: Devotional['prayerLabel']; text: string }) {
  if (!text) return null;
  return (
    <section aria-labelledby="closing-heading" className="mt-12">
      <h2
        id="closing-heading"
        className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-3 font-sans"
      >
        <HandHeart className="w-3.5 h-3.5" aria-hidden="true" /> {label}
      </h2>
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5">
        <p className="font-serif text-lg italic leading-relaxed text-foreground/90">{text}</p>
      </div>
    </section>
  );
}

export function FurtherStudyCard({ references }: { references: string }) {
  if (!references) return null;
  return (
    <section aria-labelledby="further-study-heading" className="mt-6">
      <h2
        id="further-study-heading"
        className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-3 font-sans"
      >
        <BookOpen className="w-3.5 h-3.5" aria-hidden="true" /> Further study
      </h2>
      <p className="rounded-2xl border border-border/70 bg-card px-6 py-4 text-base leading-relaxed">{references}</p>
    </section>
  );
}

export function ReadingPlansCard({ oneYear, twoYear }: { oneYear: string; twoYear: string }) {
  if (!oneYear && !twoYear) return null;
  return (
    <section aria-labelledby="reading-plans-heading" className="mt-6">
      <h2
        id="reading-plans-heading"
        className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-3 font-sans"
      >
        <Layers className="w-3.5 h-3.5" aria-hidden="true" /> Bible reading plans
      </h2>
      <dl className="grid sm:grid-cols-2 gap-3">
        {oneYear && (
          <div className="rounded-2xl border border-border/70 bg-card px-5 py-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium">1-Year plan</dt>
            <dd className="mt-1.5 text-base font-medium leading-snug">{oneYear}</dd>
          </div>
        )}
        {twoYear && (
          <div className="rounded-2xl border border-border/70 bg-card px-5 py-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium">2-Year plan</dt>
            <dd className="mt-1.5 text-base font-medium leading-snug">{twoYear}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
