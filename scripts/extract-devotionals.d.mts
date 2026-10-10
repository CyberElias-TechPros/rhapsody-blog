/**
 * Type declarations for the content extraction script (plain `.mjs` so it runs with
 * `node scripts/extract-devotionals.mjs` and no build step).
 */

export interface ExtractedDay {
  title: string;
  titleOriginal: string;
  slug: string;
  date: string;
  weekday: string;
  weekdayPrinted: string;
  weekdayMatches: boolean;
  dayOfMonth: number;
  edition: string;
  editionTitle: string;
  year: number;
  month: number;
  monthName: string;
  scripture: string;
  scriptureReference: string;
  paragraphs: string[];
  prayer: string;
  prayerLabel: string;
  furtherStudy: string;
  oneYearPlan: string;
  twoYearPlan: string;
  pages: number[];
  words: number;
  hasDropCap: boolean;
  unconsumed: string[];
  excerpt: string;
  readingMinutes: number;
  tags: string[];
}

export interface ExtractedEdition {
  edition: { year: number; month: number; monthName: string };
  days: ExtractedDay[];
  pageCount: number;
}

export const AD_PHRASES: RegExp[];
export const NOISE_PATTERNS: RegExp[];

export function toTitleCase(caps: string): string;
export function slugify(value: string, maxLength?: number): string;
export function makeExcerpt(paragraphs: string[], limit?: number): string;
export function capNeedsSpace(cap: string, followingText: string): boolean;
export function renderPost(post: ExtractedDay, options: { sourcePdf: string }): string;
export function extractEdition(filePath: string): Promise<ExtractedEdition>;
export function verifyDay(day: ExtractedDay, sourcePdf: string): string[];
