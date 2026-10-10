/**
 * Type declarations for the content extraction script (plain `.mjs` so it runs with
 * `node scripts/extract-devotionals.mjs` and no build step).
 *
 * These are the pieces the tests and any caller outside the script need; the script itself stays
 * dependency-free of TypeScript. Shapes here describe what `lib/content.ts` reads back out of the
 * generated front matter, so a new field on a post means a new field here.
 */

/** Which edition family a PDF belongs to — the same table `lib/audiences.ts` mirrors for the app. */
export type AudienceKey = 'adults' | 'teens' | 'early-readers' | 'kids';

export interface AudienceMeta {
  key: AudienceKey;
  /** `For Teens`, as the editions print it. */
  label: string;
  shortLabel: string;
  series: string;
  /** The slug tag used for listings and in `tags:` — `rhapsody-of-realities-for-teens`. */
  tag: string;
  /** Appended to the edition slug: `''` for adults, `-teens` for the teens edition. */
  editionSuffix: string;
  /** `null` for adults, otherwise the audience word inside the post slug. */
  slugToken: string | null;
  blurb: string;
}

export interface PdfLine {
  y: number;
  x0: number;
  x1: number;
  height: number;
  /** The tallest text on the row, ignoring anything read as a drop cap. */
  textHeight: number;
  text: string;
  dropCap: string | null;
  capX: number | null;
  loneGlyph: string | null;
  wrapsDropCap: boolean;
  startsParagraph: boolean;
  spans: { x0: number; x1: number; height: number; str: string }[];
}

export interface PdfPage {
  pageNo: number;
  width: number;
  height: number;
  lines: PdfLine[];
}

/** A section an audience prints that the adult edition has no field for (`Speak`, `Act`). */
export interface ExtractedSection {
  label: string;
  text: string;
}

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
  audience: AudienceKey;
  audienceLabel: string;
  series: string;
  year: number;
  month: number;
  monthName: string;
  scripture: string;
  scriptureReference: string;
  /** The parenthetical line under the title, when the edition prints one. */
  subtitle: string;
  paragraphs: string[];
  prayer: string;
  prayerLabel: string;
  /** The audience's own closing sections, in the order the page prints them. */
  extras: ExtractedSection[];
  furtherStudy: string;
  oneYearPlan: string;
  twoYearPlan: string;
  pages: number[];
  words: number;
  hasDropCap: boolean;
  /** Printed text the extractor did not place in any block — the main thing verify reports. */
  unconsumed: string[];
  excerpt: string;
  readingMinutes: number;
  tags: string[];
}

export interface ExtractedEdition {
  edition: {
    audience: AudienceKey;
    year: number;
    month: number;
    monthName: string;
    editionTitle: string;
  };
  days: ExtractedDay[];
  pageCount: number;
  /** Every word in the document, for resolving an ambiguous drop cap (`I` + `In` vs `I` alone). */
  vocabulary: Set<string>;
  warning: string | null;
}

export interface SourcePlan {
  name: string;
  audience: AudienceKey | null;
  year: number | null;
  month: number | null;
  monthName: string | null;
  editionTitle: string | null;
  /** Why the file is not a daily-devotional edition, when it is not one. */
  skip: string | null;
  warning?: string;
}

export const AD_PHRASES: RegExp[];
export const NOISE_PATTERNS: RegExp[];
export const AUDIENCES: Record<AudienceKey, AudienceMeta>;
export const AUDIENCE_ORDER: AudienceKey[];

/** What each family prints, and therefore what `verifyDay` treats as a complete day. */
export const VERIFY_RULES: Record<
  string,
  {
    minWords: number;
    maxWords: number;
    minParagraphs: number;
    minPrayerChars: number;
    minExcerpt: number;
    requirePrayer: boolean;
    requirePlans: boolean;
    requireFurtherStudy: boolean;
    requireDropCap: boolean;
    referenceInScripture: boolean;
    /** Whether publisher boilerplate in the body is a problem (only the adult edition: the
     *  young readers' editions name their own series inside the article). */
    boilerplate: boolean;
  }
>;

/** How a family's pages are read. A family without an entry here is not extracted. */
export const FAMILIES: {
  adults: { audience: 'adults'; extract(args: { pages: PdfPage[]; edition: ExtractedEdition['edition']; vocabulary: Set<string> }): ExtractedDay[] };
  teens: { audience: 'teens'; extract(args: { pages: PdfPage[]; edition: ExtractedEdition['edition']; vocabulary: Set<string> }): ExtractedDay[] };
  'early-readers': { audience: 'early-readers'; extract(args: { pages: PdfPage[]; edition: ExtractedEdition['edition']; vocabulary: Set<string> }): ExtractedDay[] };
};

export function buildVocabulary(pages: PdfPage[]): Set<string>;
export function toTitleCase(caps: string): string;
export function slugify(value: string, maxLength?: number): string;
export function makeExcerpt(paragraphs: string[], limit?: number): string;
export function capNeedsSpace(cap: string, followingText: string, vocabulary?: Set<string> | null): boolean;
/** Words in `text` that only exist because a cap or superscript lost its space. */
export function findGluedWords(text: string, vocabulary: Set<string> | null): string[];
export function classifySource(file: string, pages?: PdfPage[] | null): SourcePlan;
export function discoverSources(root?: string): string[];
export function readPdf(filePath: string): Promise<PdfPage[]>;
export function extractEdition(filePath: string): Promise<ExtractedEdition>;
export function extractPages(filePath: string, pages: PdfPage[]): Promise<ExtractedEdition>;
export function renderPost(post: ExtractedDay, options: { sourcePdf: string }): string;
export function verifyDay(
  day: ExtractedDay,
  sourcePdf: string,
  options?: { vocabulary?: Set<string> | null }
): string[];
