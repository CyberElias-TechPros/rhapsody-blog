import Link from 'next/link';
import { BookOpen, Rss } from 'lucide-react';
import { AccountLinks } from '@/components/layout/AccountLinks';
import { NewsletterForm } from '@/components/common/NewsletterForm';
import { InstallAppButton } from '@/components/pwa/InstallAppButton';
import { getContentStats, getEditions } from '@/lib/content';
import { SITE, displayHost } from '@/lib/site';

const READ_LINKS = [
  { href: '/today', label: 'Rhapsody of Realities today' },
  { href: '/teevo', label: 'TeeVo — for teens' },
  { href: '/early-readers', label: 'For Early Readers (6–12)' },
  { href: '/kids', label: 'For Kids' },
  { href: '/reading-plans', label: 'Bible reading plan' },
  { href: '/calendar', label: 'Calendar — any date' },
  { href: '/bible', label: 'Devotionals by Bible book' },
  { href: '/devotionals', label: 'All devotionals' },
  { href: '/resources', label: 'Books and resources' },
];

const YOURS_LINKS = [
  { href: '/me', label: 'My Rhapsody — streak & notes' },
  { href: '/library', label: 'Saved devotionals' },
  { href: '/me#reminders', label: 'Daily reminder' },
  { href: '/search', label: 'Search' },
];

const HELP_LINKS = [
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About this site' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/terms', label: 'Terms of use' },
];

const linkClass =
  'hover:text-primary transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

/**
 * Server component: the edition list and the corpus stats are read straight from
 * `content/devotionals` at render time, so the footer never needs a client fetch. Its links are
 * also the site's main internal-linking hub — every landing page is one click from every page.
 */
export function Footer() {
  const editions = getEditions().slice(0, 6);
  const stats = getContentStats();

  return (
    <footer data-site-footer="" className="border-t border-border/60 mt-24 bg-secondary/30">
      <div className="container py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4 max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <span className="grid place-items-center w-9 h-9 rounded-xl gradient-hero">
              <BookOpen className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
            </span>
            <span className="font-serif text-xl font-semibold">{SITE.name}</span>
          </Link>
          <p className="mt-4 text-muted-foreground leading-relaxed text-sm">{SITE.description}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            {stats.posts.toLocaleString()} daily devotionals · {stats.editions} editions · {stats.words.toLocaleString()} words
          </p>
          <p className="mt-5 text-sm font-medium">Get the daily devotional by email</p>
          <NewsletterForm className="mt-2 max-w-sm" />
          <div className="mt-4">
            <InstallAppButton />
          </div>
        </div>

        <nav aria-label="Read" className="lg:col-span-3">
          <h2 className="font-sans text-base font-semibold mb-3">Read</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {READ_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Monthly editions" className="lg:col-span-2">
          <h2 className="font-sans text-base font-semibold mb-3">Editions</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {editions.map((edition) => (
              <li key={edition.slug}>
                <Link href={`/editions/${edition.slug}`} className={linkClass}>
                  {edition.audienceTitle}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/editions" className={`${linkClass} font-medium text-foreground/80`}>
                All editions →
              </Link>
            </li>
            <li>
              <Link href="/feed.xml" className={`${linkClass} inline-flex items-center gap-1.5`}>
                <Rss className="w-3.5 h-3.5" aria-hidden="true" /> RSS feed
              </Link>
            </li>
          </ul>
        </nav>

        <div className="lg:col-span-3 grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
          <nav aria-label="Your Rhapsody">
            <h2 className="font-sans text-base font-semibold mb-3">Yours</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {YOURS_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
              <AccountLinks />
            </ul>
          </nav>
          <nav aria-label="Help">
            <h2 className="font-sans text-base font-semibold mb-3">Help</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {HELP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="container py-5 text-xs text-muted-foreground flex flex-col gap-2">
          <p className="max-w-4xl">
            {SITE.disclaimer.replace(/rhapsodyofrealities\.org\.?$/, '')}
            <a href={SITE.officialUrl} className="underline underline-offset-2 hover:text-primary" rel="noopener">
              {displayHost(SITE.officialUrl)}
            </a>
            .
          </p>
          <p className="max-w-4xl">{SITE.attribution}</p>
        </div>
      </div>
    </footer>
  );
}
