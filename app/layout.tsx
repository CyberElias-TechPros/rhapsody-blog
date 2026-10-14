import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Providers } from '@/components/providers';
import { SITE, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.author }],
  creator: SITE.name,
  publisher: SITE.publisher,
  keywords: [
    'Rhapsody of Realities',
    'daily devotional',
    'Pastor Chris Oyakhilome',
    'Bible reading plan',
    'devotional blog',
  ],
  category: 'religion',
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': [{ url: absoluteUrl('/feed.xml'), title: `${SITE.name} — daily devotionals` }],
    },
  },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: absoluteUrl('/'),
    locale: SITE.locale.replace('_', '-'),
    images: [{ url: absoluteUrl(SITE.ogImage), width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [absoluteUrl(SITE.ogImage)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      // SVG for the platforms that take it: one small file, sharp at every size.
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
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
 * Fonts are loaded with plain <link> tags rather than `next/font`: `next/font/google`
 * downloads the families at build time, which fails in build environments without access to
 * fonts.googleapis.com. The stylesheet is still fetched by the browser at runtime, and the
 * font stacks in `tailwind.config.ts` fall back to Georgia/system-ui until it arrives.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // globals.css sets `scroll-behavior: smooth`; this tells the router that route changes
    // should honour it instead of jumping to the top instantly.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
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
