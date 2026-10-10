import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';

/** Generic error surface with retry — never let a screen go blank or silently fail. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message =
    error instanceof ApiError
      ? error.isRateLimited
        ? 'Too many requests — wait a moment and try again.'
        : error.status === 0
          ? 'Cannot reach the service. Check your connection or try again shortly.'
          : error.message
      : 'Something went wrong loading this content.';
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-4 py-16 text-center ${className ?? ''}`}>
      <div className="grid place-items-center w-12 h-12 rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="w-6 h-6" aria-hidden="true" />
      </div>
      <div>
        <p className="font-serif text-xl font-semibold">Couldn’t load this</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" /> Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="grid place-items-center w-12 h-12 rounded-2xl bg-secondary text-muted-foreground">
        <Inbox className="w-6 h-6" aria-hidden="true" />
      </div>
      <div>
        <p className="font-serif text-xl font-semibold">{title}</p>
        {hint && <p className="text-sm text-muted-foreground mt-1 max-w-md">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="gradient-card rounded-2xl p-6 border border-border/60">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-6 w-full mb-2" />
      <Skeleton className="h-6 w-2/3 mb-4" />
      <Skeleton className="h-3 w-full mb-1.5" />
      <Skeleton className="h-3 w-5/6 mb-6" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function PostGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading posts">
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="animate-fade-in">
      {eyebrow && <span className="text-sm uppercase tracking-wider text-primary font-medium">{eyebrow}</span>}
      <h1 className="font-serif text-4xl md:text-6xl font-semibold mt-2 text-balance leading-[1.08]">{title}</h1>
      {subtitle && <p className="mt-4 text-lg text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>}
      {children}
    </header>
  );
}
