'use client';

import type { ReactNode } from 'react';
import { useLocalStore } from '@/hooks/useLocalStore';
import { bibleGatewayUrl, type BibleVersion } from '@/lib/bible';
import { prefsStore } from '@/lib/reader-data';

/**
 * A scripture reference that opens the passage on BibleGateway — in the translation the
 * reference names ("NKJV") or, failing that, the reader's preferred one (Reading settings).
 */
export function BibleRefLink({ query, version, children }: { query: string; version?: BibleVersion; children: ReactNode }) {
  const prefs = useLocalStore(prefsStore);
  const chosen = version ?? prefs.version;
  return (
    <a
      href={bibleGatewayUrl(query, chosen)}
      target="_blank"
      rel="noopener noreferrer"
      className="bible-ref"
      title={`Read ${query} (${chosen}) on BibleGateway`}
    >
      {children}
    </a>
  );
}
