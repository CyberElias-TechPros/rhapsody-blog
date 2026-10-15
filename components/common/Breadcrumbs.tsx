import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Crumb } from '@/lib/seo';
import { cn } from '@/lib/utils';

/**
 * "Home › Rhapsody of Realities October 2026 › Thursday, 15 October 2026". The visible trail;
 * pages emit the matching `BreadcrumbList` JSON-LD (`breadcrumbJsonLd`) next to their own
 * structured data, which is what lets search results show the path instead of a bare URL.
 */
export function Breadcrumbs({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm text-muted-foreground', className)} data-focus-hide="" data-print-hide="">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="inline-flex items-center gap-1.5 min-w-0">
              {index > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden="true" />}
              {last ? (
                <span aria-current="page" className="truncate text-foreground/80">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.path} className="truncate hover:text-primary transition-colors">
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
