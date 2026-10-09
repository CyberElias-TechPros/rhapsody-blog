import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Bookmark, BookmarkCheck, Check, Clock, ExternalLink, Eye, Link2, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/PostCard';
import { ErrorState } from '@/components/common/StateBlocks';
import { Prose } from '@/components/Prose';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { useAuth } from '@/auth/AuthProvider';
import { useBookmarkIds, useBookmarkToggle } from '@/hooks/useBookmarks';
import { useSeo } from '@/hooks/useSeo';
import { formatDate, formatCount } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

const ReadingSkeleton = () => (
  <div className="container max-w-3xl pt-12" aria-busy="true" aria-label="Loading article">
    <Skeleton className="h-4 w-24 mb-8" />
    <Skeleton className="h-4 w-32 mb-4" />
    <Skeleton className="h-14 w-full mb-3" />
    <Skeleton className="h-14 w-2/3 mb-6" />
    <div className="flex gap-4 mb-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-24" />
    </div>
    {Array.from({ length: 6 }, (_, i) => (
      <Skeleton key={i} className={`h-4 mb-3 ${i % 3 === 2 ? 'w-4/5' : 'w-full'}`} />
    ))}
  </div>
);

const PostDetail = () => {
  const { channelSlug = '', slug = '' } = useParams();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.post(channelSlug, slug),
    queryFn: ({ signal }) => api.posts.get(channelSlug, slug, signal),
    staleTime: 5 * 60_000,
  });
  const data = query.data;
  const post = data?.post;

  useSeo(
    post
      ? { title: post.title, description: post.excerpt, path: `/blog/${post.channelSlug}/${post.slug}` }
      : { title: 'Article', noindex: true }
  );

  const bookmarkIds = useBookmarkIds();
  const { toggle } = useBookmarkToggle();
  const bookmarked = useMemo(() => !!post && bookmarkIds.has(post.id), [post, bookmarkIds]);

  if (query.isPending) return <ReadingSkeleton />;
  if (!data || !post || !query.isSuccess) {
    return (
      <div className="container py-32 text-center">
        {query.error instanceof ApiError && query.error.isNotFound ? (
          <>
            <h1 className="font-serif text-4xl mb-4">Post not found</h1>
            <p className="text-muted-foreground mb-8">It may have been moved, unpublished, or the link is mistyped.</p>
            <Button asChild><Link to="/blog">Back to blog</Link></Button>
          </>
        ) : (
          <ErrorState error={query.error ?? new Error('not found')} onRetry={() => query.refetch()} />
        )}
      </div>
    );
  }

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: post.excerpt, url });
        return;
      }
    } catch {
      return; // user dismissed the native sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <article className="pb-24">
      <div className="container max-w-3xl pt-12">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to blog
        </Link>

        <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to={`/channels/${post.channelSlug}`} className="text-sm uppercase tracking-wider text-primary font-medium hover:underline">
            {post.channelName}
          </Link>
          <h1 className="font-serif text-4xl md:text-6xl font-semibold leading-[1.1] tracking-tight mt-3 text-balance">
            {post.title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" aria-hidden="true" /> {post.readingMinutes} min read</span>
            <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" aria-hidden="true" /> {formatCount(post.views)} views</span>
          </div>
        </motion.header>

        {post.coverUrl && (
          <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="mt-10 rounded-2xl overflow-hidden border border-border/60 shadow-soft">
            <img src={post.coverUrl} alt="" loading="eager" className="w-full max-h-[420px] object-cover" onError={(e) => ((e.target as HTMLImageElement).closest('div')!.style.display = 'none')} />
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="mt-12">
          <Prose content={post.content} />
        </motion.div>

        <div className="mt-12 flex flex-wrap items-center gap-3 pt-8 border-t border-border">
          {post.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Tags">
              {post.tags.map((t) => (
                <li key={t}>
                  <Link to={`/search?q=${encodeURIComponent(t)}`} className="px-3 py-1 rounded-full bg-secondary text-xs hover:bg-secondary/70 hover:text-primary transition-colors">
                    #{t}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={post.telegramUrl} target="_blank" rel="noopener noreferrer" title="View the original on Telegram">
                <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" /> Telegram
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={share}>
              {copied ? <Check className="w-4 h-4 mr-2 text-green-600" aria-hidden="true" /> : <Share2 className="w-4 h-4 mr-2" aria-hidden="true" />}
              {copied ? 'Copied!' : 'Share'}
            </Button>
            {user && (
              <Button variant={bookmarked ? 'default' : 'outline'} size="sm" onClick={() => toggle(post.id, bookmarked)} aria-pressed={bookmarked}>
                {bookmarked ? <BookmarkCheck className="w-4 h-4 mr-2" aria-hidden="true" /> : <Bookmark className="w-4 h-4 mr-2" aria-hidden="true" />}
                {bookmarked ? 'Saved' : 'Save'}
              </Button>
            )}
          </div>
        </div>
        {!user && (
          <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4" aria-hidden="true" />
            <Link to={`/login?next=${encodeURIComponent(`/blog/${post.channelSlug}/${post.slug}`)}`} className="text-primary hover:underline">
              Sign in
            </Link>
            to save this to your library.
          </p>
        )}
      </div>

      {data.related.length > 0 && (
        <section className="container max-w-6xl mt-24">
          <h2 className="font-serif text-3xl font-semibold mb-8">More from {post.channelName}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {data.related.map((p, i) => (
              <PostCard key={p.id} post={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
};

export default PostDetail;
