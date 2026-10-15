import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarSearch, ExternalLink, FileText } from 'lucide-react';
import { Fragment } from 'react';
import { DevotionalCard } from '@/components/DevotionalCard';
import { AdSlot } from '@/components/common/AdSlot';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { FEED_AD_EVERY } from '@/lib/ads';
import { PageHeader } from '@/components/common/StateBlocks';
import { SaveOfflineButton } from '@/components/pwa/SaveOfflineButton';
import { getEdition, getEditions, getDevotionalsByEdition } from '@/lib/content';
import { AUDIENCES } from '@/lib/audiences';
import { formatDate } from '@/lib/format';
import {
  AUDIENCE_HUB,
  breadcrumbJsonLd,
  collectionJsonLd,
  editionSeoDescription,
  editionSeoName,
  editionSeoTitle,
  jsonLdString,
  pageMetadata,
} from '@/lib/seo';
import { SITE } from '@/lib/site';

interface Props {
  params: Promise<{ edition: string }>;
}

export function generateStaticParams() {
  return getEditions().map((edition) => ({ edition: edition.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { edition } = await params;
  const found = getEdition(edition);
  if (!found) return { title: 'Edition not found', robots: { index: false } };
  const name = editionSeoName(found);
  return pageMetadata({
    title: editionSeoTitle(found),
    description: editionSeoDescription(found),
    path: `/editions/${found.slug}`,
    absolute: true,
    keywords: [name, `${name} PDF`, `${name} online`, `${AUDIENCES[found.audience].series} ${found.monthName}`, 'Pastor Chris Oyakhilome'],
  });
}

export default async function EditionPage({ params }: Props) {
  const { edition } = await params;
  const found = getEdition(edition);
  if (!found) notFound();

  const posts = getDevotionalsByEdition(found.slug).slice().reverse(); // oldest → newest, day 1 first
  const name = editionSeoName(found);
  const month = found.slug.slice(0, 7);
  const crumbs = [
    { name: 'Home', path: '/' },
    ...(found.audience !== 'adults'
      ? [{ name: found.audience === 'teens' ? 'TeeVo' : AUDIENCES[found.audience].shortLabel, path: AUDIENCE_HUB[found.audience] }]
      : [{ name: 'Editions', path: '/editions' }]),
    { name, path: `/editions/${found.slug}` },
  ];
  const structured = [
    breadcrumbJsonLd(crumbs),
    collectionJsonLd({
      name,
      description: editionSeoDescription(found),
      path: `/editions/${found.slug}`,
      items: posts.map((post) => ({ name: `${post.title} — ${formatDate(post.date)}`, path: `/devotionals/${post.slug}` })),
    }),
  ];

  return (
    <div className="container py-12 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(structured) }} />
      <Breadcrumbs crumbs={crumbs} className="mb-8" />

      <PageHeader
        eyebrow={`${found.audienceLabel} · ${found.postCount} daily devotionals · ${formatDate(found.firstDate)} – ${formatDate(found.lastDate)}`}
        title={name}
        subtitle={`Every day of the ${found.monthName} ${found.year} edition of ${AUDIENCES[found.audience].series} by ${SITE.author}, in order — each with its opening scripture, the message and the ${
          found.audience === 'early-readers' ? 'prayer or confession' : 'prayer or confession, further study and Bible reading plan'
        }.`}
      >
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <SaveOfflineButton setId={found.slug} urls={posts.map((post) => `/devotionals/${post.slug}`)} label={name} />
          <Link
            href={`/calendar?month=${month}${found.audience === 'adults' ? '' : `&audience=${found.audience}`}`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-primary"
          >
            <CalendarSearch className="w-4 h-4" aria-hidden="true" /> View as a calendar
          </Link>
        </div>
      </PageHeader>

      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post, i) => (
          <Fragment key={post.slug}>
            <DevotionalCard post={post} index={i} />
            {(i + 1) % FEED_AD_EVERY === 0 && <AdSlot position="feed" format="fluid" className="md:col-span-2 lg:col-span-3" />}
          </Fragment>
        ))}
      </div>

      {/* Readers search for "… October 2026 PDF". The honest answer: read it all here, free, and
          the official PDF / e-book / print edition is the publisher's to sell. */}
      <aside className="mt-14 rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <FileText className="w-4 h-4 text-primary" aria-hidden="true" /> Looking for the {name} PDF?
        </p>
        <p className="mt-2 max-w-3xl">
          Every day of this edition is on this page to read, listen to and share — free — and “Save for offline” keeps the whole
          month on your phone. The official PDF, e-book and printed copies are published by {SITE.publisher}.{' '}
          <a href={SITE.officialStoreUrl} rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
            Get the official edition <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </p>
        <p className="mt-3 text-xs">Transcribed from {found.sourcePdf}.</p>
      </aside>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Reading day by day?{' '}
        <Link href="/feed.xml" className="text-primary hover:underline">
          Subscribe to the RSS feed
        </Link>{' '}
        and each morning&apos;s devotional lands in your reader.
      </p>
    </div>
  );
}
