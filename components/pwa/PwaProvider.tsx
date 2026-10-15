'use client';

import { useEffect } from 'react';
import { startInstallCapture } from '@/components/pwa/install';

/**
 * Registers the service worker (`public/sw.js`) in production builds and starts listening for
 * the browser's install prompt. The script URL carries the build id, so every deploy installs a
 * fresh worker that clears the previous build's static cache (see `sw.js`).
 *
 * Development is left alone: a worker caching `next dev` output makes hot reload misbehave.
 * Set `NEXT_PUBLIC_SW_DEV=true` to test offline behaviour locally anyway.
 */
export function PwaProvider() {
  useEffect(() => {
    startInstallCapture();
    const enabled = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SW_DEV === 'true';
    if (!enabled || !('serviceWorker' in navigator)) return;
    const version = encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev');
    const register = () => {
      navigator.serviceWorker.register(`/sw.js?v=${version}`, { scope: '/' }).catch(() => {
        /* unsupported context (private mode, file://) — the site works without it */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
