import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { breadcrumbJsonLd, jsonLdString } from '@/lib/seo';

/** Shared frame for the policy pages: breadcrumb, title, "last updated", readable measure. */
export function LegalPage({
  title,
  path,
  updated,
  intro,
  children,
}: {
  title: string;
  path: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: title, path },
  ];
  return (
    <div className="container py-12 md:py-16 max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs)) }} />
      <Breadcrumbs crumbs={crumbs} className="mb-8" />
      <header>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-6 text-lg text-muted-foreground leading-relaxed">{intro}</div>
      </header>
      <div className="mt-10 space-y-10 leading-relaxed text-foreground/90 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_p+p]:mt-3 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_code]:text-sm [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded">
        {children}
      </div>
    </div>
  );
}
