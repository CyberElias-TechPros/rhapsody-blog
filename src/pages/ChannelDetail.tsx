import { useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Rss, UserCheck2, UserPlus2 } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { useAuth } from '@/auth/AuthProvider';
import { useFollows, useBookmarkIds, useBookmarkToggle } from '@/hooks/useBookmarks';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/PostCard';
import { EmptyState, ErrorState, PostGridSkeleton } from '@/components/common/StateBlocks';
import { PaginationBar } from '@/components/common/PaginationBar';
import { useSeo } from '@/hooks/useSeo';
import { timeAgo } from '@/lib/format';

const PAGE_SIZE = 12;

const ChannelDetail = () => {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const { user } = useAuth();
  const { isFollowing, toggle: toggleFollow, pending: followPending } = useFollows();

  const channelQuery = useQuery({
    queryKey: queryKeys.channel(slug),
    queryFn: ({ signal }) => api.channels.get(slug, signal),
    staleTime: 5 * 60_000,
  });
  const postsQuery = useQuery({
    queryKey: queryKeys.posts({ channel: slug, page, limit: PAGE_SIZE }),
    queryFn: ({ signal }) => api.posts.list({ channel: slug, page, limit: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });

  const channel = channelQuery.data?.channel;
  useSeo(
    channel
      ? { title: channel.name, description: channel.description, path: `/channels/${channel.slug}` }
      : { title: 'Channel', noindex: true }
  );

  const setPage = useCallback(
    (p: number) => {
      const next = new URLSearchParams(params);
      if (p <= 1) next.delete('page');
      else next.set('page', String(p));
      setParams(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [params, setParams]
  );

  const bookmarkIds = useBookmarkIds();
  const { toggle: toggleBookmark } = useBookmarkToggle();

  if (channelQuery.isPending) {
    return (
      <div aria-busy="true">
        <div className="h-64 bg-secondary animate-pulse" />
        <div className="container py-16 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-56 rounded-2xl bg-secondary animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (channelQuery.isError || !channel) {
    const is404 = channelQuery.error instanceof Error && 'status' in channelQuery.error && (channelQuery.error as { status?: number }).status === 404;
    return (
      <div className="container py-32 text-center">
        <h1 className="font-serif text-4xl mb-4">{is404 ? 'Channel not found' : 'Channel unavailable'}</h1>
        <p className="text-muted-foreground mb-8">{is404 ? 'This channel may have been retired.' : 'Try again in a moment.'}</p>
        <Button asChild><Link to="/channels">All channels</Link></Button>
      </div>
    );
  }

  const following = isFollowing(channel.slug);

  return (
    <div className="pb-24">
      <section className={`bg-gradient-to-br ${channel.accent} text-white`}>
        <div className="container py-20 max-w-4xl mx-auto">
          <Link to="/channels" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 mb-6 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> All channels
          </Link>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="font-serif text-5xl md:text-6xl font-semibold text-balance leading-[1.05]"
          >
            {channel.name}
          </motion.h1>
          <p className="mt-4 text-lg md:text-xl opacity-90 max-w-2xl">{channel.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm opacity-90">
            <span>{channel.postCount} published posts</span>
            {channel.lastSyncedAt && <span aria-live="polite">· updated {timeAgo(channel.lastSyncedAt)}</span>}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <a href={channel.telegramUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" /> View on Telegram
              </a>
            </Button>
            {user ? (
              <Button variant="outline" disabled={followPending} onClick={() => toggleFollow(channel.slug)} aria-pressed={following}>
                {following ? <UserCheck2 className="w-4 h-4 mr-2" aria-hidden="true" /> : <UserPlus2 className="w-4 h-4 mr-2" aria-hidden="true" />}
                {following ? 'Following' : 'Follow'}
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to={`/login?next=${encodeURIComponent(`/channels/${channel.slug}`)}`}>
                  <Rss className="w-4 h-4 mr-2" aria-hidden="true" /> Sign in to follow
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="container py-16" aria-label={`Posts from ${channel.name}`}>
        <h2 className="font-serif text-3xl font-semibold mb-8">{postsQuery.data ? `${postsQuery.data.total} posts` : 'Posts'}</h2>
        {postsQuery.isPending && <PostGridSkeleton />}
        {postsQuery.isError && <ErrorState error={postsQuery.error} onRetry={() => postsQuery.refetch()} />}
        {postsQuery.isSuccess && postsQuery.data.items.length === 0 && (
          <EmptyState title="No posts synced yet" hint="New Telegram messages become posts here automatically, within ~15 minutes." />
        )}
        {postsQuery.isSuccess && postsQuery.data.items.length > 0 && (
          <div className={`grid md:grid-cols-2 lg:grid-cols-3 gap-6 ${postsQuery.isPlaceholderData ? 'opacity-60' : ''}`}>
            {postsQuery.data.items.map((p, i) => (
              <PostCard
                key={p.id}
                post={p}
                index={i}
                bookmarked={bookmarkIds.has(p.id)}
                onToggleBookmark={(post) => toggleBookmark(post.id, bookmarkIds.has(post.id))}
              />
            ))}
          </div>
        )}
        {postsQuery.isSuccess && (
          <PaginationBar page={page} totalPages={postsQuery.data.totalPages} onPageChange={setPage} className="mt-12" />
        )}
      </section>
    </div>
  );
};

export default ChannelDetail;
