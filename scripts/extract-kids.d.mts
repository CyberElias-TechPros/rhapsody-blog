/**
 * Types for the kids'-magazine extractor, the same arrangement as `extract-devotionals.d.mjs`: the
 * script is plain JavaScript (it runs under plain `node` in CI), and the tests import from it, so
 * this file is what `tsc` reads. Keep it in step with the script's exports.
 */

export type KidsPageKind = 'cover' | 'contents' | 'verse' | 'story' | 'activity' | 'prayer' | 'note' | 'page' | 'artwork';
export type KidsTextSource = 'text-layer' | 'ocr' | 'none';

export interface KidsSource {
  file: string;
  name: string;
  relative: string;
  year: number;
  month: string;
  monthName: string;
  date: string;
}

export interface KidsExtractOptions {
  ocr?: boolean;
  density?: number;
  storeMaxWidth?: number;
  storeQuality?: number;
  verify?: boolean;
  pages?: string | null;
  outDir?: string;
  assetsDir?: string;
  onProgress?: (issue: string, page: number, total: number) => void;
}

export interface KidsPageData {
  number: number;
  kind: KidsPageKind;
  image: string | null;
  recovered: KidsTextSource;
  confidence: number;
  text: string;
  excerpt: string | null;
}

export interface KidsIssueData {
  slug: string;
  title: string;
  date: string;
  year: number;
  month: string;
  monthName: string;
  sourcePdf: string;
  source: string;
  volume: string | null;
  issn: string | null;
  keyVerse: string | null;
  excerpt: string;
  intro: string;
  pages: KidsPageData[];
  pageCount: number;
  recoveredPages: number;
  recognisedPages: number;
  textlessPages: number;
  imageBytes: number;
}

export const MIN_LAYER_CHARS: number;
export const MIN_PUBLISH_CHARS: number;
export const MIN_OCR_CHARS: number;
export const MIN_OCR_CONFIDENCE: number;
export const OCR_OVER_LAYER_CONFIDENCE: number;
/** Every kind the extractor can emit; `lib/kids.ts` holds the labels the site shows. */
export const KINDS: KidsPageKind[];

export function issueOfName(name: string): { year: number; month: string; monthName: string; date: string } | null;
export function slugForIssue(issue: { year: number; month: string; monthName: string }): string;
export function discoverKidsPdf(root?: string): KidsSource[];
export function linesFromContent(items: unknown[]): string[];
export function joinRow(runs: { x: number; text: string }[]): string;
export function dedupeRow(text: string): string;
export function tidyLayer(lines: string[]): string[];
export function looksTruncated(line: string): boolean;
export function chooseText(input: { layer: string; ocr: { text: string; confidence: number } | null }): {
  text: string;
  recovered: KidsTextSource;
  confidence: number;
};
export function classifyPage(page: { number: number; pageCount: number; text: string }): KidsPageKind;
export function pageExcerpt(text: string, max?: number): string | null;
export function tidyOcr(text: string): string;
/** Per cent of a page image that is not white paper. */
export function inkRatio(image: Uint8Array): Promise<number>;
export const MIN_PAGE_INK: number;
/** Whether an issue's rendered pages look like printed pages rather than words on white. */
export function artworkLooksComplete(inks: number[], floor?: number): boolean;

export function encodePage(png: Buffer, options?: { maxWidth?: number; quality?: number }): Promise<Buffer>;
export function renderPages(bytes: Uint8Array, options?: { scale?: number }): AsyncGenerator<{ number: number; png: Buffer }>;
export function buildIssue(input: { source: KidsSource; slug: string; pages: KidsPageData[]; imageBytes?: number }): KidsIssueData;
export function renderIssue(issue: KidsIssueData): string;
export function extractIssue(source: KidsSource, options?: KidsExtractOptions): Promise<KidsIssueData>;
export function ocrWorker(root?: string): Promise<{ recognize(image: string): Promise<{ data: { text: string; confidence: number } }>; terminate(): Promise<void> }>;
export function ocrRendered(png: Buffer, worker: Awaited<ReturnType<typeof ocrWorker>>): Promise<{ text: string; confidence: number }>;
