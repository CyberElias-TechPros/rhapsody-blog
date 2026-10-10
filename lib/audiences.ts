/**
 * Who a devotional is written for.
 *
 * The same publisher prints one monthly edition per audience — the adult `Rhapsody of Realities`,
 * `… for Teens` (TEEVO) and `… for Early Readers` (RORER). They share a shape (title, opening
 * scripture, message, closing prayer or confession, further study) and differ in what else they
 * carry: the teens edition adds an `Act` and a `Speak` section plus both Bible reading plans, the
 * early readers' edition has no reading plans at all.
 *
 * Everything downstream keys off the edition slug, which is `yyyy-mm` for the adult edition (the
 * shape the published URLs already have) and `yyyy-mm-<audience>` for the others. That is also
 * how an article's audience is recognised when its front matter does not say — see
 * `audienceOfEdition` — so the two tables here and in `scripts/extract-devotionals.mjs`
 * (its own `AUDIENCES`) have to agree.
 */

export type AudienceId = 'adults' | 'teens' | 'early-readers';

export interface Audience {
  id: AudienceId;
  /** `For Teens` — as the editions print it on their pages. */
  label: string;
  /** `Teens` — the same thing short enough for a card badge. */
  shortLabel: string;
  /** `Rhapsody of Realities for Teens` — the series name in front matter and the feed. */
  series: string;
  /** One line for a reader who has never seen this audience's edition. */
  blurb: string;
  /** `''` for the adult edition — its slugs and URLs predate audiences and never change. */
  editionSuffix: string;
  /** `''` / `-teens` / `-early-readers`, the part of a post slug after the date. */
  slugToken: string;
}

export const AUDIENCES: Record<AudienceId, Audience> = {
  adults: {
    id: 'adults',
    label: 'For Adults',
    shortLabel: 'Adults',
    series: 'Rhapsody of Realities',
    blurb: 'The monthly edition written for the adult reader — the one the blog started with.',
    editionSuffix: '',
    slugToken: '',
  },
  teens: {
    id: 'teens',
    label: 'For Teens',
    shortLabel: 'Teens',
    series: 'Rhapsody of Realities for Teens',
    blurb: 'TEEVO: the same day’s message for a teenager, with something to do and something to say.',
    editionSuffix: '-teens',
    slugToken: '-teens',
  },
  'early-readers': {
    id: 'early-readers',
    label: 'For Early Readers',
    shortLabel: 'Early Readers',
    series: 'Rhapsody of Realities for Early Readers',
    blurb: 'One page, large type, and a prayer or confession a child can read out loud.',
    editionSuffix: '-early-readers',
    slugToken: '-early-readers',
  },
};

/** The order a day’s articles are listed and read in — also the tie-break in the corpus sort. */
export const AUDIENCE_ORDER: AudienceId[] = ['adults', 'teens', 'early-readers'];

export const DEFAULT_AUDIENCE: AudienceId = 'adults';

export function isAudience(value: unknown): value is AudienceId {
  return typeof value === 'string' && value in AUDIENCES;
}

export function audienceOrNull(value: unknown): AudienceId | undefined {
  return isAudience(value) ? value : undefined;
}

/** The audience an edition slug belongs to (`2026-10-teens` → teens, `2026-10` → adults). */
export function audienceOfEdition(edition: string): AudienceId {
  const found = AUDIENCE_ORDER.find((id) => id !== 'adults' && edition.endsWith(AUDIENCES[id].editionSuffix));
  return found ?? DEFAULT_AUDIENCE;
}

/** The month an edition covers, without the audience part: `2026-10-teens` → `2026-10`. */
export function monthOfEdition(edition: string): string {
  const audience = audienceOfEdition(edition);
  const suffix = AUDIENCES[audience].editionSuffix;
  return suffix && edition.endsWith(suffix) ? edition.slice(0, -suffix.length) : edition;
}

export function editionSlug(year: number, month: number, audience: AudienceId): string {
  return `${year}-${String(month).padStart(2, '0')}${AUDIENCES[audience].editionSuffix}`;
}

/** Audiences in listing order, with the ones the corpus has no edition for left out. */
export function audiencesIn(corpus: { audience: AudienceId }[]): AudienceId[] {
  const present = new Set(corpus.map((post) => post.audience));
  return AUDIENCE_ORDER.filter((id) => present.has(id));
}
