import { ADSENSE_CLIENT, ADS_ENABLED } from '@/lib/ads';

/**
 * The AdSense loader, exactly as Google provides it:
 *
 *     <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-…"
 *             crossorigin="anonymous"></script>
 *
 * Rendered as a real `<script async>` in the document head rather than through `next/script`:
 * `next/script`'s `afterInteractive` strategy only emits a `<link rel="preload">` in the served
 * HTML and injects the tag after hydration, and AdSense checks the *served* markup when it
 * verifies a site and when Auto ads decide where to place units. `async` keeps it off the
 * critical path, so the devotional text is never blocked by it.
 *
 * Loading this alone switches on **Auto ads**; `AdSlot` adds the hand-placed units. Renders
 * nothing outside production unless `NEXT_PUBLIC_ADS_ENABLED=true`.
 */
export function AdScript() {
  if (!ADS_ENABLED) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      crossOrigin="anonymous"
    />
  );
}
