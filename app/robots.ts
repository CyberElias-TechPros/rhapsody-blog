import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Account and admin screens are Worker-backed and not part of the public corpus; `/go/`
        // and `/random` only redirect to articles that are crawlable on their own URLs.
        // `/library`, `/me` and `/offline` are deliberately *not* disallowed: they are
        // per-device and already `noindex`, and a crawler blocked from fetching them could never
        // see that tag.
        disallow: ['/account', '/admin', '/login', '/register', '/api/', '/go/', '/random'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}

export const dynamic = 'force-static';
