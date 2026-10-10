'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthProvider';

/**
 * Client-side route gating for UX only (redirect + friendly screens).
 * The actual enforcement of every privileged operation is in the Worker API.
 */
export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user, status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous' && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname ?? '/')}`);
    }
  }, [status, user, pathname, router]);

  if (status === 'loading' || (!user && status !== 'anonymous')) {
    return (
      <div className="container py-32 text-center text-muted-foreground" role="status">
        Checking your session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-32 text-center text-muted-foreground" role="status">
        Redirecting you to sign in…
      </div>
    );
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="container py-32 text-center">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-destructive/10 text-destructive mx-auto">
          <ShieldAlert className="w-7 h-7" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-4xl mt-5">Restricted area</h1>
        <p className="text-muted-foreground mt-3 max-w-md mx-auto">
          You’re signed in as <strong>{user.email}</strong> with the <code>{user.role}</code> role. This section
          requires {roles.join(' or ')}.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/">Back home</Link>
          </Button>
          <Button asChild>
            <Link href="/devotionals">Read the blog</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
