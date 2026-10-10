import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container py-32 text-center">
      <div className="grid place-items-center w-14 h-14 rounded-2xl bg-secondary text-primary mx-auto">
        <Compass className="w-7 h-7" aria-hidden="true" />
      </div>
      <p className="mt-6 text-sm uppercase tracking-wider text-primary font-medium">404</p>
      <h1 className="font-serif text-4xl md:text-5xl font-semibold mt-2 text-balance">This page isn&apos;t in the library</h1>
      <p className="text-muted-foreground mt-4 max-w-md mx-auto">
        The devotional may have been moved, or the link is mistyped. Every published day is listed in the
        library.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/devotionals">Browse devotionals</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/search">Search</Link>
        </Button>
      </div>
    </div>
  );
}
