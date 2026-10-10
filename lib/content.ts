/**
 * The content layer: reads `content/devotionals/*.md` (generated from the monthly PDFs by
 * `npm run content:extract`) and turns it into typed, sorted, queryable data.
 *
 * Server-only — it touches `node:fs`. Client components receive plain props or the compact
 * `SearchDoc[]` payload instead of importing this module.
 *
 * Posts are read once per process and memoised: the corpus is static Markdown, so there is
 * nothing to invalidate. `next build` therefore reads the directory a handful of times and
 * every route renders from memory.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type {
  Devotional,
  DevotionalQuery,
  DevotionalSort,
  DevotionalSummary,
  Edition,
  Paged,
  SearchDoc,
} from './types';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'devotionals');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Frontmatter is generated, but a hand edit can still break a post — fail loudly with the file name. */
function required(data: Record<string, unknown>, key: string, file: string): string {
  const value = data[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${file}: frontmatter is missing "${key}" — re-run \`npm run content:extract\`.`);
  }
  return value;
}

function toDevotional(file: string): Devotional {
  const raw = readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const { data, content } = matter(raw);
  const name = `content/devotionals/${file}`;

  const date = required(data, 'date', name);
  const slug = required(data, 'slug', name);
  const edition = required(data, 'edition', name);
  const [year, month] = edition.split('-').map(Number);

  // The body is `message` then the closing sections; the sections are rendered from their own
  // frontmatter fields (as cards), so split them off and keep only the article message.
  const headingAt = content.search(/^##\s/m);
  const messageMarkdown = headingAt >= 0 ? content.slice(0, headingAt) : content;
  const message = messageMarkdown
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const devotional: Devotional = {
    slug,
    title: required(data, 'title', name),
    titleOriginal: String(data.titleOriginal ?? ''),
    date,
    weekday: String(data.weekday ?? ''),
    dayOfMonth: Number(data.dayOfMonth ?? 0),
    edition,
    editionTitle: String(data.editionTitle ?? `${MONTH_NAMES[month - 1] ?? ''} ${year ?? ''}`.trim()),
    author: String(data.author ?? 'Pastor Chris Oyakhilome'),
    series: String(data.series ?? 'Rhapsody of Realities'),
    kind: String(data.kind ?? 'daily-devotional'),
    excerpt: required(data, 'excerpt', name),
    scripture: String(data.scripture ?? ''),
    scriptureReference: String(data.scriptureReference ?? ''),
    prayerLabel: data.prayerLabel === 'Confession' ? 'Confession' : 'Prayer',
    prayer: String(data.prayer ?? ''),
    furtherStudy: String(data.furtherStudy ?? ''),
    oneYearPlan: String(data.oneYearPlan ?? ''),
    twoYearPlan: String(data.twoYearPlan ?? ''),
    readingMinutes: Number(data.readingMinutes ?? Math.max(1, Math.round(message.join(' ').split(/\s+/).length / 200))),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    sourcePdf: String(data.sourcePdf ?? ''),
    sourcePages: Array.isArray(data.sourcePages) ? data.sourcePages.map(Number) : [],
    source: String(data.source ?? ''),
    status: data.status === 'draft' ? 'draft' : 'published',
    message,
    body: content.trim(),
    words: message.join(' ').split(/\s+/).filter(Boolean).length,
  };

  if (devotional.slug !== file.replace(/\.md$/, '')) {
    throw new Error(`${name}: slug "${devotional.slug}" does not match the file name "${file}".`);
  }
  if (!devotional.slug.startsWith(devotional.date)) {
    throw new Error(`${name}: slug must be prefixed with the devotional date (${devotional.date}).`);
  }
  return devotional;
}

let cache: Devotional[] | null = null;

/** Every published devotional, newest first. */
export function getAllDevotionals(): Devotional[] {
  if (cache) return cache;
  if (!existsSync(CONTENT_DIR)) {
    throw new Error(
      `No content directory at ${CONTENT_DIR}. Run \`npm run content:extract\` to build the blog posts from the PDF editions.`
    );
  }
  cache = readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map(toDevotional)
    .filter((p) => p.status === 'published')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
  return cache;
}

/** Test helper: drop the memoised corpus (e.g. after writing fixture files). */
export function resetContentCache(): void {
  cache = null;
}

export function getAllSlugs(): string[] {
  return getAllDevotionals().map((p) => p.slug);
}

export function getDevotionalBySlug(slug: string): Devotional | undefined {
  return getAllDevotionals().find((p) => p.slug === slug);
}

export function getSummary(post: Devotional): DevotionalSummary {
  const { body: _body, message: _message, ...summary } = post;
  return summary;
}

export function getAllSummaries(): DevotionalSummary[] {
  return getAllDevotionals().map(getSummary);
}

/** Chronological neighbours — the "yesterday / tomorrow" links on a post page. */
export function getAdjacentDevotionals(slug: string): { previous?: DevotionalSummary; next?: DevotionalSummary } {
  const all = getAllDevotionals(); // newest first
  const index = all.findIndex((p) => p.slug === slug);
  if (index < 0) return {};
  return {
    // Older = further down a newest-first list.
    previous: index + 1 < all.length ? getSummary(all[index + 1]) : undefined,
    next: index - 1 >= 0 ? getSummary(all[index - 1]) : undefined,
  };
}

export function getEditions(): Edition[] {
  const byEdition = new Map<string, Devotional[]>();
  for (const post of getAllDevotionals()) {
    const list = byEdition.get(post.edition) ?? [];
    list.push(post);
    byEdition.set(post.edition, list);
  }

  return [...byEdition.entries()]
    .map(([slug, posts]) => {
      const sorted = [...posts].sort((a, b) => a.date.localeCompare(b.date));
      const [year, month] = slug.split('-').map(Number);
      return {
        slug,
        title: sorted[0].editionTitle || `${MONTH_NAMES[month - 1]} ${year}`,
        year,
        month,
        monthName: MONTH_NAMES[month - 1] ?? slug,
        postCount: sorted.length,
        firstDate: sorted[0].date,
        lastDate: sorted[sorted.length - 1].date,
        sourcePdf: sorted[0].sourcePdf,
      } satisfies Edition;
    })
    .sort((a, b) => b.slug.localeCompare(a.slug));
}

export function getEdition(slug: string): Edition | undefined {
  return getEditions().find((e) => e.slug === slug);
}

export function getDevotionalsByEdition(slug: string): Devotional[] {
  return getAllDevotionals().filter((p) => p.edition === slug);
}

/**
 * The devotional for a given day, when the corpus covers it. `today` is injected so the home
 * page stays deterministic in tests and during a build.
 */
export function getDevotionalForDate(dateIso: string): Devotional | undefined {
  return getAllDevotionals().find((p) => p.date === dateIso);
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Home-page hero pick: today's article when we have it, otherwise the most recent one before
 * today, otherwise the newest overall. Always returns something while the corpus is non-empty.
 */
export function getFeaturedDevotional(now = new Date()): Devotional | undefined {
  const all = getAllDevotionals();
  if (!all.length) return undefined;
  const today = todayIso(now);
  return getDevotionalForDate(today) ?? all.find((p) => p.date <= today) ?? all[0];
}

function matchesQuery(post: Devotional, query: DevotionalQuery): boolean {
  if (query.edition && post.edition !== query.edition) return false;
  if (query.tag && !post.tags.includes(query.tag)) return false;
  if (query.q) {
    const needle = query.q.trim().toLowerCase();
    if (!needle) return true;
    const haystack = [post.title, post.excerpt, post.scripture, post.scriptureReference, post.message.join(' '), post.prayer, post.furtherStudy, post.editionTitle, post.weekday, post.date, post.tags.join(' ')]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  }
  return true;
}

function sortPosts(posts: Devotional[], sort: DevotionalSort = 'new'): Devotional[] {
  const sorted = [...posts];
  if (sort === 'old') sorted.reverse(); // corpus is stored newest-first
  return sorted;
}

/** Listing + filtering for `/devotionals`, `/editions/[edition]` and `/search`. */
export function queryDevotionals(query: DevotionalQuery = {}): Paged<DevotionalSummary> {
  const limit = Math.max(1, Math.min(60, query.limit ?? 12));
  const filtered = sortPosts(getAllDevotionals().filter((p) => matchesQuery(p, query)), query.sort ?? 'new');
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.max(1, Math.min(query.page ?? 1, totalPages));
  const start = (page - 1) * limit;
  return {
    items: filtered.slice(start, start + limit).map(getSummary),
    page,
    limit,
    total,
    totalPages,
  };
}

/** Everything the client-side search box needs, minus article bodies. */
export function getSearchIndex(): SearchDoc[] {
  return getAllDevotionals().map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    date: p.date,
    edition: p.edition,
    editionTitle: p.editionTitle,
    weekday: p.weekday,
    scriptureReference: p.scriptureReference,
    tags: p.tags,
    readingMinutes: p.readingMinutes,
    opening: p.message.slice(0, 2).join(' ').slice(0, 400),
  }));
}

/** Distinct tags across the corpus, most-used first. */
export function getAllTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of getAllDevotionals()) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Headline numbers for the home page and /about. */
export function getContentStats(): {
  posts: number;
  editions: number;
  words: number;
  firstDate: string;
  lastDate: string;
} {
  const all = getAllDevotionals();
  const dates = all.map((p) => p.date).sort();
  return {
    posts: all.length,
    editions: getEditions().length,
    words: all.reduce((sum, p) => sum + p.words, 0),
    firstDate: dates[0] ?? '',
    lastDate: dates[dates.length - 1] ?? '',
  };
}
