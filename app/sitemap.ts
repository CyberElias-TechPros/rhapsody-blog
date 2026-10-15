import type { MetadataRoute } from 'next';
import { getAllDevotionals, getBibleBookIndex, getEditions } from '@/lib/content';
import { getAllResources } from '@/lib/resources';
import { getAllIssues } from '@/lib/kids';
import { absoluteUrl } from '@/lib/site';

/**
 * sitemap.xml — generated from the same content layer the pages render from, so it can never
 * drift from what is actually published. (The Worker's own sitemap for Telegram-synced posts
 * still lives at `/sitemap.xml` on the Worker; this one describes the blog.)
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/devotionals'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/editions'), lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: absoluteUrl('/search'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: absoluteUrl('/kids'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/resources'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    // The day's plans change daily, and so does the page that answers for them.
    { url: absoluteUrl('/reading-plans'), lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: absoluteUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    // The editions' own landing pages: today's TeeVo and Early Readers devotional, every day.
    { url: absoluteUrl('/teevo'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/early-readers'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/calendar'), lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: absoluteUrl('/bible'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/faq'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/contact'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/privacy'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/terms'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    // Not listed: `/today`, `/random` and `/go/*` (redirects to articles that are listed), and
    // the per-device pages `/library`, `/me` and `/offline` (all noindex).
  ];

  // Devotionals grouped by the book of their opening scripture (`/bible/romans`, …).
  const bookRoutes: MetadataRoute.Sitemap = getBibleBookIndex().map(({ book }) => ({
    url: absoluteUrl(`/bible/${book.slug}`),
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  // The kids' edition is an issue per page, not an article per day (see lib/kids.ts).
  const kidsRoutes: MetadataRoute.Sitemap = getAllIssues().map((issue) => ({
    url: absoluteUrl(`/kids/${issue.slug}`),
    lastModified: new Date(`${issue.date}T05:00:00.000Z`),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const editionRoutes: MetadataRoute.Sitemap = getEditions().map((edition) => ({
    url: absoluteUrl(`/editions/${edition.slug}`),
    lastModified: new Date(`${edition.lastDate}T05:00:00.000Z`),
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  // A daily devotional is read on its day, then occasionally revisited — hence "yearly" after
  // the publication window and a solid 0.8 while it is current.
  const postRoutes: MetadataRoute.Sitemap = getAllDevotionals().map((post) => ({
    url: absoluteUrl(`/devotionals/${post.slug}`),
    lastModified: new Date(`${post.date}T05:00:00.000Z`),
    changeFrequency: post.date >= now.toISOString().slice(0, 10) ? 'daily' : 'yearly',
    priority: 0.8,
  }));

  // Books and programme notes: permanent documents, so they are indexed like editions.
  const resourceRoutes: MetadataRoute.Sitemap = getAllResources().map((resource) => ({
    url: absoluteUrl(`/resources/${resource.slug}`),
    lastModified: resource.date ? new Date(`${resource.date}T05:00:00.000Z`) : now,
    changeFrequency: 'yearly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...editionRoutes, ...bookRoutes, ...kidsRoutes, ...resourceRoutes, ...postRoutes];
}

export const dynamic = 'force-static';
