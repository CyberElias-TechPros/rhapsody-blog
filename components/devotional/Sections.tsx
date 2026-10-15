import { BookMarked, BookOpen, HandHeart, Layers, Megaphone } from 'lucide-react';
import { PlanCheck } from '@/components/reader/PlanCheck';
import { ScriptureText } from '@/components/reader/ScriptureText';
import type { Devotional, DevotionalSection } from '@/lib/types';

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
          <footer className="mt-3 not-italic font-sans text-sm text-muted-foreground">
            — <ScriptureText text={reference} />
          </footer>
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
        <p className="reading-text font-serif text-lg italic leading-relaxed text-foreground/90">{text}</p>
      </div>
    </section>
  );
}

/**
 * The sections an audience prints that the adult edition has no card for — the teens edition's
 * `Speak` (what to say out loud) and `Act` (what to do today). They are rendered in the order the
 * page prints them, under the prayer, with the heading the edition itself uses.
 */
export function ExtraSectionCard({ section }: { section: DevotionalSection }) {
  const icon = /^act$/i.test(section.label) ? HandHeart : Megaphone;
  const Icon = icon;
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-3 font-sans">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {section.label.toLowerCase()}
      </h2>
      <p className="reading-text rounded-2xl border border-border/70 bg-card px-6 py-4 text-base leading-relaxed">{section.text}</p>
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
      <p className="reading-text rounded-2xl border border-border/70 bg-card px-6 py-4 text-base leading-relaxed">
        <ScriptureText text={references} />
      </p>
    </section>
  );
}

export function ReadingPlansCard({
  oneYear,
  twoYear,
  slug,
  date,
}: {
  oneYear: string;
  twoYear: string;
  /** With a slug, each portion gets a "mark read" toggle that feeds the plan tracker. */
  slug?: string;
  date?: string;
}) {
  if (!oneYear && !twoYear) return null;
  const portion = (label: string, text: string, which: 'one' | 'two') => (
    <div className="rounded-2xl border border-border/70 bg-card px-5 py-4">
      <dt className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
        {slug && date ? <PlanCheck slug={slug} date={date} which={which} portion={text} /> : null}
      </dt>
      <dd className="mt-1.5 text-base font-medium leading-snug">
        <ScriptureText text={text} />
      </dd>
    </div>
  );
  return (
    <section aria-labelledby="reading-plans-heading" className="mt-6">
      <h2
        id="reading-plans-heading"
        className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-3 font-sans"
      >
        <Layers className="w-3.5 h-3.5" aria-hidden="true" /> Bible reading plans
      </h2>
      <dl className="grid sm:grid-cols-2 gap-3">
        {oneYear && portion('1-Year plan', oneYear, 'one')}
        {twoYear && portion('2-Year plan', twoYear, 'two')}
      </dl>
    </section>
  );
}
