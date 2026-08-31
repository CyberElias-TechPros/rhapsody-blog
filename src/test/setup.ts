import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// jsdom lacks matchMedia (next-themes + some radix parts query it).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// framer-motion whileInView + radix portals need these in jsdom.
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// jsdom implements window.scrollTo only as a not-implemented stub; replace with a no-op.
window.scrollTo = (() => {}) as typeof window.scrollTo;

// Keep localStorage isolated between tests; unmount React trees between tests
// (RTL auto-cleanup relies on globals, which this project disables).
beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
});
