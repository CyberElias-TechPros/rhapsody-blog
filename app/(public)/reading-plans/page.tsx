import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CalendarDays, Layers } from 'lucide-react';
import { AdSlot } from '@/components/common/AdSlot';
import { ListenButton } from '@/components/audio/ListenButton';
import { EmptyState, PageHeader } from '@/components/common/StateBlocks';
import { Button } from '@/components/ui/button';
import { AUDIENCES, AUDIENCE_ORDER, isAudience, type AudienceId } from '@/lib/audiences';
import { getDevotionalForDate, getReadingPlans, siteTimeZone, todayIso } from '@/lib/content';
import { devotionalScript } from '@/lib/tts';
import { isValidDateIso } from '@/lib/time';
import { formatDate, formatDayHeading } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Bible reading plans',
  description:
    'The one-year and two-year Bible reading plans printed in every daily devotional — today’s portion, the week around it, and any day you want to catch up on.',
  alternates: { canonical: '/reading-plans' },
};

/**
 * The plans are printed on the same page as the devotional and change every day, so this page
 * answers the same question the front page does: what is *today*? It renders per request for the
 * same reason, and accepts `?date=` so a reader who missed a week can pick the plan up where they
 * left it rather than being told to scroll.
 */
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ date?: string; audience?: string }>;
}

export default async function ReadingPlansPage({ searchParams }: Props) {
  const params = await searchParams;
  const timeZone = siteTimeZone();
  const now = new Date();
  const today = todayIso(now, timeZone);

  const audience: AudienceId = isAudience(params.audience) ? params.audience : 'adults';
  // A requested date is honoured; a malformed one falls back to today rather than to a 404, since
  // the page is still useful without it.
  const requested = typeof params.date === 'string' && isValidDateIso(params.date) ? params.date : '';
  const focus = requested || today;

  const focusPost = getDevotionalForDate(focus, audience);
  const spoken = focusPost ? devotionalScript(focusPost) : null;
  const week = getReadingPlans(focus, 7, audience);
  const isToday = focus === today;

  return (
    <div className="container py-16 md:py-20 max-w-5xl">
      <PageHeader
        eyebrow="Read through the Bible"
        title="The reading plans, day by day."
        subtitle="Every edition of Rhapsody of Realities prints two Bible reading plans with the day’s message: the whole Bible in a year, and again more gently over two. They are reproduced here exactly, for today and for any day you want."
      />

      {/* The plans are printed per edition, and a teenager's portion is not the adult one. */}
      <nav aria-label="Choose an edition" className="mt-8 flex flex-wrap items-center gap-2">
        {AUDIENCE_ORDER.map((id) => (
          <Link
            key={id}
            href={`/reading-plans?audience=${id}${requested ? `&date=${requested}` : ''}`}
            aria-current={id === audience ? 'page' : undefined}
            title={AUDIENCES[id].blurb}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              id === audience
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/30'
            )}
          >
            {AUDIENCES[id].label}
          </Link>
        ))}
      </nav>

      {focusPost ? (
        <section
          aria-labelledby="focus-heading"
          className="mt-10 rounded-3xl border border-primary/25 bg-primary/5 p-6 md:p-10"
        >
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-background/70 border border-border px-3 py-1 text-xs uppercase tracking-wider font-medium">
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              {isToday ? 'Today' : requested ? 'The day you asked for' : 'Most recent'}
            </span>
            <span className="text-muted-foreground">{formatDayHeading(focus)}</span>
          </div>

          <h2 id="focus-heading" className="mt-4 font-serif text-3xl md:text-4xl font-semibold text-balance">
            <Link href={`/devotionals/${focusPost.slug}`} className="hover:text-primary transition-colors">
              {focusPost.title}
            </Link>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl leading-relaxed">{focusPost.excerpt}</p>

          <dl className="mt-8 grid sm:grid-cols-2 gap-4">
            {focusPost.oneYearPlan && (
              <div className="rounded-2xl border border-border/70 bg-background/80 px-5 py-4">
                <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  <Layers className="w-3.5 h-3.5" aria-hidden="true" /> 1-Year plan
                </dt>
                <dd className="mt-2 font-serif text-lg md:text-xl font-medium leading-snug">{focusPost.oneYearPlan}</dd>
              </div>
            )}
            {focusPost.twoYearPlan && (
              <div className="rounded-2xl border border-border/70 bg-background/80 px-5 py-4">
                <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  <Layers className="w-3.5 h-3.5" aria-hidden="true" /> 2-Year plan
                </dt>
                <dd className="mt-2 font-serif text-lg md:text-xl font-medium leading-snug">{focusPost.twoYearPlan}</dd>
              </div>
            )}
          </dl>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild className="gradient-hero text-primary-foreground border-0 shadow-soft">
              <Link href={`/devotionals/${focusPost.slug}`}>
                Read the devotional <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
              </Link>
            </Button>
            {spoken && <ListenButton script={spoken} showDuration />}
          </div>
        </section>
      ) : (
        <div className="mt-10">
          <EmptyState
            title={`No ${AUDIENCES[audience].label.toLowerCase()} devotional on ${formatDate(focus)}`}
            hint="That day is either still ahead of us or before the first edition in the library. Pick another day below."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={`/reading-plans?audience=${audience}`}>Back to today</Link>
              </Button>
            }
          />
        </div>
      )}

      {/* Any other day: the plans are a calendar, and a reader who missed a week needs the week. */}
      <section aria-labelledby="pick-heading" className="mt-14 rounded-2xl border border-border/70 bg-card p-6">
        <h2 id="pick-heading" className="font-serif text-xl font-semibold">
          Another day
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choose a date to see that day&rsquo;s portion in the {AUDIENCES[audience].label.toLowerCase()} edition.
        </p>
        <form method="get" action="/reading-plans" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Date
            <input
              type="date"
              name="date"
              defaultValue={focus}
              min="2026-01-01"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <input type="hidden" name="audience" value={audience} />
          <Button type="submit" variant="outline">
            Show that day
          </Button>
        </form>
      </section>

      {week.length > 0 && (
        <section aria-labelledby="week-heading" className="mt-14">
          <h2 id="week-heading" className="font-serif text-2xl font-semibold">
            The week to {formatDate(focus)}
          </h2>
          <ol className="mt-5 space-y-2">
            {week.map((day) => (
              <li key={day.date}>
                <Link
                  href={`/reading-plans?date=${day.date}&audience=${day.audience}`}
                  className={cn(
                    'group flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl border px-4 py-3 transition-colors',
                    day.date === focus
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/70 bg-card hover:border-primary/30'
                  )}
                >
                  <span className="w-32 shrink-0 text-sm font-medium">{formatDayHeading(day.date)}</span>
                  <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    <span className="text-foreground/80">1-Year:</span> {day.oneYearPlan || '—'}
                    <span className="mx-2 text-border" aria-hidden="true">|</span>
                    <span className="text-foreground/80">2-Year:</span> {day.twoYearPlan || '—'}
                  </span>
                  <span className="shrink-0 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.title} →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-14 rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground leading-relaxed">
        <h2 className="font-serif text-xl font-semibold text-foreground">How the two plans differ</h2>
        <p className="mt-3">
          The <strong className="text-foreground">1-Year plan</strong> takes the whole Bible from Genesis to
          Revelation in twelve months, in the order the edition prints it — a chapter or three a day. The{' '}
          <strong className="text-foreground">2-Year plan</strong> covers the same ground over two years, with
          shorter daily portions for a reader who wants to stay with the text rather than keep up with a calendar.
        </p>
        <p className="mt-3">
          Both are on every devotional page, in the RSS feed and in the daily email, so the reading never depends on
          having the booklet to hand. Today&rsquo;s is at the top of this page; the plans for every other day in the
          library are one date away.
        </p>
        <p className="mt-4">
          <Link href="/today" className="text-primary hover:underline inline-flex items-center gap-1.5">
            Open today&rsquo;s devotional <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </p>
      </section>

      <AdSlot position="page" className="mt-14" />
    </div>
  );
}
