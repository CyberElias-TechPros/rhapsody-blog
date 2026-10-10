import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Accessible, *link-based* pagination: every page is a real URL (?page=n), so pages are
 * shareable, crawlable and work with the back button — and no client JavaScript is needed.
 */
/** A non-interactive arrow for the first/last page — not a link, so no `href` to invent. */
function DisabledArrow({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return (
    <span aria-disabled="true" aria-label={label} className={cn(className, 'pointer-events-none opacity-40 gap-1')}>
      {children}
    </span>
  );
}

export function Pagination({
  page,
  totalPages,
  hrefFor,
  className,
}: {
  page: number;
  totalPages: number;
  /** Builds the href for a page number, preserving the caller's other query params. */
  hrefFor: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const from = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let p = from; p < from + 5 && p <= totalPages; p += 1) pages.push(p);

  const base = buttonVariants({ variant: 'outline', size: 'sm' });

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1.5 flex-wrap', className)}>
      {page <= 1 ? (
        <DisabledArrow label="Previous page" className={base}>
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </DisabledArrow>
      ) : (
        <Link href={hrefFor(page - 1)} scroll={false} className={cn(base, 'gap-1')} aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}

      {from > 1 && (
        <Link href={hrefFor(1)} scroll={false} className={base} aria-label="Page 1">
          1
        </Link>
      )}
      {from > 2 && (
        <span className="text-muted-foreground px-1" aria-hidden="true">
          …
        </span>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={hrefFor(p)}
          scroll={false}
          aria-current={p === page ? 'page' : undefined}
          aria-label={`Page ${p}`}
          className={cn(buttonVariants({ variant: p === page ? 'default' : 'outline', size: 'sm' }))}
        >
          {p}
        </Link>
      ))}

      {from + 5 < totalPages && (
        <span className="text-muted-foreground px-1" aria-hidden="true">
          …
        </span>
      )}
      {from + 4 < totalPages && (
        <Link href={hrefFor(totalPages)} scroll={false} className={base} aria-label={`Last page, page ${totalPages}`}>
          {totalPages}
        </Link>
      )}

      {page >= totalPages ? (
        <DisabledArrow label="Next page" className={base}>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </DisabledArrow>
      ) : (
        <Link href={hrefFor(page + 1)} scroll={false} className={cn(base, 'gap-1')} aria-label="Next page">
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
