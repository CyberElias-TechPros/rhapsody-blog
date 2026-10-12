import type { MetadataRoute } from 'next';
import { SITE, absoluteUrl } from '@/lib/site';

/**
 * Installability.
 *
 * A reader who wants today's devotional on their home screen should get today's devotional, not a
 * bookmark to whatever day they installed it on — so `start_url` is `/today`, the server redirect
 * that always resolves to the current day. Everything else here is the minimum a browser needs to
 * offer "Add to home screen": a name, a scope, a display mode, a theme colour and an icon.
 *
 * The icon is an SVG rather than a set of PNGs on purpose: it is one small file that stays sharp at
 * every size, and `sizes: "any"` tells the platform it covers all of them.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.shortName,
    description: SITE.description,
    start_url: absoluteUrl('/today'),
    scope: absoluteUrl('/'),
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fdfaf5',
    theme_color: '#b45309',
    categories: ['books', 'education', 'lifestyle'],
    lang: SITE.locale,
    dir: 'ltr',
    icons: [
      {
        src: absoluteUrl('/icon.svg'),
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: absoluteUrl('/icon.svg'),
        sizes: 'any',
        type: 'image/svg+xml',
        // A maskable icon keeps the mark inside the safe zone so launchers can crop it to a
        // circle, a squircle or a square without cutting the book in half.
        purpose: 'maskable',
      },
      {
        // The social card doubles as a wide splash image; it is already on the CDN.
        src: absoluteUrl(SITE.ogImage),
        sizes: '1200x630',
        type: 'image/jpeg',
        purpose: 'any',
      },
    ],
  };
}

export const dynamic = 'force-static';
