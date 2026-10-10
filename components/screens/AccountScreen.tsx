'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Bookmark, KeyRound, Loader2, LogOut, MonitorSmartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DevotionalCard } from '@/components/DevotionalCard';
import { EmptyState, PageHeader } from '@/components/common/StateBlocks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/auth/AuthProvider';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import type { DevotionalSummary } from '@/lib/types';

/**
 * "My library".
 *
 * Two halves, deliberately:
 * - Saved devotionals are local (localStorage) so they work with no account, instantly, and
 *   survive being signed out.
 * - The account panel is the Worker-backed session: password change, sign out everywhere,
 *   sign out. Everything privileged is enforced by the Worker, not here.
 */
export function AccountScreen({ posts }: { posts: DevotionalSummary[] }) {
  const { user, status, logout, logoutAllDevices, refresh } = useAuth();
  const { slugs, hydrated, remove, clear } = useSavedPosts();

  const saved = hydrated ? posts.filter((p) => slugs.includes(p.slug)) : [];
  // Newest first, matching the rest of the site.
  const ordered = [...saved].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="container py-16 max-w-5xl mx-auto">
      <PageHeader
        eyebrow={user?.role ? `Signed in as ${user.role}` : 'Your library'}
        title={`Welcome, ${user?.name ?? 'reader'}.`}
        subtitle={
          user
            ? `Member since ${formatDate(user.createdAt)} — ${user.email}`
            : 'Saved devotionals live in this browser, so no account is needed to keep a reading list.'
        }
      />

      <section aria-labelledby="saved-heading" className="mt-12">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h2 id="saved-heading" className="font-serif text-3xl font-semibold flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-primary" aria-hidden="true" /> Saved devotionals
            <Badge variant="secondary" className="ml-1">
              {hydrated ? ordered.length : '…'}
            </Badge>
          </h2>
          {hydrated && ordered.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clear();
                toast.success('Cleared your saved devotionals.');
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" /> Clear all
            </Button>
          )}
        </div>

        {!hydrated ? (
          <p className="mt-6 text-sm text-muted-foreground" role="status">
            Loading your saved devotionals…
          </p>
        ) : ordered.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            hint={
              <>
                Tap the bookmark icon on any devotional to keep it here — try{' '}
                <Link href="/devotionals" className="text-primary hover:underline">
                  today&apos;s library
                </Link>
                .
              </>
            }
          />
        ) : (
          <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ordered.map((post, i) => (
              <div key={post.slug} className="relative">
                <DevotionalCard post={post} index={i} compact />
                <button
                  type="button"
                  onClick={() => {
                    remove(post.slug);
                    toast.success(`Removed “${post.title}”.`);
                  }}
                  className="absolute bottom-4 left-4 z-10 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove “${post.title}” from saved devotionals`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="account-heading" className="mt-20">
        <h2 id="account-heading" className="font-serif text-3xl font-semibold">
          Account &amp; security
        </h2>

        {status === 'loading' ? (
          <p className="mt-6 text-sm text-muted-foreground flex items-center gap-2" role="status">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Checking your session…
          </p>
        ) : !user ? (
          <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <p className="text-sm text-muted-foreground flex-1">
              Sign in to change your password, manage the newsletter digest from the admin console, or sign out
              of every device.
            </p>
            <div className="flex gap-2 shrink-0">
              <Button asChild>
                <Link href="/login?next=%2Faccount">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/register">Create account</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid lg:grid-cols-2 gap-5">
            <ProfileCard name={user.name} email={user.email} role={user.role} createdAt={user.createdAt} onRefresh={refresh} />
            <PasswordCard />
            <div className="lg:col-span-2 rounded-2xl border border-border/70 bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="font-medium flex items-center gap-2">
                  <MonitorSmartphone className="w-4 h-4 text-primary" aria-hidden="true" /> Sessions
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sign out everywhere invalidates every token issued for this account.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" onClick={() => void logoutAllDevices()}>
                  Sign out everywhere
                </Button>
                <Button variant="destructive" onClick={logout}>
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" /> Sign out
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileCard({
  name,
  email,
  role,
  createdAt,
  onRefresh,
}: {
  name: string;
  email: string;
  role: string;
  createdAt: string;
  onRefresh: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6">
      <p className="font-medium">Profile</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium text-right">{name}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium text-right break-all">{email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Role</dt>
          <dd>
            <Badge variant="secondary">{role}</Badge>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Member since</dt>
          <dd className="font-medium">{formatDate(createdAt)}</dd>
        </div>
      </dl>
      <Button
        variant="outline"
        size="sm"
        className="mt-5"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await onRefresh();
            toast.success('Session refreshed.');
          } finally {
            setPending(false);
          }
        }}
      >
        {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />} Refresh session
      </Button>
    </div>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 10) {
      setError('Use at least 10 characters for the new password.');
      return;
    }
    setPending(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed — your session was reissued.');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 0
            ? 'Cannot reach the accounts service right now.'
            : err.message
          : 'Could not change the password.'
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border/70 bg-card p-6 space-y-4" noValidate>
      <p className="font-medium flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" aria-hidden="true" /> Change password
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least 10 characters — the Worker re-validates it.</p>
      </div>
      <Button type="submit" disabled={pending || !currentPassword || !newPassword}>
        {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />} Update password
      </Button>
    </form>
  );
}
