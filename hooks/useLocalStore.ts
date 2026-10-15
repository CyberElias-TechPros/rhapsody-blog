'use client';

import { useSyncExternalStore } from 'react';
import type { LocalStore } from '@/lib/local-store';
import { localDateKey } from '@/lib/reader-data';

/**
 * Read a `createLocalStore` store and re-render when it changes — in this tab or another one.
 * The server and the first client render see `store.fallback`, so hydration always matches; the
 * stored value arrives on the very next render.
 */
export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.read, () => store.fallback);
}

const noopSubscribe = () => () => {};

/** `false` during SSR and hydration, `true` afterwards — for UI that only makes sense in a browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

const subscribeMinute = (onChange: () => void) => {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
};

/**
 * The reader's local date (`yyyy-mm-dd`), re-checked every minute so streak badges roll over at
 * midnight; `''` on the server and during hydration.
 */
export function useLocalToday(): string {
  return useSyncExternalStore(
    subscribeMinute,
    () => localDateKey(new Date()),
    () => ''
  );
}
