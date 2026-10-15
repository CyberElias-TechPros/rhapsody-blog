'use client';

/**
 * "Remind me every day": adds a repeating event with an alert to the reader's own calendar —
 * Apple Calendar, Google Calendar, Outlook, Samsung Calendar — linking to `/today`. No push
 * permission, no account, nothing stored on a server; removing the event stops it.
 */

import { useState } from 'react';
import { BellRing, CalendarPlus, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLocalStore } from '@/hooks/useLocalStore';
import { AUDIENCES, AUDIENCE_ORDER, type AudienceId } from '@/lib/audiences';
import { createLocalStore } from '@/lib/local-store';
import { localDateKey } from '@/lib/reader-data';
import { buildDailyReminderIcs, googleCalendarUrl } from '@/lib/reminders';
import { AUDIENCE_SEARCH_NAME } from '@/lib/seo';

interface ReminderPrefs {
  time: string;
  audience: AudienceId;
}

const reminderStore = createLocalStore<ReminderPrefs>('rhapsody.reminder.v1', { time: '06:00', audience: 'adults' }, (raw) => {
  const v = (raw ?? {}) as Partial<ReminderPrefs>;
  return {
    time: typeof v.time === 'string' && /^\d{2}:\d{2}$/.test(v.time) ? v.time : '06:00',
    audience: v.audience && v.audience in AUDIENCES ? v.audience : 'adults',
  };
});

export function ReminderDialog({
  trigger,
  defaultAudience,
}: {
  trigger?: React.ReactNode;
  defaultAudience?: AudienceId;
}) {
  const saved = useLocalStore(reminderStore);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [audience, setAudience] = useState<AudienceId | null>(null);
  const chosenTime = time ?? saved.time;
  const chosenAudience = audience ?? defaultAudience ?? saved.audience;

  const details = () => {
    const query = chosenAudience === 'adults' ? '' : `?audience=${chosenAudience}`;
    const url = `${window.location.origin}/today${query}`;
    const name = AUDIENCE_SEARCH_NAME[chosenAudience];
    return {
      time: chosenTime,
      startDate: localDateKey(Date.now()),
      url,
      title: `${name} — today’s devotional`,
      description: `Read today’s ${name}: the message, the opening scripture, the ${
        chosenAudience === 'early-readers' ? 'prayer' : 'prayer or confession and the Bible reading plan'
      }.`,
    };
  };

  const remember = () => reminderStore.write({ time: chosenTime, audience: chosenAudience });

  const downloadIcs = () => {
    const ics = buildDailyReminderIcs({ ...details(), uid: `daily-${chosenAudience}@${window.location.host}` });
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `rhapsody-daily-reminder-${chosenAudience}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
    remember();
    toast.success('Reminder file downloaded', { description: 'Open it to add the daily reminder to your calendar.' });
  };

  const openGoogle = () => {
    let zone: string | undefined;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      zone = undefined;
    }
    window.open(googleCalendarUrl(details(), zone), '_blank', 'noopener,noreferrer');
    remember();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <BellRing className="w-4 h-4 mr-1.5" aria-hidden="true" /> Daily reminder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
            <BellRing className="w-5 h-5 text-primary" aria-hidden="true" /> Never miss a day
          </DialogTitle>
          <DialogDescription>
            Add a daily reminder to your phone’s calendar. It opens today’s devotional at the time you choose — no app, account or
            notifications permission needed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="reminder-time" className="text-sm font-medium">
              Remind me at
            </label>
            <input
              id="reminder-time"
              type="time"
              value={chosenTime}
              onChange={(e) => setTime(e.target.value || '06:00')}
              className="rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium mb-1.5">Edition</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {AUDIENCE_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={chosenAudience === id}
                  onClick={() => setAudience(id)}
                  className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                    chosenAudience === id ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-secondary'
                  }`}
                >
                  {id === 'teens' ? 'TeeVo (teens)' : AUDIENCES[id].shortLabel}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-2 pt-1">
            <Button type="button" onClick={downloadIcs}>
              <Download className="w-4 h-4 mr-2" aria-hidden="true" /> Add to calendar (Apple, Outlook, Samsung…)
            </Button>
            <Button type="button" variant="outline" onClick={openGoogle}>
              <CalendarPlus className="w-4 h-4 mr-2" aria-hidden="true" /> Add to Google Calendar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">To stop the reminder, delete the event from your calendar.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
