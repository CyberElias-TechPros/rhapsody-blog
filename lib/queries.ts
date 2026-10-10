/**
 * Centralized React Query keys + defaults for the Worker-backed screens (admin console,
 * account, newsletter). The published devotionals are static content and are read on the
 * server by `lib/content.ts`, so they never appear here.
 *
 * Centralized React Query keys + defaults. Every screen that mutates invalidates through
 * these keys so the UI never shows stale "success but not persisted" states.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { api } from './api';
import type { Channel, PostListParams } from './types';

export const queryKeys = {
  channels: ['channels'] as const,
  channel: (slug: string) => ['channels', slug] as const,
  posts: (params: PostListParams) => ['posts', params] as const,
  post: (channelSlug: string, slug: string) => ['post', channelSlug, slug] as const,
  bookmarkIds: ['me', 'bookmarks', 'ids'] as const,
  bookmarks: ['me', 'bookmarks'] as const,
  follows: ['me', 'follows'] as const,
  adminStats: ['admin', 'stats'] as const,
  adminPosts: (page: number, channel: string, status: string, q: string) => ['admin', 'posts', page, channel, status, q] as const,
  adminUsers: ['admin', 'users'] as const,
  adminSubscribers: ['admin', 'subscribers'] as const,
  adminAudit: ['admin', 'audit'] as const,
};

/** Shared channel list query — deduped across navbar/footer/blog/pages by the query cache. */
export function useChannels(options?: Partial<UseQueryOptions<{ channels: Channel[] }>>) {
  return useQuery({
    queryKey: queryKeys.channels,
    queryFn: ({ signal }) => api.channels.list(signal),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    ...options,
  });
}
