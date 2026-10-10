import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search as SearchIcon, X } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { PostCard } from '@/components/PostCard';
import { EmptyState, ErrorState, PageHeader, PostGridSkeleton } from '@/components/common/StateBlocks';
import { useSeo } from '@/hooks/useSeo';

const Search = () => {
  useSeo({ title: 'Search', description: 'Full-text search across every synced devotional, teaching, book excerpt and music spotlight.', path: '/search', noindex: true });
  const [params, setParams] = useSearchParams();
  const committed = (params.get('q') ?? '').trim();
  const [q, setQ] = useState(committed);

  // URL is the source of truth (shareable links, back button); sync local input to it.
  useEffect(() => setQ(committed), [committed]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = (params.get('q') ?? '') === q.trim() ? null : q.trim();
      const sp = new URLSearchParams(params);
      if (next) sp.set('q', next);
      else sp.delete('q');
      if (sp.toString() !== params.toString()) setParams(sp, { replace: true });
    }, 400);
    return () => window.clearTimeout(t);
  }, [q, params, setParams]);

  const searchQuery = useQuery({
    queryKey: queryKeys.posts({ q: committed || undefined, limit: 24, sort: 'new' }),
    queryFn: ({ signal }) => api.posts.list({ q: committed || undefined, limit: 24, sort: 'new' }, signal),
    enabled: committed.length > 0,
    placeholderData: keepPreviousData,
  });

  return (
    <div className="container py-16">
      <PageHeader title="Search" subtitle="Full-text search across titles, text and tags of every synced post." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const sp = new URLSearchParams(params);
          if (q.trim()) sp.set('q', q.trim());
          else sp.delete('q');
          setParams(sp);
        }}
        role="search"
        className="mt-8 relative max-w-2xl"
      >
        <label htmlFor="site-search" className="sr-only">Search query</label>
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" aria-hidden="true" />
        <input
          id="site-search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search devotionals, teachings, books..."
          className="w-full pl-12 pr-12 py-4 rounded-2xl bg-card border border-border text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-soft"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </form>

      <div className="mt-10" aria-live="polite">
        {!committed ? (
          <EmptyState title="Start typing to search" hint="Try “faith”, “renewed mind”, or a channel name." />
        ) : searchQuery.isPending ? (
          <PostGridSkeleton />
        ) : searchQuery.isError ? (
          <ErrorState error={searchQuery.error} onRetry={() => searchQuery.refetch()} />
        ) : searchQuery.data.items.length === 0 ? (
          <EmptyState
            title={`No results for “${committed}”`}
            hint="Check the spelling, or browse all posts instead."
            action={<Link to="/blog" className="text-primary underline underline-offset-4">Browse the blog</Link>}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              {searchQuery.data.total} result{searchQuery.data.total !== 1 && 's'} for “{committed}”
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchQuery.data.items.map((p, i) => (
                <PostCard key={p.id} post={p} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
