// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalData, createLocalStore, exportLocalData, importLocalData, recordOf } from '@/lib/local-store';

beforeEach(() => window.localStorage.clear());

describe('createLocalStore', () => {
  const make = () => createLocalStore<string[]>('rhapsody.test.v1', [], (raw) => (Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []));

  it('returns the fallback until written, then the stored value with a stable identity', () => {
    const store = make();
    expect(store.read()).toEqual([]);
    store.write(['a']);
    const first = store.read();
    expect(first).toEqual(['a']);
    expect(store.read()).toBe(first); // same snapshot until the string changes
  });

  it('validates what it reads and survives corrupted JSON', () => {
    const store = make();
    window.localStorage.setItem('rhapsody.test.v1', '{not json');
    expect(store.read()).toEqual([]);
    window.localStorage.setItem('rhapsody.test.v1', JSON.stringify(['ok', 3, null]));
    expect(store.read()).toEqual(['ok']);
  });

  it('notifies subscribers in this tab and on cross-tab storage events', () => {
    const store = make();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.update((list) => [...list, 'b']);
    expect(listener).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent('storage', { key: 'rhapsody.test.v1' }));
    expect(listener).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new StorageEvent('storage', { key: 'someone.else' }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.read()).toEqual([]);
  });

  it('keeps entries that pass the guard', () => {
    expect(recordOf({ a: 1, b: 'x', c: 2 }, (v): v is number => typeof v === 'number')).toEqual({ a: 1, c: 2 });
    expect(recordOf([1, 2], (_v): _v is number => true)).toEqual({});
  });
});

describe('export, import and clear', () => {
  it('round-trips only the site’s own keys', () => {
    window.localStorage.setItem('rhapsody.notes.v1', JSON.stringify({ x: 1 }));
    window.localStorage.setItem('rhapsody.saved.slugs', JSON.stringify(['a']));
    window.localStorage.setItem('theme', 'dark');
    const data = exportLocalData();
    expect(Object.keys(data).sort()).toEqual(['rhapsody.notes.v1', 'rhapsody.saved.slugs']);

    window.localStorage.clear();
    expect(importLocalData({ ...data, 'evil.key': 'x' })).toBe(2);
    expect(window.localStorage.getItem('evil.key')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('rhapsody.saved.slugs')!)).toEqual(['a']);

    expect(clearLocalData()).toBe(2);
    expect(window.localStorage.length).toBe(0);
  });
});
