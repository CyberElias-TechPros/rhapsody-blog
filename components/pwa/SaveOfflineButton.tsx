'use client';

/**
 * "Save this edition for offline": fetches every day of a month into the page cache the service
 * worker reads from when there is no connection — for a reader about to travel, or on a data
 * plan, who wants the month in their pocket. Uses the Cache API directly; nothing is uploaded.
 */

import { useState } from 'react';
import { CheckCircle2, CloudDownload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useHydrated, useLocalStore } from '@/hooks/useLocalStore';
import { createLocalStore, recordOf } from '@/lib/local-store';
import { PAGES_CACHE } from '@/components/pwa/offline';

interface SavedSet {
  savedAt: number;
  count: number;
}

export const offlineSetsStore = createLocalStore<Record<string, SavedSet>>('rhapsody.offline.v1', {}, (raw) =>
  recordOf(raw, (value): value is SavedSet => {
    const v = value as SavedSet;
    return !!v && typeof v === 'object' && typeof v.savedAt === 'number' && typeof v.count === 'number';
  })
);

async function cachePages(urls: string[], onProgress: (done: number) => void): Promise<number> {
  const cache = await caches.open(PAGES_CACHE);
  let done = 0;
  let saved = 0;
  const queue = [...urls];
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift()!;
      try {
        const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
        if (response.ok) {
          await cache.put(url, response);
          saved += 1;
        }
      } catch {
        /* offline mid-way: keep what we have */
      }
      done += 1;
      onProgress(done);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return saved;
}

export function SaveOfflineButton({ setId, urls, label }: { setId: string; urls: string[]; label: string }) {
  const sets = useLocalStore(offlineSetsStore);
  const hydrated = useHydrated();
  const [progress, setProgress] = useState<number | null>(null);
  const saved = hydrated ? sets[setId] : undefined;
  const supported = hydrated && typeof window !== 'undefined' && 'caches' in window;

  if (!supported) return null;

  const save = async () => {
    setProgress(0);
    try {
      const count = await cachePages(urls, setProgress);
      offlineSetsStore.update((all) => ({ ...all, [setId]: { savedAt: Date.now(), count } }));
      if (count === urls.length) toast.success(`${label} saved for offline reading`, { description: `${count} devotionals, available without a connection.` });
      else toast.warning(`Saved ${count} of ${urls.length}`, { description: 'Reconnect and try again to finish.' });
    } catch {
      toast.error('This browser would not save pages for offline use.');
    } finally {
      setProgress(null);
    }
  };

  if (progress !== null) {
    return (
      <Button type="button" variant="outline" size="sm" disabled>
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden="true" /> Saving {progress}/{urls.length}…
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={save} title="Download every day of this edition to read without a connection">
      {saved ? (
        <CheckCircle2 className="w-4 h-4 mr-1.5 text-green-600" aria-hidden="true" />
      ) : (
        <CloudDownload className="w-4 h-4 mr-1.5" aria-hidden="true" />
      )}
      {saved ? `Saved offline · update` : 'Save for offline'}
    </Button>
  );
}
