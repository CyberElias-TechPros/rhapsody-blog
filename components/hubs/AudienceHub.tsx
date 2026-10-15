import Link from 'next/link';
import { ArrowRight, CalendarDays, CalendarSearch, ChevronRight } from 'lucide-react';
import { DevotionalCard } from '@/components/DevotionalCard';
import { AdSlot } from '@/components/common/AdSlot';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { ListenButton } from '@/components/audio/ListenButton';
import { ReminderDialog } from '@/components/reader/ReminderDialog';
import { DayRollover } from '@/components/home/DayRollover';
import { Button } from '@/components/ui/button';
import { getEditions, getFeaturedDevotional, getLatestDevotionals, siteTimeZone, todayIso } from '@/lib/content';
import { AUDIENCES, type AudienceId } from '@/lib/audiences';
import { stripTrailingReference } from '@/lib/bible';
import { formatDate, formatDayMonthYear, formatWeekday } from '@/lib/format';
import {
  AUDIENCE_HUB,
  AUDIENCE_SEARCH_NAME,
  breadcrumbJsonLd,
  collectionJsonLd,
  faqJsonLd,
  jsonLdString,
  type Faq,
} from '@/lib/seo';
import { devotionalScript } from '@/lib/tts';

export interface HubCopy {
  /** Short name in the breadcrumb ("TeeVo"). */
  crumb: string;
  /** One line under the H1. */
  intro: string;
  /** "What is …?" paragraphs. */
  about: string[];
  faqs: Faq[];
}

/**
 * The landing page for one edition of the devotional — `/teevo`, `/early-readers`: today's day in
 * that edition, the most recent days, every monthly edition, and a plain explanation of what the
 * edition is. Rendered per request (like the home page) so "today" is always today.
 */
export function AudienceHub({ audience, copy }: { audience: AudienceId; copy: HubCopy }) {
  const now = new Date();
  const timeZone = siteTimeZone();
  const today = todayIso(now, timeZone);
  const featured = getFeaturedDevotional(now, audience, timeZone);
  const isToday = featured?.date === today;
  const recent = getLatestDevotionals(7, audience, today).filter((post) => post.slug !== featured?.slug).slice(0, 6);
  const editions = getEditions(audience);
  const name = AUDIENCE_SEARCH_NAME[audience];
  const path = AUDIENCE_HUB[audience];
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: copy.crumb, path },
  ];
  const spoken = featured ? devotionalScript(featured) : null;

  const structured = [
    breadcrumbJsonLd(crumbs),
    collectionJsonLd({
      name: `${name} — daily devotional`,
      description: copy.intro,
      path,
      items: [featured, ...recent].filter(Boolean).map((post) => ({ name: `${post!.title} — ${formatDayMonthYear(post!.date)}`, path: `/devotionals/${post!.slug}` })),
    }),
    ...(copy.faqs.length ? [faqJsonLd(copy.faqs)] : []),
  ];

  return (
    <div className="container py-12 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(structured) }} />
      <DayRollover date={today} />
      <Breadcrumbs crumbs={crumbs} className="mb-8" />

      <header className="max-w-3xl animate-fade-in">
        <p className="text-sm uppercase tracking-wider text-primary font-medium">{AUDIENCES[audience].series}</p>
        <h1 className="mt-2 font-serif text-4xl md:text-6xl font-semibold leading-[1.08] text-balance">{name} Today</h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{copy.intro}</p>
      </header>

      {featured && (
        <section aria-labelledby="hub-today" className="mt-10 rounded-3xl border border-border/70 gradient-card p-6 md:p-10 shadow-soft">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="w-4 h-4 text-primary" aria-hidden="true" />
            {isToday ? 'Today' : 'Most recent'} · {formatWeekday(featured.date)}, {formatDayMonthYear(featured.date)}
          </p>
          <h2 id="hub-today" className="mt-3 font-serif text-3xl md:text-5xl font-semibold leading-tight text-balance">
            <Link href={`/devotionals/${featured.slug}`} className="hover:text-primary transition-colors">
              {featured.title}
            </Link>
          </h2>
          {featured.subtitle && <p className="mt-2 font-serif text-xl italic text-muted-foreground">{featured.subtitle}</p>}
          {featured.scripture && (
            <blockquote className="mt-6 scripture-card max-w-3xl">
              <p>{stripTrailingReference(featured.scripture)}</p>
              {featured.scriptureReference && (
                <footer className="mt-3 not-italic font-sans text-sm text-muted-foreground">— {featured.scriptureReference}</footer>
              )}
            </blockquote>
          )}
          <p className="mt-6 max-w-3xl text-muted-foreground leading-relaxed">{featured.excerpt}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="gradient-hero text-primary-foreground border-0 shadow-elegant">
              <Link href={`/devotionals/${featured.slug}`}>
                {isToday ? `Read today’s ${audience === 'teens' ? 'TeeVo' : 'devotional'}` : 'Read the latest'}
                <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
              </Link>
            </Button>
            {spoken && <ListenButton script={spoken} size="lg" showDuration />}
            <ReminderDialog defaultAudience={audience} />
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="hub-recent" className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <h2 id="hub-recent" className="font-serif text-3xl font-semibold">
              Recent {name} devotionals
            </h2>
            <Link
              href={`/calendar?audience=${audience}`}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <CalendarSearch className="w-4 h-4" aria-hidden="true" /> Pick a date
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recent.map((post, i) => (
              <DevotionalCard key={post.slug} post={post} index={i} compact />
            ))}
          </div>
        </section>
      )}

      <AdSlot position="feed" format="fluid" className="mt-14" />

      {editions.length > 0 && (
        <section aria-labelledby="hub-editions" className="mt-16">
          <h2 id="hub-editions" className="font-serif text-3xl font-semibold">
            Every {name} edition
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {editions.map((edition) => (
              <li key={edition.slug}>
                <Link
                  href={`/editions/${edition.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4 hover:border-primary/40 transition-colors"
                >
                  <span>
                    <span className="block font-serif text-lg font-semibold group-hover:text-primary transition-colors">
                      {name} {edition.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {edition.postCount} days · {formatDate(edition.firstDate)} – {formatDate(edition.lastDate)}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="hub-about" className="mt-16 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 id="hub-about" className="font-serif text-3xl font-semibold">
            What is {name}?
          </h2>
          {copy.about.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mt-4 text-muted-foreground leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
        {copy.faqs.length > 0 && (
          <div>
            <h2 className="font-serif text-3xl font-semibold">Questions</h2>
            <dl className="mt-4 space-y-4">
              {copy.faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-border/70 bg-card px-5 py-4">
                  <dt className="font-medium">{faq.question}</dt>
                  <dd className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}
