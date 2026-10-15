import { describe, expect, it } from 'vitest';
import { buildFeed, devotionalToHtml } from '@/lib/rss';
import { getAllDevotionals, getDevotionalBySlug, getAllSlugs } from '@/lib/content';
import { absoluteUrl, SITE } from '@/lib/site';
import type { Devotional } from '@/lib/types';

/**
 * `/feed.xml` is generated from the same static corpus as the site, so the tests assert the two
 * things a feed reader depends on: the *complete* devotional per item (not a teaser) and
 * well-formed XML even when the source text contains markup-hostile characters.
 */

const post = getDevotionalBySlug(getAllSlugs()[0]) as Devotional;

/** Mirrors the feed builder's escaping so assertions compare like with like. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

describe('devotionalToHtml', () => {
  it('carries every section of the day', () => {
    const html = devotionalToHtml(post);
    expect(html).toContain('<blockquote>');
    expect(html).toContain(post.scriptureReference);
    for (const paragraph of post.message) expect(html, paragraph.slice(0, 40)).toContain(`<p>${esc(paragraph)}</p>`);
    expect(html).toContain(`<h3>${post.prayerLabel}</h3>`);
    expect(html).toContain(`<p>${esc(post.prayer)}</p>`);
    expect(html).toContain('<h3>Further Study</h3>');
    expect(html).toContain(esc(post.furtherStudy));
    expect(html).toContain('<h3>Bible Reading Plans</h3>');
    expect(html).toContain(`<strong>1-Year:</strong> ${esc(post.oneYearPlan)}`);
    expect(html).toContain(`<strong>2-Year:</strong> ${esc(post.twoYearPlan)}`);
  });

  it('keeps the publisher attribution on every item', () => {
    expect(devotionalToHtml(post)).toContain('LoveWorld Publishing');
  });

  it('escapes markup in the source text', () => {
    const hostile = { ...post, message: ['He said <b>grace</b> & "mercy"'], scripture: 'A & B < C' };
    const html = devotionalToHtml(hostile);
    expect(html).toContain('&lt;b&gt;grace&lt;/b&gt; &amp; &quot;mercy&quot;');
    expect(html).toContain('A &amp; B &lt; C');
    expect(html).not.toContain('<b>grace</b>');
  });
});

describe('buildFeed', () => {
  const feed = buildFeed(getAllDevotionals(), { limit: 5 });

  it('is RSS 2.0 with the content module namespace', () => {
    expect(feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(feed).toContain('<rss version="2.0"');
    expect(feed).toContain('xmlns:content="http://purl.org/rss/1.0/modules/content/"');
    expect(feed).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
  });

  it('describes the channel and points at itself', () => {
    // The site is named after the series, so the channel title adds the tagline rather than
    // repeating the name ("Rhapsody of Realities — Rhapsody of Realities").
    expect(feed).toContain(`<title><![CDATA[${SITE.name} — ${SITE.tagline}]]></title>`);
    expect(feed).toContain(`<link>${absoluteUrl('/')}</link>`);
    expect(feed).toContain(`<atom:link href="${absoluteUrl('/feed.xml')}" rel="self"`);
    expect(feed).toContain('<language>en-GB</language>');
    expect(feed).toContain('© LoveWorld Publishing');
  });

  it('emits one item per post, newest first, respecting the limit', () => {
    expect(feed.match(/<item>/g)).toHaveLength(5);
    const links = [...feed.matchAll(/<link>(https?:[^<]+)<\/link>/g)].map((m) => m[1]).filter((l) => l.includes('/devotionals/'));
    expect(links).toHaveLength(5);
    expect(links[0]).toBe(absoluteUrl(`/devotionals/${getAllDevotionals()[0].slug}`));
  });

  it('gives each item a permalink guid, pubDate and the full article', () => {
    const item = feed.slice(feed.indexOf('<item>'), feed.indexOf('</item>'));
    expect(item).toContain('<guid isPermaLink="true">');
    expect(item).toMatch(/<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} [\d:]{8} GMT<\/pubDate>/);
    expect(item).toContain('<content:encoded><![CDATA[');
    expect(item).toContain(`<author>${SITE.author} (${SITE.series})</author>`);
    expect(item).toContain(`<category><![CDATA[${post.scriptureReference}]]></category>`);
  });

  it('titles items with the day so feed readers can scan a month', () => {
    expect(feed).toContain(`<![CDATA[${post.weekday} ${post.dayOfMonth} — ${post.title}]]>`);
  });

  it('keeps the XML well formed when a title contains a CDATA terminator', () => {
    const hostile = buildFeed([{ ...post, title: 'Broken ]]> headline' }], { limit: 1 });
    expect(hostile).not.toContain(']]> headline');
    expect(hostile.match(/<!\[CDATA\[/g)?.length).toBe(hostile.match(/\]\]>/g)?.length);
  });

  it('still produces a valid channel with no posts', () => {
    const empty = buildFeed([]);
    expect(empty).toContain('<channel>');
    expect(empty).not.toContain('<item>');
    expect(empty.trim().endsWith('</rss>')).toBe(true);
  });
});
