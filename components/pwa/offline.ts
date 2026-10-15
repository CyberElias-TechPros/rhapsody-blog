/**
 * Shared names between the page and the service worker (`public/sw.js` hard-codes the same
 * strings — keep them in step; `tests/service-worker.test.ts` checks they match).
 */

/** Pages saved for offline reading. Not versioned: a deploy must not delete a reader's saved month. */
export const PAGES_CACHE = 'rhapsody-pages-v1';

/** Upper bound on cached pages, so storage use stays modest (about 120 × 150 KB). */
export const PAGES_LIMIT = 160;
