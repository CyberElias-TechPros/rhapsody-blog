import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, FileText } from 'lucide-react';
import { KidsOcrNote, KidsPageSpread, KidsPageStrip } from '@/components/kids/Sections';
import { getAllIssues, getAllSlugs, getIssue, getKidsStats, KIND_LABELS, type KidsIssue } from '@/lib/kids';
import { formatDate } from '@/lib/format';
import { SITE, absoluteUrl } from '@/lib/site';

export const dynamicParams = false;

/** One static page per issue in `content/kids/`. */
export function generateStaticParams() {
  return getAllSlugs().map((issue) => ({ issue }));
}

interface Props {
  params: Promise<{ issue: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { issue: slug } = await params;
  const issue = getIssue(slug);
  if (!issue) return { title: 'Issue not found', robots: { index: false } };
  const url = absoluteUrl(`/kids/${issue.slug}`);
  // The cover is a real page of the magazine, so it is the share image — no generated card needed.
  const cover = issue.pages[0]?.image ? absoluteUrl(issue.pages[0].image) : undefined;
  return {
    title: { absolute: `Rhapsody of Realities for Kids ${issue.monthName} ${issue.year}: ${issue.title}` },
    description: issue.excerpt,
    keywords: [issue.series, issue.title, issue.monthName, String(issue.year), 'For Kids', 'RORK'],
    authors: [{ name: issue.author }],
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: issue.title,
      description: issue.excerpt,
      url,
      siteName: SITE.name,
      publishedTime: `${issue.date}T05:00:00.000Z`,
      authors: [issue.author],
      ...(cover ? { images: [{ url: cover, alt: `The cover of ${issue.title}` }] } : {}),
    },
    twitter: {
      card: cover ? 'summary_large_image' : 'summary',
      title: issue.title,
      description: issue.excerpt,
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

/**
 * An issue is a number of a periodical, not an article, and it is described as one — including the
 * ISSN the magazine printed on its own colophon, which is the reason this section can be cited.
 */
function jsonLd(issue: KidsIssue) {
  const cover = issue.pages[0]?.image;
  return {
    '@context': 'https://schema.org',
    '@type': 'PublicationIssue',
    name: issue.title,
    description: issue.excerpt,
    inLanguage: SITE.locale.replace('_', '-'),
    datePublished: `${issue.date}T05:00:00.000Z`,
    numberOfPages: issue.pageCount,
    author: { '@type': 'Person', name: issue.author },
    publisher: { '@type': 'Organization', name: SITE.publisher },
    isPartOf: {
      '@type': 'Periodical',
      name: issue.series,
      ...(issue.issn ? { issn: issue.issn } : {}),
    },
    isAccessibleForFree: true,
    copyrightNotice: SITE.attribution,
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/kids/${issue.slug}`) },
    ...(cover ? { image: absoluteUrl(cover) } : {}),
  };
}

/**
 * An issue, page by page. The page image is the content and the recovered words sit under it, so a
 * reader can always tell what was printed from what a recogniser guessed; `#page-N` anchors make a
 * single page linkable, which is how a teacher sends a class straight to the story.
 */
export default async function KidsIssuePage({ params }: Props) {
  const { issue: slug } = await params;
  const issue = getIssue(slug);
  if (!issue) notFound();

  const all = getAllIssues();
  const position = all.findIndex((entry) => entry.slug === issue.slug);
  // The corpus is newest first, so the newer issue is the entry before this one.
  const newer = position > 0 ? all[position - 1] : undefined;
  const older = position >= 0 && position < all.length - 1 ? all[position + 1] : undefined;
  const stats = getKidsStats();
  const kinds = issue.pages.reduce<Record<string, number>>((tally, page) => {
    const label = KIND_LABELS[page.kind];
    tally[label] = (tally[label] ?? 0) + 1;
    return tally;
  }, {});

  return (
    <div className="container py-12 md:py-16">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(issue)) }}
      />
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          <Link href="/kids" className="inline-flex items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> For Kids
          </Link>
        </p>
        <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-balance md:text-5xl">{issue.title}</h1>
        <p className="mt-3 text-muted-foreground">
          {formatDate(issue.date)} · {issue.pageCount} pages ·{' '}
          {issue.recognisedPages > 0
            ? `${issue.recognisedPages} with words read off the artwork`
            : 'every page carries its printed text'}
        </p>
        {issue.keyVerse ? (
          <blockquote className="mt-6 border-l-2 border-primary/50 pl-4 font-serif text-xl italic leading-snug">
            {issue.keyVerse}
          </blockquote>
        ) : null}
        <p className="mt-6 whitespace-pre-line text-[0.95rem] leading-relaxed text-muted-foreground">{issue.intro}</p>
      </header>

      <KidsOcrNote
        className="mt-8 max-w-3xl"
        pages={issue.pageCount}
        recognised={issue.recognisedPages}
        textless={issue.pages.filter((page) => page.recovered === 'none').length}
        artworkIssues={issue.artworkDecoded === false ? 1 : 0}
      />

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" /> {issue.source}
        </span>
        {issue.volume ? <span>Vol. {issue.volume}</span> : null}
        {issue.issn ? <span>ISSN {issue.issn}</span> : null}
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          {Object.entries(kinds)
            .map(([label, count]) => `${count} ${label.toLowerCase()}`)
            .join(' · ')}
        </span>
      </div>

      {issue.pages.length > 1 ? <KidsPageStrip pages={issue.pages} /> : null}

      <ol className="mt-10 space-y-6">
        {issue.pages.map((page) => (
          <KidsPageSpread key={page.number} page={page} artworkMissing={issue.artworkDecoded === false} />
        ))}
      </ol>

      <nav aria-label="More issues" className="mt-14 grid gap-3 border-t border-border/70 pt-8 sm:grid-cols-2">
        {newer ? (
          <Link href={`/kids/${newer.slug}`} className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 hover:border-primary/40">
            <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">Newer issue</span>
              <span className="block truncate text-sm font-medium">{newer.title}</span>
            </span>
          </Link>
        ) : null}
        {older ? (
          <Link
            href={`/kids/${older.slug}`}
            className="group flex items-center justify-end gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-right hover:border-primary/40 sm:col-start-2"
          >
            <span className="min-w-0">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">Older issue</span>
              <span className="block truncate text-sm font-medium">{older.title}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
          </Link>
        ) : null}
      </nav>

      <p className="mt-8 text-xs text-muted-foreground">
        Source: <code className="rounded bg-secondary px-1 py-0.5">{issue.sourcePdf}</code>. Articles and artwork are
        republished with attribution; all rights remain with Loveworld Publishing. {stats.pages} pages of this edition are
        published on {SITE.name}.
      </p>
    </div>
  );
}
