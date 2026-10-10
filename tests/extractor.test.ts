import { describe, expect, it } from 'vitest';
import {
  AUDIENCES as PUBLISHER_AUDIENCES,
  AUDIENCE_ORDER as PUBLISHER_ORDER,
  capNeedsSpace,
  makeExcerpt,
  slugify,
  toTitleCase,
} from '../scripts/extract-devotionals.mjs';
import { AUDIENCES, AUDIENCE_ORDER } from '@/lib/audiences';

describe('toTitleCase', () => {
  it('lower-cases articles, conjunctions and short prepositions mid-title', () => {
    expect(toTitleCase('THE NAME THAT RULES HEAVEN AND EARTH')).toBe('The Name That Rules Heaven and Earth');
    expect(toTitleCase('FULFIL YOUR PURPOSE TO HIS GLORY')).toBe('Fulfil Your Purpose to His Glory');
    expect(toTitleCase('BORN OF THE WORD AND THE SPIRIT')).toBe('Born of the Word and the Spirit');
  });

  it('capitalises the first and last word even when they are small words', () => {
    expect(toTitleCase('THE ETERNAL ELIXIR')).toBe('The Eternal Elixir');
    expect(toTitleCase('WHAT IT MEANS TO GIVE YOUR LIFE TO CHRIST')).toBe('What It Means to Give Your Life to Christ');
    expect(toTitleCase('RUN TOWARDS THE MARK')).toBe('Run towards the Mark');
  });

  it('handles contractions without capitalising after the apostrophe', () => {
    expect(toTitleCase("DON'T LIMIT GOD'S GRACE")).toBe("Don't Limit God's Grace");
    expect(toTitleCase('WE’RE REPLETE WITH HIM')).toBe('We’re Replete with Him');
    expect(toTitleCase("YOU'RE ALREADY DEAD TO SIN")).toBe("You're Already Dead to Sin");
  });

  it('capitalises after dashes, which the printed headlines use freely', () => {
    expect(toTitleCase('SIN-FREE AND DEATH-FREE')).toBe('Sin-Free and Death-Free');
    expect(toTitleCase('THE HOLY SPIRIT—GOD’S FINAL SOLUTION')).toBe('The Holy Spirit—God’s Final Solution');
    expect(toTitleCase('THE WORD—YOUR TRUE LIFE AND ENVIRONMENT')).toBe('The Word—Your True Life and Environment');
  });

  it('keeps trailing punctuation', () => {
    expect(toTitleCase('WHICH COMPANY WOULD YOU RATHER KEEP?')).toBe('Which Company Would You Rather Keep?');
    expect(toTitleCase('THE JEWS, THE GENTILES, AND THE CHURCH')).toBe('The Jews, the Gentiles, and the Church');
  });
});

describe('slugify', () => {
  it('drops apostrophes instead of turning them into word breaks', () => {
    expect(slugify("You've Obtained Mercy")).toBe('youve-obtained-mercy');
    expect(slugify("You're Already Dead to Sin")).toBe('youre-already-dead-to-sin');
    expect(slugify("Borne on Eagles' Wings")).toBe('borne-on-eagles-wings');
  });

  it('collapses punctuation and trims dashes', () => {
    expect(slugify('The Holy Spirit—God’s Final Solution')).toBe('the-holy-spirit-gods-final-solution');
    expect(slugify('The Jews, the Gentiles, and the Church')).toBe('the-jews-the-gentiles-and-the-church');
    expect(slugify('  Weird   spacing!  ')).toBe('weird-spacing');
  });

  it('respects the max length without ending on a dash', () => {
    expect(slugify('a-very-long-title-that-goes-on', 12)).toBe('a-very-long');
  });
});

describe('makeExcerpt', () => {
  const paragraphs = [
    'Some Christians have been taught to "die to sin." As a result, they are constantly struggling, praying, and striving to overcome sin, hoping that one day they will finally attain victory.',
    'But that is not what the Scriptures teach.',
  ];

  it('does not split a sentence at a full stop inside quotation marks', () => {
    const excerpt = makeExcerpt(paragraphs);
    expect(excerpt.startsWith('Some Christians have been taught to "die to sin."')).toBe(true);
    expect(excerpt.startsWith('"')).toBe(false);
  });

  it('stops on a sentence boundary rather than mid-sentence', () => {
    const excerpt = makeExcerpt(
      ['First sentence here. Second sentence here. Third sentence is much longer than the rest.'],
      45
    );
    // The third sentence would overflow the card, so it is dropped whole; the excerpt already
    // ends on a full stop, so no ellipsis is needed.
    expect(excerpt).toBe('First sentence here. Second sentence here.');
  });

  it('leaves no ellipsis when the excerpt already ends on a complete sentence', () => {
    // Dropping trailing whole sentences reads cleanly, so no "…" is added — the ellipsis only
    // marks a genuine mid-sentence cut (see the hard-truncation case above).
    expect(makeExcerpt(['One sentence. Two sentence. Three'], 30)).toBe('One sentence. Two sentence.');
  });

  it('joins paragraphs with a space for the card excerpt', () => {
    expect(makeExcerpt(['First paragraph.', 'Second paragraph.'], 190)).toBe('First paragraph. Second paragraph.');
  });

  it('hard-truncates at a word boundary when the first sentence alone is too long', () => {
    const long = 'One enormously long opening sentence that keeps going and going well past any reasonable card limit for a list view.';
    const excerpt = makeExcerpt([long], 40);
    expect(excerpt.length).toBeLessThanOrEqual(41);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt).not.toMatch(/\s…$/);
  });

  it('keeps a complete final sentence without an ellipsis', () => {
    expect(makeExcerpt(['Short and complete.'], 190)).toBe('Short and complete.');
  });

  it('returns an empty string for empty input', () => {
    expect(makeExcerpt([])).toBe('');
  });
});

describe('capNeedsSpace', () => {
  it('only I, A and O can stand alone as words', () => {
    expect(capNeedsSpace('W', 'hen the Lord Jesus declared')).toBe(false);
    expect(capNeedsSpace('T', 'he life Christ has given us')).toBe(false);
    expect(capNeedsSpace('S', 'ome Christians confidently say')).toBe(false);
  });

  it('adds a space when the following text is a whole word (the pronoun "I")', () => {
    expect(capNeedsSpace('I', 'once watched a television interview')).toBe(true);
    expect(capNeedsSpace('A', 'man stood up')).toBe(true);
  });

  it('joins directly when the cap completes the word', () => {
    expect(capNeedsSpace('I', 'n our previous study')).toBe(false);
    expect(capNeedsSpace('A', 's a result')).toBe(false);
    expect(capNeedsSpace('I', 't means you are God’s handcraft')).toBe(false);
  });
});


describe('the two audience tables', () => {
  /**
   * The extractor parses PDFs and cannot import from the app (pdf.js would ride into the bundle),
   * so `lib/audiences.ts` restates the same table. This is the drift guard: labels, series names and
   * the edition suffix all reach readers' URLs and front matter, and a mismatch writes posts the app
   * cannot group.
   */
  it('agree on every audience the app publishes', () => {
    // The extractor also recognises the kids edition, purely to say why it is skipped.
    expect(PUBLISHER_ORDER).toEqual([...AUDIENCE_ORDER, 'kids']);

    for (const id of AUDIENCE_ORDER) {
      const app = AUDIENCES[id];
      const script = PUBLISHER_AUDIENCES[id];
      expect(script.key, id).toBe(id);
      expect(script.label, id).toBe(app.label);
      expect(script.shortLabel, id).toBe(app.shortLabel);
      expect(script.series, id).toBe(app.series);
      expect(script.editionSuffix, id).toBe(app.editionSuffix);
      // The blurbs are allowed to differ — the app's is UI copy, the script's is a comment — but the
      // tag that lands in every post's front matter is the series name, slugified, on both sides.
      expect(script.tag, id).toBe(slugify(app.series, 60));
      // The script builds slugs from a bare token, the app from the same token with its dash.
      expect(script.slugToken ?? '', id).toBe(app.slugToken.replace(/^-/, ''));
      expect(app.slugToken, id).toBe(app.editionSuffix);
    }
  });
});
