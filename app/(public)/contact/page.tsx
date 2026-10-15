import type { Metadata } from 'next';
import { ExternalLink, Mail } from 'lucide-react';
import { ContactForm } from '@/components/legal/ContactForm';
import { LegalPage } from '@/components/legal/LegalPage';
import { pageMetadata } from '@/lib/seo';
import { SITE, displayHost } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description: `Contact ${SITE.name} (${displayHost(SITE.url)}): report a correction, suggest a feature, ask a question or make a copyright request.`,
  path: '/contact',
});

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      path="/contact"
      updated="15 October 2026"
      intro={<p>Spotted a typo in a devotional, have an idea, or need something removed? We read every message.</p>}
    >
      <section>
        <h2>Write to this site</h2>
        {SITE.contactEmail ? (
          <p className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" aria-hidden="true" />
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
          </p>
        ) : (
          <p>
            Corrections and bug reports go to the site’s public issue tracker on GitHub; the form below prepares the report for
            you.
          </p>
        )}
        <div className="mt-6">
          <ContactForm email={SITE.contactEmail} repoUrl={SITE.repoUrl} />
        </div>
      </section>

      <section>
        <h2>The official Rhapsody of Realities</h2>
        <p>
          This is an independent reader site. For subscriptions, printed copies, translations, partnership and anything about the
          ministry itself, contact the publisher directly:
        </p>
        <p>
          <a href={SITE.officialUrl} rel="noopener" className="inline-flex items-center gap-1.5">
            {displayHost(SITE.officialUrl)} <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </p>
      </section>

      <section>
        <h2>Copyright and content requests</h2>
        <p>
          The devotionals are © {SITE.publisher}. If you represent the rights holder and want any material corrected, attributed
          differently or removed, choose “Copyright or content request” above — such requests are handled first.
        </p>
      </section>
    </LegalPage>
  );
}
