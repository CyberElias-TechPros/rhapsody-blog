'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocalStore } from '@/hooks/useLocalStore';
import { historyStore } from '@/lib/reader-data';
import { PAGES_CACHE } from '@/components/pwa/offline';

/** The devotionals this browser can open without a connection (from the service worker's page cache). */
export function OfflineList() {
  const history = useLocalStore(historyStore);
  const [paths, setPaths] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<string[]> => {
      if (!('caches' in window)) return [];
      try {
        const requests = await (await caches.open(PAGES_CACHE)).keys();
        const found = requests
          .map((request) => new URL(request.url).pathname)
          .filter((path) => path.startsWith('/devotionals/') && path.split('/').length === 3);
        return [...new Set(found)];
      } catch {
        return [];
      }
    };
    void load().then((found) => {
      if (!cancelled) setPaths(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (paths === null) return <p className="text-sm text-muted-foreground">Checking what is saved…</p>;
  if (!paths.length) {
    return <p className="text-sm text-muted-foreground">Nothing is saved yet. Devotionals you open while online are kept here automatically.</p>;
  }

  const items = paths
    .map((path) => {
      const slug = path.split('/')[2];
      const entry = history[slug];
      return { path, slug, title: entry?.title ?? slug.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' '), date: entry?.date ?? slug.slice(0, 10) };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <ul className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-card">
      {items.map((item) => (
        <li key={item.path}>
          <Link href={item.path} className="flex items-center justify-between gap-3 px-4 py-3 hover:text-primary">
            <span className="truncate font-medium first-letter:uppercase">{item.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{item.date}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
