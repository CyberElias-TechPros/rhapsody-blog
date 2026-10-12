import type { Metadata } from 'next';
import { SearchClient } from '@/components/search/SearchClient';
import { PageHeader } from '@/components/common/StateBlocks';
import { getContentStats, getSearchIndex } from '@/lib/content';
import { getResourceSearchIndex, getResourceStats } from '@/lib/resources';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Search',
  description: `Search every daily devotional on ${SITE.name} by title, word, scripture reference or date.`,
  alternates: { canonical: '/search' },
};

/**
 * The corpus is small enough to ship a compact index to the browser (titles, excerpts, dates,
 * scripture references and the opening words of each article — no full bodies), so search is
 * instant and works offline. Anything the index can't answer is one click away on `/devotionals`.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';
  const docs = getSearchIndex();
  const stats = getContentStats();
  const resources = getResourceSearchIndex();
  const resourceStats = getResourceStats();

  return (
    <div className="container py-16 md:py-20 max-w-5xl">
      <PageHeader
        eyebrow={`${stats.posts} devotionals · ${stats.editions} editions${
          resourceStats.resources ? ` · ${resourceStats.resources} books and resources` : ''
        }`}
        title="Search the library"
        subtitle="Match a phrase from an article, a book of the Bible, a title, or a date such as 2026-10-01."
      />
      <div className="mt-10">
        <SearchClient docs={docs} resources={resources} initialQuery={q} />
      </div>
    </div>
  );
}
