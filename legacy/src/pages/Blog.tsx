import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { queryKeys, useChannels } from '@/lib/queries';
import { PostCard } from '@/components/PostCard';
import { EmptyState, ErrorState, PageHeader, PostGridSkeleton } from '@/components/common/StateBlocks';
import { PaginationBar } from '@/components/common/PaginationBar';
import { useBookmarkIds, useBookmarkToggle } from '@/hooks/useBookmarks';
import { useSeo } from '@/hooks/useSeo';
import type { PostSort } from '@/lib/types';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatCount } from '@/lib/format';

const PAGE_SIZE = 12;
const SORTS: { value: PostSort; label: string }[] = [
  { value: 'new', label: 'Newest' },
  { value: 'old', label: 'Oldest' },
  { value: 'popular', label: 'Most read' },
];

const Blog = () => {
  useSeo({
    title: 'The Blog',
    description: 'Browse devotionals, teachings, book excerpts and music spotlights — automatically synced from Telegram.',
    path: '/blog',
  });
  const [params, setParams] = useSearchParams();
  const channel = params.get('channel') ?? '';
  const sort = (params.get('sort') as PostSort) || 'new';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const channelsQuery = useChannels();
  const listQuery = useQuery({
    queryKey: queryKeys.posts({ channel: channel || undefined, sort, page, limit: PAGE_SIZE }),
    queryFn: ({ signal }) => api.posts.list({ channel: channel || undefined, sort, page, limit: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });

  const updateParams = useCallback(
    (next: Record<string, string | null>) => {
      const merged = new URLSearchParams(params);
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === '') merged.delete(k);
        else merged.set(k, v);
      }
      if (!('page' in next)) merged.delete('page');
      setParams(merged, { replace: false });
    },
    [params, setParams]
  );

  const bookmarkIds = useBookmarkIds();
  const { toggle } = useBookmarkToggle();
  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  return (
    <div className="container py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <PageHeader
          eyebrow="The Blog"
          title="Every word, archived & searchable."
          subtitle={
            <>
              Browse devotionals, teachings, book excerpts and music spotlights — automatically synced from Telegram.{' '}
              {listQuery.data && <span className="text-sm">({formatCount(listQuery.data.total)} posts)</span>}
              {' '}<Link to="/search" className="text-primary hover:underline">or use search</Link>.
            </>
          }
        />
      </motion.div>

      <div className="mt-10 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filter and sort posts">
        <button
          onClick={() => updateParams({ channel: null, page: null })}
          aria-pressed={!channel}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            !channel ? 'bg-primary text-primary-foreground shadow-soft' : 'bg-secondary hover:bg-secondary/70'
          }`}
        >
          All
        </button>
        {(channelsQuery.data?.channels ?? []).map((c) => (
          <button
            key={c.slug}
            onClick={() => updateParams({ channel: c.slug === channel ? null : c.slug, page: null })}
            aria-pressed={channel === c.slug}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              channel === c.slug ? 'bg-primary text-primary-foreground shadow-soft' : 'bg-secondary hover:bg-secondary/70'
            }`}
          >
            {c.name}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1" role="group" aria-label="Sort order">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => updateParams({ sort: s.value === sort ? null : s.value, page: null })}
              aria-pressed={sort === s.value}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                sort === s.value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </span>
      </div>

      <div className="mt-10">
        {listQuery.isPending && <PostGridSkeleton />}
        {listQuery.isError && <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />}
        {listQuery.isSuccess && items.length === 0 && (
          <EmptyState
            title={channel ? 'No posts yet for this channel' : 'No posts yet'}
            hint={channel ? 'The sync runs automatically every 15 minutes — new Telegram messages appear here shortly.' : 'Once the first sync completes, posts will appear here.'}
            action={channel ? <Button asChild variant="outline" size="sm"><Link to="/blog">Clear filter</Link></Button> : undefined}
          />
        )}
        {listQuery.isSuccess && items.length > 0 && (
          <div className={`grid md:grid-cols-2 lg:grid-cols-3 gap-6 ${listQuery.isPlaceholderData ? 'opacity-60' : ''}`}>
            {items.map((p, i) => (
              <PostCard
                key={p.id}
                post={p}
                index={i}
                bookmarked={bookmarkIds.has(p.id)}
                onToggleBookmark={(post) => toggle(post.id, bookmarkIds.has(post.id))}
              />
            ))}
          </div>
        )}
      </div>

      {listQuery.isSuccess && (
        <PaginationBar page={page} totalPages={listQuery.data.totalPages} onPageChange={(p) => updateParams({ page: String(p) })} className="mt-14" />
      )}
    </div>
  );
};

export default Blog;
