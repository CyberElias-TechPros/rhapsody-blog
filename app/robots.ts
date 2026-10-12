import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Account and admin screens are Worker-backed and not part of the public corpus.
        // `/library` is deliberately *not* disallowed: it is per-device and already `noindex`,
        // and a crawler that is blocked from fetching it can never see that tag.
        disallow: ['/account', '/admin', '/login', '/register', '/api/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}

export const dynamic = 'force-static';
