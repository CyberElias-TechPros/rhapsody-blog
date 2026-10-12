import { describe, expect, it } from 'vitest';
import {
  SITE_TIMEZONE,
  addDaysIso,
  dateIsoIn,
  daysBetween,
  isValidDateIso,
  isValidTimeZone,
  monthIso,
  msUntilNextMidnight,
  offsetMinutes,
  siteTimeZone,
  startOfDay,
  todayIso,
  zonedParts,
  zonedTimeToInstant,
} from '@/lib/time';

/**
 * The module that makes "today" mean something.
 *
 * Every assertion here is a way the site used to be wrong: a UTC date used as the site's date, a
 * build-time date served all day, an offset guessed instead of asked for. 23:30Z on the 10th of
 * October is the interesting instant — still the 10th in Greenwich, already the 11th in Lagos.
 */
const EVENING_UTC = new Date('2026-10-10T23:30:00.000Z');

describe('the site timezone', () => {
  it('defaults to Lagos, where the edition is published', () => {
    expect(SITE_TIMEZONE).toBe('Africa/Lagos');
    expect(siteTimeZone()).toBe('Africa/Lagos');
  });

  it('recognises real zones and refuses invented ones', () => {
    expect(isValidTimeZone('Africa/Lagos')).toBe(true);
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('zonedParts / dateIsoIn', () => {
  it('reads the same instant as two different days, in the two zones', () => {
    expect(dateIsoIn(EVENING_UTC, 'UTC')).toBe('2026-10-10');
    expect(dateIsoIn(EVENING_UTC, 'Africa/Lagos')).toBe('2026-10-11');
  });

  it('returns wall-clock parts, not UTC parts', () => {
    expect(zonedParts(EVENING_UTC, 'Africa/Lagos')).toEqual({
      year: 2026,
      month: 10,
      day: 11,
      hour: 0,
      minute: 30,
      second: 0,
    });
  });

  it('crosses a month and a year boundary correctly', () => {
    expect(dateIsoIn(new Date('2026-12-31T23:30:00Z'), 'Africa/Lagos')).toBe('2027-01-01');
    expect(dateIsoIn(new Date('2026-02-28T23:30:00Z'), 'Africa/Lagos')).toBe('2026-03-01');
  });
});

describe('todayIso', () => {
  it('takes the instant as an argument, so a route and a test agree on the day', () => {
    expect(todayIso(EVENING_UTC)).toBe('2026-10-11');
    expect(todayIso(EVENING_UTC, 'UTC')).toBe('2026-10-10');
  });

  it('falls back to the moment of the call', () => {
    const now = new Date();
    expect(todayIso(now, 'UTC')).toBe(now.toISOString().slice(0, 10));
  });
});

describe('offsetMinutes', () => {
  it('is positive east of Greenwich and negative west', () => {
    expect(offsetMinutes(EVENING_UTC, 'Africa/Lagos')).toBe(60);
    expect(offsetMinutes(EVENING_UTC, 'UTC')).toBe(0);
    expect(offsetMinutes(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-300);
  });

  it('follows daylight saving in a zone that observes it', () => {
    expect(offsetMinutes(new Date('2026-01-15T12:00:00Z'), 'Europe/London')).toBe(0);
    expect(offsetMinutes(new Date('2026-07-15T12:00:00Z'), 'Europe/London')).toBe(60);
    // Lagos does not: the same offset in January and July is the point of the comparison.
    expect(offsetMinutes(new Date('2026-07-15T12:00:00Z'), 'Africa/Lagos')).toBe(60);
  });
});

describe('zonedTimeToInstant / startOfDay', () => {
  it('places a local wall-clock time at the right instant', () => {
    // 05:00 in Lagos is 04:00Z — the hour the day's devotional is considered published.
    expect(zonedTimeToInstant('2026-10-10', 5, 0, 'Africa/Lagos').toISOString()).toBe('2026-10-10T04:00:00.000Z');
    expect(zonedTimeToInstant('2026-07-15', 5, 0, 'Europe/London').toISOString()).toBe('2026-07-15T04:00:00.000Z');
  });

  it('midnight in Lagos is 23:00Z the evening before', () => {
    expect(startOfDay('2026-10-11', 'Africa/Lagos').toISOString()).toBe('2026-10-10T23:00:00.000Z');
  });
});

describe('msUntilNextMidnight', () => {
  it('waits for the site zone, not the reader\'s', () => {
    // 00:30 on the 11th in Lagos; the next local midnight is 23:00Z on the 11th — 23.5 hours.
    expect(msUntilNextMidnight(EVENING_UTC, 'Africa/Lagos')).toBe(84_601_000);
    // In UTC the same instant is 30 minutes before the 11th.
    expect(msUntilNextMidnight(EVENING_UTC, 'UTC')).toBe(1_801_000);
  });

  it('never returns zero, so a timer set from it always fires after the day has changed', () => {
    const exactlyMidnight = startOfDay('2026-10-11', 'Africa/Lagos');
    expect(msUntilNextMidnight(exactlyMidnight, 'Africa/Lagos')).toBeGreaterThan(0);
  });
});

describe('pure ISO-date arithmetic', () => {
  it('rolls over months and years', () => {
    expect(addDaysIso('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-10-10', -10)).toBe('2026-09-30');
  });

  it('leaves something unparseable alone rather than inventing a date', () => {
    expect(addDaysIso('nonsense', 1)).toBe('nonsense');
  });

  it('accepts real days and rejects impossible ones', () => {
    expect(isValidDateIso('2026-10-10')).toBe(true);
    expect(isValidDateIso('2026-02-28')).toBe(true);
    expect(isValidDateIso('2026-02-30')).toBe(false);
    expect(isValidDateIso('2026-13-01')).toBe(false);
    expect(isValidDateIso('2026-1-1')).toBe(false);
    expect(isValidDateIso('yesterday')).toBe(false);
  });

  it('names the edition a day belongs to', () => {
    expect(monthIso('2026-10-10')).toBe('2026-10');
  });

  it('counts days between two dates, in either direction', () => {
    expect(daysBetween('2026-01-01', '2026-10-31')).toBe(303);
    expect(daysBetween('2026-10-31', '2026-01-01')).toBe(-303);
    expect(daysBetween('2026-10-10', '2026-10-10')).toBe(0);
    expect(daysBetween('nonsense', '2026-10-10')).toBe(0);
  });
});
