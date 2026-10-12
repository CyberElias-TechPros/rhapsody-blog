import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, BookMarked, CalendarDays, Clock, FileText, Hash, Headphones, ScanText } from 'lucide-react';
import { AdSlot } from '@/components/common/AdSlot';
import { ListenButton } from '@/components/audio/ListenButton';
import { SaveButton } from '@/components/devotional/SaveButton';
import { ShareRow } from '@/components/devotional/ShareRow';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { getAllResourceSlugs, getResourceBySlug, getResourceSummary, getResourcesByKind } from '@/lib/resources';
import { resourceScript } from '@/lib/tts';
import { formatDate } from '@/lib/format';
import { SITE, absoluteUrl } from '@/lib/site';
import type { Resource } from '@/lib/types';

/** Every resource is prerendered at build time, exactly like the devotionals. */
export function generateStaticParams() {
  return getAllResourceSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resource = getResourceBySlug(slug);
  if (!resource) return { title: 'Resource not found', robots: { index: false } };

  const url = absoluteUrl(`/resources/${resource.slug}`);
  return {
    title: `${resource.title}${resource.year ? ` (${resource.year})` : ''}`,
    description: resource.blurb || resource.excerpt,
    keywords: [resource.title, resource.author, resource.publisher, resource.kindLabel, ...resource.tags].filter(Boolean),
    authors: [{ name: resource.author }],
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: resource.title,
      description: resource.blurb || resource.excerpt,
      url,
      siteName: SITE.name,
      publishedTime: resource.date ? `${resource.date}T05:00:00.000Z` : undefined,
      authors: [resource.author],
      tags: resource.tags,
      images: [{ url: absoluteUrl(SITE.ogImage), width: 1200, height: 630, alt: resource.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: resource.title,
      description: resource.blurb || resource.excerpt,
      images: [absoluteUrl(SITE.ogImage)],
    },
  };
}

/** Schema.org Book for a book, Article for notes and programmes — so a search engine knows which. */
function jsonLd(resource: Resource) {
  const common = {
    '@context': 'https://schema.org',
    name: resource.title,
    alternateName: resource.subtitle || undefined,
    description: resource.blurb || resource.excerpt,
    inLanguage: SITE.locale.replace('_', '-'),
    author: { '@type': 'Person', name: resource.author },
    publisher: { '@type': 'Organization', name: resource.publisher },
    keywords: resource.tags.join(', '),
    wordCount: resource.words,
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/resources/${resource.slug}`) },
    image: absoluteUrl(SITE.ogImage),
    copyrightNotice: SITE.attribution,
  };

  if (resource.kind === 'book') {
    return {
      ...common,
      '@type': 'Book',
      isbn: resource.isbn || undefined,
      copyrightYear: resource.year || undefined,
      numberOfPages: resource.sourcePages || undefined,
      bookFormat: 'https://schema.org/EBook',
    };
  }
  return {
    ...common,
    '@type': 'Article',
    headline: resource.title,
    datePublished: resource.date ? `${resource.date}T05:00:00.000Z` : undefined,
    articleSection: resource.kindLabel,
  };
}

export default async function ResourcePage({ params }: Props) {
  const { slug } = await params;
  const resource = getResourceBySlug(slug);
  if (!resource) notFound();

  const spoken = resourceScript(resource);
  const more = getResourcesByKind(resource.kind)
    .filter((other) => other.slug !== resource.slug)
    .slice(0, 3)
    .map(getResourceSummary);
  const contents = resource.sections.filter((section) => section.heading);

  return (
    <article className="pb-24">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(resource)) }}
      />

      <div className="container max-w-6xl pt-12">
        <Link
          href="/resources"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> All books and resources
        </Link>

        <header className="max-w-3xl animate-fade-in">
          <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary font-medium">
            <BookMarked className="w-3.5 h-3.5" aria-hidden="true" /> {resource.kindLabel}
          </span>

          <h1 className="mt-3 font-serif text-4xl md:text-6xl font-semibold leading-[1.08] tracking-tight text-balance">
            {resource.title}
          </h1>
          {resource.subtitle && (
            <p className="mt-4 font-serif text-xl md:text-2xl leading-snug text-muted-foreground italic text-balance">
              {resource.subtitle}
            </p>
          )}

          <p className="mt-5 text-lg text-muted-foreground leading-relaxed text-pretty">{resource.blurb}</p>

          <dl className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {resource.author}
                {resource.publisher ? ` · ${resource.publisher}` : ''}
              </span>
            </div>
            {resource.date ? (
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                <time dateTime={resource.date}>{formatDate(resource.date)}</time>
                {resource.dateNote ? <span className="text-xs">({resource.dateNote})</span> : null}
              </div>
            ) : resource.year ? (
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> {resource.year}
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {resource.readingMinutes} min read
            </div>
            <div className="flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5" aria-hidden="true" /> {resource.listeningMinutes} min listen
            </div>
            {resource.sourcePages > 0 && <span>{resource.sourcePages} pages · {resource.words.toLocaleString()} words</span>}
            {resource.isbn && <span className="text-xs">ISBN {resource.isbn}</span>}
          </dl>
        </header>

        <div className="mt-8 flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border/70 bg-card px-5 py-4">
          <ListenButton script={spoken} showDuration label="Listen to this" />
          <p className="text-xs text-muted-foreground max-w-xs">
            {contents.length > 1
              ? `Read aloud from the top, or step straight to a chapter. ${contents.length} sections.`
              : 'Read aloud from the top, at whatever speed suits you.'}
          </p>
        </div>

        {/* A scan is published with its provenance on the page, not buried in a footnote. */}
        {resource.recovered === 'ocr' && (
          <aside className="mt-6 flex max-w-3xl gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-muted-foreground">
            <ScanText className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              This document is a scan of the printed book, so its words were read off the page images by a
              recogniser{resource.confidence ? ` (mean confidence ${resource.confidence}%)` : ''} rather than copied
              from the file. Nothing has been rewritten — but recognised text has not been read back by a human, and
              where a line looks odd, the printing is the source of truth.
            </p>
          </aside>
        )}

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="max-w-3xl">
            {resource.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                {section.heading && (
                  <h2 className="mt-12 first:mt-0 font-serif text-2xl md:text-3xl font-semibold leading-tight text-balance">
                    {section.heading}
                  </h2>
                )}
                <div className="mt-4 space-y-5">
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={index} className="text-lg leading-relaxed text-foreground/90 text-pretty">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}

            {resource.tags.length > 0 && (
              <ul className="mt-12 flex flex-wrap gap-2 border-t border-border pt-8" aria-label="Subjects">
                {resource.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`/search?q=${encodeURIComponent(tag)}`}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-xs hover:bg-secondary/70 hover:text-primary transition-colors"
                    >
                      <Hash className="w-3 h-3" aria-hidden="true" />
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-6 text-xs text-muted-foreground flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {resource.credit ? `${resource.credit}. ` : ''}Taken from{' '}
                <code className="text-[0.95em]">{resource.sourcePdf}</code>
                {resource.sourcePages ? `, ${resource.sourcePages} pages` : ''}. {SITE.attribution}
              </span>
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-8">
              <ShareRow title={resource.title} text={resource.blurb} />
              <SaveButton slug={resource.slug} title={resource.title} variant="button" />
            </div>

            <AdSlot position="article" className="mt-10" minHeight={120} />
          </div>

          {/* The contents: a long document without one is a scroll with no map. */}
          {contents.length > 1 && (
            <nav aria-label="Contents" className="lg:sticky lg:top-24 lg:self-start max-h-[70vh] overflow-y-auto">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Contents</p>
              <ol className="mt-3 space-y-1.5 border-l border-border/70 pl-4">
                {contents.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block text-sm text-muted-foreground hover:text-primary transition-colors leading-snug"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-muted-foreground">
                {contents.length} sections · {resource.words.toLocaleString()} words
              </p>
            </nav>
          )}
        </div>
      </div>

      {more.length > 0 && (
        <section className="container max-w-6xl mt-24">
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="font-serif text-3xl font-semibold">More {resource.kindLabel.toLowerCase()}</h2>
            <Link href="/resources" className="text-sm text-primary hover:underline shrink-0">
              The whole shelf →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {more.map((other, index) => (
              <ResourceCard key={other.slug} resource={other} index={index} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
