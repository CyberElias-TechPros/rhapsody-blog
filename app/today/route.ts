import { redirect } from 'next/navigation';
import { getFeaturedDevotional } from '@/lib/content';
import { AUDIENCES } from '@/lib/audiences';

/**
 * `GET /today` — always the current day's devotional.
 *
 * A permanent, shareable address for a moving target: it is what the navbar's "Today" links to,
 * what a reader puts on their phone's home screen, and what the daily email links to at the top.
 * The redirect is temporary on purpose — a 301 here would be cached by a browser or a CDN and
 * keep sending readers to the same day forever, which is precisely the bug this route exists to
 * prevent. `/api/today` answers the same question as JSON.
 */

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('audience');
  const audience = requested && requested in AUDIENCES ? (requested as keyof typeof AUDIENCES) : 'adults';

  const featured = getFeaturedDevotional(new Date(), audience);
  if (!featured) redirect('/devotionals');
  redirect(`/devotionals/${featured.slug}`);
}
