'use client';

import { Bookmark, BookmarkCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import { cn } from '@/lib/utils';

/**
 * Local save toggle ("my library"). Rendered as a plain icon button inside cards and as a
 * labelled button on the article page.
 */
export function SaveButton({
  slug,
  title,
  variant = 'icon',
  className,
}: {
  slug: string;
  title?: string;
  variant?: 'icon' | 'button';
  className?: string;
}) {
  const { isSaved, toggle, hydrated } = useSavedPosts();
  const saved = hydrated && isSaved(slug);
  const label = title ?? 'this devotional';

  const onClick = () => {
    const nowSaved = toggle(slug);
    toast.success(nowSaved ? `Saved “${label}” to your library.` : `Removed “${label}” from your library.`);
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={saved ? `Remove “${label}” from saved devotionals` : `Save “${label}” to my library`}
        aria-pressed={saved}
        title={saved ? 'Saved' : 'Save to my library'}
        className={cn(
          'relative z-10 grid place-items-center w-8 h-8 rounded-full transition-colors',
          saved ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-secondary',
          className
        )}
      >
        {saved ? <BookmarkCheck className="w-4 h-4" aria-hidden="true" /> : <Bookmark className="w-4 h-4" aria-hidden="true" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      data-shortcut="save"
      className={cn(
        'inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors',
        saved
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-background hover:border-primary/40 hover:text-primary',
        className
      )}
    >
      {saved ? <BookmarkCheck className="w-4 h-4" aria-hidden="true" /> : <Bookmark className="w-4 h-4" aria-hidden="true" />}
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
