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
