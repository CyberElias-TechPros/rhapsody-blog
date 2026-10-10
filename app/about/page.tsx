import Link from 'next/link';
import type { Metadata } from 'next';
import { BookOpen, Code2, FileText, Rss, Search, ShieldCheck } from 'lucide-react';
import { NewsletterForm } from '@/components/common/NewsletterForm';
import { PageHeader } from '@/components/common/StateBlocks';
import { getContentStats, getEditions } from '@/lib/content';
import { formatDate } from '@/lib/format';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: `How ${SITE.name} turns the monthly ${SITE.series} PDF editions into a searchable daily blog — and who owns the content.`,
  alternates: { canonical: '/about' },
};

const FEATURES = [
  {
    icon: FileText,
    title: 'One post per day',
    body: 'Every daily article becomes its own page: the message, the opening scripture, the closing prayer (or confession), further study, and both the one-year and two-year Bible reading plans.',
  },
  {
    icon: Code2,
    title: 'Extracted, not retyped',
    body: 'A layout-aware parser reads each two-page spread, rebuilds lines from the PDF text objects, re-attaches the drop caps and verifies the result line by line against the source pages.',
  },
  {
    icon: Search,
    title: 'Searchable and dated',
    body: 'Permalinks carry the day (/devotionals/2026-09-01-…), and a compact index makes search instant across titles, articles, prayers and scripture references.',
  },
  {
    icon: Rss,
    title: 'Portable',
    body: 'The RSS feed carries the complete article for each day, so the devotional reaches readers in whatever app they already use.',
  },
] as const;

export default function AboutPage() {
  const stats = getContentStats();
  const editions = getEditions();

  return (
    <div className="container py-16 md:py-20 max-w-4xl">
      <PageHeader
        eyebrow="About this blog"
        title="The daily devotional, published properly."
        subtitle={`${SITE.name} takes each monthly edition of ${SITE.series} by ${SITE.author} and publishes every day's article as a clean, permanent, readable blog post.`}
      />

      <dl className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Devotionals', value: String(stats.posts) },
          { label: 'Editions', value: String(stats.editions) },
          { label: 'Words', value: stats.words.toLocaleString() },
          { label: 'Covering', value: stats.firstDate ? formatDate(stats.firstDate).split(',')[0] : '—' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border/70 bg-card px-5 py-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-16">
        <h2 className="font-serif text-3xl font-semibold">How a month becomes {stats.posts > 0 ? editions[0]?.postCount ?? 30 : 30} posts</h2>
        <ol className="mt-6 space-y-4 text-muted-foreground leading-relaxed list-decimal pl-5">
          <li>
            The edition PDF (<code className="text-foreground">september-2026-rhapsody.pdf</code>,{' '}
            <code className="text-foreground">october-2026-rhapsody.pdf</code>, …) sits at the repository root.
          </li>
          <li>
            <code className="text-foreground">npm run content:extract</code> walks the spreads, finds the day
            header (<em>tuesday 1</em>), the headline, the indented opening scripture, the message paragraphs
            ( recognised by their first-line indent ), the PRAYER or CONFESSION block, FURTHER STUDY and both
            reading plans.
          </li>
          <li>
            Each day is written to <code className="text-foreground">content/devotionals/YYYY-MM-DD-title.md</code>{' '}
            with frontmatter that carries the structured sections.
          </li>
          <li>
            The extractor then verifies itself: the right number of days, the printed weekday matching the real
            calendar, a scripture reference present, no publisher adverts, and — line by line — that every
            sentence on the source pages made it into the post.
          </li>
        </ol>
      </section>

      <section className="mt-16 grid sm:grid-cols-2 gap-4">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-border/70 bg-card p-6">
            <feature.icon className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 className="mt-3 font-serif text-xl font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-16 rounded-2xl border border-primary/25 bg-primary/5 p-6 md:p-8">
        <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" /> Content &amp; attribution
        </h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{SITE.attribution}</p>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Scripture quotations are taken from the King James Version unless another version is named in the
          article (NKJV, AMP, AMPC, NIV, MSG, TPT and others are keyed in each edition). For the official
          editions, orders and the daily reading plans, see{' '}
          <a
            href="https://www.rhapsodyofrealities.org"
            className="text-primary underline underline-offset-4 hover:text-primary-glow"
            target="_blank"
            rel="noopener noreferrer"
          >
            rhapsodyofrealities.org
          </a>
          .
        </p>
      </section>

      <section className="mt-16 rounded-3xl gradient-hero text-primary-foreground p-8 md:p-12 text-center shadow-elegant">
        <BookOpen className="w-9 h-9 mx-auto mb-4 opacity-90" aria-hidden="true" />
        <h2 className="font-serif text-3xl font-semibold max-w-xl mx-auto text-balance">
          Start with today&apos;s devotional
        </h2>
        <p className="mt-3 opacity-90 max-w-lg mx-auto">
          Or get one email a day — the article, the prayer and the reading plans.
        </p>
        <div className="mt-6 max-w-md mx-auto">
          <NewsletterForm variant="onHero" />
        </div>
        <p className="mt-6 text-sm opacity-90">
          <Link href="/devotionals" className="underline underline-offset-4 hover:text-white">
            Browse the whole library →
          </Link>
        </p>
      </section>
    </div>
  );
}
