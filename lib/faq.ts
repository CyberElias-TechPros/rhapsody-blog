/**
 * Questions readers ask about Rhapsody of Realities — and how to do things on this site. Plain
 * text answers, rendered on /faq and as FAQPage structured data.
 *
 * Facts about the publication are kept to what the publisher and Wikipedia state (first edition
 * January 2001; translations reported in 7,000+ languages as of 2022; editions for teens, early
 * readers and kids). Anything about this site describes what the code actually does.
 */

import type { Faq } from '@/lib/seo';
import { SITE, displayHost } from '@/lib/site';

export interface FaqGroup {
  title: string;
  items: Faq[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: 'About Rhapsody of Realities',
    items: [
      {
        question: 'What is Rhapsody of Realities?',
        answer:
          'Rhapsody of Realities is a daily devotional written by Pastor Chris Oyakhilome and published monthly by LoveWorld Publishing since January 2001. Each day has a topic, an opening scripture, the message, a closing prayer or confession, further study verses and portions of the 1-year and 2-year Bible reading plans.',
      },
      {
        question: 'Who writes Rhapsody of Realities?',
        answer:
          'Pastor Chris Oyakhilome, president of LoveWorld Inc. (Christ Embassy), writes every edition. It is published by LoveWorld Publishing.',
      },
      {
        question: 'What is Rhapsody of Realities TeeVo?',
        answer:
          'TeeVo is the edition for teenagers: the daily devotional in a teen’s language, with a prayer, an “Act” for the day and often a “Speak” confession. Read today’s TeeVo at /teevo.',
      },
      {
        question: 'Is there a Rhapsody of Realities for kids?',
        answer:
          'Yes. Rhapsody of Realities for Early Readers is a short daily devotional for children aged about 6 to 12 (at /early-readers), and Rhapsody of Realities for Kids is an illustrated monthly magazine for younger children (at /kids).',
      },
      {
        question: 'In how many languages is Rhapsody of Realities available?',
        answer:
          'The publisher reports translations into more than 7,000 languages (as of 2022), with the official translations on rhapsodyofrealities.org. This site publishes the English editions.',
      },
    ],
  },
  {
    title: 'Reading here',
    items: [
      {
        question: 'How do I read Rhapsody of Realities today?',
        answer:
          'Open the home page or /today — it always goes to today’s devotional. Choose Adults, TeeVo or Early Readers on the home page and the site remembers which edition to open for you.',
      },
      {
        question: 'When does today’s devotional change?',
        answer:
          'At midnight West Africa Time (Lagos). If you leave the page open overnight it turns over to the new day by itself.',
      },
      {
        question: 'Can I read previous days, or read ahead?',
        answer:
          'Yes. Use the calendar (/calendar) to open any date, browse whole months on the editions page, find devotionals by Bible book (/bible) or search the full archive. Days later in the current month are readable too, just as they are in the printed booklet.',
      },
      {
        question: 'Can I listen to Rhapsody of Realities?',
        answer:
          'Yes. Every devotional has a Listen button that reads the whole day aloud — scripture, message, prayer and reading plan — with adjustable speed. It keeps playing while you browse other pages.',
      },
      {
        question: 'How do I follow the Bible reading plan?',
        answer:
          'Each day prints a 1-year and a 2-year portion. Tick them off under any devotional or on /reading-plans; your progress is kept on your device and shown on My Rhapsody (/me).',
      },
      {
        question: 'Can I download the Rhapsody of Realities PDF?',
        answer:
          'This site publishes every day to read online free, and you can save a whole month for offline reading (“Save for offline” on any edition page). The official PDF, e-book and printed editions are sold by LoveWorld Publishing through rhapsodyofrealities.org.',
      },
    ],
  },
  {
    title: 'Sharing, reminders and offline',
    items: [
      {
        question: 'How do I share today’s Rhapsody on WhatsApp?',
        answer:
          'Tap Share on any devotional and choose WhatsApp — or “Copy full devotional” to paste the whole day, already formatted with bold headings, into a WhatsApp group. “Create a verse image” makes a picture of the scripture or confession for your status.',
      },
      {
        question: 'Can I get a daily reminder?',
        answer:
          'Yes. “Daily reminder” adds a repeating event to your phone’s calendar (Apple, Google, Outlook or Samsung) that opens today’s devotional at the time you choose. You can also get it by email or RSS.',
      },
      {
        question: 'Can I read without internet, or install it as an app?',
        answer:
          'Yes. Install the site from your browser (“Install the app”, or Share → Add to Home Screen on iPhone). Every devotional you open is kept for offline reading, and “Save for offline” stores a whole month at once.',
      },
    ],
  },
  {
    title: 'This website',
    items: [
      {
        question: 'Is this the official Rhapsody of Realities website?',
        answer: `No. ${SITE.name} at ${displayHost(SITE.url)} is an independent reader site. It is not run by LoveWorld Publishing, Christ Embassy or the Rhapsody of Realities ministry. The official site, apps and translations are at rhapsodyofrealities.org.`,
      },
      {
        question: 'Do I need an account? What happens to my data?',
        answer:
          'No account is needed. Your saved devotionals, notes, reading history, streak and settings are stored only in your browser on your device; we never receive them. You can export or delete them on My Rhapsody (/me). See the privacy policy for details, including advertising cookies.',
      },
      {
        question: 'I found a mistake in a devotional. How do I report it?',
        answer:
          'Please use the contact page (/contact). Each devotional is transcribed from its monthly edition, and corrections are welcome.',
      },
    ],
  },
];

export const ALL_FAQS: Faq[] = FAQ_GROUPS.flatMap((group) => group.items);
