/**
 * Telegram sync orchestration.
 *
 * - Fetches the public /s/ preview page per channel with a hard timeout.
 * - Parses it with the native HTMLRewriter (services/telegram/parse.ts).
 * - Upserts posts idempotently: UNIQUE(channel_slug, telegram_message_id) + INSERT OR IGNORE
 *   means re-running a sync is a no-op and re-syncs never resurrect moderated content.
 * - `last_message_id` is a high-water mark so already-imported messages are skipped cheaply.
 * - Per-channel errors are isolated: one dead channel can never break the others (cron-safe).
 */

import type { Env } from '../../types';
import type { ChannelRow } from '../../types';
import { nowIso } from '../../lib/util';
import { logInfo, logWarn } from '../../lib/logging';
import { channels as channelsRepo } from '../../repos/channels';
import { posts as postsRepo } from '../../repos/posts';
import { parseTelegramPreview } from './parse';
import { transformMessage } from './transform';
import { mediaKeyFor, mirrorCover } from '../media';

export type WaitUntil = (p: Promise<unknown>) => void;

const FETCH_TIMEOUT_MS = 15_000;

export interface ChannelSyncResult {
  channel: string;
  fetched: number;
  created: number;
  skipped: number;
  syncedAt: string;
  error?: string;
}

export async function fetchChannelMessages(username: string): Promise<Awaited<ReturnType<typeof parseTelegramPreview>>> {
  const url = `https://t.me/s/${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; RhapsodyBot/1.0; +https://github.com/CyberElias-TechPros/rhapsody-blog)',
      'accept-language': 'en',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cf: { cacheTtl: 60, cacheEverything: true } as RequestInitCfProperties,
  });
  if (!res.ok) throw new Error(`Telegram preview returned HTTP ${res.status}`);
  const html = await res.text();
  return parseTelegramPreview(html, username);
}

export async function syncChannel(env: Env, channel: ChannelRow, waitUntil?: WaitUntil): Promise<ChannelSyncResult> {
  const messages = await fetchChannelMessages(channel.username);
  let created = 0;
  let skipped = 0;
  let maxId = channel.last_message_id || 0;
  const mirrorJobs: Promise<unknown>[] = [];

  for (const m of messages) {
    if (m.messageId <= (channel.last_message_id || 0)) {
      skipped++;
      continue;
    }
    const derived = transformMessage(m, { slug: channel.slug, name: channel.name });
    const id = crypto.randomUUID();

    const coverKey = m.coverImage ? mediaKeyFor(channel.slug, m.messageId, m.coverImage) : null;

    const inserted = await postsRepo.insertIfAbsent(env.DB, {
      id,
      channel_id: channel.id,
      channel_slug: channel.slug,
      channel_name: channel.name,
      telegram_message_id: m.messageId,
      telegram_url: m.telegramUrl,
      title: derived.title,
      slug: derived.slug,
      excerpt: derived.excerpt,
      content: derived.content,
      // The original (possibly expiring) CDN URL is always kept; once the R2 copy lands,
      // the background job switches `cover_key` over. Readers prefer cover_key when set.
      cover_url: m.coverImage,
      cover_key: '',
      tags: JSON.stringify(derived.tags),
      published_at: nowIso(new Date(m.publishedAt)),
      reading_minutes: derived.readingMinutes,
    });
    if (inserted) {
      created++;
      if (m.messageId > maxId) maxId = m.messageId;
      if (m.coverImage && coverKey) {
        mirrorJobs.push(
          mirrorCover(env, m.coverImage, coverKey).then((ok) => {
            if (ok) return postsRepo.setCoverKey(env.DB, id, coverKey);
          })
        );
      }
    } else {
      skipped++;
    }
  }

  await channelsRepo.markSynced(env.DB, channel.slug, maxId);
  // Media mirroring is non-blocking: the HTTP response (manual admin sync) should not wait
  // on N image downloads. The runtime keeps the isolate alive until these settle.
  if (mirrorJobs.length > 0) {
    const settle = Promise.allSettled(mirrorJobs);
    if (waitUntil) waitUntil(settle);
    else await settle;
  }
  return { channel: channel.slug, fetched: messages.length, created, skipped, syncedAt: nowIso() };
}

export async function syncAllChannels(env: Env, waitUntil?: WaitUntil): Promise<ChannelSyncResult[]> {
  const list = await channelsRepo.listActive(env.DB);
  const results: ChannelSyncResult[] = [];
  for (const c of list) {
    try {
      results.push(await syncChannel(env, c, waitUntil));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logWarn('sync: channel failed', { channel: c.slug, error: message });
      results.push({ channel: c.slug, fetched: 0, created: 0, skipped: 0, syncedAt: nowIso(), error: message });
    }
  }
  const created = results.reduce((n, r) => n + r.created, 0);
  logInfo('sync: complete', { channels: results.length, created });
  return results;
}

export interface SeedChannel {
  id: string;
  slug: string;
  name: string;
  username: string;
  description: string;
  accent: string;
}

export const DEFAULT_CHANNELS: SeedChannel[] = [
  {
    slug: 'rhapsody-of-realities',
    name: 'Rhapsody of Realities',
    username: 'rhapsody_of_realities',
    description: 'Daily devotionals from the world’s #1 daily devotional — giving your life a meaning.',
    accent: 'from-primary to-primary-glow',
    id: 'ch_rhapsody_of_realities',
  },
  {
    slug: 'pastor-chris-teachings',
    name: 'Pastor Chris Teachings',
    username: 'PastorChrisOyakhilomeMessageText',
    description: 'Inspired teachings and messages from Pastor Chris Oyakhilome.',
    accent: 'from-amber-600 to-orange-500',
    id: 'ch_pastor_chris_teachings',
  },
  {
    slug: 'pastor-chris-books',
    name: 'Pastor Chris Books',
    username: 'pastorchrisbooks',
    description: 'Excerpts and full chapters from Pastor Chris’ transformative books.',
    accent: 'from-rose-600 to-amber-500',
    id: 'ch_pastor_chris_books',
  },
  {
    slug: 'rhapsody-library',
    name: 'Rhapsody of Realities Library',
    username: 'rhapsodylibrary',
    description: 'A growing library of resources, testimonies and editions.',
    accent: 'from-emerald-600 to-amber-500',
    id: 'ch_rhapsody_library',
  },
  {
    slug: 'classic-gospel-music',
    name: 'Classic Gospel Music',
    username: 'classicgospelmusic',
    description: 'Timeless gospel music to lift your spirit every day.',
    accent: 'from-indigo-600 to-primary-glow',
    id: 'ch_classic_gospel_music',
  },
];

