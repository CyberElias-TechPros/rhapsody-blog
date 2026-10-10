import Link from 'next/link';
import { ArrowUpRight, BookMarked, CalendarDays, Clock } from 'lucide-react';
import { SaveButton } from '@/components/devotional/SaveButton';
import { AudienceBadge } from '@/components/common/AudienceBadge';
import { formatDateShort } from '@/lib/format';
import type { DevotionalSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Card for a daily devotional in any list (home, /devotionals, an edition archive, search).
 * Server component: the only client island is the save toggle.
 */
export function DevotionalCard({
  post,
  index = 0,
  className,
  compact = false,
}: {
  post: DevotionalSummary;
  index?: number;
  className?: string;
  compact?: boolean;
}) {
  const href = `/devotionals/${post.slug}`;

  return (
    <article
      className={cn('group h-full animate-fade-in', className)}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms`, animationFillMode: 'backwards' }}
    >
      <div className="relative h-full gradient-card rounded-2xl border border-border/60 hover:border-primary/40 transition-all hover:shadow-elegant flex flex-col">
        <div className="p-6 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-medium text-primary">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                {post.weekday} {post.dayOfMonth}
              </span>
              {/* A day belongs to several editions; the card has to say which one it is holding. */}
              <AudienceBadge audience={post.audience} />
            </span>
            <div className="flex items-center gap-1 -mt-1 -mr-2">
              <SaveButton slug={post.slug} />
              <ArrowUpRight
                className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>
          </div>

          <h3
            className={cn(
              'font-serif font-semibold leading-tight text-balance mb-3 group-hover:text-primary transition-colors',
              compact ? 'text-lg' : 'text-2xl'
            )}
          >
            <Link
              href={href}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-sm after:absolute after:inset-0 after:content-['']"
            >
              {post.title}
            </Link>
          </h3>

          {!compact && (
            <p className="text-muted-foreground line-clamp-3 mb-5 text-sm leading-relaxed">{post.excerpt}</p>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
            <time dateTime={post.date}>{formatDateShort(post.date)}</time>
            <span className="flex items-center gap-3">
              {post.scriptureReference && (
                <span className="inline-flex items-center gap-1.5" title="Opening scripture">
                  <BookMarked className="w-3 h-3" aria-hidden="true" /> {post.scriptureReference}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3 h-3" aria-hidden="true" /> {post.readingMinutes} min
              </span>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
