import Image from 'next/image';
import Link from 'next/link';
import { Images, ScanText, Sparkles, Type } from 'lucide-react';
import { KIND_LABELS, SOURCE_NOTES, type KidsIssueSummary, type KidsPage } from '@/lib/kids';
import { cn } from '@/lib/utils';

/**
 * The pieces of the kids' magazine reader: an issue card for the index, one page (image plus
 * recovered words) for the issue, and the badge that says where a page's words came from.
 *
 * Nothing here pretends a magazine page is an article. The page image is the content; the words
 * underneath it are a courtesy for reading aloud, and a reader is told which of the two is exact.
 */

export function KidsIssueCard({ issue, className }: { issue: KidsIssueSummary; className?: string }) {
  return (
    <Link
      href={`/kids/${issue.slug}`}
      className={cn(
        'group flex gap-4 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40',
        className
      )}
    >
      <span className="relative block w-24 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-secondary aspect-[3/4]">
        {issue.cover ? (
          <Image
            src={issue.cover}
            alt={`The cover of ${issue.title}`}
            fill
            sizes="96px"
            className="object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block font-serif text-lg font-semibold leading-snug group-hover:text-primary">{issue.title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {issue.pageCount} pages
          {issue.recognisedPages > 0 ? ` · ${issue.recognisedPages} read off the artwork` : ''}
        </span>
        {issue.keyVerse ? (
          <span className="mt-2 block text-sm leading-snug text-muted-foreground line-clamp-2">{issue.keyVerse}</span>
        ) : (
          <span className="mt-2 block text-sm leading-snug text-muted-foreground line-clamp-2">{issue.excerpt}</span>
        )}
      </span>
    </Link>
  );
}

/** Where a page's words came from — printed text, OCR, or nothing recoverable. */
export function KidsSourceBadge({ page, className }: { page: KidsPage; className?: string }) {
  const icon = page.recovered === 'ocr' ? ScanText : page.recovered === 'none' ? Images : Type;
  const Icon = icon;
  const label =
    page.recovered === 'ocr'
      ? `Recognised by OCR${page.confidence ? ` · ${Math.round(page.confidence)}%` : ''}`
      : page.recovered === 'none'
        ? 'Artwork only'
        : 'Printed text';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wider',
        page.recovered === 'ocr' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-secondary text-muted-foreground',
        className
      )}
      title={SOURCE_NOTES[page.recovered]}
    >
      <Icon className="h-3 w-3" aria-hidden="true" /> {label}
    </span>
  );
}

/** One page of the issue: the printed page, then whatever words were read off it. */
export function KidsPageSpread({ page, artworkMissing = false }: { page: KidsPage; artworkMissing?: boolean }) {
  const label = KIND_LABELS[page.kind];
  const showLabel = page.kind !== 'page' && page.kind !== 'artwork';
  return (
    <li id={`page-${page.number}`} className="scroll-mt-24">
      <article className="rounded-3xl border border-border/70 bg-card/40 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h3 className="flex items-center gap-2 font-serif text-base font-semibold">
            <span className="text-muted-foreground">Page {page.number}</span>
            {showLabel ? (
              <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3" aria-hidden="true" /> {label}
              </span>
            ) : null}
          </h3>
          <span className="flex items-center gap-1.5">
            {artworkMissing ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground"
                title="The pictures on this page could not be decoded out of the PDF; this is the page without its artwork."
              >
                <Images className="h-3 w-3" aria-hidden="true" /> Artwork not rendered
              </span>
            ) : null}
            <KidsSourceBadge page={page} />
          </span>
        </header>

        <Link
          href={page.image}
          target="_blank"
          rel="noopener"
          className="relative mt-4 block overflow-hidden rounded-2xl border border-border/60 bg-secondary aspect-[3/4] max-w-md"
          title="Open the printed page full size"
        >
          <Image src={page.image} alt={`Page ${page.number} of the magazine`} fill sizes="(min-width: 768px) 448px, 100vw" className="object-contain" />
        </Link>

        {page.text ? (
          <div className="mt-5 space-y-3 text-[0.95rem] leading-relaxed">
            {page.text.split('\n').map((line, index) => (
              <p key={index} className={page.kind === 'activity' || page.kind === 'contents' ? 'font-mono text-sm' : undefined}>
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm italic text-muted-foreground">{SOURCE_NOTES[page.recovered]}</p>
        )}
      </article>
    </li>
  );
}

/** The one paragraph a reader needs before a magazine of pictures: what this is, and what OCR did. */
export function KidsOcrNote({
  pages,
  recognised,
  textless,
  artworkIssues = 0,
  className,
}: {
  pages: number;
  recognised: number;
  textless: number;
  /** How many of the issues being described lost their artwork to the renderer. */
  artworkIssues?: number;
  className?: string;
}) {
  if (!recognised && !textless && !artworkIssues) return null;
  return (
    <aside className={cn('mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed', className)}>
      <p className="flex items-center gap-2 font-semibold">
        <ScanText className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" /> How this section was made
      </p>
      <p className="mt-2 text-muted-foreground">
        The kids&rsquo; edition is drawn, not typeset, so {recognised} of these {pages} pages have words that a recogniser read off the
        artwork, and {textless} have no words to read at all. Recognised text has not been checked by hand — where it looks
        wrong, the page above it is the source of truth. The page images are stored small on purpose; the printed page opens
        full size when you click it.
      </p>
      {artworkIssues > 0 ? (
        <p className="mt-2 text-muted-foreground">
          In {artworkIssues === 1 ? 'this issue' : `${artworkIssues} of these issues`} the page images lost their artwork: the pictures in
          those PDFs are stored in a format the renderer here cannot decode, so they come out as words on a white page. The text is
          unaffected, and the PDF is the reference for how the page looked.
        </p>
      ) : null}
    </aside>
  );
}

/** Page numbers as anchors, so an issue of 50 pages can be jumped into. */
export function KidsPageStrip({ pages }: { pages: KidsPage[] }) {
  return (
    <nav aria-label="Pages of this issue" className="mt-8 flex flex-wrap gap-1.5">
      {pages.map((page) => (
        <a
          key={page.number}
          href={`#page-${page.number}`}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg border text-xs transition-colors',
            page.text ? 'border-border/70 hover:border-primary/50 hover:text-primary' : 'border-dashed border-border/60 text-muted-foreground'
          )}
          title={page.excerpt ?? KIND_LABELS[page.kind]}
        >
          {page.number}
        </a>
      ))}
    </nav>
  );
}
