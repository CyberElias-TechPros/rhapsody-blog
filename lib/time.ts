/**
 * Timezone-aware date arithmetic for a *daily* devotional.
 *
 * Why this module exists: `new Date().toISOString().slice(0, 10)` is a UTC date, and the day a
 * devotional belongs to starts at midnight where the edition is published, not at midnight in
 * Greenwich. For a reader in Lagos (UTC+1) the two disagree every evening between 23:00 and
 * 00:00 UTC — and, worse, a site that computes "today" once at build time keeps serving the
 * build day's article until it is redeployed. `lib/content.ts` therefore asks this module for
 * the date, and the home page re-renders per request (`export const dynamic = 'force-dynamic'`)
 * with a client-side rollover at local midnight for readers whose own zone differs from the
 * site's.
 *
 * Everything here is pure and isomorphic: no `node:` imports, so client components (the
 * midnight timer in `TodayBadge`, the audio player) can use the same helpers the server does.
 */

/**
 * The zone the day is counted in. Defaults to Lagos — the edition's home audience and the
 * publisher's timezone — and is read from a `NEXT_PUBLIC_` variable so the client bundle can
 * agree with the server about when a day ends.
 */
export const SITE_TIMEZONE = (process.env.NEXT_PUBLIC_SITE_TIMEZONE ?? '').trim() || 'Africa/Lagos';

/** Hour the day's devotional is considered published, in the site zone (05:00 as printed). */
export const PUBLISH_HOUR = Number(process.env.NEXT_PUBLIC_PUBLISH_HOUR ?? 5);

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** `Intl.DateTimeFormat` construction is slow and this is called per render — memoise per zone. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatters.set(timeZone, created);
  return created;
}

/** Is `timeZone` a zone this runtime understands? Used to fail soft on a typo'd env value. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The site zone, or the default when the configured one is not a real zone. */
export function siteTimeZone(): string {
  return isValidTimeZone(SITE_TIMEZONE) ? SITE_TIMEZONE : 'Africa/Lagos';
}

/** Wall-clock parts of an instant in a zone (`2026-10-12T23:30Z` → `{ day: 13, … }` in Lagos). */
export function zonedParts(instant: Date, timeZone = siteTimeZone()): ZonedParts {
  const parts: Partial<Record<string, number>> = {};
  for (const part of formatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `yyyy-mm-dd` for an instant, in a zone. */
export function dateIsoIn(instant: Date, timeZone = siteTimeZone()): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Today's `yyyy-mm-dd` in the site zone. `now` is injectable so routes and tests are
 * deterministic; the default is the moment of the call, which is what makes the home page
 * honest about the date it was rendered on.
 */
export function todayIso(now: Date = new Date(), timeZone = siteTimeZone()): string {
  return dateIsoIn(now, timeZone);
}

/** Minutes a zone is ahead of UTC at an instant (negative west of Greenwich). */
export function offsetMinutes(instant: Date, timeZone = siteTimeZone()): number {
  const parts = zonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asIfUtc - instant.getTime()) / 60_000);
}

/**
 * The instant a local wall-clock time occurs in a zone. Guessed from the UTC reading of the
 * same clock and then corrected by the zone's offset at that guess, which is exact everywhere
 * except inside a DST gap — and Lagos does not observe one.
 */
export function zonedTimeToInstant(dateIso: string, hour = 0, minute = 0, timeZone = siteTimeZone()): Date {
  const guess = new Date(`${dateIso}T${pad(hour)}:${pad(minute)}:00.000Z`);
  if (Number.isNaN(guess.getTime())) return guess;
  return new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60_000);
}

/** Midnight at the start of `dateIso`, in the site zone. */
export function startOfDay(dateIso: string, timeZone = siteTimeZone()): Date {
  return zonedTimeToInstant(dateIso, 0, 0, timeZone);
}

/**
 * Milliseconds until the next local midnight — what the client rollover timer waits for before
 * re-reading "today". One extra second keeps the timer from firing on the same instant.
 */
export function msUntilNextMidnight(now: Date = new Date(), timeZone = siteTimeZone()): number {
  const tomorrow = addDaysIso(dateIsoIn(now, timeZone), 1);
  return Math.max(1_000, startOfDay(tomorrow, timeZone).getTime() - now.getTime() + 1_000);
}

/** Pure ISO-date arithmetic: no timezone, no DST, no `Date` parsing surprises. */
export function addDaysIso(dateIso: string, delta: number): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  if (!year || !month || !day) return dateIso;
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

/** Is `dateIso` a real calendar day? Guards user-supplied dates on `/reading-plans?date=`. */
export function isValidDateIso(dateIso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
  // A shape check is not enough: `new Date('2026-02-30')` is not invalid, it is 2 March, so a
  // malformed `?date=` would render a different day's plan instead of falling back to today.
  // Parsing and reading the parts back rejects every day the calendar does not have.
  const [year, month, day] = dateIso.split('-').map(Number);
  if (!year || !month || !day) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
  );
}

/** `yyyy-mm` for an ISO date — the edition a day belongs to. */
export function monthIso(dateIso: string): string {
  return dateIso.slice(0, 7);
}

/** Days between two ISO dates (`b - a`), so a countdown to a future day is a subtraction. */
export function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * The reader's own zone, or the site zone on the server and in browsers that will not say.
 * Used only for display ("it is already the 13th for you") — never for choosing an article,
 * which is the site zone's business.
 */
export function viewerTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimeZone(zone) ? zone : siteTimeZone();
  } catch {
    return siteTimeZone();
  }
}
