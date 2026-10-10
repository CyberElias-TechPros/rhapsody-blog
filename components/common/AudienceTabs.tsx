import Link from 'next/link';
import type { ReactNode } from 'react';
import { AUDIENCES, AUDIENCE_ORDER, type AudienceId } from '@/lib/audiences';
import { cn } from '@/lib/utils';

/**
 * The audience switcher used above a listing (`/devotionals`, `/editions`).
 *
 * Plain links with the selection carried in the query string, so a listing is filterable — and
 * crawlable — without a line of client JavaScript. `counts` is what the corpus actually holds for
 * each audience; an audience with nothing in it is still listed (its tab reads 0) so the switcher
 * never changes shape between two pages.
 */
export function AudienceTabs({
  active,
  counts,
  hrefFor,
  label = 'Choose who this is for',
}: {
  active: AudienceId | 'all';
  counts: Partial<Record<AudienceId, number>>;
  hrefFor: (audience: AudienceId | 'all') => string;
  label?: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <Tab href={hrefFor('all')} active={active === 'all'} title="Every audience in one list">
        All readers
        <Count value={AUDIENCE_ORDER.reduce((sum, id) => sum + (counts[id] ?? 0), 0)} />
      </Tab>
      {AUDIENCE_ORDER.map((id) => (
        <Tab key={id} href={hrefFor(id)} active={active === id} title={AUDIENCES[id].blurb}>
          {AUDIENCES[id].label}
          <Count value={counts[id] ?? 0} />
        </Tab>
      ))}
    </nav>
  );
}

function Tab({
  href,
  active,
  title,
  children,
}: {
  href: string;
  active: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        active
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/30'
      )}
    >
      {children}
    </Link>
  );
}

function Count({ value }: { value: number }) {
  return <span className="opacity-70 tabular-nums">({value})</span>;
}
