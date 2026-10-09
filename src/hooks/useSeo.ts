import { useEffect } from 'react';

const SITE = "Meaning";
const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined || "").replace(/\/+$/, "");

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Per-view SEO head management for this SPA (titles, description, canonical, OG).
 * Full SSR/prerender remains a documented future step; robots+sitemap come from the API worker.
 */
export function useSeo(opts: { title: string; description?: string; path?: string; noindex?: boolean }): void {
  const { title, description, path, noindex } = opts;
  useEffect(() => {
    const full = title === SITE ? `${SITE} — Telegram channels reborn as a blog` : `${title} — ${SITE}`;
    document.title = full;
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    setMeta('property', 'og:title', full);
    setMeta('name', 'twitter:title', full);
    if (path !== undefined) {
      const url = SITE_URL ? `${SITE_URL}${path}` : undefined;
      if (url) {
        setCanonical(url);
        setMeta('property', 'og:url', url);
      }
    }
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
  }, [title, description, path, noindex]);
}
