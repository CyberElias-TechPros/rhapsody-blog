import Link from 'next/link';
import type { Metadata } from 'next';
import { Fragment } from 'react';
import { DevotionalCard } from '@/components/DevotionalCard';
import { AdSlot } from '@/components/common/AdSlot';
import { FEED_AD_EVERY } from '@/lib/ads';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, PageHeader } from '@/components/common/StateBlocks';
import { Button } from '@/components/ui/button';
import { getEditions, queryDevotionals } from '@/lib/content';
import { SITE } from '@/lib/site';
import type { DevotionalSort } from '@/lib/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: 'All devotionals',
  description: `Every daily devotional published on ${SITE.name} — newest first, filterable by edition and searchable.`,
  alternates: { canonical: '/devotionals' },
};

type Search = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export default async function DevotionalsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const edition = one(params.edition);
  const q = one(params.q);
  const sort = (one(params.sort) as DevotionalSort) ?? 'new';
  const page = Math.max(1, Number.parseInt(one(params.page) ?? '1', 10) || 1);

  const result = queryDevotionals({ edition, q, sort, page, limit: PAGE_SIZE });
  const editions = getEditions();
  const activeEdition = editions.find((e) => e.slug === edition);

  const hrefFor = (overrides: Partial<{ edition?: string; q?: string; sort: string; page: number }>) => {
    const sp = new URLSearchParams();
    const nextEdition = 'edition' in overrides ? overrides.edition : edition;
    const nextQ = 'q' in overrides ? overrides.q : q;
    const nextSort = overrides.sort ?? sort;
    const nextPage = overrides.page ?? 1;
    if (nextEdition) sp.set('edition', nextEdition);
    if (nextQ) sp.set('q', nextQ);
    if (nextSort !== 'new') sp.set('sort', nextSort);
    if (nextPage > 1) sp.set('page', String(nextPage));
    const qs = sp.toString();
    return qs ? `/devotionals?${qs}` : '/devotionals';
  };

  return (
    <div className="container py-16 md:py-20">
      <PageHeader
        eyebrow={activeEdition ? activeEdition.title : 'The library'}
        title={activeEdition ? `${activeEdition.postCount} devotionals` : 'Every daily devotional'}
        subtitle={
          activeEdition
            ? `The complete ${activeEdition.title} edition — one article for each day of the month.`
            : `${SITE.series} by ${SITE.author}, published here one day at a time. ${result.total} articles and counting.`
        }
      />

      {/* Filters — plain links and a GET form, so the listing works and is crawlable without JS. */}
      <div className="mt-10 flex flex-col lg:flex-row lg:items-center gap-4 lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={hrefFor({ edition: undefined, page: 1 })}
            aria-current={!edition ? 'true' : undefined}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              !edition ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            All editions
          </Link>
          {editions.map((e) => (
            <Link
              key={e.slug}
              href={hrefFor({ edition: e.slug, page: 1 })}
              aria-current={edition === e.slug ? 'true' : undefined}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                edition === e.slug
                  ? 'border-primary/40 bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {e.title} <span className="opacity-70">({e.postCount})</span>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form action="/devotionals" method="get" role="search" className="flex items-center gap-2">
            {edition && <input type="hidden" name="edition" value={edition} />}
            {sort !== 'new' && <input type="hidden" name="sort" value={sort} />}
            <label htmlFor="q" className="sr-only">
              Search devotionals
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q ?? ''}
              placeholder="Filter by word, title or scripture…"
              className="px-3 py-2 rounded-full bg-secondary/70 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button type="submit" size="sm" variant="secondary">
              Apply
            </Button>
          </form>

          <div className="flex items-center gap-1" role="group" aria-label="Sort order">
            {(
              [
                { value: 'new', label: 'Newest' },
                { value: 'old', label: 'Oldest' },
              ] as const
            ).map((option) => (
              <Link
                key={option.value}
                href={hrefFor({ sort: option.value, page: 1 })}
                aria-current={sort === option.value ? 'true' : undefined}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  sort === option.value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
        {q ? (
          <>
            {result.total} result{result.total === 1 ? '' : 's'} for “{q}”
            {activeEdition ? ` in ${activeEdition.title}` : ''} —{' '}
            <Link href={hrefFor({ q: undefined, page: 1 })} className="text-primary hover:underline">
              clear
            </Link>
          </>
        ) : (
          <>
            Showing {result.items.length} of {result.total} devotionals
            {activeEdition ? ` in ${activeEdition.title}` : ''}
          </>
        )}
      </p>

      <div className="mt-8">
        {result.items.length === 0 ? (
          <EmptyState
            title={q ? 'No devotionals match that search' : 'No devotionals here yet'}
            hint={
              q
                ? 'Try a shorter phrase, a book of the Bible (e.g. “Romans”), or clear the filters.'
                : 'Add a monthly edition PDF to the repository root and run `npm run content:extract`.'
            }
            action={
              q || edition ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/devotionals">Clear filters</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {result.items.map((post, i) => (
              <Fragment key={post.slug}>
                <DevotionalCard post={post} index={i} />
                {/* In-feed units: the natural rhythm of a 12-card page, full-width so a card
                    never gets squeezed beside an ad. */}
                {(i + 1) % FEED_AD_EVERY === 0 && (
                  <AdSlot position="feed" format="fluid" className="md:col-span-2 lg:col-span-3" />
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(p) => hrefFor({ page: p })}
        className="mt-14"
      />
    </div>
  );
}
