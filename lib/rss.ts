/**
 * RSS 2.0 builder for `/feed.xml`.
 *
 * Each item carries the *whole* daily devotional — message, closing prayer/confession,
 * further study and both Bible reading plans — so a reader in a feed app gets the complete
 * article without opening the site.
 */

import { absoluteUrl, SITE } from './site';
import type { Devotional } from './types';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const cdata = (value: string): string => `<![CDATA[${value.replace(/]]>/g, ']]&gt;')}]]>`;

/** The article as HTML for feed readers: paragraphs plus the closing sections. */
export function devotionalToHtml(post: Devotional): string {
  const parts: string[] = [];

  if (post.scripture) {
    parts.push(
      `<blockquote><p>${escapeXml(post.scripture)}</p></blockquote>`
    );
  }
  for (const paragraph of post.message) parts.push(`<p>${escapeXml(paragraph)}</p>`);
  if (post.prayer) {
    parts.push(`<h3>${escapeXml(post.prayerLabel)}</h3><p>${escapeXml(post.prayer)}</p>`);
  }
  if (post.furtherStudy) {
    parts.push(`<h3>Further Study</h3><p>${escapeXml(post.furtherStudy)}</p>`);
  }
  if (post.oneYearPlan || post.twoYearPlan) {
    parts.push('<h3>Bible Reading Plans</h3><ul>');
    if (post.oneYearPlan) parts.push(`<li><strong>1-Year:</strong> ${escapeXml(post.oneYearPlan)}</li>`);
    if (post.twoYearPlan) parts.push(`<li><strong>2-Year:</strong> ${escapeXml(post.twoYearPlan)}</li>`);
    parts.push('</ul>');
  }
  parts.push(`<p><em>${escapeXml(SITE.attribution)}</em></p>`);
  return parts.join('\n');
}

export function buildFeed(posts: Devotional[], options: { limit?: number } = {}): string {
  const items = posts.slice(0, options.limit ?? 61);
  const lastBuildDate = items.length ? new Date(`${items[0].date}T05:00:00Z`).toUTCString() : new Date().toUTCString();

  const itemXml = items
    .map((post) => {
      const url = absoluteUrl(`/devotionals/${post.slug}`);
      const pubDate = new Date(`${post.date}T05:00:00Z`).toUTCString();
      return [
        '    <item>',
        `      <title>${cdata(`${post.weekday} ${post.dayOfMonth} — ${post.title}`)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <author>${escapeXml(`${SITE.author} (${SITE.series})`)}</author>`,
        `      <description>${cdata(post.excerpt)}</description>`,
        `      <content:encoded>${cdata(devotionalToHtml(post))}</content:encoded>`,
        post.scriptureReference ? `      <category>${cdata(post.scriptureReference)}</category>` : '',
        ...post.tags.map((tag) => `      <category>${cdata(tag)}</category>`),
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${cdata(`${SITE.name} — ${SITE.series}`)}</title>
    <link>${escapeXml(absoluteUrl('/'))}</link>
    <atom:link href="${escapeXml(absoluteUrl('/feed.xml'))}" rel="self" type="application/rss+xml" />
    <description>${cdata(SITE.description)}</description>
    <language>${SITE.locale.replace('_', '-')}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>${cdata('Next.js + content/devotionals')}</generator>
    <copyright>${cdata(`© ${SITE.publisher}. ${SITE.attribution}`)}</copyright>
${itemXml}
  </channel>
</rss>
`;
}
