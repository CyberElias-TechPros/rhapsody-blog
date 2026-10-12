/**
 * The resources layer: books, studies, sermon notes and programme guides that sit beside the
 * daily devotionals.
 *
 * Same shape as `lib/content.ts` and for the same reasons — read `content/resources/*.md` once per
 * process, memoise it, and hand the routes typed data. These are not daily posts: they have no
 * edition, no reading plans and no prayer, and several of them have no publication date at all, so
 * they are listed by kind and then by title rather than by day.
 *
 * One thing they do carry that the devotionals do not: `recovered`. Three of the books are scans
 * with no text layer, so their words were read by a recogniser (`scripts/extract-resources.mjs`),
 * and every page that renders them says so out loud — the same promise the kids' magazine makes.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { ResourceSearchDoc } from './search';
import type { Resource, ResourceKind, ResourceSection, ResourceSummary } from './types';

const RESOURCE_DIR = path.join(process.cwd(), 'content', 'resources');

/** Kinds in the order they are listed: the books first, the dated programme notes last. */
export const RESOURCE_KIND_ORDER: ResourceKind[] = ['book', 'study', 'sermon-notes', 'programme'];

export const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  book: 'Books',
  study: 'Studies',
  'sermon-notes': 'Sermon notes',
  programme: 'Prayer & fasting programmes',
};

export const RESOURCE_KIND_BLURBS: Record<ResourceKind, string> = {
  book: 'Full-length teaching, published in full and readable in a browser.',
  study: 'Short, practical guides on one subject.',
  'sermon-notes': 'The word given at a service, transcribed.',
  programme: 'Day-by-day notes from the Global Prayer & Fasting and Loveworld Specials programmes.',
};

function toResource(file: string): Resource {
  const raw = readFileSync(path.join(RESOURCE_DIR, file), 'utf8');
  const { data, content } = matter(raw);
  const name = `content/resources/${file}`;

  const slug = typeof data.slug === 'string' ? data.slug : '';
  if (!slug) throw new Error(`${name}: frontmatter is missing "slug".`);
  if (slug !== file.replace(/\.md$/, '')) {
    throw new Error(`${name}: slug "${slug}" does not match the file name "${file}".`);
  }

  const kind = (RESOURCE_KIND_ORDER as string[]).includes(String(data.kind)) ? (data.kind as ResourceKind) : 'book';

  // `## Heading` splits the body into the sections the page renders with a table of contents.
  const sections: ResourceSection[] = [];
  let current: ResourceSection = { id: 'opening', heading: '', paragraphs: [] };
  for (const block of content.split(/^##\s+/m)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (!current.heading && !current.paragraphs.length && !sections.length) {
      // The first block is either the opening text or the first heading.
      const [first, ...rest] = splitParagraphs(trimmed);
      current = { id: 'opening', heading: '', paragraphs: first ? [first, ...rest] : [] };
      continue;
    }
    if (sections.length || current.paragraphs.length) sections.push(current);
    const [heading, ...body] = trimmed.split('\n');
    const paragraphs = splitParagraphs(body.join('\n'));
    current = { id: slugify(heading), heading: heading.trim(), paragraphs };
  }
  if (current.heading || current.paragraphs.length) sections.push(current);

  // A book can print the same heading twice ("Introduction" in two parts). The table of contents
  // links by id, so a repeat gets a suffix rather than sending the reader to the wrong chapter.
  const usedIds = new Map<string, number>();
  for (const section of sections) {
    const seen = usedIds.get(section.id) ?? 0;
    usedIds.set(section.id, seen + 1);
    if (seen > 0) section.id = `${section.id}-${seen + 1}`;
  }

  const words = Number(data.words ?? countWords(content));
  const resource: Resource = {
    slug,
    title: typeof data.title === 'string' ? data.title : slug,
    subtitle: typeof data.subtitle === 'string' && data.subtitle.trim() ? data.subtitle.trim() : undefined,
    kind,
    kindLabel: RESOURCE_KIND_LABELS[kind],
    author: String(data.author ?? 'Pastor Chris Oyakhilome'),
    publisher: String(data.publisher ?? 'LoveWorld Publications'),
    date: String(data.date ?? ''),
    dateNote: typeof data.dateNote === 'string' ? data.dateNote : '',
    year: Number(data.year ?? 0) || undefined,
    isbn: typeof data.isbn === 'string' ? data.isbn : '',
    excerpt: String(data.excerpt ?? ''),
    blurb: String(data.blurb ?? data.excerpt ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    credit: typeof data.credit === 'string' ? data.credit : '',
    sourcePdf: String(data.sourcePdf ?? ''),
    sourcePages: Number(data.sourcePages ?? 0),
    words,
    readingMinutes: Math.max(1, Math.round(words / 200)),
    listeningMinutes: Math.max(1, Math.round(words / 150)),
    sections,
    recovered: data.recovered === 'ocr' ? 'ocr' : 'text-layer',
    confidence: Number(data.confidence ?? 0) || undefined,
    status: data.status === 'draft' ? 'draft' : 'published',
    body: content.trim(),
  };
  return resource;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** A heading as an anchor id — the table of contents links to it. */
export function slugify(heading: string): string {
  return (
    heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'section'
  );
}

/** A part of an under-structured document aims at about this many words. */
const PART_WORDS = 1_600;
/** With at least this many real headings a document navigates itself. */
const MIN_REAL_HEADINGS = 4;
/** And below this length it does not need parts at all — a short study reads straight through. */
const MIN_WORDS_TO_PART = 3_000;

/**
 * Give a long, unstructured document navigable parts.
 *
 * A scanned book sets its chapter titles in display type on a page of their own, and OCR reads that
 * as fragments of sentences rather than as headings — so *The Power of Your Mind* comes out of the
 * extractor as 23,000 words with two headings in it. The words are right; the structure is not, and
 * a reader on a phone needs somewhere to jump to. The parts are added here, in the layer that
 * presents the document, rather than invented by the extractor: the markdown on disk stays exactly
 * what the PDF said, and a document that does have its chapters keeps them untouched.
 */
export function withReadableParts(resource: Resource): Resource {
  const realHeadings = resource.sections.filter((section) => section.heading).length;
  if (realHeadings >= MIN_REAL_HEADINGS || resource.words < MIN_WORDS_TO_PART) return resource;

  const out: ResourceSection[] = [];
  let buffer: string[] = [];
  let bufferWords = 0;
  const flush = () => {
    if (!buffer.length) return;
    out.push({ id: '', heading: '', paragraphs: buffer });
    buffer = [];
    bufferWords = 0;
  };

  for (const section of resource.sections) {
    // A heading the document really has ends the part being built and stands on its own.
    if (section.heading) {
      flush();
      out.push(section);
      continue;
    }
    for (const paragraph of section.paragraphs) {
      buffer.push(paragraph);
      bufferWords += countWords(paragraph);
      if (bufferWords >= PART_WORDS) flush();
    }
  }
  flush();

  const partCount = out.filter((section) => !section.heading).length;
  if (partCount < 2) return resource;
  let part = 0;
  const sections = out.map((section) => {
    if (section.heading) return section;
    part += 1;
    const heading = `Part ${part} of ${partCount}`;
    return { ...section, heading, id: slugify(heading) };
  });
  return { ...resource, sections };
}

let cache: Resource[] | null = null;

/** Every published resource: books and studies first, then by date (undated last) and title. */
export function getAllResources(): Resource[] {
  if (cache) return cache;
  if (!existsSync(RESOURCE_DIR)) return (cache = []);
  cache = readdirSync(RESOURCE_DIR)
    .filter((file) => file.endsWith('.md'))
    .map(toResource)
    .map(withReadableParts)
    .filter((resource) => resource.status === 'published')
    .sort(compareResources);
  return cache;
}

function compareResources(a: Resource, b: Resource): number {
  const byKind = RESOURCE_KIND_ORDER.indexOf(a.kind) - RESOURCE_KIND_ORDER.indexOf(b.kind);
  if (byKind !== 0) return byKind;
  // Dated programme notes read chronologically; undated books alphabetically.
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (Boolean(a.date) !== Boolean(b.date)) return a.date ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/** Test helper: drop the memoised corpus. */
export function resetResourceCache(): void {
  cache = null;
}

export function getAllResourceSlugs(): string[] {
  return getAllResources().map((resource) => resource.slug);
}

export function getResourceBySlug(slug: string): Resource | undefined {
  return getAllResources().find((resource) => resource.slug === slug);
}

export function getResourcesByKind(kind: ResourceKind): Resource[] {
  return getAllResources().filter((resource) => resource.kind === kind);
}

/** A card-sized view — everything but the body, for listings and the search index. */
export function getResourceSummary(resource: Resource): ResourceSummary {
  const { body: _body, sections: _sections, ...summary } = resource;
  return { ...summary, sectionCount: resource.sections.filter((section) => section.heading).length };
}

export function getAllResourceSummaries(): ResourceSummary[] {
  return getAllResources().map(getResourceSummary);
}

/** The /resources listing: one block per kind that has anything in it. */
export interface ResourceGroup {
  kind: ResourceKind;
  label: string;
  blurb: string;
  resources: ResourceSummary[];
  words: number;
}

export function getResourceGroups(): ResourceGroup[] {
  const all = getAllResources();
  return RESOURCE_KIND_ORDER.map((kind) => {
    const resources = all.filter((resource) => resource.kind === kind).map(getResourceSummary);
    return {
      kind,
      label: RESOURCE_KIND_LABELS[kind],
      blurb: RESOURCE_KIND_BLURBS[kind],
      resources,
      words: resources.reduce((sum, resource) => sum + resource.words, 0),
    };
  }).filter((group) => group.resources.length > 0);
}

export interface ResourceStats {
  resources: number;
  words: number;
  pages: number;
  kinds: { kind: ResourceKind; label: string; count: number }[];
  /** Resources whose words were recognised from a scan rather than copied from a text layer. */
  recognised: number;
}

export function getResourceStats(): ResourceStats {
  const all = getAllResources();
  const counts = new Map<ResourceKind, number>();
  for (const resource of all) counts.set(resource.kind, (counts.get(resource.kind) ?? 0) + 1);
  return {
    resources: all.length,
    words: all.reduce((sum, resource) => sum + resource.words, 0),
    pages: all.reduce((sum, resource) => sum + resource.sourcePages, 0),
    kinds: RESOURCE_KIND_ORDER.filter((kind) => counts.get(kind)).map((kind) => ({
      kind,
      label: RESOURCE_KIND_LABELS[kind],
      count: counts.get(kind) ?? 0,
    })),
    recognised: all.filter((resource) => resource.recovered === 'ocr').length,
  };
}

/** Resources matching a free-text query — the same index the site search uses. */
export function searchResources(query: string, limit = 20): ResourceSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return getAllResources()
    .filter((resource) =>
      [resource.title, resource.subtitle ?? '', resource.blurb, resource.tags.join(' '), resource.author, resource.body]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    )
    .slice(0, limit)
    .map(getResourceSummary);
}

/**
 * The compact shelf the search page ships to the browser: titles, subjects, blurbs and opening
 * words. Bodies stay on the server — see `ResourceSearchDoc` in `lib/search.ts` for why.
 */
export function getResourceSearchIndex(): ResourceSearchDoc[] {
  return getAllResources().map((resource) => ({
    slug: resource.slug,
    title: resource.title,
    subtitle: resource.subtitle ?? '',
    blurb: resource.blurb || resource.excerpt,
    opening: resource.sections
      .flatMap((section) => section.paragraphs)
      .slice(0, 3)
      .join(' ')
      .slice(0, 400),
    tags: resource.tags,
    author: resource.author,
    kindLabel: resource.kindLabel,
    words: resource.words,
  }));
}
