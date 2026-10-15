'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { BookOpen, CalendarDays, History, Search, SearchX, X } from 'lucide-react';
import { AdSlot } from '@/components/common/AdSlot';
import { AudienceBadge } from '@/components/common/AudienceBadge';
import { Button } from '@/components/ui/button';
import { AUDIENCES, AUDIENCE_ORDER, audienceOrNull, type AudienceId } from '@/lib/audiences';
import { formatDateShort } from '@/lib/format';
import { searchDocs, searchResourceDocs, type ResourceSearchDoc } from '@/lib/search';
import { cn } from '@/lib/utils';
import type { SearchDoc } from '@/lib/types';
import { useHydrated, useLocalStore } from '@/hooks/useLocalStore';
import { pushRecentSearch, searchesStore } from '@/lib/reader-data';

const SUGGESTIONS = ['righteousness', 'Holy Spirit', 'Romans', 'prayer', 'born again', 'covenant'];

function SearchInner({
  docs,
  resources = [],
  initialQuery,
}: {
  docs: SearchDoc[];
  resources?: ResourceSearchDoc[];
  initialQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL is the source of truth (?q=…); local state only makes typing feel instant.
  const urlQuery = searchParams.get('q') ?? '';
  const [value, setValue] = useState(urlQuery || initialQuery);

  // Back/forward changes `?q=`; adopt it during render rather than in an effect so the results
  // list and the input never disagree for a frame.
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setValue(urlQuery);
  }

  // Which audience to search within, again read from the URL so a filtered search is linkable.
  const urlAudience = audienceOrNull(searchParams.get('audience') ?? undefined);
  const audience: AudienceId | undefined = urlAudience ?? undefined;
  const searching = Boolean(value.trim());
  // Rank the whole library and scope afterwards, so the chips below can report what each edition
  // has to offer for this query instead of showing (0) for every edition you did not pick.
  const matches = useMemo(() => searchDocs(docs, value.trim()), [docs, value]);
  const results = useMemo(
    () => (audience ? matches.filter((match) => match.doc.audience === audience) : matches),
    [matches, audience]
  );
  const counts = useMemo(() => {
    const tally: Partial<Record<AudienceId, number>> = {};
    for (const doc of docs) tally[doc.audience] = (tally[doc.audience] ?? 0) + 1;
    if (searching) {
      const hits: Partial<Record<AudienceId, number>> = {};
      for (const match of matches) hits[match.doc.audience] = (hits[match.doc.audience] ?? 0) + 1;
      for (const id of Object.keys(tally) as AudienceId[]) tally[id] = hits[id] ?? 0;
    }
    return tally;
  }, [docs, matches, searching]);
  // The shelf is searched alongside the days: a query for "marriage" or "prophecy" is often a
  // book the reader is looking for, not a devotional.
  const resourceMatches = useMemo(() => searchResourceDocs(resources, value.trim()), [resources, value]);

  const countFor = (id: AudienceId | 'all') =>
    id === 'all' ? (searching ? matches.length : docs.length) : counts[id] ?? 0;

  const commitAudience = (next?: AudienceId) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set('audience', next);
    else sp.delete('audience');
    if (value.trim()) sp.set('q', value.trim());
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Recent searches live on the device, like everything else the reader does here.
  const recentSearches = useLocalStore(searchesStore);
  const hydrated = useHydrated();

  const commit = (term: string) => {
    const q = term.trim();
    if (q) searchesStore.update((list) => pushRecentSearch(list, q));
    const sp = new URLSearchParams(searchParams.toString());
    if (q) sp.set('q', q);
    else sp.delete('q');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    commit(value);
  };

  return (
    <div>
      <form onSubmit={onSubmit} role="search" className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="search-input" className="sr-only">
          Search devotionals
        </label>
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="search-input"
            type="search"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            placeholder="Righteousness, Holy Spirit, Romans 6, 2026-10-01…"
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-card border border-border text-base shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <Button type="submit" size="lg" className="gradient-hero text-primary-foreground border-0 shrink-0">
          Search
        </Button>
      </form>

      {hydrated && recentSearches.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <History className="w-3.5 h-3.5" aria-hidden="true" /> Recent:
          </span>
          {recentSearches.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => {
                setValue(term);
                commit(term);
              }}
              className="px-2.5 py-1 rounded-full border border-border hover:border-primary/40 hover:text-primary transition-colors"
            >
              {term}
            </button>
          ))}
          <button
            type="button"
            onClick={() => searchesStore.clear()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full hover:text-destructive"
            aria-label="Clear recent searches"
          >
            <X className="w-3 h-3" aria-hidden="true" /> Clear
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Try:</span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setValue(suggestion);
              commit(suggestion);
            }}
            className="px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/70 hover:text-primary transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <nav
        aria-label="Search within an audience"
        className="mt-4 flex flex-wrap items-center gap-2 text-xs"
      >
        <AudienceChip active={!audience} onClick={() => commitAudience(undefined)} count={countFor('all')}>
          All readers
        </AudienceChip>
        {AUDIENCE_ORDER.map((id) => (
          <AudienceChip key={id} active={audience === id} onClick={() => commitAudience(id)} count={countFor(id)} title={AUDIENCES[id].blurb}>
            {AUDIENCES[id].label}
          </AudienceChip>
        ))}
      </nav>

      <div className="mt-10" aria-live="polite">
        {!value.trim() ? (
          <p className="text-muted-foreground text-sm">
            {docs.length} devotionals indexed{audience ? ` (${counts[audience] ?? 0} in ${AUDIENCES[audience].label.toLowerCase()})` : ''}{' '}
            — start typing to search titles, articles, prayers and scripture references.
          </p>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-secondary text-muted-foreground">
              <SearchX className="w-6 h-6" aria-hidden="true" />
            </div>
            <p className="font-serif text-xl font-semibold">No devotionals match “{value.trim()}”</p>
            <p className="text-sm text-muted-foreground max-w-md">
              {resourceMatches.length > 0 ? (
                <>
                  {resourceMatches.length === 1 ? 'A book or resource below does' : 'The books and resources below do'}{' '}
                  — and you can try one word instead of a phrase, or{' '}
                </>
              ) : (
                <>Try one word instead of a phrase, a book of the Bible, or </>
              )}
              <Link href="/devotionals" className="text-primary hover:underline">
                browse the whole library
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              {results.length} result{results.length === 1 ? '' : 's'} for “{value.trim()}”
              {audience ? ` (${AUDIENCES[audience].label.toLowerCase()})` : ''}
            </p>
            <ol className="grid gap-3">
              {results.map(({ doc, matchedOn }) => (
                <li key={doc.slug}>
                  <Link
                    href={`/devotionals/${doc.slug}`}
                    className="group block rounded-2xl border border-border/70 bg-card p-5 hover:border-primary/40 hover:shadow-soft transition-all"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 text-primary font-medium uppercase tracking-wider">
                        <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                        {doc.weekday} {formatDateShort(doc.date)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{doc.editionTitle}</span>
                      <AudienceBadge audience={doc.audience} />
                      {doc.scriptureReference && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{doc.scriptureReference}</span>
                        </>
                      )}
                      <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        matched in {matchedOn}
                      </span>
                    </div>
                    <h2 className="mt-2 font-serif text-2xl font-semibold leading-snug text-balance group-hover:text-primary transition-colors">
                      {doc.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{doc.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ol>

            {/* Only alongside results — never on an empty or "no matches" screen. */}
            <AdSlot position="feed" className="mt-8" minHeight={120} />
          </>
        )}
      </div>

      {searching && resourceMatches.length > 0 && (
        <section aria-labelledby="resource-results" className="mt-14">
          <h2 id="resource-results" className="flex items-center gap-2 font-serif text-2xl font-semibold">
            <BookOpen className="w-5 h-5 text-primary" aria-hidden="true" /> Books and resources
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Matched on title, subject and summary — open one to search inside it.
          </p>
          <ol className="mt-5 grid gap-3">
            {resourceMatches.map(({ doc, matchedOn }) => (
              <li key={doc.slug}>
                <Link
                  href={`/resources/${doc.slug}`}
                  className="group block rounded-2xl border border-border/70 bg-card p-5 hover:border-primary/40 hover:shadow-soft transition-all"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 text-primary font-medium uppercase tracking-wider">
                      <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                      {doc.kindLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{doc.author}</span>
                    <span aria-hidden="true">·</span>
                    <span>{doc.words.toLocaleString()} words</span>
                    <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                      matched in {matchedOn}
                    </span>
                  </div>
                  <h3 className="mt-2 font-serif text-2xl font-semibold leading-snug text-balance group-hover:text-primary transition-colors">
                    {doc.title}
                  </h3>
                  {doc.subtitle && <p className="mt-1 text-sm italic text-muted-foreground">{doc.subtitle}</p>}
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{doc.blurb}</p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function AudienceChip({
  active,
  onClick,
  count,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors',
        active
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border/70 text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
      <span className="opacity-70 tabular-nums">({count})</span>
    </button>
  );
}

export function SearchClient(props: { docs: SearchDoc[]; resources?: ResourceSearchDoc[]; initialQuery: string }) {
  return (
    // useSearchParams needs a Suspense boundary when the page is prerendered.
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading search…</div>}>
      <SearchInner {...props} />
    </Suspense>
  );
}
