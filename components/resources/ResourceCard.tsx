import Link from 'next/link';
import { BookOpen, CalendarDays, FileText, Headphones, ScanText } from 'lucide-react';
import type { ResourceSummary } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * One book, study or set of programme notes, as a card.
 *
 * The card carries the two things a reader decides on before opening: how long it is (a 191-page
 * book and a four-page study are different commitments) and whether its words were copied out of
 * the PDF or recognised from a scan. The second one is a promise the site makes everywhere it
 * publishes recognised text — see `/about`.
 */
export function ResourceCard({ resource, index = 0 }: { resource: ResourceSummary; index?: number }) {
  const meta = [
    resource.sourcePages ? `${resource.sourcePages} pages` : '',
    `${resource.words.toLocaleString()} words`,
    `${resource.readingMinutes} min read`,
    `${resource.listeningMinutes} min listen`,
  ].filter(Boolean);

  return (
    <Link
      href={`/resources/${resource.slug}`}
      className={cn(
        'group flex flex-col rounded-2xl border border-border/70 gradient-card p-6 shadow-soft',
        'hover:shadow-elegant hover:border-primary/40 hover:-translate-y-0.5 transition-all animate-fade-in'
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary font-medium">
          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" /> {resource.kindLabel}
        </span>
        {resource.recovered === 'ocr' && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground"
            title="This document is a scan: its words were read by a recogniser, not copied from the file."
          >
            <ScanText className="w-3 h-3" aria-hidden="true" /> Recognised
          </span>
        )}
      </div>

      <h3 className="mt-3 font-serif text-2xl font-semibold leading-tight group-hover:text-primary transition-colors text-balance">
        {resource.title}
      </h3>
      {resource.subtitle && <p className="mt-1.5 text-sm italic text-muted-foreground leading-snug">{resource.subtitle}</p>}

      <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">{resource.blurb}</p>

      <dl className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {meta.map((item, i) => (
          <span key={item} className="inline-flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">·</span>}
            {i === 0 && <FileText className="w-3 h-3" aria-hidden="true" />}
            {item}
          </span>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="truncate">{resource.author}</span>
        <span className="flex items-center gap-3 shrink-0">
          {resource.date ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3 h-3" aria-hidden="true" /> {formatDate(resource.date)}
            </span>
          ) : resource.year ? (
            <span>{resource.year}</span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            <Headphones className="w-3 h-3" aria-hidden="true" /> Listen
          </span>
        </span>
      </div>
    </Link>
  );
}
