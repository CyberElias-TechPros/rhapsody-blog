/**
 * A tiny JSON-in-localStorage store with change notification — the pattern
 * `hooks/useSavedPosts.ts` established, generalised so reading history, notes, plan progress
 * and settings all behave the same way:
 *
 * - **No account, no server.** Everything a reader does here stays on their device.
 * - **Every component agrees.** Writes dispatch an in-tab event; other tabs hear the `storage`
 *   event. `useSyncExternalStore` (see `hooks/useLocalStore.ts`) re-renders subscribers.
 * - **Stable snapshots.** `read()` returns the same object until the stored string changes, which
 *   is what `useSyncExternalStore` requires to avoid render loops.
 * - **Never throws.** Private mode, a full quota or a corrupted value degrade to the fallback.
 *
 * Framework-free and SSR-safe: on the server `read()` returns the fallback.
 */

export interface LocalStore<T> {
  key: string;
  read: () => T;
  write: (next: T) => void;
  update: (fn: (previous: T) => T) => void;
  clear: () => void;
  subscribe: (onChange: () => void) => () => void;
  /** What the server (and the first client render) sees. */
  fallback: T;
}

/** Every key the site writes, so "export my data" and "clear my data" can find them. */
export const STORE_PREFIX = 'rhapsody.';

export function createLocalStore<T>(key: string, fallback: T, validate: (raw: unknown) => T): LocalStore<T> {
  const event = `rhapsody:store:${key}`;
  let cacheRaw: string | null | undefined;
  let cacheValue: T = fallback;

  const read = (): T => {
    if (typeof window === 'undefined') return fallback;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return cacheRaw === undefined ? fallback : cacheValue;
    }
    if (raw === cacheRaw) return cacheValue;
    cacheRaw = raw;
    if (raw === null) {
      cacheValue = fallback;
      return cacheValue;
    }
    try {
      cacheValue = validate(JSON.parse(raw));
    } catch {
      cacheValue = fallback;
    }
    return cacheValue;
  };

  const write = (next: T) => {
    if (typeof window === 'undefined') return;
    const raw = JSON.stringify(next);
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      /* quota or blocked storage: keep the in-memory value so the UI still reflects the action */
    }
    cacheRaw = raw;
    cacheValue = next;
    window.dispatchEvent(new Event(event));
  };

  const clear = () => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    cacheRaw = null;
    cacheValue = fallback;
    window.dispatchEvent(new Event(event));
  };

  const subscribe = (onChange: () => void) => {
    if (typeof window === 'undefined') return () => {};
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) onChange();
    };
    window.addEventListener(event, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(event, onChange);
      window.removeEventListener('storage', onStorage);
    };
  };

  return {
    key,
    read,
    write,
    update: (fn) => write(fn(read())),
    clear,
    subscribe,
    fallback,
  };
}

/** A plain object whose values all pass `isEntry` — the shape of every keyed store here. */
export function recordOf<V>(raw: unknown, isEntry: (value: unknown) => value is V): Record<string, V> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, V> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isEntry(value)) out[key] = value;
  }
  return out;
}

/** Every `rhapsody.*` key in localStorage, as a JSON-ready object — the "export my data" payload. */
export function exportLocalData(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (typeof window === 'undefined') return data;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (raw === null) continue;
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  } catch {
    /* storage blocked */
  }
  return data;
}

/**
 * Restore an export. Only `rhapsody.*` keys are accepted; each store re-validates its value on
 * the next read, so a hand-edited file cannot put the app in a broken state.
 */
export function importLocalData(data: unknown): number {
  if (typeof window === 'undefined' || !data || typeof data !== 'object' || Array.isArray(data)) return 0;
  let restored = 0;
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!key.startsWith(STORE_PREFIX)) continue;
    try {
      window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      restored += 1;
    } catch {
      /* quota: skip */
    }
  }
  // Tell every subscriber in this tab to re-read.
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  return restored;
}

/** Remove every `rhapsody.*` key — "clear my data on this device". */
export function clearLocalData(): number {
  if (typeof window === 'undefined') return 0;
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORE_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  return keys.length;
}
