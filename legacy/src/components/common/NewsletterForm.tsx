import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';

/**
 * Email digest signup — real POST /api/subscribers. The API is idempotent per email
 * (re-subscribe re-confirms + clears a previous unsubscribe), so client state can be honest.
 */
export function NewsletterForm({ variant = 'light', className = '' }: { variant?: 'light' | 'onHero'; className?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const onHero = variant === 'onHero';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setState('loading');
    try {
      await api.subscribers.subscribe(value);
      setState('done');
      setEmail('');
    } catch (err) {
      setState('idle');
      toast.error(err instanceof ApiError ? err.message : 'Subscription failed — please try again.');
    }
  }

  if (state === 'done') {
    return (
      <p role="status" className={`flex items-center gap-2 text-sm font-medium ${onHero ? 'text-primary-foreground' : 'text-primary'}`}>
        <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> You’re on the list — thank you!
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`flex flex-col sm:flex-row gap-2 ${className}`} aria-label="Email digest signup">
      <label htmlFor={`newsletter-${variant}`} className="sr-only">
        Email address
      </label>
      <Input
        id={`newsletter-${variant}`}
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === 'loading'}
        className={onHero ? 'bg-white/15 border-white/25 placeholder:text-primary-foreground/60 text-primary-foreground' : 'bg-card'}
      />
      <Button
        type="submit"
        disabled={state === 'loading'}
        className={onHero ? 'bg-white text-foreground hover:bg-white/90 shrink-0' : 'gradient-hero text-primary-foreground border-0 shrink-0'}
      >
        {state === 'loading' ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Subscribing
          </>
        ) : (
          'Subscribe'
        )}
      </Button>
    </form>
  );
}
