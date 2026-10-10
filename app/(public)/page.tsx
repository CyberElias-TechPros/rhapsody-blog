import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BookOpen, CalendarDays, Library, Sparkles } from 'lucide-react';
import { Fragment } from 'react';
import { DevotionalCard } from '@/components/DevotionalCard';
import { AdSlot } from '@/components/common/AdSlot';
import { NewsletterForm } from '@/components/common/NewsletterForm';
import { Button } from '@/components/ui/button';
import {
  getAllDevotionals,
  getContentStats,
  getDevotionalForDate,
  getEditions,
  todayIso,
} from '@/lib/content';
import { AUDIENCE_ORDER, AUDIENCES } from '@/lib/audiences';
import { AudienceBadge } from '@/components/common/AudienceBadge';
import { formatDate, formatDayHeading } from '@/lib/format';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: '/' },
};

export default function HomePage() {
  const today = todayIso();
  const todays = getDevotionalForDate(today);
  const all = getAllDevotionals();
  const featured = todays ?? all[0];
  const editions = getEditions();
  const stats = getContentStats();
  const latest = all.slice(0, 6);
  // Six most recent, minus the featured one, so the grid never repeats the hero.
  const rest = latest.filter((p) => p.slug !== featured?.slug).slice(0, 6);
  // Today's article in the other editions, so the front page points a parent at the version a
  // child can actually read instead of leaving them to discover it in the listing.
  const othersToday = AUDIENCE_ORDER.filter((id) => id !== 'adults')
    .map((id) => ({ audience: id, post: getDevotionalForDate(today, id) }))
    .filter((entry) => entry.post);

  return (
    <>
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
            <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/80 border border-border text-sm animate-fade-in">
              <span className="grid place-items-center w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
              {todays ? `Today’s devotional · ${formatDayHeading(today)}` : `${stats.posts} daily devotionals published`}
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
              <Button asChild size="lg" variant="outline">
                <Link href="/devotionals">Browse all devotionals</Link>
              </Button>
            </div>

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
                  {AUDIENCE_ORDER.filter((id) => id !== 'adults')
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
          </div>
        </div>
      </section>

      {/* LATEST */}
      <section className="container py-24">
        <div className="flex items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-sm uppercase tracking-wider text-primary font-medium">Latest</span>
            <h2 className="font-serif text-4xl md:text-5xl font-semibold mt-2">Fresh from the editions</h2>
          </div>
          <Button asChild variant="ghost" className="hidden md:inline-flex shrink-0">
            <Link href="/devotionals">
              View all <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {rest.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            No devotionals published yet — add a monthly PDF and run <code>npm run content:extract</code>.
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
          <p className="mt-6 text-sm opacity-90 flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Prefer reading here? <Link href="/feed.xml" className="underline underline-offset-4 hover:text-white">Subscribe by RSS</Link>
          </p>
        </div>
      </section>
    </>
  );
}
