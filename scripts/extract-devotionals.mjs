#!/usr/bin/env node
/**
 * extract-devotionals.mjs — turns a monthly "Rhapsody of Realities" PDF edition into
 * one Markdown blog post per daily devotional.
 *
 * Why a layout-aware parser: the PDF is typeset as a two-page spread per day, and a naive
 * `page.getTextContent()` dump interleaves the title, the opening scripture, the drop cap
 * and the message body. So we rebuild *lines* (items sharing a baseline), classify them by
 * geometry (font height + indentation) and by the fixed section labels the edition uses
 * (PRAYER / FURTHER STUDY / 1-YEAR BIBLE READING PLAN / 2-YEAR BIBLE READING PLAN), and
 * only then assemble the article.
 *
 * Spread anatomy (y grows upwards — PDF coordinates):
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
  /^\d{1,3}$/, // folio
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
];

/* ------------------------------------------------------------------ reading geometry */

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

  return [...rows.entries()]
    .map(([y, rowItems]) => {
      rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
      // The opening letter of each article is set as a drop cap: a single oversized glyph
      // whose baseline is the *second* visual line, so it belongs to the line above it.
      const capItem = rowItems.find((i) => i.height >= 18 && i.str.trim().length === 1);
      const textItems = capItem ? rowItems.filter((i) => i !== capItem) : rowItems;
      const geometryItems = textItems.length ? textItems : rowItems;
      return {
        y,
        x0: Math.min(...geometryItems.map((i) => i.transform[4])),
        x1: Math.max(...geometryItems.map((i) => i.transform[4] + i.width)),
        height: Math.max(...rowItems.map((i) => i.height)),
        textHeight: textItems.length ? Math.max(...textItems.map((i) => i.height)) : 0,
        dropCap: capItem ? capItem.str.trim() : null,
        capX: capItem ? capItem.transform[4] : null,
        // The baseline the cap sits on flows *around* it, so its extra indent is cosmetic
        // and must never be read as the start of a new paragraph.
        wrapsDropCap: Boolean(capItem),
        startsParagraph: false,
        text: textItems.map((i) => i.str).join('').replace(/\s+/g, ' ').trim(),
      };
    })
    .filter((l) => l.text.length > 0 || l.dropCap)
    .sort((a, b) => b.y - a.y); // top of page first
}

const isNoise = (line) =>
  (line.textHeight > 0 && line.textHeight <= 10 && line.y <= 60) ||
  NOISE_PATTERNS.some((re) => re.test(line.text.trim()));

/**
 * Single-letter drop caps are ambiguous: "I" can open the word "In" or stand alone as the
 * pronoun ("I once watched…"). Both are typeset identically — the line that follows starts at
 * the same x whether or not a word space belongs there — so geometry cannot decide it.
 * Only I/A/O double as English words, and the ambiguity only bites when the text that follows
 * is itself a whole common word, so that is the test we apply.
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

/** True when the cap is a word of its own and needs a space before the text that follows. */
export function capNeedsSpace(cap, followingText) {
  if (!STANDALONE_CAPS.has(cap)) return false;
  const firstWord = followingText.split(/[\s,.:;!?]/)[0].toLowerCase();
  return COMMON_WORDS.has(firstWord);
}

/**
 * Promote every drop cap onto the line above it (the one it visually starts). The line the
 * cap rests on keeps flowing text, so it is flagged `wrapsDropCap` and stays in place.
 */
function attachDropCaps(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.dropCap) continue;
    const target = lines[i - 1]; // lines are sorted top-first
    if (target && !isNoise(target)) {
      // Normally the cap is the first letter of the word the line continues ("W" + "hen…").
      // It stands alone — needing a space — when the line opens with a capital (the "1" of
      // "1 Peter 1:23 tells us…") or when it is the pronoun/article itself ("I once watched…").
      const joinsWord = /^[a-z]/.test(target.text) && !capNeedsSpace(line.dropCap, target.text);
      target.text = joinsWord ? `${line.dropCap}${target.text}` : `${line.dropCap} ${target.text}`;
      target.x0 = Math.min(target.x0, line.capX ?? line.x0);
      target.startsParagraph = true;
    }
    line.dropCap = null;
  }
  return lines;
}

/* ------------------------------------------------------------------ text shaping */

const tidy = (value) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([‘“])\s+/g, '$1')
    .replace(/\s+([’”])/g, '$1')
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
      return lower.replace(/(^|[-–—/])([a-z])/g, (_match, sep, letter) => sep + letter.toUpperCase());
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
  if (excerpt.length > limit) {
    excerpt = `${excerpt.slice(0, limit).replace(/\s+\S*$/, '').replace(/[,;:]+$/, '')}…`;
  } else if (excerpt.length < text.length && !/[.!?”"]$/.test(excerpt)) {
    excerpt += '…';
  }
  return excerpt.trim();
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

function extractDay({ left, right, edition, leftPageNo, rightPageNo }) {
  const leftLines = attachDropCaps(left.filter((l) => !isNoise(l)));
  const rightLines = attachDropCaps(right.filter((l) => !isNoise(l)));

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
function toParagraphs(lines) {
  if (!lines.length) return { paragraphs: [], firstLineIndented: false };
  const margin = Math.min(...lines.filter((l) => !l.wrapsDropCap).map((l) => l.x0));
  const isIndented = (line) => !line.wrapsDropCap && line.x0 >= margin + 12;
  const paragraphs = [];
  let current = [];

  for (const line of lines) {
    if (isIndented(line) && current.length) {
      paragraphs.push(current.join(' '));
      current = [];
    }
    current.push(line.text);
  }
  if (current.length) paragraphs.push(current.join(' '));
  return { paragraphs: paragraphs.map(tidy).filter(Boolean), firstLineIndented: isIndented(lines[0]) };
}

/** Left-page paragraphs + right-page continuation, stitched when the spread runs on mid-paragraph. */
function mergeParagraphs(leftBody, rightBody) {
  const left = toParagraphs(leftBody);
  const right = toParagraphs(rightBody);
  const out = [...left.paragraphs];
  if (right.paragraphs.length && !right.firstLineIndented && out.length) {
    out[out.length - 1] = tidy(`${out[out.length - 1]} ${right.paragraphs.shift()}`);
  }
  return [...out, ...right.paragraphs];
}

const REFERENCE_RE = /\(([^()]{2,80})\)\s*\.?\s*$/;

function extractReference(scripture) {
  const match = scripture.match(REFERENCE_RE);
  return match ? tidy(match[1]).replace(/\.$/, '') : '';
}

/* ------------------------------------------------------------------ serialisation */

const yamlString = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export function renderPost(post, { sourcePdf }) {
  const frontmatter = [
    '---',
    `title: ${yamlString(post.title)}`,
    `titleOriginal: ${yamlString(post.titleOriginal)}`,
    `slug: ${yamlString(post.slug)}`,
    `date: ${yamlString(post.date)}`,
    `weekday: ${yamlString(post.weekday)}`,
    `dayOfMonth: ${post.dayOfMonth}`,
    `edition: ${yamlString(post.edition)}`,
    `editionTitle: ${yamlString(post.editionTitle)}`,
    `author: "Pastor Chris Oyakhilome"`,
    `series: "Rhapsody of Realities"`,
    `kind: "daily-devotional"`,
    `excerpt: ${yamlString(post.excerpt)}`,
    `scripture: ${yamlString(post.scripture)}`,
    `scriptureReference: ${yamlString(post.scriptureReference)}`,
    `prayerLabel: ${yamlString(post.prayerLabel)}`,
    `prayer: ${yamlString(post.prayer)}`,
    `furtherStudy: ${yamlString(post.furtherStudy)}`,
    `oneYearPlan: ${yamlString(post.oneYearPlan)}`,
    `twoYearPlan: ${yamlString(post.twoYearPlan)}`,
    `readingMinutes: ${post.readingMinutes}`,
    `tags: [${post.tags.map(yamlString).join(', ')}]`,
    `sourcePdf: ${yamlString(sourcePdf)}`,
    `sourcePages: [${post.pages.join(', ')}]`,
    `source: ${yamlString(`Rhapsody of Realities, ${post.editionTitle} Edition`)}`,
    'status: "published"',
    '---',
  ].join('\n');

  const body = [
    post.paragraphs.join('\n\n'),
    '',
    `## ${post.prayerLabel}`,
    '',
    post.prayer,
    '',
    '## Further Study',
    '',
    post.furtherStudy,
    '',
    '## Bible Reading Plans',
    '',
    `**1-Year Bible Reading Plan:** ${post.oneYearPlan}`,
    '',
    `**2-Year Bible Reading Plan:** ${post.twoYearPlan}`,
    '',
  ].join('\n');

  return `${frontmatter}\n\n${body}`;
}

/* ------------------------------------------------------------------ driver */

async function readPdf(filePath) {
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
    pages.push({ pageNo: n, height: page.view[3], lines: buildLines(content.items) });
  }
  await doc.destroy();
  return pages;
}

function editionFromFilename(file) {
  const match = path.basename(file).toLowerCase().match(/^([a-z]+)-(\d{4})-rhapsody\.pdf$/);
  if (!match) return null;
  const month = MONTHS[match[1]];
  if (!month) return null;
  const monthName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  return { year: Number(match[2]), month, monthName };
}

export async function extractEdition(filePath) {
  const edition = editionFromFilename(filePath);
  if (!edition) throw new Error(`Cannot read edition from filename: ${path.basename(filePath)}`);
  const pages = await readPdf(filePath);

  const days = [];
  for (let i = 0; i < pages.length - 1; i += 1) {
    const left = pages[i];
    const hasDate = left.lines.some((l) => DATE_LINE.test(tidy(l.text)) && l.height >= 12);
    if (!hasDate) continue;
    const right = pages[i + 1];
    const day = extractDay({
      left: left.lines,
      right: right.lines,
      edition,
      leftPageNo: left.pageNo,
      rightPageNo: right.pageNo,
    });
    if (day) days.push(day);
  }

  for (const day of days) {
    day.excerpt = makeExcerpt(day.paragraphs);
    day.readingMinutes = readingMinutes(day.words);
    day.tags = ['daily-devotional', 'rhapsody-of-realities', `${edition.monthName.toLowerCase()}-${edition.year}`];
  }
  return { edition, days, pageCount: pages.length };
}

/** Assertions that keep the published corpus honest. Returns a list of problems. */
export function verifyDay(day, sourcePdf) {
  const problems = [];
  const at = `${sourcePdf} ${day.date}`;
  if (!day.title || day.title.length < 4) problems.push(`${at}: missing title`);
  if (!day.weekdayMatches) problems.push(`${at}: printed weekday "${day.weekdayPrinted}" ≠ calendar ${day.weekday}`);
  if (!day.excerpt || day.excerpt.length < 40) problems.push(`${at}: excerpt too short ("${day.excerpt}")`);
  if (/^[^A-Za-z0-9]/.test(day.excerpt ?? '')) problems.push(`${at}: excerpt starts with "${(day.excerpt ?? '').slice(0, 20)}"`);
  if (/[a-z]—[a-z]/.test(day.title)) problems.push(`${at}: title case looks wrong after a dash: "${day.title}"`);
  if (!day.scripture) problems.push(`${at}: missing opening scripture`);
  else if (!day.scriptureReference) problems.push(`${at}: scripture has no (reference): "${day.scripture.slice(-60)}"`);
  if (day.paragraphs.length < 2) problems.push(`${at}: only ${day.paragraphs.length} message paragraph(s)`);
  if (day.words < 150 || day.words > 900) problems.push(`${at}: unexpected message length (${day.words} words)`);
  if (!day.prayer) problems.push(`${at}: missing prayer`);
  else if (day.prayer.length < 80) problems.push(`${at}: ${day.prayerLabel.toLowerCase()} looks truncated (${day.prayer.length} chars)`);
  if (!['Prayer', 'Confession'].includes(day.prayerLabel)) problems.push(`${at}: unexpected closing label "${day.prayerLabel}"`);
  if (!day.furtherStudy) problems.push(`${at}: missing further study`);
  if (!day.oneYearPlan) problems.push(`${at}: missing 1-year Bible reading plan`);
  if (!day.twoYearPlan) problems.push(`${at}: missing 2-year Bible reading plan`);
  if (!day.hasDropCap) problems.push(`${at}: message has no drop cap — body/scripture split may be wrong`);
  if (day.unconsumed.length)
    problems.push(`${at}: ${day.unconsumed.length} unparsed line(s): "${day.unconsumed.join(' / ').slice(0, 90)}"`);
  if (day.paragraphs.some((p) => /(^|\s)-(\s|$)/.test(p) || /\s,[\w]/.test(p)))
    problems.push(`${at}: message contains a broken word or stray punctuation`);
  for (const [field, value] of Object.entries({
    title: day.title, scripture: day.scripture, message: day.paragraphs.join(' '),
    prayer: day.prayer, furtherStudy: day.furtherStudy,
    oneYearPlan: day.oneYearPlan, twoYearPlan: day.twoYearPlan,
  })) {
    const ad = AD_PHRASES.find((re) => re.test(value));
    if (ad) problems.push(`${at}: ${field} contains publisher boilerplate (${ad.source})`);
  }
  // The drop cap is the one place two glyphs get glued into a word, so check the result:
  // "Ionce watched…" is wrong, "Into the Kingdom…" / "In our previous study…" are right.
  for (const paragraph of day.paragraphs.slice(0, 1)) {
    const firstWord = paragraph.split(/\s+/)[0].replace(/[^A-Za-z]/g, '');
    if (/^[IAO][a-z]+$/.test(firstWord) && !COMMON_WORDS.has(firstWord.toLowerCase()))
      problems.push(`${at}: drop cap looks glued to a word ("${paragraph.slice(0, 40)}")`);
  }
  // A digit drop cap ("1 Peter 1:23 …") must not glue onto the word that follows it.
  if (day.paragraphs.some((p) => /\d[A-Za-z]/.test(p)))
    problems.push(`${at}: suspicious drop-cap merge (digit glued to a word)`);
  return problems;
}

function verifyEdition({ edition, days }, sourcePdf) {
  const problems = [];
  const expected = new Date(Date.UTC(edition.year, edition.month, 0)).getUTCDate();
  if (days.length !== expected) problems.push(`${sourcePdf}: found ${days.length} days, expected ${expected}`);
  days.forEach((day, i) => {
    if (day.dayOfMonth !== i + 1) problems.push(`${sourcePdf}: day ${i + 1} parsed as dayOfMonth=${day.dayOfMonth}`);
    problems.push(...verifyDay(day, sourcePdf));
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
  const outDir = path.resolve(REPO_ROOT, valueOf('--out') ?? 'content/devotionals');

  let pdfs = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--pdf' && argv[i + 1]) pdfs.push(path.resolve(REPO_ROOT, argv[i + 1]));
  }
  if (!pdfs.length) {
    pdfs = readdirSync(REPO_ROOT)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .map((f) => path.join(REPO_ROOT, f))
      .sort();
  }
  if (!pdfs.length) {
    console.error('No edition PDFs found (expected <month>-<year>-rhapsody.pdf at the repo root).');
    process.exit(1);
  }

  let problems = [];
  const written = [];

  for (const pdf of pdfs) {
    const name = path.basename(pdf);
    const result = await extractEdition(pdf);
    const editionProblems = verifyEdition(result, name);
    problems = problems.concat(editionProblems);

    console.log(
      `${name}: ${result.days.length} daily devotionals ` +
        `(${result.days[0]?.date} → ${result.days[result.days.length - 1]?.date})` +
        (editionProblems.length ? ` — ${editionProblems.length} problem(s)` : ' — ok')
    );

    if (verifyOnly) continue;

    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    // Remove only this edition's files so re-running is idempotent and never orphans posts.
    for (const stale of readdirSync(outDir)) {
      if (!stale.endsWith('.md')) continue;
      const belongsToEdition = result.days.some((d) => `${d.slug}.md` === stale);
      const sameEdition = stale.startsWith(`${result.edition.year}-${String(result.edition.month).padStart(2, '0')}-`);
      if (sameEdition && !belongsToEdition) rmSync(path.join(outDir, stale));
    }
    for (const day of result.days) {
      const file = path.join(outDir, `${day.slug}.md`);
      writeFileSync(file, `${renderPost(day, { sourcePdf: name })}\n`, 'utf8');
      written.push(path.relative(REPO_ROOT, file));
    }
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
