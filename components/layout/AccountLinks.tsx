'use client';

import Link from 'next/link';
import { hasRole, useAuth } from '@/auth/AuthProvider';

/** Signed-in footer links — kept in its own client component so `Footer` can stay on the server. */
export function AccountLinks() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <li>
        <Link href="/account" className="hover:text-primary transition-colors">
          My library
        </Link>
      </li>
      {hasRole(user, ['editor', 'admin']) && (
        <li>
          <Link href="/admin" className="hover:text-primary transition-colors">
            Admin
          </Link>
        </li>
      )}
    </>
  );
}
