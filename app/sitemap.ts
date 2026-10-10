import type { MetadataRoute } from 'next';
import { getAllDevotionals, getEditions } from '@/lib/content';
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
    { url: absoluteUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

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

  return [...staticRoutes, ...editionRoutes, ...kidsRoutes, ...postRoutes];
}

export const dynamic = 'force-static';
