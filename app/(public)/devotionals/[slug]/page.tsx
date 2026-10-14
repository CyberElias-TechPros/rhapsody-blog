import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, BookMarked, CalendarDays, Clock, FileText, Hash, Headphones } from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import { DevotionalCard } from '@/components/DevotionalCard';
import { AdSlot } from '@/components/common/AdSlot';
import { DayNav } from '@/components/devotional/DayNav';
import { SaveButton } from '@/components/devotional/SaveButton';
import { ShareRow } from '@/components/devotional/ShareRow';
import { ListenButton } from '@/components/audio/ListenButton';
import {
  ClosingCard,
  ExtraSectionCard,
  FurtherStudyCard,
  ReadingPlansCard,
  ScriptureCard,
} from '@/components/devotional/Sections';
import { AudienceBadge } from '@/components/common/AudienceBadge';
import {
  getAllDevotionals,
  getAllSlugs,
  getAdjacentDevotionals,
  getDaySiblings,
  getDevotionalBySlug,
  getDevotionalsByEdition,
} from '@/lib/content';
import { AUDIENCES } from '@/lib/audiences';
import { formatDate, formatDayHeading } from '@/lib/format';
import { devotionalScript } from '@/lib/tts';
import { SITE, absoluteUrl } from '@/lib/site';
import type { Devotional } from '@/lib/types';

/** Every article is prerendered at build time — the whole blog is static HTML. */
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getDevotionalBySlug(slug);
  if (!post) return { title: 'Devotional not found', robots: { index: false } };

  const url = absoluteUrl(`/devotionals/${post.slug}`);
  return {
    title: `${post.title} — ${formatDate(post.date)}`,
    description: post.excerpt,
    keywords: [post.title, post.series, post.editionTitle, post.scriptureReference, ...post.tags].filter(Boolean),
    authors: [{ name: post.author }],
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url,
      siteName: SITE.name,
      publishedTime: `${post.date}T05:00:00.000Z`,
      authors: [post.author],
      tags: post.tags,
      images: [{ url: absoluteUrl(SITE.ogImage), width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [absoluteUrl(SITE.ogImage)],
    },
  };
}

/** Schema.org Article — so the day's devotional is understood by search engines and readers. */
function jsonLd(post: Devotional) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    alternateName: post.titleOriginal || undefined,
    description: post.excerpt,
    datePublished: `${post.date}T05:00:00.000Z`,
    dateModified: `${post.date}T05:00:00.000Z`,
    inLanguage: SITE.locale.replace('_', '-'),
    wordCount: post.words,
    timeRequired: `PT${post.readingMinutes}M`,
    articleSection: post.editionTitle,
    keywords: post.tags.join(', '),
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: SITE.publisher },
    isPartOf: { '@type': 'Periodical', name: `${post.series} — ${post.editionTitle} Edition`, issn: '1596-6984' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/devotionals/${post.slug}`) },
    image: absoluteUrl(SITE.ogImage),
    copyrightNotice: SITE.attribution,
    citation: post.scriptureReference ? { '@type': 'CreativeWork', name: post.scriptureReference } : undefined,
  };
}

export default async function DevotionalPage({ params }: Props) {
  const { slug } = await params;
  const post = getDevotionalBySlug(slug);
  if (!post) notFound();

  const { previous, next } = getAdjacentDevotionals(post.slug);
  const siblings = getDaySiblings(post.slug);
  const moreFromEdition = getDevotionalsByEdition(post.edition)
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);
  const corpusSize = getAllDevotionals().length;
  // Built on the server so the first tap can start speaking immediately — no fetch, no waiting
  // for a client bundle to work out what the article says.
  const spoken = devotionalScript(post);

  return (
    <article className="pb-24">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(post)) }}
      />

      <div className="container max-w-3xl pt-12">
        <Link
          href="/devotionals"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> All devotionals
        </Link>

        <header className="animate-fade-in">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <Link
              href={`/editions/${post.edition}`}
              className="uppercase tracking-wider text-primary font-medium hover:underline"
            >
              {post.editionTitle} edition
            </Link>
            <AudienceBadge audience={post.audience} href={`/devotionals?audience=${post.audience}`} />
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              {post.weekday} {post.dayOfMonth}
            </span>
          </div>

          <h1 className="font-serif text-4xl md:text-6xl font-semibold leading-[1.1] tracking-tight mt-3 text-balance">
            {post.title}
          </h1>

          {/* The line the edition prints under its headline — `(Be a problem-solver)` and friends. */}
          {post.subtitle && (
            <p className="mt-4 font-serif text-xl md:text-2xl leading-snug text-muted-foreground italic text-balance">
              {post.subtitle}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <time dateTime={post.date}>{formatDayHeading(post.date)}</time>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {post.readingMinutes} min read
            </span>
            <span className="flex items-center gap-1.5">
              <BookMarked className="w-3.5 h-3.5" aria-hidden="true" /> {post.scriptureReference || 'Opening scripture'}
            </span>
            <span className="flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5" aria-hidden="true" /> {spoken.minutes} min listen
            </span>
          </div>
        </header>

        {/* Read aloud: the whole day in the order the page prints it — title, opening scripture,
            the message a paragraph at a time, the prayer, further study and the reading plans.
            Playback lives in the root layout, so it carries on while the reader browses. */}
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border/70 bg-card px-5 py-4">
          <ListenButton script={spoken} showDuration />
          <p className="text-xs text-muted-foreground max-w-xs">
            Step straight to the prayer, change the speed, or keep listening on another page.
          </p>
        </div>

        <ScriptureCard text={post.scripture} reference={post.scriptureReference} />

        <div className="mt-10 animate-fade-in-slow">
          <Markdown dropCap>{post.message.join('\n\n')}</Markdown>
        </div>

        <ClosingCard label={post.prayerLabel} text={post.prayer} />
        {post.extras.map((section) => (
          <ExtraSectionCard key={section.label} section={section} />
        ))}
        <FurtherStudyCard references={post.furtherStudy} />
        <ReadingPlansCard oneYear={post.oneYearPlan} twoYear={post.twoYearPlan} />

        <div className="mt-12 flex flex-wrap items-center gap-3 pt-8 border-t border-border">
          {post.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Tags">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    href={`/devotionals?q=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-xs hover:bg-secondary/70 hover:text-primary transition-colors"
                  >
                    <Hash className="w-3 h-3" aria-hidden="true" />
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="ml-auto flex gap-2">
            <ShareRow title={post.title} text={post.excerpt} />
            <SaveButton slug={post.slug} title={post.title} variant="button" />
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground flex items-start gap-2">
          <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            From <em>{post.source}</em>, pages {post.sourcePages.join('–')} of{' '}
            <code className="text-[0.95em]">{post.sourcePdf}</code>. {SITE.attribution}
          </span>
        </p>

        {siblings.length > 0 && (
          <aside className="mt-10 rounded-2xl border border-border/70 bg-card px-6 py-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">The same day, for other readers</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {siblings.map((sibling) => (
                <li key={sibling.slug}>
                  <Link
                    href={`/devotionals/${sibling.slug}`}
                    className="group inline-flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                  >
                    <AudienceBadge audience={sibling.audience} />
                    <span className="font-serif text-base group-hover:text-primary transition-colors">{sibling.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              {AUDIENCES[post.audience].series} is read alongside{' '}
              {siblings.map((sibling) => AUDIENCES[sibling.audience].series).join(' and ')}.
            </p>
          </aside>
        )}

        {/* Below the whole devotional — message, prayer, further study and reading plans are
            never interrupted by an ad unit. */}
        <AdSlot position="article" className="mt-10" minHeight={120} />

        <DayNav previous={previous} next={next} />
      </div>

      {moreFromEdition.length > 0 && (
        <section className="container max-w-6xl mt-24">
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="font-serif text-3xl font-semibold">More from {post.editionTitle}</h2>
            <Link
              href={`/editions/${post.edition}`}
              className="text-sm text-primary hover:underline shrink-0"
            >
              See the whole edition →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {moreFromEdition.map((p, i) => (
              <DevotionalCard key={p.slug} post={p} index={i} compact />
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {corpusSize} daily devotionals published so far.{' '}
            <Link href="/devotionals" className="text-primary hover:underline">
              Browse the library
            </Link>
            .
          </p>

          <AdSlot position="article" className="mt-10" minHeight={120} />
        </section>
      )}
    </article>
  );
}
