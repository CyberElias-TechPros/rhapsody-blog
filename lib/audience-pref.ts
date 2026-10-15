/**
 * Which edition a reader prefers — adults, TeeVo (teens) or early readers — remembered in a
 * first-party cookie so the *server* can render the right one: the home page hero and the
 * `/today` redirect both read it. (localStorage would only be visible after hydration, which
 * would flash the adult edition first.) It is a preference cookie, not a tracker: one value, no
 * identifier, readable by this site only, and it is listed in the privacy policy.
 */

import { isAudience, type AudienceId } from '@/lib/audiences';

export const AUDIENCE_COOKIE = 'rhapsody_audience';

/** Parse the cookie value; anything unexpected means "no preference". */
export function parseAudienceCookie(value: string | undefined | null): AudienceId | undefined {
  return isAudience(value) ? value : undefined;
}

/** `Set-Cookie`-style string for `document.cookie` (one year, whole site, not sent cross-site). */
export function audienceCookieString(audience: AudienceId | null): string {
  if (!audience) return `${AUDIENCE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  return `${AUDIENCE_COOKIE}=${audience}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Read the cookie from a raw `Cookie` header (route handlers). */
export function audienceFromCookieHeader(header: string | null): AudienceId | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === AUDIENCE_COOKIE) return parseAudienceCookie(decodeURIComponent(rest.join('=')));
  }
  return undefined;
}
