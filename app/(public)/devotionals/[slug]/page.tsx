import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BookMarked, CalendarDays, CalendarSearch, Clock, FileText, Headphones, Shuffle } from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import { DevotionalCard } from '@/components/DevotionalCard';
import { AdSlot } from '@/components/common/AdSlot';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { DayNav } from '@/components/devotional/DayNav';
import { SaveButton } from '@/components/devotional/SaveButton';
import { ListenButton } from '@/components/audio/ListenButton';
import {
  ClosingCard,
  ExtraSectionCard,
  FurtherStudyCard,
  ReadingPlansCard,
  ScriptureCard,
} from '@/components/devotional/Sections';
import { AudienceBadge } from '@/components/common/AudienceBadge';
import { NotesCard } from '@/components/reader/NotesCard';
import { ReadingTracker } from '@/components/reader/ReadingTracker';
import { ReadingToolbar } from '@/components/reader/ReadingToolbar';
import { ReminderDialog } from '@/components/reader/ReminderDialog';
import { SHARE_URL_TOKEN, ShareMenu } from '@/components/reader/ShareMenu';
import {
  getAllDevotionals,
  getAllSlugs,
  getAdjacentDevotionals,
  getDaySiblings,
  getDevotionalBySlug,
  getDevotionalsByEdition,
  getSameBookDevotionals,
} from '@/lib/content';
import { AUDIENCES } from '@/lib/audiences';
import { stripTrailingReference } from '@/lib/bible';
import { formatDayMonthYear, formatOrdinalDate } from '@/lib/format';
import {
  AUDIENCE_HUB,
  AUDIENCE_SEARCH_NAME,
  breadcrumbJsonLd,
  devotionalKeywords,
  devotionalSeoDescription,
  devotionalSeoTitle,
  jsonLdString,
  monthEditionName,
  periodicalJsonLd,
} from '@/lib/seo';
import { devotionalShareText, devotionalTeaser } from '@/lib/share-text';
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

const ogImageFor = (post: Devotional) => absoluteUrl(`/og/devotionals/${post.slug}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getDevotionalBySlug(slug);
  if (!post) return { title: 'Devotional not found', robots: { index: false } };

  const url = absoluteUrl(`/devotionals/${post.slug}`);
  const title = devotionalSeoTitle(post);
  const description = devotionalSeoDescription(post);
  const image = { url: ogImageFor(post), width: 1200, height: 630, alt: title };
  return {
    // Already leads with the series name and date, so the layout's "| Rhapsody of Realities"
    // suffix is skipped.
    title: { absolute: title },
    description,
    keywords: devotionalKeywords(post),
    authors: [{ name: post.author }],
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      publishedTime: `${post.date}T05:00:00.000Z`,
      authors: [post.author],
      section: monthEditionName(post.audience, post.date),
      tags: [AUDIENCE_SEARCH_NAME[post.audience], post.scriptureReference, ...post.tags].filter(Boolean),
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  };
}

/** Schema.org Article — headline with the date, the publication it belongs to, its image. */
function articleJsonLd(post: Devotional) {
  const headline = devotionalSeoTitle(post);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: headline.length > 110 ? `${headline.slice(0, 109)}…` : headline,
    name: post.title,
    alternateName: post.titleOriginal || undefined,
    description: devotionalSeoDescription(post),
    datePublished: `${post.date}T05:00:00.000Z`,
    dateModified: `${post.date}T05:00:00.000Z`,
    inLanguage: SITE.locale.replace('_', '-'),
    wordCount: post.words,
    timeRequired: `PT${post.readingMinutes}M`,
    articleSection: `${AUDIENCES[post.audience].series} — ${post.editionTitle}`,
    keywords: devotionalKeywords(post).join(', '),
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: SITE.publisher },
    isPartOf: { ...periodicalJsonLd(), name: AUDIENCES[post.audience].series },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/devotionals/${post.slug}`) },
    image: { '@type': 'ImageObject', url: ogImageFor(post), width: 1200, height: 630 },
    copyrightNotice: SITE.attribution,
    citation: post.scriptureReference ? { '@type': 'CreativeWork', name: post.scriptureReference } : undefined,
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.scripture-card'] },
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
  const sameBook = getSameBookDevotionals(post, 4);
  const corpusSize = getAllDevotionals().length;
  // Built on the server so the first tap can start speaking immediately — no fetch, no waiting
  // for a client bundle to work out what the article says.
  const spoken = devotionalScript(post);
  const path = `/devotionals/${post.slug}`;
  const seriesName = AUDIENCE_SEARCH_NAME[post.audience];
  const dayLine = `${post.weekday}, ${formatDayMonthYear(post.date)}`;
  const edition = monthEditionName(post.audience, post.date);
  const crumbs = [
    { name: 'Home', path: '/' },
    ...(post.audience !== 'adults' ? [{ name: AUDIENCES[post.audience].shortLabel === 'Teens' ? 'TeeVo' : AUDIENCES[post.audience].shortLabel, path: AUDIENCE_HUB[post.audience] }] : []),
    { name: edition, path: `/editions/${post.edition}` },
    { name: dayLine, path },
  ];
  const entry = { slug: post.slug, title: post.title, date: post.date, audience: post.audience };
  const verseSources = [
    ...(post.scripture
      ? [{ id: 'scripture', label: 'Opening scripture', text: stripTrailingReference(post.scripture), reference: post.scriptureReference }]
      : []),
    ...(post.prayer ? [{ id: post.prayerLabel.toLowerCase(), label: post.prayerLabel, text: post.prayer, reference: undefined }] : []),
  ];

  return (
    <article className="pb-24" data-print-url={absoluteUrl(path)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString([articleJsonLd(post), breadcrumbJsonLd(crumbs)]) }} />
      <ReadingTracker {...entry} targetId="devotional-body" readingMinutes={post.readingMinutes} />

      <div className="container reading-column pt-10">
        <Breadcrumbs crumbs={crumbs} className="mb-8" />

        <header className="animate-fade-in">
          {/* The dateline readers (and search engines) look for: the series and the day. */}
          <p className="text-sm font-medium text-muted-foreground">
            <Link href={AUDIENCE_HUB[post.audience]} className="text-primary hover:underline">
              {seriesName}
            </Link>{' '}
            · <time dateTime={post.date}>{dayLine}</time>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <Link href={`/editions/${post.edition}`} className="uppercase tracking-wider text-primary font-medium hover:underline">
              {post.editionTitle} edition
            </Link>
            <AudienceBadge audience={post.audience} href={AUDIENCE_HUB[post.audience] === '/' ? `/devotionals?audience=${post.audience}` : AUDIENCE_HUB[post.audience]} />
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              {post.weekday} {post.dayOfMonth}
            </span>
          </div>

          <h1 className="font-serif text-4xl md:text-6xl font-semibold leading-[1.1] tracking-tight mt-3 text-balance">{post.title}</h1>

          {/* The line the edition prints under its headline — `(Be a problem-solver)` and friends. */}
          {post.subtitle && (
            <p className="mt-4 font-serif text-xl md:text-2xl leading-snug text-muted-foreground italic text-balance">{post.subtitle}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span>{formatOrdinalDate(post.date)}</span>
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

        {/* Read aloud and the reader's tools. Playback lives in the root layout, so it carries on
            while the reader browses; settings, focus and progress are kept on the device. */}
        <div className="mt-8 rounded-2xl border border-border/70 bg-card px-5 py-4" data-print-hide="">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <ListenButton script={spoken} showDuration shortcut="listen" />
            <p className="text-xs text-muted-foreground max-w-xs">
              Step straight to the {post.prayerLabel.toLowerCase()}, change the speed, or keep listening on another page.
            </p>
          </div>
          <div className="mt-3 border-t border-border/60 pt-3">
            <ReadingToolbar entry={entry} />
          </div>
        </div>

        <div id="devotional-body" className="reading-body">
          <ScriptureCard text={post.scripture} reference={post.scriptureReference} />

          <div className="mt-10 animate-fade-in-slow">
            <Markdown dropCap>{post.message.join('\n\n')}</Markdown>
          </div>

          <ClosingCard label={post.prayerLabel} text={post.prayer} />
          {post.extras.map((section) => (
            <ExtraSectionCard key={section.label} section={section} />
          ))}
          <FurtherStudyCard references={post.furtherStudy} />
          <ReadingPlansCard oneYear={post.oneYearPlan} twoYear={post.twoYearPlan} slug={post.slug} date={post.date} />
        </div>

        <NotesCard slug={post.slug} title={post.title} date={post.date} />

        <div className="mt-10 flex flex-wrap items-center gap-2 pt-8 border-t border-border" data-print-hide="">
          <ShareMenu
            path={path}
            title={devotionalSeoTitle(post)}
            teaser={devotionalTeaser(post)}
            fullText={devotionalShareText(post, SHARE_URL_TOKEN)}
            verses={verseSources}
            imageHeading={seriesName}
            imageSubheading={dayLine}
            fileStem={`${seriesName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${post.date}`}
          />
          <SaveButton slug={post.slug} title={post.title} variant="button" />
          <ReminderDialog defaultAudience={post.audience} />
        </div>

        <p className="mt-6 text-xs text-muted-foreground flex items-start gap-2">
          <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            From <em>{post.source}</em>, pages {post.sourcePages.join('–')} of <code className="text-[0.95em]">{post.sourcePdf}</code>.{' '}
            {SITE.attribution}
          </span>
        </p>

        {siblings.length > 0 && (
          <aside className="mt-10 rounded-2xl border border-border/70 bg-card px-6 py-5" data-focus-hide="">
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
              {AUDIENCES[post.audience].series} is read alongside {siblings.map((sibling) => AUDIENCES[sibling.audience].series).join(' and ')}.
            </p>
          </aside>
        )}

        {/* Below the whole devotional — message, prayer, further study and reading plans are
            never interrupted by an ad unit. */}
        <AdSlot position="article" className="mt-10" minHeight={120} />

        <DayNav previous={previous} next={next} />

        <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm" data-focus-hide="" data-print-hide="">
          <Link href={`/calendar?month=${post.date.slice(0, 7)}${post.audience === 'adults' ? '' : `&audience=${post.audience}`}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary">
            <CalendarSearch className="w-4 h-4" aria-hidden="true" /> Pick another date
          </Link>
          <Link href={`/random${post.audience === 'adults' ? '' : `?audience=${post.audience}`}`} prefetch={false} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary">
            <Shuffle className="w-4 h-4" aria-hidden="true" /> Surprise me
          </Link>
        </div>
      </div>

      {sameBook.book && sameBook.posts.length > 0 && (
        <section className="container max-w-6xl mt-20" data-focus-hide="" data-print-hide="">
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="font-serif text-3xl font-semibold">More devotionals from {sameBook.book.name}</h2>
            <Link href={`/bible/${sameBook.book.slug}`} className="text-sm text-primary hover:underline shrink-0">
              Every day from {sameBook.book.name} →
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sameBook.posts.map((p, i) => (
              <DevotionalCard key={p.slug} post={p} index={i} compact />
            ))}
          </div>
        </section>
      )}

      {moreFromEdition.length > 0 && (
        <section className="container max-w-6xl mt-20" data-focus-hide="" data-print-hide="">
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="font-serif text-3xl font-semibold">More from {edition}</h2>
            <Link href={`/editions/${post.edition}`} className="text-sm text-primary hover:underline shrink-0">
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
