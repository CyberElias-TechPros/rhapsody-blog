// @vitest-environment jsdom
/**
 * Smoke-and-behaviour tests for the reader's client components: they render in a browser-like
 * environment, and each user action lands in the right local store. (No headless browser runs in
 * CI; these catch hook misuse and store wiring that type-checking cannot.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import { NotesCard } from '@/components/reader/NotesCard';
import { PlanCheck } from '@/components/reader/PlanCheck';
import { MarkReadButton } from '@/components/reader/ReadingToolbar';
import { ReadingSettingsPanel } from '@/components/reader/ReadingSettingsPanel';
import { ScriptureText } from '@/components/reader/ScriptureText';
import { ContinueReading } from '@/components/home/ContinueReading';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { MyRhapsody } from '@/components/me/MyRhapsody';
import { daysStore, historyStore, localDateKey, notesStore, planStore, prefsStore } from '@/lib/reader-data';

const entry = { slug: '2026-10-15-the-reality-of-christianity', title: 'The Reality of Christianity', date: '2026-10-15', audience: 'adults' as const };

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('NotesCard', () => {
  it('autosaves what the reader types, on the device', () => {
    vi.useFakeTimers();
    render(<NotesCard slug={entry.slug} title={entry.title} date={entry.date} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Christ in me, the hope of glory.' } });
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(notesStore.read()[entry.slug]).toMatchObject({ text: 'Christ in me, the hope of glory.', title: entry.title });
  });
});

describe('PlanCheck', () => {
  it('ticks and unticks a reading-plan portion', () => {
    render(<PlanCheck slug={entry.slug} date={entry.date} which="one" portion="1 Kings 9" />);
    const button = screen.getByRole('button', { name: /mark 1 kings 9 as read/i });
    fireEvent.click(button);
    expect(planStore.read()[entry.slug]?.one).toBeTypeOf('number');
    fireEvent.click(screen.getByRole('button', { name: /unmark 1 kings 9/i }));
    expect(planStore.read()[entry.slug]).toBeUndefined();
  });
});

describe('MarkReadButton', () => {
  it('finishes the devotional and credits today toward the streak — and can undo it', () => {
    render(<MarkReadButton entry={entry} />);
    fireEvent.click(screen.getByRole('button', { name: /mark as read/i }));
    expect(historyStore.read()[entry.slug]?.completedAt).toBeTypeOf('number');
    expect(daysStore.read()[localDateKey(new Date())]).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /read/i }));
    expect(historyStore.read()[entry.slug]?.completedAt).toBeUndefined();
    expect(daysStore.read()[localDateKey(new Date())]).toBeUndefined();
  });
});

describe('ReadingSettingsPanel', () => {
  it('saves settings and mirrors them onto <html>', async () => {
    const { ReadingPrefsSync } = await import('@/components/reader/ReadingPrefsSync');
    render(
      <>
        <ReadingPrefsSync />
        <ReadingSettingsPanel />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: /extra large/i }));
    fireEvent.click(screen.getByRole('button', { name: /legible/i }));
    fireEvent.change(screen.getByLabelText(/bible translation/i), { target: { value: 'NKJV' } });
    expect(prefsStore.read()).toMatchObject({ size: 'xl', font: 'legible', version: 'NKJV' });
    expect(document.documentElement.dataset.readingSize).toBe('xl');
    expect(document.getElementById('font-legible')).not.toBeNull();
  });
});

describe('ScriptureText', () => {
  it('links references in the reader’s chosen translation', () => {
    prefsStore.write({ ...prefsStore.read(), version: 'AMP' });
    render(<ScriptureText text="Romans 5:17; 2 Corinthians 5:21 NKJV" />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toContain('version=AMP');
    expect(links[1].getAttribute('href')).toContain('version=NKJV'); // the reference names its own
  });
});

describe('ContinueReading and CalendarGrid', () => {
  it('greet a returning reader with their streak and unfinished devotional', () => {
    const today = localDateKey(new Date());
    daysStore.write({ [today]: 1 });
    historyStore.write({
      [entry.slug]: { ...entry, firstReadAt: 1, lastReadAt: 2, progress: 0.4, position: 0.4 },
    });
    render(<ContinueReading />);
    expect(screen.getByText(/day streak/i)).toBeTruthy();
    expect(screen.getByText(/Continue “The Reality of Christianity” · 40%/)).toBeTruthy();
  });

  it('renders nothing for a first-time visitor', () => {
    const { container } = render(<ContinueReading />);
    expect(container.textContent).toBe('');
  });

  it('ticks the days already read', () => {
    historyStore.write({ [entry.slug]: { ...entry, firstReadAt: 1, lastReadAt: 2, progress: 1, position: 1, completedAt: 2 } });
    render(<CalendarGrid month="2026-10" today="2026-10-15" days={[{ date: entry.date, slug: entry.slug, title: entry.title }]} />);
    const link = screen.getByRole('link', { name: /The Reality of Christianity/ });
    expect(link.getAttribute('href')).toBe(`/devotionals/${entry.slug}`);
    expect(screen.getByLabelText('Read')).toBeTruthy();
  });
});

describe('MyRhapsody', () => {
  it('shows streak, notes and plan progress from the device', () => {
    const today = localDateKey(new Date());
    daysStore.write({ [today]: 2 });
    notesStore.write({ [entry.slug]: { slug: entry.slug, title: entry.title, date: entry.date, text: 'Joined to the Lord.', updatedAt: Date.now() } });
    planStore.write({ [entry.slug]: { date: entry.date, one: Date.now() } });
    render(<MyRhapsody />);
    expect(screen.getByText('Day streak')).toBeTruthy();
    expect(screen.getByText('Joined to the Lord.')).toBeTruthy();
    expect(screen.getByText(/My notes \(1\)/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /export my data/i })).toBeTruthy();
  });
});
