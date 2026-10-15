'use client';

import { useEffect } from 'react';
import { useLocalStore } from '@/hooks/useLocalStore';
import { applyPrefsToDocument, prefsStore } from '@/lib/reader-data';

const LEGIBLE_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap';

/**
 * Keeps `<html data-reading-*>` in step with the saved reading settings (the inline script in the
 * root layout sets them before first paint; this takes over afterwards, in every tab). The
 * low-vision font is fetched only for readers who choose it.
 */
export function ReadingPrefsSync() {
  const prefs = useLocalStore(prefsStore);

  useEffect(() => {
    applyPrefsToDocument(prefs);
    if (prefs.font === 'legible' && !document.getElementById('font-legible')) {
      const link = document.createElement('link');
      link.id = 'font-legible';
      link.rel = 'stylesheet';
      link.href = LEGIBLE_FONT_HREF;
      document.head.appendChild(link);
    }
  }, [prefs]);

  return null;
}
