import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CalendarDays, FileText } from 'lucide-react';
import { PageHeader } from '@/components/common/StateBlocks';
import { getContentStats, getEditionGroups } from '@/lib/content';
import { formatDate } from '@/lib/format';
import { pageMetadata } from '@/lib/seo';
import { AUDIENCE_ORDER } from '@/lib/audiences';
import type { Edition } from '@/lib/types';

export const metadata: Metadata = pageMetadata({
  title: 'Rhapsody of Realities Monthly Editions 2026 — Read Every Month Online',
  description:
    'Every monthly edition of Rhapsody of Realities, TeeVo for teens and Rhapsody for Early Readers — pick a month (October 2026, September 2026…) to read all of its daily devotionals online, free.',
  path: '/editions',
  absolute: true,
});

/**
 * Every edition the corpus holds, grouped under the audience it was written for. A month is a
 * month for all of them, so the card is shared; only what the edition contains differs (the
 * early readers' edition has no Bible reading plans, the teens edition has an Act).
 */
export default function EditionsPage() {
  const groups = getEditionGroups();
  const stats = getContentStats();
  const perMonth = groups.flatMap((group) => group.editions).sort((a, b) => b.postCount - a.postCount)[0];

  return (
    <div className="container py-16 md:py-20">
      <PageHeader
        eyebrow="Browse by month"
        title="Rhapsody of Realities editions"
        subtitle={`Each monthly PDF becomes ${perMonth ? `${perMonth.postCount}` : 'up to 31'} daily blog posts — the article, the opening scripture, the closing prayer or confession, further study and, where the audience prints them, the Bible reading plans. ${AUDIENCE_ORDER.length} audiences are published here.`}
      />

      {groups.map((group) => (
        <section key={group.audience} aria-labelledby={`audience-${group.audience}`} className="mt-14 first:mt-12">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border/60 pb-4">
            <div>
              <h2 id={`audience-${group.audience}`} className="font-serif text-3xl font-semibold">
                {group.label}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
                {group.series} — {group.blurb}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              <Link href={`/devotionals?audience=${group.audience}`} className="text-primary hover:underline">
                {group.postCount.toLocaleString()} articles
              </Link>{' '}
              in {group.editions.length} {group.editions.length === 1 ? 'edition' : 'editions'}
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {group.editions.map((edition, i) => (
              <EditionCard key={edition.slug} edition={edition} index={i} />
            ))}
          </div>
        </section>
      ))}

      <div className="mt-14 rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">{stats.posts.toLocaleString()} devotionals</strong> across{' '}
          <strong className="text-foreground">{stats.editions} editions</strong> — {stats.words.toLocaleString()} words
          in total, published {formatDate(stats.firstDate)} to {formatDate(stats.lastDate)}.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {stats.byAudience.map((entry) => (
            <li key={entry.audience} className="flex items-baseline gap-2">
              <span className="text-foreground font-medium">{entry.label}</span>
              <span>
                {entry.posts.toLocaleString()} articles · {entry.editions} {entry.editions === 1 ? 'edition' : 'editions'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          Each edition is published here in full — every day of the month, in the order it is
          printed, word for word. A new month appears as soon as its edition is released.
        </p>
      </div>
    </div>
  );
}

function EditionCard({ edition, index }: { edition: Edition; index: number }) {
  return (
    <Link
      href={`/editions/${edition.slug}`}
      className="group rounded-2xl border border-border/70 gradient-card p-6 shadow-soft hover:shadow-elegant hover:border-primary/40 transition-all animate-fade-in"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary font-medium">
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> {edition.audienceLabel}
          </span>
          <h3 className="mt-2 font-serif text-3xl font-semibold group-hover:text-primary transition-colors">
            {edition.title}
          </h3>
        </div>
        <ArrowRight
          className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-2"
          aria-hidden="true"
        />
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">Devotionals</dt>
          <dd className="font-semibold mt-0.5">{edition.postCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">From</dt>
          <dd className="font-semibold mt-0.5">{formatDate(edition.firstDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">To</dt>
          <dd className="font-semibold mt-0.5">{formatDate(edition.lastDate)}</dd>
        </div>
      </dl>

      <p className="mt-5 text-xs text-muted-foreground flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Source: <code>{edition.sourcePdf}</code>
      </p>
    </Link>
  );
}
