'use client';

import Link from 'next/link';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Route-level error boundary — replaces the old React `ErrorBoundary` wrapper around the SPA. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the failure instead of swallowing it; swap for your logger of choice.
    console.error(error);
  }, [error]);

  return (
    <div className="container py-32 text-center" role="alert">
      <div className="grid place-items-center w-14 h-14 rounded-2xl bg-destructive/10 text-destructive mx-auto">
        <AlertTriangle className="w-7 h-7" aria-hidden="true" />
      </div>
      <h1 className="font-serif text-4xl mt-5">Something went wrong</h1>
      <p className="text-muted-foreground mt-3 max-w-md mx-auto">
        {error.message || 'An unexpected error occurred while rendering this page.'}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/devotionals">Back to the library</Link>
        </Button>
      </div>
    </div>
  );
}
