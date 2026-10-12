import { beforeAll, describe, expect, it } from 'vitest';
import {
  REGISTRY,
  dropFurniturePages,
  isContentsBlob,
  isContentsEntry,
  isCoverPage,
  isFrontMatterLine,
  isFrontMatterPage,
  isHeading,
  isNoise,
  isStructuralHeading,
  normaliseForRepeat,
  openingLines,
  repeatedLines,
  tidyOcrLine,
} from '../scripts/extract-resources.mjs';
import {
  RESOURCE_KIND_LABELS,
  RESOURCE_KIND_ORDER,
  getAllResourceSlugs,
  getAllResourceSummaries,
  getAllResources,
  getResourceBySlug,
  getResourceGroups,
  getResourceSearchIndex,
  getResourceStats,
  getResourcesByKind,
  resetResourceCache,
  searchResources,
  slugify,
  withReadableParts,
} from '@/lib/resources';
import type { Resource } from '@/lib/types';

/**
 * The shelf that is not the daily devotional: books, studies, programme notes.
 *
 * Two layers are tested because they fail differently. The extractor turns a PDF into markdown,
 * and its mistakes are visible as junk at the top of a book — so the furniture rules get their own
 * cases with page-shaped inputs. The loader turns that markdown into the objects the site renders,
 * and its mistakes are a missing chapter or a broken table of contents, so those are checked
 * against every file that is actually in `content/resources/`.
 */

let resources: Resource[] = [];

/**
 * A resource to mutate in a test. Taken from the corpus rather than written out field by field so
 * the fixture cannot drift away from the shape the loader actually produces.
 */
function fixture(overrides: Partial<Resource> = {}): Resource {
  return { ...resources[0], ...overrides };
}

beforeAll(() => {
  resetResourceCache();
  resources = getAllResources();
});

const row = (text: string, extra: Partial<{ x0: number; y: number; height: number }> = {}) => ({
  text,
  x0: extra.x0 ?? 72,
  y: extra.y ?? 0,
  height: extra.height ?? 12,
});

const page = (lines: string[]) => ({ number: 1, rows: lines.map((text) => row(text)) });

describe('the corpus', () => {
  it('loads every registry entry that has been extracted', () => {
    // The registry is the intent; the directory is what exists. A PDF that has not been extracted
    // yet is not an error here, but nothing may be loaded that is not in the registry.
    expect(resources.length).toBeGreaterThan(0);
    expect(resources.length).toBeLessThanOrEqual(REGISTRY.length);
    const known = new Set(REGISTRY.map((entry: { slug: string }) => entry.slug));
    for (const resource of resources) expect(known.has(resource.slug)).toBe(true);
  });

  it('gives every resource a slug that matches its file name', () => {
    // `getResourceBySlug` is a lookup into the loaded list, and `generateStaticParams` trusts it:
    // a slug that disagreed with the file name would 404 on a page the build said existed.
    for (const slug of getAllResourceSlugs()) {
      expect(getResourceBySlug(slug)?.slug).toBe(slug);
    }
    expect(getResourceBySlug('not-a-real-book')).toBeUndefined();
  });

  it('recovers real prose from every file, including the OCR\'d ones', () => {
    for (const resource of resources) {
      expect(resource.words, `${resource.slug} has no words`).toBeGreaterThan(100);
      expect(resource.sections.length, `${resource.slug} has no sections`).toBeGreaterThan(0);
      expect(resource.excerpt.trim().length, `${resource.slug} has no excerpt`).toBeGreaterThan(0);
      expect(['text-layer', 'ocr']).toContain(resource.recovered);
      if (resource.recovered === 'ocr') {
        // The page prints this number next to "recognised from a scan", so it must exist.
        expect(resource.confidence, `${resource.slug} is OCR without a confidence`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps no publishing furniture in the body', () => {
    for (const resource of resources) {
      for (const section of resource.sections) {
        for (const paragraph of section.paragraphs) {
          const firstLine = paragraph.trim().split('\n')[0];
          // A short paragraph that is nothing but furniture is a rights line or an address block.
          expect(
            paragraph.split(/\s+/).length >= 8 || !isFrontMatterLine(firstLine),
            `${resource.slug}: front matter reached the body — “${firstLine.slice(0, 60)}”`
          ).toBe(true);
        }
      }
    }
  });

  it('builds a section id for every heading, for the table of contents', () => {
    for (const resource of resources) {
      const ids = resource.sections.map((section) => section.id);
      expect(new Set(ids).size, `${resource.slug} has duplicate section ids`).toBe(ids.length);
      for (const section of resource.sections) {
        expect(section.id).toMatch(/^[a-z0-9-]+$/);
        // A repeated heading gets a numbered suffix, so the id still starts as the heading did.
        if (section.heading) expect(section.id.startsWith(slugify(section.heading))).toBe(true);
      }
    }
  });

  it('estimates reading and listening minutes at their own speeds', () => {
    const book = resources.find((resource) => resource.words > 5_000);
    expect(book).toBeTruthy();
    // 200 wpm on the page, 150 spoken: the same article is a shorter read than a listen.
    expect(book!.readingMinutes).toBe(Math.max(1, Math.round(book!.words / 200)));
    expect(book!.listeningMinutes).toBe(Math.max(1, Math.round(book!.words / 150)));
    expect(book!.listeningMinutes).toBeGreaterThanOrEqual(book!.readingMinutes);
  });
});

describe('grouping and stats', () => {
  it('groups in the order the shelf is presented', () => {
    const groups = getResourceGroups();
    const order = groups.map((group) => group.kind);
    expect(order).toEqual(RESOURCE_KIND_ORDER.filter((kind) => getResourcesByKind(kind).length > 0));
    expect(groups.reduce((sum, group) => sum + group.resources.length, 0)).toBe(resources.length);
    for (const group of groups) {
      expect(group.label).toBe(RESOURCE_KIND_LABELS[group.kind]);
      expect(group.blurb.length).toBeGreaterThan(0);
      expect(group.resources.length).toBeGreaterThan(0);
    }
  });

  it('filters by kind', () => {
    const books = getResourcesByKind('book');
    expect(books.length).toBeGreaterThan(0);
    for (const book of books) expect(book.kind).toBe('book');
  });

  it('counts the shelf honestly', () => {
    const stats = getResourceStats();
    expect(stats.resources).toBe(resources.length);
    expect(stats.words).toBe(resources.reduce((sum, resource) => sum + resource.words, 0));
    expect(stats.pages).toBe(resources.reduce((sum, resource) => sum + resource.sourcePages, 0));
    expect(stats.kinds.reduce((sum, entry) => sum + entry.count, 0)).toBe(resources.length);
    for (const entry of stats.kinds) {
      expect(RESOURCE_KIND_ORDER).toContain(entry.kind);
      expect(entry.label).toBe(RESOURCE_KIND_LABELS[entry.kind]);
      expect(entry.count).toBeGreaterThan(0);
    }
    // Every book scanned rather than typeset is one the page says was "recognised from a scan".
    expect(stats.recognised).toBe(resources.filter((resource) => resource.recovered === 'ocr').length);
  });

  it('summarises without carrying the body', () => {
    for (const summary of getAllResourceSummaries()) {
      expect(Object.prototype.hasOwnProperty.call(summary, 'body')).toBe(false);
      expect(summary.title.length).toBeGreaterThan(0);
    }
  });
});

describe('search', () => {
  it('finds a book by a word in its title', () => {
    const hits = searchResources('mind');
    expect(hits.map((hit) => hit.slug)).toContain('the-power-of-your-mind');
  });

  it('finds a resource by its subject tags', () => {
    const hits = searchResources('fasting');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('returns nothing rather than everything for a query that matches nothing', () => {
    expect(searchResources('zzzqqq-not-a-word')).toEqual([]);
    expect(searchResources('')).toEqual([]);
  });

  it('ships a compact index, never the books themselves', () => {
    const index = getResourceSearchIndex();
    expect(index.length).toBe(resources.length);
    for (const doc of index) {
      expect(Object.prototype.hasOwnProperty.call(doc, 'body')).toBe(false);
      expect(doc.opening.length).toBeLessThanOrEqual(400);
      expect(doc.title.length).toBeGreaterThan(0);
      expect(Object.values(RESOURCE_KIND_LABELS)).toContain(doc.kindLabel);
      // A card is only worth shipping if it can be rendered without the article.
      expect(doc.words).toBeGreaterThan(0);
    }
  });
});

describe('front matter detection (extractor)', () => {
  it('recognises the lines a rights page and an address block are made of', () => {
    expect(isFrontMatterLine('All rights reserved. No part of this book may be reproduced.')).toBe(true);
    expect(isFrontMatterLine('Tel: +234-8023324188')).toBe(true);
    expect(isFrontMatterLine('P.O. Box 13563, Ikeja, Lagos')).toBe(true);
    expect(isFrontMatterLine('Chapter 1: RENEWING YOUR MIND 9')).toBe(true);
    expect(isFrontMatterLine('Introduction: A GOD-GIVEN INSTRUMENT 5')).toBe(true);
    expect(isFrontMatterLine('42')).toBe(true);
  });

  it('leaves a real sentence alone', () => {
    expect(isFrontMatterLine('Your mind is the instrument God gave you to receive His word.')).toBe(false);
    expect(isFrontMatterLine('Chapter One')).toBe(false);
    expect(isFrontMatterLine('')).toBe(false);
  });

  it('spots a contents line as a contents line, not as the heading it points at', () => {
    expect(isContentsEntry('Chapter 1: RENEWING YOUR MIND: 9')).toBe(true);
    expect(isContentsEntry('Introduction: A GOD-GIVEN INSTRUMENT 5')).toBe(true);
    expect(isContentsEntry('Part 2 34')).toBe(true);
    expect(isContentsEntry('Chapter 1: Renewing Your Mind')).toBe(false);
    // "CHAPTER 1" is the chapter, not an entry in a list — the word count is the only difference.
    expect(isContentsEntry('CHAPTER 1')).toBe(false);
    expect(isHeading(row('CHAPTER 1: RENEWING YOUR MIND 9'))).toBe(false);
    expect(isHeading(row('CHAPTER 1: RENEWING YOUR MIND'))).toBe(true);
    expect(isHeading(row('CHAPTER 1'), { ocr: true })).toBe(true);
    expect(isHeading(row('DAY 2, 27TH MARCH 2026'))).toBe(true);
  });

  it('reads an imprint page as furniture, and a chapter as a chapter', () => {
    // "Unit C2, Thamesview Business Centre" is the publisher's door. In a scan it stands alone on a
    // page of its own, exactly where a chapter title stands, so without a rule for it the book's
    // table of contents ends with an address.
    for (const furniture of [
      'Unit C2, Thamesview Business Centre',
      'P.O. Box 131, Warri',
      'Tel: +234 806 0000 000',
      'Business Centre, Delta State',
      'Registered office: Lagos',
    ]) {
      expect(isNoise(furniture), furniture).toBe(true);
      expect(isHeading(row(furniture), { ocr: true }), furniture).toBe(false);
    }
    // The same words inside a sentence are the author's, not the printer's.
    expect(isNoise('The unit of the mind is a thought, and thoughts are things.')).toBe(false);
    expect(isHeading(row('CHAPTER 3'), { ocr: true })).toBe(true);
    expect(isHeading(row('PART ONE: THE FEAR OF GOD'), { ocr: true })).toBe(true);
  });

  it('reads a structural label as a label, and prose that starts with the same word as prose', () => {
    // The word "part" begins "PART ONE: THE FEAR OF GOD" and also "part of your armour in the first
    // place!". Without a word boundary the old rule matched "steps back. Well, it's because…" and
    // "particularly true of sisters…" too, and prose paragraphs were promoted to chapter headings.
    for (const label of [
      'CHAPTER 3',
      'PART II',
      'PART ONE: THE FEAR OF GOD',
      'Chapter One: The Fear of God',
      'DAY 2, 27TH MARCH 2026',
      'SECTION 2',
      'Phase 1 Day 1',
    ]) {
      expect(isStructuralHeading(label), label).toBe(true);
      expect(isHeading(row(label), { ocr: true }), label).toBe(true);
      // Two labels on one line is a heading with its own numbering, not an entry in a list.
      expect(isContentsEntry(label), label).toBe(false);
    }
    for (const prose of [
      'part of your armour in the first place!',
      "steps back. Well, it's because you've been",
      'particularly true of sisters; make sure you have not collected gifts',
      'days of my Spirit; and they shall prophesy',
      'CHAPTER',
    ]) {
      expect(isStructuralHeading(prose), prose).toBe(false);
      expect(isHeading(row(prose), { ocr: true }), prose).toBe(false);
    }
  });

  it('gives a long, unstructured document parts a reader can jump to', () => {
    // A scanned book sets its chapter titles in display type on a page of their own; OCR reads that
    // as sentence fragments, so the words arrive with almost no structure. The site adds the parts —
    // the markdown on disk stays whatever the PDF said.
    const longBook = fixture({
      words: 6_000,
      sections: [
        {
          id: '',
          heading: '',
          // ~9,000 words of unbroken prose: enough that the parts are the only navigation there is.
          paragraphs: Array.from({ length: 150 }, (_, i) => `Paragraph ${i} runs on and on. `.repeat(20)),
        },
        { id: 'about-the-author', heading: 'About The Author', paragraphs: ['The writer of this book.'] },
      ],
    });
    const parts = withReadableParts(longBook);
    const headings = parts.sections.map((section) => section.heading);
    expect(headings.filter(Boolean).length).toBeGreaterThan(4);
    expect(headings[0]).toMatch(/^Part 1 of \d+$/);
    expect(headings).toContain('About The Author');
    expect(new Set(parts.sections.map((section) => section.id)).size).toBe(parts.sections.length);
    // Nothing is lost or added: the words are the same words.
    expect(parts.sections.flatMap((section) => section.paragraphs).join('\n')).toBe(
      longBook.sections.flatMap((section) => section.paragraphs).join('\n'),
    );
    // A document that has its own chapters is left alone.
    const structured = fixture({
      words: 9_000,
      sections: Array.from({ length: 6 }, (_, i) => ({
        id: `chapter-${i + 1}`,
        heading: `Chapter ${i + 1}`,
        paragraphs: ['Text.'],
      })),
    });
    expect(withReadableParts(structured).sections).toEqual(structured.sections);
  });

  it('never mistakes a numbered chapter for a running head', () => {
    // Normalising the folio away is what catches a running head ("UNDERSTANDING THE MIND 17" and
    // "… 19" are the same line). Left to itself it also collapses CHAPTER 1 and CHAPTER 2 onto one
    // key, and a book loses its whole structure to a filter meant for its page furniture.
    const headingPage = (number: number, title: string) => ({
      number,
      rows: [row(title), row('A sentence of body copy long enough to be prose rather than a label.')],
    });
    const pages = [
      headingPage(5, 'CHAPTER 1'),
      headingPage(21, 'CHAPTER 2'),
      headingPage(40, 'CHAPTER 3'),
      { number: 6, rows: [row('UNDERSTANDING THE MIND 17'), row('The mind is a spiritual entity.')] },
      { number: 7, rows: [row('UNDERSTANDING THE MIND 19'), row('It is the organ of the soul.')] },
    ];
    const repeated = repeatedLines(pages.map((page) => page.rows.map((entry) => entry.text)));
    const opened = openingLines(pages);
    const furniture = new Set([...repeated, ...opened]);
    expect(furniture.has(normaliseForRepeat('CHAPTER 1'))).toBe(false);
    expect(furniture.has(normaliseForRepeat('CHAPTER 2'))).toBe(false);
    expect(furniture.has(normaliseForRepeat('CHAPTER 3'))).toBe(false);
    expect(furniture.has(normaliseForRepeat('UNDERSTANDING THE MIND 17'))).toBe(true);
  });

  it('tells a heading from the fragment of a display line OCR made out of one', () => {
    // A pull-quote set large across three printed lines reads as three rows, and each row is
    // short, capitalised and louder than the body — which is exactly what a heading looks like.
    // What gives it away is that it stops (or starts) mid-phrase.
    const heading = (text: string) => isHeading({ text, x0: 72, y: 0, height: 12 });
    for (const real of [
      'THE CONCEPT OF MIND MANAGEMENT',
      'BE FILLED WITH THE SPIRIT!',
      'UNDERSTANDING THE MIND',
      'A GOD-GIVEN INSTRUMENT',
      'THE POWER OF YOUR MIND',
      'YOUR MIND IS THE BATTLEFIELD',
      'HE WILL BRING YOU GOD’S PRESENCE',
      'INTRODUCTION',
      'DAY 2, 27TH MARCH 2026',
      'CHAPTER ONE',
      'PHASE 1: THE CALL',
      'RENEWING YOUR MIND',
      '“THINK ON THESE THINGS...”', // an ellipsis ends a title; a full stop ends a sentence
    ]) {
      expect(heading(real), `“${real}” should be a heading`).toBe(true);
    }
    for (const fragment of [
      'THE WAY TO', // ends on a preposition
      'IMPROVE, AND', // ends on a comma and a conjunction
      'RENEWING YOUR', // ends on a possessive
      'MIND: THE', // ends on an article
      'AND ONLY GOD’S', // starts on a conjunction
      'OF YOUR THOUGHTS.', // starts on a preposition
      'SPIRITUAL ENTITY,', // ends on a comma
      'WITH THE',
      'BUT BE YE TRANSFORMED BY THE',
      '— 7 CONCEPT OF MIND', // begins on a dash: the middle of a display line
      ', THAT CHALLENGES', // begins on a comma
      'REASON IT OUT.', // ends on a full stop, so it is a sentence
      'RIGHT THING..',
    ]) {
      expect(heading(fragment), `“${fragment}” is a fragment, not a heading`).toBe(false);
    }
  });

  it('structures a scanned book on what a heading says, not on how loudly it is printed', () => {
    // A scanned book sets pull-quotes in the same capitals as its chapter titles, and OCR gives no
    // type size to tell them apart — so only the structural words make a heading there.
    const scanned = (text: string) => isHeading({ text, x0: 0, y: 0, height: 0 }, { ocr: true });
    for (const chapter of ['CHAPTER ONE', 'CHAPTER 3: THINK ON THESE THINGS', 'INTRODUCTION', 'PART TWO', 'CONCLUSION', 'DAY 1 26TH MARCH, 2026']) {
      expect(scanned(chapter), `“${chapter}” should head a section`).toBe(true);
    }
    for (const display of ['GIVE THE BEST LIGHT', 'USE YOUR MIND', 'THE CARNAL', 'SEE IT FIRST', 'MENTAL WALLS']) {
      expect(scanned(display), `“${display}” is a pull-quote, not a chapter`).toBe(false);
    }
    // A typeset document still has geometry, so loud type is evidence there.
    const typeset = (text: string) => isHeading({ text, x0: 72, y: 0, height: 16 }, { bodyHeight: 12, indent: 72 });
    expect(typeset('GIVE THE BEST LIGHT')).toBe(true);
  });

  it('reads a running head as furniture even though it repeats per chapter, not per book', () => {
    // A 191-page book has chapters of twenty pages, so a whole-document repetition threshold lets
    // the running head through; opening three pages is what gives it away.
    const pages = [
      { number: 5, rows: [row('UNDERSTANDING THE MIND 17'), row('The mind is a spiritual entity, and only God can give it the best light.')] },
      { number: 6, rows: [row('UNDERSTANDING THE MIND 19'), row('It is the organ through which you receive the word of God.')] },
      { number: 7, rows: [row('UNDERSTANDING THE MIND 21'), row('Renew it daily and you will prove what is that good and perfect will of God.')] },
      { number: 8, rows: [row('A fresh line that opens a page once, and is therefore content.')] },
    ];
    const heads = openingLines(pages);
    expect(heads.has(normaliseForRepeat('UNDERSTANDING THE MIND 17'))).toBe(true);
    expect(heads.has(normaliseForRepeat('A fresh line that opens a page once, and is therefore content.'))).toBe(false);
  });

  it('drops a page that is mostly publishing furniture', () => {
    const rights = page([
      'First Printing 2016',
      'All rights reserved. No part of this book may be reproduced.',
      'Tel: +234-8023324188',
      'P.O. Box 13563, Ikeja, Lagos',
      'www.christembassy.org',
      'ISBN 978-978-51521-5-9',
    ]);
    const body = page([
      'The mind is the instrument through which you receive the word of God.',
      'Renewing it is not a once-in-a-lifetime event but a daily discipline.',
      'What you think about, you become; what you become, you do.',
      'Take hold of the thoughts you entertain and you take hold of your life.',
    ]);
    expect(isFrontMatterPage(rights)).toBe(true);
    expect(isFrontMatterPage(body)).toBe(false);

    const dropped = dropFurniturePages([rights, body]);
    expect(dropped.pages).toHaveLength(1);
    expect(dropped.pages[0]).toBe(body);
    expect(dropped.frontMatter).toBe(1);
  });

  it('drops a cover page of display-type fragments', () => {
    const cover = page(['Holy Spirit', 'Seven Things', 'Will Do', 'For You', 'Chris Oyakhilome']);
    expect(isCoverPage(cover)).toBe(true);
    const kept = dropFurniturePages([cover, page(['A sentence long enough to be prose, and then another.'])]);
    expect(kept.covers).toBe(1);
  });

  it('never treats a page of prose as a cover', () => {
    const prose = page([
      'The Holy Spirit is a person, not an influence.',
      'He speaks, He teaches, He intercedes for the saints.',
      'To yield to Him is to walk in the power of the age to come.',
    ]);
    expect(isCoverPage(prose)).toBe(false);
  });

  it('only looks for covers at the front of a document', () => {
    // A page of short fragments deep inside a book is a stanza or a pull-quote, not a cover.
    const fragment = page(['Amen', 'Hallelujah', 'Thank You Jesus']);
    const body = page(['The word of God is the seed of every miracle you will ever need.']);
    const pages = [...Array.from({ length: 5 }, () => body), fragment];
    const result = dropFurniturePages(pages);
    expect(result.covers).toBe(0);
    expect(result.pages).toHaveLength(6);
  });

  it('repairs the capital I that OCR reads as a pipe', () => {
    expect(tidyOcrLine('When | say we are a people of prophecy.')).toBe('When I say we are a people of prophecy.');
    expect(tidyOcrLine('| have highlighted seven blessings.')).toBe('I have highlighted seven blessings.');
    // A pipe inside a word or a table is left alone.
    expect(tidyOcrLine('Romans|John')).toBe('Romans|John');
  });

  it('reads a contents list OCR joined into one line as furniture, but not a list of scriptures', () => {
    const contents =
      "1. He Will Bring You God's Presence 9 2, He Will Teach You 15 3. He Will Bring You Ability 24 4. He Will Give You Rest 39 5. He Will Restore You 43";
    const study = 'Further study: 1. Romans 12 2. John 15 3. Acts 2 4. Hebrews 11';
    expect(isContentsBlob(contents)).toBe(true);
    // A contents list's page numbers ascend; a reading list's chapter numbers do not.
    expect(isContentsBlob(study)).toBe(false);
    expect(isFrontMatterLine(contents)).toBe(true);
    expect(isFrontMatterLine(study)).toBe(false);
  });

  it('gives the whole document back if every page looked like furniture', () => {
    // A heuristic that is wrong about one PDF must cost that PDF its front matter, not its body.
    const all = [page(['All rights reserved.', 'Tel: 123', 'P.O. Box 4', 'ISBN 5-6'])];
    const result = dropFurniturePages(all);
    expect(result.pages).toBe(all);
    expect(result.frontMatter).toBe(0);
  });
});
