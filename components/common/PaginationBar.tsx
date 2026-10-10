'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Accessible pagination with windowed page buttons. Driven by URL state from callers
 * (`page` query param) so links are shareable and the back button behaves.
 */
export function PaginationBar({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  const from = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let p = from; p < from + 5 && p <= totalPages; p++) pages.push(p);

  const goto = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    if (next !== page) {
      onPageChange(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav aria-label="Pagination" className={`flex items-center justify-center gap-1.5 flex-wrap ${className ?? ''}`}>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goto(page - 1)} aria-label="Previous page">
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </Button>
      {from > 1 && (
        <Button variant="ghost" size="sm" onClick={() => goto(1)} aria-label="First page">
          1
        </Button>
      )}
      {from > 2 && <span className="text-muted-foreground px-1" aria-hidden="true">…</span>}
      {pages.map((p) => (
        <Button
          key={p}
          variant={p === page ? 'default' : 'outline'}
          size="sm"
          onClick={() => goto(p)}
          aria-current={p === page ? 'page' : undefined}
          aria-label={`Page ${p}`}
        >
          {p}
        </Button>
      ))}
      {from + 5 < totalPages && <span className="text-muted-foreground px-1" aria-hidden="true">…</span>}
      {from + 4 < totalPages && (
        <Button variant="ghost" size="sm" onClick={() => goto(totalPages)} aria-label={`Last page ${totalPages}`}>
          {totalPages}
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goto(page + 1)} aria-label="Next page">
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
