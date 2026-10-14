import { describe, expect, it } from 'vitest';
import { getAllDevotionals } from '@/lib/content';
import { getResourceBySlug } from '@/lib/resources';
import {
  DEFAULT_RATE,
  LISTEN_WORDS_PER_MINUTE,
  MAX_CHUNK_CHARS,
  RATES,
  buildScript,
  chunkSection,
  devotionalScript,
  listeningMinutes,
  ordinalOf,
  pickVoice,
  resourceScript,
  slugifyId,
  sortedVoices,
  spokenDate,
  toSpeechText,
} from '@/lib/tts';


/**
 * Listening is a first-class way to read this site, so the script a speech engine is handed gets
 * the same scrutiny the printed page does: nothing speakable is dropped, nothing unspeakable
 * (markup, URLs, entities) survives, and the numbers on the button — "5 min listen" — are the same
 * numbers the player counts down from.
 */

const voice = (name: string, lang: string, localService = false, voiceURI = name): SpeechSynthesisVoice => ({
  name,
  lang,
  voiceURI,
  localService,
  default: false,
});

describe('listeningMinutes', () => {
  it('counts at speaking speed, not reading speed', () => {
    expect(LISTEN_WORDS_PER_MINUTE).toBe(150);
    expect(listeningMinutes(150)).toBe(1);
    expect(listeningMinutes(450)).toBe(3);
    // A 200-word article is a 1 minute read and a 2 minute listen — rounded up, never down.
    expect(listeningMinutes(200)).toBe(2);
  });

  it('rounds up so the player never says "0 minutes"', () => {
    expect(listeningMinutes(1)).toBe(1);
    expect(listeningMinutes(151)).toBe(2);
  });

  it('is honest about nothing to listen to', () => {
    expect(listeningMinutes(0)).toBe(0);
    expect(listeningMinutes(300, 0)).toBe(0);
  });

  it('halves at double speed, for every rate the player offers', () => {
    expect(listeningMinutes(600, 2)).toBe(2);
    expect(listeningMinutes(600, 1)).toBe(4);
    expect(listeningMinutes(600, 0.75)).toBe(6);
    for (const rate of RATES) expect(listeningMinutes(1_500, rate)).toBeGreaterThan(0);
    expect(DEFAULT_RATE).toBe(1);
  });
});

describe('toSpeechText', () => {
  it('reads the words of a link and never its address', () => {
    expect(toSpeechText('Read [the edition](https://example.com/october) now.')).toBe('Read the edition now.');
  });

  it('drops an image and a bare URL, which have nothing to say', () => {
    expect(toSpeechText('Before ![the cover](/cover.jpg) after')).toBe('Before after');
    expect(toSpeechText('See [](https://example.com) for more.')).toBe('See for more.');
  });

  it('removes layout: headings, quotes, rules, list markers and table pipes', () => {
    expect(toSpeechText('## Further Study')).toBe('Further Study');
    expect(toSpeechText('> Be still, and know.')).toBe('Be still, and know.');
    expect(toSpeechText('- first item\n- second item')).toBe('first item\nsecond item');
    const table = toSpeechText('| Romans 12 | John 3 |');
    expect(table).not.toContain('|');
    expect(table).toContain('Romans 12');
    expect(table).toContain('John 3');
  });

  it('removes emphasis without leaving the space the markers occupied', () => {
    expect(toSpeechText('This is **very** important.')).toBe('This is very important.');
    expect(toSpeechText('an *italic* word')).toBe('an italic word');
    expect(toSpeechText('~~struck~~ text')).toBe('struck text');
  });

  it('turns typography into pauses a speaker can make', () => {
    // An em dash is a breath, an ellipsis a full stop, curly quotes nothing at all.
    expect(toSpeechText('He said — and meant it — that God is able.')).toBe('He said, and meant it, that God is able.');
    expect(toSpeechText('Wait on the Lord…')).toBe('Wait on the Lord.');
    expect(toSpeechText('“The Lord is my shepherd”')).toBe('The Lord is my shepherd');
    expect(toSpeechText('it’s')).toBe("it's");
  });

  it('speaks entities as words', () => {
    expect(toSpeechText('God &amp; man')).toBe('God and man');
    expect(toSpeechText('1 &lt; 2 &gt; 0')).toBe('1 less than 2 greater than 0');
    expect(toSpeechText('it&#39;s &nbsp;fine')).toBe("it's fine");
  });

  it('does not stutter on the punctuation a PDF leaves behind', () => {
    expect(toSpeechText('He is able , indeed .')).toBe('He is able, indeed.');
    expect(toSpeechText('a  run   of    spaces')).toBe('a run of spaces');
  });

  it('leaves prose alone', () => {
    const prose = 'Your mind is the instrument through which you receive the word of God.';
    expect(toSpeechText(prose)).toBe(prose);
    expect(toSpeechText('')).toBe('');
  });
});

describe('chunkSection', () => {
  it('hands back short prose as one chunk', () => {
    expect(chunkSection('A short sentence.')).toEqual(['A short sentence.']);
    expect(chunkSection('')).toEqual([]);
    expect(chunkSection('   ')).toEqual([]);
  });

  it('cuts on sentences first', () => {
    const sentence = 'This is one sentence of about ten words. ';
    const text = sentence.repeat(80).trim();
    const chunks = chunkSection(text, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(200);
      expect(chunk.trim()).toBe(chunk);
      expect(chunk).toMatch(/\.$/);
    }
  });

  it('cuts a single long sentence on a comma, then a space, never mid-word', () => {
    const long = `${'a very long clause with no full stop, '.repeat(30)}and it ends here.`;
    const chunks = chunkSection(long, 120);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(120);
      // Every chunk starts and ends on a word boundary.
      expect(chunk).toMatch(/^\S/);
      expect(chunk).toMatch(/\S$/);
    }
    // Nothing is lost: the words come back in order.
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toContain('and it ends here.');
  });

  it('keeps every word of the section', () => {
    const words = Array.from({ length: 400 }, (_, index) => `word${index}`);
    const text = words.map((word, index) => (index % 7 === 6 ? `${word}.` : word)).join(' ');
    const rejoined = chunkSection(text, MAX_CHUNK_CHARS).join(' ').replace(/\s+/g, ' ');
    for (const word of words) expect(rejoined).toContain(word);
  });

  it('respects the limit a browser is known to enforce', () => {
    // Chrome stops speaking mid-utterance somewhere past 15 seconds, so the ceiling exists.
    expect(MAX_CHUNK_CHARS).toBeLessThanOrEqual(900);
  });
});

describe('buildScript', () => {
  it('drops parts that would be spoken as silence', () => {
    const script = buildScript({
      title: 'A Day',
      source: 'page',
      href: '/today',
      parts: [
        { id: 'one', label: 'One', text: 'Something to say.' },
        { id: 'two', label: 'Two', text: '![only an image](/a.jpg)' },
        { id: 'three', label: 'Three', text: '' },
      ],
    });
    expect(script.sections.map((section) => section.id)).toEqual(['one']);
    expect(script.source).toBe('page');
    expect(script.href).toBe('/today');
    expect(script.words).toBe(3);
    expect(script.minutes).toBe(1);
  });

  it('counts words and minutes across every section it kept', () => {
    const script = buildScript({
      title: 'Counting',
      source: 'devotional',
      href: '/devotionals/x',
      parts: [
        { id: 'a', label: 'A', text: 'one two three four five' },
        { id: 'b', label: 'B', text: 'six seven eight nine ten' },
      ],
    });
    expect(script.words).toBe(10);
    expect(script.minutes).toBe(1);
  });
});

describe('devotionalScript', () => {
  const post = getAllDevotionals()[0];

  it('reads a real devotional in the order the page prints it', () => {
    const script = devotionalScript(post);
    expect(script.source).toBe('devotional');
    expect(script.href).toBe(`/devotionals/${post.slug}`);
    expect(script.title).toBe(post.title);

    const ids = script.sections.map((section) => section.id);
    expect(ids[0]).toBe('title');
    expect(ids[ids.length - 1]).toBe('outro');
    expect(ids).toContain('prayer');
    if (post.scripture) expect(ids).toContain('scripture');
    // The scripture is read before the message, and the prayer after it.
    if (post.scripture) expect(ids.indexOf('scripture')).toBeLessThan(ids.indexOf('message-1'));
    expect(ids.indexOf('message-1')).toBeLessThan(ids.indexOf('prayer'));
  });

  it('gives the listener one section per paragraph, so they can step to the prayer', () => {
    const script = devotionalScript(post);
    const messageParts = script.sections.filter((section) => section.id.startsWith('message-'));
    expect(messageParts.length).toBe(post.message.length);
    // One paragraph is "The message"; more than one is numbered, so the player can say where it is.
    if (post.message.length > 1) expect(messageParts[0].label).toContain('part 1 of');
    else expect(messageParts[0].label).toBe('The message');
  });

  it('speaks nothing but prose: no markup, no URLs, no empty sections', () => {
    for (const candidate of getAllDevotionals().slice(0, 25)) {
      const script = devotionalScript(candidate);
      expect(script.sections.length).toBeGreaterThan(0);
      for (const section of script.sections) {
        expect(section.text.trim().length).toBeGreaterThan(0);
        expect(section.text).not.toMatch(/\*\*|^\s*#|\]\(http/);
        expect(section.label.length).toBeGreaterThan(0);
      }
      expect(script.words).toBeGreaterThan(0);
      expect(script.minutes).toBeGreaterThan(0);
      // The ids are the anchors the player scrolls to, so they must be unique and DOM-safe.
      const ids = script.sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('names the day in the opening, so an audio-only listener knows what they opened', () => {
    const script = devotionalScript(post);
    expect(script.sections[0].text).toContain(spokenDate(post.date));
    expect(script.subtitle).toBe(spokenDate(post.date));
  });
});

describe('resourceScript', () => {
  it('reads a book chapter by chapter, with the heading spoken first', () => {
    const book = getResourceBySlug('keeping-your-healing');
    expect(book).toBeTruthy();
    const script = resourceScript(book!);
    expect(script.source).toBe('resource');
    expect(script.href).toBe(`/resources/${book!.slug}`);
    expect(script.sections[0].id).toBe('title');
    expect(script.sections[0].text).toContain(book!.title);
    expect(script.sections[script.sections.length - 1].id).toBe('outro');
    expect(script.sections[script.sections.length - 1].text).toContain(book!.publisher);
    expect(script.words).toBeGreaterThan(100);
  });

  it('labels a long book by where the listener is in it', () => {
    const book = getResourceBySlug('now-you-want-to-marry');
    expect(book).toBeTruthy();
    const script = resourceScript(book!);
    const labelled = script.sections.filter((section) => section.label.includes('part'));
    expect(labelled.length).toBeGreaterThan(0);
    expect(labelled[0].label).toMatch(/part \d+ of \d+/);
  });

  it('keeps the whole book inside the chunk limit once a section is spoken', () => {
    const book = getResourceBySlug('now-you-want-to-marry')!;
    const script = resourceScript(book);
    for (const section of script.sections) {
      for (const chunk of chunkSection(section.text)) {
        expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
      }
    }
  });
});

describe('dates, ordinals and ids, spoken and linked', () => {
  it('says a date as a date', () => {
    expect(spokenDate('2026-10-12')).toBe('October 12th');
    expect(spokenDate('2026-01-01')).toBe('January 1st');
    expect(spokenDate('not-a-date')).toBe('not-a-date');
  });

  it('gets the teens right', () => {
    expect(ordinalOf(1)).toBe('1st');
    expect(ordinalOf(2)).toBe('2nd');
    expect(ordinalOf(3)).toBe('3rd');
    expect(ordinalOf(11)).toBe('11th');
    expect(ordinalOf(12)).toBe('12th');
    expect(ordinalOf(13)).toBe('13th');
    expect(ordinalOf(21)).toBe('21st');
    expect(ordinalOf(22)).toBe('22nd');
    expect(ordinalOf(31)).toBe('31st');
  });

  it('makes DOM-safe ids, and one for a label with nothing in it', () => {
    expect(slugifyId('Further Study')).toBe('further-study');
    expect(slugifyId('Part 3 of 8')).toBe('part-3-of-8');
    expect(slugifyId('  ')).toBe('section');
  });
});

describe('choosing a voice', () => {
  const voices = [
    voice('Google UK English Female', 'en-GB'),
    voice('Daniel', 'en-GB', true),
    voice('Samantha', 'en-US', true),
    voice('Amelie', 'fr-CA', true),
  ];

  it('honours the reader\'s own choice first', () => {
    expect(pickVoice(voices, 'Samantha')?.name).toBe('Samantha');
  });

  it('falls back to the site language, preferring a local voice', () => {
    expect(pickVoice(voices)?.name).toBe('Daniel');
    expect(pickVoice([voices[0]])?.name).toBe('Google UK English Female');
  });

  it('takes another English, then anything, rather than saying nothing', () => {
    expect(pickVoice([voices[2], voices[3]])?.name).toBe('Samantha');
    expect(pickVoice([voices[3]])?.name).toBe('Amelie');
  });

  it('returns nothing when the browser has not loaded its voices yet', () => {
    // `speechSynthesis.getVoices()` is empty until it has; the player asks again when it changes.
    expect(pickVoice([])).toBeUndefined();
  });

  it('offers the site language first, local voices before network ones, then by name', () => {
    expect(sortedVoices(voices).map((entry) => entry.name)).toEqual([
      'Daniel', // the site's language, and local
      'Samantha', // another English, and local
      'Google UK English Female', // the site's language, but fetched over the network
      'Amelie', // anything else, by name
    ]);
  });

  it('does not mutate the list it was given', () => {
    const given = [...voices];
    sortedVoices(given);
    expect(given.map((entry) => entry.name)).toEqual(voices.map((entry) => entry.name));
  });
});
