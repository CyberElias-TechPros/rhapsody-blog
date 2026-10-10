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
