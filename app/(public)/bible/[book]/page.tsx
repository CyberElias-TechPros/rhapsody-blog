import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Fragment } from 'react';
import { DevotionalCard } from '@/components/DevotionalCard';
import { AdSlot } from '@/components/common/AdSlot';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { PageHeader } from '@/components/common/StateBlocks';
import { getBibleBookIndex, getDevotionalsByBook, getSummary } from '@/lib/content';
import { AUDIENCES, AUDIENCE_ORDER } from '@/lib/audiences';
import { bibleGatewayUrl, getBookBySlug } from '@/lib/bible';
import { FEED_AD_EVERY } from '@/lib/ads';
import { breadcrumbJsonLd, collectionJsonLd, jsonLdString, pageMetadata } from '@/lib/seo';

interface Props {
  params: Promise<{ book: string }>;
}

export function generateStaticParams() {
  return getBibleBookIndex().map(({ book }) => ({ book: book.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { book: slug } = await params;
  const book = getBookBySlug(slug);
  const posts = book ? getDevotionalsByBook(book.slug) : [];
  if (!book || !posts.length) return { title: 'Book not found', robots: { index: false } };
  return pageMetadata({
    title: `Rhapsody of Realities on ${book.name} — ${posts.length} Daily Devotionals`,
    description: `Every Rhapsody of Realities devotional that opens with a verse from ${book.name}, in chapter-and-verse order — ${posts.length} daily devotionals by Pastor Chris Oyakhilome, for adults, TeeVo and Early Readers.`,
    path: `/bible/${book.slug}`,
    absolute: true,
    keywords: [`Rhapsody of Realities ${book.name}`, `devotional on ${book.name}`, `${book.name} daily devotional`, 'Pastor Chris Oyakhilome'],
  });
}

export default async function BibleBookPage({ params }: Props) {
  const { book: slug } = await params;
  const book = getBookBySlug(slug);
  const posts = book ? getDevotionalsByBook(book.slug) : [];
  if (!book || !posts.length) notFound();

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'By Bible book', path: '/bible' },
    { name: book.name, path: `/bible/${book.slug}` },
  ];
  const groups = AUDIENCE_ORDER.map((audience) => ({ audience, posts: posts.filter((post) => post.audience === audience) })).filter(
    (group) => group.posts.length
  );
  const index = getBibleBookIndex();
  const position = index.findIndex((entry) => entry.book.slug === book.slug);
  const neighbours = [index[position - 1], index[position + 1]].filter(Boolean);
  const structured = [
    breadcrumbJsonLd(crumbs),
    collectionJsonLd({
      name: `Rhapsody of Realities on ${book.name}`,
      description: `Daily devotionals that open with a verse from ${book.name}.`,
      path: `/bible/${book.slug}`,
      items: posts.map((post) => ({ name: `${post.title} (${post.scriptureReference})`, path: `/devotionals/${post.slug}` })),
    }),
  ];

  return (
    <div className="container py-12 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(structured) }} />
      <Breadcrumbs crumbs={crumbs} className="mb-8" />
      <PageHeader
        eyebrow={`${book.testament === 'new' ? 'New' : 'Old'} Testament · ${posts.length} devotionals`}
        title={`Rhapsody of Realities on ${book.name}`}
        subtitle={`Every day that opens with a verse from ${book.name}, in chapter-and-verse order.`}
      >
        <p className="mt-4 text-sm">
          <a href={bibleGatewayUrl(book.name)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Read the book of {book.name} →
          </a>
        </p>
      </PageHeader>

      {groups.map((group) => (
        <section key={group.audience} aria-labelledby={`group-${group.audience}`} className="mt-12">
          <h2 id={`group-${group.audience}`} className="font-serif text-2xl font-semibold border-b border-border/60 pb-3">
            {AUDIENCES[group.audience].series} <span className="text-muted-foreground text-base font-normal">({group.posts.length})</span>
          </h2>
          <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {group.posts.map((post, i) => (
              <Fragment key={post.slug}>
                <DevotionalCard post={getSummary(post)} index={i} />
                {(i + 1) % FEED_AD_EVERY === 0 && <AdSlot position="feed" format="fluid" className="md:col-span-2 lg:col-span-3" />}
              </Fragment>
            ))}
          </div>
        </section>
      ))}

      <nav aria-label="Other books" className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-8 text-sm">
        {neighbours.map((entry) => (
          <Link key={entry!.book.slug} href={`/bible/${entry!.book.slug}`} className="text-primary hover:underline">
            {entry!.book.name} ({entry!.count})
          </Link>
        ))}
        <Link href="/bible" className="text-muted-foreground hover:text-primary">
          All books →
        </Link>
      </nav>
    </div>
  );
}
