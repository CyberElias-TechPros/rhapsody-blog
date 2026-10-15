import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { PageHeader } from '@/components/common/StateBlocks';
import { AdSlot } from '@/components/common/AdSlot';
import { getBibleBookIndex, type BibleBookEntry } from '@/lib/content';
import { breadcrumbJsonLd, collectionJsonLd, jsonLdString, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Rhapsody of Realities by Bible Book — Devotionals on Romans, John, Psalms & More',
  description:
    'Find Rhapsody of Realities devotionals by the book of the Bible they open with — Romans, John, Matthew, Corinthians, Ephesians, Hebrews, Psalms and more — for adults, TeeVo and Early Readers.',
  path: '/bible',
  absolute: true,
});

function BookList({ title, entries }: { title: string; entries: BibleBookEntry[] }) {
  if (!entries.length) return null;
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <section aria-label={title} className="mt-12">
      <div className="flex items-end justify-between gap-4 border-b border-border/60 pb-3">
        <h2 className="font-serif text-3xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {entries.length} books · {total} devotionals
        </p>
      </div>
      <ul className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map(({ book, count }) => (
          <li key={book.slug}>
            <Link
              href={`/bible/${book.slug}`}
              className="group flex items-baseline justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 hover:border-primary/40 transition-colors"
            >
              <span className="font-serif text-lg font-semibold group-hover:text-primary transition-colors">{book.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Every devotional opens with a scripture; this indexes the library by the book it comes from.
 * A second way in — by subject matter — for an archive otherwise organised by date.
 */
export default function BibleIndexPage() {
  const index = getBibleBookIndex();
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'By Bible book', path: '/bible' },
  ];
  const structured = [
    breadcrumbJsonLd(crumbs),
    collectionJsonLd({
      name: 'Rhapsody of Realities by Bible book',
      description: 'Daily devotionals grouped by the book of their opening scripture.',
      path: '/bible',
      items: index.map(({ book, count }) => ({ name: `${book.name} (${count})`, path: `/bible/${book.slug}` })),
    }),
  ];
  const top = [...index].sort((a, b) => b.count - a.count).slice(0, 3);

  return (
    <div className="container py-12 md:py-16 max-w-6xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(structured) }} />
      <Breadcrumbs crumbs={crumbs} className="mb-8" />
      <PageHeader
        eyebrow="Browse by scripture"
        title="Devotionals by Bible book"
        subtitle={`Each day of Rhapsody of Realities opens with a verse. Pick a book to read every devotional that starts there${
          top.length ? ` — ${top.map((entry) => `${entry.book.name} (${entry.count})`).join(', ')} are the most quoted` : ''
        }.`}
      />
      <BookList title="New Testament" entries={index.filter((entry) => entry.book.testament === 'new')} />
      <BookList title="Old Testament" entries={index.filter((entry) => entry.book.testament === 'old')} />
      <AdSlot position="page" className="mt-16" />
    </div>
  );
}
