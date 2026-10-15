import type { Metadata } from 'next';
import { AudienceHub, type HubCopy } from '@/components/hubs/AudienceHub';
import { getFeaturedDevotional, siteTimeZone, todayIso } from '@/lib/content';
import { formatDayMonthYear } from '@/lib/format';
import { pageMetadata } from '@/lib/seo';

/** Rendered per request so "today" is always today (see the home page for why). */
export const dynamic = 'force-dynamic';

const COPY: HubCopy = {
  crumb: 'Early Readers',
  intro:
    'Rhapsody of Realities for Early Readers is the daily devotional for children aged 6 to 12 — one short page, large type, and a prayer or confession a child can read out loud.',
  about: [
    'Rhapsody of Realities for Early Readers is the children’s edition of the daily devotional by Pastor Chris Oyakhilome, published every month by LoveWorld Publishing for readers aged about 6 to 12. Each day is a short, simple lesson from a Bible verse that a child can read alone or with a parent.',
    'Every day here can be read aloud by the Listen button — useful for younger children and for bedtime — and shared with other parents. For the youngest children (about 1 to 6), see the Rhapsody of Realities for Kids magazine.',
  ],
  faqs: [
    {
      question: 'What age is Rhapsody of Realities for Early Readers for?',
      answer:
        'Children roughly 6 to 12 years old who are reading on their own or learning to. Younger children are served by the Kids magazine, and teenagers by TeeVo.',
    },
    {
      question: 'Can my child listen instead of reading?',
      answer: 'Yes — every devotional has a Listen button that reads the whole day aloud in the browser, with adjustable speed.',
    },
    {
      question: 'Is it free?',
      answer:
        'Reading here is free and needs no account. The printed and e-book editions are sold by LoveWorld Publishing if you would like a copy for your child.',
    },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const now = new Date();
  const today = todayIso(now, siteTimeZone());
  const featured = getFeaturedDevotional(now, 'early-readers', siteTimeZone());
  const dated = featured?.date === today;
  return pageMetadata({
    title: dated
      ? `Rhapsody of Realities for Early Readers Today, ${formatDayMonthYear(today)}: ${featured!.title}`
      : 'Rhapsody of Realities for Early Readers Today — Kids Devotional (6–12)',
    description: `Read Rhapsody of Realities for Early Readers today${dated ? ` (${formatDayMonthYear(today)})` : ''} — the daily devotional for children aged 6–12 by Pastor Chris Oyakhilome. Short, large-type, with a prayer to read aloud. Free, with audio.`,
    path: '/early-readers',
    absolute: true,
    keywords: ['Rhapsody of Realities for Early Readers', 'Rhapsody of Realities for kids today', 'children’s devotional', 'kids daily devotional'],
  });
}

export default function EarlyReadersPage() {
  return <AudienceHub audience="early-readers" copy={COPY} />;
}
