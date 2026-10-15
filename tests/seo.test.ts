import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_SEARCH_NAME,
  breadcrumbJsonLd,
  clip,
  devotionalKeywords,
  devotionalSeoDescription,
  devotionalSeoTitle,
  editionSeoTitle,
  faqJsonLd,
  jsonLdString,
  monthEditionName,
  pageMetadata,
  websiteJsonLd,
} from '@/lib/seo';
import { SITE } from '@/lib/site';

const day = {
  title: 'Righteousness Apart From the Law',
  date: '2026-10-11',
  weekday: 'Sunday',
  audience: 'adults' as const,
  scriptureReference: 'Romans 3:21',
  prayerLabel: 'Prayer' as const,
  furtherStudy: 'Romans 5:17; 2 Corinthians 5:21',
  oneYearPlan: '1 Thessalonians 5:1-28',
  twoYearPlan: 'Luke 1:57-80',
};

describe('devotional search copy', () => {
  it('leads the title with the series and the date as readers type it', () => {
    expect(devotionalSeoTitle(day)).toBe('Rhapsody of Realities 11 October 2026: Righteousness Apart From the Law');
    expect(devotionalSeoTitle({ ...day, audience: 'teens' })).toMatch(/^Rhapsody of Realities TeeVo 11 October 2026: /);
    expect(devotionalSeoTitle({ ...day, audience: 'early-readers' })).toMatch(/^Rhapsody of Realities for Early Readers 11 October 2026: /);
  });

  it('describes the day, the author, the scripture and only the parts the day prints', () => {
    const description = devotionalSeoDescription(day);
    expect(description).toContain('Rhapsody of Realities for Sunday, 11th October 2026 by Pastor Chris Oyakhilome');
    expect(description).toContain('(Romans 3:21)');
    expect(description).toContain('prayer, further study and Bible reading plan');
    expect(description.length).toBeLessThanOrEqual(230);

    const earlyReaders = devotionalSeoDescription({ ...day, audience: 'early-readers', prayerLabel: 'Confession', furtherStudy: '', oneYearPlan: '', twoYearPlan: '' });
    expect(earlyReaders).toContain('Read the full message, confession — or listen to it.');
    expect(earlyReaders).not.toContain('reading plan');
  });

  it('lists every spelling of the date and the audience terms, without duplicates', () => {
    const keywords = devotionalKeywords(day);
    expect(keywords).toEqual(
      expect.arrayContaining([
        'Rhapsody of Realities 11 October 2026',
        'Rhapsody of Realities 11th October 2026',
        'Rhapsody of Realities October 11, 2026',
        'Rhapsody of Realities October 2026',
        'Rhapsody of Realities today',
      ])
    );
    expect(new Set(keywords.map((k) => k.toLowerCase())).size).toBe(keywords.length);
    expect(devotionalKeywords({ ...day, audience: 'teens' })).toEqual(expect.arrayContaining(['TeeVo today', 'Rhapsody TeeVo']));
  });

  it('names editions the way they are searched', () => {
    expect(editionSeoTitle({ audience: 'adults', monthName: 'October', year: 2026, postCount: 31 })).toBe(
      'Rhapsody of Realities October 2026 — All 31 Daily Devotionals'
    );
    expect(monthEditionName('teens', '2026-10-11')).toBe('Rhapsody of Realities TeeVo October 2026');
  });

  it('clips on a word boundary', () => {
    expect(clip('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen', 70)).toMatch(/\w…$/);
    expect(clip('short')).toBe('short');
  });
});

describe('structured data', () => {
  it('escapes "<" so a title can never close the script tag', () => {
    expect(jsonLdString({ headline: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });

  it('describes the site and the publication it is about', () => {
    const site = websiteJsonLd();
    expect(site['@type']).toBe('WebSite');
    expect(site.name).toBe('Rhapsody of Realities');
    expect(JSON.stringify(site)).toContain('"issn":"1596-6984"');
    expect(JSON.stringify(site)).toContain('search?q={search_term_string}');
  });

  it('builds breadcrumbs and FAQ pages', () => {
    const crumbs = breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'TeeVo', path: '/teevo' },
    ]);
    expect((crumbs.itemListElement as Array<{ position: number; item: string }>)[1]).toMatchObject({ position: 2, item: `${SITE.url}/teevo` });
    const faq = faqJsonLd([{ question: 'Q?', answer: 'A.' }]);
    expect(faq['@type']).toBe('FAQPage');
  });

  it('always gives a page an Open Graph image, even with its own title', () => {
    const meta = pageMetadata({ title: 'Privacy Policy', description: 'd', path: '/privacy' });
    expect(meta.openGraph?.images).toBeTruthy();
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(meta.alternates?.canonical).toBe(`${SITE.url}/privacy`);
    expect(pageMetadata({ title: 'X', description: 'd', path: '/me', index: false }).robots).toMatchObject({ index: false });
    expect(pageMetadata({ title: 'Rhapsody of Realities FAQ', description: 'd', path: '/faq', absolute: true }).title).toEqual({ absolute: 'Rhapsody of Realities FAQ' });
  });

  it('has a search name for every audience', () => {
    expect(Object.keys(AUDIENCE_SEARCH_NAME).sort()).toEqual(['adults', 'early-readers', 'teens']);
  });
});
