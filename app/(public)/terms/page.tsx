import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { pageMetadata } from '@/lib/seo';
import { SITE, displayHost } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Terms of Use',
  description: `The terms for using ${SITE.name} (${displayHost(SITE.url)}): the content and who owns it, sharing, accounts, advertising and links.`,
  path: '/terms',
});

export default function TermsPage() {
  const host = displayHost(SITE.url);
  return (
    <LegalPage
      title="Terms of use"
      path="/terms"
      updated="15 October 2026"
      intro={
        <p>
          By using {host} you agree to these terms. They are short because the site is simple: it publishes the Rhapsody of
          Realities daily devotional to read, listen to and share, free of charge.
        </p>
      }
    >
      <section>
        <h2>1. Who runs this site</h2>
        <p>{SITE.disclaimer}</p>
      </section>

      <section>
        <h2>2. The content and its owners</h2>
        <p>
          The devotionals, books and magazines published here are the work of Pastor Chris Oyakhilome and{' '}
          {SITE.publisher}, who own the copyright. They are reproduced with attribution for personal, devotional reading. The
          site’s own design, code, audio player, tools and written pages belong to the site.
        </p>
        <p>
          You may read, listen to and share links to any page, quote short passages with attribution, and share the full text of a
          day for personal, non-commercial purposes (for example with family or a church group), as the share tools allow. Do not
          republish the content commercially or present it as your own. Rights holders who want material changed or removed can
          write to us through the <Link href="/contact">contact page</Link>, and we will act promptly.
        </p>
      </section>

      <section>
        <h2>3. Your data and notes</h2>
        <p>
          Notes, saved devotionals, reading history and settings are stored on your device, under your control (see the{' '}
          <Link href="/privacy">privacy policy</Link>). Clearing your browser data deletes them unless you have exported them first.
        </p>
      </section>

      <section>
        <h2>4. Accounts and email</h2>
        <p>
          If you create an account or subscribe to the daily email, keep your password safe and give a working address. You can
          unsubscribe at any time from any email, and we may close accounts that are used to abuse the site.
        </p>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <ul>
          <li>Do not attempt to disrupt, overload or gain unauthorised access to the site or its services.</li>
          <li>Do not use automated tools to generate artificial page views or ad impressions, or click ads you do not intend to visit.</li>
          <li>Do not scrape the site in bulk; the RSS feed and the JSON endpoint at /api/today are provided for automated reading.</li>
        </ul>
      </section>

      <section>
        <h2>6. Advertising and links</h2>
        <p>
          The site shows ads served by Google; ads are chosen by Google, not endorsed by us. Links to other websites (BibleGateway,
          the publisher, share services) are provided for convenience and are governed by those sites’ own terms.
        </p>
      </section>

      <section>
        <h2>7. No warranty</h2>
        <p>
          Each devotional is transcribed carefully from its monthly edition, but errors can occur; the printed edition is
          authoritative. The site is provided “as is”, and to the extent the law allows we are not liable for any loss arising from
          its use or from it being unavailable.
        </p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>We may update these terms; the date above shows the latest version. Continuing to use the site means you accept the current terms.</p>
      </section>
    </LegalPage>
  );
}
