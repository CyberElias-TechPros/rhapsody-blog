'use client';

/**
 * `/library` — the reader's own saved shelf.
 *
 * Saving is local and instant (see `hooks/useSavedPosts.ts`): no account, nothing uploaded, and it
 * works on a phone with 40MB of data left. The catch is that localStorage holds *slugs*, not
 * titles, so this component asks `/api/library` for exactly the slugs it has rather than the whole
 * corpus being shipped to the browser.
 *
 * Everything here is a state a reader can actually reach: still loading, nothing saved yet, a
 * shelf of items, items that have since been unpublished, and the network being down. The last one
 * matters most — the slugs are still on the device, so they are shown as a list of links even when
 * their titles cannot be fetched.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, BookmarkX, ExternalLink, Library as LibraryIcon, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/StateBlocks';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import type { LibraryItem } from '@/lib/types';

/** One fetch result, tagged with the shelf it answers for. */
interface ShelfResult {
  key: string;
  items: LibraryItem[];
  unknown: string[];
  /** False when the request failed: the slugs are still on the device, only their labels are not. */
  ok: boolean;
}

export function SavedLibrary() {
  const { slugs, hydrated, remove, clear } = useSavedPosts();
  const [result, setResult] = useState<ShelfResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const key = slugs.join(',');

  useEffect(() => {
    if (!hydrated || !slugs.length) return undefined;

    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/library?slugs=${encodeURIComponent(key)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data = (await response.json()) as { items: LibraryItem[]; unknown: string[] };
        setResult({ key, items: data.items ?? [], unknown: data.unknown ?? [], ok: true });
      } catch (cause) {
        if ((cause as Error)?.name === 'AbortError') return;
        // The shelf still exists locally; only its labels could not be fetched.
        setResult({ key, items: [], unknown: [], ok: false });
      }
    })();
    return () => controller.abort();
    // `key` is the shelf; a result for any other shelf is stale and reads as "loading".
  }, [hydrated, key, slugs.length]);

  // A result is only usable if it answers for the shelf on screen right now.
  const current = result && result.key === key ? result : null;
  const loading = hydrated && slugs.length > 0 && !current;
  const offline = current ? !current.ok : false;
  const items = current?.items ?? [];
  const unknown = current?.unknown ?? [];

  const onRemove = useCallback(
    (slug: string) => {
      // Dropping the slug from the store is the only write: the shelf re-renders from it, and the
      // stale result is discarded because its key no longer matches.
      remove(slug);
      setResult((latest) =>
        latest
          ? {
              ...latest,
              key: latest.key.split(',').filter((entry) => entry !== slug).join(','),
              items: latest.items.filter((item) => item.slug !== slug),
              unknown: latest.unknown.filter((entry) => entry !== slug),
            }
          : latest
      );
    },
    [remove]
  );

  const onClear = useCallback(() => {
    if (!confirming) {
      setConfirming(true);
      // A second tap confirms; the button resets if the reader changes their mind and walks away.
      window.setTimeout(() => setConfirming(false), 4_000);
      return;
    }
    clear();
    setConfirming(false);
    setResult(null);
  }, [clear, confirming]);

  if (!hydrated) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Opening your library…
      </p>
    );
  }

  if (!slugs.length) {
    return (
      <EmptyState
        title="Nothing saved yet"
        hint="Tap the bookmark on any devotional, book or kids’ issue and it is kept here — on this device, with no account and nothing uploaded anywhere."
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="gradient-hero text-primary-foreground border-0">
              <Link href="/today">
                <BookOpen className="w-4 h-4 mr-2" aria-hidden="true" /> Read today’s devotional
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/devotionals">Browse the library</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Loading {slugs.length} saved{' '}
              {slugs.length === 1 ? 'item' : 'items'}…
            </span>
          ) : (
            <>
              <strong className="text-foreground">{slugs.length}</strong> saved{' '}
              {slugs.length === 1 ? 'item' : 'items'} — kept on this device only.
            </>
          )}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className={confirming ? 'text-destructive hover:text-destructive' : 'text-muted-foreground'}
          aria-label={confirming ? 'Tap again to remove every saved item' : 'Remove every saved item'}
        >
          <Trash2 className="w-3.5 h-3.5 mr-2" aria-hidden="true" />
          {confirming ? 'Tap again to clear all' : 'Clear all'}
        </Button>
      </div>

      {offline && (
        <p className="mt-4 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
          Your saved items are on this device, but their details could not be loaded right now. The links below still
          work — open one and it will load from the site.
        </p>
      )}

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.slug}
            className="group relative flex flex-col rounded-2xl border border-border/70 gradient-card p-5 shadow-soft hover:shadow-elegant hover:border-primary/40 transition-all"
          >
            <span className="text-[0.7rem] uppercase tracking-wider text-primary font-medium">{item.label}</span>
            <Link href={item.href} className="mt-1.5 font-serif text-xl font-semibold leading-tight hover:text-primary transition-colors">
              {item.title}
            </Link>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1">{item.excerpt}</p>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{item.meta}</span>
              <span className="flex items-center gap-1 shrink-0">
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => onRemove(item.slug)}
                  className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label={`Remove “${item.title}” from your library`}
                >
                  <BookmarkX className="w-3.5 h-3.5" aria-hidden="true" /> Remove
                </button>
              </span>
            </div>
          </li>
        ))}

        {/* Offline, or a slug that could not be resolved: still a usable link. */}
        {!current
          ? slugs
              .filter((slug) => !items.some((item) => item.slug === slug))
              .map((slug) => (
                <li key={slug} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
                  <Link href={hrefForSlug(slug)} className="text-sm font-medium hover:text-primary transition-colors truncate">
                    {slug}
                  </Link>
                  <button
                    type="button"
                    onClick={() => onRemove(slug)}
                    className="shrink-0 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove ${slug} from your library`}
                  >
                    Remove
                  </button>
                </li>
              ))
          : null}
      </ul>

      {unknown.length > 0 && (
        <p className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
          <LibraryIcon className="w-4 h-4" aria-hidden="true" />
          {unknown.length} saved {unknown.length === 1 ? 'item is' : 'items are'} no longer published.{' '}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => unknown.forEach((slug) => onRemove(slug))}
          >
            Remove {unknown.length === 1 ? 'it' : 'them'}
          </button>
        </p>
      )}
    </div>
  );
}

/** A devotional slug carries its date and audience; anything else is a resource or a kids' issue. */
function hrefForSlug(slug: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(slug)) return `/devotionals/${slug}`;
  if (slug.endsWith('-kids')) return `/kids/${slug}`;
  return `/resources/${slug}`;
}
