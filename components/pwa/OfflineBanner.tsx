'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/** "You're offline" — and what still works: everything already opened or saved for offline. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-sm shadow-elegant backdrop-blur"
      data-print-hide=""
    >
      <WifiOff className="w-4 h-4 text-primary" aria-hidden="true" />
      <span>You’re offline — devotionals you’ve opened still work.</span>
      <Link href="/offline" className="font-medium text-primary hover:underline">
        See what’s saved
      </Link>
    </div>
  );
}
