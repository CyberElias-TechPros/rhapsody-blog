import Link from 'next/link';
import type { Metadata } from 'next';
import { BookOpen, BookmarkPlus, Globe, Rss, Search, Share2, ShieldCheck, Sunrise } from 'lucide-react';
import { NewsletterForm } from '@/components/common/NewsletterForm';
import { AdSlot } from '@/components/common/AdSlot';
import { PageHeader } from '@/components/common/StateBlocks';
import { getContentStats, getEditions } from '@/lib/content';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: `Why ${SITE.name} exists: to get every day's ${SITE.series} devotional by ${SITE.author} to anyone who needs it — free, with nothing to install or sign up for.`,
  alternates: { canonical: '/about' },
};

const PROMISES = [
  {
    icon: BookOpen,
    title: 'The whole day, nothing left out',
    body: 'The message, the opening scripture, the closing prayer or confession, further study, and both the one-year and two-year Bible reading plans — every part of the day, on one page.',
  },
  {
    icon: Sunrise,
    title: 'Today, first',
    body: 'Open the site in the morning and today\'s devotional is already at the top. Yesterday, last month and every day before it stay exactly where you left them.',
  },
  {
    icon: Search,
    title: 'Find the word you remember',
    body: 'Search a phrase from a message, a book of the Bible, a title, or a date like 2026-09-01. The day you are trying to remember is in there.',
  },
  {
    icon: Share2,
    title: 'Share a day, not a screenshot',
    body: 'Every day has one permanent link. Send it on WhatsApp, in an email or in a message to someone who needs it today — the whole article arrives, not a photo of a page.',
  },
  {
    icon: Rss,
    title: 'Read it where you already read',
    body: 'The feed carries the complete article for each day into whatever reader, app or inbox you already use, so the devotional comes to you.',
  },
  {
    icon: BookmarkPlus,
    title: 'Keep your own library',
    body: 'Save the days that spoke to you. They stay on your device, with no account to create and nothing uploaded anywhere.',
  },
] as const;

export default function AboutPage() {
  const stats = getContentStats();
  const editions = getEditions();
  const oldest = editions[editions.length - 1];
  const since = oldest ? `${oldest.monthName} ${oldest.year}` : '—';

  return (
    <div className="container py-16 md:py-20 max-w-4xl">
      <PageHeader
        eyebrow="Why this exists"
        title="So the word reaches everyone."
        subtitle={`${SITE.series} is written to be read every day. This site exists so that today's message can reach whoever needs it — on any phone, on any connection, with nothing to install, nothing to sign up for and nothing to pay.`}
      />

      <dl className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Days published', value: String(stats.posts) },
          { label: 'Editions', value: String(stats.editions) },
          { label: 'Words', value: stats.words.toLocaleString() },
          { label: 'Since', value: since },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border/70 bg-card px-5 py-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-16 space-y-6 text-lg leading-relaxed text-muted-foreground">
        <p>
          A printed booklet travels as far as the hands that pass it on. It waits in a bookshop, in a
          bag, on a table — and if you do not have one today, today&apos;s word simply does not reach you.
        </p>
        <p className="text-foreground">
          But somebody, somewhere, is looking for exactly what today&apos;s devotional says.
        </p>
        <p>
          So each day is published here on the open web, with a permanent link of its own. No app to
          install. No account to create. No subscription, no paywall, no waiting for a delivery. It is
          light enough for a slow connection and an old phone, readable at night without waking anyone,
          and easy to send to the one person you know needs it this morning.
        </p>
        <p>
          The message is the point — everything about this site is only there to get it further: to a
          reader in Lagos at 5am, to a student with 40MB left this month, to a grandmother who reads
          everything in her feed app, to whoever finds it by searching for the one line they remember
          from last September.
        </p>
      </section>

      <section className="mt-16 grid sm:grid-cols-2 gap-4">
        {PROMISES.map((promise) => (
          <div key={promise.title} className="rounded-2xl border border-border/70 bg-card p-6">
            <promise.icon className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 className="mt-3 font-serif text-xl font-semibold">{promise.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{promise.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-16 rounded-2xl border border-border/70 bg-card p-6 md:p-8">
        <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold">
          <Globe className="w-5 h-5 text-primary" aria-hidden="true" /> Not just a page a day — the whole
          Bible
        </h2>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Every article carries the day&apos;s <strong className="text-foreground">1-Year</strong> and{' '}
          <strong className="text-foreground">2-Year</strong> Bible reading plans, exactly as they are
          printed in the edition. Read a chapter or two alongside the devotional and you are not
          sampling scripture, you are going all the way through it — one plan in a year, the other more
          gently over two.
        </p>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          Both plans are on every page, in the feed, and in the daily email — so the reading never
          depends on having the booklet to hand.
        </p>
      </section>

      <section className="mt-16 rounded-2xl border border-primary/25 bg-primary/5 p-6 md:p-8">
        <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" /> Word for word
        </h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Nothing here is rewritten, shortened, summarised or paraphrased. Each day is taken directly
          from that month&apos;s edition of {SITE.series}, and every article names the edition and the
          pages it came from, at the foot of the reading.
        </p>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Scripture quotations are from the King James Version unless the article itself names another
          version (NKJV, AMP, AMPC, NIV, MSG, TPT and others appear in each edition).
        </p>
      </section>

      <section className="mt-16 rounded-2xl border border-border/70 bg-card p-6 md:p-8">
        <h2 className="font-serif text-2xl font-semibold">Who writes it, and who it belongs to</h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {SITE.series} is written by {SITE.author} and published by {SITE.publisher}. This site is a
          reader&apos;s effort to help that daily word travel further — it is not an official LoveWorld
          property, and it claims no ownership of anything here.
        </p>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{SITE.attribution}</p>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          For the official editions, orders, languages and apps, go to{' '}
          <a
            href="https://www.rhapsodyofrealities.org"
            className="text-primary underline underline-offset-4 hover:text-primary-glow"
            target="_blank"
            rel="noopener noreferrer"
          >
            rhapsodyofrealities.org
          </a>
          . If the publisher would like anything on this site changed or removed, that request is
          honoured immediately — write to us and it will be done the same day.
        </p>
      </section>

      {/* Bottom of the page, well clear of the reading and of the daily email form. */}
      <AdSlot position="page" className="mt-16" />

      <section className="mt-16 rounded-3xl gradient-hero text-primary-foreground p-8 md:p-12 text-center shadow-elegant">
        <BookOpen className="w-9 h-9 mx-auto mb-4 opacity-90" aria-hidden="true" />
        <h2 className="font-serif text-3xl font-semibold max-w-xl mx-auto text-balance">
          Start with today&apos;s devotional
        </h2>
        <p className="mt-3 opacity-90 max-w-lg mx-auto">
          Or get one email a day — the article, the prayer and the reading plans. And if today&apos;s word
          is for someone else you know, send them the link.
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
