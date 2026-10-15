import type { Metadata } from 'next';
import { AudienceHub, type HubCopy } from '@/components/hubs/AudienceHub';
import { getFeaturedDevotional, siteTimeZone, todayIso } from '@/lib/content';
import { formatDayMonthYear } from '@/lib/format';
import { pageMetadata } from '@/lib/seo';

/** Rendered per request so "today" is always today (see the home page for why). */
export const dynamic = 'force-dynamic';

const COPY: HubCopy = {
  crumb: 'TeeVo',
  intro:
    'TeeVo is Rhapsody of Realities for teenagers: the daily devotional by Pastor Chris Oyakhilome in a teen’s language — a message from the Bible, a prayer, and something to act on today.',
  about: [
    'Rhapsody of Realities TeeVo is the teen edition of the Rhapsody of Realities daily devotional, published every month by LoveWorld Publishing. Each day opens with a Bible passage, explains what it means for a teenager’s life — school, friends, faith, purpose — and closes with a prayer.',
    'Every day ends with an “Act” — something to do that day — and many add a “Speak” section with words to say out loud, alongside the day’s Bible reading. Every TeeVo devotional here can be read, listened to and shared, and the whole archive is searchable.',
  ],
  faqs: [
    {
      question: 'Where can I read TeeVo today?',
      answer:
        'Right here — this page always shows today’s TeeVo devotional, and /today?audience=teens opens it directly. Choose “TeeVo” on the home page and the site remembers it.',
    },
    {
      question: 'Is TeeVo the same as the adult Rhapsody of Realities?',
      answer:
        'It follows the same monthly edition and often the same theme, but it is written for teenagers, with its own titles, examples and the Speak and Act sections.',
    },
    {
      question: 'Can I share TeeVo on WhatsApp?',
      answer:
        'Yes. Open the day, tap Share, and send it to WhatsApp or Telegram, copy the whole devotional as a formatted message, or make a verse image for your status.',
    },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const now = new Date();
  const today = todayIso(now, siteTimeZone());
  const featured = getFeaturedDevotional(now, 'teens', siteTimeZone());
  const dated = featured?.date === today;
  return pageMetadata({
    title: dated
      ? `Rhapsody of Realities TeeVo Today, ${formatDayMonthYear(today)}: ${featured!.title}`
      : 'Rhapsody of Realities TeeVo Today — Teens Daily Devotional',
    description: `Read Rhapsody of Realities TeeVo today${dated ? ` (${formatDayMonthYear(today)})` : ''} — the daily devotional for teens by Pastor Chris Oyakhilome: the message, prayer and today’s Act. Plus every TeeVo edition, free to read, listen to and share.`,
    path: '/teevo',
    absolute: true,
    keywords: ['Rhapsody of Realities TeeVo', 'TeeVo today', 'Rhapsody TeeVo', 'Rhapsody of Realities for teens', 'teens daily devotional'],
  });
}

export default function TeevoPage() {
  return <AudienceHub audience="teens" copy={COPY} />;
}
