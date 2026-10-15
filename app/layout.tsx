import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Providers } from '@/components/providers';
import { READING_PREFS_SCRIPT } from '@/lib/reader-data';
import { SITE_KEYWORDS, jsonLdString, websiteJsonLd } from '@/lib/seo';
import { SITE, SITE_VERIFICATION, absoluteUrl } from '@/lib/site';

const DEFAULT_TITLE = `${SITE.name} Today — ${SITE.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: DEFAULT_TITLE,
    // Pages whose title already leads with the series name (every devotional, edition and hub)
    // set an absolute title instead, so the brand is never said twice.
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.author }],
  creator: SITE.author,
  publisher: SITE.publisher,
  keywords: SITE_KEYWORDS,
  category: 'religion',
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': [{ url: absoluteUrl('/feed.xml'), title: `${SITE.name} — daily devotional feed` }],
    },
  },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: DEFAULT_TITLE,
    description: SITE.description,
    url: absoluteUrl('/'),
    locale: SITE.locale,
    images: [{ url: absoluteUrl(SITE.ogImage), width: 1200, height: 630, alt: `${SITE.name} — daily devotional` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: SITE.description,
    images: [absoluteUrl(SITE.ogImage)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      // SVG for the platforms that take it: one small file, sharp at every size.
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: SITE.shortName,
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#b45309' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1508' },
  ],
};

/**
 * Captures the browser's install prompt if it fires before React hydrates (see
 * `components/pwa/install.ts`), and applies saved reading settings before first paint.
 */
const HEAD_SCRIPT = `${READING_PREFS_SCRIPT}window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__rhapsodyInstallPrompt=e;});`;

/**
 * Fonts are loaded with plain <link> tags rather than `next/font`: `next/font/google`
 * downloads the families at build time, which fails in build environments without access to
 * fonts.googleapis.com. The stylesheet is still fetched by the browser at runtime, and the
 * font stacks in `tailwind.config.ts` fall back to Georgia/system-ui until it arrives.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // globals.css sets `scroll-behavior: smooth`; this tells the router that route changes
    // should honour it instead of jumping to the top instantly.
    <html lang="en-GB" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Domain-ownership proofs (see `SITE_VERIFICATION`). These are plain tags, not
            `metadata.verification`, because verifiers read the served <head>. On a dynamic
            route such as the home page, Next streams metadata for any user agent outside its
            short bot list, so a metadata tag only reaches <head> if it resolves before the shell
            flushes. Tags written here are part of the shell and are always in <head>. */}
        {Object.entries(SITE_VERIFICATION).map(([name, content]) => (
          <meta key={name} name={name} content={content} />
        ))}
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- This IS the App Router's
            single global shell (there is no per-page font here), and `next/font/google` cannot
            be used because builds run offline; hence a runtime stylesheet plus preconnect. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col gradient-warm">
        {/* The site and the publication it is about, for search engines (one per page). */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd()) }} />
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <Navbar />
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
