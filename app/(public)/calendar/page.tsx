import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { CalendarGrid, DateJump } from '@/components/calendar/CalendarGrid';
import { PageHeader } from '@/components/common/StateBlocks';
import { getAvailableMonths, getCalendarMonth, getEditions, siteTimeZone, todayIso } from '@/lib/content';
import { AUDIENCES, AUDIENCE_ORDER, isAudience, type AudienceId } from '@/lib/audiences';
import { AUDIENCE_COOKIE, parseAudienceCookie } from '@/lib/audience-pref';
import { formatMonthYear } from '@/lib/format';
import { AUDIENCE_SEARCH_NAME, breadcrumbJsonLd, jsonLdString, pageMetadata } from '@/lib/seo';
import { cn } from '@/lib/utils';

/** Reads `?month=` and `?audience=`, and "today" — so it renders per request. */
export const dynamic = 'force-dynamic';

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const params = await searchParams;
  const base = pageMetadata({
    title: 'Rhapsody of Realities Calendar — Read Any Date',
    description:
      'Open Rhapsody of Realities for any date: a calendar of every daily devotional, TeeVo for teens and Early Readers, month by month — with the days you have read ticked off.',
    path: '/calendar',
    absolute: true,
  });
  // Month and edition views are the same page re-filtered: crawl their links, index the base page.
  return params.month || params.audience ? { ...base, robots: { index: false, follow: true } } : base;
}

const pick = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

/** `2026-10` → `Oct ’26`, for the compact month chips. */
function shortMonth(month: string): string {
  const [year, number] = month.split('-').map(Number);
  const name = new Date(Date.UTC(year, number - 1, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${name} ’${String(year).slice(2)}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const requested = pick(params.audience);
  const preferred = parseAudienceCookie((await cookies()).get(AUDIENCE_COOKIE)?.value);
  const audience: AudienceId = isAudience(requested) ? requested : (preferred ?? 'adults');
  const today = todayIso(new Date(), siteTimeZone());
  const months = getAvailableMonths(audience);
  const requestedMonth = pick(params.month);
  const month =
    requestedMonth && months.includes(requestedMonth)
      ? requestedMonth
      : months.includes(today.slice(0, 7))
        ? today.slice(0, 7)
        : (months[months.length - 1] ?? today.slice(0, 7));
  const index = months.indexOf(month);
  const previous = index > 0 ? months[index - 1] : undefined;
  const next = index >= 0 && index < months.length - 1 ? months[index + 1] : undefined;
  const days = getCalendarMonth(month, audience);
  const edition = getEditions(audience).find((e) => e.slug.startsWith(month));
  const href = (m: string, a: AudienceId = audience) => `/calendar?month=${m}${a === 'adults' ? '' : `&audience=${a}`}`;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Calendar', path: '/calendar' },
  ];

  return (
    <div className="container py-12 md:py-16 max-w-6xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs)) }} />
      <Breadcrumbs crumbs={crumbs} className="mb-8" />
      <PageHeader
        eyebrow="Read any day"
        title="Rhapsody of Realities calendar"
        subtitle="Every daily devotional by date. Days you have finished are ticked — your history stays on this device."
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Edition" className="inline-flex rounded-full border border-border bg-card p-1">
          {AUDIENCE_ORDER.map((id) => (
            <Link
              key={id}
              href={href(getAvailableMonths(id).includes(month) ? month : (getAvailableMonths(id).slice(-1)[0] ?? month), id)}
              aria-current={id === audience ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                id === audience ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {id === 'teens' ? 'TeeVo' : AUDIENCES[id].shortLabel}
            </Link>
          ))}
        </nav>
        {months.length > 0 && <DateJump audience={audience} defaultDate={today} min={`${months[0]}-01`} max={`${months[months.length - 1]}-31`} />}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        {previous ? (
          <Link href={href(previous)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm hover:bg-secondary" rel="prev">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> {formatMonthYear(previous)}
          </Link>
        ) : (
          <span />
        )}
        <h2 className="font-serif text-2xl md:text-3xl font-semibold text-center">
          {AUDIENCE_SEARCH_NAME[audience]} {formatMonthYear(month)}
        </h2>
        {next ? (
          <Link href={href(next)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm hover:bg-secondary" rel="next">
            {formatMonthYear(next)} <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div className="mt-6">
        <CalendarGrid month={month} today={today} days={days.map(({ date, slug, title }) => ({ date, slug, title }))} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>
          {days.length} {days.length === 1 ? 'devotional' : 'devotionals'} in {formatMonthYear(month)}.
          {edition ? (
            <>
              {' '}
              <Link href={`/editions/${edition.slug}`} className="text-primary hover:underline">
                Read the whole edition as a list →
              </Link>
            </>
          ) : null}
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="All months">
          {months.map((m) => (
            <li key={m}>
              <Link
                href={href(m)}
                aria-current={m === month ? 'page' : undefined}
                className={cn('rounded-full border px-2.5 py-1 text-xs', m === month ? 'border-primary text-primary' : 'border-border hover:border-primary/40')}
              >
                {shortMonth(m)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
