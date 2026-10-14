/**
 * Turning a written article into something that can be read aloud.
 *
 * Two halves live here, both isomorphic (no `node:` imports) so the server can build the script
 * while rendering and the client can play it without a round trip:
 *
 * 1. `toSpeechText` / `chunkSection` — Markdown and typography are for the eye. A speech engine
 *    reads `**bold**` as "asterisk asterisk bold", chokes on an em dash, and — in Chrome — stops
 *    speaking altogether somewhere around fifteen seconds into a single utterance. So the text is
 *    flattened to plain prose and cut into sentence-bounded chunks short enough to be safe.
 * 2. `buildScript` / `devotionalScript` — the *order* a day is read aloud in, as labelled
 *    sections: title, opening scripture, the message a paragraph at a time, the prayer, further
 *    study, the reading plans, and a short outro. Sections are what the player shows, steps
 *    through and remembers, so a listener can jump to the prayer without scrubbing.
 *
 * Playback itself is in `components/audio/AudioProvider.tsx`: the browser's own speech synthesis
 * by default (no keys, no cost, works offline), or a studio voice from `app/api/tts/route.ts`
 * when `NEXT_PUBLIC_TTS_PROVIDER` is configured.
 */

import type { Devotional, Resource } from './types';

/** Where a script came from — the player links back to it and labels it. */
export type SpokenSource = 'devotional' | 'resource' | 'kids' | 'page';

export interface SpokenSection {
  /** Stable within a script; also the `data-tts` anchor a page can scroll to. */
  id: string;
  /** "Opening scripture", "Prayer", "Part 3 of 8" — what the player shows while it is read. */
  label: string;
  /** Plain prose, ready for a speech engine. Never empty. */
  text: string;
}

export interface SpokenScript {
  title: string;
  subtitle?: string;
  source: SpokenSource;
  /** Canonical path of what is being read, so playback survives navigation and can be resumed. */
  href: string;
  sections: SpokenSection[];
  words: number;
  /** Minutes at `DEFAULT_RATE`, rounded up — "a 4 minute listen". */
  minutes: number;
}

/**
 * Speech engines read at roughly 150 words a minute at rate 1.0; print is usually estimated at
 * 200. Keeping the two numbers apart means the "4 min read" on the card and the "5 min listen"
 * in the player are each honest about their own medium.
 */
export const LISTEN_WORDS_PER_MINUTE = 150;

/** The rate the player starts at, and the one `minutes` is computed for. */
export const DEFAULT_RATE = 1;

export const RATES = [0.75, 1, 1.25, 1.5, 2] as const;

/**
 * Longest chunk handed to a single utterance. Chrome and Safari stop speaking mid-utterance on
 * some platforms once it runs past about fifteen seconds; ~900 characters is around a minute and
 * is cut on sentence boundaries, so the pause between chunks is not noticeable.
 */
export const MAX_CHUNK_CHARS = 900;

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function listeningMinutes(words: number, rate: number = DEFAULT_RATE): number {
  if (!words || !rate) return 0;
  return Math.max(1, Math.ceil(words / (LISTEN_WORDS_PER_MINUTE * rate)));
}

/** HTML entities the extractor and Markdown leave behind, spoken as words rather than codes. */
const ENTITIES: Record<string, string> = {
  '&amp;': 'and',
  '&lt;': 'less than',
  '&gt;': 'greater than',
  '&quot;': '',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': ', ',
  '&ndash;': ' to ',
  '&rsquo;': "'",
  '&lsquo;': "'",
  '&ldquo;': '',
  '&rdquo;': '',
  '&hellip;': '. ',
};

/**
 * Markdown → prose for a speech engine.
 *
 * The order matters: links have to lose their URL before the URL's punctuation is stripped, and
 * emphasis markers have to go before words are joined, or `**word**` leaves a stray space where
 * the asterisks were.
 */
export function toSpeechText(input: string): string {
  if (!input) return '';
  let text = String(input);

  // Fenced code and inline code: a devotional has none, but a resource might quote one, and
  // reading backticks aloud is worse than dropping them.
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/`([^`]*)`/g, '$1');

  // Images carry nothing speakable; links keep their words and lose the address.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  text = text.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, label: string, href: string) => {
    const words = String(label).trim();
    if (words) return words;
    // A bare link ("read more at …") has no label; the URL is noise, so drop it entirely.
    return String(href).startsWith('http') ? ' ' : String(href);
  });

  // Headings, quotes, rules and table pipes are layout, not language.
  text = text.replace(/^\s{0,3}#{1,6}\s*/gm, '');
  text = text.replace(/^\s{0,3}>\s?/gm, '');
  text = text.replace(/^\s{0,3}([-*_])\s*\1\s*\1[\s\S]*$/gm, ' ');
  text = text.replace(/^\s*\|.*\|\s*$/gm, (row) => row.replace(/\|/g, ', '));
  text = text.replace(/^ {0,3}(?:[-*+]|\d+[.)])\s+/gm, '');

  // Emphasis and strikes.
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');

  // Typography: an em dash is a pause, an ellipsis a full stop, curly quotes nothing at all.
  text = text.replace(/[—–]/g, ', ');
  text = text.replace(/…/g, '. ');
  text = text.replace(/[“”„‟]/g, '');
  text = text.replace(/[‘’]/g, "'");

  // Entities last, so `&amp;` is not mistaken for markup while it still has its semicolon.
  for (const [entity, replacement] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(replacement);
  }
  text = text.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));

  return text
    // A comma before a full stop reads as a stutter; so does a space inside a word left behind
    // by a kerning split in the source PDF ("he alth"), which cannot be repaired here safely.
    .replace(/\s+,/g, ',')
    .replace(/,+\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

/**
 * Cut prose into chunks a speech engine will finish. Sentences first, then clauses, then a hard
 * cut — in that order of preference, so a chunk never ends mid-word unless a single sentence is
 * longer than the limit (which happens with a long scripture quotation, and is still fine).
 */
export function chunkSection(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  const source = text.trim();
  if (!source) return [];
  if (source.length <= maxChars) return [source];

  const sentences = source.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [source];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if (!current) {
      current = trimmed;
      continue;
    }
    if (current.length + trimmed.length + 1 <= maxChars) {
      current = `${current} ${trimmed}`;
      continue;
    }
    chunks.push(current);
    current = trimmed;
  }
  if (current) chunks.push(current);

  // A single sentence longer than the limit still has to be spoken: cut it on a comma, and only
  // then on a space, so the engine is never handed a fragment of a word.
  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxChars) return [chunk];
    const parts: string[] = [];
    let rest = chunk;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(',', maxChars);
      if (cut < maxChars * 0.5) cut = rest.lastIndexOf(' ', maxChars);
      if (cut <= 0) cut = maxChars;
      parts.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    return parts;
  });
}

/** Everything `buildScript` needs; sections are flattened, cleaned and measured here. */
export interface ScriptInput {
  title: string;
  subtitle?: string;
  source: SpokenSource;
  href: string;
  /** Label + raw (possibly Markdown) text. Empty parts are dropped, not spoken as silence. */
  parts: { id: string; label: string; text: string }[];
}

export function buildScript(input: ScriptInput): SpokenScript {
  const sections: SpokenSection[] = [];
  for (const part of input.parts) {
    const text = toSpeechText(part.text);
    if (!text) continue;
    sections.push({ id: part.id, label: part.label, text });
  }

  const words = sections.reduce((sum, section) => sum + countWords(section.text), 0);
  return {
    title: toSpeechText(input.title) || input.title,
    subtitle: input.subtitle,
    source: input.source,
    href: input.href,
    sections,
    words,
    minutes: listeningMinutes(words),
  };
}

/**
 * A daily devotional, read aloud in the order the page prints it.
 *
 * The message is one section per paragraph rather than one long section: a listener who wants the
 * prayer can step there, and the player can say "part 4 of 9" instead of showing a bare progress
 * bar for a wall of text.
 */
export function devotionalScript(post: Devotional): SpokenScript {
  const parts: ScriptInput['parts'] = [
    {
      id: 'title',
      label: 'Title',
      text: `${post.title}. The devotional for ${spokenDate(post.date)}.`,
    },
  ];

  if (post.scripture) {
    parts.push({
      id: 'scripture',
      label: 'Opening scripture',
      text: post.scriptureReference
        ? `Opening scripture. ${post.scripture} ${post.scriptureReference}.`
        : `Opening scripture. ${post.scripture}`,
    });
  }

  post.message.forEach((paragraph, index) => {
    parts.push({
      id: `message-${index + 1}`,
      label: post.message.length > 1 ? `The message, part ${index + 1} of ${post.message.length}` : 'The message',
      text: paragraph,
    });
  });

  for (const section of post.extras) {
    parts.push({ id: `extra-${slugifyId(section.label)}`, label: section.label, text: section.text });
  }

  if (post.prayer) {
    parts.push({ id: 'prayer', label: post.prayerLabel, text: `${post.prayerLabel}. ${post.prayer}` });
  }

  if (post.furtherStudy) {
    parts.push({ id: 'further-study', label: 'Further study', text: `Further study. ${post.furtherStudy}` });
  }

  if (post.oneYearPlan || post.twoYearPlan) {
    const plans = [
      post.oneYearPlan ? `The one year Bible reading plan: ${post.oneYearPlan}.` : '',
      post.twoYearPlan ? `The two year Bible reading plan: ${post.twoYearPlan}.` : '',
    ].filter(Boolean);
    parts.push({ id: 'reading-plans', label: 'Bible reading plans', text: plans.join(' ') });
  }

  parts.push({
    id: 'outro',
    label: 'Closing',
    text: `That was ${post.title}, from the ${post.editionTitle} edition of ${post.series}.`,
  });

  return buildScript({
    title: post.title,
    subtitle: spokenDate(post.date),
    source: 'devotional',
    href: `/devotionals/${post.slug}`,
    parts,
  });
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "the twelfth of October" — a date spoken as a date, not as "2026 dash 10 dash 12". */
export function spokenDate(dateIso: string): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  if (!year || !month || !day) return dateIso;
  const monthName = MONTHS[month - 1] ?? '';
  const ordinal = ordinalOf(day);
  return `${monthName} ${ordinal}`;
}

export function ordinalOf(n: number): string {
  const teen = n % 100;
  if (teen >= 11 && teen <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** A DOM-safe, speech-script-stable id from a section label ("Further Study" → "further-study"). */
export function slugifyId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

/**
 * Which voice to read in. Prefers the reader's own choice, then any voice for the site's
 * language, then whatever the browser offers first. `voices` comes from
 * `speechSynthesis.getVoices()`, which is empty until the browser has loaded them — callers pass
 * the list again when it changes.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredUri?: string | null,
  lang = 'en-GB'
): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  if (preferredUri) {
    const chosen = voices.find((voice) => voice.voiceURI === preferredUri);
    if (chosen) return chosen;
  }
  const sameLang = (voice: SpeechSynthesisVoice) => voice.lang?.toLowerCase().replace('_', '-') === lang.toLowerCase();
  const base = lang.split('-')[0].toLowerCase();
  const sameBase = (voice: SpeechSynthesisVoice) => voice.lang?.toLowerCase().startsWith(base);
  // A local voice is slightly more reliable than a network one, so prefer it among equals.
  return voices.find((voice) => sameLang(voice) && voice.localService)
    ?? voices.find(sameLang)
    ?? voices.find((voice) => sameBase(voice) && voice.localService)
    ?? voices.find(sameBase)
    ?? voices[0];
}

/** Voices worth offering, best first: the site's language, then everything else by name. */
export function sortedVoices(voices: SpeechSynthesisVoice[], lang = 'en-GB'): SpeechSynthesisVoice[] {
  const base = lang.split('-')[0].toLowerCase();
  const matches = (voice: SpeechSynthesisVoice) => voice.lang?.toLowerCase().startsWith(base);
  return [...voices].sort((a, b) => {
    if (matches(a) !== matches(b)) return matches(a) ? -1 : 1;
    if (a.localService !== b.localService) return a.localService ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * A resource — a book, a study, a set of programme notes — read aloud.
 *
 * One section per paragraph, labelled with the chapter or day it sits under, so a listener can
 * step to "Day 3" of a fasting programme without scrubbing, and the player can say where in a
 * 300-page book they are. The heading is spoken as the first words of its own section rather than
 * as a section of its own, which is how a reader would say it.
 */
export function resourceScript(resource: Resource): SpokenScript {
  const parts: ScriptInput['parts'] = [
    {
      id: 'title',
      label: 'Title',
      text: [resource.title, resource.subtitle, `By ${resource.author}.`].filter(Boolean).join('. ') + '.',
    },
  ];

  resource.sections.forEach((section) => {
    const label = section.heading || 'Reading';
    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      const first = paragraphIndex === 0 && section.heading;
      parts.push({
        id: `${section.id}-${paragraphIndex + 1}`,
        label: resource.sections.length > 1 ? `${label} — part ${paragraphIndex + 1} of ${section.paragraphs.length}` : label,
        text: first ? `${section.heading}. ${paragraph}` : paragraph,
      });
    });
    // A section with a heading and no paragraphs (a part title) is still announced.
    if (section.heading && !section.paragraphs.length) {
      parts.push({ id: `${section.id}-heading`, label, text: section.heading });
    }
  });

  parts.push({
    id: 'outro',
    label: 'Closing',
    text: `That was ${resource.title}, by ${resource.author}. Published by ${resource.publisher}.`,
  });

  return buildScript({
    title: resource.title,
    subtitle: resource.dateNote || (resource.year ? String(resource.year) : undefined),
    source: 'resource',
    href: `/resources/${resource.slug}`,
    parts,
  });
}
