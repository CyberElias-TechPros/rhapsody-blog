'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Search, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateShort } from '@/lib/format';
import { searchDocs } from '@/lib/search';
import type { SearchDoc } from '@/lib/types';

const SUGGESTIONS = ['righteousness', 'Holy Spirit', 'Romans', 'prayer', 'born again', 'covenant'];

function SearchInner({ docs, initialQuery }: { docs: SearchDoc[]; initialQuery: string }) {
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

  const results = useMemo(() => searchDocs(docs, value.trim()), [docs, value]);

  const commit = (term: string) => {
    const q = term.trim();
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

      <div className="mt-10" aria-live="polite">
        {!value.trim() ? (
          <p className="text-muted-foreground text-sm">
            {docs.length} devotionals indexed — start typing to search titles, articles, prayers and scripture
            references.
          </p>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-secondary text-muted-foreground">
              <SearchX className="w-6 h-6" aria-hidden="true" />
            </div>
            <p className="font-serif text-xl font-semibold">No devotionals match “{value.trim()}”</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Try one word instead of a phrase, a book of the Bible, or{' '}
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
          </>
        )}
      </div>
    </div>
  );
}

export function SearchClient(props: { docs: SearchDoc[]; initialQuery: string }) {
  return (
    // useSearchParams needs a Suspense boundary when the page is prerendered.
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading search…</div>}>
      <SearchInner {...props} />
    </Suspense>
  );
}
