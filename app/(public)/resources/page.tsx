import Link from 'next/link';
import type { Metadata } from 'next';
import { BookOpen, ScanText } from 'lucide-react';
import { PageHeader } from '@/components/common/StateBlocks';
import { EmptyState } from '@/components/common/StateBlocks';
import { AdSlot } from '@/components/common/AdSlot';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { getResourceGroups, getResourceStats } from '@/lib/resources';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Books and resources',
  description: `Books, studies, sermon notes and prayer-programme guides by ${SITE.author} and LoveWorld — published in full, searchable, and readable aloud.`,
  alternates: { canonical: '/resources' },
};

/**
 * Everything in the library that is not a day.
 *
 * The devotionals are a stream and this is a shelf: grouped by what a document *is* (a book, a
 * short study, one service transcribed, a fasting programme's day-by-day notes) rather than by
 * month, because nobody browses a book by the month it was scanned in.
 */
export default function ResourcesPage() {
  const groups = getResourceGroups();
  const stats = getResourceStats();

  return (
    <div className="container py-16 md:py-20">
      <PageHeader
        eyebrow="Beyond the daily"
        title="Books, studies and the prayer programmes."
        subtitle="The daily devotional is one page a day. These are the longer things a reader asks for next — published here in full, word for word, with nothing to download and nothing to pay."
      />

      {stats.resources > 0 && (
        <dl className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Documents', value: String(stats.resources) },
            { label: 'Words', value: stats.words.toLocaleString() },
            { label: 'Source pages', value: stats.pages.toLocaleString() },
            { label: 'Kinds', value: String(stats.kinds.length) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border/70 bg-card px-5 py-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</dt>
              <dd className="mt-1 font-serif text-2xl font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {groups.length === 0 ? (
        <EmptyState
          title="Nothing on the shelf yet"
          hint="Books, studies and programme notes appear here as they are published, alongside the daily devotionals."
          action={
            <Link href="/devotionals" className="text-sm text-primary hover:underline">
              Browse the daily devotionals →
            </Link>
          }
        />
      ) : (
        <div className="mt-16 space-y-16">
          {groups.map((group) => (
            <section key={group.kind} aria-labelledby={`kind-${group.kind}`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id={`kind-${group.kind}`} className="font-serif text-3xl md:text-4xl font-semibold">
                    {group.label}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{group.blurb}</p>
                </div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {group.resources.length} {group.resources.length === 1 ? 'document' : 'documents'} ·{' '}
                  {group.words.toLocaleString()} words
                </p>
              </div>

              <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {group.resources.map((resource, index) => (
                  <ResourceCard key={resource.slug} resource={resource} index={index} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {stats.recognised > 0 && (
        <aside className="mt-16 flex gap-4 rounded-2xl border border-border/70 bg-card p-6">
          <ScanText className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground">
              {stats.recognised} of these {stats.resources === 1 ? 'documents is' : 'documents are'} scans
            </p>
            <p className="mt-1.5">
              A printed book that was never published as a digital file has no text to copy out of it, so its
              words are read off the page image by a recogniser. Nothing is rewritten either way, but recognised
              lines have not been read back by a human — each such document says so at the top, with the
              confidence of the read.
            </p>
          </div>
        </aside>
      )}

      <AdSlot position="page" className="mt-16" />

      <section className="mt-16 rounded-3xl gradient-hero text-primary-foreground p-8 md:p-12 text-center shadow-elegant">
        <BookOpen className="w-9 h-9 mx-auto mb-4 opacity-90" aria-hidden="true" />
        <h2 className="font-serif text-3xl font-semibold max-w-xl mx-auto text-balance">
          And one page for every day
        </h2>
        <p className="mt-3 opacity-90 max-w-lg mx-auto">
          The daily devotional — the message, the prayer, further study and both Bible reading plans — is
          published every day, and today&rsquo;s is already waiting.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/today" className="underline underline-offset-4 hover:text-white font-medium">
            Read today&rsquo;s devotional →
          </Link>
        </p>
      </section>
    </div>
  );
}
