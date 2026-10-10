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
