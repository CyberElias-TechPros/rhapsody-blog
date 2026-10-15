'use client';

/**
 * My Rhapsody — everything the site keeps for a reader, in one place, on their device:
 * streaks and a 12-week activity map, the devotional to continue, history, notes, Bible-plan
 * progress, preferences, reminders, the app/offline status, and export / import / delete.
 */

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  BookmarkCheck,
  BookOpenCheck,
  CloudDownload,
  Download,
  Flame,
  History as HistoryIcon,
  Layers,
  NotebookPen,
  PlayCircle,
  Settings2,
  Smartphone,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AudiencePicker } from '@/components/home/AudiencePicker';
import { ReadingSettingsPanel } from '@/components/reader/ReadingSettingsPanel';
import { ReminderDialog } from '@/components/reader/ReminderDialog';
import { InstallAppButton } from '@/components/pwa/InstallAppButton';
import { offlineSetsStore } from '@/components/pwa/SaveOfflineButton';
import { useHydrated, useLocalStore, useLocalToday } from '@/hooks/useLocalStore';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import { AUDIENCE_COOKIE, parseAudienceCookie } from '@/lib/audience-pref';
import { clearLocalData, exportLocalData, importLocalData } from '@/lib/local-store';
import {
  currentStreak,
  daysReadInMonth,
  daysStore,
  historyStore,
  inProgress,
  localDateKey,
  longestStreak,
  notesStore,
  planCounts,
  planStore,
  recentDateKeys,
  recentlyRead,
} from '@/lib/reader-data';
import { cn } from '@/lib/utils';

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Flame; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
      <p className="mt-3 font-serif text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ id, icon: Icon, title, action, children }: { id?: string; icon: typeof Flame; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-heading` : undefined} className="mt-12 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-3">
        <h2 id={id ? `${id}-heading` : undefined} className="flex items-center gap-2 font-serif text-2xl font-semibold">
          <Icon className="w-5 h-5 text-primary" aria-hidden="true" /> {title}
        </h2>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const formatDay = (dateIso: string) =>
  new Date(`${dateIso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function readAudienceCookie() {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((part) => part.startsWith(`${AUDIENCE_COOKIE}=`));
  return parseAudienceCookie(match?.split('=')[1]);
}

export function MyRhapsody() {
  const hydrated = useHydrated();
  const history = useLocalStore(historyStore);
  const days = useLocalStore(daysStore);
  const notes = useLocalStore(notesStore);
  const plan = useLocalStore(planStore);
  const offline = useLocalStore(offlineSetsStore);
  const { count: savedCount } = useSavedPosts();
  const [noteQuery, setNoteQuery] = useState('');
  const [storage, setStorage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then(({ usage }) => {
        if (typeof usage === 'number') setStorage(usage > 1_048_576 ? `${(usage / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(usage / 1024))} KB`);
      })
      .catch(() => {});
  }, [offline]);

  const today = useLocalToday();
  const stats = useMemo(() => {
    if (!today) return null;
    const finished = Object.values(history).filter((entry) => entry.completedAt).length;
    return {
      streak: currentStreak(days, today),
      longest: longestStreak(days),
      month: daysReadInMonth(days, today.slice(0, 7)),
      finished,
      plan: planCounts(plan),
      heat: recentDateKeys(today, 84),
    };
  }, [days, history, plan, today]);

  const noteList = useMemo(() => {
    const q = noteQuery.trim().toLowerCase();
    return Object.values(notes)
      .filter((note) => !q || note.text.toLowerCase().includes(q) || note.title.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, noteQuery]);

  if (!hydrated || !stats) {
    return <div className="mt-10 h-64 rounded-2xl bg-secondary/50 animate-pulse" aria-busy="true" aria-label="Loading your reading data" />;
  }

  const resume = inProgress(history, 3);
  const recent = recentlyRead(history, 12);
  const empty = !Object.keys(history).length && !Object.keys(notes).length && !savedCount;
  const audience = readAudienceCookie() ?? 'adults';

  const exportData = () => {
    const data = { app: 'rhapsody-of-realities', version: 1, exportedAt: new Date().toISOString(), data: exportLocalData() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `my-rhapsody-${localDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
    toast.success('Your data was exported', { description: 'Keep the file to restore it on another phone or browser.' });
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { app?: string; data?: unknown };
      if (parsed.app !== 'rhapsody-of-realities' || !parsed.data) throw new Error('not ours');
      const restored = importLocalData(parsed.data);
      toast.success('Data restored', { description: `${restored} item${restored === 1 ? '' : 's'} imported.` });
    } catch {
      toast.error('That file is not a My Rhapsody export.');
    }
  };

  const clearAll = () => {
    if (!window.confirm('Delete all your notes, history, streak, saved devotionals and settings from this device? This cannot be undone.')) return;
    clearLocalData();
    toast('Everything was deleted from this device.');
  };

  const heatLevel = (count: number) => (count >= 3 ? 'bg-primary' : count === 2 ? 'bg-primary/70' : count === 1 ? 'bg-primary/40' : 'bg-secondary');

  return (
    <div>
      {empty && (
        <div className="mt-10 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6">
          <p className="font-serif text-xl font-semibold">Start with today’s devotional</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Read to the end (or tap “Mark as read”) to start a streak. Notes, saved devotionals and your Bible-plan progress will
            appear here — kept on this device, no account needed.
          </p>
          <Button asChild className="mt-4">
            <Link href="/today">Read today’s devotional</Link>
          </Button>
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Flame} label="Day streak" value={stats.streak} hint={days[today] ? 'Read today ✓' : stats.streak ? 'Read today to keep it' : 'Finish a devotional to start'} />
        <Stat icon={Trophy} label="Longest streak" value={stats.longest} hint="days in a row" />
        <Stat icon={BookOpenCheck} label="This month" value={stats.month} hint="days with a devotional read" />
        <Stat icon={BookmarkCheck} label="Finished" value={stats.finished} hint={`${savedCount} saved · ${Object.keys(notes).length} notes`} />
      </div>

      <Section icon={Flame} title="Last 12 weeks">
        <div className="overflow-x-auto">
          <div className="grid grid-flow-col grid-rows-7 gap-1 w-max" role="img" aria-label={`Reading activity over the last 12 weeks: ${stats.heat.filter((d) => days[d]).length} days with reading.`}>
            {stats.heat.map((date) => (
              <span key={date} title={`${formatDay(date)}${days[date] ? ` — ${days[date]} read` : ''}`} className={cn('h-4 w-4 rounded-[4px]', heatLevel(days[date] ?? 0), date === today && 'ring-2 ring-primary/50')} />
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Each square is a day; darker means more devotionals finished.</p>
      </Section>

      {resume.length > 0 && (
        <Section icon={PlayCircle} title="Continue reading">
          <ul className="grid gap-3 md:grid-cols-3">
            {resume.map((entry) => (
              <li key={entry.slug}>
                <Link href={`/devotionals/${entry.slug}`} className="block rounded-2xl border border-border/70 bg-card p-4 hover:border-primary/40 transition-colors">
                  <p className="text-xs text-muted-foreground">{formatDay(entry.date)}</p>
                  <p className="mt-1 font-serif text-lg font-semibold leading-snug">{entry.title}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-secondary" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(entry.progress * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{Math.round(entry.progress * 100)}% read</p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="notes" icon={NotebookPen} title={`My notes (${Object.keys(notes).length})`}>
        {Object.keys(notes).length === 0 ? (
          <p className="text-sm text-muted-foreground">Notes you write under a devotional appear here.</p>
        ) : (
          <>
            <label htmlFor="note-search" className="sr-only">
              Search your notes
            </label>
            <input
              id="note-search"
              value={noteQuery}
              onChange={(e) => setNoteQuery(e.target.value)}
              placeholder="Search your notes…"
              className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {noteList.map((note) => (
                <li key={note.slug} className="rounded-2xl border border-border/70 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/devotionals/${note.slug}`} className="font-serif text-lg font-semibold leading-snug hover:text-primary">
                      {note.title}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm('Delete this note?')) return;
                        notesStore.update((all) => {
                          const { [note.slug]: _removed, ...rest } = all;
                          return rest;
                        });
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete note on ${note.title}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDay(note.date)} · edited {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed line-clamp-6">{note.text}</p>
                </li>
              ))}
            </ul>
            {noteList.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No notes match “{noteQuery}”.</p>}
          </>
        )}
      </Section>

      <Section icon={Layers} title="Bible reading plan" action={<Link href="/reading-plans" className="text-sm text-primary hover:underline">Today’s portions →</Link>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: '1-year plan', count: stats.plan.one, total: 365 },
            { label: '2-year plan', count: stats.plan.two, total: 730 },
          ].map((p) => (
            <div key={p.label} className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm font-medium">{p.label}</p>
              <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">
                {p.count} <span className="text-base font-normal text-muted-foreground">/ {p.total} days</span>
              </p>
              <div className="mt-3 h-2 rounded-full bg-secondary" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (p.count / p.total) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        icon={HistoryIcon}
        title="Recently read"
        action={
          recent.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('Clear your reading history? Your streak and notes are kept.')) historyStore.clear();
              }}
            >
              Clear history
            </Button>
          ) : null
        }
      >
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Devotionals you open will be listed here.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-card">
            {recent.map((entry) => (
              <li key={entry.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link href={`/devotionals/${entry.slug}`} className="min-w-0 hover:text-primary">
                  <span className="block truncate font-medium">{entry.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDay(entry.date)}</span>
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.completedAt ? '✓ Read' : `${Math.round(entry.progress * 100)}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="settings" icon={Settings2} title="Preferences">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Open the site on this edition</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Used by the home page, “Today” and the installed app.</p>
            <AudiencePicker current={audience} className="mt-3" />
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <ReadingSettingsPanel />
          </div>
        </div>
      </Section>

      <Section id="reminders" icon={BellRing} title="Daily reminder">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Add a repeating event to your calendar that opens today’s devotional at your chosen time. Prefer email? Subscribe in the
          footer.
        </p>
        <div className="mt-4">
          <ReminderDialog defaultAudience={audience} />
        </div>
      </Section>

      <Section id="offline" icon={Smartphone} title="App and offline reading">
        <div className="flex flex-wrap items-center gap-3">
          <InstallAppButton fallback={<p className="text-sm text-muted-foreground">Use your browser’s menu → “Install app” or “Add to Home screen”.</p>} />
          <Button asChild variant="ghost" size="sm">
            <Link href="/offline">
              <CloudDownload className="w-4 h-4 mr-1.5" aria-hidden="true" /> What’s saved offline
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Every devotional you open is kept for offline reading.
          {Object.keys(offline).length > 0 && ` Months saved: ${Object.keys(offline).length}.`}
          {storage && ` This site uses about ${storage} on this device.`}
        </p>
      </Section>

      <Section icon={Download} title="Your data">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Everything above is stored only in this browser. Export it to keep a backup or move it to another phone; importing merges
          the file into this device.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportData}>
            <Download className="w-4 h-4 mr-1.5" aria-hidden="true" /> Export my data
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload className="w-4 h-4 mr-1.5" aria-hidden="true" /> Import
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Choose an export file to import"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importData(file);
              e.target.value = '';
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-1.5" aria-hidden="true" /> Delete everything
          </Button>
        </div>
      </Section>
    </div>
  );
}
