import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { PageHeader } from '@/components/common/StateBlocks';
import { AdSlot } from '@/components/common/AdSlot';
import { ALL_FAQS, FAQ_GROUPS } from '@/lib/faq';
import { breadcrumbJsonLd, faqJsonLd, jsonLdString, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Rhapsody of Realities FAQ — Today’s Devotional, TeeVo, Kids, PDF, Audio & More',
  description:
    'Answers about Rhapsody of Realities: how to read today’s devotional, TeeVo for teens, editions for kids, the Bible reading plan, audio, PDF, sharing on WhatsApp, reminders and reading offline.',
  path: '/faq',
  absolute: true,
});

/** Paths in answers ("/teevo") become links; everything else stays text. */
function Answer({ text }: { text: string }) {
  const parts = text.split(/(\/[a-z][a-z-]*(?:\?[a-z=-]+)?)(?=[\s,.;:)]|$)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^\/[a-z]/.test(part) ? (
          <Link key={index} href={part} className="text-primary hover:underline">
            {part}
          </Link>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

export default function FaqPage() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'FAQ', path: '/faq' },
  ];
  return (
    <div className="container py-12 md:py-16 max-w-4xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString([breadcrumbJsonLd(crumbs), faqJsonLd(ALL_FAQS)]) }} />
      <Breadcrumbs crumbs={crumbs} className="mb-8" />
      <PageHeader
        eyebrow="Questions readers ask"
        title="Rhapsody of Realities FAQ"
        subtitle="About the devotional, its editions for teens and children, and how to read, listen, share and keep track here."
      />
      {FAQ_GROUPS.map((group) => (
        <section key={group.title} aria-label={group.title} className="mt-12">
          <h2 className="font-serif text-2xl font-semibold border-b border-border/60 pb-3">{group.title}</h2>
          <div className="mt-4 divide-y divide-border/60">
            {group.items.map((faq) => (
              <details key={faq.question} className="group py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-lg hover:text-primary">
                  <h3 className="font-sans text-lg font-medium">{faq.question}</h3>
                  <span className="mt-1 text-primary transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  <Answer text={faq.answer} />
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="mt-12 text-sm text-muted-foreground">
        Still have a question? <Link href="/contact" className="text-primary hover:underline">Get in touch</Link>.
      </p>
      <AdSlot position="page" className="mt-12" />
    </div>
  );
}
