'use client';

/**
 * Saved devotionals ("my library") live in localStorage.
 *
 * The Worker API has its own bookmark table, but it keys on Worker post ids and the published
 * corpus here is static Markdown with no ids — so saving a devotional is a purely local,
 * instant, sign-in-free action. `useSyncExternalStore` subscribes to both the cross-tab
 * `storage` event and an in-tab custom event, so every open component (post page button,
 * account list, navbar count) agrees without a provider.
 */

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'rhapsody.saved.slugs';
const SYNC_EVENT = 'rhapsody:saved-posts';

/** Stable snapshots: `useSyncExternalStore` re-renders on every identity change. */
const EMPTY: string[] = [];
let cacheRaw: string | null = null;
let cacheValue: string[] = EMPTY;

function readSlugs(): string[] {
  if (typeof window === 'undefined') return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY; // private mode / blocked storage
  }
  if (raw === cacheRaw) return cacheValue;
  cacheRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cacheValue = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : EMPTY;
  } catch {
    cacheValue = EMPTY; // corrupted entry — a lost bookmark list is not worth throwing over
  }
  return cacheValue;
}

function writeSlugs(slugs: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    /* storage full or blocked — the UI still reflects the store's in-memory value */
  }
  cacheRaw = JSON.stringify(slugs);
  cacheValue = slugs;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(SYNC_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(SYNC_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

/** Server render sees an empty list, so SSR HTML and the first client paint always match. */
const getServerSnapshot = () => EMPTY;
/** `false` on the server, `true` in the browser — replaces a `mounted` flag. */
const subscribeHydration = (onStoreChange: () => void) => {
  onStoreChange();
  return () => {};
};
const getHydrated = () => true;
const getNotHydrated = () => false;

export function useSavedPosts() {
  const slugs = useSyncExternalStore(subscribe, readSlugs, getServerSnapshot);
  const hydrated = useSyncExternalStore(subscribeHydration, getHydrated, getNotHydrated);

  const commit = useCallback((next: string[]) => {
    writeSlugs(next);
    // Nudge every other subscriber in this tab; `storage` covers the other tabs.
    window.dispatchEvent(new Event(SYNC_EVENT));
  }, []);

  const isSaved = useCallback((slug: string) => slugs.includes(slug), [slugs]);

  const toggle = useCallback(
    (slug: string) => {
      const current = readSlugs();
      const next = current.includes(slug) ? current.filter((s) => s !== slug) : [slug, ...current];
      commit(next);
      return next.includes(slug);
    },
    [commit]
  );

  const remove = useCallback(
    (slug: string) => {
      commit(readSlugs().filter((s) => s !== slug));
    },
    [commit]
  );

  const clear = useCallback(() => commit([]), [commit]);

  return { slugs, hydrated, isSaved, toggle, remove, clear, count: slugs.length };
}
