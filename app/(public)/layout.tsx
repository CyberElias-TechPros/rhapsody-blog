import type { ReactNode } from 'react';
import { AdScript } from '@/components/common/AdScript';

/**
 * Layout for the public reading side of the site: home, the library, editions, search and about.
 *
 * It exists to hold the AdSense loader. Keeping it here rather than in the root layout means the
 * ad script — and therefore Auto ads — is not present at all on `/login`, `/register`,
 * `/account` or `/admin`, which is what AdSense policy expects of pages behind a sign-in and what
 * readers expect of an account screen.
 *
 * React 19 hoists this `async` script into the served `<head>` and de-duplicates it by `src`, so
 * it appears exactly once per page and never blocks the devotional text.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdScript />
      {children}
    </>
  );
}
