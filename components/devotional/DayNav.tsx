import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { formatDayHeading } from '@/lib/format';
import type { DevotionalSummary } from '@/lib/types';

/** Yesterday / tomorrow links — the natural way to move through a daily devotional. */
export function DayNav({ previous, next }: { previous?: DevotionalSummary; next?: DevotionalSummary }) {
  if (!previous && !next) return null;

  const card = (post: DevotionalSummary, direction: 'previous' | 'next') => (
    <Link
      href={`/devotionals/${post.slug}`}
      rel={direction === 'previous' ? 'prev' : 'next'}
      data-shortcut={direction === 'previous' ? 'prev' : 'next'}
      aria-keyshortcuts={direction === 'previous' ? 'ArrowLeft' : 'ArrowRight'}
      className={`group flex-1 rounded-2xl border border-border/70 bg-card px-5 py-4 transition-all hover:border-primary/40 hover:shadow-soft ${
        direction === 'next' ? 'text-right' : ''
      }`}
    >
      <span
        className={`flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors ${
          direction === 'next' ? 'justify-end' : ''
        }`}
      >
        {direction === 'previous' && <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />}
        {direction === 'previous' ? 'Previous day' : 'Next day'}
        {direction === 'next' && <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
      </span>
      <span className="mt-1.5 block font-serif text-lg font-semibold leading-snug text-balance group-hover:text-primary transition-colors">
        {post.title}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{formatDayHeading(post.date)}</span>
    </Link>
  );

  return (
    <nav aria-label="Devotional navigation" className="mt-14 flex flex-col sm:flex-row gap-3">
      {previous ? card(previous, 'previous') : <span className="flex-1" aria-hidden="true" />}
      {next ? card(next, 'next') : <span className="flex-1" aria-hidden="true" />}
    </nav>
  );
}
