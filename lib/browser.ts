/**
 * Small browser side effects, kept outside components so event handlers can call them without
 * mutating globals from component scope (which React's compiler rules reject).
 */

/** Navigate the current tab — used for `mailto:` / `sms:` links that must not open a blank tab. */
export function navigateTo(href: string): void {
  window.location.href = href;
}

/** Write a cookie string built by a helper such as `audienceCookieString`. */
export function writeCookie(cookie: string): void {
  document.cookie = cookie;
}
