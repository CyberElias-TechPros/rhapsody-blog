import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { DevotionalCard } from '@/components/DevotionalCard';
import { PageHeader } from '@/components/common/StateBlocks';
import { getEdition, getEditions, getDevotionalsByEdition } from '@/lib/content';
import { formatDate } from '@/lib/format';
import { SITE, absoluteUrl } from '@/lib/site';

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

  const url = absoluteUrl(`/editions/${found.slug}`);
  return {
    title: `${found.title} edition`,
    description: `All ${found.postCount} daily devotionals from the ${found.title} edition of ${SITE.series}.`,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: `${found.title} edition — ${SITE.name}`,
      description: `All ${found.postCount} daily devotionals from the ${found.title} edition of ${SITE.series}.`,
      url,
      siteName: SITE.name,
      images: [{ url: absoluteUrl(SITE.ogImage), width: 1200, height: 630, alt: found.title }],
    },
  };
}

export default async function EditionPage({ params }: Props) {
  const { edition } = await params;
  const found = getEdition(edition);
  if (!found) notFound();

  const posts = getDevotionalsByEdition(found.slug).slice().reverse(); // oldest → newest, day 1 first

  return (
    <div className="container py-16 md:py-20">
      <Link
        href="/editions"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> All editions
      </Link>

      <PageHeader
        eyebrow={`${found.postCount} daily devotionals · ${formatDate(found.firstDate)} – ${formatDate(found.lastDate)}`}
        title={`${found.title} edition`}
        subtitle={`Every day of ${found.monthName} ${found.year}, in order. Extracted from ${found.sourcePdf}.`}
      />

      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post, i) => (
          <DevotionalCard key={post.slug} post={post} index={i} />
        ))}
      </div>

      <p className="mt-14 text-center text-sm text-muted-foreground">
        Reading day by day? <Link href="/feed.xml" className="text-primary hover:underline">Subscribe to the RSS feed</Link> and
        each morning&apos;s devotional lands in your reader.
      </p>
    </div>
  );
}
