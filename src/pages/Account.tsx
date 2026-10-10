import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PostCard } from '@/components/PostCard';
import { EmptyState, ErrorState, PageHeader, PostGridSkeleton } from '@/components/common/StateBlocks';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { useAuth } from '@/auth/AuthProvider';
import { useSeo } from '@/hooks/useSeo';
import { formatDate } from '@/lib/format';

const TABS = [
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'following', label: 'Following' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const Account = () => {
  useSeo({ title: 'My library', noindex: true });
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab: TabId = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'bookmarks') as TabId;

  const queryClient = useQueryClient();
  const bookmarks = useQuery({ queryKey: queryKeys.bookmarks, queryFn: ({ signal }) => api.me.bookmarks(signal), staleTime: 30_000 });
  const follows = useQuery({ queryKey: queryKeys.follows, queryFn: ({ signal }) => api.me.follows(signal) });

  const unfollow = useMutation({
    mutationFn: (slug: string) => api.me.unfollow(slug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.follows });
      toast.success('Unfollowed.');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to unfollow.'),
  });

  return (
    <div className="container py-16 max-w-5xl mx-auto">
      <PageHeader
        eyebrow={user?.role ? `Signed in as ${user.role}` : 'Account'}
        title={`Welcome, ${user?.name ?? 'reader'}.`}
        subtitle={user ? `Member since ${formatDate(user.createdAt)} — ${user.email}` : undefined}
      />

      <div role="tablist" aria-label="Account sections" className="mt-8 flex gap-2 border-b border-border/60 pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              const sp = new URLSearchParams(params);
              sp.set('tab', t.id);
              setParams(sp);
            }}
            className={`px-4 py-2.5 text-sm rounded-t-lg font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id ? 'border-primary text-primary bg-secondary/40' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8" role="tabpanel">
        {tab === 'bookmarks' && (
          <>
            {bookmarks.isPending && <PostGridSkeleton count={3} />}
            {bookmarks.isError && <ErrorState error={bookmarks.error} onRetry={() => bookmarks.refetch()} />}
            {bookmarks.isSuccess && bookmarks.data.items.length === 0 && (
              <EmptyState
                title="No saved posts yet"
                hint="Tap the bookmark icon on any card to keep it here for later."
                action={<Button asChild size="sm" variant="outline"><Link to="/blog">Browse the blog</Link></Button>}
              />
            )}
            {bookmarks.isSuccess && bookmarks.data.items.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bookmarks.data.items.map((p, i) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    index={i}
                    bookmarked
                    onToggleBookmark={(post) =>
                      api.me.removeBookmark(post.id).then(
                        () => {
                          void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
                          void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarkIds });
                        },
                        () => toast.error('Could not remove bookmark.')
                      )
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'following' && (
          <>
            {follows.isPending && <div className="h-24 bg-secondary animate-pulse rounded-2xl" aria-busy="true" />}
            {follows.isError && <ErrorState error={follows.error} onRetry={() => follows.refetch()} />}
            {follows.isSuccess && follows.data.items.length === 0 && (
              <EmptyState
                title="Not following any channels"
                hint="Follow a channel to pin it to your library."
                action={<Button asChild size="sm" variant="outline"><Link to="/channels">Browse channels</Link></Button>}
              />
            )}
            {follows.isSuccess && follows.data.items.length > 0 && (
              <ul className="grid sm:grid-cols-2 gap-4">
                {follows.data.items.map((c) => (
                  <li key={c.slug} className="gradient-card rounded-2xl border border-border/60 p-5 flex items-center gap-4">
                    <Link to={`/channels/${c.slug}`} className={`grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br ${c.accent} text-white shrink-0`}>
                      <span className="font-serif font-bold">{c.name.slice(0, 1)}</span>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/channels/${c.slug}`} className="font-medium hover:text-primary truncate block">{c.name}</Link>
                      <p className="text-xs text-muted-foreground">{c.postCount} posts</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => unfollow.mutate(c.slug)} disabled={unfollow.isPending} aria-label={`Unfollow ${c.name}`}>
                      Unfollow
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'settings' && <SettingsPane />}
      </div>
    </div>
  );
};

const SettingsPane = () => {
  const { logoutAllDevices } = useAuth();
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fields.newPassword.length < 10) return toast.error('New password needs at least 10 characters.');
    if (fields.newPassword !== fields.confirm) return toast.error('New passwords do not match.');
    setPending(true);
    try {
      const { token } = await api.auth.changePassword(fields.currentPassword, fields.newPassword);
      localStorage.setItem('meaning.auth.token', token);
      toast.success('Password updated — other devices were signed out.');
      setFields({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Password change failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
      <form onSubmit={onSubmit} className="gradient-card rounded-2xl border border-border/60 p-6 space-y-4">
        <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" aria-hidden="true" /> Change password
        </h2>
        <div className="space-y-2">
          <Label htmlFor="cur">Current password</Label>
          <Input id="cur" type="password" autoComplete="current-password" required value={fields.currentPassword} onChange={(e) => setFields((f) => ({ ...f, currentPassword: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new">New password</Label>
          <Input id="new" type="password" autoComplete="new-password" required minLength={10} value={fields.newPassword} onChange={(e) => setFields((f) => ({ ...f, newPassword: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" required value={fields.confirm} onChange={(e) => setFields((f) => ({ ...f, confirm: e.target.value }))} />
        </div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />Updating</> : 'Update password'}
        </Button>
        <p className="text-xs text-muted-foreground">Updating signs out all other devices and keeps this one signed in.</p>
      </form>

      <div className="space-y-6">
        <div className="gradient-card rounded-2xl border border-border/60 p-6">
          <h2 className="font-serif text-xl font-semibold">Security</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Sign out of every device at once. Useful if you used a shared computer.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => {
              await logoutAllDevices();
              toast('Signed out everywhere.');
            }}
          >
            <LogOut className="w-4 h-4 mr-2" aria-hidden="true" /> Sign out all devices
          </Button>
        </div>
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          <Badge variant="outline" className="mb-2">Privacy</Badge>
          <p>
            We store your name, email and hashed password only. Bookmarks and follows are private to your account
            and never shown to other readers. Want your data deleted? Ask an admin — they can remove your account.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Account;
