import {
  getDaySiblings,
  getDevotionalForDate,
  getFeaturedDevotional,
  getReadingPlanFor,
  getSummary,
  siteTimeZone,
  todayIso,
} from '@/lib/content';
import { AUDIENCES } from '@/lib/audiences';
import { listeningMinutes } from '@/lib/tts';
import { msUntilNextMidnight } from '@/lib/time';
import { absoluteUrl } from '@/lib/site';

/**
 * `GET /api/today` — the day's devotional, as JSON.
 *
 * The site is static, so "today" is the one thing it cannot bake into a build: this endpoint and
 * the redirect at `/today` are the two places the answer is computed per request, in the site's
 * own timezone (`NEXT_PUBLIC_SITE_TIMEZONE`, Lagos by default). Anything else that wants the
 * current day — the Worker's daily email, a shortcut on a phone's home screen, a Telegram bot —
 * asks here rather than re-deriving a date it would get wrong by an hour every evening.
 *
 * The payload is a summary, never the full body: an article is read on its own URL, and this
 * stays small enough to poll.
 */

export const dynamic = 'force-dynamic';

const json = (data: unknown, init: { status?: number; cache?: string } = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Fresh for a minute at the edge, so the CDN absorbs a morning rush, but never so long
      // that midnight passes unnoticed.
      'Cache-Control': init.cache ?? 'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
    },
  });

export function GET(request: Request) {
  const now = new Date();
  const timeZone = siteTimeZone();
  const date = todayIso(now, timeZone);

  const params = new URL(request.url).searchParams;
  const requested = params.get('audience');
  const audience = requested && requested in AUDIENCES ? (requested as keyof typeof AUDIENCES) : 'adults';
  // The daily email wants the whole article in the message; a phone polling for the date does not.
  const full = params.get('full') === '1';

  const featured = getFeaturedDevotional(now, audience, timeZone);
  const exact = getDevotionalForDate(date, audience);

  if (!featured) {
    return json(
      {
        date,
        timeZone,
        generatedAt: now.toISOString(),
        msUntilNextDay: msUntilNextMidnight(now, timeZone),
        devotional: null,
        reason: 'The library is empty — no edition has been extracted yet.',
      },
      { status: 200 }
    );
  }

  const summary = getSummary(featured);
  const siblings = getDaySiblings(featured.slug).map((sibling) => ({
    audience: sibling.audience,
    audienceLabel: AUDIENCES[sibling.audience].label,
    slug: sibling.slug,
    title: sibling.title,
    href: `/devotionals/${sibling.slug}`,
  }));
  const plan = getReadingPlanFor(featured.date, audience);

  return json({
    date,
    timeZone,
    generatedAt: now.toISOString(),
    msUntilNextDay: msUntilNextMidnight(now, timeZone),
    /** `today` when the corpus has the day, `latest` when it fell back to the most recent one. */
    isToday: Boolean(exact && exact.slug === featured.slug),
    devotional: {
      ...summary,
      // `?full=1` adds the article itself. It is the one field the summary leaves out, and the
      // only consumer that needs it is the one rendering a whole day into an email.
      ...(full ? { message: featured.message } : {}),
      href: `/devotionals/${summary.slug}`,
      url: absoluteUrl(`/devotionals/${summary.slug}`),
      listeningMinutes: listeningMinutes(summary.words),
    },
    alsoToday: siblings,
    readingPlan: plan ? { oneYear: plan.oneYearPlan, twoYear: plan.twoYearPlan } : null,
  });
}
