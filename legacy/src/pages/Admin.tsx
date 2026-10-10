import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  CheckCircle2, Download, FileWarning, Loader2, RefreshCw, Settings2, ShieldAlert, Users2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { useAuth } from '@/auth/AuthProvider';
import { useSeo } from '@/hooks/useSeo';
import { formatCount, timeAgo } from '@/lib/format';
import type { AdminPostRow, SyncResult } from '@/lib/types';
import { PaginationBar } from '@/components/common/PaginationBar';

const TABS = ['overview', 'posts', 'subscribers', 'users', 'audit'] as const;
type AdminTab = (typeof TABS)[number];

const Admin = () => {
  useSeo({ title: 'Admin', noindex: true });
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as AdminTab | null;
  const tab: AdminTab =
    requested && TABS.includes(requested) && ((requested !== 'users' && requested !== 'audit') || isAdmin) ? requested : 'overview';

  return (
    <div className="container py-14 max-w-6xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="text-sm uppercase tracking-wider text-primary font-medium">Admin · {user?.role}</span>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold mt-2">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Channel sync, content moderation, subscribers and users.</p>
        </div>
      </div>

      <div role="tablist" aria-label="Admin sections" className="mt-8 flex flex-wrap gap-1 border-b border-border/60">
        {TABS.filter((t) => (t !== 'users' && t !== 'audit') || isAdmin).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              const sp = new URLSearchParams(params);
              sp.set('tab', t);
              setParams(sp);
            }}
            className={`px-4 py-2.5 text-sm capitalize rounded-t-lg font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-primary bg-secondary/40' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-8" role="tabpanel">
        {tab === 'overview' && <OverviewPane />}
        {tab === 'posts' && <PostsPane />}
        {tab === 'subscribers' && <SubscribersPane />}
        {tab === 'users' && isAdmin && <UsersPane />}
        {tab === 'audit' && isAdmin && <AuditPane />}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Overview: stats + sync controls
// ---------------------------------------------------------------------------

const OverviewPane = () => {
  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: queryKeys.adminStats, queryFn: () => api.admin.stats() });
  const [syncing, setSyncing] = useState<string | 'all' | null>(null);

  const runSync = async (slug: string | 'all') => {
    setSyncing(slug);
    try {
      const results: SyncResult[] =
        slug === 'all' ? (await api.admin.syncAll()).results : [(await api.admin.syncChannel(slug)).result];
      const created = results.reduce((n, r) => n + (r.created ?? 0), 0);
      const failed = results.filter((r) => r.error);
      if (failed.length > 0) {
        toast.warning(`Sync finished with problems — ${failed.map((f) => `${f.channel}: ${f.error}`).join('; ')}`);
      } else {
        toast.success(`Sync complete — ${created} new post${created === 1 ? '' : 's'}.`);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminStats });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.channels });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Sync failed.');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-10">
      {stats.isPending && (
        <div className="grid sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      )}
      {stats.isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive flex items-center gap-3" role="alert">
          <ShieldAlert className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>Couldn’t load stats: {stats.error instanceof ApiError ? stats.error.message : 'unknown error'}</span>
          <Button size="sm" variant="outline" onClick={() => stats.refetch()}>Retry</Button>
        </div>
      )}
      {stats.isSuccess && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Channels" value={formatCount(stats.data.channels)} icon={Settings2} />
            <StatCard label="Published posts" value={formatCount(stats.data.posts.published)} icon={CheckCircle2} hint={`${formatCount(stats.data.posts.draft)} draft · ${formatCount(stats.data.posts.hidden)} hidden`} />
            <StatCard label="Users" value={formatCount(stats.data.users.total)} icon={Users2} hint={`${stats.data.users.admins} admin`} />
            <StatCard label="Subscribers" value={formatCount(stats.data.subscribers)} icon={Download} hint="active emails" />
          </div>

          <section aria-labelledby="sync-status">
            <div className="flex items-center justify-between mb-4">
              <h2 id="sync-status" className="font-serif text-2xl font-semibold">Channel sync status</h2>
              <Button onClick={() => runSync('all')} disabled={syncing !== null} className="gradient-hero text-primary-foreground border-0">
                {syncing === 'all' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />}
                Sync all
              </Button>
            </div>
            <div className="gradient-card rounded-2xl border border-border/60 overflow-x-auto shadow-soft">
              <table className="w-full text-sm min-w-[640px]">
                <caption className="sr-only">Telegram channel sync status with post counts and per-channel sync actions</caption>
                <thead className="bg-secondary/60 text-left">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Channel</th>
                    <th scope="col" className="px-5 py-3 font-medium">Telegram</th>
                    <th scope="col" className="px-5 py-3 font-medium text-right">Posts</th>
                    <th scope="col" className="px-5 py-3 font-medium">Last sync</th>
                    <th scope="col" className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.data.channelSync.map((c) => (
                    <tr key={c.slug} className="border-t border-border/60">
                      <td className="px-5 py-3.5 font-medium">
                        {c.name}
                        {!c.is_active && <Badge variant="outline" className="ml-2 text-xs">inactive</Badge>}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">@{c.username}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">{c.post_count}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {c.last_synced_at ? timeAgo(c.last_synced_at) : 'never'} <span className="text-xs">· #{c.last_message_id}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button size="sm" variant="outline" disabled={syncing !== null} onClick={() => runSync(c.slug)} aria-label={`Sync ${c.name}`}>
                          {syncing === c.slug ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 mr-2" aria-hidden="true" /> Sync
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              The API worker also runs this sync every 15 minutes automatically (Cloudflare Cron). Manual syncs are rate-limited.
            </p>
          </section>
        </>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, hint }: { label: string; value: string; icon: React.ElementType; hint?: string }) => (
  <div className="gradient-card rounded-2xl p-5 border border-border/60 shadow-soft flex items-center gap-4">
    <div className="grid place-items-center w-11 h-11 rounded-xl bg-secondary shrink-0">
      <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <div className="text-2xl font-serif font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground truncate">{label}</div>
      {hint && <div className="text-xs text-muted-foreground/70">{hint}</div>}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Posts moderation
// ---------------------------------------------------------------------------

const PAGE = 20;

const PostsPane = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const channels = useQuery({ queryKey: queryKeys.channels, queryFn: ({ signal }) => api.channels.list(signal), staleTime: 5 * 60_000 });
  const channelName = new Map((channels.data?.channels ?? []).map((c) => [c.slug, c.name]));

  const list = useQuery({
    queryKey: queryKeys.adminPosts(page, channel, status, q),
    queryFn: () => api.admin.posts({ page, limit: PAGE, channel: channel === 'all' ? undefined : channel, status: status === 'all' ? undefined : status, q: q || undefined }),
    placeholderData: keepPreviousData,
  });

  const [editing, setEditing] = useState<AdminPostRow | null>(null);
  const [deleting, setDeleting] = useState<AdminPostRow | null>(null);

  const setStatusMut = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: string }) => api.admin.patchPost(id, { status: s }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminStats });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.admin.deletePost(id),
    onSuccess: () => {
      toast.success('Post deleted.');
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.channels });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminStats });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed.'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(qInput.trim());
            setPage(1);
          }}
        >
          <Label htmlFor="post-search" className="sr-only">Search posts</Label>
          <Input id="post-search" placeholder="Search title/content…" value={qInput} onChange={(e) => setQInput(e.target.value)} className="w-60" />
        </form>
        <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1); }}>
          <SelectTrigger className="w-52" aria-label="Filter by channel"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {(channels.data?.channels ?? []).map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
        {q && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(''); setQInput(''); }}>Clear “{q}”</Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{list.data ? `${formatCount(list.data.total)} posts` : ''}</span>
      </div>

      {list.isPending && <Skeleton className="h-64 rounded-2xl" />}
      {list.isError && (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          {list.error instanceof ApiError ? list.error.message : 'Failed to load posts.'} <Button size="sm" variant="outline" onClick={() => list.refetch()}>Retry</Button>
        </div>
      )}
      {list.isSuccess && list.data.items.length === 0 && (
        <p className="text-center text-muted-foreground py-14">No posts match these filters.</p>
      )}
      {list.isSuccess && list.data.items.length > 0 && (
        <div className={`gradient-card rounded-2xl border border-border/60 overflow-x-auto shadow-soft ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
          <table className="w-full text-sm min-w-[820px]">
            <caption className="sr-only">Moderation table of synced posts</caption>
            <thead className="bg-secondary/60 text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Title</th>
                <th scope="col" className="px-4 py-3 font-medium">Channel</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Views</th>
                <th scope="col" className="px-4 py-3 font-medium">Published</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((p) => (
                <tr key={p.id} className="border-t border-border/60 align-top">
                  <td className="px-4 py-3 max-w-[22rem]">
                    <span className="font-medium block truncate">{p.title}</span>
                    <span className="text-xs text-muted-foreground truncate block">{p.slug}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{channelName.get(p.channelSlug) ?? p.channelSlug}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCount(p.views)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{timeAgo(p.publishedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5 flex-wrap">
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`/blog/${p.channelSlug}/${p.slug}`} target="_blank" rel="noreferrer" aria-label={`Preview “${p.title}”`}>View</a>
                      </Button>
                      {p.status !== 'published' ? (
                        <Button size="sm" variant="outline" onClick={() => setStatusMut.mutate({ id: p.id, status: 'published' })} disabled={setStatusMut.isPending}>Publish</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setStatusMut.mutate({ id: p.id, status: 'hidden' })} disabled={setStatusMut.isPending}>Hide</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(p)} aria-label={`Delete “${p.title}”`}>
                        <FileWarning className="w-4 h-4 mr-1.5" aria-hidden="true" />Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationBar page={page} totalPages={list.data?.totalPages ?? 1} onPageChange={setPage} />

      <EditPostDialog post={editing} onClose={() => setEditing(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” will be removed from the database (and its mirrored cover from storage).
              The Telegram sync may re-create it if the source message is still listed — to keep it out,
              choose <strong>Hide</strong> instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMut.mutate(deleting.id);
              }}
            >
              {deleteMut.isPending ? 'Deleting…' : 'Delete forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant={status === 'published' ? 'default' : status === 'draft' ? 'secondary' : 'destructive'} className="capitalize">
    {status}
  </Badge>
);

const EditPostDialog = ({ post, onClose }: { post: AdminPostRow | null; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('published');
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Initialize form fields when the dialog target changes (renders synchronously, no flicker).
  if (post && loadedId !== post.id) {
    setLoadedId(post.id);
    setTitle(post.title);
    setExcerpt(post.excerpt);
    setTags(post.tags.join(', '));
    setStatus(post.status);
  }

  const save = useMutation({
    mutationFn: () =>
      api.admin.patchPost(post!.id, {
        title: title.trim(),
        excerpt: excerpt.trim(),
        status,
        tags: tags.split(',').map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean).slice(0, 15),
      }),
    onSuccess: () => {
      toast.success('Post updated.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed.'),
  });

  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
          <DialogDescription>Slug and source links stay stable so shared URLs keep working.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            <p className="text-xs text-muted-foreground">{title.trim().length}/200 · minimum 5 characters</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-excerpt">Excerpt</Label>
            <Textarea id="edit-excerpt" rows={3} maxLength={500} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags (comma separated)</Label>
              <Input id="edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || title.trim().length < 5}>
            {save.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />Saving</> : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

const SubscribersPane = () => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: queryKeys.adminSubscribers, queryFn: () => api.admin.subscribers({ limit: 500 }) });
  const { user } = useAuth();

  const del = useMutation({
    mutationFn: (email: string) => api.admin.deleteSubscriber(email),
    onSuccess: () => {
      toast.success('Subscriber removed.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminSubscribers });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminStats });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed.'),
  });

  const exportCsv = async () => {
    try {
      await api.admin.exportSubscribersCsv();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Export failed.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{list.data ? `${formatCount(list.data.total)} total subscribers` : 'Loading…'}</p>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!list.data}>
          <Download className="w-4 h-4 mr-2" aria-hidden="true" /> Export CSV
        </Button>
      </div>
      {list.isPending && <Skeleton className="h-48 rounded-2xl" />}
      {list.isError && <ErrorRow message="Couldn't load subscribers." retry={() => list.refetch()} />}
      {list.isSuccess && (
        <div className="gradient-card rounded-2xl border border-border/60 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <caption className="sr-only">Subscriber list</caption>
            <thead className="bg-secondary/60 text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Channels</th>
                <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                <th scope="col" className="px-4 py-3 font-medium">State</th>
                {user?.role === 'admin' && <th scope="col" className="px-4 py-3 font-medium text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {list.data.items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No subscribers yet — the footer & homepage forms feed this list.</td></tr>
              )}
              {list.data.items.map((s) => (
                <tr key={s.email} className="border-t border-border/60">
                  <td className="px-4 py-3 font-medium">{s.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.channels.length ? s.channels.join(', ') : 'all'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{timeAgo(s.createdAt)}</td>
                  <td className="px-4 py-3">{s.unsubscribedAt ? <Badge variant="secondary">unsubscribed</Badge> : <Badge>active</Badge>}</td>
                  {user?.role === 'admin' && (
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => del.mutate(s.email)} disabled={del.isPending}>
                        Remove
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Users + audit (admin only)
// ---------------------------------------------------------------------------

const UsersPane = () => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: queryKeys.adminUsers, queryFn: () => api.admin.users() });

  const patch = useMutation({
    mutationFn: ({ id, patch: p }: { id: string; patch: { role?: string; isActive?: boolean } }) => api.admin.patchUser(id, p),
    onSuccess: () => {
      toast.success('User updated.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminStats });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed.'),
  });

  return (
    <div className="gradient-card rounded-2xl border border-border/60 overflow-x-auto">
      {list.isPending && <Skeleton className="h-40 rounded-2xl m-4" />}
      {list.isError && <ErrorRow message="Couldn't load users." retry={() => list.refetch()} />}
      {list.isSuccess && (
        <table className="w-full text-sm min-w-[720px]">
          <caption className="sr-only">User management</caption>
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Email</th>
              <th scope="col" className="px-4 py-3 font-medium">Role</th>
              <th scope="col" className="px-4 py-3 font-medium">Last login</th>
              <th scope="col" className="px-4 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {list.data.items.map((u) => (
              <tr key={u.id} className="border-t border-border/60">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <Select value={u.role} onValueChange={(v) => v !== u.role && patch.mutate({ id: u.id, patch: { role: v } })}>
                    <SelectTrigger className="w-32" aria-label={`Role for ${u.email}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">user</SelectItem>
                      <SelectItem value="editor">editor</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'never'}</td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant={u.isActive ? 'outline' : 'destructive'}
                    onClick={() => patch.mutate({ id: u.id, patch: { isActive: !u.isActive } })}
                    aria-pressed={u.isActive}
                    disabled={patch.isPending}
                  >
                    {u.isActive ? 'Active' : 'Disabled'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const AuditPane = () => {
  const list = useQuery({ queryKey: queryKeys.adminAudit, queryFn: () => api.admin.audit(100) });
  return (
    <div className="gradient-card rounded-2xl border border-border/60 overflow-x-auto">
      {list.isPending && <Skeleton className="h-40 rounded-2xl m-4" />}
      {list.isError && <ErrorRow message="Couldn't load the audit log." retry={() => list.refetch()} />}
      {list.isSuccess && (
        <table className="w-full text-sm min-w-[640px]">
          <caption className="sr-only">Recent administrative actions</caption>
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">When</th>
              <th scope="col" className="px-4 py-3 font-medium">Actor</th>
              <th scope="col" className="px-4 py-3 font-medium">Action</th>
              <th scope="col" className="px-4 py-3 font-medium">Resource</th>
              <th scope="col" className="px-4 py-3 font-medium">Meta</th>
            </tr>
          </thead>
          <tbody>
            {list.data.items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nothing logged yet.</td></tr>
            )}
            {list.data.items.map((a) => (
              <tr key={a.id} className="border-t border-border/60">
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap" title={a.createdAt}>{timeAgo(a.createdAt)}</td>
                <td className="px-4 py-2.5">{a.actorEmail ?? <span className="text-muted-foreground">system</span>}</td>
                <td className="px-4 py-2.5"><Badge variant="outline" className="font-mono text-[11px]">{a.action}</Badge></td>
                <td className="px-4 py-2.5 text-muted-foreground">{a.resource}{a.resourceId ? `#${a.resourceId.slice(0, 8)}` : ''}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[16rem] truncate" title={JSON.stringify(a.meta)}>{JSON.stringify(a.meta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const ErrorRow = ({ message, retry }: { message: string; retry: () => void }) => (
  <div role="alert" className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center justify-between gap-3">
    <span>{message}</span>
    <Button size="sm" variant="outline" onClick={retry}>Retry</Button>
  </div>
);

export default Admin;
