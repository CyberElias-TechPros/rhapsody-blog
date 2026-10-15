/* Rhapsody of Realities — offline support.
 *
 * Registered by components/pwa/PwaProvider.tsx as /sw.js?v=<build id>. A new build id means a new
 * worker: it installs, takes over immediately and deletes the previous build's static cache.
 *
 * Strategy, by request:
 *   page navigations     network first (fresh "today" when online), cached copy when offline,
 *                        then the /offline page. Every page opened is kept for offline reading.
 *   /_next/static/*      cache first — file names are content hashes, so they never go stale.
 *   images, /og/*        stale-while-revalidate, capped.
 *   other same-origin    stale-while-revalidate for icons, the manifest and fonts.
 *   never touched        other origins (ads, analytics, fonts CDN), non-GET requests, /api/*,
 *                        account/admin/auth screens, and Next's router payloads (RSC requests:
 *                        when they fail offline, the router falls back to a full navigation,
 *                        which the page cache answers).
 *
 * Keep PAGES_CACHE in step with components/pwa/offline.ts (tests/service-worker.test.ts checks).
 */

var VERSION = (function () {
  try {
    return new URL(self.location.href).searchParams.get('v') || 'dev';
  } catch (e) {
    return 'dev';
  }
})();
var STATIC_CACHE = 'rhapsody-static-' + VERSION;
var PAGES_CACHE = 'rhapsody-pages-v1';
var IMAGES_CACHE = 'rhapsody-images-v1';
var PAGES_LIMIT = 160;
var IMAGES_LIMIT = 200;
var OFFLINE_URL = '/offline';
var PRECACHE = [OFFLINE_URL, '/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png'];

var BYPASS = /^\/(api|admin|account|login|register)(\/|$)/;

/** Which strategy a GET request gets — pure, so it can be tested outside a worker. */
function routeFor(url, request) {
  if (url.origin !== self.location.origin) return 'bypass';
  if (BYPASS.test(url.pathname) || url.pathname === '/sw.js') return 'bypass';
  if (request.headers && (request.headers.get('RSC') || request.headers.get('Next-Router-Prefetch'))) return 'bypass';
  if (url.searchParams.has('_rsc')) return 'bypass';
  if (request.mode === 'navigate') return 'page';
  if (url.pathname.indexOf('/_next/static/') === 0) return 'static';
  if (request.destination === 'image' || url.pathname.indexOf('/_next/image') === 0 || url.pathname.indexOf('/og/') === 0 || url.pathname === '/og.png') {
    return 'image';
  }
  if (/\.(?:css|js|woff2?|svg|png|ico|webmanifest|txt)$/.test(url.pathname) || url.pathname === '/manifest.webmanifest') return 'asset';
  return 'bypass';
}

function trim(cacheName, limit) {
  return caches.open(cacheName).then(function (cache) {
    return cache.keys().then(function (keys) {
      var excess = keys.length - limit;
      var deletions = [];
      for (var i = 0; i < excess; i += 1) deletions.push(cache.delete(keys[i]));
      return Promise.all(deletions);
    });
  });
}

function cacheable(response) {
  return response && response.ok && response.type === 'basic';
}

function networkFirstPage(event) {
  var request = event.request;
  var fromNetwork = Promise.resolve(event.preloadResponse)
    .then(function (preloaded) {
      return preloaded || fetch(request);
    })
    .then(function (response) {
      if (cacheable(response)) {
        var copy = response.clone();
        event.waitUntil(
          caches
            .open(PAGES_CACHE)
            .then(function (cache) {
              return cache.put(request.url, copy);
            })
            .then(function () {
              return trim(PAGES_CACHE, PAGES_LIMIT);
            })
        );
      }
      return response;
    });

  return fromNetwork.catch(function () {
    var url = new URL(request.url);
    return caches
      .match(request.url, { ignoreVary: true })
      .then(function (hit) {
        // "/today" redirects to a different article every day, so it is never cached itself;
        // offline, the home page (which shows today's devotional) is the honest answer.
        if (hit) return hit;
        if (url.pathname === '/today') return caches.match('/', { ignoreVary: true });
        return undefined;
      })
      .then(function (hit) {
        return hit || caches.match(OFFLINE_URL, { ignoreVary: true });
      })
      .then(function (hit) {
        return hit || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      });
  });
}

function cacheFirst(request, cacheName) {
  return caches.match(request).then(function (hit) {
    if (hit) return hit;
    return fetch(request).then(function (response) {
      if (cacheable(response)) {
        var copy = response.clone();
        caches.open(cacheName).then(function (cache) {
          cache.put(request, copy);
        });
      }
      return response;
    });
  });
}

function staleWhileRevalidate(event, cacheName, limit) {
  var request = event.request;
  return caches.match(request).then(function (hit) {
    var refresh = fetch(request)
      .then(function (response) {
        if (cacheable(response)) {
          var copy = response.clone();
          event.waitUntil(
            caches
              .open(cacheName)
              .then(function (cache) {
                return cache.put(request, copy);
              })
              .then(function () {
                return limit ? trim(cacheName, limit) : undefined;
              })
          );
        }
        return response;
      })
      .catch(function () {
        return hit || Response.error();
      });
    return hit || refresh;
  });
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function' && typeof module === 'undefined') {
  self.addEventListener('install', function (event) {
    event.waitUntil(
      caches
        .open(STATIC_CACHE)
        .then(function (cache) {
          // One failed URL must not abort the install: add each on its own.
          return Promise.all(
            PRECACHE.map(function (url) {
              return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
            })
          );
        })
        .then(function () {
          return self.skipWaiting();
        })
    );
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(function (keys) {
          return Promise.all(
            keys
              .filter(function (key) {
                return key.indexOf('rhapsody-static-') === 0 && key !== STATIC_CACHE;
              })
              .map(function (key) {
                return caches.delete(key);
              })
          );
        })
        .then(function () {
          if (self.registration && self.registration.navigationPreload) return self.registration.navigationPreload.enable();
          return undefined;
        })
        .then(function () {
          return self.clients.claim();
        })
    );
  });

  self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') return;
    var url;
    try {
      url = new URL(request.url);
    } catch (e) {
      return;
    }
    switch (routeFor(url, request)) {
      case 'page':
        event.respondWith(networkFirstPage(event));
        return;
      case 'static':
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
      case 'image':
        event.respondWith(staleWhileRevalidate(event, IMAGES_CACHE, IMAGES_LIMIT));
        return;
      case 'asset':
        event.respondWith(staleWhileRevalidate(event, STATIC_CACHE));
        return;
      default:
        return;
    }
  });

  self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  });
}

// Test hook: tests/service-worker.test.ts evaluates this file with a stub `self` and a `module`.
if (typeof module !== 'undefined' && module && module.exports) {
  module.exports = { routeFor: routeFor, PAGES_CACHE: PAGES_CACHE, STATIC_CACHE: STATIC_CACHE, VERSION: VERSION };
}
