/**
 * Search-engine copy and structured data, in one place.
 *
 * How people look for this content (researched October 2026 against the sites that rank for it):
 *
 *   rhapsody of realities today · rhapsody of realities for today · today's rhapsody
 *   rhapsody of realities 15 october 2026 · … 15th october 2026 · … october 15, 2026
 *   rhapsody of realities october 2026 (often + "pdf" / "download")
 *   rhapsody teevo / teevo today / rhapsody of realities for teens
 *   rhapsody of realities for kids / for early readers
 *   pastor chris daily devotional · christ embassy / loveworld devotional
 *   rhapsody of realities prayer / confession / bible reading plan / audio
 *
 * Every competing page leads its title with the series name and the date, then the day's title —
 * so that is the shape used here. The keywords go where search engines weigh them (titles, H1s,
 * descriptions, structured data, internal link text and dedicated landing pages), written as
 * readable sentences. There is deliberately no hidden text and no keyword lists in the body:
 * Google's spam policies treat "keyword stuffing" as a ranking demotion, not a boost.
 */

import type { Metadata } from 'next';
import { AUDIENCES, type AudienceId } from '@/lib/audiences';
import { formatDate, formatDayMonthYear, formatMonthYear, formatOrdinalDate } from '@/lib/format';
import { SITE, absoluteUrl } from '@/lib/site';
import type { DevotionalSummary, Edition } from '@/lib/types';

/** The name each edition is searched by. Teens type "TeeVo", which is what the edition is called. */
export const AUDIENCE_SEARCH_NAME: Record<AudienceId, string> = {
  adults: 'Rhapsody of Realities',
  teens: 'Rhapsody of Realities TeeVo',
  'early-readers': 'Rhapsody of Realities for Early Readers',
};

/** Hub page for each edition's "today" and archive. */
export const AUDIENCE_HUB: Record<AudienceId, string> = {
  adults: '/',
  teens: '/teevo',
  'early-readers': '/early-readers',
};

/** Site-wide keywords: the head terms. Page-level keywords add the dated and audience variants. */
export const SITE_KEYWORDS = [
  'Rhapsody of Realities',
  'Rhapsody of Realities today',
  'Rhapsody of Realities daily devotional',
  "today's Rhapsody of Realities",
  'Rhapsody of Realities TeeVo',
  'Rhapsody of Realities for Teens',
  'Rhapsody of Realities for Kids',
  'Rhapsody of Realities for Early Readers',
  'Pastor Chris Oyakhilome',
  'Pastor Chris daily devotional',
  'Christ Embassy devotional',
  'LoveWorld devotional',
  'Rhapsody of Realities prayer and confession',
  'Rhapsody of Realities Bible reading plan',
  'daily devotional',
  'Christian devotional',
];

type DaySummary = Pick<
  DevotionalSummary,
  'title' | 'date' | 'audience' | 'weekday' | 'scriptureReference' | 'prayerLabel' | 'oneYearPlan' | 'twoYearPlan' | 'furtherStudy'
>;

const unique = (values: Array<string | undefined | null | false>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
};

/** Cut to a length on a word boundary, for meta descriptions. */
export function clip(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(' ', max - 1);
  return `${clean.slice(0, cut > 60 ? cut : max - 1).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/**
 * `Rhapsody of Realities 15 October 2026: The Reality of Christianity` — the series, the date in
 * the form most readers type it, then the day's own title. Used as the document title verbatim
 * (it already carries the brand, so the layout's `%s | Rhapsody of Realities` template is skipped).
 */
export function devotionalSeoTitle(post: Pick<DevotionalSummary, 'title' | 'date' | 'audience'>): string {
  return `${AUDIENCE_SEARCH_NAME[post.audience]} ${formatDayMonthYear(post.date)}: ${post.title}`;
}

/** The parts a day actually prints, as a phrase: "prayer, further study and Bible reading plan". */
function partsPhrase(post: DaySummary): string {
  const parts = unique([
    post.prayerLabel ? post.prayerLabel.toLowerCase() : 'prayer',
    post.furtherStudy && 'further study',
    (post.oneYearPlan || post.twoYearPlan) && 'Bible reading plan',
  ]);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Meta description: who, which day, what it is about, and what the page contains. */
export function devotionalSeoDescription(post: DaySummary): string {
  const day = `${post.weekday ? `${post.weekday}, ` : ''}${formatOrdinalDate(post.date)}`;
  const reference = post.scriptureReference ? ` (${post.scriptureReference})` : '';
  return clip(
    `${AUDIENCE_SEARCH_NAME[post.audience]} for ${day} by Pastor Chris Oyakhilome: “${post.title}”${reference}. Read the full message, ${partsPhrase(post)} — or listen to it.`,
    230
  );
}

/** Page-level keywords: every spelling of the date people search, plus the audience's own terms. */
export function devotionalKeywords(post: DaySummary): string[] {
  const name = AUDIENCE_SEARCH_NAME[post.audience];
  const audienceTerms: Record<AudienceId, string[]> = {
    adults: ['Rhapsody of Realities today', 'Rhapsody of Realities daily devotional'],
    teens: ['TeeVo today', 'Rhapsody TeeVo', 'Rhapsody of Realities for Teens', 'teens daily devotional'],
    'early-readers': ['Rhapsody of Realities for Early Readers today', 'Rhapsody for Kids', 'children’s devotional'],
  };
  return unique([
    `${name} ${formatDayMonthYear(post.date)}`,
    `${name} ${formatOrdinalDate(post.date)}`,
    `${name} ${formatDate(post.date)}`,
    `${name} ${formatMonthYear(post.date)}`,
    post.title,
    post.scriptureReference,
    ...audienceTerms[post.audience],
    `Rhapsody of Realities ${post.prayerLabel?.toLowerCase() || 'prayer'}`,
    'Pastor Chris Oyakhilome',
  ]);
}

/** The edition a day belongs to, by name: `Rhapsody of Realities TeeVo October 2026`. */
export function monthEditionName(audience: AudienceId, dateIso: string): string {
  return `${AUDIENCE_SEARCH_NAME[audience]} ${formatMonthYear(dateIso)}`;
}

/** `Rhapsody of Realities October 2026` / `Rhapsody of Realities TeeVo October 2026`. */
export function editionSeoName(edition: Pick<Edition, 'audience' | 'monthName' | 'year'>): string {
  return `${AUDIENCE_SEARCH_NAME[edition.audience]} ${edition.monthName} ${edition.year}`;
}

export function editionSeoTitle(edition: Pick<Edition, 'audience' | 'monthName' | 'year' | 'postCount'>): string {
  return `${editionSeoName(edition)} — All ${edition.postCount} Daily Devotionals`;
}

export function editionSeoDescription(edition: Pick<Edition, 'audience' | 'monthName' | 'year' | 'postCount'>): string {
  return clip(
    `Read ${editionSeoName(edition)} online: all ${edition.postCount} daily devotionals by Pastor Chris Oyakhilome, day by day — each with its opening scripture, ${
      edition.audience === 'early-readers' ? 'prayer or confession' : 'prayer or confession, further study and Bible reading plan'
    }. Free to read, listen to and share.`,
    230
  );
}

/**
 * Metadata for a page in one call: canonical URL, Open Graph and Twitter cards *with* an image.
 * (A page-level `openGraph` replaces the layout's wholesale in Next, so a page that sets a title
 * there without restating the image silently loses its share preview — this cannot.)
 */
export function pageMetadata({
  title,
  description,
  path,
  absolute = false,
  image = SITE.ogImage,
  type = 'website',
  index = true,
  keywords,
}: {
  title: string;
  description: string;
  path: string;
  /** The title already contains the brand: skip the layout's `| Rhapsody of Realities`. */
  absolute?: boolean;
  image?: string;
  type?: 'website' | 'article';
  index?: boolean;
  keywords?: string[];
}): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = absolute ? title : `${title} | ${SITE.name}`;
  const imageUrl = absoluteUrl(image);
  return {
    title: absolute ? { absolute: title } : title,
    description,
    ...(keywords?.length ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      type,
      title: fullTitle,
      description,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [imageUrl] },
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}

/* ------------------------------------------------------------------ structured data */

type JsonLd = Record<string, unknown>;

/**
 * Serialise JSON-LD for a `<script>` tag. `<` is escaped so a title containing `</script>` can
 * never close the tag early (the content is ours, but the rule costs nothing).
 */
export function jsonLdString(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** The publication itself — what every page on the site is *about*. */
export function periodicalJsonLd(): JsonLd {
  return {
    '@type': 'Periodical',
    name: SITE.series,
    alternateName: ['Rhapsody', 'ROR'],
    issn: SITE.issn,
    author: { '@type': 'Person', name: SITE.author },
    publisher: { '@type': 'Organization', name: SITE.publisher },
    url: SITE.officialUrl,
    sameAs: [SITE.officialUrl, SITE.wikipediaUrl],
    genre: 'Christian daily devotional',
  };
}

/** WebSite + search action, rendered once in the root layout. */
export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${absoluteUrl('/')}#website`,
    name: SITE.name,
    alternateName: [`${SITE.name} Daily Devotional`, 'Rhapsody of Realities Today'],
    url: absoluteUrl('/'),
    description: SITE.description,
    inLanguage: SITE.locale.replace('_', '-'),
    about: periodicalJsonLd(),
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/search')}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export interface Faq {
  question: string;
  /** Plain text; rendered as-is on the page and in the FAQPage answer. */
  answer: string;
}

export function faqJsonLd(faqs: Faq[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

/** A listing page (an edition, a Bible book, an audience hub) and the articles on it. */
export function collectionJsonLd({
  name,
  description,
  path,
  items,
}: {
  name: string;
  description: string;
  path: string;
  items: Array<{ name: string; path: string }>;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: absoluteUrl(path),
    inLanguage: SITE.locale.replace('_', '-'),
    isPartOf: { '@id': `${absoluteUrl('/')}#website` },
    about: periodicalJsonLd(),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.slice(0, 100).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    },
  };
}

/** Audience label as a reader would say it ("TeeVo (teens)"), for hub copy. */
export function audienceSpoken(audience: AudienceId): string {
  return audience === 'teens' ? 'TeeVo (teens)' : AUDIENCES[audience].shortLabel;
}
