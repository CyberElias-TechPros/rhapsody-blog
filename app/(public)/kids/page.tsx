import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/StateBlocks';
import { KidsIssueCard, KidsOcrNote } from '@/components/kids/Sections';
import { getAllIssues, getIssuesByYear, getKidsStats, getSummary } from '@/lib/kids';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Rhapsody of Realities for Kids — Monthly Magazine Issues (RORK)',
  description:
    'Every issue of Rhapsody of Realities for Kids — the illustrated devotional magazine for young children, page by page, with the words of each page underneath. Plus Early Readers for ages 6–12.',
  path: '/kids',
  absolute: true,
});

/**
 * The kids' edition, one card per monthly issue. This is not the daily devotional: RORK is a comic
 * and activity magazine, so an issue is the unit that can be published honestly — 50 pages of art
 * with a verse, a story and something to do — rather than 50 fake articles with a date each.
 */
export default function KidsIndexPage() {
  const groups = getIssuesByYear();
  const stats = getKidsStats();
  const issues = getAllIssues();

  return (
    <div className="container py-16 md:py-20">
      <PageHeader
        eyebrow="Rhapsody of Realities for Kids"
        title="Rhapsody of Realities for Kids"
        subtitle={`${issues.length} monthly ${issues.length === 1 ? 'issue' : 'issues'} — ${stats.pages} pages of the edition written for children who are just learning to read the Word for themselves. Each issue is published page by page, with the words of every page underneath it.`}
      />

      <KidsOcrNote
        pages={stats.pages}
        recognised={stats.recognised}
        textless={stats.textless}
        artworkIssues={issues.filter((issue) => issue.artworkDecoded === false).length}
      />

      {groups.map((group) => (
        <section key={group.year} aria-labelledby={`kids-${group.year}`} className="mt-14 first:mt-12">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border/60 pb-4">
            <h2 id={`kids-${group.year}`} className="font-serif text-3xl font-semibold">
              {group.year}
            </h2>
            <p className="text-sm text-muted-foreground">
              {group.issues.length} {group.issues.length === 1 ? 'issue' : 'issues'} ·{' '}
              {group.issues.reduce((sum, issue) => sum + issue.pageCount, 0)} pages
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {group.issues.map((issue) => (
              <KidsIssueCard key={issue.slug} issue={getSummary(issue)} />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-16 text-sm text-muted-foreground">
        Articles are republished with attribution; all rights remain with Loveworld Publishing. The page images are the
        printed pages, stored small on purpose — click any page to open it full size.
      </p>
    </div>
  );
}
