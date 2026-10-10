/**
 * Bookmark + follow mutations shared by list cards, the article page, channel pages and
 * the library. State lives in the query cache (`bookmarkIds` / `follows`), so every screen
 * reflects the server truth and optimistic updates roll back on failure — no
 * "button turned yellow but nothing persisted" situations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { useAuth } from '@/auth/AuthProvider';

export function useBookmarkIds(): Set<string> {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: queryKeys.bookmarkIds,
    queryFn: ({ signal }) => api.me.bookmarkIds(signal),
    enabled: !!user,
    staleTime: 60_000,
  });
  return new Set(data?.ids ?? []);
}

function useToggleBookmark() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, bookmarked }: { postId: string; bookmarked: boolean }) => {
      if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to save posts.');
      if (bookmarked) await api.me.removeBookmark(postId);
      else await api.me.addBookmark(postId);
    },
    onMutate: async ({ postId, bookmarked }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarkIds });
      const prev = queryClient.getQueryData<{ ids: string[] }>(queryKeys.bookmarkIds);
      if (prev) {
        const ids = bookmarked ? prev.ids.filter((i) => i !== postId) : [...prev.ids, postId];
        queryClient.setQueryData(queryKeys.bookmarkIds, { ids });
      }
      return { prev };
    },
    onError: (err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(queryKeys.bookmarkIds, context.prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not update your bookmarks.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
    },
  });
}

/** Convenience wrapper: toggle + friendly prompt when signed out. */
export function useBookmarkToggle() {
  const { user } = useAuth();
  const mutation = useToggleBookmark();
  return {
    toggle: (postId: string, bookmarked: boolean) => {
      if (!user) {
        toast('Sign in to save posts to your library.', { action: { label: 'Sign in', onClick: () => (window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname)) } });
        return;
      }
      mutation.mutate({ postId, bookmarked });
    },
    pending: mutation.isPending,
  };
}

export function useFollows() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.follows,
    queryFn: ({ signal }) => api.me.follows(signal),
    enabled: !!user,
    staleTime: 60_000,
  });

  const toggle = useMutation({
    mutationFn: async ({ slug, following }: { slug: string; following: boolean }) => {
      if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to follow channels.');
      if (following) await api.me.unfollow(slug);
      else await api.me.follow(slug);
    },
    onMutate: async ({ slug, following }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.follows });
      const prev = queryClient.getQueryData<{ items: unknown[]; slugs: string[] }>(queryKeys.follows);
      if (prev) {
        const slugs = following ? prev.slugs.filter((s) => s !== slug) : [...prev.slugs, slug];
        queryClient.setQueryData(queryKeys.follows, { ...prev, slugs });
      }
      return { prev };
    },
    onError: (err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(queryKeys.follows, context.prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not update follows.');
    },
  });

  const slugs = new Set(query.data?.slugs ?? []);
  return {
    slugs,
    isFollowing: (slug: string) => slugs.has(slug),
    toggle: (slug: string) => {
      if (!user) {
        toast('Sign in to follow channels.', { action: { label: 'Sign in', onClick: () => (window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname)) } });
        return;
      }
      toggle.mutate({ slug, following: slugs.has(slug) });
    },
    pending: toggle.isPending,
  };
}
