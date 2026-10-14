import { getDevotionalBySlug } from '@/lib/content';
import { getResourceBySlug } from '@/lib/resources';
import { getIssue } from '@/lib/kids';
import { formatDayHeading } from '@/lib/format';
import type { LibraryItem } from '@/lib/types';

/**
 * `GET /api/library?slugs=a,b,c` — resolves saved slugs into cards.
 *
 * Saved devotionals live in the reader's own localStorage (see `hooks/useSavedPosts.ts`): no
 * account, nothing uploaded. That makes `/library` a client-side list of *slugs* with no titles
 * attached, and the two ways to give it titles are both wrong: shipping the whole 850-article
 * corpus to the browser so ten saved items can be labelled, or duplicating the corpus into the
 * page's props. So the client asks for exactly what it saved, and this route answers from the
 * memoised corpus in memory.
 *
 * It is a lookup, not a store — it never writes, and it answers for devotionals, resources and
 * kids' issues alike, because one "save" button is used across all three.
 */

export const dynamic = 'force-dynamic';

const MAX_SLUGS = 200;

/**
 * Cut a card's line to length on a word boundary.
 *
 * `slice(0, 160)` stops mid-word — "…with the words of each page recover" — which reads like a
 * bug on the very page whose job is to look after what a reader kept.
 */
function clip(text: string, max = 160): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(' ', max);
  return `${clean.slice(0, cut > 40 ? cut : max).replace(/[\s,;:.-]+$/, '')}…`;
}

const json = (data: unknown, init: { status?: number; cache?: string } = {}) =>
  new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // The corpus only changes on a deploy, but the query varies per reader.
      'Cache-Control': init.cache ?? 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });

export function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('slugs') ?? '';
  const slugs = [...new Set(raw.split(',').map((slug) => slug.trim()).filter(Boolean))];

  if (!slugs.length) return json({ items: [], unknown: [] });
  if (slugs.length > MAX_SLUGS) {
    return json(
      { error: { code: 'TOO_MANY_SLUGS', message: `At most ${MAX_SLUGS} slugs per request.` } },
      { status: 400, cache: 'no-store' }
    );
  }

  const items: LibraryItem[] = [];
  const unknown: string[] = [];

  for (const slug of slugs) {
    const post = getDevotionalBySlug(slug);
    if (post) {
      items.push({
        slug,
        kind: 'devotional',
        title: post.title,
        href: `/devotionals/${post.slug}`,
        label: post.audienceLabel,
        date: post.date,
        excerpt: clip(post.excerpt),
        meta: `${formatDayHeading(post.date)} · ${post.readingMinutes} min read`,
      });
      continue;
    }

    const resource = getResourceBySlug(slug);
    if (resource) {
      items.push({
        slug,
        kind: 'resource',
        title: resource.title,
        href: `/resources/${resource.slug}`,
        label: resource.kindLabel,
        date: resource.date,
        excerpt: clip((resource.blurb || resource.excerpt)),
        meta: `${resource.words.toLocaleString()} words · ${resource.readingMinutes} min read · ${resource.listeningMinutes} min listen`,
      });
      continue;
    }

    const issue = getIssue(slug);
    if (issue) {
      items.push({
        slug,
        kind: 'kids',
        title: issue.title,
        href: `/kids/${issue.slug}`,
        label: issue.audienceLabel,
        date: issue.date,
        excerpt: clip(issue.excerpt),
        meta: `${issue.pageCount} pages · ${issue.monthName} ${issue.year}`,
      });
      continue;
    }

    // A slug that no longer exists — a renamed file, an unpublished draft — is reported rather
    // than silently dropped, so the page can offer to clear it.
    unknown.push(slug);
  }

  return json({ items, unknown });
}
