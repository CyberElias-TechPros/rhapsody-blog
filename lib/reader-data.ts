/**
 * Everything the site remembers for a reader — on their device, never on a server.
 *
 * | Store                  | Key                        | What it holds                                   |
 * |------------------------|----------------------------|-------------------------------------------------|
 * | `historyStore`         | `rhapsody.history.v1`      | Each devotional opened: progress, resume point  |
 * | `daysStore`            | `rhapsody.days.v1`         | Local dates a devotional was finished (streaks) |
 * | `notesStore`           | `rhapsody.notes.v1`        | The reader's own notes per devotional           |
 * | `planStore`            | `rhapsody.plan.v1`         | Bible-reading-plan portions ticked off          |
 * | `prefsStore`           | `rhapsody.prefs.v1`        | Text size, font, spacing, width, Bible version  |
 * | `searchesStore`        | `rhapsody.searches.v1`     | Recent searches                                  |
 * | (saved, existing)      | `rhapsody.saved.slugs`     | Bookmarks — see `hooks/useSavedPosts.ts`        |
 *
 * The pure functions at the bottom (streaks, month counts, resume logic) carry the business rules
 * and are unit-tested in `tests/reader-data.test.ts`.
 */

import { isAudience, type AudienceId } from '@/lib/audiences';
import { DEFAULT_BIBLE_VERSION, isBibleVersion, type BibleVersion } from '@/lib/bible';
import { createLocalStore, recordOf } from '@/lib/local-store';

/* ------------------------------------------------------------------ history */

export interface HistoryEntry {
  slug: string;
  title: string;
  /** The devotional's own date (`yyyy-mm-dd`), not the day it was read. */
  date: string;
  audience: AudienceId;
  firstReadAt: number;
  lastReadAt: number;
  /** Furthest point reached, 0–1. */
  progress: number;
  /** Where the reader last was, 0–1 — the "continue where you left off" point. */
  position: number;
  /** Set the first time the reader reaches the end (or marks it read). */
  completedAt?: number;
}

export type History = Record<string, HistoryEntry>;

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string';

function isHistoryEntry(value: unknown): value is HistoryEntry {
  const v = value as HistoryEntry;
  return (
    !!v &&
    typeof v === 'object' &&
    isString(v.slug) &&
    isString(v.title) &&
    isString(v.date) &&
    isAudience(v.audience) &&
    isNumber(v.firstReadAt) &&
    isNumber(v.lastReadAt) &&
    isNumber(v.progress) &&
    isNumber(v.position) &&
    (v.completedAt === undefined || isNumber(v.completedAt))
  );
}

/** Oldest entries are dropped beyond this, so the store never grows without bound. */
export const HISTORY_LIMIT = 1500;

export const historyStore = createLocalStore<History>('rhapsody.history.v1', {}, (raw) => recordOf(raw, isHistoryEntry));

/* ------------------------------------------------------------------ days read */

/** `yyyy-mm-dd` (the reader's local date) → devotionals finished that day. */
export type DaysRead = Record<string, number>;

export const daysStore = createLocalStore<DaysRead>('rhapsody.days.v1', {}, (raw) =>
  recordOf(raw, (value): value is number => isNumber(value) && value > 0)
);

/* ------------------------------------------------------------------ notes */

export interface NoteEntry {
  slug: string;
  title: string;
  date: string;
  text: string;
  updatedAt: number;
}

export type Notes = Record<string, NoteEntry>;

function isNoteEntry(value: unknown): value is NoteEntry {
  const v = value as NoteEntry;
  return !!v && typeof v === 'object' && isString(v.slug) && isString(v.title) && isString(v.date) && isString(v.text) && isNumber(v.updatedAt);
}

export const NOTE_MAX_LENGTH = 10_000;

export const notesStore = createLocalStore<Notes>('rhapsody.notes.v1', {}, (raw) => recordOf(raw, isNoteEntry));

/* ------------------------------------------------------------------ Bible reading plan */

/** Keyed by the slug of the devotional that printed the portion; values are tick timestamps. */
export interface PlanMark {
  date: string;
  one?: number;
  two?: number;
}

export type PlanProgress = Record<string, PlanMark>;

function isPlanMark(value: unknown): value is PlanMark {
  const v = value as PlanMark;
  return !!v && typeof v === 'object' && isString(v.date) && (v.one === undefined || isNumber(v.one)) && (v.two === undefined || isNumber(v.two));
}

export const planStore = createLocalStore<PlanProgress>('rhapsody.plan.v1', {}, (raw) => recordOf(raw, isPlanMark));

/* ------------------------------------------------------------------ reading preferences */

export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export type ReadingFont = 'serif' | 'sans' | 'legible';
export type LineSpacing = 'normal' | 'relaxed' | 'loose';
export type ColumnWidth = 'narrow' | 'normal' | 'wide';

export interface ReadingPrefs {
  size: TextSize;
  font: ReadingFont;
  leading: LineSpacing;
  width: ColumnWidth;
  version: BibleVersion;
}

export const DEFAULT_PREFS: ReadingPrefs = {
  size: 'md',
  font: 'serif',
  leading: 'normal',
  width: 'normal',
  version: DEFAULT_BIBLE_VERSION,
};

export const TEXT_SIZES: TextSize[] = ['sm', 'md', 'lg', 'xl'];
export const READING_FONTS: ReadingFont[] = ['serif', 'sans', 'legible'];
export const LINE_SPACINGS: LineSpacing[] = ['normal', 'relaxed', 'loose'];
export const COLUMN_WIDTHS: ColumnWidth[] = ['narrow', 'normal', 'wide'];

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback;

export function normalisePrefs(raw: unknown): ReadingPrefs {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ReadingPrefs, unknown>>;
  return {
    size: oneOf(TEXT_SIZES, v.size, DEFAULT_PREFS.size),
    font: oneOf(READING_FONTS, v.font, DEFAULT_PREFS.font),
    leading: oneOf(LINE_SPACINGS, v.leading, DEFAULT_PREFS.leading),
    width: oneOf(COLUMN_WIDTHS, v.width, DEFAULT_PREFS.width),
    version: isBibleVersion(v.version) ? v.version : DEFAULT_PREFS.version,
  };
}

export const PREFS_KEY = 'rhapsody.prefs.v1';

export const prefsStore = createLocalStore<ReadingPrefs>(PREFS_KEY, DEFAULT_PREFS, normalisePrefs);

/**
 * Mirror the preferences onto `<html data-reading-*>` so CSS can apply them. The same mapping
 * runs before first paint from the inline script in the root layout (`READING_PREFS_SCRIPT`), so
 * a reader who chose large type never sees the page jump from small to large.
 */
export function applyPrefsToDocument(prefs: ReadingPrefs): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.readingSize = prefs.size;
  root.dataset.readingFont = prefs.font;
  root.dataset.readingLeading = prefs.leading;
  root.dataset.readingWidth = prefs.width;
}

/** Inline, pre-paint version of `applyPrefsToDocument` (no imports; must stay tiny and safe). */
export const READING_PREFS_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('${PREFS_KEY}')||'{}');var d=document.documentElement;var ok=function(v,o){return o.indexOf(v)>-1};if(ok(p.size,['sm','lg','xl']))d.dataset.readingSize=p.size;if(ok(p.font,['sans','legible']))d.dataset.readingFont=p.font;if(ok(p.leading,['relaxed','loose']))d.dataset.readingLeading=p.leading;if(ok(p.width,['narrow','wide']))d.dataset.readingWidth=p.width;}catch(e){}})();`;

/* ------------------------------------------------------------------ recent searches */

export const SEARCHES_LIMIT = 8;

export const searchesStore = createLocalStore<string[]>('rhapsody.searches.v1', [], (raw) =>
  Array.isArray(raw) ? raw.filter(isString).slice(0, SEARCHES_LIMIT) : []
);

/** Most recent first, case-insensitively de-duplicated, capped. */
export function pushRecentSearch(list: string[], term: string): string[] {
  const clean = term.trim().replace(/\s+/g, ' ');
  if (clean.length < 2) return list;
  return [clean, ...list.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, SEARCHES_LIMIT);
}

/* ------------------------------------------------------------------ business rules */

/** The reader's *local* calendar date for an instant — streaks follow the reader's day. */
export function localDateKey(instant: Date | number): string {
  const d = typeof instant === 'number' ? new Date(instant) : instant;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDateKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/**
 * Consecutive days with at least one finished devotional, ending today — or ending yesterday,
 * because a streak is not broken until the day is over.
 */
export function currentStreak(days: DaysRead, today: string): number {
  let cursor = days[today] ? today : shiftDateKey(today, -1);
  let streak = 0;
  while (days[cursor]) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function longestStreak(days: DaysRead): number {
  const keys = Object.keys(days)
    .filter((key) => days[key] > 0)
    .sort();
  let best = 0;
  let run = 0;
  let previous = '';
  for (const key of keys) {
    run = previous && shiftDateKey(previous, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  return best;
}

/** Days with a finished devotional in a month (`yyyy-mm`). */
export function daysReadInMonth(days: DaysRead, month: string): number {
  return Object.keys(days).filter((key) => key.startsWith(`${month}-`) && days[key] > 0).length;
}

/** The last `count` local dates, oldest first, for a heat-map strip. */
export function recentDateKeys(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftDateKey(today, i - (count - 1)));
}

/**
 * Record progress on a devotional and decide whether that finishes it. Returns the new history
 * and, when the devotional was finished *by this update*, the local day to credit.
 *
 * Rules: progress only grows; position follows the reader; reaching 90% of the article (or an
 * explicit "mark as read") finishes it once — re-reading later does not double-count the day.
 */
export const COMPLETION_THRESHOLD = 0.9;

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function recordProgress(
  history: History,
  entry: Pick<HistoryEntry, 'slug' | 'title' | 'date' | 'audience'>,
  reading: { progress: number; position?: number },
  now: number,
  options: { markRead?: boolean; allowComplete?: boolean } = {}
): { history: History; completedNow: boolean } {
  const seen = clamp01(reading.progress);
  const position = clamp01(reading.position ?? reading.progress);
  const previous = history[entry.slug];
  const progress = Math.max(previous?.progress ?? 0, seen);
  // Scrolling to the end only counts once the reader has been on the page long enough to have
  // read it (the caller decides; a short article can be fully on screen the moment it opens).
  const finished = Boolean(options.markRead) || (options.allowComplete !== false && progress >= COMPLETION_THRESHOLD);
  const completedNow = finished && !previous?.completedAt;
  const next: HistoryEntry = {
    ...entry,
    firstReadAt: previous?.firstReadAt ?? now,
    lastReadAt: now,
    progress: options.markRead ? 1 : progress,
    position,
    completedAt: previous?.completedAt ?? (finished ? now : undefined),
  };
  return { history: trimHistory({ ...history, [entry.slug]: next }), completedNow };
}

/** "Mark as unread": keeps the visit, forgets the completion. */
export function unmarkRead(history: History, slug: string): History {
  const previous = history[slug];
  if (!previous) return history;
  const { completedAt: _completedAt, ...rest } = previous;
  return { ...history, [slug]: { ...rest, progress: Math.min(rest.progress, COMPLETION_THRESHOLD - 0.01) } };
}

export function trimHistory(history: History, limit = HISTORY_LIMIT): History {
  const entries = Object.values(history);
  if (entries.length <= limit) return history;
  const keep = entries.sort((a, b) => b.lastReadAt - a.lastReadAt).slice(0, limit);
  return Object.fromEntries(keep.map((entry) => [entry.slug, entry]));
}

/** Credit a finished devotional to the reader's local day. */
export function creditDay(days: DaysRead, dayKey: string): DaysRead {
  return { ...days, [dayKey]: (days[dayKey] ?? 0) + 1 };
}

/** Is there a meaningful place to resume? Not at the very top, not already at the end. */
export function resumePoint(entry: HistoryEntry | undefined): number | null {
  if (!entry || entry.completedAt) return null;
  return entry.position >= 0.08 && entry.position <= 0.92 ? entry.position : null;
}

/** Started but not finished, most recent first — the "continue reading" list. */
export function inProgress(history: History, limit = 5): HistoryEntry[] {
  return Object.values(history)
    .filter((entry) => !entry.completedAt && entry.progress >= 0.05)
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
    .slice(0, limit);
}

export function recentlyRead(history: History, limit = 20): HistoryEntry[] {
  return Object.values(history)
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
    .slice(0, limit);
}

export function planCounts(plan: PlanProgress): { one: number; two: number } {
  let one = 0;
  let two = 0;
  for (const mark of Object.values(plan)) {
    if (mark.one) one += 1;
    if (mark.two) two += 1;
  }
  return { one, two };
}

/** Undo a day's credit (a mis-tap on "mark as read" corrected the same day). */
export function uncreditDay(days: DaysRead, dayKey: string): DaysRead {
  const count = (days[dayKey] ?? 0) - 1;
  const { [dayKey]: _removed, ...rest } = days;
  return count > 0 ? { ...rest, [dayKey]: count } : rest;
}
