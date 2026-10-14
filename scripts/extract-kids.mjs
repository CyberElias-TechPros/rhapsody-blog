#!/usr/bin/env node
/**
 * Extract `Rhapsody of Realities for Kids` (RORK) — a monthly magazine, not a daily devotional.
 *
 * This is a separate script with a separate output shape for one reason: a RORK issue is ~50 pages of
 * comic art, activities and verses, and **44 % of those pages have no text layer at all** — the words
 * are drawn inside the picture. So a page's content is the rendered page image, plus text recovered
 * from whichever source can supply it:
 *
 *   1. the PDF's own text layer, when it has one (exact, and free);
 *   2. OCR of the rendered page, for the picture pages (approximate — such a page is stamped
 *      `recovered: "ocr"` with its mean confidence, and the site says out loud that it is unchecked).
 *
 * Two quirks of these files drive the design:
 * - The typeface prints most lines twice over (a filled glyph and its outline), which shows up in the
 *   text layer as two identical consecutive rows; `tidyLayer` collapses them — the same trick the
 *   devotional extractor uses for double-drawn rows.
 * - The layer also splits words mid-syllable with a space (`there fore`), so the layer is used for
 *   *structure* and a page whose OCR reads better is upgraded to OCR by `chooseText`.
 *
 * One render per page: pdf-to-img walks the document once at `--density` (200 by default, because
 * tesseract on 72 dpi art is unreadable), OCR runs on that buffer, and the committed JPEG is a
 * downscale of the *same* render at `--store-scale` (1× ≈ 72 dpi), which is what a reader on a phone
 * needs when the page's words are already published as text.
 *
 *   node scripts/extract-kids.mjs                        # every RORK PDF → public/kids + content/kids
 *   node scripts/extract-kids.mjs --only april --out /tmp/x --assets /tmp/x   # a pilot run elsewhere
 *   node scripts/extract-kids.mjs --no-ocr               # images + text layer only (fast)
 *   node scripts/extract-kids.mjs --verify               # parse and report, write nothing
 *
 * pdf.js is imported from the copy that pdf-to-img uses (see `loadPdfjs`) so that exactly one
 * version of the library is loaded in the process; mixing two copies fails at render time.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Canvas, loadImage } from '@napi-rs/canvas';
import { pdf as renderPdf } from 'pdf-to-img';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * How much text the layer must carry to be used as-is. Below this the page is OCR'd; the layer is
 * kept only as a fallback. The magazine's own text layer splits words into syllables with a space
 * (`there fore`, `li fe`), which is exact-ish but ugly to read, so a confident OCR wins over it.
 */
export const MIN_LAYER_CHARS = 400;
/** Text this short is a fragment of a clipped frame, not a paragraph worth publishing. */
export const MIN_PUBLISH_CHARS = 24;
/** OCR below this mean confidence is reading texture; the layer (or nothing) is better. */
export const OCR_OVER_LAYER_CONFIDENCE = 65;
/** OCR output below this is page furniture, not text. */
export const MIN_OCR_CHARS = 24;
/** Below this mean confidence tesseract is reading texture, not words: publish the art, not the guess. */
export const MIN_OCR_CONFIDENCE = 55;

/** Page kinds, in the order the app lists them. `lib/kids.ts` labels these. */
export const KINDS = ['cover', 'contents', 'verse', 'story', 'activity', 'prayer', 'note', 'page', 'artwork'];

/**
 * The magazine's recurring blocks, matched on the words a page carries. Order matters: the first
 * match wins, so the specific blocks come before the generic ones.
 */
const BLOCKS = [
  { kind: 'contents', test: /\bcontents\b|in this issue/i },
  { kind: 'verse', test: /\bsay this\b|memori[sz]e|bible verse|one verse|treasuring the word/i },
  { kind: 'story', test: /gospel in pictures|the word for you|god.s word for you|story time/i },
  { kind: 'prayer', test: /\bpray this\b|prayer points?\b/i },
  { kind: 'activity', test: /quiz time|activity|colour|color me|puzzle|match the|tick the box|word search|colouring/i },
  { kind: 'story', test: /\bchapter\b|and then|they said|they shouted|but god\b/i },
  { kind: 'note', test: /published monthly|all rights reserved|^issn[: ]|copyright ©|from the publisher|dear (parent|teacher)/i },
];

/* ------------------------------------------------------------------ discovery */

/**
 * `rork-april-2026.pdf` / `JULY 2026 RORK.pdf` / `rork-october-26.pdf` → `{ year, month, monthName,
 * date }`. A two-digit year is allowed; a filename without a month is refused rather than guessed,
 * because an issue published under the wrong month is worse than one that is missing.
 */
export function issueOfName(name) {
  const lower = String(name).toLowerCase();
  const monthIndex = MONTHS.findIndex((month) => lower.includes(month));
  // Not `\b`: an underscore is a word character, so `rork_june_2026` has no boundary before `2026`.
  const long = lower.match(/(?<!\d)20\d{2}(?!\d)/)?.[0];
  const short = long ? null : lower.match(/(?<!\d)\d{2}(?!\d)/)?.[0];
  if (monthIndex < 0 || (!long && !short)) return null;
  const year = long ? Number(long) : 2000 + Number(short);
  const month = String(monthIndex + 1).padStart(2, '0');
  return { year, month, monthName: MONTHS[monthIndex], date: `${year}-${month}-01` };
}

/** The issue's post slug, which doubles as the directory name for its page images. */
export const slugForIssue = (issue) => `${issue.year}-${issue.month}-kids`;

/** Every RORK PDF in `pdf/` and the repo root, oldest issue first. */
export function discoverKidsPdf(root = REPO_ROOT) {
  const found = [];
  for (const dir of ['pdf', '']) {
    const absolute = path.join(root, dir);
    if (!fs.existsSync(absolute)) continue;
    for (const entry of fs.readdirSync(absolute)) {
      if (!/\.pdf$/i.test(entry) || !/rork|for[-_ ]kids/i.test(entry)) continue;
      const issue = issueOfName(entry);
      if (!issue) continue;
      found.push({ file: path.join(absolute, entry), name: entry, relative: dir ? `${dir}/${entry}` : entry, ...issue });
    }
  }
  const seen = new Map();
  for (const source of found.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))) {
    // Two files claiming the same month is a decision, not something to silently overwrite.
    if (!seen.has(slugForIssue(source))) seen.set(slugForIssue(source), source);
  }
  return [...seen.values()];
}

/* ------------------------------------------------------------------ text layer */

/**
 * Group text items into visual lines: top to bottom, left to right inside a line. Items sharing a
 * baseline are snapped together because two runs on one line differ by a point or two.
 */
export function linesFromContent(items) {
  const rows = new Map();
  for (const item of items ?? []) {
    if (!('str' in item) || !item.str.trim()) continue;
    const y = Math.round(item.transform[5] / 2) * 2;
    const x = Math.round(item.transform[4]);
    const text = item.str.trim();
    const row = rows.get(y) ?? [];
    rows.set(y, row);
    // The outline pass draws the same run at the same place: same baseline, same x, same text. That
    // is the only reliable signature — the syllable splits (`there fore`) come from the run's own
    // kerning, so they cannot be undone here, which is why a thin page is handed to OCR instead.
    if (row.some((run) => run.x === x && run.text === text)) continue;
    row.push({ x, text });
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => joinRow(row.sort((a, b) => a.x - b.x)).replace(/\s+/g, ' ').trim())
    .map(dedupeRow)
    .filter((line) => line && !/^\d{1,3}$/.test(line));
}

/**
 * Join the runs that share a baseline. Two text frames often overlap on a page (a wrapped block and
 * its outline), which leaves one word printed twice at the seam — `…His disciples` + `disciples about
 * it.` — so a word repeated across a seam is spoken once.
 */
export function joinRow(runs) {
  let line = '';
  for (const run of runs) {
    if (!line) {
      line = run.text;
      continue;
    }
    const before = line.split(/\s+/);
    const after = run.text.split(/\s+/);
    if (before.at(-1)?.toLowerCase().replace(/[^a-z']/g, '') === after[0]?.toLowerCase().replace(/[^a-z']/g, '')) {
      line += ' ' + after.slice(1).join(' ');
    } else {
      line += ' ' + run.text;
    }
  }
  return line.trim();
}

/**
 * A row whose text is the same run of words twice is the fill and the outline of one printed line,
 * not a refrain — `SAY THIS SAY THIS` is `SAY THIS`. Odd counts are left alone: a repeated *third*
 * copy would be a design choice, and guessing there is how lines get lost.
 */
export function dedupeRow(text) {
  const words = String(text).trim().split(/\s+/);
  if (words.length < 2 || words.length % 2) return words.join(' ');
  const half = words.length / 2;
  const a = words.slice(0, half).join(' ');
  const b = words.slice(half).join(' ');
  return a.toLowerCase() === b.toLowerCase() ? a : words.join(' ');
}

/**
 * Collapse the double-drawn rows (the same line twice in a row) and drop bare folio numbers. A line
 * only counts as a duplicate if it repeats *immediately* — the magazine prints real refrains, and
 * swallowing those would be wrong.
 */
export function tidyLayer(lines) {
  const once = [];
  for (const line of lines.map((l) => l.trim()).filter(Boolean)) {
    if (/^\d{1,3}$/.test(line)) continue;
    if (once.length && line.toLowerCase() === once[once.length - 1].toLowerCase()) continue;
    once.push(line);
  }
  return once;
}

/** Sentences end in real punctuation; a clipped text frame cuts a word off instead. */
export function looksTruncated(line) {
  return line.length > 12 && !/[.!?:;”"'")\]]$/.test(line);
}

/**
 * Pick the better of the two sources for a page. The layer has the exact glyphs but splits words and
 * doubles rows; OCR reads what the layer cannot see but misreads display type — so OCR wins when the
 * layer is nearly empty, or when OCR is confident *and* the layer is barely more than fragments.
 */
export function chooseText({ layer, ocr }) {
  const layerChars = (layer ?? '').replace(/\s/g, '').length;
  const ocrChars = (ocr?.text ?? '').replace(/\s/g, '').length;
  const usable = ocr && ocrChars >= MIN_OCR_CHARS && ocr.confidence >= MIN_OCR_CONFIDENCE;
  if (usable && (layerChars < MIN_LAYER_CHARS || ocr.confidence >= OCR_OVER_LAYER_CONFIDENCE)) {
    return { text: ocr.text, recovered: 'ocr', confidence: ocr.confidence };
  }
  if (layerChars) return { text: layer, recovered: 'text-layer', confidence: 0 };
  return { text: usable ? ocr.text : '', recovered: usable ? 'ocr' : 'none', confidence: usable ? ocr.confidence : 0 };
}

/* ------------------------------------------------------------------ classification */

/** One kind per page, from the blocks it carries. Artwork without recoverable words is its own kind. */
export function classifyPage({ number, pageCount: _pageCount, text }) {
  // `pageCount` is taken but unused today: the rules that need it (a back cover that repeats the
  // front's strapline) would need a sample big enough to trust, and 9 issues is not one.

  const body = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (number === 1) return 'cover';
  if (!body) return 'artwork';
  for (const block of BLOCKS) if (block.test.test(body)) return block.kind;
  return 'page';
}

/** The first readable sentence of a page, for the strip of thumbnails. */
export function pageExcerpt(text, max = 160) {
  // Drop a leading printed label (`SAY THIS`, `QUIZ TIME`) — it names the block, not the sentence.
  const clean = String(text ?? '')
    .replace(/^(?:[A-Z][A-Z'’ .?!,-]{2,28}\n)+/g, '')
    .replace(/^[A-Z][A-Z'’ .?!,/-]{3,28}\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  const sentence = clean.match(/^.{16,}?[.!?](?:\s|$)/)?.[0]?.trim() ?? clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

/* ------------------------------------------------------------------ OCR */

let workerPromise = null;
/** Held by the driver so it can shut the OCR worker down before exiting. */
export const workerPromiseRef = { current: null };

/** One tesseract worker for the whole run — it unpacks a 4 MB language model on first use. */
export function ocrWorker(root = REPO_ROOT) {
  workerPromiseRef.current = workerPromise ??= (async () => {
    const { createWorker } = await import('tesseract.js');
    const langDir = path.join(root, 'node_modules', '@tesseract.js-data', 'eng');
    const version = fs.readdirSync(langDir).find((entry) => /^\d/.test(entry));
    return createWorker('eng', 1, {
      langPath: path.join(langDir, version ?? ''),
      gzipLangPath: path.join(langDir, version ?? ''),
      cachePath: fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'rork-ocr-')),
    });
  })();
  return workerPromise;
}

/** Lines with fewer than two real words are page frames and halftone noise, not text. */
export function tidyOcr(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => (line.match(/[a-z]{3,}/gi) ?? []).length >= 2)
    .join('\n')
    .trim();
}

/**
 * Recognise an already-rendered page. Colour art is tesseract's worst input, so the page is
 * flattened onto white and thresholded before it is handed over.
 */
export async function ocrRendered(pngBuffer, worker) {
  const image = await loadImage(pngBuffer);
  const canvas = new Canvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = frame.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.round(0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]);
    const boosted = value < 145 ? 0 : value > 205 ? 255 : value;
    data[i] = data[i + 1] = data[i + 2] = boosted;
  }
  ctx.putImageData(frame, 0, 0);
  const file = path.join(process.env.TMPDIR ?? '/tmp', `rork-ocr-${process.pid}-${Math.random().toString(36).slice(2)}.png`);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  try {
    const { data: result } = await worker.recognize(file);
    return { text: tidyOcr(result.text), confidence: Number((result.confidence ?? 0).toFixed(1)) };
  } finally {
    fs.rmSync(file, { force: true });
  }
}

/* ------------------------------------------------------------------ rendering */

/**
 * Encode one rendered page for the site. `maxWidth` is the cap on the long edge; JPEG needs an
 * opaque background, so transparent pixels are filled white first, or every page prints black.
 */
export async function encodePage(pngBuffer, { maxWidth = 420, quality = 0.72 } = {}) {
  const image = await loadImage(pngBuffer);
  const scale = Math.min(1, maxWidth / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toBuffer('image/jpeg', { quality });
}

/**
 * How much of an image is not white paper, in per cent. A magazine page is a designed object — full
 * bleed colour, panels, artwork — so this says whether the render arrived. `@napi-rs/canvas` cannot
 * decode the JPEG2000 some of these PDFs embed, and when it fails the page comes out as words on a
 * white field: 70 and up is a printed page, under it is a page whose pictures never came through.
 */
export async function inkRatio(jpegBuffer) {
  const image = await loadImage(jpegBuffer);
  const canvas = new Canvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const step = 16; // one pixel in four is plenty at this size
  let inked = 0;
  for (let i = 0; i < data.length; i += step) {
    if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) inked++;
  }
  return Math.round((100 * inked) / (data.length / step), 1);
}

/** The median ink a page image must show to count as a printed page. */
export const MIN_PAGE_INK = 50;

/** The median, not the minimum: one deliberate white activity page must not condemn an issue. */
export function artworkLooksComplete(inks, floor = MIN_PAGE_INK) {
  if (!inks.length) return false;
  const sorted = [...inks].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] >= floor;
}

/** Render every page once, at `scale`, yielding the PNG buffer in page order. */
export async function* renderPages(bytes, { scale = 2.8 }) {
  const stream = await renderPdf(bytes, { scale, type: 'png' });
  const iterator = stream[Symbol.asyncIterator]();
  let number = 0;
  for (;;) {
    const { value, done } = await iterator.next();
    if (done) return;
    if (typeof value === 'string' || !value) continue; // pdf-to-img interleaves page labels
    number += 1;
    yield { number, png: value };
  }
}

/**
 * pdf.js for the text layer, taken from the same copy pdf-to-img renders with. Resolving through
 * pdf-to-img keeps one version loaded; if npm ever hoists it to the root, the fallback is the root.
 *
 * Exported because `extract-resources.mjs` reads text layers *and* renders pages for OCR in one
 * process: importing the root pdfjs-dist there as well makes the two versions disagree about the
 * worker ("The API version 6.4.299 does not match the Worker version 4.10.38") and every render
 * fails. One loader, one version.
 */
export async function loadPdfjs() {
  const require = createRequire(path.join(REPO_ROOT, 'node_modules/pdf-to-img/package.json'));
  let dir = null;
  try {
    dir = path.dirname(require.resolve('pdfjs-dist/package.json'));
  } catch {
    dir = null;
  }
  const source = dir ? `file://${path.join(dir, 'legacy/build/pdf.mjs')}` : 'pdfjs-dist/legacy/build/pdf.mjs';
  const pdfjs = await import(source);
  const worker = dir ? path.join(dir, 'legacy/build/pdf.worker.mjs') : path.join(REPO_ROOT, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  if (fs.existsSync(worker)) pdfjs.GlobalWorkerOptions.workerSrc = `file://${worker}`;
  return pdfjs;
}

/* ------------------------------------------------------------------ the post */

/** The issue's front matter and body, as one post per issue. */
export function renderIssue(issue) {
  const front = [];
  const push = (key, value) => front.push(`${key}: ${JSON.stringify(value)}`);
  push('title', issue.title);
  push('slug', issue.slug);
  push('date', issue.date);
  push('edition', issue.slug);
  push('audience', 'kids');
  push('audienceLabel', 'For Kids');
  push('kind', 'magazine-issue');
  push('series', 'Rhapsody of Realities for Kids');
  push('author', 'Pastor Chris Oyakhilome');
  push('excerpt', issue.excerpt);
  push('pageCount', issue.pages.length);
  push('recognisedPages', issue.pages.filter((page) => page.recovered === 'ocr').length);
  if (issue.artworkDecoded !== null) push('artworkDecoded', issue.artworkDecoded);
  if (issue.volume) push('volume', issue.volume);
  if (issue.issn) push('issn', issue.issn);
  if (issue.keyVerse) push('keyVerse', issue.keyVerse);
  push('sourcePdf', issue.sourcePdf);
  push('source', issue.source);
  push('status', 'published');
  front.push('pages:');
  for (const page of issue.pages) {
    front.push(`  - number: ${page.number}`);
    front.push(`    image: ${JSON.stringify(page.image)}`);
    front.push(`    kind: ${JSON.stringify(page.kind)}`);
    front.push(`    recovered: ${JSON.stringify(page.recovered)}`);
    if (page.confidence) front.push(`    confidence: ${page.confidence}`);
    if (page.excerpt) front.push(`    excerpt: ${JSON.stringify(page.excerpt)}`);
  }

  // The artwork caveat belongs where a reader meets the issue, not after 50 pages of it — and the
  // intro is exactly the part of the body the site renders as prose.
  const body = [`${issue.intro}${issue.artworkNote ?? ''}`, ''];
  for (const page of issue.pages) {
    body.push(`## Page ${page.number}`);
    body.push('');
    if (page.text) {
      body.push(page.text.split('\n').filter(Boolean).join('\n\n'));
    } else {
      body.push('_This page is artwork; no words could be read from it._');
    }
    body.push('');
  }
  return `---\n${front.join('\n')}\n---\n\n${body.join('\n')}\n`;
}

/* ------------------------------------------------------------------ one issue */

export async function extractIssue(source, options = {}) {
  const settings = {
    ocr: true,
    density: 150,
    storeMaxWidth: 420,
    storeQuality: 0.72,
    verify: false,
    pages: null,
    onProgress: () => {},
    outDir: path.join(REPO_ROOT, 'content/kids'),
    assetsDir: path.join(REPO_ROOT, 'public/kids'),
    ...options,
  };
  // Both readers take ownership of the buffer handed to them (it is transferred to a worker and
  // detached), so each one gets its own copy of the file.
  const read = () => new Uint8Array(fs.readFileSync(source.file));
  const { getDocument } = await loadPdfjs();
  const doc = await getDocument({
    data: read(),
    // Without the standard fonts pdf.js warns on every page and measures text from a fallback face.
    standardFontDataUrl: `${path.join(REPO_ROOT, 'node_modules/pdfjs-dist/standard_fonts')}/`,
  }).promise;
  const wanted = settings.pages ? parseRange(settings.pages) : null;
  const worker = settings.ocr && !settings.verify ? await ocrWorker(REPO_ROOT) : null;
  const slug = slugForIssue(source);

  const pages = [];
  const inks = [];
  let imageBytes = 0;
  for await (const { number, png } of renderPages(read(), { scale: settings.density / 72 })) {
    settings.onProgress(source.name, number, doc.numPages);
    if (wanted && !wanted.has(number)) continue;
    const page = await doc.getPage(number);
    const layer = tidyLayer(linesFromContent((await page.getTextContent()).items)).join('\n').trim();
    let ocr = null;
    // Always OCR when a page is thin, when it is not a text-heavy block page, or when the layer looks
    // like it was split into syllables by the typesetting (`li fe`); the last test is why a page of
    // prose still gets a second read.
    const thinLayer = layer.replace(/\s/g, '').length < MIN_LAYER_CHARS;
    if (worker && thinLayer) {
      ocr = await ocrRendered(png, worker);
    }
    const chosen = chooseText({ layer, ocr });
    if (chosen.recovered === 'none') chosen.text = '';
    const kind = classifyPage({ number, pageCount: doc.numPages, text: chosen.text });

    let image = null;
    if (!settings.verify) {
      const buffer = await encodePage(png, { maxWidth: settings.storeMaxWidth, quality: settings.storeQuality });
      // `image` is the path the site serves; the file itself lands under `assetsDir`, which *is*
      // `public/kids` — joining the two would nest `kids/` twice.
      const name = `p${String(number).padStart(2, '0')}.jpg`;
      image = `/kids/${slug}/${name}`;
      const dir = path.join(settings.assetsDir, slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), buffer);
      imageBytes += buffer.length;
      inks.push(await inkRatio(buffer));
    }

    pages.push({
      number,
      kind,
      image,
      // A short *recognised* page is a guess worth throwing away; a short *printed* page is a
      // strapline, and the page really does say only that.
      recovered:
        chosen.recovered === 'ocr' && chosen.text.replace(/\s/g, '').length < MIN_PUBLISH_CHARS ? 'none' : chosen.recovered,
      confidence: chosen.confidence,
      text:
        chosen.recovered === 'ocr' && chosen.text.replace(/\s/g, '').length < MIN_PUBLISH_CHARS ? '' : chosen.text,
      excerpt: pageExcerpt(chosen.text),
    });
  }

  // No images are written in `--verify`, so there is nothing to judge the artwork by.
  const issue = buildIssue({ source, slug, pages, imageBytes, inks: settings.verify ? null : inks });
  if (!settings.verify) {
    fs.mkdirSync(settings.outDir, { recursive: true });
    fs.writeFileSync(path.join(settings.outDir, `${slug}.md`), renderIssue(issue));
  }
  return issue;
}

/** Everything the post carries that does not need the PDF. */
export function buildIssue({ source, slug, pages, imageBytes = 0, inks = null }) {
  const monthName = cap(source.monthName);
  const verse = pages.find((page) => page.kind === 'verse');
  // The colophon shares its page with the contents list, so trust what it says over which block the
  // page landed in — or the volume number and the ISSN go missing.
  const imprintText =
    pages.find((page) => /ISSN|^Vol\.\s/mi.test(page.text))?.text ??
    pages.find((page) => page.kind === 'note')?.text ??
    '';
  const recovered = pages.filter((page) => page.recovered === 'ocr').length;
  const empty = pages.filter((page) => !page.text).length;
  const title = `Rhapsody of Realities for Kids — ${monthName} ${source.year}`;
  return {
    slug,
    title,
    date: source.date,
    year: source.year,
    month: source.month,
    monthName,
    sourcePdf: source.name,
    source: `Rhapsody of Realities for Kids, ${monthName} ${source.year} Edition`,
    volume: /Vol\.?\s*([\w.,\s-]{1,24}?)(?:,|\s+${monthName}|\s*$)/i.exec(imprintText)?.[1]?.trim() || null,
    issn: /ISSN[: ]+([0-9X-]{7,9})/i.exec(imprintText)?.[1] || null,
    // Same rule as the excerpt, and it matters more here: the key verse is quoted as a verse.
    keyVerse: verse && verse.recovered === 'text-layer' ? pageExcerpt(verse.text, 200) : null,
    // The verse a card quotes has to be wording the site is happy to speak in its own name. A line
    // read off artwork by OCR can be `therefore, T have eternal life` — true of the page, not fit to
    // be the summary of it — so the recogniser's line is used only when the print itself had it.
    excerpt:
      (verse?.recovered === 'text-layer' ? verse.excerpt : undefined) ??
      `All ${pages.length} pages of the kids' monthly for ${monthName} ${source.year} — the cover, the story, the verse to say and the activities — as one issue, with the words of each page recovered from the print or the artwork.`,
    intro: `An issue of _Rhapsody of Realities for Kids_ (${monthName} ${source.year}), published page by page so it can be read in a browser. The magazine is drawn, not typeset, so each page below is the printed page itself, with its words taken from the PDF's own text layer where one existed and read off the artwork where it did not.\n\nOf ${pages.length} pages, ${recovered} had their words recognised by OCR and ${empty} had no words to recover at all. Recognised text has not been checked by hand — where it looks wrong, the page image above is the source of truth.`,
    pages,
    pageCount: pages.length,
    recoveredPages: recovered,
    // `null` when nothing was rendered to judge; `false` when the page images lost their artwork.
    artworkDecoded: inks === null ? null : artworkLooksComplete(inks),
    textlessPages: empty,
    imageBytes,
    artworkNote:
      inks !== null && !artworkLooksComplete(inks)
        ? `\n\nIn this issue the pictures did not survive the render: the PDF stores its artwork in a format the renderer here cannot decode, so the page images show the words on the page without the art printed around them. The text below is unaffected — it came from the PDF's own text layer or from the words on the page — and the PDF itself is the reference for what each page looked like.`
        : '',
  };
}

const cap = (word) => word.charAt(0).toUpperCase() + word.slice(1);

function parseRange(spec) {
  const [from, to] = String(spec).split('-').map((n) => Number(n));
  const set = new Set();
  for (let i = from; i <= (Number.isFinite(to) ? to : from); i += 1) set.add(i);
  return set;
}

/* ------------------------------------------------------------------ proofreading */

/** A recognised page under this confidence is worth reading back, flags or no flags. */
export const WEAK_CONFIDENCE = 65;

/**
 * Marks that say a line was read rather than printed. Both are patterns the *print* never has: a word
 * of one letter (OCR's habit of turning `I` into `T`, or splitting `life` into `l if`), and the box
 * drawing a magazine's activity frames leave behind. `a`, `A` and `I` are excluded because they are
 * words.
 */
export const PROOFREADING_FLAGS = [
  { name: 'single-letter word', re: /(?:^|\s)[B-DF-HJ-NP-TV-Zb-df-hj-np-tv-z](?:\s|$)/ },
  { name: 'stray mark', re: /[|~`^_]/ },
];

/** Which suspicious marks a recognised line carries, by their label rather than their regex. */
export function proofreadingFlags(text) {
  return PROOFREADING_FLAGS.filter(({ re }) => re.test(String(text ?? ''))).map(({ name }) => name);
}

/**
 * The pages worth reading back against the artwork, worst first: flagged lines before weak-but-clean
 * ones, low confidence before high. A page whose words came off the printed layer is never queued —
 * there is nothing to check when the PDF itself had the text.
 */
export function proofreadingQueue(pages, { weakAt = WEAK_CONFIDENCE } = {}) {
  return (Array.isArray(pages) ? pages : [])
    .filter((page) => page.recovered === 'ocr')
    .map((page) => {
      const quote = String(page.excerpt ?? '').replace(/\s+/g, ' ').trim();
      return {
        number: Number(page.number),
        confidence: Number(page.confidence ?? 0),
        flags: proofreadingFlags(quote),
        quote,
      };
    })
    .filter((entry) => entry.flags.length > 0 || entry.confidence < weakAt)
    .sort((a, b) => b.flags.length - a.flags.length || a.confidence - b.confidence || a.number - b.number);
}

/**
 * `--report`: read what is published and print the worklist an editor needs, worst page first, each
 * entry linking straight to its anchor. Nothing is rendered, nothing is written — triage costs a
 * second, not the seven minutes a full run does.
 */
export async function reportProofreading(outDir = path.join(REPO_ROOT, 'content/kids')) {
  const { default: matter } = await import('gray-matter');
  const files = fs.readdirSync(outDir).filter((file) => file.endsWith('.md')).sort();
  let total = 0;
  for (const file of files) {
    const { data } = matter(fs.readFileSync(path.join(outDir, file), 'utf8'));
    const slug = data.slug ?? file.replace(/\.md$/, '');
    const queue = proofreadingQueue(data.pages);
    if (!queue.length) {
      console.log(`${slug}: nothing to check`);
      continue;
    }
    total += queue.length;
    console.log(`${slug}: ${queue.length} page${queue.length === 1 ? '' : 's'} worth reading back`);
    for (const entry of queue) {
      console.log(
        `  p${String(entry.number).padStart(2, '0')}  ${entry.confidence}%  ${entry.flags.join(', ') || 'low confidence'}`
      );
      if (entry.quote) console.log(`        /kids/${slug}#page-${entry.number}  "${entry.quote.slice(0, 96)}"`);
    }
  }
  console.log(`${total} page(s) to read back across ${files.length} issue(s).`);
  return total;
}

/* ------------------------------------------------------------------ driver */

async function main() {
  const argv = process.argv.slice(2);
  const has = (flag) => argv.includes(flag);
  const valueOf = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : null;
  };
  const options = {
    ocr: !has('--no-ocr'),
    verify: has('--verify'),
    density: Number(valueOf('--density') ?? 150),
    storeMaxWidth: Number(valueOf('--store-width') ?? 420),
    storeQuality: Number(valueOf('--store-quality') ?? 0.72),
    pages: valueOf('--pages'),
    outDir: path.resolve(REPO_ROOT, valueOf('--out') ?? 'content/kids'),
    assetsDir: path.resolve(REPO_ROOT, valueOf('--assets') ?? 'public/kids'),
    onProgress: (issue, number, total) => {
      if (number % 10 === 0 || number === total) process.stderr.write(`  ${issue}: page ${number}/${total}\n`);
    },
  };

  if (has('--report')) {
    await reportProofreading(path.resolve(REPO_ROOT, valueOf('--out') ?? 'content/kids'));
    return;
  }

  let sources = discoverKidsPdf(REPO_ROOT);
  const filter = valueOf('--only');
  if (filter) sources = sources.filter((source) => source.name.toLowerCase().includes(filter.toLowerCase()));
  const limit = Number(valueOf('--limit-issues') ?? 0);
  if (limit > 0) sources = sources.slice(0, limit);
  if (!sources.length) {
    console.error('No RORK PDFs found (expected <month>-<year>-rork.pdf in pdf/ or at the repo root).');
    process.exit(1);
  }

  const problems = [];
  const issues = [];
  for (const source of sources) {
    const t0 = Date.now();
    process.stderr.write(`${source.name} → ${slugForIssue(source)}\n`);
    try {
      const issue = await extractIssue(source, options);
      // `--pages` is a slice, so a short read is the operator's request, not a broken source.
      if (issue.pageCount < 12 && !options.pages) problems.push(`${source.name}: only ${issue.pageCount} pages read`);
      if (issue.pages.every((page) => !page.text)) problems.push(`${source.name}: no page carried any text`);
      if (!options.verify && issue.pages.some((page) => !page.image)) problems.push(`${source.name}: a page was written without an image`);
      issues.push(issue);
      process.stderr.write(
        `  ${issue.pageCount} pages, ${issue.recoveredPages} read by OCR, ${issue.textlessPages} with no text, ${(issue.imageBytes / 1e6).toFixed(1)} MB (${Math.round((Date.now() - t0) / 1000)}s)\n`
      );
    } catch (error) {
      problems.push(`${source.name}: ${error?.stack?.split('\n')[0] ?? error}`);
    }
  }

  // The OCR worker keeps the event loop alive; without this the script never exits.
  if (workerPromiseRef.current) await workerPromiseRef.current.then((worker) => worker.terminate());
  if (options.verify) {
    for (const issue of issues) {
      console.log(`${issue.slug}: ${issue.pageCount} pages, ${issue.recoveredPages} OCR (no OCR pass in --verify), ${issue.textlessPages} textless, kinds ${[...new Set(issue.pages.map((p) => p.kind))].sort().join(',')}`);
    }
  } else if (issues.length) {
    const pages = issues.reduce((sum, issue) => sum + issue.pageCount, 0);
    const bytes = issues.reduce((sum, issue) => sum + issue.imageBytes, 0);
    console.log(`Wrote ${issues.length} issue${issues.length === 1 ? '' : 's'} (${pages} pages) to ${path.relative(REPO_ROOT, options.outDir)}/`);
    console.log(`  ${pages} page images in ${path.relative(REPO_ROOT, options.assetsDir)}/ — ${(bytes / 1e6).toFixed(1)} MB`);
  }

  if (problems.length) {
    console.error(`${problems.length} problem(s):`);
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
