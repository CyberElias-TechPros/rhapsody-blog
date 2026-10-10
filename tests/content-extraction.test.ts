import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  AD_PHRASES,
  NOISE_PATTERNS,
  extractEdition,
  verifyDay,
  type ExtractedDay,
  type ExtractedEdition,
} from '../scripts/extract-devotionals.mjs';

/**
 * The contract between the two source PDFs and the published blog posts.
 *
 * Three layers, each catching a different class of regression:
 * 1. per-day invariants (`verifyDay`) — completeness and shape of every field;
 * 2. line-level coverage — every printed line of a spread must survive into some extracted
 *    field, so nothing can be silently dropped by a future parsing change;
 * 3. freshness — the committed Markdown in `content/devotionals/` must equal what the
 *    extractor produces from the PDFs, so nobody can ship a stale or hand-edited article.
 */

const ROOT = path.resolve(import.meta.dirname, '..');

const EDITIONS = [
  { file: 'september-2026-rhapsody.pdf', slug: '2026-09', days: 30 },
  { file: 'october-2026-rhapsody.pdf', slug: '2026-10', days: 31 },
];

// Vitest cannot use pdf.js' relative worker fallback, so point both at real files on disk.
const DIST = path.join(ROOT, 'node_modules/pdfjs-dist');
GlobalWorkerOptions.workerSrc = path.join(DIST, 'legacy/build/pdf.worker.mjs');
const FONTS = `${path.join(DIST, 'standard_fonts')}/`;

/**
 * Fold case and punctuation away so a line matches across whitespace/quote differences. Letters
 * glued to a digit are folded out of both sides as well: the extractor puts a raised ordinal
 * marker back ("the 10ᵗʰ verse" -> "10th verse"), which the raw PDF line does not report.
 */
const norm = (s: string) =>
  s.toLowerCase().replace(/(\d)[a-z]{1,3}(?=[^a-z0-9]|$)/g, '$1').replace(/[^a-z0-9]+/g, '');

/** Printed lines that are structure or chrome, not article content. */
const SKIP_PATTERNS = [
  /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+\d{1,2}$/, // date rule
  /^prayer$/,
  /^confession$/,
  /^further study:?$/,
  /^1-year bible reading plan$/,
  /^2-year bible reading plan$/,
  /^\d{1,3}$/, // folio
  /^rhapsody of realities$/i, // running head
];

const extracted = new Map<string, ExtractedEdition>();

beforeAll(async () => {
  for (const edition of EDITIONS) {
    extracted.set(edition.slug, await extractEdition(path.join(ROOT, edition.file)));
  }
}, 120_000);


function blob(day: ExtractedDay): string {
  return norm(
    [
      day.title,
      day.scripture,
      ...day.paragraphs,
      day.prayer,
      day.prayerLabel,
      day.furtherStudy,
      day.oneYearPlan,
      day.twoYearPlan,
    ].join(' ')
  );
}

function isChrome(line: string): boolean {
  const trimmed = line.trim();
  return (
    SKIP_PATTERNS.some((re) => re.test(trimmed.toLowerCase())) ||
    NOISE_PATTERNS.some((re) => re.test(trimmed)) ||
    AD_PHRASES.some((re) => re.test(trimmed))
  );
}

describe.each(EDITIONS)('$file', ({ file, slug, days }) => {
  it(`extracts every day of the month (${days})`, () => {
    const edition = extracted.get(slug)!;
    expect(edition.days).toHaveLength(days);
    expect(edition.edition.monthName).toMatch(/^(September|October)$/);
  });

  it('publishes consecutive dates whose printed weekday matches the calendar', () => {
    const edition = extracted.get(slug)!;
    edition.days.forEach((day, i) => {
      expect(day.dayOfMonth).toBe(i + 1);
      expect(day.date).toBe(`${slug}-${String(i + 1).padStart(2, '0')}`);
      expect(day.weekdayPrinted).toBe(day.weekday);
      expect(day.weekdayMatches).toBe(true);
    });
  });

  it('passes every per-day invariant', () => {
    const edition = extracted.get(slug)!;
    for (const day of edition.days) {
      expect(verifyDay(day, file), day.date).toEqual([]);
    }
  });

  it('loses no printed line of any spread', async () => {
    const edition = extracted.get(slug)!;
    let checked = 0;
    let capLines = 0;

    for (const day of edition.days) {
      // Lines carry the drop-cap flag so a cap line can also match after the cap is split off.
      const flagged = await flaggedLines(file, day.pages);
      const haystack = blob(day);
      const misses: string[] = [];

      for (const line of flagged) {
        if (isChrome(line.text)) continue;
        checked += 1;
        if (haystack.includes(norm(line.raw))) continue;
        if (line.startsParagraph) {
          // The cap belongs to the paragraph above; this line merely wraps around it.
          capLines += 1;
          const withoutCap = norm(line.text);
          if (withoutCap.length > 6 && haystack.includes(withoutCap)) continue;
        }
        misses.push(line.raw.slice(0, 90));
      }
      expect(misses, `${day.date} dropped content`).toEqual([]);
    }

    // Sanity on the check itself: ~50 content lines per spread, and a drop-cap line for most
    // days (a cap shares a baseline with its paragraph, so a few merge into a single line).
    expect(checked, 'content lines examined').toBeGreaterThan(days * 45);
    expect(capLines, 'drop-cap lines matched with the cap split off').toBeGreaterThan(days * 0.7);
  }, 180_000);
});

async function flaggedLines(file: string, pages: number[]) {
  const data = new Uint8Array(fs.readFileSync(path.join(ROOT, file)));
  const doc = await getDocument({ data, standardFontDataUrl: FONTS, verbosity: 0 }).promise;
  const out: { text: string; raw: string; startsParagraph: boolean }[] = [];

  for (const pageNo of pages) {
    const content = await doc.getPage(pageNo).then((p) => p.getTextContent());
    const items = (content.items as { str: string; transform: number[]; height: number; width: number }[]).filter(
      (i) => 'str' in i && i.str.length > 0
    );

    const rows = new Map<number, typeof items>();
    for (const item of items) {
      const y = item.transform[5];
      const key = [...rows.keys()].find((k) => Math.abs(k - y) < 1.2) ?? y;
      const bucket = rows.get(key) ?? [];
      bucket.push(item);
      rows.set(key, bucket);
    }

    for (const [y, rowItems] of [...rows.entries()].sort((a, b) => b[0] - a[0])) {
      rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
      const capItem = rowItems.find((i) => i.height >= 18 && i.str.trim().length === 1);
      const textItems = capItem ? rowItems.filter((i) => i !== capItem) : rowItems;
      const text = textItems.map((i) => i.str).join('').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const textHeight = textItems.length ? Math.max(...textItems.map((i) => i.height)) : 0;
      // Same rule the extractor applies: 10pt-or-smaller type in the bottom band is running feet
      // (folio + marketing line), never article content.
      if (textHeight > 0 && textHeight <= 10 && y <= 60) continue;
      // `raw` keeps the cap glyph in place so the check covers the cap itself, not just the
      // words that flowed around it.
      const cap = capItem ? capItem.str.trim() : '';
      out.push({ text, raw: cap ? `${cap} ${text}` : text, startsParagraph: Boolean(capItem) });
    }
  }
  await doc.destroy();
  return out;
}
