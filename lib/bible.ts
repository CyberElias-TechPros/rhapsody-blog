/**
 * The 66 books of the Bible, and the two things the site does with them:
 *
 * 1. **Group devotionals by the book their opening scripture comes from** — `/bible/romans`
 *    lists every day that opens in Romans. Readers ask for exactly this ("Rhapsody of Realities
 *    on the Holy Spirit", "devotionals from Romans"), and it is a second, scripture-shaped way
 *    into an archive that is otherwise only browsable by date.
 * 2. **Turn references into links** — "Romans 5:17; 2 Corinthians 5:21" in a further-study line
 *    or "1 Kings 9" in a reading plan becomes a tap through to the passage, in the reader's
 *    preferred translation.
 *
 * Pure and isomorphic (no `node:` imports), so client components can use it. Book names are
 * matched case-sensitively and only when followed by a chapter number, which keeps ordinary
 * words — "acts", "numbers", "job", "mark" — from being mistaken for books. No regex lookbehind:
 * older iOS Safari throws on it at parse time, which would take the whole page down.
 */

export type Testament = 'old' | 'new';

export interface BibleBook {
  name: string;
  slug: string;
  testament: Testament;
  /** 1-based canonical order (Genesis = 1, Revelation = 66). */
  order: number;
  /** Other spellings seen in print ("Psalm", "Song of Songs", "Revelations"). */
  aliases: string[];
}

const BOOKS: Array<[name: string, testament: Testament, aliases?: string[]]> = [
  ['Genesis', 'old'],
  ['Exodus', 'old'],
  ['Leviticus', 'old'],
  ['Numbers', 'old'],
  ['Deuteronomy', 'old'],
  ['Joshua', 'old'],
  ['Judges', 'old'],
  ['Ruth', 'old'],
  ['1 Samuel', 'old', ['I Samuel', 'First Samuel']],
  ['2 Samuel', 'old', ['II Samuel', 'Second Samuel']],
  ['1 Kings', 'old', ['I Kings', 'First Kings']],
  ['2 Kings', 'old', ['II Kings', 'Second Kings']],
  ['1 Chronicles', 'old', ['I Chronicles', 'First Chronicles']],
  ['2 Chronicles', 'old', ['II Chronicles', 'Second Chronicles']],
  ['Ezra', 'old'],
  ['Nehemiah', 'old'],
  ['Esther', 'old'],
  ['Job', 'old'],
  ['Psalms', 'old', ['Psalm', 'Ps']],
  ['Proverbs', 'old', ['Proverb', 'Prov']],
  ['Ecclesiastes', 'old', ['Eccl']],
  ['Song of Solomon', 'old', ['Song of Songs', 'Songs of Solomon', 'Song of Sol']],
  ['Isaiah', 'old', ['Isa']],
  ['Jeremiah', 'old', ['Jer']],
  ['Lamentations', 'old'],
  ['Ezekiel', 'old', ['Ezek']],
  ['Daniel', 'old'],
  ['Hosea', 'old'],
  ['Joel', 'old'],
  ['Amos', 'old'],
  ['Obadiah', 'old'],
  ['Jonah', 'old'],
  ['Micah', 'old'],
  ['Nahum', 'old'],
  ['Habakkuk', 'old'],
  ['Zephaniah', 'old'],
  ['Haggai', 'old'],
  ['Zechariah', 'old'],
  ['Malachi', 'old'],
  ['Matthew', 'new', ['Matt']],
  ['Mark', 'new'],
  ['Luke', 'new'],
  ['John', 'new'],
  ['Acts', 'new', ['Acts of the Apostles']],
  ['Romans', 'new', ['Rom']],
  ['1 Corinthians', 'new', ['I Corinthians', 'First Corinthians', '1 Cor']],
  ['2 Corinthians', 'new', ['II Corinthians', 'Second Corinthians', '2 Cor']],
  ['Galatians', 'new', ['Gal']],
  ['Ephesians', 'new', ['Eph']],
  ['Philippians', 'new', ['Phil']],
  ['Colossians', 'new', ['Col']],
  ['1 Thessalonians', 'new', ['I Thessalonians', 'First Thessalonians']],
  ['2 Thessalonians', 'new', ['II Thessalonians', 'Second Thessalonians']],
  ['1 Timothy', 'new', ['I Timothy', 'First Timothy']],
  ['2 Timothy', 'new', ['II Timothy', 'Second Timothy']],
  ['Titus', 'new'],
  ['Philemon', 'new'],
  ['Hebrews', 'new', ['Heb']],
  ['James', 'new'],
  ['1 Peter', 'new', ['I Peter', 'First Peter']],
  ['2 Peter', 'new', ['II Peter', 'Second Peter']],
  ['1 John', 'new', ['I John', 'First John']],
  ['2 John', 'new', ['II John', 'Second John']],
  ['3 John', 'new', ['III John', 'Third John']],
  ['Jude', 'new'],
  ['Revelation', 'new', ['Revelations', 'Rev']],
];

export function bookSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const BIBLE_BOOKS: BibleBook[] = BOOKS.map(([name, testament, aliases = []], index) => ({
  name,
  slug: bookSlug(name),
  testament,
  order: index + 1,
  aliases,
}));

const BY_NAME = new Map<string, BibleBook>();
const BY_SLUG = new Map<string, BibleBook>();
for (const book of BIBLE_BOOKS) {
  BY_SLUG.set(book.slug, book);
  for (const spelling of [book.name, ...book.aliases]) BY_NAME.set(spelling.toLowerCase(), book);
}

export function getBookBySlug(slug: string): BibleBook | undefined {
  return BY_SLUG.get(slug);
}

/** A book by any of its spellings, case-insensitively ("psalm" → Psalms). */
export function findBook(name: string): BibleBook | undefined {
  return BY_NAME.get(name.trim().replace(/\s+/g, ' ').toLowerCase());
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Longest spelling first, so "1 John" wins over "John" and "Song of Songs" over "Song". */
const SPELLINGS = [...BY_NAME.keys()]
  .map((lower) => {
    const book = BY_NAME.get(lower)!;
    return [book.name, ...book.aliases].find((spelling) => spelling.toLowerCase() === lower)!;
  })
  .sort((a, b) => b.length - a.length);

const BOOK_PATTERN = SPELLINGS.map((spelling) => escapeRegExp(spelling).replace(/ /g, '\\s+')).join('|');

/** Translations a reference may name after itself ("Romans 8:26 NKJV"). */
export const BIBLE_VERSIONS = ['KJV', 'NKJV', 'AMP', 'AMPC', 'NIV', 'NLT', 'ESV', 'NASB', 'MSG', 'CEV', 'GNT', 'TLB', 'NRSV', 'RSV', 'WEB', 'TPT', 'CSB', 'BSB'] as const;
export type BibleVersion = (typeof BIBLE_VERSIONS)[number];

/** What a reader can choose as their default in reading settings (the common ones). */
export const PREFERRED_VERSIONS: BibleVersion[] = ['KJV', 'NKJV', 'AMP', 'AMPC', 'NIV', 'NLT', 'ESV', 'MSG'];

/** Most references in the edition are quoted from the King James Version unless marked otherwise. */
export const DEFAULT_BIBLE_VERSION: BibleVersion = 'KJV';

export function isBibleVersion(value: unknown): value is BibleVersion {
  return typeof value === 'string' && (BIBLE_VERSIONS as readonly string[]).includes(value);
}

const VERSION_PATTERN = BIBLE_VERSIONS.join('|');

/**
 * A reference: book, chapter, optional verse, optional ranges (`2:19-3:11`, `61-63`, `5:1-28`),
 * optional comma-joined verses (`3:16,18`) and an optional translation. Group 1 is the character
 * before the book (or the empty start of the string) — the lookbehind-free word boundary.
 */
function referenceRegExp(): RegExp {
  return new RegExp(
    // The comma branch takes a bare verse ("3:16, 18") but never a number that starts the next
    // reference — in "Isaiah 61-63, 1 Kings 9" the "1" belongs to Kings, hence the lookahead.
    `(^|[^A-Za-z0-9])(${BOOK_PATTERN})\\s+(\\d{1,3})((?::\\d{1,3})?(?:\\s*[-–]\\s*\\d{1,3}(?::\\d{1,3})?)*(?:,\\s?\\d{1,3}(?!\\s*[:\\dA-Za-z])(?:\\s*[-–]\\s*\\d{1,3})?)*)(?:\\s+(${VERSION_PATTERN})\\b)?`,
    'g'
  );
}

/** The book an opening-scripture reference belongs to ("2 Corinthians 5:17 NKJV" → 2 Corinthians). */
export function bookOfReference(reference: string): BibleBook | undefined {
  const match = referenceRegExp().exec(reference ?? '');
  return match ? findBook(match[2]) : undefined;
}

/** Sort key for a reference within its book: chapter, then first verse. */
export function referenceSortKey(reference: string): [number, number, number] {
  const match = referenceRegExp().exec(reference ?? '');
  if (!match) return [999, 999, 999];
  const book = findBook(match[2]);
  const chapter = Number(match[3]) || 0;
  const verse = Number(/^:(\d+)/.exec(match[4] ?? '')?.[1] ?? 0);
  return [book?.order ?? 999, chapter, verse];
}

export type ReferenceSegment =
  | { type: 'text'; text: string }
  | { type: 'ref'; text: string; book: BibleBook; query: string; version?: BibleVersion };

/**
 * Split free text into plain runs and references, so a renderer can link the references and
 * leave everything else alone. A continuation such as "Romans 5:17, 8:1" or "John 3:16; 4:24"
 * carries the book over to the bare `8:1`/`4:24`.
 */
export function splitReferences(text: string): ReferenceSegment[] {
  const source = text ?? '';
  const segments: ReferenceSegment[] = [];
  const re = referenceRegExp();
  let cursor = 0;
  let match: RegExpExecArray | null;

  const pushText = (value: string) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last && last.type === 'text') last.text += value;
    else segments.push({ type: 'text', text: value });
  };

  while ((match = re.exec(source))) {
    const [whole, prefix, bookText, chapter, tail, version] = match;
    const book = findBook(bookText);
    if (!book) continue;
    const start = match.index + prefix.length;
    pushText(source.slice(cursor, start));
    const canonicalBook = book.name;
    const passage = `${chapter}${(tail ?? '').replace(/\s+/g, '')}`;
    segments.push({
      type: 'ref',
      text: whole.slice(prefix.length),
      book,
      query: `${canonicalBook} ${passage}`,
      version: isBibleVersion(version) ? version : undefined,
    });
    cursor = match.index + whole.length;

    // Continuations: "; 8:1" / ", 4:24-26" right after a reference reuse its book.
    const continuation = /^(\s*[;,]\s*)(\d{1,3}:\d{1,3}(?:\s*[-–]\s*\d{1,3}(?::\d{1,3})?)?)/;
    let rest = continuation.exec(source.slice(cursor));
    while (rest) {
      pushText(rest[1]);
      segments.push({
        type: 'ref',
        text: rest[2],
        book,
        query: `${canonicalBook} ${rest[2].replace(/\s+/g, '')}`,
      });
      cursor += rest[0].length;
      rest = continuation.exec(source.slice(cursor));
    }
    re.lastIndex = cursor;
  }

  pushText(source.slice(cursor));
  return segments;
}

/** Every reference in a text, as BibleGateway-ready queries. */
export function extractReferences(text: string): string[] {
  return splitReferences(text)
    .filter((segment): segment is Extract<ReferenceSegment, { type: 'ref' }> => segment.type === 'ref')
    .map((segment) => segment.query);
}

/** A passage on BibleGateway — free, no account, every major translation. */
export function bibleGatewayUrl(query: string, version: BibleVersion = DEFAULT_BIBLE_VERSION): string {
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(query)}&version=${encodeURIComponent(version)}`;
}

/**
 * The edition prints the reference inside the verse — "…by the law and the prophets
 * (Romans 3:21)." — and again underneath it. Anything that shows the verse *and* the reference
 * (share cards, copied text, verse images) strips the inline copy so it is not said twice.
 */
export function stripTrailingReference(text: string): string {
  const clean = (text ?? '').trim();
  const match = /\s*\(([^()]*\d[^()]*)\)\s*([.!?]?)\s*$/.exec(clean);
  if (!match || !bookOfReference(match[1])) return clean;
  const body = clean.slice(0, match.index).replace(/[\s,;:]+$/, '');
  return /[.!?…”"']$/.test(body) ? body : `${body}${match[2] || '.'}`;
}
