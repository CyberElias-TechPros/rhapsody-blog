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
import {
  AUDIENCES,
  AUDIENCE_ORDER,
  DEFAULT_AUDIENCE,
  audienceOfEdition,
  audienceOrNull,
  monthOfEdition,
  type AudienceId,
} from './audiences';
import type {
  AudienceGroup,
  Devotional,
  DevotionalQuery,
  DevotionalSection,
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
  const [year, month] = monthOfEdition(edition).split('-').map(Number);

  // Audiences were added after the adult edition was already published, so the key is optional:
  // a post with no `audience` is an adult one, and its edition slug is the bare month.
  const audience = audienceOrNull(data.audience) ?? audienceOfEdition(edition);
  const subtitle = typeof data.subtitle === 'string' && data.subtitle.trim() ? data.subtitle.trim() : undefined;
  const extras: DevotionalSection[] = Array.isArray(data.extras)
    ? data.extras
        .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null))
        .filter((entry): entry is { label: unknown; text: unknown } => Boolean(entry))
        .map((entry) => ({ label: String(entry.label ?? '').trim(), text: String(entry.text ?? '').trim() }))
        .filter((section) => section.label && section.text)
    : [];

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
    audience,
    audienceLabel: String(data.audienceLabel ?? AUDIENCES[audience].label),
    author: String(data.author ?? 'Pastor Chris Oyakhilome'),
    series: String(data.series ?? 'Rhapsody of Realities'),
    kind: String(data.kind ?? 'daily-devotional'),
    excerpt: required(data, 'excerpt', name),
    scripture: String(data.scripture ?? ''),
    scriptureReference: String(data.scriptureReference ?? ''),
    subtitle,
    prayerLabel: data.prayerLabel === 'Confession' ? 'Confession' : 'Prayer',
    prayer: String(data.prayer ?? ''),
    extras,
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
  // A teens article and an adult article can share a day; the slug says which audience it is for,
  // so the two have to agree or the file has been renamed out from under its own front matter.
  if (!devotional.slug.includes(AUDIENCES[audience].slugToken)) {
    throw new Error(`${name}: slug does not carry the audience \"${audience}\" its edition belongs to.`);
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
    .sort(compareRecency);
  return cache;
}

/**
 * Newest day first; within one day, the audiences in reading order (the adult edition, then the
 * editions written for younger readers) and then by slug. The order inside a day is what decides
 * which article a single-slot surface — the home-page hero, the RSS feed — picks up, so it is
 * pinned here rather than left to a slug comparison.
 */
function compareRecency(a: Devotional, b: Devotional): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const byAudience = AUDIENCE_ORDER.indexOf(a.audience) - AUDIENCE_ORDER.indexOf(b.audience);
  return byAudience !== 0 ? byAudience : a.slug.localeCompare(b.slug);
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

/** Every article for one audience, newest day first. */
export function getDevotionalsByAudience(audience: AudienceId = DEFAULT_AUDIENCE): Devotional[] {
  return getAllDevotionals().filter((p) => p.audience === audience);
}

export function getSummary(post: Devotional): DevotionalSummary {
  const { body: _body, message: _message, ...summary } = post;
  return summary;
}

export function getAllSummaries(): DevotionalSummary[] {
  return getAllDevotionals().map(getSummary);
}

/** Chronological neighbours — the "yesterday / tomorrow" links on a post page. */
/**
 * Chronological neighbours *within the same audience* — a teen reading day 14 is sent to day 15
 * of the teens edition, not to the adult article for the same date.
 */
export function getAdjacentDevotionals(slug: string): { previous?: DevotionalSummary; next?: DevotionalSummary } {
  const post = getDevotionalBySlug(slug);
  if (!post) return {};
  const all = getDevotionalsByAudience(post.audience); // newest first
  const index = all.findIndex((p) => p.slug === slug);
  if (index < 0) return {};
  return {
    // Older = further down a newest-first list.
    previous: index + 1 < all.length ? getSummary(all[index + 1]) : undefined,
    next: index - 1 >= 0 ? getSummary(all[index - 1]) : undefined,
  };
}

/** Editions of one audience, newest month first; every audience when called without one. */
export function getEditions(audience?: AudienceId): Edition[] {
  const byEdition = new Map<string, Devotional[]>();
  for (const post of audience ? getDevotionalsByAudience(audience) : getAllDevotionals()) {
    const list = byEdition.get(post.edition) ?? [];
    list.push(post);
    byEdition.set(post.edition, list);
  }

  return [...byEdition.entries()]
    .map(([slug, posts]) => {
      const sorted = [...posts].sort((a, b) => a.date.localeCompare(b.date));
      const audience = sorted[0].audience;
      const meta = AUDIENCES[audience];
      // `2026-10` for the adult edition, `2026-10-teens` for the others — the month part is what
      // carries the year and month number.
      const [year, month] = monthOfEdition(slug).split('-').map(Number);
      const title = sorted[0].editionTitle || `${MONTH_NAMES[month - 1]} ${year}`;
      return {
        slug,
        title,
        audienceTitle: meta.editionSuffix ? `${title} · ${meta.label}` : title,
        audience,
        audienceLabel: meta.label,
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

/**
 * The /editions listing: one block per audience, in reading order, each holding that audience's
 * months. An audience with no edition in the corpus is left out entirely.
 */
export function getEditionGroups(): AudienceGroup[] {
  const editions = getEditions();
  return AUDIENCE_ORDER.map((audience) => {
    const meta = AUDIENCES[audience];
    const forAudience = editions.filter((edition) => edition.audience === audience);
    return {
      audience,
      label: meta.label,
      shortLabel: meta.shortLabel,
      series: meta.series,
      blurb: meta.blurb,
      postCount: forAudience.reduce((sum, edition) => sum + edition.postCount, 0),
      editions: forAudience,
    };
  }).filter((group) => group.editions.length > 0);
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
/** The article for a day, in the audience asked for (the adult edition by default). */
export function getDevotionalForDate(dateIso: string, audience: AudienceId = DEFAULT_AUDIENCE): Devotional | undefined {
  return getDevotionalsByAudience(audience).find((p) => p.date === dateIso);
}

/**
 * The same day in the other audiences — `Also on this day` under an article, so a parent who
 * landed on the adult reading can find the version their child can read.
 */
export function getDaySiblings(slug: string): Devotional[] {
  const post = getDevotionalBySlug(slug);
  if (!post) return [];
  return AUDIENCE_ORDER.filter((audience) => audience !== post.audience)
    .map((audience) => getDevotionalForDate(post.date, audience))
    .filter((sibling): sibling is Devotional => Boolean(sibling));
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Home-page hero pick: today's article when we have it, otherwise the most recent one before
 * today, otherwise the newest overall. Always returns something while the corpus is non-empty.
 */
export function getFeaturedDevotional(now = new Date(), audience: AudienceId = DEFAULT_AUDIENCE): Devotional | undefined {
  const all = getDevotionalsByAudience(audience);
  if (!all.length) return undefined;
  const today = todayIso(now);
  return getDevotionalForDate(today, audience) ?? all.find((p) => p.date <= today) ?? all[0];
}

function matchesQuery(post: Devotional, query: DevotionalQuery): boolean {
  if (query.audience && post.audience !== query.audience) return false;
  if (query.edition && post.edition !== query.edition) return false;
  if (query.tag && !post.tags.includes(query.tag)) return false;
  if (query.q) {
    const needle = query.q.trim().toLowerCase();
    if (!needle) return true;
    const haystack = [post.title, post.subtitle, post.excerpt, post.scripture, post.scriptureReference, post.message.join(' '), post.prayer, post.extras.map((section) => `${section.label} ${section.text}`).join(' '), post.furtherStudy, post.editionTitle, post.audienceLabel, post.weekday, post.date, post.tags.join(' ')]
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
    audience: p.audience,
    audienceLabel: p.audienceLabel,
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
export interface ContentStats {
  posts: number;
  editions: number;
  words: number;
  firstDate: string;
  lastDate: string;
  /** The same numbers per audience, in reading order, empty audiences left out. */
  byAudience: {
    audience: AudienceId;
    label: string;
    posts: number;
    editions: number;
    words: number;
  }[];
}

export function getContentStats(): ContentStats {
  const all = getAllDevotionals();
  const dates = all.map((p) => p.date).sort();
  const editions = getEditions();
  return {
    posts: all.length,
    editions: editions.length,
    words: all.reduce((sum, p) => sum + p.words, 0),
    firstDate: dates[0] ?? '',
    lastDate: dates[dates.length - 1] ?? '',
    byAudience: AUDIENCE_ORDER.map((audience) => {
      const posts = all.filter((p) => p.audience === audience);
      return {
        audience,
        label: AUDIENCES[audience].label,
        posts: posts.length,
        editions: editions.filter((edition) => edition.audience === audience).length,
        words: posts.reduce((sum, p) => sum + p.words, 0),
      };
    }).filter((entry) => entry.posts > 0),
  };
}
