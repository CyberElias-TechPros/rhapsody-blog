import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getAllIssues,
  getAllSlugs,
  getIssue,
  getIssuesByYear,
  getKidsStats,
  getPage,
  getSummary,
  KIND_LABELS,
  SOURCE_NOTES,
  missingImages,
} from '@/lib/kids';
import {
  classifyPage,
  chooseText,
  dedupeRow,
  issueOfName,
  joinRow,
  KINDS,
  looksTruncated,
  MIN_LAYER_CHARS,
  MIN_OCR_CONFIDENCE,
  MIN_PUBLISH_CHARS,
  pageExcerpt,
  artworkLooksComplete,
  inkRatio,
  MIN_PAGE_INK,
  tidyLayer,
  tidyOcr,
} from '../scripts/extract-kids.mjs';

/**
 * The kids' edition. RORK is a magazine of pictures, so these tests are less about prose shape and
 * more about the two things that can silently lie: *which month* a file is, and *where a page's
 * words came from*. `tests/content.test.ts` covers the daily devotionals.
 */

describe('naming an issue', () => {
  it('reads the month and year out of filenames in every style the corpus uses', () => {
    expect(issueOfName('rork-april-2026.pdf')).toMatchObject({ year: 2026, month: '04', monthName: 'april' });
    // An underscore is a word character, so a `\b`-anchored year silently missed these two.
    expect(issueOfName('rork_june_2026.pdf')).toMatchObject({ month: '06' });
    expect(issueOfName('JULY 2026 RORK.pdf')).toMatchObject({ month: '07', year: 2026 });
    // The October file carries a two-digit year; it is still October 2026, not October of some other year.
    expect(issueOfName('rork-october-26.pdf')).toMatchObject({ month: '10', year: 2026, date: '2026-10-01' });
  });

  it('refuses to guess a month that is not there', () => {
    expect(issueOfName('rork.pdf')).toBeNull();
    expect(issueOfName('the-power-of-your-mind.pdf')).toBeNull();
    expect(issueOfName('rork-2026.pdf')).toBeNull();
  });
});

describe('the text layer of a double-drawn magazine', () => {
  it('collapses a row whose words are printed twice over', () => {
    expect(dedupeRow('SAY THIS SAY THIS')).toBe('SAY THIS');
    expect(dedupeRow('Holy Spirit lives in me. Holy Spirit lives in me.')).toBe('Holy Spirit lives in me.');
    // A real refrain repeated three times is a design choice, not the outline pass — leave it alone.
    expect(dedupeRow('God is good God is good God is good')).toBe('God is good God is good God is good');
    expect(dedupeRow('one two three')).toBe('one two three');
  });

  it('speaks a word once when two text frames overlap at the seam', () => {
    const joined = joinRow([
      { x: 10, text: 'So, Jesus told His disciples' },
      { x: 200, text: 'disciples about it.' },
    ]);
    expect(joined).toBe('So, Jesus told His disciples about it.');
  });

  it('drops the outline copy and the folio, and keeps a refrain that repeats later', () => {
    const lines = tidyLayer(['11', '11', 'Jesus is alive', 'Jesus is alive', 'but the crowd', 'Jesus is alive']);
    expect(lines).toEqual(['Jesus is alive', 'but the crowd', 'Jesus is alive']);
  });

  it('flags a line a clipped text frame cut mid-word', () => {
    expect(looksTruncated('TO RULE THE WORL')).toBe(true);
    expect(looksTruncated('Jesus wept.')).toBe(false);
  });
});

describe('choosing between the printed layer and OCR', () => {
  const longClean = 'x'.repeat(MIN_LAYER_CHARS + 50);

  it('uses OCR for a page the layer barely covers', () => {
    const choice = chooseText({ layer: 'SAY THIS\nJesus is alive; there fore,', ocr: { text: 'Jesus is alive; therefore, I am his friend.', confidence: 72 } });
    expect(choice.recovered).toBe('ocr');
    expect(choice.text).toContain('therefore,');
  });

  it('keeps a full text layer when OCR is only a guess', () => {
    const choice = chooseText({ layer: longClean, ocr: { text: 'noise noise noise', confidence: 40 } });
    expect(choice.recovered).toBe('text-layer');
    expect(choice.text).toBe(longClean);
  });

  it('throws away OCR below the confidence floor, rather than publishing texture', () => {
    const choice = chooseText({ layer: '', ocr: { text: 'some words here for sure', confidence: MIN_OCR_CONFIDENCE - 1 } });
    expect(choice).toMatchObject({ text: '', recovered: 'none', confidence: 0 });
  });

  it('has no text at all when neither source had any', () => {
    expect(chooseText({ layer: '', ocr: null })).toEqual({ text: '', recovered: 'none', confidence: 0 });
  });

  it('keeps only lines with real words out of an OCR read', () => {
    // Frames, rules and stray digits fall; a heading is real text and stays.
    expect(tidyOcr('| |\n\nTHE STORY\n\nword search puzzle\n~~~')).toBe('THE STORY\nword search puzzle');
    expect(tidyOcr('A  B\n1\nthe\n|——|')).toBe('');
  });
});

describe('page kinds', () => {
  it('classifies a page by the block it carries', () => {
    expect(classifyPage({ number: 1, pageCount: 50, text: 'whatever' })).toBe('cover');
    expect(classifyPage({ number: 7, pageCount: 50, text: '' })).toBe('artwork');
    expect(classifyPage({ number: 7, pageCount: 50, text: 'SAY THIS Jesus is alive' })).toBe('verse');
    expect(classifyPage({ number: 8, pageCount: 50, text: 'QUIZ TIME tick the box' })).toBe('activity');
    expect(classifyPage({ number: 9, pageCount: 50, text: 'CONTENTS the story on page 12' })).toBe('contents');
    expect(classifyPage({ number: 10, pageCount: 50, text: 'PRAY THIS dear lord' })).toBe('prayer');
    expect(classifyPage({ number: 11, pageCount: 50, text: 'Published monthly by Loveworld Publishing.' })).toBe('note');
    expect(classifyPage({ number: 12, pageCount: 50, text: 'And then the boy said: here is my lunch.' })).toBe('story');
    expect(classifyPage({ number: 13, pageCount: 50, text: 'Some words about nothing in particular' })).toBe('page');
  });

  it('labels every kind the extractor can emit — and nothing else', () => {
    expect(Object.keys(KIND_LABELS).sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) expect(KIND_LABELS[kind].length, kind).toBeGreaterThan(1);
  });

  it('has a note for every source a page can report', () => {
    expect(Object.keys(SOURCE_NOTES).sort()).toEqual(['none', 'ocr', 'text-layer']);
  });

  it('leads a card with a sentence, not the block label', () => {
    expect(pageExcerpt('SAY THIS\nJesus is alive; therefore, I have eternal life. Blessed be God!')).toBe(
      'Jesus is alive; therefore, I have eternal life.'
    );
    expect(pageExcerpt('')).toBeNull();
    expect(pageExcerpt('a'.repeat(400))!.length).toBeLessThanOrEqual(160);
  });
});

describe('judging a rendered page', () => {
  it('is not fooled by a page that came out as words on a white field', () => {
    expect(artworkLooksComplete([92, 74, 100, 81, 68])).toBe(true);
    expect(artworkLooksComplete([0, 3.5, 2.9, 6.1, 1])).toBe(false);
    expect(artworkLooksComplete([])).toBe(false);
  });

  it('takes the median, so one deliberate white page does not condemn an issue', () => {
    expect(artworkLooksComplete([2, 88, 91, 84, 79])).toBe(true);
    expect(artworkLooksComplete([90, 95, 12, 20, 8], MIN_PAGE_INK)).toBe(false);
  });

  it('measures a stored page image as a share of the page', async () => {
    const ink = await inkRatio(readFileSync(path.join(process.cwd(), 'public/kids/2026-04-kids/p12.jpg')));
    expect(ink).toBeGreaterThanOrEqual(0);
    expect(ink).toBeLessThanOrEqual(100);
  });
});

describe('the published issues', () => {
  const issues = getAllIssues();

  it('has one post per PDF, newest first', () => {
    expect(issues.length).toBeGreaterThanOrEqual(8);
    expect(new Set(issues.map((issue) => issue.slug)).size).toBe(issues.length);
    const dates = issues.map((issue) => issue.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(issues[0].slug).toBe(getAllSlugs()[0]);
  });

  it('dates an issue to the first of its month, and says so in its edition', () => {
    for (const issue of issues) {
      expect(issue.date.endsWith('-01'), issue.slug).toBe(true);
      expect(issue.edition, issue.slug).toBe(issue.slug);
      expect(issue.audience, issue.slug).toBe('kids');
      expect(issue.kind, issue.slug).toBe('magazine-issue');
      expect(issue.monthName, issue.slug).toBeTruthy();
      expect(issue.year, issue.slug).toBe(Number(issue.date.slice(0, 4)));
    }
  });

  it('numbers pages consecutively from the cover, with no gaps', () => {
    for (const issue of issues) {
      const numbers = issue.pages.map((page) => page.number);
      expect(numbers[0], issue.slug).toBe(1);
      expect(numbers, issue.slug).toEqual(numbers.slice().sort((a, b) => a - b));
      expect(new Set(numbers).size, issue.slug).toBe(numbers.length);
      expect(Math.max(...numbers) - Math.min(...numbers) + 1, issue.slug).toBe(numbers.length);
      expect(issue.pageCount, issue.slug).toBe(numbers.length);
    }
  });

  it('points every page at a file that exists', () => {
    expect(missingImages(process.cwd())).toEqual([]);
    const publicDir = path.join(process.cwd(), 'public');
    const page = issues[0].pages[3];
    expect(page.image.startsWith('/kids/'), page.image).toBe(true);
    expect(existsSync(path.join(publicDir, page.image))).toBe(true);
    // Small on purpose: the words are published as text, and the file itself opens full size.
    expect(readFileSync(path.join(publicDir, page.image)).length).toBeLessThan(150_000);
  });

  it('reads a whole page, not just its first line', () => {
    for (const issue of issues) {
      // A 50-page magazine cannot be all single-line pages; if the body parser stops at a newline,
      // this is what fails.
      expect(
        issue.pages.some((page) => page.text.includes('\n\n')),
        `${issue.slug} should carry a page with more than one paragraph`
      ).toBe(true);
    }
  });

  it('publishes a page as artwork rather than as a fragment of one', () => {
    for (const issue of issues) {
      for (const page of issue.pages) {
        if (page.recovered === 'none') {
          expect(page.text, `${issue.slug} p${page.number}`).toBe('');
        } else {
          // Anything published as text has some — and a page read off the artwork has enough of it to
          // be worth the guess. A printed page is published however short it is: a strapline is what
          // the page says.
          expect(page.text.trim().length, `${issue.slug} p${page.number}`).toBeGreaterThan(0);
          if (page.recovered === 'ocr') {
            expect(page.text.replace(/\s/g, '').length, `${issue.slug} p${page.number}`).toBeGreaterThanOrEqual(
              MIN_PUBLISH_CHARS
            );
          }
        }
        expect(['text-layer', 'ocr', 'none'], page.image ?? '').toContain(page.recovered);
      }
    }
  });

  it('says out loud when an issue lost its artwork to the renderer', () => {
    for (const issue of issues) {
      expect(typeof issue.artworkDecoded, issue.slug).toBe('boolean');
      if (issue.artworkDecoded === false) {
        // The caveat has to be in the prose a reader sees first, not buried behind 50 pages.
        expect(issue.intro, issue.slug).toMatch(/artwork/i);
      }
    }
    expect(issues.some((issue) => issue.artworkDecoded), 'issues whose pages rendered whole').toBe(true);
  });

  it('records where OCR was used, so the site can say it out loud', () => {
    const ocrPages = issues.reduce((sum, issue) => sum + issue.recognisedPages, 0);
    expect(ocrPages).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.recognisedPages, issue.slug).toBe(issue.pages.filter((page) => page.recovered === 'ocr').length);
      for (const page of issue.pages.filter((entry) => entry.recovered === 'ocr')) {
        expect(page.confidence ?? 0).toBeGreaterThanOrEqual(MIN_OCR_CONFIDENCE);
      }
      expect(issue.intro, issue.slug).toMatch(/OCR|recognis/i);
    }
  });

  it('keeps the colophon details the magazine printed', () => {
    const withIssn = issues.filter((issue) => issue.issn);
    expect(withIssn.length, 'issues that carry their ISSN').toBeGreaterThan(0);
    for (const issue of withIssn) expect(issue.issn).toMatch(/^\d{4}-\d{3}[\dX]$/);
  });

  it('exposes the reader helpers the routes use', () => {
    const issue = issues[0];
    expect(getIssue(issue.slug)).toBe(issue);
    expect(getIssue('2099-01-kids')).toBeUndefined();
    expect(getPage(issue, 1)!.number).toBe(1);
    // An out-of-range page anchor shows the cover rather than a 500.
    expect(getPage(issue, 4000)!.number).toBe(1);
    expect(getPage({ ...issue, pages: [] }, 1)).toBeUndefined();
    expect(getSummary(issue).slug).toBe(issue.slug);
    expect(getSummary(issue).cover).toBe(issue.pages[0].image);
    const years = getIssuesByYear();
    expect(years.reduce((sum, group) => sum + group.issues.length, 0)).toBe(issues.length);
    expect(years[0].year).toBeGreaterThanOrEqual(years.at(-1)!.year);
  });

  it('counts what it published for the index and the about page', () => {
    const stats = getKidsStats();
    expect(stats.issues).toBe(issues.length);
    expect(stats.pages).toBe(issues.reduce((sum, issue) => sum + issue.pageCount, 0));
    expect(stats.recognised).toBeGreaterThan(0);
    expect(stats.words).toBeGreaterThan(1000);
    expect(stats.meanConfidence).toBeGreaterThanOrEqual(MIN_OCR_CONFIDENCE);
    expect(stats.textless).toBeLessThan(stats.pages);
    expect(stats.firstDate < stats.lastDate || issues.length === 1).toBe(true);
  });

  it('writes the body as one section per page, so the reader and the file cannot disagree', () => {
    const issue = issues[0];
    const raw = readFileSync(path.join(process.cwd(), 'content', 'kids', `${issue.slug}.md`), 'utf8');
    for (const page of issue.pages) {
      const heading = `## Page ${page.number}\n`;
      expect(raw.includes(heading), `${issue.slug} missing ${heading.trim()}`).toBe(true);
      if (page.text) expect(raw).toContain(page.text.slice(0, 40));
    }
    expect(raw.match(/^## Page \d+$/gm)!.length).toBe(issue.pages.length);
  });
});
