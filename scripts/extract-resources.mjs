#!/usr/bin/env node
/**
 * extract-resources.mjs — publishes everything in `pdf/` that is *not* a monthly edition.
 *
 * `extract-devotionals.mjs` owns the daily devotionals (adults, TEEVO, RORER) and
 * `extract-kids.mjs` owns the RORK magazine. That leaves the rest of the folder: books, sermon
 * notes, and the Global Prayer & Fasting / Loveworld Specials programme guides. They are the
 * reason a reader comes to a devotional site and stays — so they are published too, as
 * `content/resources/*.md` under `/resources`.
 *
 * Two kinds of source, one pipeline:
 *
 *  - **Typeset PDFs** with a real text layer. Items are grouped into visual rows by baseline and
 *    joined by *gap*, not by a blanket space: a justified book splits words across items ("he" +
 *    "alth"), and joining every item with a space is what turns a clean PDF into "divine he alth".
 *    Row height and indentation then give headings and paragraphs for free.
 *  - **Scanned PDFs** whose only "text" is a watermark. Those are rendered and read by tesseract,
 *    reusing the OCR machinery from `extract-kids.mjs`, and are marked `recovered: "ocr"` with a
 *    mean confidence — the site says out loud that the words were recognised, not copied, exactly
 *    as it does for the kids' magazine.
 *
 * Furniture (running heads, folios, the transcriber's credit, publisher watermarks) is removed by
 * *repetition*, not by a hardcoded list: a line that appears on most pages of a book is a running
 * head whatever it says. That is what lets an unseen PDF be added to `REGISTRY` and come out clean.
 *
 * Usage:
 *   node scripts/extract-resources.mjs                 # (re)write content/resources/*.md
 *   node scripts/extract-resources.mjs --verify        # parse + assert, write nothing
 *   node scripts/extract-resources.mjs --only <slug>   # one resource
 *   node scripts/extract-resources.mjs --no-ocr        # text layer only (fast, skips scans)
 *   node scripts/extract-resources.mjs --density 200   # OCR render resolution
 *
 * Every assertion failure is reported and exits non-zero, so CI can run `npm run resources:verify`.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadPdfjs, ocrRendered, ocrWorker, renderPages } from './extract-kids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

/* ------------------------------------------------------------------ what is in the folder */

/**
 * One entry per published resource.
 *
 * The file names in `pdf/` are whatever the publisher called them ("PROPHECY(1).pdf", "Now You
 * Want To Marry (1).pdf"), so the registry is also where a title becomes a title, a slug becomes a
 * URL, and a reader-facing blurb is written once instead of being guessed from a file name.
 *
 * `scanned: true` forces the OCR pass; without it the pipeline measures the text layer and decides
 * per document. `date` is only set where the document itself states one — an invented publication
 * date on a book is worse than none.
 */
export const REGISTRY = [
  {
    file: 'The Power of Your Mind  by Pastor Chris Oyakhilome.pdf',
    slug: 'the-power-of-your-mind',
    title: 'The Power of Your Mind',
    subtitle: 'Walk in divine excellence and transform your world through the power of a renewed mind',
    kind: 'book',
    author: 'Chris Oyakhilome',
    publisher: 'LoveWorld Publishing',
    year: 2016,
    isbn: '978-978-51521-5-9',
    date: '',
    tags: ['Mind', 'Renewal', 'Faith', 'Discipleship'],
    blurb:
      'The book on renewing your mind: how thinking God’s thoughts — rather than reacting to what you can see — changes what you can do.',
    scanned: true,
  },
  {
    file: 'Seven Things The HOLYSPIRIT Will Do For You .pdf',
    slug: 'seven-things-the-holy-spirit-will-do-for-you',
    title: 'Seven Things the Holy Spirit Will Do for You',
    kind: 'book',
    author: 'Chris Oyakhilome',
    publisher: 'LoveWorld Publications',
    date: '',
    tags: ['Holy Spirit', 'Fellowship', 'Prayer'],
    blurb:
      'What the Holy Spirit does for a believer who yields to Him — guidance, fellowship, prayer, transformation — set out one work at a time.',
    scanned: true,
  },
  {
    file: 'PROPHECY(1).pdf',
    slug: 'prophecy',
    title: 'Prophecy',
    kind: 'book',
    author: 'Chris Oyakhilome',
    publisher: 'LoveWorld Publications',
    date: '',
    tags: ['Prophecy', 'The Word', 'Revelation'],
    blurb: 'What prophecy is, where it comes from, and how a believer is meant to receive and act on it.',
    scanned: true,
  },
  {
    file: 'KEEPING YOUR HEALING.pdf',
    slug: 'keeping-your-healing',
    title: 'Keeping Your Healing',
    kind: 'study',
    author: 'Chris Oyakhilome',
    publisher: 'LoveWorld Publications',
    date: '',
    tags: ['Healing', 'Faith', 'Confession'],
    blurb:
      'A short, practical study on standing on divine healing after you have received it: what to reject, what to say, and what to do with symptoms.',
  },
  {
    file: 'Now You Want To Marry (1).pdf',
    slug: 'now-you-want-to-marry',
    title: 'Now You Want to Marry',
    subtitle: 'A counselling guide for brethren intending to marry',
    kind: 'book',
    author: 'Marriage Counselling Unit, Christ Embassy',
    publisher: 'Christ Embassy Port Harcourt',
    year: 2007,
    date: '',
    tags: ['Marriage', 'Counselling', 'Family', 'Courtship'],
    blurb:
      'The Christ Embassy marriage counselling guide: what marriage is for, how to prepare for it, and the questions to answer before you take it on.',
  },
  {
    file: '2026 - THE YEAR OF MANIFESTATION.pdf',
    slug: '2026-the-year-of-manifestation',
    title: '2026 — The Year of Manifestation',
    kind: 'sermon-notes',
    author: 'Chris Oyakhilome',
    publisher: 'LoveWorld Inc.',
    date: '2025-12-31',
    dateNote: 'New Year’s Eve Service, 31 December 2025',
    tags: ['Prophecy', 'New Year', 'Manifestation'],
    blurb:
      'The word given at the New Year’s Eve service: what the year of manifestation is, and the part a believer plays in it.',
    credit: 'Transcribed by Sis Chiagozie Efe-Ovririe · Compiled by DanGreatness Edjeba',
  },
  {
    file: 'GLOBAL_PRAYER_&_FASTING_WITH_PASTOR_CHRIS_JANUARY_2026_EDITION_GRAND.pdf',
    slug: 'global-prayer-and-fasting-january-2026',
    title: 'Global Prayer & Fasting — January 2026',
    kind: 'programme',
    author: 'Chris Oyakhilome',
    publisher: 'LoveWorld Inc.',
    date: '2026-01-01',
    dateNote: 'January 2026 edition',
    tags: ['Prayer', 'Fasting', 'Global Prayer & Fasting'],
    blurb: 'The January 2026 edition of the Global Prayer & Fasting programme with Pastor Chris, in full.',
  },
  {
    file: 'MARCH 2026 GLOBAL FASTING AND PRAYING.pdf',
    slug: 'global-prayer-and-fasting-march-2026',
    title: 'Global Prayer & Fasting — March 2026',
    kind: 'programme',
    author: 'Chris Oyakhilome',
    publisher: 'LoveWorld Inc.',
    date: '2026-03-26',
    dateNote: 'Day 1 is 26 March 2026',
    tags: ['Prayer', 'Fasting', 'Global Prayer & Fasting'],
    blurb: 'The March 2026 programme, day by day, as it was preached.',
    credit: 'Transcribed by Sis Chaigozie Efe-Ovririe · Compiled by DanGreatness Edjeba',
  },
  {
    file: 'NOTES Your Loveworld Specials Season 12 Phase 1 Day 1.pdf',
    slug: 'loveworld-specials-season-12-phase-1',
    title: 'Your Loveworld Specials — Season 12, Phase 1',
    kind: 'programme',
    author: 'Chris Oyakhilome',
    publisher: 'LoveWorld Inc.',
    date: '',
    dateNote: 'Season 12, Phase 1, Day 1',
    tags: ['Prayer', 'Fasting', 'Loveworld Specials'],
    blurb: 'The notes from Season 12, Phase 1 of Your Loveworld Specials, day by day.',
  },
  {
    file: 'YOUR LOVEWORLD SPECIALS SEASON 12 PHASE 4 NOTE.pdf',
    slug: 'loveworld-specials-season-12-phase-4',
    title: 'Your Loveworld Specials — Season 12, Phase 4',
    kind: 'programme',
    author: 'Chris Oyakhilome',
    publisher: 'LoveWorld Inc.',
    date: '2026-09-09',
    dateNote: 'Day 1 is 9 September 2026',
    tags: ['Prayer', 'Fasting', 'Loveworld Specials'],
    blurb: 'The notes from Season 12, Phase 4 of Your Loveworld Specials, day by day.',
    credit: 'Transcribed by Sis Chaigozie Efe-Ovririe · Compiled by DanGreatness Edjeba',
  },
];

export const KINDS = ['book', 'study', 'sermon-notes', 'programme'];

/** Below this many characters per page there is no usable text layer and OCR is the only option. */
export const MIN_LAYER_CHARS_PER_PAGE = 220;

/** A row gap wider than this is a real space between words; narrower is one word in two items. */
export const SPACE_GAP_PT = 0.9;

/* ------------------------------------------------------------------ furniture */

/**
 * Lines that are never anybody's sentence: publisher watermarks, the transcriber's credit that
 * repeats on every page of a set of notes, page numbers, and the URLs and app adverts the printed
 * matter carries. Repetition catches most of the rest (see `repeatedLines`).
 */
export const NOISE_PATTERNS = [
  /^\d{1,4}$/,
  /^page\s+\d+/i,
  /^(chris\s*)?oyakhilome$/i,
  /^c\s+h\s+r\s+i\s+s/i, // the spaced-out watermark tesseract reads letter by letter
  /^loveworld (publications|publishing)$/i,
  /^transcribed by\b/i,
  /^compiled by\b/i,
  /^rhapsody of realities$/i,
  /rhapsodyofrealities\.org/i,
  /loveworldpublishing\.com/i,
  /loveworldinc\.(com|org)/i,
  /\bwww\.[\w-]+\.[a-z]{2,}\b/i,
  /\b(kingschat|christembassy\.org|loveworldinc\.(com|org))\b/i,
  /^visit\b/i,
  /scan to\b/i,
  /(app|play) store$/i,
  /^all rights reserved/i,
  /^copyright\b|^©/, // a line opening on the copyright symbol is furniture whatever follows it
  /^isbn\b/i,
  /^first published\b/i,
  /^printed in\b/i,
  /^table of contents$|^contents$/i,
  // An imprint page's address block. "Unit C2, Thamesview Business Centre" is the publisher's
  // door, not a chapter — and a scan leaves it standing alone on a page, where a heading would be.
  /^p\.?\s*o\.?\s*box\b/i,
  /^(unit|suite|plot|block|flat|house|building)\s+[a-z0-9][\w\-]*,\s+[^.!?\n]{0,50}$/i,
  /^(tel|telephone|phone|fax|mobile|email|e-mail)\s*[:.]?\s*[+\d]/i,
  /^(business centre|industrial (estate|area|layout)|postal address|registered (office|address))\b/i,
];

/** True when a line is furniture rather than content. */
export function isNoise(line) {
  const text = String(line ?? '').trim();
  if (!text) return true;
  if (text.length < 2) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Lines that repeat across a document — a running head, a running foot, or a credit printed at
 * the top of every page of the notes. A line that appears on more than a third of the pages is
 * furniture whatever it says, which is how an unseen PDF comes out clean with no new patterns.
 *
 * The title page is exempted: a book's own title repeats in the running head *and* legitimately
 * opens the document, and only the repeated instances are dropped.
 */
/**
 * A number with a label — "CHAPTER 3", "DAY 1", "PHASE 2" — which is the opposite of a running
 * head: a folio is a *title* with a number after it. These must never be treated as repetition,
 * because normalising the number away collapses every chapter heading in a book onto one key and
 * the whole structure disappears with it.
 */
export const STRUCTURAL_HEADING =
  /^(chapter|part|section|lesson|day|phase|step|week|book|unit|module|session)\s*[:#.\-]?\s*\d/i;

export function repeatedLines(pages, { threshold = 0.34 } = {}) {
  const counts = new Map();
  for (const lines of pages) {
    const seen = new Set();
    for (const line of lines) {
      if (STRUCTURAL_HEADING.test(String(line ?? '').trim())) continue;
      const key = normaliseForRepeat(line);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const repeated = new Set();
  for (const [key, count] of counts) {
    if (count >= Math.max(3, pages.length * threshold)) repeated.add(key);
  }
  return repeated;
}

/**
 * Lines that only ever appear in a book's front (or back) matter: the rights paragraph, the
 * publisher's offices and phone numbers, the printing history. A *page* made mostly of these is
 * not part of the book, and reading it aloud to somebody who asked for chapter one is worse than
 * not printing it at all.
 */
export const FRONT_MATTER_PATTERNS = [
  /all rights reserved/i,
  /may not be (re)?produced/i,
  /no part of this (book|publication)/i,
  /express written permission/i,
  /scripture quotations are taken/i,
  /\btel\s*[:.]|\btel\s*\/\s*fax|\bfax\s*[:.]/i,
  /\bp\.?\s*o\.?\s*box\b/i,
  /\bwww\.|@[a-z0-9.-]+\.(org|com|net)\b/i,
  /\bfirst printing\b|\bprinted in\b|\bisbn\b/i,
  /\bchrist embassy\b|\bbelievers.? loveworld\b|\bkingschat\b/i,
  /^\d{1,3}$/,
];

/**
 * A contents entry: a structural word, a title, and the page that title starts on — the shape a
 * list at the front of a book has. "CHAPTER 1" alone is *not* one: it is the heading itself, so
 * the word count is what tells the two apart (see `isContentsEntry`).
 */
export const CONTENTS_LINE =
  /^(chapter|part|section|introduction|conclusion|epilogue|appendix|lesson|day|phase|book|unit|module|session)\b.*\s+\d{1,3}$/i;

/** True when a line is an entry in a contents list rather than the heading it points at. */
export function isContentsEntry(line) {
  const text = String(line ?? '').trim();
  if (text.split(/\s+/).length < 3) return false;
  // An entry carries one label, a title, and the page that title starts on. Two labels — "Phase 1
  // Day 1", "Chapter 3 Lesson 2" — is a heading with its own numbering on it, not a list.
  const labels = text.match(
    /\b(?:chapter|part|section|introduction|conclusion|epilogue|appendix|lesson|day|phase|book|unit|module|session)\b/gi,
  );
  if (labels && labels.length > 1) return false;
  return CONTENTS_LINE.test(text);
}

/**
 * Lines that cannot appear in a book's prose at all, however badly OCR reads them: a rights
 * sentence, a phone number, a postal box. One of these on a page says the page is furniture even
 * when the rest of it is too mangled to recognise — which is exactly what a scanned address page
 * looks like after tesseract.
 */
export const STRONG_FRONT_MATTER = [
  /all rights reserved/i,
  /express written permission/i,
  /may not be (re)?produced/i,
  /scripture quotations are taken/i,
  /\btel\s*[:.]|\btel\s*\/\s*fax/i,
  /\bp\.?\s*o\.?\s*box\b/i,
  /\bisbn\b/i,
];

/** True when a line belongs in the front matter rather than the body. */
export function isFrontMatterLine(line) {
  const text = String(line ?? '').trim();
  if (!text) return false;
  if (isContentsEntry(text)) return true;
  if (isContentsBlob(text)) return true;
  return FRONT_MATTER_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * True when a whole page is publishing furniture.
 *
 * Judged by proportion, not by a page number: half of these PDFs open with a half-title, a rights
 * page and a contents list, and the exact count differs from book to book. A page needs at least
 * four lines and half of them furniture before it is dropped, so one stray "Tel:" in a real
 * paragraph cannot take a page with it.
 */
export function isFrontMatterPage(page) {
  const lines = (page.rows ?? []).map((row) => String(row.text ?? '').trim()).filter(Boolean);
  if (lines.length < 4) return false;
  const furniture = lines.filter((line) => isFrontMatterLine(line) || isNoise(line)).length;
  if (furniture / lines.length >= 0.5) return true;
  // A scanned rights or address page reads badly: a third of it may be unrecognisable, but the
  // phone number on it is still a phone number, and no chapter of a book contains one.
  const strong = lines.filter((line) => STRONG_FRONT_MATTER.some((pattern) => pattern.test(line))).length;
  return strong > 0 && furniture / lines.length >= 0.3;
}

/**
 * True when a page is a cover or a title page: a handful of short display-type fragments and not
 * one sentence among them. OCR reads a cover as its words in whatever order the letters fell,
 * which is how "## Holy Spurt" ends up being the first heading of a book.
 */
export function isCoverPage(page) {
  const lines = (page.rows ?? []).map((row) => String(row.text ?? '').trim()).filter(Boolean);
  if (lines.length < 2 || lines.length > 14) return false;
  const short = lines.filter((line) => line.split(/\s+/).length <= 6).length;
  const sentence = lines.filter((line) => /[.!?]$/.test(line) && line.split(/\s+/).length > 6).length;
  return sentence === 0 && short / lines.length >= 0.7;
}

/**
 * Lines that open a page.
 *
 * A running head is the chapter or book title with the page number beside it, printed at the top
 * of every page — so it repeats once per *chapter*, not once per book, and a whole-document
 * repetition threshold lets it through (a 191-page book has chapters of twenty pages). Opening
 * three pages is furniture whatever the threshold says. A line that ends a sentence is spared:
 * that is a paragraph running over from the previous page, not a head.
 */
export function openingLines(pages, { min = 3, numberedMin = 2 } = {}) {
  const counts = new Map();
  const numbered = new Map();
  for (const page of pages) {
    const rows = (page.rows ?? []).filter((row) => String(row.text ?? '').trim());
    const first = rows[0];
    if (!first) continue;
    const text = String(first.text).trim();
    if (/[.!?]["']?$/.test(text)) continue;
    if (STRUCTURAL_HEADING.test(text)) continue;
    const key = normaliseForRepeat(text);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    // A page-opening line that ends on a number is a running head with its folio attached, and it
    // only takes two of them to be sure: no chapter heading is printed with a page number after it.
    if (/\s\d{1,3}$/.test(text)) numbered.set(key, (numbered.get(key) ?? 0) + 1);
  }
  const repeated = new Set();
  for (const [key, count] of counts) if (count >= min) repeated.add(key);
  for (const [key, count] of numbered) if (count >= numberedMin) repeated.add(key);
  return repeated;
}

/**
 * Drop the pages that are not the book: front matter anywhere, covers only at the front.
 *
 * The count comes back so `--verify` can report it — silently throwing pages away is how a chapter
 * goes missing and nobody notices until a reader does.
 */
export function dropFurniturePages(pages) {
  const kept = [];
  let frontMatter = 0;
  let covers = 0;
  pages.forEach((page, index) => {
    if (isFrontMatterPage(page)) {
      frontMatter += 1;
      return;
    }
    if (index < 4 && isCoverPage(page)) {
      covers += 1;
      return;
    }
    kept.push(page);
  });
  // Never come back empty: if every page looked like furniture, the heuristics are wrong about
  // this document and the whole of it is better than none of it.
  if (!kept.length) return { pages, frontMatter: 0, covers: 0 };
  return { pages: kept, frontMatter, covers };
}

/** Compare furniture ignoring case, punctuation and the odd spacing OCR introduces. */
export function normaliseForRepeat(line) {
  const text = String(line ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    // A running head is the book's title with the page number in front of or behind it
    // ("6 the power of your mind", "prophecy 41"), so it never repeats *verbatim* — and a
    // repetition filter that cannot see it leaves a heading on every other page of the book.
    .replace(/^\d{1,4} | \d{1,4}$/g, ' ')
    .trim();
  // A watermark read letter by letter ("c h r i s o y a k h i l o m e") collapses to its words.
  return text.replace(/\b([a-z])(?: ([a-z]))+\b/g, (match) => match.replace(/ /g, ''));
}

/* ------------------------------------------------------------------ geometry */

/**
 * Items → visual rows, top to bottom. Each row keeps its height and its left edge because those
 * are what make a heading a heading and a paragraph a paragraph in a typeset book.
 */
export function rowsFromItems(items) {
  const rows = new Map();
  for (const item of items ?? []) {
    if (!('str' in item) || !item.str.trim()) continue;
    const y = Math.round(item.transform[5] / 2) * 2;
    const row = rows.get(y) ?? [];
    row.push(item);
    rows.set(y, row);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, row]) => {
      const ordered = [...row].sort((a, b) => a.transform[4] - b.transform[4]);
      return {
        y,
        x0: ordered[0].transform[4],
        height: Math.max(...ordered.map((item) => item.height || 0)),
        text: joinItems(ordered),
      };
    })
    .filter((row) => row.text.length > 0);
}

/**
 * Join the items on one row, inserting a space only where the page actually left one.
 *
 * A justified PDF routinely splits a word across two items with a fraction of a point between
 * them; joining every item with a space produces "he alth" and "o f". A gap wider than
 * `SPACE_GAP_PT` is a real word space — and an item that already carries its own leading or
 * trailing space is honoured as printed.
 */
export function joinItems(items) {
  let line = '';
  let previous = null;
  for (const item of items) {
    const text = item.str;
    if (!line) {
      line = text;
      previous = item;
      continue;
    }
    const gap = item.transform[4] - (previous.transform[4] + previous.width);
    const spaced = gap > SPACE_GAP_PT || /\s$/.test(previous.str) || /^\s/.test(text);
    line += (spaced ? ' ' : '') + text;
    previous = item;
  }
  return line.replace(/\s+/g, ' ').trim();
}

/** The modal (most common) left edge of body rows — a paragraph starts where it is indented past. */
export function modalIndent(pages) {
  const counts = new Map();
  for (const page of pages) {
    for (const row of page.rows) {
      const key = Math.round(row.x0 / 2) * 2;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let best = 0;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/** The median row height — a heading is taller than the body it introduces. */
export function medianHeight(pages) {
  const heights = pages.flatMap((page) => page.rows.map((row) => row.height)).filter((h) => h > 0).sort((a, b) => a - b);
  if (!heights.length) return 0;
  return heights[Math.floor(heights.length / 2)];
}

/* ------------------------------------------------------------------ reading the source */

/**
 * One pdf.js for the whole run — the same copy `pdf-to-img` renders with. Importing the root
 * `pdfjs-dist` as well would put two versions in one process and every OCR render would fail on a
 * worker-version mismatch.
 */
let pdfjsPromise = null;
function pdfjs() {
  pdfjsPromise ??= loadPdfjs();
  return pdfjsPromise;
}

/** The text layer of a whole document, one page at a time. */
export async function readTextLayer(file) {
  const { getDocument } = await pdfjs();
  const data = new Uint8Array(readFileSync(file));
  const loadingTask = getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
    // Without the standard fonts pdf.js warns on every page and measures text from a fallback
    // face, which is what headings are told apart from body copy by.
    standardFontDataUrl: `${path.join(REPO_ROOT, 'node_modules/pdfjs-dist/standard_fonts')}/`,
  });
  const doc = await loadingTask.promise;
  const pages = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    pages.push({ number, rows: rowsFromItems(content.items) });
  }
  const pageCount = doc.numPages;
  // pdf.js 5 moved `destroy()` from the document proxy onto the loading task; support both so the
  // script does not depend on which copy npm happened to resolve.
  if (typeof loadingTask.destroy === 'function') await loadingTask.destroy();
  else if (typeof doc.destroy === 'function') await doc.destroy();
  const chars = pages.reduce((sum, page) => sum + page.rows.reduce((n, row) => n + row.text.length, 0), 0);
  return { pages, pageCount, charsPerPage: pageCount ? chars / pageCount : 0 };
}

/**
 * OCR a scanned document. Rendering is streamed so a 200-page book never holds every page image
 * in memory at once, and the worker is created once for the whole run (it unpacks a 4 MB language
 * model on first use).
 */
/**
 * Repair the OCR mistakes that are worth repairing before anything reads the line.
 *
 * A capital "I" in a serif face is a bare vertical stroke, and tesseract reads it as a pipe:
 * "When | say we are a people of prophecy". Left alone it is on every page of a scanned book, and
 * a reader notices it in the first sentence. Only a stroke with space on both sides is touched —
 * a real pipe inside a table or a URL is never surrounded by spaces in prose.
 */
export function tidyOcrLine(text) {
  return String(text ?? '')
    .replace(/(?<=^|\s)\|(?=\s|$)/g, 'I')
    // The same stroke read at the start of a sentence, where OCR sometimes keeps the space after it.
    .replace(/\bl(?=[A-Z]{2,})/g, 'I');
}

/**
 * A contents list OCR read as a *single* line: "1. He Will Bring You God's Presence 9 2, He Will
 * Teach You 15 3. …". Line-level rules cannot see the items inside it, so it is recognised by its
 * shape — an enumerated run of titles with page numbers between them — and dropped as furniture.
 */
export function isContentsBlob(line) {
  const text = String(line ?? '');
  if (text.length < 60) return false;
  const enumerated = text.match(/(?:^|\s)\d+[.,)]\s+[A-Za-z]/g) ?? [];
  const numbers = [...text.matchAll(/(?:^|\s)(\d{1,3})(?=\s|$)/g)].map((match) => Number(match[1]));
  if (enumerated.length < 4 || numbers.length < 4) return false;
  // The tell: a contents list's page numbers ascend. A list of scriptures does not
  // ("1. Romans 12 2. John 15 3. Acts 2"), and that list is somebody's further study.
  return numbers.every((number, index) => index === 0 || number > numbers[index - 1]);
}

export async function readOcr(file, worker, { density = 200 } = {}) {
  const bytes = new Uint8Array(readFileSync(file));
  const pages = [];
  let confidences = [];
  for await (const rendered of renderPages(bytes, { scale: density / 72 })) {
    if (typeof rendered?.number !== 'number' || !rendered.png) continue;
    const result = await ocrRendered(rendered.png, worker);
    confidences.push(result.confidence);
    pages.push({
      number: rendered.number,
      rows: result.text
        .split('\n')
        .map((text) => tidyOcrLine(text.replace(/\s+/g, ' ').trim()))
        .filter(Boolean)
        // OCR gives no geometry, so the rows carry a neutral height and indent; headings are then
        // found by shape (capitals, keywords) rather than by type size.
        .map((text) => ({ y: 0, x0: 0, height: 0, text })),
    });
    process.stdout.write(`\r  ${path.basename(file)}: page ${rendered.number}`);
  }
  process.stdout.write('\n');
  const confidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  return { pages, pageCount: pages.length, confidence: Number(confidence.toFixed(1)) };
}

/* ------------------------------------------------------------------ structure */

const SECTION_WORDS = [
  'preface', 'foreword', 'introduction', 'conclusion', 'epilogue', 'afterword',
  'about the author', 'acknowledgement', 'acknowledgements', 'dedication', 'contents',
];

/**
 * Is this row a heading?
 *
 * Three signals, any one of which is enough: an explicit marker ("DAY 1", "CHAPTER 3", "PART TWO"),
 * a known front/back-matter word, or type that is both short and louder than the body — all caps,
 * or set larger than the median row. Requiring *short* keeps a shouted sentence inside a sermon
 * ("GOD IS NOT A MAN THAT HE SHOULD LIE") from becoming a chapter of its own… unless it is caps
 * and taller than the body, which is exactly how a printed heading looks.
 */
/**
 * Words a heading does not end with.
 *
 * OCR reads a page's display type — a pull-quote set large across three lines — as three separate
 * rows, and each one looks exactly like a heading: short, capitalised, louder than the body. What
 * gives them away is that they stop in the middle of a phrase ("The Way To", "Improve, And"). A
 * real heading ends on a word that can end a title, so a candidate ending on a conjunction, an
 * article, a preposition or a comma is a fragment of a sentence and belongs in the paragraph.
 */
export const DANGLING_END =
  /(?:\b(?:and|or|the|a|an|of|to|in|for|your|my|his|her|their|our|its|is|are|was|were|be|been|being|by|with|without|but|that|which|as|at|on|onto|not|no|nor|into|unto|from|than|then|so|if|when|while|because|although|also|only|just|even|very|more|most|some|any|all|each|every|both|either|neither|can|could|will|would|shall|should|may|might|must|do|does|did|have|has|had|you|we|they|he|she|it|me|us|him|them|this|these|those|there|here|such|like|about|above|after|before|between|among|through|throughout|during|until|upon|over|under|again|once|never|always|still|yet|too|however|therefore|thus|amen)\b|[,;:])$/i;

/**
 * Words a heading does not *start* with, for the same reason: "Of Your Thoughts" and "And Only
 * God's" are the second half of a display line. Articles and possessives are deliberately absent —
 * "The Power of Your Mind" and "Your Mind Is The Battlefield" are titles.
 */
export const DANGLING_START =
  /^(?:and|or|but|nor|yet|so|of|because|although|however|therefore|thus|into|unto|than|then|when|while|whereas|if|unless|that|which|who|whom|whose|as|at|on|upon|over|under|through|throughout|during|until|till|from|by|with|without|within|against|between|among|before|after|above|below|behind|beyond|beside|since|for|to|not|neither|either|both|also|only|just|even|still|again|once|never|always)\b/i;

/**
 * A structural label plus the thing it labels: "CHAPTER 3", "PART II", "PART ONE: THE FEAR OF GOD",
 * "Chapter One: The Fear of God". Whatever follows the label has to be a number, a roman numeral or
 * a capitalised title. "part of your armour in the first place!" opens with the same word and is
 * the middle of a sentence, so a lowercase next word is deliberately not enough.
 */
export function isStructuralHeading(text) {
  // "unit" and "book" are deliberately not on this list: an imprint page reads "Unit C2, Thamesview
  // Business Centre" and a book-shaped word at the start of a line is more often an address than a
  // chapter. What a scanned book does have is chapters, parts, days and sections.
  const match = /^(day|chapter|part|section|lesson|phase|step|week)\b\s*[:#.\-]?\s*(.*)$/i.exec(
    String(text ?? '').trim(),
  );
  if (!match) return false;
  const rest = match[2].trim();
  if (!rest) return false;
  if (/^(?:\d+|[ivx]+)(?:\b|$)/i.test(rest)) return true;
  return /^[A-Z0-9"'“‘(]/.test(rest);
}

export function isHeading(row, { bodyHeight = 0, indent = 0, ocr = false } = {}) {
  const text = row.text.trim();
  if (!text || text.length > 90) return false;
  // "CHAPTER 1: RENEWING YOUR MIND 9" is a line in the contents list, not a chapter — but
  // "CHAPTER 1" is the chapter, and the word count is the only thing that tells them apart.
  if (isContentsEntry(text)) return false;
  if (DANGLING_END.test(text)) return false;
  if (DANGLING_START.test(text)) return false;
  // A row that begins on a dash or a comma is the middle of a display line, and one that ends on
  // a full stop is a sentence: neither is a heading, however loudly it was set.
  if (/^[—–\-,.;:()]/.test(text)) return false;
  // A single full stop (or two) ends a sentence; an ellipsis ends a title — “THINK ON THESE
  // THINGS...” is a chapter of this book, and "Reason It Out." is half of a pull-quote.
  if (/(?:^|[^.])\.\.?["'”’]?$/.test(text)) return false;
  if (/\.$/.test(text) && text.split(/\s+/).length > 8) return false; // a sentence, not a label

  if (isStructuralHeading(text)) return true;
  const words = text.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (SECTION_WORDS.includes(words)) return true;

  const letters = text.replace(/[^A-Za-z]/g, '');
  const caps = text.replace(/[^A-Z]/g, '');
  const allCaps = letters.length >= 4 && caps.length / letters.length > 0.85;
  const bigger = bodyHeight > 0 && row.height > bodyHeight * 1.18;
  const wordCount = text.split(/\s+/).length;

  // Loud type is only a heading when the page can be measured. A scanned book sets pull-quotes
  // and display lines in the same capitals as its chapter titles, and with no geometry there is
  // nothing to tell "CHAPTER THREE" from "GIVE THE BEST LIGHT" — so an OCR'd document is
  // structured on what a heading *says* (chapter, part, day, introduction) and everything else
  // stays in the prose, where a fragment of a pull-quote at least reads as part of a sentence.
  if (allCaps && wordCount <= 12) return !ocr;
  if (bigger && wordCount <= 14 && row.x0 >= indent - 4) return true;
  return false;
}

/**
 * Rows → sections of paragraphs.
 *
 * A paragraph starts at an indented row, at a blank gap in an OCR'd page, or after a heading; the
 * rows in between are the same paragraph, whatever the line breaks in the print said. A trailing
 * hyphen is a word split across lines ("com-" + "munion") and is rejoined without a space.
 */
export function toSections(pages, { repeated, bodyHeight, indent, ocr = false } = {}) {
  const sections = [];
  let current = { heading: '', paragraphs: [] };
  let paragraph = [];

  const flushParagraph = () => {
    const text = joinParagraph(paragraph);
    paragraph = [];
    if (text) current.paragraphs.push(text);
  };
  const flushSection = () => {
    flushParagraph();
    if (current.heading || current.paragraphs.length) sections.push(current);
    current = { heading: '', paragraphs: [] };
  };

  for (const page of pages) {
    for (const row of page.rows) {
      const text = row.text.trim();
      if (!text) continue;
      if (repeated?.has(normaliseForRepeat(text))) continue;
      if (isNoise(text)) continue;

      if (isHeading(row, { bodyHeight, indent, ocr })) {
        // A heading ends the paragraph and the section before it.
        flushSection();
        current.heading = tidyHeading(text);
        continue;
      }

      // In a scan there is no geometry left to argue with, so a short line that reads as a rights
      // line, a masthead or an address block is furniture wherever it falls — the imprint page sits
      // at the back of a book as often as at the front. Checked after `isHeading`, so a real
      // heading is never eaten by the list that describes furniture.
      if (ocr && text.split(/\s+/).length < 8 && isFrontMatterLine(text)) continue;

      const startsParagraph = ocr
        ? paragraph.length > 0 && /^[A-Z“"']/.test(text) && /[.!?:"']$/.test(paragraph[paragraph.length - 1]) && row.y === 0
        : row.x0 > indent + 6;

      if (startsParagraph && paragraph.length) flushParagraph();
      paragraph.push(text);
    }
    // A page boundary is a paragraph boundary in a scanned book, where tesseract's own blank line
    // has already been collapsed. In a typeset one it is not — a paragraph runs across pages.
    if (ocr) flushParagraph();
  }
  flushSection();

  return sections.filter((section) => section.heading || section.paragraphs.length);
}

/** Join the printed lines of one paragraph, undoing the hyphenation the page width forced. */
export function joinParagraph(lines) {
  let out = '';
  for (const line of lines) {
    const text = String(line).trim();
    if (!text) continue;
    if (!out) {
      out = text;
      continue;
    }
    if (out.endsWith('-') && /^[a-z]/.test(text)) {
      out = `${out.slice(0, -1)}${text}`; // "com-" + "munion"
      continue;
    }
    out += ` ${text}`;
  }
  return normaliseWhitespace(out);
}

/** A heading as printed, minus the shouting: "DAY 1 26TH MARCH, 2026" reads better in sentence case. */
export function tidyHeading(text) {
  const clean = normaliseWhitespace(String(text).replace(/\s+$/g, ''));
  if (!clean) return '';
  const letters = clean.replace(/[^A-Za-z]/g, '');
  const caps = clean.replace(/[^A-Z]/g, '');
  if (letters.length >= 4 && caps.length / letters.length > 0.85) {
    // Keep an initialism readable ("THE HOLY SPIRIT" → "The Holy Spirit", but "DSC" stays).
    return clean
      .split(' ')
      .map((word) => (/^[A-Z]{2,4}$/.test(word) && !/[aeiou]/i.test(word) ? word : word[0] + word.slice(1).toLowerCase()))
      .join(' ');
  }
  return clean;
}

export function normaliseWhitespace(text) {
  return String(text ?? '')
    .replace(/[\u200b\ufeff]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/,\s*\./g, '.')
    .trim();
}

/* ------------------------------------------------------------------ output */

export function countWords(text) {
  return String(text ?? '').split(/\s+/).filter(Boolean).length;
}

/** The first sentence or two that reads as a sentence — the card and the meta description. */
export function makeExcerpt(sections, fallback = '') {
  for (const section of sections) {
    for (const paragraph of section.paragraphs) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) ?? [paragraph];
      const picked = sentences.slice(0, 2).join(' ').trim();
      if (countWords(picked) >= 8) return picked.slice(0, 320).trim();
    }
  }
  return fallback;
}

const yaml = (value) => `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** The Markdown file for one resource: frontmatter the content layer reads, then the body. */
export function buildMarkdown(entry, doc) {
  const body = doc.sections
    .map((section) => {
      const heading = section.heading ? `## ${section.heading}\n\n` : '';
      return `${heading}${section.paragraphs.join('\n\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');

  const frontmatter = [
    '---',
    `title: ${yaml(entry.title)}`,
    entry.subtitle ? `subtitle: ${yaml(entry.subtitle)}` : null,
    `slug: ${yaml(entry.slug)}`,
    `kind: ${yaml(entry.kind)}`,
    `author: ${yaml(entry.author)}`,
    `publisher: ${yaml(entry.publisher ?? 'LoveWorld Publications')}`,
    `date: ${yaml(entry.date ?? '')}`,
    entry.dateNote ? `dateNote: ${yaml(entry.dateNote)}` : null,
    entry.year ? `year: ${entry.year}` : null,
    entry.isbn ? `isbn: ${yaml(entry.isbn)}` : null,
    `excerpt: ${yaml(doc.excerpt)}`,
    `blurb: ${yaml(entry.blurb ?? doc.excerpt)}`,
    `tags: [${(entry.tags ?? []).map(yaml).join(', ')}]`,
    entry.credit ? `credit: ${yaml(entry.credit)}` : null,
    `sourcePdf: ${yaml(entry.file)}`,
    `sourcePages: ${doc.pageCount}`,
    `words: ${doc.words}`,
    `sections: ${doc.sections.filter((section) => section.heading).length}`,
    `recovered: ${yaml(doc.recovered)}`,
    doc.confidence ? `confidence: ${doc.confidence}` : null,
    `status: "published"`,
    '---',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return `${frontmatter}\n\n${body.trim()}\n`;
}

/* ------------------------------------------------------------------ pipeline */

/** Extract one registry entry into the shape `buildMarkdown` writes. */
export async function extractResource(entry, { pdfDir, ocrWorkerPromise, density = 200, forceOcr = false } = {}) {
  const file = path.join(pdfDir ?? path.join(REPO_ROOT, 'pdf'), entry.file);
  if (!existsSync(file)) throw new Error(`${entry.slug}: no such file — ${path.relative(REPO_ROOT, file)}`);

  const layer = await readTextLayer(file);
  const needsOcr = forceOcr || Boolean(entry.scanned) || layer.charsPerPage < MIN_LAYER_CHARS_PER_PAGE;

  let pages = layer.pages;
  let recovered = 'text-layer';
  let confidence = 0;
  let pageCount = layer.pageCount;

  if (needsOcr) {
    if (!ocrWorkerPromise) throw new Error(`${entry.slug}: scanned PDF needs OCR — drop --no-ocr to skip it`);
    const worker = await ocrWorkerPromise;
    const scanned = await readOcr(file, worker, { density });
    pages = scanned.pages;
    pageCount = scanned.pageCount || layer.pageCount;
    confidence = scanned.confidence;
    recovered = 'ocr';
  }

  // Front matter and covers go before anything else reads the pages: they would otherwise become
  // the book's opening paragraphs, its excerpt and half of its "sections".
  const furniture = dropFurniturePages(pages);
  pages = furniture.pages;

  const repeated = repeatedLines(pages.map((page) => page.rows.map((row) => row.text)));
  // Only for scanned books: a text layer carries the geometry that tells a running head from a
  // heading, and dropping the first line of a page there would cost real content.
  if (recovered === 'ocr') for (const key of openingLines(pages)) repeated.add(key);
  const bodyHeight = recovered === 'ocr' ? 0 : medianHeight(pages);
  const indent = recovered === 'ocr' ? 0 : modalIndent(pages);

  const sections = toSections(pages, { repeated, bodyHeight, indent, ocr: recovered === 'ocr' });
  const words = sections.reduce(
    (sum, section) => sum + section.paragraphs.reduce((n, paragraph) => n + countWords(paragraph), 0),
    0
  );

  return {
    entry,
    pageCount,
    recovered,
    confidence,
    sections,
    words,
    excerpt: makeExcerpt(sections, entry.blurb ?? ''),
    /** Pages that were publishing furniture — reported, never silently dropped. */
    furniturePages: furniture.frontMatter + furniture.covers,
    // Pages that produced nothing at all — reported, because a chapter that OCR could not read is
    // the difference between "published" and "published with a hole in it".
    emptyPages: pages.filter((page) => !page.rows.some((row) => row.text.trim() && !isNoise(row.text))).length,
  };
}

/** Everything `--verify` and the writer both need to agree on. */
export function assertResource(doc, problems) {
  const { entry } = doc;
  const fail = (message) => problems.push(`${entry.slug}: ${message}`);

  if (!doc.words) fail('no words were recovered — the source may be images without an OCR pass');
  if (!doc.sections.length) fail('no sections were built');
  if (doc.words && doc.words < 100) fail(`only ${doc.words} words recovered — check the source`);
  if (!doc.excerpt) fail('no excerpt could be built');

  for (const section of doc.sections) {
    for (const paragraph of section.paragraphs) {
      for (const pattern of NOISE_PATTERNS) {
        // Furniture that survived the repetition filter would be printed on the site.
        if (pattern.test(paragraph.trim().split(/\n/)[0]) && paragraph.split(/\s+/).length < 8) {
          fail(`noise line reached the body: ${paragraph.slice(0, 60)}…`);
          break;
        }
      }
      if (/\s{2,}/.test(paragraph)) fail('a paragraph contains a run of spaces');
    }
  }

  if (doc.recovered === 'ocr' && doc.confidence && doc.confidence < 55) {
    fail(`OCR confidence is ${doc.confidence} — below the 55 the kids' edition requires`);
  }
  if (doc.emptyPages > doc.pageCount * 0.25) {
    fail(`${doc.emptyPages} of ${doc.pageCount} pages produced no text`);
  }
}

function parseArgs(argv) {
  const options = { verify: false, only: null, ocr: true, density: 200, outDir: path.join(REPO_ROOT, 'content', 'resources') };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--verify') options.verify = true;
    else if (arg === '--no-ocr') options.ocr = false;
    else if (arg === '--only') options.only = argv[++i];
    else if (arg === '--density') options.density = Number(argv[++i] ?? 200);
    else if (arg === '--out') options.outDir = path.resolve(argv[++i]);
    else if (arg === '--help' || arg === '-h') options.help = true;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/extract-resources.mjs [--verify] [--only <slug>] [--no-ocr] [--density 200] [--out dir]');
    return;
  }

  let entries = options.only ? REGISTRY.filter((entry) => entry.slug === options.only || entry.file === options.only) : REGISTRY;
  if (!entries.length) {
    console.error(`No registry entry matches "${options.only}". Known slugs: ${REGISTRY.map((e) => e.slug).join(', ')}`);
    process.exit(1);
  }
  // `--no-ocr` is the fast pass over the typeset PDFs; the scanned books are skipped rather than
  // failed, because there is genuinely nothing to read in them without a recogniser.
  if (!options.ocr && !options.only) {
    const skipped = entries.filter((entry) => entry.scanned);
    entries = entries.filter((entry) => !entry.scanned);
    if (skipped.length) console.log(`Skipping ${skipped.length} scanned PDF (--no-ocr): ${skipped.map((e) => e.slug).join(', ')}\n`);
  }

  const pdfDir = path.join(REPO_ROOT, 'pdf');
  const missing = entries.filter((entry) => !existsSync(path.join(pdfDir, entry.file)));
  if (missing.length) {
    for (const entry of missing) console.error(`  ✗ ${entry.slug}: pdf/${entry.file} is not in the folder`);
    process.exit(1);
  }

  // The OCR worker is created only if something needs it: it unpacks a 4 MB model on first use.
  const needsOcr = options.ocr && entries.some((entry) => entry.scanned);
  const ocrWorkerPromise = needsOcr ? ocrWorker(REPO_ROOT) : null;

  const problems = [];
  const written = [];

  if (!options.verify) {
    mkdirSync(options.outDir, { recursive: true });
    // Remove what is no longer in the *registry*, so an unpublished resource cannot linger — and
    // so a fast `--no-ocr` pass never deletes the scanned books a full run already published.
    const keep = new Set(REGISTRY.map((entry) => `${entry.slug}.md`));
    for (const existing of readdirSync(options.outDir).filter((f) => f.endsWith('.md'))) {
      if (!keep.has(existing)) rmSync(path.join(options.outDir, existing));
    }
  }

  for (const entry of entries) {
    process.stdout.write(`${entry.slug} …\n`);
    try {
      const doc = await extractResource(entry, { pdfDir, ocrWorkerPromise, density: options.density, forceOcr: false });
      assertResource(doc, problems);
      const summary = `${doc.pageCount}p · ${doc.recovered}${doc.confidence ? ` @${doc.confidence}` : ''} · ${doc.words.toLocaleString()} words · ${doc.sections.filter((s) => s.heading).length} headings${doc.furniturePages ? ` · ${doc.furniturePages} furniture p. dropped` : ''}`;
      if (options.verify) {
        console.log(`  ✓ ${summary}`);
      } else {
        writeFileSync(path.join(options.outDir, `${entry.slug}.md`), buildMarkdown(entry, doc));
        written.push(summary);
        console.log(`  ✓ ${summary}`);
      }
    } catch (error) {
      problems.push(`${entry.slug}: ${error?.stack?.split('\n')[0] ?? error}`);
    }
  }

  if (ocrWorkerPromise) await ocrWorkerPromise.then((worker) => worker.terminate());

  if (written.length) {
    console.log(`\nWrote ${written.length} resource${written.length === 1 ? '' : 's'} to ${path.relative(REPO_ROOT, options.outDir)}/`);
  }
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  • ${problem}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
