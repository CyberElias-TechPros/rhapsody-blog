'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Share the article: the Web Share API on mobile, clipboard everywhere else. The URL is read
 * from `window.location` so the component stays free of environment-dependent site URLs and
 * renders identically on the server and the client.
 */
export function ShareRow({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {
      return; // the reader dismissed the native share sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={share}>
      {copied ? (
        <Check className="w-4 h-4 mr-2 text-green-600" aria-hidden="true" />
      ) : (
        <Share2 className="w-4 h-4 mr-2" aria-hidden="true" />
      )}
      {copied ? 'Copied!' : 'Share'}
    </Button>
  );
}
