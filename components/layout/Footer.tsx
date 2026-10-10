import Link from 'next/link';
import { Rss, Sparkles } from 'lucide-react';
import { AccountLinks } from '@/components/layout/AccountLinks';
import { NewsletterForm } from '@/components/common/NewsletterForm';
import { getContentStats, getEditions } from '@/lib/content';
import { SITE } from '@/lib/site';

/**
 * Server component: the edition list and the corpus stats are read straight from
 * `content/devotionals` at render time, so the footer never needs a client fetch.
 */
export function Footer() {
  const editions = getEditions();
  const stats = getContentStats();

  return (
    <footer className="border-t border-border/60 mt-24 bg-secondary/30">
      <div className="container py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2 max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <span className="grid place-items-center w-9 h-9 rounded-xl gradient-hero">
              <Sparkles className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
            </span>
            <span className="font-serif text-xl font-semibold">
              {SITE.shortName}
              <span className="text-primary">.</span>
            </span>
          </Link>
          <p className="mt-4 text-muted-foreground leading-relaxed">{SITE.description}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            {stats.posts} daily devotionals · {stats.editions} editions · {stats.words.toLocaleString()} words
          </p>
          <p className="mt-5 text-sm font-medium">Get the daily digest</p>
          <NewsletterForm className="mt-2 max-w-sm" />
        </div>

        <nav aria-label="Editions">
          <h4 className="font-semibold mb-3">Editions</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {editions.map((edition) => (
              <li key={edition.slug}>
                <Link
                  href={`/editions/${edition.slug}`}
                  className="hover:text-primary transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {edition.audienceTitle}
                  <span className="ml-1 text-xs opacity-70">({edition.postCount})</span>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/feed.xml" className="hover:text-primary transition-colors inline-flex items-center gap-1.5">
                <Rss className="w-3.5 h-3.5" aria-hidden="true" /> RSS feed
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Explore">
          <h4 className="font-semibold mb-3">Explore</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/devotionals" className="hover:text-primary transition-colors">
                All devotionals
              </Link>
            </li>
            <li>
              <Link href="/search" className="hover:text-primary transition-colors">
                Search
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-primary transition-colors">
                About
              </Link>
            </li>
            <AccountLinks />
          </ul>
        </nav>
      </div>
      <div className="border-t border-border/60">
        <div className="container py-5 text-xs text-muted-foreground flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="max-w-3xl">{SITE.attribution}</span>
          <span className="shrink-0">Built with faith ✦</span>
        </div>
      </div>
    </footer>
  );
}
