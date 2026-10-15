'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { AUDIENCE_ORDER, type AudienceId } from '@/lib/audiences';
import { audienceCookieString } from '@/lib/audience-pref';
import { writeCookie } from '@/lib/browser';
import { cn } from '@/lib/utils';

const LABEL: Record<AudienceId, string> = {
  adults: 'Adults',
  teens: 'TeeVo · Teens',
  'early-readers': 'Early Readers',
};

/**
 * "Show me: Adults · TeeVo · Early Readers" — remembered in a cookie so the home page and
 * `/today` open on the reader's edition from then on (and on the installed app's start page).
 */
export function AudiencePicker({ current, className }: { current: AudienceId; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (audience: AudienceId) => {
    if (audience === current) return;
    writeCookie(audienceCookieString(audience === 'adults' ? null : audience));
    startTransition(() => router.refresh());
  };

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <div role="radiogroup" aria-label="Which edition to show" className="inline-flex rounded-full border border-border bg-card/80 p-1 backdrop-blur">
        {AUDIENCE_ORDER.map((audience) => (
          <button
            key={audience}
            type="button"
            role="radio"
            aria-checked={current === audience}
            onClick={() => choose(audience)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              current === audience ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {LABEL[audience]}
          </button>
        ))}
      </div>
      {pending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Switching edition" />}
    </div>
  );
}
