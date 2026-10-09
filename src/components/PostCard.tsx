import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Bookmark, BookmarkCheck, Clock } from 'lucide-react';
import { formatDateShort, formatCount } from '@/lib/format';
import type { PostListItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PostCardProps {
  post: PostListItem;
  index?: number;
  /** When provided, renders the quick bookmark toggle (list screens). */
  bookmarked?: boolean;
  onToggleBookmark?: (post: PostListItem) => void;
  className?: string;
}

export const PostCard = ({ post, index = 0, bookmarked, onToggleBookmark, className }: PostCardProps) => (
  <motion.article
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-50px' }}
    transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.05, ease: [0.22, 1, 0.36, 1] }}
    className={cn('group h-full', className)}
  >
    <div className="relative h-full gradient-card rounded-2xl border border-border/60 hover:border-primary/40 transition-all hover:shadow-elegant">
      {post.coverUrl && (
        <div className="aspect-[16/7] overflow-hidden rounded-t-2xl">
          <img
            src={post.coverUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            onError={(e) => ((e.target as HTMLImageElement).parentElement!.style.display = 'none')}
          />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider font-medium text-primary">{post.channelName}</span>
          {onToggleBookmark && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleBookmark(post);
              }}
              aria-label={bookmarked ? `Remove “${post.title}” from bookmarks` : `Bookmark “${post.title}”`}
              aria-pressed={!!bookmarked}
              className={cn(
                'relative z-10 grid place-items-center w-8 h-8 -mr-2 rounded-full transition-colors',
                bookmarked ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-secondary'
              )}
            >
              {bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
          )}
          <ArrowUpRight
            className={cn('w-4 h-4 text-muted-foreground group-hover:text-primary transition-all', !onToggleBookmark && 'group-hover:-translate-y-0.5 group-hover:translate-x-0.5')}
            aria-hidden="true"
          />
        </div>
        <h3 className="font-serif text-2xl font-semibold leading-tight text-balance mb-3 group-hover:text-primary transition-colors">
          <Link to={`/blog/${post.channelSlug}/${post.slug}`} className="focus-visible:outline-none after:absolute after:inset-0 after:content-['']">
            {post.title}
          </Link>
        </h3>
        <p className="text-muted-foreground line-clamp-3 mb-5">{post.excerpt}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <time dateTime={post.publishedAt}>{formatDateShort(post.publishedAt)}</time>
          <span className="flex items-center gap-1.5" title={`${formatCount(post.views)} views`}>
            <Clock className="w-3 h-3" aria-hidden="true" /> {post.readingMinutes} min read
          </span>
        </div>
      </div>
    </div>
  </motion.article>
);
