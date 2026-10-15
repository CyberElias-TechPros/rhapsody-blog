import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BellRing,
  BookHeart,
  BookOpen,
  BookOpenText,
  CalendarDays,
  CalendarSearch,
  HelpCircle,
  Layers,
  Library,
  Shuffle,
  Sparkles,
  Users,
} from 'lucide-react';
import { Fragment } from 'react';
import { DevotionalCard } from '@/components/DevotionalCard';
import { AdSlot } from '@/components/common/AdSlot';
import { NewsletterForm } from '@/components/common/NewsletterForm';
import { Button } from '@/components/ui/button';
import {
  getContentStats,
  getDevotionalForDate,
  getEditions,
  getFeaturedDevotional,
  getLatestDevotionals,
  getReadingPlanFor,
  siteTimeZone,
  todayIso,
} from '@/lib/content';
import { devotionalScript } from '@/lib/tts';
import { DayRollover } from '@/components/home/DayRollover';
import { ListenButton } from '@/components/audio/ListenButton';
import { getKidsStats } from '@/lib/kids';
import { AUDIENCE_ORDER, AUDIENCES } from '@/lib/audiences';
import { AudienceBadge } from '@/components/common/AudienceBadge';
import { AudiencePicker } from '@/components/home/AudiencePicker';
import { ContinueReading } from '@/components/home/ContinueReading';
import { ReminderDialog } from '@/components/reader/ReminderDialog';
import { InstallAppButton } from '@/components/pwa/InstallAppButton';
import { AUDIENCE_COOKIE, parseAudienceCookie } from '@/lib/audience-pref';
import { formatDate, formatDayHeading, formatDayMonthYear, formatWeekday } from '@/lib/format';
import { AUDIENCE_HUB, AUDIENCE_SEARCH_NAME, clip } from '@/lib/seo';
import { SITE, absoluteUrl } from '@/lib/site';

/**
 * The title answers the most common search on the subject — "rhapsody of realities today" — with
 * the date in it, which is what the competing pages do and what a reader scanning results needs.
 */
export async function generateMetadata(): Promise<Metadata> {
  const now = new Date();
  const today = todayIso(now, siteTimeZone());
  const featured = getFeaturedDevotional(now, 'adults', siteTimeZone());
  const dated = featured && featured.date === today;
  const title = dated
    ? `Rhapsody of Realities Today, ${formatDayMonthYear(today)}: ${featured.title}`
    : `${SITE.name} Today — ${SITE.tagline}`;
  const description = dated
    ? clip(
        `Rhapsody of Realities today, ${formatWeekday(today)} ${formatDayMonthYear(today)}: “${featured.title}” by Pastor Chris Oyakhilome — the message, opening scripture${
          featured.scriptureReference ? ` (${featured.scriptureReference})` : ''
        }, ${featured.prayerLabel.toLowerCase()} and Bible reading plan. Plus TeeVo for teens and Early Readers.`,
        230
      )
    : SITE.description;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: '/' },
    // A page-level `openGraph` replaces the layout's wholesale, so the image is restated.
    openGraph: {
      title,
      description,
      url: '/',
      type: 'website',
      siteName: SITE.name,
      locale: SITE.locale,
      images: [{ url: absoluteUrl(SITE.ogImage), width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [absoluteUrl(SITE.ogImage)] },
  };
}

const EXPLORE = [
  { href: '/teevo', label: 'TeeVo for teens', hint: 'Today’s teen devotional', icon: Users },
  { href: '/early-readers', label: 'Early Readers', hint: 'For children aged 6–12', icon: Sparkles },
  { href: '/calendar', label: 'Calendar', hint: 'Open any date', icon: CalendarSearch },
  { href: '/bible', label: 'By Bible book', hint: 'Romans, John, Psalms…', icon: BookOpenText },
  { href: '/reading-plans', label: 'Bible reading plan', hint: 'Track the 1- and 2-year plans', icon: Layers },
  { href: '/me', label: 'My Rhapsody', hint: 'Streak, notes, history', icon: BookHeart },
  { href: '/random', label: 'Surprise me', hint: 'A random devotional', icon: Shuffle },
  { href: '/faq', label: 'Questions', hint: 'About Rhapsody of Realities', icon: HelpCircle },
] as const;

/**
 * The front page answers "what is today's devotional?", and an answer computed at build time is
 * wrong by the next morning — a prerender frozen on the day the image was built is exactly how a
 * site ends up showing the 10th of October forever. So this one route renders per request: the
 * corpus is memoised in memory, which makes the render a few milliseconds of array lookups, and
 * every other page stays a build-time artefact. `DayRollover` covers the reader who leaves the
 * tab open overnight.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const kids = getKidsStats();
  // The reader's preferred edition (Adults, TeeVo, Early Readers), if they picked one.
  const audience = parseAudienceCookie((await cookies()).get(AUDIENCE_COOKIE)?.value) ?? 'adults';
  const now = new Date();
  const timeZone = siteTimeZone();
  // The day the site is on, in the zone the edition is published in — not UTC, and not whatever
  // day it happened to be when this deployment was built.
  const today = todayIso(now, timeZone);
  const todays = getDevotionalForDate(today, audience);
  const editions = getEditions();
  const stats = getContentStats();
  // Today when the library has it; otherwise the most recent day that has actually arrived.
  // Never a day from later in the month, which is what a newest-first corpus would offer.
  const featured = getFeaturedDevotional(now, audience, timeZone);
  const spoken = featured ? devotionalScript(featured) : null;
  const plan = getReadingPlanFor(today, audience === 'early-readers' ? 'adults' : audience) ?? getReadingPlanFor(today);
  // Days that have arrived, newest first, minus the hero so the grid never repeats it.
  const rest = getLatestDevotionals(7, audience)
    .filter((post) => post.slug !== featured?.slug)
    .slice(0, 6);
  // Today's article in the other editions, so the front page points a parent at the version a
  // child can actually read instead of leaving them to discover it in the listing.
  const othersToday = AUDIENCE_ORDER.filter((id) => id !== audience)
    .map((id) => ({ audience: id, post: getDevotionalForDate(today, id) }))
    .filter((entry) => entry.post);

  return (
    <>
      {/* Turns this page over at midnight for a reader who left it open. */}
      <DayRollover date={today} />
      {/* HERO — today's devotional, or the most recent one in the library */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/hero-light.jpg"
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-30 dark:opacity-15 dark:brightness-50"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        </div>

        <div className="container pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="max-w-3xl">
            <AudiencePicker current={audience} className="mb-5 animate-fade-in" />
            <p className="flex flex-wrap items-center gap-2 text-sm animate-fade-in">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/80 border border-border">
                <span className="grid place-items-center w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                {todays
                  ? `${AUDIENCE_SEARCH_NAME[audience]} today · ${formatWeekday(today)}, ${formatDayMonthYear(today)}`
                  : featured
                    ? `Most recent · ${formatDayHeading(featured.date)}`
                    : `${stats.posts} daily devotionals published`}
              </span>
            </p>

            <h1 className="mt-6 font-serif text-5xl md:text-7xl font-semibold tracking-tight text-balance leading-[1.05] animate-fade-in">
              {featured ? (
                <Link href={`/devotionals/${featured.slug}`} className="hover:text-primary transition-colors">
                  {featured.title}
                </Link>
              ) : (
                <>
                  Every daily devotional,{' '}
                  <span className="bg-gradient-to-br from-primary via-primary-glow to-accent bg-clip-text text-transparent">
                    published as a blog.
                  </span>
                </>
              )}
            </h1>

            {featured && (
              <>
                <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed text-pretty animate-fade-in">
                  {featured.excerpt}
                </p>
                {featured.scripture && (
                  <blockquote className="mt-8 scripture-card max-w-2xl animate-fade-in">
                    <p>{featured.scripture}</p>
                    {featured.scriptureReference && (
                      <footer className="mt-3 not-italic font-sans text-sm text-muted-foreground">
                        — {featured.scriptureReference}
                      </footer>
                    )}
                  </blockquote>
                )}
              </>
            )}

            <div className="mt-10 flex flex-wrap items-center gap-3">
              {featured && (
                <Button asChild size="lg" className="shadow-elegant gradient-hero text-primary-foreground border-0">
                  <Link href={`/devotionals/${featured.slug}`}>
                    {todays ? 'Read today’s devotional' : 'Read the latest'}
                    <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
                  </Link>
                </Button>
              )}
              {spoken && (
                <ListenButton
                  script={spoken}
                  size="lg"
                  variant="outline"
                  showDuration
                  label={todays ? 'Listen to today’s devotional' : 'Listen to it'}
                />
              )}
              <Button asChild size="lg" variant="outline">
                <Link href="/devotionals">Browse all devotionals</Link>
              </Button>
            </div>

            <ContinueReading />

            {!todays && featured && (
              <p className="mt-4 text-sm text-muted-foreground">
                Today&rsquo;s edition ({formatDayHeading(today)}) is not in the library yet, so this is the
                most recent day published.{' '}
                <Link href={audience === 'adults' ? '/today' : `/today?audience=${audience}`} className="text-primary hover:underline">
                  Open today&rsquo;s devotional
                </Link>{' '}
                any time — it always goes to the current day.
              </p>
            )}

            {othersToday.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 animate-fade-in-slow">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Also today
                </span>
                {othersToday.map(({ audience, post }) => (
                  <Link
                    key={audience}
                    href={`/devotionals/${post!.slug}`}
                    className="group inline-flex items-center gap-2.5 rounded-full border border-border/70 bg-card/70 py-1.5 pl-1.5 pr-4 hover:border-primary/40 transition-colors"
                  >
                    <AudienceBadge audience={audience} className="bg-primary/15 text-primary" />
                    <span className="font-serif text-sm font-medium group-hover:text-primary transition-colors">
                      {post!.title}
                    </span>
                  </Link>
                ))}
                <span className="text-xs text-muted-foreground">
                  {AUDIENCE_ORDER.filter((id) => id !== audience)
                    .map((id) => AUDIENCES[id].label.replace(/^For /, ''))
                    .join(' and ')}{' '}
                  editions, same day.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* EDITION STRIP */}
      <section aria-labelledby="editions-strip" className="container -mt-10 relative">
        <h2 id="editions-strip" className="sr-only">
          Editions
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* The newest months across every audience — the strip is an invitation, not an index;
              /editions carries the whole list grouped by audience. */}
          {editions.slice(0, 6).map((edition, i) => (
            <Link
              key={edition.slug}
              href={`/editions/${edition.slug}`}
              className="block rounded-xl p-4 bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft hover:shadow-elegant transition-all hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
            >
              <CalendarDays className="w-4 h-4 opacity-80" aria-hidden="true" />
              <span className="mt-3 block font-serif text-lg font-semibold leading-tight">
                {edition.audienceTitle}
              </span>
              <span className="mt-1 block text-xs opacity-85">
                {edition.postCount} devotionals · {formatDate(edition.firstDate)} – {formatDate(edition.lastDate)}
              </span>
            </Link>
          ))}
          <div className="rounded-xl p-4 border border-border/70 bg-card shadow-soft animate-fade-in" style={{ animationDelay: '180ms', animationFillMode: 'backwards' }}>
            <Library className="w-4 h-4 text-primary" aria-hidden="true" />
            <p className="mt-3 font-serif text-lg font-semibold leading-tight">The library</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.posts} articles · {stats.words.toLocaleString()} words · {stats.editions} editions
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {stats.byAudience.map((entry) => (
                <li key={entry.audience} className="inline-flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary/70" aria-hidden="true" />
                  {entry.label.replace(/^For /, '')}: <span className="text-foreground font-medium">{entry.posts}</span>
                </li>
              ))}
            </ul>
            {kids.pages > 0 ? (
              <Link
                href="/kids"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                For Kids: {kids.issues} magazine {kids.issues === 1 ? 'issue' : 'issues'} · {kids.pages} pages
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* EXPLORE — every way into the library, one tap from the front page */}
      <section aria-labelledby="explore-heading" className="container pt-20">
        <h2 id="explore-heading" className="font-serif text-3xl md:text-4xl font-semibold">
          Explore Rhapsody of Realities
        </h2>
        <ul className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {EXPLORE.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                prefetch={href === '/random' ? false : undefined}
                className="group flex h-full flex-col rounded-2xl border border-border/70 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-soft"
              >
                <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                <span className="mt-3 font-serif text-lg font-semibold leading-tight group-hover:text-primary transition-colors">{label}</span>
                <span className="mt-1 text-xs text-muted-foreground">{hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* LATEST */}
      <section className="container py-24">
        <div className="flex items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-sm uppercase tracking-wider text-primary font-medium">Latest</span>
            <h2 className="font-serif text-4xl md:text-5xl font-semibold mt-2">
              {audience === 'adults' ? 'Recent Rhapsody of Realities devotionals' : `Recent ${AUDIENCE_SEARCH_NAME[audience]} devotionals`}
            </h2>
          </div>
          <Button asChild variant="ghost" className="hidden md:inline-flex shrink-0">
            <Link href={audience === 'adults' ? '/devotionals' : AUDIENCE_HUB[audience]}>
              View all <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {rest.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            The library is empty for now. Every daily devotional appears here as its edition is published.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((post, i) => (
              <Fragment key={post.slug}>
                <DevotionalCard post={post} index={i} />
                {/* One unit mid-grid: the hero and the newsletter CTA stay ad-free. */}
                {i === 2 && <AdSlot position="feed" format="fluid" className="md:col-span-2 lg:col-span-3" />}
              </Fragment>
            ))}
          </div>
        )}

        <div className="mt-8 text-center md:hidden">
          <Button asChild variant="outline">
            <Link href="/devotionals">View all devotionals</Link>
          </Button>
        </div>
      </section>

      {/* TODAY'S BIBLE READING PLANS — the portions printed in the same edition as the article */}
      {plan && (plan.oneYearPlan || plan.twoYearPlan) ? (
        <section aria-labelledby="plans-heading" className="container pb-24">
          <div className="rounded-3xl border border-border/70 bg-card p-6 md:p-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 text-sm uppercase tracking-wider text-primary font-medium">
                  <Layers className="w-4 h-4" aria-hidden="true" /> Bible reading plans
                </span>
                <h2 id="plans-heading" className="mt-2 font-serif text-3xl md:text-4xl font-semibold text-balance">
                  Read through the Bible alongside today&rsquo;s devotional
                </h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-xl">
                  The portions printed in the {formatDayHeading(today)} edition: the whole Bible in a
                  year, and again more gently over two.
                </p>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <Link href="/reading-plans">Every day&rsquo;s plan</Link>
              </Button>
            </div>
            <dl className="mt-8 grid sm:grid-cols-2 gap-4">
              {plan.oneYearPlan ? (
                <div className="rounded-2xl border border-border/70 bg-secondary/40 px-5 py-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium">1-Year plan</dt>
                  <dd className="mt-1.5 font-serif text-lg font-medium leading-snug">{plan.oneYearPlan}</dd>
                </div>
              ) : null}
              {plan.twoYearPlan ? (
                <div className="rounded-2xl border border-border/70 bg-secondary/40 px-5 py-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium">2-Year plan</dt>
                  <dd className="mt-1.5 font-serif text-lg font-medium leading-snug">{plan.twoYearPlan}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      ) : null}

      {/* WHAT IS — a short, factual introduction for readers arriving from a search */}
      <section aria-labelledby="about-heading" className="container pb-24">
        <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-start">
          <div>
            <h2 id="about-heading" className="font-serif text-3xl md:text-4xl font-semibold text-balance">
              What is Rhapsody of Realities?
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Rhapsody of Realities is a daily devotional written by Pastor Chris Oyakhilome and published every month by
              LoveWorld Publishing since 2001. Each day opens with a scripture, teaches from it, and closes with a prayer or
              confession, further study and portions of the 1-year and 2-year Bible reading plans.
            </p>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Alongside the main edition there is <Link href="/teevo" className="text-primary hover:underline">TeeVo for teenagers</Link>,{' '}
              <Link href="/early-readers" className="text-primary hover:underline">Rhapsody of Realities for Early Readers</Link> and the{' '}
              <Link href="/kids" className="text-primary hover:underline">Kids</Link> magazine. This site publishes them day by day to
              read, listen to and share — free, with no account.
            </p>
            <Link href="/faq" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              More questions answered <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid gap-3 text-sm">
            {[
              ['Read today’s devotional', 'Every morning at midnight Lagos time — or any day from the calendar.'],
              ['Listen to it', 'Every devotional reads aloud, even with the screen locked.'],
              ['Share it on WhatsApp', 'Copy the whole day, formatted, or make a verse image for your status.'],
              ['Keep your streak and notes', 'Saved on your phone — no sign-up needed.'],
              ['Read offline', 'Install the app and save a whole month for when you have no data.'],
            ].map(([title, text]) => (
              <li key={title} className="rounded-2xl border border-border/70 bg-card px-5 py-4">
                <p className="font-medium">{title}</p>
                <p className="mt-0.5 text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <div className="relative overflow-hidden rounded-3xl gradient-hero text-primary-foreground p-8 md:p-16 text-center shadow-elegant">
          <BookOpen className="w-10 h-10 mx-auto mb-4 opacity-90" aria-hidden="true" />
          <h2 className="font-serif text-3xl md:text-4xl font-semibold max-w-2xl mx-auto text-balance">
            Never miss a day. Get every devotional in your inbox.
          </h2>
          <p className="mt-3 opacity-90 max-w-xl mx-auto">
            One email a day with the article, the prayer and the reading plans. No spam — unsubscribe in one click.
          </p>
          <div className="mt-7 max-w-md mx-auto">
            <NewsletterForm variant="onHero" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <ReminderDialog
              defaultAudience={audience}
              trigger={
                <Button type="button" variant="secondary" size="sm">
                  <BellRing className="w-4 h-4 mr-1.5" aria-hidden="true" /> Add a daily reminder
                </Button>
              }
            />
            <InstallAppButton variant="secondary" />
          </div>
          <p className="mt-6 text-sm opacity-90 flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Prefer reading here? <Link href="/feed.xml" className="underline underline-offset-4 hover:text-white">Subscribe by RSS</Link>
          </p>
        </div>
      </section>
    </>
  );
}
