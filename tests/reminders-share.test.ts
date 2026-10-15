import { describe, expect, it } from 'vitest';
import { buildDailyReminderIcs, escapeIcsText, foldIcsLine, googleCalendarUrl, parseTime } from '@/lib/reminders';
import { devotionalShareText, devotionalTeaser, shareUrl, toWhatsAppMarkup } from '@/lib/share-text';

describe('daily reminder (.ics)', () => {
  const ics = buildDailyReminderIcs(
    {
      time: '06:30',
      startDate: '2026-10-15',
      url: 'https://example.org/today',
      title: 'Rhapsody of Realities — today’s devotional',
      description: 'Read today’s devotional; the message, prayer, and plan.',
      uid: 'daily-adults@example.org',
    },
    new Date(Date.UTC(2026, 9, 15, 8, 0, 0))
  );

  it('is a valid, daily-repeating calendar event with an alert', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261015T063000\r\n');
    expect(ics).toContain('DTEND:20261015T064000\r\n');
    expect(ics).toContain('RRULE:FREQ=DAILY\r\n');
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY');
    expect(ics).toContain('DTSTAMP:20261015T080000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes text and folds long lines at 75 octets', () => {
    expect(escapeIcsText('a, b; c\nd')).toBe('a\\, b\\; c\\nd');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const folded = foldIcsLine(`DESCRIPTION:${'x'.repeat(200)}`);
    expect(folded.split('\r\n ').join('')).toBe(`DESCRIPTION:${'x'.repeat(200)}`);
  });

  it('parses times defensively and rolls the end time past the hour', () => {
    expect(parseTime('7:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseTime('nonsense')).toEqual({ hour: 6, minute: 0 });
    const late = buildDailyReminderIcs({ time: '23:55', startDate: '2026-10-15', url: 'u', title: 't', description: 'd', uid: 'x' });
    // 23:55 + 10 minutes is 00:05 the next morning — never an hour of 24.
    expect(late).toContain('DTEND:20261016T000500');
  });

  it('builds a Google Calendar link', () => {
    const url = new URL(googleCalendarUrl({ time: '06:00', startDate: '2026-10-15', url: 'https://e.org/today', title: 'T', description: 'D' }, 'Africa/Lagos'));
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY');
    expect(url.searchParams.get('dates')).toBe('20261015T060000/20261015T061000');
    expect(url.searchParams.get('ctz')).toBe('Africa/Lagos');
  });
});

describe('sharing', () => {
  const post = {
    title: 'Righteousness Apart From the Law',
    date: '2026-10-11',
    weekday: 'Sunday',
    audience: 'adults' as const,
    scripture: 'But now the righteousness of God without the law is manifested (Romans 3:21).',
    scriptureReference: 'Romans 3:21',
    message: ['Many have read **Paul’s** words.', 'You’re *not* struggling to become righteous.'],
    prayerLabel: 'Prayer' as const,
    prayer: 'Dear Father, thank you.',
    extras: [],
    furtherStudy: 'Romans 5:17',
    oneYearPlan: '1 Thessalonians 5:1-28',
    twoYearPlan: 'Luke 1:57-80',
    author: 'Pastor Chris Oyakhilome',
  };

  it('formats the whole day for WhatsApp', () => {
    const text = devotionalShareText(post, 'https://example.org/devotionals/x');
    expect(text.startsWith('*RHAPSODY OF REALITIES*\n_Sunday, 11th October 2026_')).toBe(true);
    expect(text).toContain('*RIGHTEOUSNESS APART FROM THE LAW*');
    expect(text).toContain('_But now the righteousness of God without the law is manifested._ (Romans 3:21)');
    expect(text).toContain('Many have read *Paul’s* words.');
    expect(text).toContain('You’re _not_ struggling');
    expect(text).toContain('*PRAYER*\nDear Father, thank you.');
    expect(text).toContain('*1-YEAR BIBLE READING PLAN:* 1 Thessalonians 5:1-28');
    expect(text.endsWith('Read, listen and share: https://example.org/devotionals/x')).toBe(true);
    expect(text).not.toMatch(/\n{3,}/);
  });

  it('converts Markdown emphasis', () => {
    expect(toWhatsAppMarkup('**bold** and *italic* and [a link](https://x.y)')).toBe('*bold* and _italic_ and a link');
  });

  it('builds share intents with everything encoded', () => {
    const args = { url: 'https://e.org/d?x=1', text: 'Hello & welcome', title: 'T' };
    expect(shareUrl('whatsapp', args)).toBe(`https://wa.me/?text=${encodeURIComponent('Hello & welcome\n\nhttps://e.org/d?x=1')}`);
    expect(shareUrl('telegram', args)).toContain('url=https%3A%2F%2Fe.org%2Fd%3Fx%3D1');
    expect(shareUrl('email', args).startsWith('mailto:?subject=T&body=')).toBe(true);
    expect(devotionalTeaser(post)).toContain('Rhapsody of Realities — 11th October 2026: “Righteousness Apart From the Law”');
  });
});
