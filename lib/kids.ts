/**
 * The kids' magazine: `content/kids/*.md`, one post per monthly RORK issue, generated from the PDFs
 * by `npm run content:kids`.
 *
 * Kept apart from `lib/content.ts` on purpose. A devotional is a dated article with a fixed shape
 * (scripture, message, prayer, further study); a magazine issue is 50 pages of art with a verse, a
 * story and an activity, and it is dated by month, not by day. Merging the two would give every
 * devotional query a shape it does not have — so the readers share `lib/audiences.ts` and the URLs,
 * and each keeps its own loader.
 *
 * Server-only: it reads `content/kids/` from disk. Pages receive plain props.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'kids');

/** What a page of the magazine is. The extractor classifies it; the label is here, not there. */
export type KidsPageKind = 'cover' | 'contents' | 'verse' | 'story' | 'activity' | 'prayer' | 'note' | 'page' | 'artwork';

export const KIND_LABELS: Record<KidsPageKind, string> = {
  cover: 'Cover',
  contents: 'In this issue',
  verse: 'Say This',
  story: 'Story',
  activity: 'Activity',
  prayer: 'Prayer',
  note: 'From the publisher',
  page: 'Page',
  artwork: 'Artwork',
};

/**
 * Where a page's words came from. `ocr` means the printed page carries its text inside the artwork and
 * a recogniser read it out — never checked by hand, so the site says so.
 */
export type KidsTextSource = 'text-layer' | 'ocr' | 'none';

export const SOURCE_NOTES: Record<KidsTextSource, string> = {
  'text-layer': 'The words are the PDF’s own text.',
  ocr: 'Recognised from the artwork by OCR and not checked by hand — the page above is the source of truth.',
  none: 'This page is drawn; no words could be read from it.',
};

export interface KidsPage {
  number: number;
  /** Site path of the rendered page, e.g. `/kids/2026-04-kids/p07.jpg`. */
  image: string;
  kind: KidsPageKind;
  recovered: KidsTextSource;
  /** Tesseract's mean confidence, when the text was recognised. */
  confidence?: number;
  /** One line for the strip of thumbnails. */
  excerpt?: string;
  /** The page's words, from the body section with the same number — empty when there were none. */
  text: string;
}

export interface KidsIssue {
  slug: string;
  title: string;
  /** The first of the month the issue is dated — an issue is not a day. */
  date: string;
  edition: string;
  audience: 'kids';
  audienceLabel: string;
  kind: 'magazine-issue';
  series: string;
  author: string;
  excerpt: string;
  intro: string;
  pageCount: number;
  recognisedPages: number;
  /** `false` when this issue's page images lost their artwork to a decoder that could not read it. */
  artworkDecoded?: boolean;
  monthName: string;
  year: number;
  volume?: string;
  issn?: string;
  keyVerse?: string;
  sourcePdf: string;
  source: string;
  status: 'published' | 'draft';
  pages: KidsPage[];
}

export interface KidsIssueSummary {
  slug: string;
  title: string;
  date: string;
  monthName: string;
  year: number;
  excerpt: string;
  pageCount: number;
  recognisedPages: number;
  /** `false` when this issue's page images lost their artwork to the renderer. */
  artworkDecoded?: boolean;
  /** The cover, so an index of issues is a wall of covers rather than a list of links. */
  cover: string | null;
  keyVerse?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const kindOf = (value: unknown): KidsPageKind => {
  const kind = String(value ?? 'page');
  return kind in KIND_LABELS ? (kind as KidsPageKind) : 'page';
};

const sourceOf = (value: unknown): KidsTextSource => {
  const recovered = String(value ?? 'none');
  return recovered in SOURCE_NOTES ? (recovered as KidsTextSource) : 'none';
};

/** `## Page 12` sections, in the order the extractor wrote them. */
function bodyPages(markdown: string): Map<number, string> {
  const found = new Map<number, string>();
  // `(?![\s\S])` rather than `$` for "end of the file": under `/m` a `$` would match the end of the
  // first line and hand back one line of a page — which looks like a working page, so nothing else
  // would ever notice.
  const pattern = /^## Page (\d+)\n\n([\s\S]*?)(?=^## Page \d+\n|(?![\s\S]))/gm;
  for (const match of markdown.matchAll(pattern)) {
    found.set(Number(match[1]), match[2].trim());
  }
  return found;
}

function toIssue(file: string): KidsIssue {
  const raw = readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const { data, content } = matter(raw);
  const slug = typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim() : file.replace(/\.md$/, '');
  const body = bodyPages(content);
  const intro = content.split(/^## Page \d+$/m)[0].trim();

  const month = Number(slug.split('-')[1]);
  const year = Number(slug.split('-')[0]);
  const entries: KidsPage[] = (Array.isArray(data.pages) ? data.pages : []).map((entry: Record<string, unknown>, index: number) => {
    const number = Number(entry.number ?? index + 1);
    const recovered = sourceOf(entry.recovered);
    return {
      number,
      image: String(entry.image ?? ''),
      kind: kindOf(entry.kind),
      recovered,
      confidence: entry.confidence === undefined ? undefined : Number(entry.confidence),
      excerpt: entry.excerpt === undefined ? undefined : String(entry.excerpt),
      // A textless page's body section is the extractor's note about it, not the page's words.
      text: recovered === 'none' ? '' : (body.get(number) ?? ''),
    };
  });
  return {
    slug,
    title: String(data.title ?? slug),
    date: String(data.date ?? `${slug.split('-')[0]}-01-01`),
    edition: String(data.edition ?? slug),
    audience: 'kids',
    audienceLabel: String(data.audienceLabel ?? 'For Kids'),
    kind: 'magazine-issue',
    series: String(data.series ?? 'Rhapsody of Realities for Kids'),
    author: String(data.author ?? ''),
    excerpt: String(data.excerpt ?? ''),
    intro,
    monthName: MONTH_NAMES[month - 1] ?? '',
    year: Number.isFinite(year) ? year : Number(String(data.date ?? '0').slice(0, 4)),
    pageCount: Number(data.pageCount ?? entries.length),
    recognisedPages: Number(data.recognisedPages ?? entries.filter((page) => page.recovered === 'ocr').length),
    ...(data.artworkDecoded === undefined ? {} : { artworkDecoded: Boolean(data.artworkDecoded) }),
    volume: data.volume ? String(data.volume) : undefined,
    issn: data.issn ? String(data.issn) : undefined,
    keyVerse: data.keyVerse ? String(data.keyVerse) : undefined,
    sourcePdf: String(data.sourcePdf ?? ''),
    source: String(data.source ?? ''),
    status: data.status === 'draft' ? 'draft' : 'published',
    pages: entries,
  };
}

let cache: KidsIssue[] | null = null;

/** Every issue, newest month first. Memoised: the corpus is static. */
export function getAllIssues(): KidsIssue[] {
  cache ??= existsSync(CONTENT_DIR)
    ? readdirSync(CONTENT_DIR)
        .filter((file) => file.endsWith('.md'))
        .map(toIssue)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)))
    : [];
  return cache;
}

export function getIssue(slug: string): KidsIssue | undefined {
  return getAllIssues().find((issue) => issue.slug === slug);
}

export function getAllSlugs(): string[] {
  return getAllIssues().map((issue) => issue.slug);
}

export function getSummary(issue: KidsIssue): KidsIssueSummary {
  return {
    slug: issue.slug,
    title: issue.title,
    date: issue.date,
    monthName: issue.monthName ?? '',
    year: issue.year ?? Number(issue.date.slice(0, 4)),
    excerpt: issue.excerpt,
    pageCount: issue.pageCount,
    recognisedPages: issue.recognisedPages,
    artworkDecoded: issue.artworkDecoded,
    cover: issue.pages[0]?.image ?? null,
    keyVerse: issue.keyVerse,
  };
}

export function getAllSummaries(): KidsIssueSummary[] {
  return getAllIssues().map(getSummary);
}

/** Issues grouped by year, newest year first, for the index. */
export function getIssuesByYear(): { year: number; issues: KidsIssue[] }[] {
  const byYear = new Map<number, KidsIssue[]>();
  for (const issue of getAllIssues()) {
    const year = issue.year ?? Number(issue.date.slice(0, 4));
    const list = byYear.get(year) ?? [];
    list.push(issue);
    byYear.set(year, list);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, issues]) => ({ year, issues: issues.sort((a, b) => b.date.localeCompare(a.date)) }));
}



/**
 * Everything the index and the home page count. `recognised` and `textless` are the honest share of
 * the corpus a recogniser read off artwork and of the pages it could not read at all, so the site can
 * say both out loud instead of burying them.
 */
export function getKidsStats() {
  const issues = getAllIssues();
  const pages = issues.flatMap((issue) => issue.pages);
  const recognised = pages.filter((page) => page.recovered === 'ocr');
  const textless = pages.filter((page) => page.recovered === 'none');
  const words = pages.reduce((sum, page) => sum + String(page.text ?? '').split(/\s+/).filter(Boolean).length, 0);
  return {
    issues: issues.length,
    pages: pages.length,
    words,
    recognised: recognised.length,
    textless: textless.length,
    firstDate: issues.at(-1)?.date ?? '',
    lastDate: issues[0]?.date ?? '',
    weakestConfidence: recognised.reduce((min, page) => Math.min(min, page.confidence ?? 100), 100),
    meanConfidence: recognised.length ? Math.round(recognised.reduce((sum, page) => sum + (page.confidence ?? 0), 0) / recognised.length) : 0,
  };
}

/** Used by the build check: a page whose image was never written is a broken page, not a stub. */
export function missingImages(root = process.cwd()): string[] {
  const missing: string[] = [];
  for (const issue of getAllIssues()) {
    for (const page of issue.pages) {
      if (!page.image) missing.push(`${issue.slug}: page ${page.number} has no image path`);
      else if (!existsSync(path.join(root, 'public', page.image.replace(/^\//, '')))) missing.push(`${issue.slug}: ${page.image} is not on disk`);
    }
  }
  return missing;
}
