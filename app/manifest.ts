import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/**
 * Installability.
 *
 * A reader who wants today's devotional on their home screen should get today's devotional, not a
 * bookmark to whatever day they installed it on — so `start_url` is `/today`, the server redirect
 * that always resolves to the current day. With the service worker (`public/sw.js`) the installed
 * app opens offline too, on the pages the reader has already read or saved.
 *
 * Chromium's install criteria want 192 px and 512 px raster icons; the SVG stays for platforms
 * that prefer it, and the maskable PNG is full-bleed so launchers can crop it to any shape.
 * `npm run icons` regenerates every PNG from `public/icon.svg`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: SITE.name,
    short_name: SITE.shortName,
    description: SITE.description,
    start_url: '/today?source=app',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#fdfaf5',
    theme_color: '#b45309',
    categories: ['books', 'education', 'lifestyle'],
    lang: 'en-GB',
    dir: 'ltr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Today’s devotional', short_name: 'Today', url: '/today?source=shortcut', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'TeeVo — for teens', short_name: 'TeeVo', url: '/teevo', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Bible reading plan', short_name: 'Bible plan', url: '/reading-plans', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'My Rhapsody', short_name: 'My Rhapsody', url: '/me', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}

export const dynamic = 'force-static';
