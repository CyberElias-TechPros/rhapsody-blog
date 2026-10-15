'use client';

import Link from 'next/link';
import { useHydrated, useLocalStore } from '@/hooks/useLocalStore';
import { planCounts, planStore } from '@/lib/reader-data';

/** "You have read 42 of 365 portions" — the running totals behind the tick boxes. */
export function PlanProgress() {
  const plan = useLocalStore(planStore);
  const hydrated = useHydrated();
  if (!hydrated) return null;
  const { one, two } = planCounts(plan);
  if (!one && !two) {
    return <p className="mt-4 text-sm text-muted-foreground">Tick each portion as you read it — your progress is kept on this device.</p>;
  }
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      Your progress: <strong className="text-foreground">{one}</strong> of 365 one-year portions and{' '}
      <strong className="text-foreground">{two}</strong> of 730 two-year portions read.{' '}
      <Link href="/me" className="text-primary hover:underline">
        See My Rhapsody →
      </Link>
    </p>
  );
}
