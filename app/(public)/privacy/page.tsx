import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { pageMetadata } from '@/lib/seo';
import { SITE, displayHost } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description: `How ${SITE.name} (${displayHost(SITE.url)}) handles your data: what stays on your device, the cookies used, advertising by Google AdSense, and your choices.`,
  path: '/privacy',
});

const UPDATED = '15 October 2026';

/**
 * Written against what the code does (see `lib/reader-data.ts`, `lib/audience-pref.ts`,
 * `components/common/AdScript.tsx`, the Worker), including the disclosures Google AdSense
 * requires of publishers: third-party vendors' use of cookies, Google's advertising cookies,
 * and how to opt out of personalised advertising.
 */
export default function PrivacyPage() {
  const host = displayHost(SITE.url);
  return (
    <LegalPage
      title="Privacy policy"
      path="/privacy"
      updated={UPDATED}
      intro={
        <p>
          {SITE.name} ({host}) is an independent reader site for the Rhapsody of Realities daily devotional. You can read,
          listen, save and take notes here without an account, and most of what you do never leaves your device. This page
          explains exactly what is stored, by whom, and how to control it.
        </p>
      }
    >
      <section>
        <h2>1. What stays on your device</h2>
        <p>
          These features keep their data in your browser’s local storage, on your phone or computer only. We never receive it,
          and it is not linked to you:
        </p>
        <ul>
          <li>Saved devotionals (bookmarks), your notes, and your reading history, progress and streak;</li>
          <li>Bible-reading-plan ticks, reading settings (text size, font, theme, Bible translation) and recent searches;</li>
          <li>Your daily-reminder time and which months you saved for offline reading (pages saved for offline use are kept in your browser’s cache).</li>
        </ul>
        <p>
          You can export or permanently delete all of it from <Link href="/me">My Rhapsody</Link>, or by clearing this site’s data in your
          browser settings. Calendar reminders you add live in your own calendar app.
        </p>
      </section>

      <section>
        <h2>2. Cookies</h2>
        <ul>
          <li>
            <strong>Edition preference</strong> (<code>rhapsody_audience</code>): remembers whether you chose Adults, TeeVo or Early Readers so the
            home page and “Today” open on your edition. One value, no identifier, kept for a year.
          </li>
          <li>
            <strong>Sign-in</strong> (only if you create an account): keeps you signed in.
          </li>
          <li>
            <strong>Advertising cookies</strong> set by Google and its partners, described in section 3.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Advertising (Google AdSense)</h2>
        <p>
          The site is free because it shows ads served by Google AdSense. Third-party vendors, including Google, use cookies to
          serve ads based on your prior visits to this website or other websites. Google’s use of advertising cookies enables it
          and its partners to serve ads to you based on your visit to this site and/or other sites on the Internet.
        </p>
        <ul>
          <li>
            You can opt out of personalised advertising in Google’s{' '}
            <a href="https://adssettings.google.com" rel="noopener noreferrer" target="_blank">
              Ads Settings
            </a>
            .
          </li>
          <li>
            You can opt out of other vendors’ use of cookies for personalised advertising at{' '}
            <a href="https://www.aboutads.info/choices/" rel="noopener noreferrer" target="_blank">
              aboutads.info
            </a>{' '}
            (or{' '}
            <a href="https://www.youronlinechoices.eu/" rel="noopener noreferrer" target="_blank">
              youronlinechoices.eu
            </a>{' '}
            in Europe).
          </li>
          <li>
            Learn how Google uses information from sites that use its services:{' '}
            <a href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer" target="_blank">
              policies.google.com/technologies/partner-sites
            </a>
            .
          </li>
        </ul>
        <p>
          Visitors in the European Economic Area, the United Kingdom and Switzerland are asked for consent through Google’s
          consent message before personalised ads or advertising cookies are used. If you decline, you may still see
          non-personalised ads.
        </p>
      </section>

      <section>
        <h2>4. Email, accounts and messages</h2>
        <ul>
          <li>
            <strong>Daily email:</strong> if you subscribe, we store your email address to send you the daily devotional. Every email has a one-click
            unsubscribe link; unsubscribing stops all emails.
          </li>
          <li>
            <strong>Accounts (optional):</strong> if you register, we store your name, email address and a securely hashed password.
          </li>
          <li>
            <strong>Contact:</strong> if you write to us, we use your message only to reply.
          </li>
        </ul>
        <p>We do not sell personal information, and we do not share it except with the service providers below, as needed to run the site.</p>
      </section>

      <section>
        <h2>5. Service providers and other sites</h2>
        <ul>
          <li>
            <strong>Hosting and delivery</strong> (Vercel, Cloudflare) process requests and keep short-lived technical logs (such as IP address and
            browser type) for security and reliability. Cloudflare Web Analytics, where enabled, counts visits without cookies.
          </li>
          <li>
            <strong>Google Fonts</strong> supplies the site’s typefaces, so your browser requests them from Google.
          </li>
          <li>
            <strong>Listen</strong> uses your device’s built-in voices by default; nothing is sent anywhere. If a studio voice is enabled, the
            text of the devotional (never personal data) is sent to the voice provider to be read.
          </li>
          <li>
            <strong>Links out</strong> — Bible references open BibleGateway, and share buttons open WhatsApp, Telegram, Facebook, X or your email
            app — only when you tap them, under those services’ own privacy policies.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Children</h2>
        <p>
          The site publishes devotionals for children, but it does not knowingly collect personal information from children under
          13: reading, saving and notes need no account and stay on the device. Email sign-up and accounts are intended for adults
          and parents. If you believe a child has given us personal information, contact us and we will delete it.
        </p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>
          Depending on where you live (for example under the Nigeria Data Protection Act, the GDPR or the UK GDPR), you may have the
          right to access, correct, delete or object to the processing of your personal information, and to complain to a data
          protection authority. Data on your device is already under your control (section 1); for anything we hold, such as a
          newsletter address, <Link href="/contact">contact us</Link>.
        </p>
      </section>

      <section>
        <h2>8. Retention and security</h2>
        <p>
          Newsletter addresses are kept until you unsubscribe; account data until you ask us to delete the account. Connections to
          the site are encrypted (HTTPS), and access to stored data is restricted.
        </p>
      </section>

      <section>
        <h2>9. Changes and contact</h2>
        <p>
          We will update this page if our practices change and revise the date above. Questions: see the{' '}
          <Link href="/contact">contact page</Link>. {SITE.disclaimer}
        </p>
      </section>
    </LegalPage>
  );
}
