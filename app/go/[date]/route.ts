import { redirect } from 'next/navigation';
import { resolveDate } from '@/lib/content';
import { isAudience } from '@/lib/audiences';
import { audienceFromCookieHeader } from '@/lib/audience-pref';
import { isValidDateIso } from '@/lib/time';

/**
 * `GET /go/2026-10-15?audience=teens` — the devotional for a date. Backs the "jump to a date"
 * control on the calendar and makes a date a guessable URL. A day the library does not cover
 * goes to the nearest earlier day; a malformed date goes to the calendar.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateIso(date)) redirect('/calendar');
  const requested = new URL(request.url).searchParams.get('audience');
  const audience = isAudience(requested) ? requested : (audienceFromCookieHeader(request.headers.get('cookie')) ?? 'adults');
  const post = resolveDate(date, audience);
  redirect(post ? `/devotionals/${post.slug}` : '/calendar');
}
