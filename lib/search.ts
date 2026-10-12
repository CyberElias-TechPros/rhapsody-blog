/**
 * Client-safe search: ranks the static `SearchDoc[]` index the server hands to `/search`.
 *
 * Deliberately tiny and dependency-free — a few hundred documents means an exhaustive scan
 * is instantaneous, and keeping the scoring here (rather than in a component) makes it testable.
 */

import type { SearchDoc } from './types';

const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'is', 'are', 'on', 'with']);

export interface SearchMatch {
  doc: SearchDoc;
  score: number;
  /** Which field produced the strongest signal — used to highlight results. */
  matchedOn: 'title' | 'scripture' | 'message' | 'excerpt' | 'tag' | 'date';
}

const norm = (value: string) => value.toLowerCase().trim();

/** Tokenise a query, dropping stop words so "the spirit" and "spirit" rank alike. */
export function tokenize(query: string): string[] {
  return norm(query)
    .split(/[^a-z0-9'’:-]+/)
    .map((t) => t.replace(/^[-']+|[-']+$/g, ''))
    .filter((t) => t.length > 1 && !stopWords.has(t));
}

/**
 * Field-weighted scoring. Titles dominate, scripture references next, then the article's own
 * opening words; exact phrase matches get a bonus so multi-word queries behave predictably.
 */
export function scoreDoc(doc: SearchDoc, tokens: string[], phrase: string): { score: number; matchedOn: SearchMatch['matchedOn'] } | null {
  if (!tokens.length) return null;

  const title = norm(doc.title);
  const excerpt = norm(doc.excerpt);
  const opening = norm(doc.opening);
  const reference = norm(doc.scriptureReference);
  const tags = doc.tags.map(norm).join(' ');
  // The audience belongs in here too: “teens” is a search, not only a filter.
  const dateish = `${doc.date} ${doc.edition} ${doc.editionTitle} ${doc.weekday} ${doc.audience} ${doc.audienceLabel}`.toLowerCase();

  let score = 0;
  let matchedOn: SearchMatch['matchedOn'] = 'excerpt';
  const add = (points: number, field: SearchMatch['matchedOn']) => {
    score += points;
    // Keep the strongest field for the "matched in" hint.
    const rank = { title: 6, scripture: 5, message: 4, excerpt: 3, tag: 2, date: 1 } as const;
    if (rank[field] > rank[matchedOn] || score === points) matchedOn = field;
  };

  for (const token of tokens) {
    if (title.includes(token)) add(title.startsWith(token) ? 14 : 10, 'title');
    if (reference.includes(token)) add(8, 'scripture');
    if (opening.includes(token)) add(5, 'message');
    if (excerpt.includes(token)) add(3, 'excerpt');
    if (tags.includes(token)) add(2, 'tag');
    if (dateish.includes(token)) add(2, 'date');
  }

  if (!score) return null;

  if (phrase && phrase.length > 3) {
    if (title.includes(phrase)) score += 12;
    if (opening.includes(phrase)) score += 6;
    if (excerpt.includes(phrase)) score += 4;
  }

  return { score, matchedOn };
}

/** Rank the whole index; ties break on date (newest first) then title. */
export function searchDocs(docs: SearchDoc[], query: string, limit = 60): SearchMatch[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const phrase = norm(query).replace(/\s+/g, ' ');

  const matches: SearchMatch[] = [];
  for (const doc of docs) {
    const scored = scoreDoc(doc, tokens, phrase);
    if (scored) matches.push({ doc, ...scored });
  }

  return matches
    .sort((a, b) => b.score - a.score || (a.doc.date < b.doc.date ? 1 : -1) || a.doc.title.localeCompare(b.doc.title))
    .slice(0, limit);
}

/* ------------------------------------------------------------------ books and resources */

/**
 * The compact shape a resource is searched by.
 *
 * A devotional index ships titles, excerpts and opening words because 850 of them still fit in a
 * page. A book does not: the whole shelf is longer than the daily corpus, and shipping 400 KB of
 * prose so one query can match inside it is a bad trade on the connection this site is built for.
 * So resources are matched on their title, subject, blurb, author and opening words — and the
 * result says as much, rather than pretending a full-text search happened.
 */
export interface ResourceSearchDoc {
  slug: string;
  title: string;
  subtitle: string;
  blurb: string;
  opening: string;
  tags: string[];
  author: string;
  kindLabel: string;
  words: number;
}

export interface ResourceMatch {
  doc: ResourceSearchDoc;
  score: number;
  matchedOn: 'title' | 'subject' | 'blurb' | 'author' | 'opening';
}

export function scoreResource(
  doc: ResourceSearchDoc,
  tokens: string[],
  phrase: string
): { score: number; matchedOn: ResourceMatch['matchedOn'] } | null {
  if (!tokens.length) return null;

  const title = norm(`${doc.title} ${doc.subtitle}`);
  const blurb = norm(doc.blurb);
  const opening = norm(doc.opening);
  const tags = norm(doc.tags.join(' '));
  const author = norm(`${doc.author} ${doc.kindLabel}`);

  let score = 0;
  let matchedOn: ResourceMatch['matchedOn'] = 'blurb';
  const add = (points: number, field: ResourceMatch['matchedOn']) => {
    score += points;
    const rank = { title: 6, subject: 5, author: 4, blurb: 3, opening: 2 } as const;
    if (rank[field] > rank[matchedOn] || score === points) matchedOn = field;
  };

  for (const token of tokens) {
    if (title.includes(token)) add(title.startsWith(token) ? 16 : 12, 'title');
    if (tags.includes(token)) add(9, 'subject');
    if (author.includes(token)) add(6, 'author');
    if (blurb.includes(token)) add(4, 'blurb');
    if (opening.includes(token)) add(2, 'opening');
  }

  if (!score) return null;
  if (phrase && phrase.length > 3) {
    if (title.includes(phrase)) score += 14;
    if (blurb.includes(phrase)) score += 5;
  }
  return { score, matchedOn };
}

/** Rank the shelf for a query; ties break on length (a book that matches a title is a big deal). */
export function searchResourceDocs(docs: ResourceSearchDoc[], query: string, limit = 12): ResourceMatch[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const phrase = norm(query).replace(/\s+/g, ' ');
  return docs
    .map((doc) => ({ doc, ...(scoreResource(doc, tokens, phrase) ?? { score: 0, matchedOn: 'blurb' as const }) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || b.doc.words - a.doc.words || a.doc.title.localeCompare(b.doc.title))
    .slice(0, limit);
}
