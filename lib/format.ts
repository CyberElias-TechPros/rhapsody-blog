import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

/** "March 3, 2026" — resilient to malformed input (never NaN text). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseISO(value);
  return isValid(d) ? format(d, 'MMMM d, yyyy') : '';
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseISO(value);
  return isValid(d) ? format(d, 'MMM d, yyyy') : '';
}

/** "Tuesday, September 1" — the way a daily devotional is normally referred to. */
export function formatDayHeading(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseISO(value);
  return isValid(d) ? format(d, 'EEEE, MMMM d') : '';
}

/**
 * "15 October 2026" — day-first, the way the date is written in Nigeria, Ghana, the UK and most
 * of the devotional's readership, and the way it is typed into a search box
 * ("rhapsody of realities 15 october 2026").
 */
export function formatDayMonthYear(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseISO(value);
  return isValid(d) ? format(d, 'd MMMM yyyy') : '';
}

/** "15th October 2026" — the other common spelling of the same search. */
export function formatOrdinalDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseISO(value);
  return isValid(d) ? format(d, 'do MMMM yyyy') : '';
}

/** "October 2026" — an edition's name. */
export function formatMonthYear(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseISO(value.length === 7 ? `${value}-01` : value);
  return isValid(d) ? format(d, 'MMMM yyyy') : '';
}

/** "Thursday" for a `yyyy-mm-dd`. */
export function formatWeekday(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseISO(value);
  return isValid(d) ? format(d, 'EEEE') : '';
}

/** "2 hours ago" — for freshness labels; returns '' for invalid input. */
export function timeAgo(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseISO(value);
  if (!isValid(d)) return '';
  if (d.getTime() > Date.now()) return 'just now';
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  return n.toLocaleString();
}

/**
 * Word counts read the same as any other count ("20,564 words"). Kept as its own helper so the
 * about page and the edition cards can change the presentation in one place.
 */
export function formatWords(n: number | null | undefined): string {
  return formatCount(n);
}
