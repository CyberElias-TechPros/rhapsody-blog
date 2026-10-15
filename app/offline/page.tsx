import Link from 'next/link';
import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';
import { OfflineList } from '@/components/pwa/OfflineList';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'You are offline. These devotionals are saved on this device.',
  robots: { index: false, follow: false },
};

/**
 * The service worker's fallback page (precached at install): shown for any page that is not saved
 * when there is no connection, with the list of devotionals that are.
 */
export default function OfflinePage() {
  return (
    <div className="container py-16 md:py-24 max-w-3xl">
      <div className="grid place-items-center w-14 h-14 rounded-2xl bg-secondary text-primary">
        <WifiOff className="w-7 h-7" aria-hidden="true" />
      </div>
      <h1 className="mt-6 font-serif text-4xl md:text-5xl font-semibold">You’re offline</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        That page is not saved on this device yet. These devotionals are — open any of them, or try again when you are back online.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/">Home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/me">My Rhapsody</Link>
        </Button>
      </div>
      <h2 className="mt-12 mb-4 font-serif text-2xl font-semibold">Saved for offline reading</h2>
      <OfflineList />
      <p className="mt-6 text-sm text-muted-foreground">
        Tip: on any edition page, “Save for offline” stores the whole month at once.
      </p>
    </div>
  );
}
