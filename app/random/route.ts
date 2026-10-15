import { redirect } from 'next/navigation';
import { getRandomDevotional } from '@/lib/content';
import { isAudience } from '@/lib/audiences';
import { audienceFromCookieHeader } from '@/lib/audience-pref';

/**
 * `GET /random` — "Surprise me": a devotional chosen at random from the days that have already
 * arrived, in the reader's edition (`?audience=` or their saved preference). Never cached.
 */

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('audience');
  const audience = isAudience(requested) ? requested : (audienceFromCookieHeader(request.headers.get('cookie')) ?? 'adults');
  const post = getRandomDevotional(audience);
  redirect(post ? `/devotionals/${post.slug}` : '/devotionals');
}
