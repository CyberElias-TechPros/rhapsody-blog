import { redirect } from 'next/navigation';
import { getFeaturedDevotional } from '@/lib/content';
import { isAudience } from '@/lib/audiences';
import { audienceFromCookieHeader } from '@/lib/audience-pref';

/**
 * `GET /today` — always the current day's devotional.
 *
 * A permanent, shareable address for a moving target: it is what the navbar's "Today" links to,
 * what the installed app opens, what calendar reminders and the daily email link to. The
 * redirect is temporary on purpose — a 301 here would be cached by a browser or a CDN and keep
 * sending readers to the same day forever, which is precisely the bug this route exists to
 * prevent. `/api/today` answers the same question as JSON.
 *
 * Which edition: `?audience=teens` wins; otherwise the reader's saved preference (the
 * `rhapsody_audience` cookie set from the home page), otherwise the adult edition.
 */

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('audience');
  const audience = isAudience(requested) ? requested : (audienceFromCookieHeader(request.headers.get('cookie')) ?? 'adults');

  const featured = getFeaturedDevotional(new Date(), audience);
  if (!featured) redirect('/devotionals');
  redirect(`/devotionals/${featured.slug}`);
}
