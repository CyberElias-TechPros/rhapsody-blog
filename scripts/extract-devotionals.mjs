#!/usr/bin/env node
/**
 * extract-devotionals.mjs — turns the monthly "Rhapsody of Realities" PDFs into one Markdown
 * blog post per daily devotional, for every audience the editions are printed for: adults,
 * teens (TEEVO) and early readers (RORER).
 *
 * Why a layout-aware parser: the adult PDF is typeset as a two-page spread per day, and a naive
 * `page.getTextContent()` dump interleaves the title, the opening scripture, the drop cap
 * and the message body. So we rebuild *lines* (items sharing a baseline), classify them by
 * geometry (font height + indentation) and by the fixed section labels the edition uses
 * (PRAYER / FURTHER STUDY / 1-YEAR BIBLE READING PLAN / 2-YEAR BIBLE READING PLAN), and
 * only then assemble the article.
 *
 * Adults spread anatomy (y grows upwards — PDF coordinates):
 *
 *   left page                         right page
 *   ─────────                         ──────────
 *   "tuesday 1"      (h≈14, top-right) message continues   (x0 = margin)
 *   TITLE IN CAPS    (h≈16, centred)   PRAYER              (h≈16, centred label)
 *   opening scripture (x0 ≈ 117)       prayer text         (h≈11.5)
 *   message body      (x0 = 55 / 77)   FURTHER STUDY:      (h≈14, centred label)
 *   footer + folio                     references
 *                                      1-YEAR BIBLE READING PLAN + portion
 *                                      2-YEAR BIBLE READING PLAN + portion
 *
 * Usage:
 *   node scripts/extract-devotionals.mjs                  # (re)write content/devotionals/*.md
 *   node scripts/extract-devotionals.mjs --verify         # parse + assert, write nothing
 *   node scripts/extract-devotionals.mjs --pdf a.pdf …    # explicit inputs
 *   node scripts/extract-devotionals.mjs --out dir        # explicit output directory
 *
 * Every assertion failure is reported and makes the process exit non-zero, so CI can run
 * `npm run content:verify` and trust that the published posts match the source PDFs.
 */

import { readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** JS `Date#getDay()` order, so the printed weekday can be checked against the real calendar. */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const NOISE_PATTERNS = [
  /^to keep getting rhapsody of realities/i,
  /^www\.rhapsodyofrealities\.org/i,
  /^rhapsody of realities$/i,
  // The younger editions' page furniture: a ruled writing line, the QR-code promos that
  // advertise the apps, and the magazine's own name printed under the day.
  /^my notes$/i,
  /^scan to\b/i,
  /^(teevo|rorer|rork)\b/i,
  /^rhapsody of realities for (teens|kids|early readers)$/i,
  /^a daily devotional for (teens|kids|early readers)$/i,
  /(app|play) store$/i,
];

/**
 * Running feet change between editions ("order on www.rhapsodyofrealities.org",
 * "Share your inspiring testimony…", "Subscribe to the Rhapsody of Realities app…") but their
 * *geometry* does not: 9pt type in the bottom band, sometimes sharing a baseline with the
 * folio. Filtering by text alone let one advert leak into a message, so filter by shape.
 */
export const AD_PHRASES = [
  /rhapsodyofrealities\.org/i,
  /loveworldpublishing\.com/i,
  /subscribe to the rhapsody/i,
  /share your inspiring testimony/i,
  /to keep getting rhapsody/i,
  /a billion testimonies/i,
  /kingschat/i,
  /scan to\b/i,
  /download the (teevo|kids|early readers|rorer|rhapsody)/i,
  /(app|play) store/i,
  /rhapsody of realities for (teens|kids|early readers)/i,
  /devotionals in other languages/i,
];

/* ------------------------------------------------------------------ reading geometry */

/**
 * A superscript: an ordinal ending ("17" + "th" in "the 17th verse") or a footnote marker.
 * It is set a few points above the line it belongs to, so grouping items by baseline splits
 * it into a row of its own — which would break the host word in half *and* open a spurious
 * new paragraph. Small, letter-only and short: that is all we dare treat as one.
 */
const isSuperscript = (item) =>
  item.height > 0 && item.height < 9.5 && /^[A-Za-z][A-Za-z.]{0,3}$/.test(item.str.trim());

const itemX0 = (item) => item.transform[4];
const itemX1 = (item) => item.transform[4] + item.width;

/**
 * Concatenate a row's items in reading order. A superscript is followed by a space the
 * typesetter had to add by hand, so the gap is the only record of it — and it is preceded by a
 * zero-width space that marks the word break the compositor *didn't* want ("10" + "th"), which
 * must not become a real one.
 */
function joinRow(items) {
  let out = '';
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const next = items[i + 1];
    if (!item.str.trim() && item.width < 1 && next && isSuperscript(next)) continue;
    out += item.str;
    if (!next) continue;
    if (!(isSuperscript(item) || isSuperscript(next))) continue;
    const gap = itemX0(next) - itemX1(item);
    if (gap > 0.6 && /[\p{L}\p{N}]$/u.test(out) && /^[\p{L}]/u.test(next.str)) out += ' ';
  }
  return out;
}

/**
 * Rebuild visual lines from pdf.js text items. Items on one baseline are concatenated in
 * x-order (pdf.js emits explicit space items between words); the drop cap is detected here
 * because its baseline sits one line *below* the line it belongs to.
 */
function buildLines(items) {
  const rows = new Map();
  const rowFor = (y) => {
    for (const key of rows.keys()) if (Math.abs(key - y) < 1.2) return key;
    return y;
  };

  for (const item of items) {
    if (!('str' in item) || item.str.length === 0) continue;
    const y = rowFor(item.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(item);
  }

  // Give every orphan superscript back to the line it floats above.
  for (const [y, rowItems] of [...rows.entries()]) {
    const orphans = rowItems.filter((i) => isSuperscript(i) || !i.str.trim());
    if (orphans.length !== rowItems.length || !rowItems.some(isSuperscript)) continue;
    const span = [Math.min(...orphans.map(itemX0)), Math.max(...orphans.map(itemX1))];
    let best = null;
    for (const [otherY, otherItems] of rows) {
      if (otherY === y || otherItems.length < 2) continue;
      const dy = Math.abs(otherY - y);
      if (dy > 6 || dy >= (best?.dy ?? Number.POSITIVE_INFINITY)) continue;
      if (span[0] < Math.min(...otherItems.map(itemX0)) - 2) continue;
      if (span[1] > Math.max(...otherItems.map(itemX1)) + 6) continue;
      best = { otherY, dy };
    }
    if (!best) continue;
    rows.delete(y);
    rows.get(best.otherY).push(...orphans);
  }

  return [...rows.entries()]
    .map(([y, rowItems]) => {
      rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
      // The opening letter of each article is set as a drop cap: a single oversized glyph that
      // shares a baseline with flowing text — one line *below* the line it opens in the adult
      // edition, on its own line in the younger ones. Only a row that flows around the glyph
      // has a cap: a row of one big glyph on its own is the day marker, a title, or a label.
      // Quotes belong to the cap as much as the letter does: `“I` is one glyph cluster, and an
      // opening quote set at cap height never has a line of its own.
      const isCap = (item) => item.height >= 18 && CAP_GLYPH.test(item.str.trim());
      const capItem = rowItems.length > 1 ? rowItems.find(isCap) : null;
      const textItems = capItem ? rowItems.filter((i) => i !== capItem) : rowItems;
      const loneGlyph = rowItems.length === 1 && isCap(rowItems[0]);
      return {
        y,
        x0: Math.min(...rowItems.map(itemX0)),
        x1: Math.max(...rowItems.map(itemX1)),
        height: Math.max(...rowItems.map((i) => i.height)),
        textHeight: textItems.length ? Math.max(...textItems.map((i) => i.height)) : 0,
        dropCap: capItem ? capItem.str.trim() : null,
        capX: capItem ? itemX0(capItem) : null,
        loneGlyph: loneGlyph ? rowItems[0].str.trim() : null,
        // The baseline the cap sits on flows *around* it, so its extra indent is cosmetic
        // and must never be read as the start of a new paragraph.
        wrapsDropCap: Boolean(capItem),
        startsParagraph: false,
        // The row's pieces as the PDF set them: the younger editions print a label in a side
        // column that shares a baseline with the text beside it, so a reader that wants only
        // one of them has to work at this level rather than on the joined line.
        spans: rowItems.map((i) => ({ x0: itemX0(i), x1: itemX1(i), height: i.height, str: i.str })),
        text: joinRow(textItems).replace(/\s+/g, ' ').trim(),
      };
    })
    .filter((l) => l.text.length > 0 || l.dropCap || l.loneGlyph)
    .sort((a, b) => b.y - a.y); // top of page first
}

/**
 * A drop cap: one character — a letter, or the digit that opens "1 Peter" — which the typeface
 * may hug with quotation marks on either side.
 */
const CAP_GLYPH = /^[\u2018\u2019'"“”‘’]*(?:\p{L}|\p{N})[\u2018\u2019'"“”‘’]*$/u;

const isNoise = (line) =>
  (line.textHeight > 0 && line.textHeight <= 10 && line.y <= 60) ||
  // The folio. Judged by where it sits, not by its text: the teens and early-reader editions
  // print the *day of the month* as a bare number too — 26pt and 48pt respectively.
  (/^\d{1,3}$/.test(dedupe(line.text.trim())) && line.y <= 90 && line.textHeight <= 15) ||
  NOISE_PATTERNS.some((re) => re.test(line.text.trim()));

/**
 * Single-letter drop caps are ambiguous: "I" can open the word "In" or stand alone as the
 * pronoun ("I once watched…"). Both are typeset identically — the line that follows starts at
 * the same x whether or not a word space belongs there — so geometry cannot decide it. What
 * can decide it is the edition's own vocabulary, which is why `capNeedsSpace` prefers the
 * word list of the document being parsed and only falls back to this hand-listed set when it
 * has none (unit tests, or a single extracted line).
 */
const STANDALONE_CAPS = new Set(['I', 'A', 'O']);

const COMMON_WORDS = new Set(`
the be to of and a in that have i it for not on with he as you do at this but his by from
they we say her she or an will my one all would there their what so up out if about who get
which go me when make can like time no just him know take people into year your good some
could them see other than then now look only come its over think also back after use two how
our work first well way even new want because any these give day most us is are was were been
has had said did does once man men woman women child children world life hand part place case
week company system program question government number night point home water room mother area
money story fact month lot right study book eye job word business issue side kind head house
service friend father power hour game line end member law car city community name president
team minute idea body information parent face others level office door health person art war
history party result change morning reason research girl guy moment air teacher force education
watched asked expected found saw went came made took gave told called began started continued
remained seemed became truly simply really always never often sometimes soon
`.trim().split(/\s+/));

/**
 * Every word the edition actually uses, with counts. The line a drop cap is lifted *from*
 * loses its first token to the cap, so that artefact ("ruth" in "T" + "ruth was a central
 * theme") is not counted as evidence that the tail is a word in its own right.
 */
export function buildVocabulary(pages) {
  const counts = new Map();
  for (const page of pages) {
    page.lines.forEach((line, index) => {
      const words = line.text.split(/\s+/).filter(Boolean);
      if (page.lines[index + 1]?.dropCap) words.shift();
      for (const word of words) {
        const cleaned = word.toLowerCase().replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');
        if (cleaned.length > 1) counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
      }
    });
  }
  return counts;
}

/** True when the cap is a word of its own and needs a space before the text that follows. */
export function capNeedsSpace(cap, followingText, vocabulary = null) {
  const firstWord = followingText
    .split(/[\s,.:;!?“”"']/)
    [0]
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  if (vocabulary) {
    if (firstWord.length < 2) return false;
    const capLetter = cap.toLowerCase().replace(/[^a-z]/g, '');
    // A spelling the edition uses as one word ("Into", "Across", "Oftentimes") wins; a tail
    // the edition uses on its own ("recall", "once") while never writing it glued ("irecall")
    // means the cap is the whole word.
    if (!capLetter || vocabulary.has(`${capLetter}${firstWord}`)) return false;
    return vocabulary.has(firstWord);
  }

  if (!STANDALONE_CAPS.has(cap)) return false;
  return COMMON_WORDS.has(firstWord);
}

/**
 * Promote every drop cap onto the line above it (the one it visually starts). The line the
 * cap rests on keeps flowing text, so it is flagged `wrapsDropCap` and stays in place.
 */
function attachDropCaps(lines, vocabulary = null) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.dropCap) continue;
    const target = lines[i - 1]; // lines are sorted top-first
    if (target && !isNoise(target)) {
      // Normally the cap is the first letter of the word the line continues ("W" + "hen…").
      // It stands alone — needing a space — when the line opens with a capital (the "1" of
      // "1 Peter 1:23 tells us…") or when it is the pronoun/article itself ("I once watched…").
      const cap = line.dropCap;
      // `“I` + `’m scared…` is one word; `“I` + `once watched…` is two.
      const bare = cap.replace(/[\u2018\u2019'"“”‘’]/g, '');
      const joinsWord = /^[a-z\u2019']/u.test(target.text) && !capNeedsSpace(bare, target.text.replace(/^[\u2019']+/u, ''), vocabulary);
      target.text = joinsWord ? `${cap}${target.text}` : `${cap} ${target.text}`;
      target.x0 = Math.min(target.x0, line.capX ?? line.x0);
      target.startsParagraph = true;
    }
    line.dropCap = null;
  }

  // The younger editions set the opening letter on a line of its own, level with the text it
  // introduces. Whichever neighbouring line begins at the cap's right edge is the one it opens.
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.loneGlyph) continue;
    const edge = line.x0 + 0; // the glyph's own left edge approximates where its word starts
    const candidates = [
      [lines[i - 1], 'above'],
      [lines[i + 1], 'below'],
    ].filter(([candidate]) => candidate && !isNoise(candidate) && !candidate.loneGlyph);
    const fits = (candidate) => candidate.x0 >= edge - 8 && candidate.x0 <= line.x1 + 16;
    const below = candidates.find(([c, where]) => where === 'below' && fits(c));
    const above = candidates.find(([c, where]) => where === 'above' && fits(c));
    const target = below && (!above || Math.abs(below[0].x0 - line.x1) < Math.abs(above[0].x0 - line.x1))
      ? below[0]
      : above?.[0] ?? null;
    if (!target) continue;
    const cap = line.loneGlyph;
    const joinsWord = /^[a-z]/.test(target.text) && !capNeedsSpace(cap, target.text, vocabulary);
    target.text = tidy(joinsWord ? `${cap}${target.text}` : `${cap} ${target.text}`);
    target.x0 = Math.min(target.x0, line.x0);
    target.startsParagraph = true;
    line.loneGlyph = null;
    line.text = '';
  }
  return lines;
}

/* ------------------------------------------------------------------ text shaping */

const tidy = (value) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([‘“])\s+/g, '$1')
    // Only a quote that closes a word is glued to it. `Hebrews 12:2, ”looking` keeps its
    // space: the mark there opens the quotation (the editions print it the wrong way round),
    // and after punctuation there is nothing for a closing quote to belong to.
    .replace(/(\p{L})\s+([’”])/gu, '$1$2')
    .replace(/\.{2,}$/g, '.')
    .replace(/!{2,}$/g, '!')
    .replace(/\?{2,}$/g, '?')
    .trim();

const SMALL_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in',
  'of', 'on', 'to', 'up', 'with', 'into', 'onto', 'unto', 'upon', 'from', 'over', 'after',
  'before', 'through', 'against', 'between', 'out', 'off', 'per', 'via', 'near', 'past',
  'since', 'till', 'until', 'toward', 'towards', 'about', 'above', 'below', 'under',
]);

/**
 * "THE NAME THAT RULES HEAVEN AND EARTH" → "The Name That Rules Heaven and Earth".
 * Articles, conjunctions and short prepositions stay lower-case mid-title (never at the
 * edges); a letter after a dash is capitalised ("SIN-FREE" → "Sin-Free",
 * "SPIRIT—GOD’S" → "Spirit—God’s") while one after an apostrophe is not ("DON'T" → "Don't").
 */
export function toTitleCase(caps) {
  const words = tidy(caps).split(' ');
  return words
    .map((word, index) => {
      const isEdge = index === 0 || index === words.length - 1;
      const lower = word.toLowerCase();
      const bare = lower.replace(/[^a-z]/g, '');
      if (!isEdge && bare && SMALL_WORDS.has(bare)) return lower;
      const cased = lower.replace(/(^|[-–—/“”“(])([a-z])/g, (_match, sep, letter) => sep + letter.toUpperCase());
      // An apostrophe never opens a word, so what follows one stays lower-case ("God's Grace",
      // "Don't Limit"), while a quote at the start of the word does: 'the last lap' → 'The…'.
      return cased.replace(/^(["'‘])([a-z])/u, (_match, quote, letter) => quote + letter.toUpperCase());
    })
    .join(' ');
}

export function slugify(value, maxLength = 60) {
  const slug = value
    .toLowerCase()
    // Contractions lose the apostrophe instead of turning it into a word break:
    // "YOU'VE OBTAINED MERCY" → youve-obtained-mercy (not you-ve-obtained-mercy).
    .replace(/['’‘"“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > maxLength ? slug.slice(0, maxLength).replace(/-+$/, '') : slug;
}

/**
 * Opening sentences of the message, trimmed to a card-friendly length. Sentences are split
 * where a terminal mark is followed by a capital (or an opening quote), so a quotation that
 * ends inside a sentence — `taught to "die to sin." As a result…` — is not cut in half.
 */
export function makeExcerpt(paragraphs, limit = 190) {
  const text = tidy(paragraphs.join(' '));
  if (!text) return '';
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'(])/);
  let excerpt = '';
  for (const sentence of sentences) {
    if (excerpt && excerpt.length + sentence.length + 1 > limit) break;
    excerpt = excerpt ? `${excerpt} ${sentence}` : sentence;
  }
  if (!excerpt) excerpt = sentences[0] ?? text;
  // The young readers' editions quote scriptures that begin "…and of the covenant"; an opening
  // ellipsis or quotation mark belongs to the sentence before it, not to the card.
  excerpt = excerpt.replace(/^[^\p{L}\p{N}]+/u, '');
  if (excerpt.length > limit) {
    excerpt = `${excerpt.slice(0, limit).replace(/\s+\S*$/, '').replace(/[,;:]+$/, '')}…`;
  } else if (excerpt.length < text.length && !/[.!?”"]$/.test(excerpt)) {
    excerpt += '…';
  }
  return excerpt.trim();
}

/**
 * Some of these proofs ship a font whose opening double quote lands on U+2018, so a quotation
 * is printed as `‘…\u201d`. The pair is what tells them apart: a single quote that is closed by a
 * double quote was never a single quote. Real nesting (`“say, ‘this’ now”`) is left alone.
 */
function fixQuotes(value) {
  return value.replace(/(^|[\s([{:;,.])‘(?=[^“‘]*”)/g, '$1“');
}

const readingMinutes = (words) => Math.max(1, Math.round(words / 200));

/* ------------------------------------------------------------------ section labels */

const LABELS = {
  prayer: /^(prayer|confession)$/i,
  furtherStudy: /^further study:?$/i,
  oneYear: /^1[-\s]?year bible reading plan$/i,
  twoYear: /^2[-\s]?year bible reading plan$/i,
};

const findLabel = (lines, re) => lines.find((l) => re.test(tidy(l.text)));

const between = (lines, upperY, lowerY) =>
  lines.filter((l) => (upperY === null || l.y < upperY) && (lowerY === null || l.y > lowerY) && !isNoise(l));

/* ------------------------------------------------------------------ day extraction */

const DATE_LINE = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(\d{1,2})$/i;

function extractDay({ left, right, edition, leftPageNo, rightPageNo, vocabulary = null }) {
  const leftLines = attachDropCaps(left.filter((l) => !isNoise(l)), vocabulary);
  const rightLines = attachDropCaps(right.filter((l) => !isNoise(l)), vocabulary);

  const dateLine = leftLines.find((l) => DATE_LINE.test(tidy(l.text)) && l.height >= 12);
  if (!dateLine) return null;
  const [, weekdayRaw, dayRaw] = tidy(dateLine.text).match(DATE_LINE);
  const day = Number(dayRaw);

  // Title: the run of all-caps, large-type lines directly under the date.
  const titleLines = [];
  for (const line of leftLines) {
    if (line.y >= dateLine.y) continue;
    const text = tidy(line.text);
    if (!text) continue;
    const isCaps = /[A-Z]/.test(text) && !/[a-z]/.test(text) && text.length > 2;
    if (isCaps && (line.textHeight >= 14 || titleLines.length > 0)) {
      titleLines.push(line);
      continue;
    }
    if (titleLines.length) break;
  }

  // Opening scripture: indented block between the title and the first body line.
  const titleBottom = titleLines.length ? Math.min(...titleLines.map((l) => l.y)) : dateLine.y - 20;
  const bodyLinesLeft = leftLines.filter((l) => l.y < titleBottom - 4);
  // The message always opens with a drop cap; that line is the reliable body/scripture split.
  const firstBody =
    bodyLinesLeft.find((l) => l.startsParagraph) ?? bodyLinesLeft.find((l) => !l.wrapsDropCap && l.x0 < 110);
  const hasDropCap = bodyLinesLeft.some((l) => l.startsParagraph);
  const scriptureLines = firstBody
    ? bodyLinesLeft.filter((l) => l.y > firstBody.y)
    : bodyLinesLeft.filter((l) => l.x0 >= 110);
  const messageStartY = firstBody ? firstBody.y : null;
  const leftBody = messageStartY === null ? [] : bodyLinesLeft.filter((l) => l.y <= messageStartY);

  // Right page: labels split the page into body / prayer / study / reading-plan regions.
  const prayerLabel = findLabel(rightLines, LABELS.prayer);
  // The closing block is a PRAYER on most days and a CONFESSION on others.
  const prayerLabelTitle = prayerLabel ? toTitleCase(prayerLabel.text) : 'Prayer';
  const furtherLabel = findLabel(rightLines, LABELS.furtherStudy);
  const oneYearLabel = findLabel(rightLines, LABELS.oneYear);
  const twoYearLabel = findLabel(rightLines, LABELS.twoYear);

  const rightBody = between(rightLines, null, prayerLabel ? prayerLabel.y : null);
  const prayerLines = between(rightLines, prayerLabel ? prayerLabel.y : null, furtherLabel ? furtherLabel.y : null);
  const furtherLines = between(rightLines, furtherLabel ? furtherLabel.y : null, oneYearLabel ? oneYearLabel.y : null);
  const oneYearLines = between(rightLines, oneYearLabel ? oneYearLabel.y : null, twoYearLabel ? twoYearLabel.y : null);
  const twoYearLines = between(rightLines, twoYearLabel ? twoYearLabel.y : null, null);

  // Margins differ per page (left 55pt / right 41pt), so paragraphs are grouped per page
  // and then stitched: the right page usually carries on mid-paragraph from the left one.
  const paragraphs = mergeParagraphs(leftBody, rightBody);
  const scripture = tidy(scriptureLines.map((l) => l.text).join(' '));

  const consumed = new Set([
    dateLine, ...titleLines, ...scriptureLines, ...leftBody, ...rightBody,
    ...prayerLines, ...furtherLines, ...oneYearLines, ...twoYearLines,
  ]);
  const isLabel = (l) => Object.values(LABELS).some((re) => re.test(tidy(l.text)));
  const unconsumed = [...leftLines, ...rightLines]
    .filter((l) => !consumed.has(l) && !isLabel(l))
    .map((l) => tidy(l.text));

  const { year, month, monthName } = edition;
  const date = new Date(Date.UTC(year, month - 1, day));
  const iso = date.toISOString().slice(0, 10);
  const expectedWeekday = WEEKDAYS[date.getUTCDay()];
  const title = toTitleCase(titleLines.map((l) => l.text).join(' '));

  return {
    title,
    titleOriginal: tidy(titleLines.map((l) => l.text).join(' ')),
    slug: `${iso}-${slugify(title)}`,
    date: iso,
    weekday: expectedWeekday,
    weekdayPrinted: weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1).toLowerCase(),
    weekdayMatches: expectedWeekday.toLowerCase() === weekdayRaw.toLowerCase(),
    dayOfMonth: day,
    edition: `${year}-${String(month).padStart(2, '0')}`,
    editionTitle: `${monthName} ${year}`,
    year,
    month,
    monthName,
    scripture,
    scriptureReference: extractReference(scripture),
    paragraphs,
    prayer: tidy(prayerLines.map((l) => l.text).join(' ')),
    prayerLabel: prayerLabelTitle,
    furtherStudy: tidy(furtherLines.map((l) => l.text).join(' ')),
    oneYearPlan: tidy(oneYearLines.map((l) => l.text).join(' ')),
    twoYearPlan: tidy(twoYearLines.map((l) => l.text).join(' ')),
    pages: [leftPageNo, rightPageNo],
    words: paragraphs.join(' ').split(/\s+/).filter(Boolean).length,
    hasDropCap,
    unconsumed,
  };
}

/**
 * Group body lines into paragraphs. The edition indents the first line of every paragraph
 * (x0 = margin + 22pt), which is a far more reliable signal than vertical spacing — the
 * leading between paragraphs is identical to the leading inside them.
 */
/**
 * Join printed lines into running text. A line that ends in a hyphen was broken by the
 * compositor, not by the reader's eye: `ever-` + `increasing` is one word, and so is
 * `deliver-` + `ance` — the editions never set `word- word`.
 */
const flowLines = (list) =>
  list.reduce(
    (out, text) => (!out ? text : /-$/.test(out) && /^\p{L}/u.test(text) ? `${out}${text}` : `${out} ${text}`),
    ''
  );

function toParagraphs(lines, indent = 12) {
  if (!lines.length) return { paragraphs: [], firstLineIndented: false };
  const margin = Math.min(...lines.filter((l) => !l.wrapsDropCap).map((l) => l.x0));
  const isIndented = (line) => !line.wrapsDropCap && line.x0 >= margin + indent;
  const paragraphs = [];
  let current = [];

  for (const line of lines) {
    if (isIndented(line) && current.length) {
      paragraphs.push(flowLines(current));
      current = [];
    }
    current.push(line.text);
  }
  if (current.length) paragraphs.push(flowLines(current));
  return { paragraphs: paragraphs.map(tidy).filter(Boolean), firstLineIndented: isIndented(lines[0]) };
}

/** Left-page paragraphs + right-page continuation, stitched when the spread runs on mid-paragraph. */
function mergeParagraphs(leftBody, rightBody, indent = 12) {
  const left = toParagraphs(leftBody, indent);
  const right = toParagraphs(rightBody, indent);
  const out = [...left.paragraphs];
  if (right.paragraphs.length && !right.firstLineIndented && out.length) {
    out[out.length - 1] = tidy(flowLines([out[out.length - 1], right.paragraphs.shift()]));
  }
  return [...out, ...right.paragraphs];
}

const REFERENCE_RE = /\(([^()]{2,80})\)\s*\.?\s*$/;

function extractReference(scripture) {
  const match = scripture.match(REFERENCE_RE);
  return match ? tidy(match[1]).replace(/\.$/, '') : '';
}

/* ------------------------------------------------------------------ audiences and sources */

/**
 * Rhapsody publishes the same daily-devotional template for four audiences. They share a
 * shape — title, opening scripture, message, a closing prayer or confession, further study
 * and (for the older readers) two Bible reading plans — but every one of them is typeset
 * differently, so each gets its own geometry parser below.
 *
 * `editionSuffix` is what keeps a month unique across audiences: the adult editions were
 * published here first as `2026-09` / `2026-10`, so those slugs stay untouched and the newer
 * audiences hang their audience off the same year-month (`2026-09-teens`). Post slugs do the
 * same thing *after* the date (`2026-09-01-teens-…`), which is also what stops a teen article
 * from colliding with the adult article on the very same day.
 */
export const AUDIENCES = {
  adults: {
    key: 'adults',
    label: 'For Adults',
    shortLabel: 'Adults',
    series: 'Rhapsody of Realities',
    tag: 'rhapsody-of-realities',
    editionSuffix: '',
    slugToken: null,
    blurb: 'The daily Rhapsody of Realities for adults: one article a day, every day of the month.',
  },
  teens: {
    key: 'teens',
    label: 'For Teens',
    shortLabel: 'Teens',
    series: 'Rhapsody of Realities for Teens',
    tag: 'rhapsody-of-realities-for-teens',
    editionSuffix: '-teens',
    slugToken: 'teens',
    blurb: 'TEEVO: the same day-by-day reading, written and laid out for teenagers.',
  },
  'early-readers': {
    key: 'early-readers',
    label: 'For Early Readers',
    shortLabel: 'Early Readers',
    series: 'Rhapsody of Realities for Early Readers',
    tag: 'rhapsody-of-realities-for-early-readers',
    editionSuffix: '-early-readers',
    slugToken: 'early-readers',
    blurb: 'A scripture, a short reading and a one-sentence prayer, in type a child can read alone.',
  },
  kids: {
    key: 'kids',
    label: 'For Kids',
    shortLabel: 'Kids',
    series: 'Rhapsody of Realities for Kids',
    tag: 'rhapsody-of-realities-for-kids',
    editionSuffix: '-kids',
    slugToken: 'kids',
    blurb: 'RORK is a comic-and-activity magazine — it is published page by page by scripts/extract-kids.mjs, not as daily posts.',
  },
};

export const AUDIENCE_ORDER = Object.keys(AUDIENCES);

const MONTH_NAMES = Object.keys(MONTHS);

const monthNameOf = (month) =>
  MONTH_NAMES[month - 1].charAt(0).toUpperCase() + MONTH_NAMES[month - 1].slice(1);

/** "march_2026_rhapsody_of_realities.pdf" → { month: 3, year: 2026, monthName: 'March' }. */
function editionFromName(file) {
  const base = path.basename(file).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const monthIndex = MONTH_NAMES.findIndex((month) => new RegExp(`(^|\\s)${month}(\\s|$)`).test(base));
  if (monthIndex < 0) return {};
  const yearMatch = base.match(/\b20\d{2}\b/) ?? base.match(/\b\d{2}\b/);
  if (!yearMatch) return {};
  const year = yearMatch[0].length === 2 ? 2000 + Number(yearMatch[0]) : Number(yearMatch[0]);
  if (year < 2000 || year > 2100) return {};
  return { year, month: monthIndex + 1, monthName: monthNameOf(monthIndex + 1) };
}

/**
 * Family hints, in the order they may be applied. The three younger editions are named after
 * the publishers’ own short titles (TEEVO, RORER, RORK), which appear nowhere else; the adult
 * edition has to be matched last and warily, because "ror" is a substring of "rorer".
 */
const FAMILY_PATTERNS = [
  { audience: 'teens', re: /teevo|for[-_ ]teens/ },
  { audience: 'early-readers', re: /rorer|early[-_ ]readers/ },
  { audience: 'kids', re: /rork|for[-_ ]kids/ },
  { audience: 'adults', re: /rhapsody|rhor|\bror\b|\bror[_-]/ },
];

/** Editions the pipeline refuses, with the reason it prints when it does. */
const UNSUPPORTED = [
  {
    re: /rork|for[-_ ]kids/,
    reason:
      'the kids edition (RORK) is a comic-and-activity magazine, not a daily devotional — its pages are published by scripts/extract-kids.mjs instead',
  },
];

/**
 * The front matter of every edition states which family and month it is, so a filename is
 * never trusted on its own: a mismatch is reported, and a file whose name says nothing at all
 * ("eng-mar-2026.pdf") is classified from its cover alone — or skipped.
 */
function sniffEdition(pages) {
  const head = pages
    .slice(0, 8)
    .map((page) => page.lines.map((line) => line.text).join(' '))
    .join('  ');

  let audience = null;
  if (/a daily devotional for teens|teevo/i.test(head)) audience = 'teens';
  else if (/for early readers/i.test(head)) audience = 'early-readers';
  else if (/for kids/i.test(head)) audience = 'kids';
  else if (/rhapsody of realities/i.test(head)) audience = 'adults';

  const monthMatch = head.match(new RegExp(`(${MONTH_NAMES.join('|')})\\s*,?\\s*(20\\d{2})`, 'i'));
  if (!monthMatch) return { audience };
  const month = MONTHS[monthMatch[1].toLowerCase()];
  return { audience, year: Number(monthMatch[2]), month, monthName: monthNameOf(month) };
}

/**
 * Decide what a PDF is. Anything that is not one of the daily-devotional editions comes back
 * as `{ …, skip: reason }`, so the CLI can say so out loud instead of quietly ignoring it:
 * the folder also holds Pastor Chris books, sermon notes and the fasting guides.
 */
export function classifySource(file, pages = null) {
  const name = path.basename(file);
  const lower = name.toLowerCase();
  const fromName = editionFromName(name);
  const audience = FAMILY_PATTERNS.find(({ re }) => re.test(lower))?.audience ?? null;
  const sniffed = pages ? sniffEdition(pages) : {};
  const resolved = audience ?? sniffed.audience ?? null;
  const year = fromName.year ?? sniffed.year ?? null;
  const month = fromName.month ?? sniffed.month ?? null;

  const base = { file, name, audience: resolved, year, month };
  const refused = UNSUPPORTED.find(({ re }) => re.test(lower));
  if (refused) return { ...base, skip: refused.reason };
  if (!resolved) {
    return { ...base, skip: 'not a Rhapsody daily-devotional edition (no TEEVO / RORER / RORK / Rhapsody title, and no month in the name)' };
  }
  if (!month || !year) return { ...base, skip: 'no month and year to identify the edition' };
  if (!FAMILIES[resolved]) {
    return { ...base, skip: `the ${AUDIENCES[resolved]?.series ?? resolved} edition has no layout parser in this build` };
  }
  return {
    ...base,
    monthName: fromName.monthName ?? sniffed.monthName ?? monthNameOf(month),
    editionTitle: `${fromName.monthName ?? sniffed.monthName ?? monthNameOf(month)} ${year}`,
    warning:
      sniffed.audience && audience && sniffed.audience !== audience
        ? `the filename says "${audience}", the book’s own front matter says "${sniffed.audience}"`
        : null,
  };
}

/** Every PDF in the repository, in a stable order. */
export function discoverSources(root = REPO_ROOT) {
  const found = [];
  for (const dir of ['', 'pdf']) {
    const absolute = path.join(root, dir);
    if (!existsSync(absolute)) continue;
    for (const entry of readdirSync(absolute)) {
      if (!entry.toLowerCase().endsWith('.pdf')) continue;
      found.push(path.join(absolute, entry));
    }
  }
  return found.sort((a, b) => path.relative(root, a).localeCompare(path.relative(root, b)));
}

/* ------------------------------------------------------------------ shared day geometry */

/** Modal type size of a set of lines — the "body" size every other band is judged against. */
function modalHeight(lines) {
  const counts = new Map();
  for (const line of lines) {
    if (line.text.length < 24 || !line.textHeight) continue;
    const key = Math.round(line.textHeight * 2) / 2;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [height, count] of counts) {
    if (count > bestCount) {
      best = height;
      bestCount = count;
    }
  }
  return best;
}

const WEEKDAY_WORD = new RegExp(`^(${WEEKDAYS.join('|')})$`, 'i');

/** Rows the typeface prints twice over itself (a filled glyph and its outline). */
function dedupe(text) {
  const half = text.length / 2;
  return half >= 3 && text.slice(0, half) === text.slice(half) ? text.slice(0, half) : text;
}

const joinLines = (lines) => tidy(lines.map((line) => dedupe(tidy(line.text))).join(' '));

/**
 * A day of the corpus, in the shape `renderPost` and the content layer expect. Only the adults
 * edition is published without an audience of its own, because its edition slugs and URLs were
 * live before the other audiences existed.
 */
function assembleDay(parts, edition) {
  const { day, weekdayPrinted, titleLines, titleRaw, paragraphs, pages, ...rest } = parts;
  const { year, month, monthName, audience, editionTitle } = edition;
  const date = new Date(Date.UTC(year, month - 1, day));
  const iso = date.toISOString().slice(0, 10);
  const expectedWeekday = WEEKDAYS[date.getUTCDay()];
  const slugToken = AUDIENCES[audience].slugToken;
  const title = titleRaw ?? toTitleCase(titleLines.map((line) => line.text).join(' '));

  return {
    title,
    titleOriginal: titleRaw ?? joinLines(titleLines),
    slug: `${iso}${slugToken ? `-${slugToken}` : ''}-${slugify(title)}`,
    date: iso,
    weekday: expectedWeekday,
    weekdayPrinted: weekdayPrinted
      ? tidy(weekdayPrinted).charAt(0).toUpperCase() + tidy(weekdayPrinted).slice(1).toLowerCase()
      : expectedWeekday,
    weekdayMatches: weekdayPrinted
      ? expectedWeekday.toLowerCase() === tidy(weekdayPrinted).toLowerCase()
      : true,
    dayOfMonth: day,
    edition: `${year}-${String(month).padStart(2, '0')}${AUDIENCES[audience].editionSuffix}`,
    editionTitle,
    audience,
    year,
    month,
    monthName,
    pages,
    paragraphs,
    words: tidy(paragraphs.join(' ')).split(/\s+/).filter(Boolean).length,
    ...rest,
    // Sections a family prints that the adult edition has no field for (`Speak`, `Act`).
    extras: rest.extras ?? [],
  };
}

/** Excerpt, reading time and tags — the fields that are derived rather than parsed. */
function finishDay(day, edition) {
  for (const key of ['title', 'titleOriginal', 'subtitle', 'scripture', 'scriptureReference', 'prayer', 'furtherStudy', 'oneYearPlan', 'twoYearPlan']) {
    if (day[key]) day[key] = fixQuotes(day[key]);
  }
  day.paragraphs = day.paragraphs.map(fixQuotes);
  day.extras = (day.extras ?? []).map((section) => ({ ...section, text: fixQuotes(section.text) }));
  day.audience = edition.audience;
  day.audienceLabel = AUDIENCES[edition.audience].label;
  day.series = AUDIENCES[edition.audience].series;
  day.excerpt = makeExcerpt(day.paragraphs, edition.audience === 'early-readers' ? 150 : 190);
  day.readingMinutes = readingMinutes(day.words);
  day.tags = [
    'daily-devotional',
    AUDIENCES[edition.audience].tag,
    `${edition.monthName.toLowerCase()}-${edition.year}`,
  ];
  return day;
}

/* ------------------------------------------------------------------ teens (TEEVO) */

/**
 * Teens pages are a two-page spread like the adult edition, but every block is announced by a
 * small italic label instead of a centred heading, and the labels come and go: the closing
 * section is `Pray` on some days and `Speak` (a declaration) on others, `Act` appears on most,
 * and the reading plans are headed `Daily Bible Reading` with `One Year` / `Two Year` columns
 * side by side under it. Two features ("Did you know?", "Pastor Chris says") are interleaved
 * with the daily pages, so a day is found by its own page furniture and not by counting.
 *
 *   first page of the day                    second page of the day
 *   ──────────────────────                   ──────────────────────
 *   "Monday" + "10"     (top right)          message continues   (x0 = 36)
 *   IN THE REALM        (18.6pt, 1–3 lines)  Go Deeper  → references
 *   (You’ve Passed …)   (11.4pt)             Pray / Speak → prayer / declaration
 *   TO THE BIBLE - John 5:24 (11pt)          Daily Bible Reading → One Year | Two Year
 *   opening scripture   (10pt italic)        Act        → what to do next
 *   LET’S TALK           (13pt)               My Notes   (writing line, dropped)
 *   message body        (11pt, 28pt drop cap)
 */
const TEENS_LABELS = {
  body: /^let.s talk$/i,
  reference: /^to the\s*-?\s*bible\s*-?\s*[\p{L}\p{N}].{0,60}$/iu,
  furtherStudy: /^go deeper$/i,
  prayer: /^pray$/i,
  confession: /^speak$/i,
  act: /^act$/i,
  plans: /^daily\s+bible\s+reading$/i,
  notes: /^my notes$/i,
};

const TEENS_CLOSING = ['furtherStudy', 'prayer', 'confession', 'act', 'plans'];

const teensLabelOf = (line) => {
  const text = tidy(line.text);
  if (!text || text.length > 24) return null;
  for (const key of TEENS_CLOSING) if (TEENS_LABELS[key].test(text)) return key;
  return null;
};

/**
 * Rebuild a line from only some of its pieces. The younger editions print a side label (the
 * weekday above the day's title, `Pray` beside a prayer) on the same baseline as flowing text,
 * so a block's content has to be selected span by span before it is ever joined.
 */
function keepSpans(line, keep) {
  const spans = line.spans.filter(keep);
  if (!spans.length) return { ...line, spans: [], text: '', origin: line.origin ?? line };
  if (spans.length === line.spans.length) return line;
  return {
    ...line,
    origin: line.origin ?? line,
    spans,
    x0: Math.min(...spans.map((span) => span.x0)),
    x1: Math.max(...spans.map((span) => span.x1)),
    textHeight: Math.max(...spans.map((span) => span.height)),
    text: tidy(spans.map((span) => span.str).join('')),
  };
}

const lineOrigin = (line) => line.origin ?? line;
const smallType = (line) => line.textHeight < 9.5;
// The teens editions print the day of the month at ~26pt, far above anything else
// on the page, so a smaller number is never the day.
const TEENS_NUMERAL_MIN = 20;
const weekdaySpan = (span) => WEEKDAY_WORD.test(tidy(span.str)) && span.height < 12;

/**
 * The day of the month, printed at ~26pt in the top-right corner. It is usually alone on its
 * row, but where the title block runs wide the number ends up glued to the end of a subtitle
 * line ("(Stand Out from the Crowd)21"), so it is looked for span by span.
 */
function teensNumeral(page) {
  for (const line of page.lines) {
    if (line.y <= page.height * 0.6) continue;
    for (const span of line.spans) {
      if (span.height < TEENS_NUMERAL_MIN || span.x0 < page.width * 0.55) continue;
      const value = Number(tidy(span.str));
      if (Number.isInteger(value) && value >= 1 && value <= 31 && /^\d{1,2}$/.test(tidy(span.str)))
        return { value, line, span };
    }
  }
  return null;
}

/**
 * A copy of `line` with one span taken out, so a numeral is not published as body text. The row
 * keeps no trace of having been a drop cap either: `buildLines` had mistaken the numeral for one,
 * and a cap that has been removed here must not be re-attached to the line above it later.
 */
function withoutSpan(line, span) {
  const spans = line.spans.filter((item) => item !== span);
  if (!spans.length) return null;
  return {
    ...line,
    origin: line.origin ?? line,
    spans,
    dropCap: null,
    capX: null,
    loneGlyph: null,
    wrapsDropCap: false,
    x0: Math.min(...spans.map((item) => item.x0)),
    x1: Math.max(...spans.map((item) => item.x1)),
    textHeight: Math.max(...spans.map((item) => item.height)),
    text: tidy(spans.map((item) => item.str).join(' ')),
  };
}

function extractTeensDay({ start, end, edition, vocabulary }) {
  const { height, width } = start;
  const numeral = teensNumeral(start);
  if (!numeral) return null;
  const day = numeral.value;
  const leftAll = (start.lines
    .map((line) => (line.spans.includes(numeral.span) ? withoutSpan(line, numeral.span) : line))
    .filter(Boolean)).filter((line) => !isNoise(line));
  const rightAll = end ? end.lines.filter((line) => !isNoise(line)) : [];
  const left = attachDropCaps(leftAll, vocabulary);
  const right = attachDropCaps(rightAll, vocabulary);
  // Below the body, everything smaller than 9.5pt is promotion: the QR-code plate, the app
  // plug. The reading-plan labels are 8pt too, so they are read from the unfiltered lines.
  const leftLines = left.filter((line) => !smallType(line));
  const rightLines = right.filter((line) => !smallType(line));

  const referenceLine = leftLines.find((line) => TEENS_LABELS.reference.test(tidy(line.text)));
  const bodyLabel = leftLines.find((line) => TEENS_LABELS.body.test(tidy(line.text)));
  // The title block sits above the reference line; the scripture between it and the message,
  // which the drop cap opens. `LET’S TALK` only appears on some days, so it is a hint.
  const markerY = referenceLine?.y ?? bodyLabel?.y ?? height * 0.72;

  const labelled = (lines) =>
    lines
      .map((line) => ({ line, key: teensLabelOf(line) }))
      .filter((entry) => entry.key)
      .sort((a, b) => b.line.y - a.line.y);
  const leftLabels = labelled(leftLines);
  const rightLabels = labelled(rightLines);
  const notesLine = (lines) => lines.find((line) => TEENS_LABELS.notes.test(tidy(line.text)));
  const leftStopY = leftLabels.length ? leftLabels[0].line.y : 0;
  const rightStopY = rightLabels.length ? rightLabels[0].line.y : 0;

  const belowMarker = leftLines.filter((line) => line.y < markerY && line.y > leftStopY && line !== numeral);
  const firstBody =
    belowMarker.find((line) => line.startsParagraph) ?? (bodyLabel ? belowMarker.find((l) => l.y < bodyLabel.y) : null);
  const notLabel = (line) => teensLabelOf(line) === null && line !== bodyLabel;
  const scriptureLines = firstBody
    ? belowMarker.filter((line) => line.y > firstBody.y && notLabel(line))
    : belowMarker.filter((line) => !isNoise(line) && line.textHeight <= 10.6 && notLabel(line));
  const leftBody = firstBody ? belowMarker.filter((line) => line.y <= firstBody.y) : [];
  const rightBody = rightLines.filter((line) => line.y > rightStopY);

  // The title is what is left in the top band once the weekday that shares its baseline is gone.
  const titleSource = leftLines.filter(
    (line) => line.y > markerY && line !== numeral && line.textHeight >= 15 && !isNoise(line)
  );
  const titleLines = titleSource.map((line) => keepSpans(line, (span) => !weekdaySpan(span)));
  const weekdayPrinted =
    tidy(leftLines.find((line) => WEEKDAY_WORD.test(tidy(line.text)) && line !== numeral)?.text ?? '') ||
    [...titleSource.map((line) => line.spans.find(weekdaySpan)).filter(Boolean).map((span) => tidy(span.str)), '']
      .filter(Boolean)
      .at(0);
  const subtitleLines = leftLines.filter(
    (line) => line.y > markerY && line.textHeight > 10.5 && line.textHeight < 15 && !titleSource.includes(line)
  );

  // Every labelled block: the lines under its label, down to the next label on that page.
  const blocks = new Map();
  const collect = (entries, lines, stopLine) => {
    entries.forEach((entry, index) => {
      const below = entries[index + 1]?.line.y ?? stopLine?.y ?? 0;
      const content = lines.filter(
        (line) => line.y < entry.line.y && line.y > below && teensLabelOf(line) === null
      );
      blocks.set(entry.key, [...(blocks.get(entry.key) ?? []), ...content]);
    });
  };
  collect(leftLabels, leftLines, notesLine(leftLines));
  collect(rightLabels, rightLines, notesLine(rightLines));

  // The two reading-plan columns share baselines, so they are split by x, span by span.
  const oneYear = [];
  const twoYear = [];
  const planSpan = (span) => /^(one|two)[-\s]+years?( plan)?$/i.test(tidy(span.str));
  const plansEntry = rightLabels.find((entry) => entry.key === 'plans');
  const planLabelLines = plansEntry ? right.filter((line) => line.y < plansEntry.line.y && line.spans.some(planSpan)) : [];
  if (plansEntry) {
    const labels = planLabelLines;
    const topY = labels.length ? Math.min(...labels.map((line) => line.y)) : plansEntry.line.y;
    const stopY = rightLabels[rightLabels.findIndex((e) => e === plansEntry) + 1]?.line.y ?? notesLine(rightLines)?.y ?? 0;
    const mid = width / 2;
    for (const line of right) {
      if (line.y >= topY || line.y <= stopY) continue;
      for (const span of line.spans) {
        if (planSpan(span) || smallType({ textHeight: span.height }) || !span.str.trim()) continue;
        const holder = { ...line, spans: [span], x0: span.x0, x1: span.x1, text: tidy(span.str), textHeight: span.height };
        (span.x0 < mid ? oneYear : twoYear).push(holder);
      }
    }
  }

  const text = (lines) => tidy(lines.map((line) => dedupe(tidy(line.text))).join(' '));
  const scripture = text(scriptureLines);
  const reference = referenceLine
    ? tidy(tidy(referenceLine.text).replace(/^to the\s*-?\s*bible\s*-?\s*/i, '')).replace(/[.:]+$/, '')
    : extractReference(scripture);
  const paragraphs = mergeParagraphs(leftBody, rightBody);

  const consumed = new Set(
    [
      numeral, referenceLine, bodyLabel, ...leftLines.filter((line) => WEEKDAY_WORD.test(tidy(line.text))), ...titleLines,
      ...subtitleLines, ...scriptureLines, ...leftBody, ...rightBody, ...leftLabels.map((e) => e.line),
      ...rightLabels.map((e) => e.line), notesLine(left), notesLine(right), ...oneYear, ...twoYear,
      ...planLabelLines, ...[...blocks.values()].flat(), ...leftAll.filter(smallType), ...rightAll.filter(smallType),
    ]
      .filter(Boolean)
      .map(lineOrigin)
  );
  const unconsumed = [...leftAll, ...rightAll]
    .filter((line) => !consumed.has(lineOrigin(line)) && teensLabelOf(line) === null && !isNoise(line))
    .map((line) => tidy(line.text))
    .filter(Boolean);

  return assembleDay(
    {
      day,
      weekdayPrinted,
      titleLines,
      subtitle: text(subtitleLines),
      scripture,
      scriptureReference: reference,
      paragraphs,
      prayer: text(blocks.get('prayer') ?? []),
      prayerLabel: 'Prayer',
      // `SPEAK` and `ACT` are the teens edition's own closing sections; they have no adult
      // counterpart, so they travel as labelled extras rather than as new fixed fields.
      extras: [
        { label: 'Speak', text: text(blocks.get('confession') ?? []) },
        { label: 'Act', text: text(blocks.get('act') ?? []) },
      ].filter((section) => section.text),
      furtherStudy: text(blocks.get('furtherStudy') ?? []),
      oneYearPlan: text(oneYear),
      twoYearPlan: text(twoYear),
      pages: end ? [start.pageNo, end.pageNo] : [start.pageNo],
      hasDropCap: Boolean(firstBody?.startsParagraph),
      unconsumed,
    },
    edition
  );
}

function isDayStart(page) {
  // Only a day's opening page carries that numeral: the page after it, the game and quiz
  // spreads and the `DID YOU KNOW` features that sit between the readings do not, which is what
  // keeps them from being read as one more day.
  if (!teensNumeral(page)) return false;
  return page.lines.some(
    (line) =>
      TEENS_LABELS.reference.test(tidy(line.text)) ||
      TEENS_LABELS.body.test(tidy(line.text)) ||
      WEEKDAY_WORD.test(tidy(line.text)) ||
      line.spans.some(weekdaySpan)
  );
}

function extractTeensEdition({ pages, edition, vocabulary }) {
  const days = [];
  for (let index = 0; index < pages.length; index += 1) {
    if (!isDayStart(pages[index])) continue;
    const next = pages[index + 1];
    const isTail =
      next &&
      !isDayStart(next) &&
      next.lines.some((line) => teensLabelOf(line) || TEENS_LABELS.notes.test(tidy(line.text)));
    const day = extractTeensDay({ start: pages[index], end: isTail ? next : null, edition, vocabulary });
    if (day) days.push(day);
  }
  return days;
}

/* ------------------------------------------------------------------ early readers (RORER) */

/**
 * The readings come one page after another, so a day whose numeral could not be read is numbered
 * from the gap between the days around it — and only when that gap is exactly as wide as the run
 * of unclaimed pages, which keeps a puzzle or activity spread from being read as a reading.
 */
function extractEarlyReadersEdition({ pages, edition }) {
  const found = pages.map((page) => extractEarlyReadersDay({ page, edition }));
  let claimed = -1;
  for (let index = 0; index < pages.length; index += 1) {
    if (!found[index]) continue;
    const open = [];;
    for (let at = claimed + 1; at < index; at += 1) open.push(at);
    const missing = found[index].dayOfMonth - found[claimed]?.dayOfMonth - 1;
    if (claimed >= 0 && missing > 0 && missing === open.length) {
      open.forEach((at, offset) => {
        const day = extractEarlyReadersDay({
          page: pages[at],
          edition,
          expected: found[claimed].dayOfMonth + offset + 1,
        });
        if (day) found[at] = day;
      });
    }
    claimed = index;
  }
  return found.filter(Boolean);
}

/**
 * One day to a page, in much bigger type: a 48pt numeral, a title in a display face over up to
 * three lines, the reference and the opening scripture in bold, the message at 13pt with an
 * indented first line, a `Scripture Reading` line, and at the foot of the page a short prayer or
 * confession whose 16pt label (`Let’s Pray` / `Say This`) is set in its own column on the right,
 * sharing baselines with the text it introduces. That is why every block here is read from the
 * page's *spans*: the label has to come out of the sentence it sits beside, not the other way
 * round ("…helping" + "Pray" + "me share…" is one visual line).
 *
 * Game, colouring and contents pages sit between the readings and carry none of this
 * furniture; a page is a day only when it has both the numeral and the `Scripture Reading`
 * line. Sizes are always relative to the body size of the page, because the editions are
 * printed at 380–410 × 595–624 pt and no absolute figure survives a change of trim size.
 */
function extractEarlyReadersDay({ page, edition, expected = null }) {
  const raw = page.lines.filter((line) => !isNoise(line));
  const { height, width } = page;

  const studyLine = raw.find((line) => /^scripture reading\b/i.test(tidy(line.text)));
  if (!studyLine) return null;
  // The day of the month is set far above anything else on the page. It is read a span at a time
  // because the title block sometimes runs into it ("14 The Victory") — the numeral is then taken
  // out of that row so it is not published as part of the title.
  const tallest = Math.max(0, ...raw.map((line) => line.textHeight));
  let numeralEntry = null;
  for (const line of raw) {
    if (line.y <= height * 0.7) continue;
    for (const span of line.spans) {
      if (span.height < tallest - 0.5 || !/^\d{1,2}$/.test(tidy(span.str))) continue;
      if (!numeralEntry || span.height > numeralEntry.span.height)
        numeralEntry = { line, span, value: Number(tidy(span.str)) };
    }
  }
  const numeralIndex = numeralEntry ? raw.indexOf(numeralEntry.line) : -1;
  const lines = raw.map((line, index) =>
    index === numeralIndex ? withoutSpan(line, numeralEntry.span) ?? line : line
  );
  const numeral = numeralIndex >= 0 ? lines[numeralIndex] : null;
  let day = numeralEntry ? numeralEntry.value : null;
  if (day === null) {
    // Some printers set the numeral as a filled shape, which carries no text at all. Those pages
    // are numbered from the running order instead, and only when the weekday they print matches
    // the day that order implies — so a guess is never published as fact.
    const orderedWeekday = lines.find(
      (line) => line.textHeight <= 12 && WEEKDAY_RE.test(line.text) && line.y > height * 0.7,
    );
    if (!expected || !orderedWeekday) return null;
    const ordered = new Date(Date.UTC(edition.year, edition.month - 1, expected));
    if (WEEKDAYS[ordered.getUTCDay()].toLowerCase() !== tidy(orderedWeekday.text).toLowerCase())
      return null;
    day = expected;
  }

  const bodyHeight = modalHeight(lines.filter((line) => line.y > studyLine.y && line.y < height * 0.72));
  if (!bodyHeight) return null;

  const weekdayLine = lines.find((line) => WEEKDAY_WORD.test(tidy(line.text)) && line.y > height * 0.7);
  // Titles are the second-largest thing on the page after the day numeral — measured that way
  // rather than against the body size, because a page set in 11pt text puts its reference (15pt)
  // within a few points of the title (22pt) and the reference is not part of the title.
  const sizes = [...new Set(lines.filter((line) => line.y > studyLine.y).map((line) => Math.round(line.textHeight * 2) / 2))]
    .sort((a, b) => b - a);
  const numeralSize = numeralEntry ? numeralEntry.span.height : 0;
  const displayHeight =
    numeralSize > 0 ? sizes.find((size) => size < numeralSize - 1) ?? sizes[0] : sizes[0];
  const isTitle = (thing) => (thing.textHeight ?? thing.height) >= displayHeight - 1;
  const titleLines = lines
    .filter((line) => isTitle(line) && line !== numeral && line !== weekdayLine && line.y > height * 0.7)
    .map((line) => keepSpans(line, (span) => !weekdaySpan(span) && isTitle(span)))
    .sort((a, b) => b.y - a.y);

  const titleTop = titleLines.length ? Math.min(...titleLines.map((line) => line.y)) : height * 0.7;
  const body = (line) =>
    line !== numeral && line !== weekdayLine && line !== studyLine && !isTitle(line) && !smallType(line);
  const desc = (a, b) => b.y - a.y;

  // Four bands in printing order — reference, opening scripture, message, and under the
  // `Scripture Reading` line the closing text. Only the message is picked out by size, since
  // that is what `modalHeight` measured; the other three are placed relative to it, because the
  // scripture and the prayer are set one to three sizes below the body and the distance moves
  // from day to day. Gap-based band-splitting was tried first and is too fragile: a body that
  // breaks around a picture leaves a hole as wide as the space between two blocks.
  const between = lines
    .filter((line) => body(line) && line.y > studyLine.y && line.y < titleTop)
    .sort(desc);
  // The reference is the first thing under the title: bigger than the body and a block of one,
  // with the scripture starting a new paragraph below it.
  const first = between[0];
  const refLine =
    first &&
    first.textHeight >= bodyHeight &&
    (between.length < 2 || first.y - between[1].y > first.textHeight * 1.7)
      ? first
      : null;
  const sized = between.filter((line) => Math.abs(line.textHeight - bodyHeight) <= 0.6);
  // A scripture set half a point under the body size is inside that tolerance, so it is peeled
  // off by the break in its leading: the run of slightly smaller lines stops where the message
  // starts. (Where the two sizes are identical the scripture simply stays with the body, which
  // is what the printed page does to a reader too.)
  let peelAt = 0;
  for (let index = 1; index < sized.length; index += 1) {
    if (sized[index - 1].y - sized[index].y <= sized[index].textHeight * 1.7) continue;
    const head = sized.slice(0, index);
    const rightEdge = Math.max(...sized.map((line) => line.x1));
    // The message is typeset flush right; a centred scripture is not, so a group above the
    // break whose lines stop short of the column edge is the scripture, not the body.
    const flush = head.filter((line) => line.x1 > rightEdge - 3).length;
    if (flush * 2 <= head.length) {
      peelAt = index;
      break;
    }
    peelAt = 0;
    break;
  }
  const bodyLines = sized.slice(peelAt);
  if (bodyLines.length < 2) return null;
  const topBodyY = Math.max(...bodyLines.map((line) => line.y));
  const above = between.filter((line) => line.y > topBodyY);
  const refLines = refLine ? [refLine] : [];
  const scriptureLines = above.filter((line) => line !== refLine && (!refLine || line.y < refLine.y));

  const below = lines.filter((line) => body(line) && line.y < studyLine.y).sort(desc);
  // Whatever hugs the `Scripture Reading` line is the wrap of that line, not the prayer.
  let closingAt = 0;
  while (closingAt < below.length && studyLine.y - below[closingAt].y <= below[closingAt].textHeight * 1.4)
    closingAt += 1;
  const studyLines = below.slice(0, closingAt);
  const prayerLines = below
    .slice(closingAt)
    .map((line) => keepSpans(line, (span) => !(span.height > bodyHeight + 1 && span.x0 > width * 0.65)))
    .filter((line) => tidy(line.text));
  const closingLabel = lines
    .filter((line) => line.y < studyLine.y && line.spans.some((span) => span.height >= bodyHeight && span.x0 > width * 0.68))
    .map((line) => keepSpans(line, (span) => span.height >= bodyHeight && span.x0 > width * 0.68));

  const text = (list) => tidy(list.map((line) => dedupe(tidy(line.text))).join(' '));
  const isConfession = /\bsay\b/.test(text(closingLabel).toLowerCase());
  const consumed = new Set(
    [
      numeral, weekdayLine, studyLine, refLine, ...titleLines, ...refLines, ...scriptureLines,
      ...bodyLines, ...studyLines, ...prayerLines, ...closingLabel, ...lines.filter(isTitle), ...lines.filter(smallType),
    ]
      .filter(Boolean)
      .map(lineOrigin)
  );
  const unconsumed = lines
    .filter((line) => !consumed.has(lineOrigin(line)))
    .map((line) => tidy(line.text))
    .filter((value) => value && !/^\d{1,3}$/.test(value));

  return assembleDay(
    {
      day,
      weekdayPrinted: weekdayLine ? tidy(weekdayLine.text) : null,
      titleLines,
      // Early-reader titles are set in mixed case, so they are published as printed.
      titleRaw: text(titleLines),
      scripture: text(scriptureLines),
      scriptureReference: text(refLines).replace(/[.:]+$/, ''),
      paragraphs: toParagraphs(bodyLines, 6).paragraphs,
      // Exactly one closing block per day, placed in `prayer` and named by `prayerLabel` —
      // the shape the published adult articles already use for their own confessions.
      prayer: text(prayerLines),
      prayerLabel: isConfession ? 'Confession' : 'Prayer',
      furtherStudy: text([studyLine, ...studyLines]).replace(/^scripture reading[:\s]*[-–]?\s*/i, ''),
      oneYearPlan: '',
      twoYearPlan: '',
      pages: [page.pageNo],
      hasDropCap: false,
      unconsumed,
    },
    edition
  );
}

/* ------------------------------------------------------------------ family dispatch */

export const FAMILIES = {
  adults: {
    audience: 'adults',
    /** A two-page spread per day, opened by the "tuesday 1" date line at the top right. */
    extract({ pages, edition, vocabulary }) {
      const days = [];
      for (let index = 0; index < pages.length - 1; index += 1) {
        const left = pages[index];
        const hasDate = left.lines.some((line) => DATE_LINE.test(tidy(line.text)) && line.height >= 12);
        if (!hasDate) continue;
        const right = pages[index + 1];
        const day = extractDay({
          left: left.lines,
          right: right.lines,
          edition,
          leftPageNo: left.pageNo,
          rightPageNo: right.pageNo,
          vocabulary,
        });
        if (day) days.push(day);
      }
      return days;
    },
  },
  teens: { audience: 'teens', extract: extractTeensEdition },
  'early-readers': { audience: 'early-readers', extract: extractEarlyReadersEdition },
};

/* ------------------------------------------------------------------ serialisation */

const yamlString = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Front matter and body for one article. The key order and the section order below are what
 * the published September/October files already carry, so audiences only ever *add* keys
 * (`audience`, `subtitle`, `extras`) or omit sections a family does not print
 * (early readers have no reading plans) — never reorder them.
 */
export function renderPost(post, { sourcePdf }) {
  const meta = AUDIENCES[post.audience ?? 'adults'];
  const series = post.series ?? meta.series;
  const field = (key, value) => `${key}: ${yamlString(value)}`;

  const frontmatter = [
    '---',
    field('title', post.title),
    field('titleOriginal', post.titleOriginal),
    field('slug', post.slug),
    field('date', post.date),
    field('weekday', post.weekday),
    `dayOfMonth: ${post.dayOfMonth}`,
    field('edition', post.edition),
    field('editionTitle', post.editionTitle),
    ...(post.audience && post.audience !== 'adults'
      ? [field('audience', post.audience), field('audienceLabel', post.audienceLabel ?? meta.label)]
      : []),
    `author: "Pastor Chris Oyakhilome"`,
    field('series', series),
    `kind: "daily-devotional"`,
    field('excerpt', post.excerpt),
    field('scripture', post.scripture),
    field('scriptureReference', post.scriptureReference),
    ...(post.subtitle ? [field('subtitle', post.subtitle)] : []),
    field('prayerLabel', post.prayerLabel),
    field('prayer', post.prayer),
    ...(post.extras?.length
      ? ['extras:', ...post.extras.flatMap((section) => [
          `  - label: ${yamlString(section.label)}`,
          `    text: ${yamlString(section.text)}`,
        ])]
      : []),
    field('furtherStudy', post.furtherStudy),
    ...(post.oneYearPlan || post.twoYearPlan
      ? [field('oneYearPlan', post.oneYearPlan), field('twoYearPlan', post.twoYearPlan)]
      : []),
    `readingMinutes: ${post.readingMinutes}`,
    `tags: [${post.tags.map(yamlString).join(', ')}]`,
    field('sourcePdf', sourcePdf),
    `sourcePages: [${post.pages.join(', ')}]`,
    field('source', `${series}, ${post.editionTitle} Edition`),
    'status: "published"',
    '---',
  ].join('\n');

  const blocks = [post.paragraphs.join('\n\n')];
  if (post.prayer) blocks.push(`## ${post.prayerLabel}\n\n${post.prayer}`);
  for (const section of post.extras ?? []) blocks.push(`## ${section.label}\n\n${section.text}`);
  if (post.furtherStudy) blocks.push(`## Further Study\n\n${post.furtherStudy}`);
  if (post.oneYearPlan || post.twoYearPlan) {
    blocks.push(
      [
        '## Bible Reading Plans',
        '',
        `**1-Year Bible Reading Plan:** ${post.oneYearPlan}`,
        '',
        `**2-Year Bible Reading Plan:** ${post.twoYearPlan}`,
      ].join('\n')
    );
  }

  return `${frontmatter}\n\n${blocks.join('\n\n')}\n`;
}

/* ------------------------------------------------------------------ driver */

export async function readPdf(filePath) {
  const data = new Uint8Array(readFileSync(filePath));
  const doc = await getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push({ pageNo: n, width: page.view[2], height: page.view[3], lines: buildLines(content.items) });
  }
  await doc.destroy();
  return pages;
}

/**
 * Parse one edition PDF. The audience and the month come from the filename and are confirmed
 * against the book’s own front matter, so a renamed or re-shoot of the same edition extracts
 * identically — and a PDF that is not one of the daily-devotional editions is refused with a
 * reason rather than producing a nonsense corpus.
 */
export async function extractEdition(filePath) {
  return extractPages(filePath, await readPdf(filePath));
}

/** `extractEdition` for a PDF that has already been read — the CLI parses every page once. */
export async function extractPages(filePath, pages) {
  const source = classifySource(filePath, pages);
  if (source.skip) throw new Error(`${source.name}: not extractable — ${source.skip}`);

  const edition = {
    audience: source.audience,
    year: source.year,
    month: source.month,
    monthName: source.monthName,
    editionTitle: source.editionTitle,
  };
  const vocabulary = buildVocabulary(pages);
  const days = FAMILIES[source.audience]
    .extract({ pages, edition, vocabulary })
    .sort((a, b) => a.dayOfMonth - b.dayOfMonth)
    .map((day) => finishDay(day, edition));

  return { edition, days, pageCount: pages.length, vocabulary, warning: source.warning ?? null };
}

/**
 * What each family prints, and therefore what counts as a complete day. The adult edition is
 * the strictest, because its shape has been published and reviewed; the younger editions are
 * allowed to be short and to skip blocks the printed page does not have.
 */
export const VERIFY_RULES = {
  adults: {
    minWords: 150, maxWords: 900, minParagraphs: 2, minPrayerChars: 80, minExcerpt: 30,
    requirePrayer: true, requirePlans: true, requireFurtherStudy: true, requireDropCap: true,
    referenceInScripture: true,
    // A running head is boilerplate when it lands in a message; the young readers' editions
    // genuinely point the reader at `Rhapsody of Realities for Early Readers` inside the text.
    boilerplate: true,
  },
  teens: {
    minWords: 90, maxWords: 900, minParagraphs: 1, minPrayerChars: 40, minExcerpt: 25,
    requirePrayer: false, requirePlans: true, requireFurtherStudy: true,
    // Most teens days open with a drop cap, but not all of them (10 July 2026 starts an
    // ordinary indented paragraph), so its absence is not evidence of a mis-split block.
    requireDropCap: false,
    referenceInScripture: false, boilerplate: false,
  },
  'early-readers': {
    minWords: 30, maxWords: 600, minParagraphs: 1, minPrayerChars: 20, minExcerpt: 18,
    requirePrayer: false, requirePlans: false, requireFurtherStudy: true, requireDropCap: false,
    referenceInScripture: false, boilerplate: false,
  },
};

/**
 * Words that exist only because two glyphs were set apart: a drop cap glued to the word it
 * opens ("Irecall" for "I recall") and a superscript that was pulled out of a line ("17verse"
 * for "17th verse"). Only the edition's own vocabulary can tell those from real words, so
 * this runs on words the book never spells any other way.
 */
export function findGluedWords(text, vocabulary) {
  const glued = [];
  for (const token of tidy(text).split(/\s+/)) {
    const bare = token.replace(/[^A-Za-z0-9’']/g, '');
    if (bare.length < 3) continue;
    const match = bare.match(/^([A-Za-z])([a-z]{2,})$/) ?? bare.match(/^(\d+)([a-z]{2,})$/);
    if (!match) continue;
    const tail = match[2].toLowerCase();
    if (vocabulary.has(tail) && !vocabulary.has(bare.toLowerCase())) glued.push(bare);
  }
  return glued;
}

/** Assertions that keep the published corpus honest. Returns a list of problems. */
export function verifyDay(day, sourcePdf, options = {}) {
  const problems = [];
  const at = `${sourcePdf} ${day.date}`;
  const rules = VERIFY_RULES[day.audience ?? 'adults'] ?? VERIFY_RULES.adults;
  const vocabulary = options.vocabulary ?? null;

  if (!day.title || day.title.length < 4) problems.push(`${at}: missing title`);
  if (!day.weekdayMatches) problems.push(`${at}: printed weekday "${day.weekdayPrinted}" ≠ calendar ${day.weekday}`);
  if (!day.excerpt || day.excerpt.length < rules.minExcerpt) problems.push(`${at}: excerpt too short ("${day.excerpt}")`);
  if (/^[^A-Za-z0-9]/.test(day.excerpt ?? '')) problems.push(`${at}: excerpt starts with "${(day.excerpt ?? '').slice(0, 20)}"`);
  if (/[a-z]—[a-z]/.test(day.title)) problems.push(`${at}: title case looks wrong after a dash: "${day.title}"`);
  if (!day.scripture) problems.push(`${at}: missing opening scripture`);
  else if (rules.referenceInScripture && !day.scriptureReference)
    problems.push(`${at}: scripture has no (reference): "${day.scripture.slice(-60)}"`);
  else if (!rules.referenceInScripture && !day.scriptureReference) problems.push(`${at}: missing scripture reference`);
  if (day.paragraphs.length < rules.minParagraphs) problems.push(`${at}: only ${day.paragraphs.length} message paragraph(s)`);
  if (day.words < rules.minWords || day.words > rules.maxWords) problems.push(`${at}: unexpected message length (${day.words} words)`);
  if (rules.requirePrayer && !day.prayer) problems.push(`${at}: missing prayer`);
  if (!day.prayer && !(day.extras ?? []).length)
    problems.push(`${at}: no closing block (prayer, confession or act)`);
  if (day.prayer && day.prayer.length < rules.minPrayerChars)
    problems.push(`${at}: ${day.prayerLabel.toLowerCase()} looks truncated (${day.prayer.length} chars)`);
  if (!['Prayer', 'Confession'].includes(day.prayerLabel)) problems.push(`${at}: unexpected closing label "${day.prayerLabel}"`);
  if (rules.requireFurtherStudy && !day.furtherStudy) problems.push(`${at}: missing further study`);
  if (rules.requirePlans && !day.oneYearPlan) problems.push(`${at}: missing 1-year Bible reading plan`);
  if (rules.requirePlans && !day.twoYearPlan) problems.push(`${at}: missing 2-year Bible reading plan`);
  if (rules.requireDropCap && !day.hasDropCap) problems.push(`${at}: message has no drop cap — body/scripture split may be wrong`);
  if (day.unconsumed.length)
    problems.push(`${at}: ${day.unconsumed.length} unparsed line(s): "${day.unconsumed.join(' / ').slice(0, 90)}"`);
  if (day.paragraphs.some((p) => /(^|\s)-(\s|$)/.test(p) || /\p{L}- \p{L}/u.test(p) || /\s,[\w]/.test(p)))
    problems.push(`${at}: message contains a broken word or stray punctuation`);

  for (const [field, value] of Object.entries({
    title: day.title, subtitle: day.subtitle ?? '', scripture: day.scripture, message: day.paragraphs.join(' '),
    prayer: day.prayer, furtherStudy: day.furtherStudy,
    oneYearPlan: day.oneYearPlan, twoYearPlan: day.twoYearPlan,
  })) {
    const ad = rules.boilerplate ? AD_PHRASES.find((re) => re.test(value)) : null;
    if (ad) problems.push(`${at}: ${field} contains publisher boilerplate (${ad.source})`);
  }

  if (vocabulary) {
    const caps = day.paragraphs
      .map((paragraph) => tidy(paragraph).split(/\s+/)[0] ?? '')
      .filter((word) => findGluedWords(word, vocabulary).length);
    if (caps.length) problems.push(`${at}: drop cap glued to the word it opens ("${caps[0]}")`);
    const digits = findGluedWords(day.paragraphs.join(' '), vocabulary).filter((word) => /^\d/.test(word));
    if (digits.length) problems.push(`${at}: a superscript lost its word ("${digits.join(', ')}")`);
  }
  return problems;
}

function verifyEdition(result, sourcePdf) {
  const { edition, days, vocabulary } = result;
  const problems = [];
  const expected = new Date(Date.UTC(edition.year, edition.month, 0)).getUTCDate();
  if (days.length !== expected) problems.push(`${sourcePdf}: found ${days.length} days, expected ${expected}`);
  days.forEach((day, i) => {
    if (day.dayOfMonth !== i + 1) problems.push(`${sourcePdf}: day ${i + 1} parsed as dayOfMonth=${day.dayOfMonth}`);
    if (!day.date.startsWith(`${edition.year}-${String(edition.month).padStart(2, '0')}-`))
      problems.push(`${sourcePdf} ${day.date}: date outside the ${edition.editionTitle} edition`);
    problems.push(...verifyDay(day, sourcePdf, { vocabulary }));
  });
  const slugs = new Set();
  for (const day of days) {
    if (slugs.has(day.slug)) problems.push(`${sourcePdf}: duplicate slug ${day.slug}`);
    slugs.add(day.slug);
  }
  return problems;
}

async function main() {
  const argv = process.argv.slice(2);
  const has = (flag) => argv.includes(flag);
  const valueOf = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : null;
  };

  const verifyOnly = has('--verify');
  const onlyAudience = valueOf('--audience');
  const outDir = path.resolve(REPO_ROOT, valueOf('--out') ?? 'content/devotionals');

  let pdfs = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--pdf' && argv[i + 1]) pdfs.push(path.resolve(REPO_ROOT, argv[i + 1]));
  }
  if (!pdfs.length) pdfs = discoverSources(REPO_ROOT);
  if (!pdfs.length) {
    console.error('No edition PDFs found (expected <month>-<year>-rhapsody.pdf at the repo root or in pdf/).');
    process.exit(1);
  }

  let problems = [];
  const written = [];
  const skipped = [];
  const seen = new Map();
  const totals = new Map();

  for (const pdf of pdfs) {
    // Filenames carry the family and the month for every edition in the corpus, so the books
    // and sermon notes are dismissed without being parsed. Where a name is ambiguous, the
    // front matter gets the last word.
    const byName = classifySource(pdf);
    let plan = byName;
    if (byName.audience && !byName.month) plan = classifySource(pdf, await readPdf(pdf));
    if (onlyAudience && plan.audience !== onlyAudience && !plan.skip) continue;
    if (plan.skip) {
      skipped.push(plan);
      continue;
    }
    const key = `${plan.audience} ${plan.year}-${String(plan.month).padStart(2, '0')}`;
    if (seen.has(key)) {
      problems.push(`${plan.name}: a second ${key} edition (${seen.get(key)}) — refusing to overwrite it`);
      continue;
    }
    seen.set(key, plan.name);

    const name = path.relative(REPO_ROOT, pdf);
    const result = await extractPages(pdf, await readPdf(pdf));
    const editionProblems = verifyEdition(result, name);
    problems = problems.concat(editionProblems);
    if (result.warning) problems.push(`${name}: ${result.warning}`);

    const words = result.days.reduce((sum, day) => sum + day.words, 0);
    totals.set(result.edition.audience, (totals.get(result.edition.audience) ?? 0) + result.days.length);
    console.log(
      `${name}: ${result.days.length} ${AUDIENCES[result.edition.audience].shortLabel.toLowerCase()} devotionals ` +
        `(${result.days[0]?.date} → ${result.days.at(-1)?.date}, ${words.toLocaleString('en-US')} words) ` +
        (editionProblems.length ? `— ${editionProblems.length} problem(s)` : '— ok')
    );

    if (verifyOnly) continue;

    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    // Remove only this edition's files so re-running is idempotent and never orphans posts.
    // The audience has to be part of that test: every audience shares the same date prefix.
    const ym = `${result.edition.year}-${String(result.edition.month).padStart(2, '0')}`;
    const slugToken = AUDIENCES[result.edition.audience].slugToken;
    const ownedByThisEdition = (stem) => {
      if (!stem.startsWith(`${ym}-`)) return false;
      const tag = stem.match(/^\d{4}-\d{2}-\d{2}-(teens|early-readers|kids)-/)?.[1] ?? null;
      return slugToken ? tag === slugToken : tag === null;
    };
    for (const stale of readdirSync(outDir)) {
      if (!stale.endsWith('.md')) continue;
      const stem = stale.replace(/\.md$/, '');
      if (ownedByThisEdition(stem) && !result.days.some((day) => day.slug === stem)) {
        rmSync(path.join(outDir, stale));
      }
    }
    for (const day of result.days) {
      const file = path.join(outDir, `${day.slug}.md`);
      writeFileSync(file, `${renderPost(day, { sourcePdf: path.basename(pdf) })}\n`, 'utf8');
      written.push(path.relative(REPO_ROOT, file));
    }
  }

  for (const [audience, count] of totals) {
    console.log(`  ${AUDIENCES[audience].label}: ${count} articles`);
  }
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} PDF(s):`);
    for (const item of skipped) console.log(`  • ${item.name} — ${item.skip}`);
  }

  if (problems.length) {
    console.error(`\n${problems.length} problem(s) found:`);
    for (const p of problems.slice(0, 60)) console.error(`  • ${p}`);
    if (problems.length > 60) console.error(`  … and ${problems.length - 60} more`);
    process.exit(1);
  }

  if (!verifyOnly) {
    console.log(`\nWrote ${written.length} posts to ${path.relative(REPO_ROOT, outDir)}/`);
  } else {
    console.log('\nVerification passed — every daily article parsed cleanly.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
