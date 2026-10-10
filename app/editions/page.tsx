import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CalendarDays, FileText } from 'lucide-react';
import { PageHeader } from '@/components/common/StateBlocks';
import { getContentStats, getEditions } from '@/lib/content';
import { formatDate } from '@/lib/format';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Editions',
  description: `Monthly editions of ${SITE.series} published on ${SITE.name} — pick a month to read every day of it.`,
  alternates: { canonical: '/editions' },
};

export default function EditionsPage() {
  const editions = getEditions();
  const stats = getContentStats();

  return (
    <div className="container py-16 md:py-20">
      <PageHeader
        eyebrow="Browse by month"
        title="Editions"
        subtitle={`Each monthly edition of ${SITE.series} becomes ${editions.length > 0 ? `${editions[0].postCount}+` : ''} daily blog posts — the article, the opening scripture, the closing prayer, further study and both Bible reading plans.`}
      />

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {editions.map((edition, i) => (
          <Link
            key={edition.slug}
            href={`/editions/${edition.slug}`}
            className="group rounded-2xl border border-border/70 gradient-card p-6 shadow-soft hover:shadow-elegant hover:border-primary/40 transition-all animate-fade-in"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary font-medium">
                  <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> Monthly edition
                </span>
                <h2 className="mt-2 font-serif text-3xl font-semibold group-hover:text-primary transition-colors">
                  {edition.title}
                </h2>
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
        ))}
      </div>

      <div className="mt-14 rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">{stats.posts} devotionals</strong> across{' '}
          <strong className="text-foreground">{stats.editions} editions</strong> —{' '}
          {stats.words.toLocaleString()} words in total, published {formatDate(stats.firstDate)} to{' '}
          {formatDate(stats.lastDate)}.
        </p>
        <p className="mt-3">
          Adding a month is one command: drop the edition PDF at the repository root and run{' '}
          <code className="text-foreground">npm run content:extract</code>. Every daily article becomes a post,
          verified against the source pages.
        </p>
      </div>
    </div>
  );
}
