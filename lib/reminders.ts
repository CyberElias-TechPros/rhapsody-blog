/**
 * A daily reminder without push notifications, accounts or a server: a repeating event in the
 * reader's own calendar app, with an alert at the time they choose and a link to `/today`.
 *
 * Push notifications would need a VAPID key pair, a subscription store and a sender (see the
 * roadmap). A calendar event works today on every phone and desktop, survives reinstalling the
 * browser, and can be removed by the reader like any other event.
 */

export interface ReminderOptions {
  /** `HH:MM`, 24-hour, in the reader's local time (the event is "floating", so it follows them). */
  time: string;
  /** First day, `yyyy-mm-dd`. */
  startDate: string;
  url: string;
  title: string;
  description: string;
  /** Stable id so re-importing replaces rather than duplicates. */
  uid: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function parseTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim());
  const hour = match ? Math.min(23, Math.max(0, Number(match[1]))) : 6;
  const minute = match ? Math.min(59, Math.max(0, Number(match[2]))) : 0;
  return { hour, minute };
}

/** `20261016T060000` — local ("floating") time, no `Z`. */
function floating(dateIso: string, hour: number, minute: number): string {
  return `${dateIso.replace(/-/g, '')}T${pad(hour)}${pad(minute)}00`;
}

/** Wall-clock arithmetic that rolls over midnight (23:55 + 10 min → 00:05 the next day). */
export function addMinutesFloating(dateIso: string, hour: number, minute: number, delta: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hour, minute + delta));
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
}

/** Each reminder event lasts ten minutes — long enough to show in a day view, short enough not to block it. */
const EVENT_MINUTES = 10;

/** RFC 5545 text escaping. */
export function escapeIcsText(value: string): string {
  return (value ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** RFC 5545 line folding: lines longer than 75 octets continue on the next line after a space. */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (currentBytes + size > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function stamp(now: Date): string {
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(
    now.getUTCMinutes()
  )}${pad(now.getUTCSeconds())}Z`;
}

/** An `.ics` file with one daily-repeating event and an alert at its start. */
export function buildDailyReminderIcs(options: ReminderOptions, now: Date = new Date()): string {
  const { hour, minute } = parseTime(options.time);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rhapsody of Realities reader//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${options.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${floating(options.startDate, hour, minute)}`,
    `DTEND:${addMinutesFloating(options.startDate, hour, minute, EVENT_MINUTES)}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeIcsText(options.title)}`,
    `DESCRIPTION:${escapeIcsText(`${options.description}\n${options.url}`)}`,
    `URL:${options.url}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(options.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/** The same reminder as a Google Calendar "add event" link (opens prefilled; the reader saves it). */
export function googleCalendarUrl(options: Omit<ReminderOptions, 'uid'>, timeZone?: string): string {
  const { hour, minute } = parseTime(options.time);
  const start = floating(options.startDate, hour, minute);
  const end = addMinutesFloating(options.startDate, hour, minute, EVENT_MINUTES);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: options.title,
    details: `${options.description}\n${options.url}`,
    dates: `${start}/${end}`,
    recur: 'RRULE:FREQ=DAILY',
  });
  if (timeZone) params.set('ctz', timeZone);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
