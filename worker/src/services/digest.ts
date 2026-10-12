/**
 * The daily digest: today's devotional, in the inbox, with the prayer and the reading plans.
 *
 * The site promises this in two places — the newsletter form on the home page and the "How the day
 * works" section on `/about` — and until now the Worker only stored addresses. This is the other
 * half: a cron an hour after the day rolls over in the site's own timezone, which asks the frontend
 * `GET /api/today?full=1` what today's article is and sends it to everyone still subscribed.
 *
 * Why it asks the frontend rather than reading D1:
 *   the corpus lives in this repository as verified markdown, and `/api/today` is the one place
 *   that resolves "today" correctly (site timezone, released editions, the fallback to the most
 *   recent day when an edition has not been extracted yet). A second implementation of that logic
 *   in the Worker would drift — and drift here means emailing yesterday's article every morning.
 *
 * What can go wrong, and what happens then:
 *   provider not configured  → nothing is sent, the run is not claimed, the list keeps growing;
 *   `/api/today` unreachable → nothing is sent (an empty email is worse than a late one);
 *   the day has no article   → nothing is sent, `skipped: 'no-content'`;
 *   the cron fires twice     → the second run finds today's row in `digest_runs` and stops;
 *   one address bounces      → it is counted as a failure; the other 4,999 still get theirs.
 */

import type { Env } from '../types';
import { logInfo, logWarn } from '../lib/logging';
import { emailConfigured, sendEach, type EmailMessage } from './email';
import { makeUnsubscribeToken } from '../routes/subscribers';
import { subscribers as subscribersRepo } from '../repos/subscribers';

/** The shape `/api/today?full=1` answers with. Loose on purpose: it is another deployable. */
export interface DigestDevotional {
  title: string;
  slug: string;
  date: string;
  weekday: string;
  editionTitle: string;
  audienceLabel: string;
  excerpt: string;
  scripture: string;
  scriptureReference: string;
  message: string[];
  prayer: string;
  prayerLabel: string;
  /**
   * The frontend prints these as prose ("Romans 8:10-11; John 7:38-39") and an edition could
   * start splitting them, so either shape is accepted — see `asLines`.
   */
  furtherStudy: string | string[];
  oneYearPlan: string | string[];
  twoYearPlan: string | string[];
  words: number;
  url: string;
  href: string;
  listeningMinutes?: number;
}

export interface DigestPayload {
  date: string;
  timeZone: string;
  isToday: boolean;
  devotional: DigestDevotional | null;
  alsoToday?: { audience: string; audienceLabel: string; slug: string; title: string; href: string }[];
  readingPlan?: { oneYear: string[]; twoYear: string[] } | null;
}

export type DigestSkip = 'unconfigured' | 'no-site-url' | 'no-content' | 'already-sent';

export interface DigestSummary {
  skipped?: DigestSkip;
  reason?: string;
  runDate?: string;
  total?: number;
  sent?: number;
  failed?: number;
  errors?: string[];
}

/** Which cron expression belongs to this job (kept next to the handler in `index.ts`). */
export const DIGEST_CRON = '0 4 * * *';

/**
 * A list of lines from whatever the API sent.
 *
 * Further study is printed as "Romans 8:10-11; John 7:38-39", and a reading plan as
 * "Galatians 1:1-24 & Ecclesiastes 9-12" — the plan is one line, because splitting it on "&" would
 * separate two halves of the same day's reading. An array is taken as it comes.
 */
function asLines(value: string | string[] | undefined, separator: RegExp = /;|\n/): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value)
    .split(separator)
    .map((line) => line.trim())
    .filter(Boolean);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PAGE_SIZE = 500;

/** A usable public origin, or null. The placeholder in `wrangler.jsonc` is not one. */
export function siteOrigin(env: Env): string | null {
  const raw = env.SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    // `new URL()` lowercases the host, so the placeholder check has to compare lowercase too.
    const host = url.hostname.toLowerCase();
    if (host.includes('your_subdomain') || host.includes('your-subdomain') || host.includes('example.com')) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/** Ask the frontend what today's article is. Null means "do not send anything". */
export async function fetchTodaysDevotional(env: Env, timeoutMs = 20_000): Promise<DigestPayload | null> {
  const origin = siteOrigin(env);
  if (!origin) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${origin}/api/today?full=1`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      logWarn('digest: /api/today did not answer', { status: response.status, origin });
      return null;
    }
    const payload = (await response.json()) as DigestPayload;
    if (!payload?.devotional?.title || !Array.isArray(payload.devotional.message)) {
      logWarn('digest: /api/today answered without an article', { date: payload?.date });
      return null;
    }
    return payload;
  } catch (error) {
    logWarn('digest: could not reach /api/today', { error: String(error), origin });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** "Monday 12 October 2026" from a `YYYY-MM-DD` date, without dragging a date library in. */
export function humanDate(iso: string): string {
  const [, month, day] = iso.split('-');
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName}`;
}

export function digestSubject(devotional: DigestDevotional): string {
  // The weekday and title carry the day; the brand sits in the from-address, not the subject.
  const title = devotional.title.replace(/\s+/g, ' ').trim();
  const head = `${devotional.weekday || ''} ${humanDate(devotional.date)}`.trim();
  return `${head}: ${title}`.slice(0, 150);
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The email itself.
 *
 * Inline styles only and no layout tables: a reader opens this on a phone, in Gmail, in a browser
 * tab and sometimes in a text-only client, and every one of those has to be legible. The article is
 * in the email — that is the promise — with the reading plans and a link to listen or save.
 */
export function renderDigestHtml(input: {
  devotional: DigestDevotional;
  siteUrl: string;
  alsoToday?: DigestPayload['alsoToday'];
  unsubscribeUrl: string;
}): string {
  const { devotional: d, siteUrl, alsoToday = [], unsubscribeUrl } = input;
  const brand = `${siteUrl}/`;

  const paragraphs = d.message
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => `<p style="margin:0 0 18px;font-size:17px;line-height:1.75;color:#2b2119">${escapeHtml(paragraph.trim())}</p>`)
    .join('\n');

  const listBlock = (heading: string, items: string[]) =>
    items.length
      ? `<tr><td style="padding:0 0 18px">
           <h3 style="margin:0 0 8px;font-size:13px;letter-spacing:.09em;text-transform:uppercase;color:#b45309">${escapeHtml(heading)}</h3>
           <p style="margin:0;font-size:16px;line-height:1.7;color:#2b2119">${items.map(escapeHtml).join('<br>')}</p>
         </td></tr>`
      : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(d.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f1e8;font-family:Georgia,'Iowan Old Style','Times New Roman',serif">
<div style="max-width:640px;margin:0 auto;padding:24px 16px 48px">
  <p style="margin:0 0 18px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a6a3b">
    <a href="${brand}" style="color:#8a6a3b;text-decoration:none">Rhapsody of Realities</a>
  </p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffdf9;border:1px solid #e8dcc8;border-radius:16px;padding:8px">
    <tr><td style="padding:26px 26px 6px">
      <p style="margin:0 0 10px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;color:#8a6a3b">
        ${escapeHtml(`${d.weekday} ${humanDate(d.date)}`)} · ${escapeHtml(d.audienceLabel || d.editionTitle)}
      </p>
      <h1 style="margin:0 0 6px;font-size:29px;line-height:1.2;color:#1d1610">${escapeHtml(d.title)}</h1>
    </td></tr>

    ${
      d.scripture
        ? `<tr><td style="padding:6px 26px 20px">
             <blockquote style="margin:0;padding:16px 18px;border-left:3px solid #d97706;background:#fbf3e4;border-radius:0 10px 10px 0">
               <p style="margin:0 0 6px;font-size:17px;line-height:1.65;font-style:italic;color:#2b2119">${escapeHtml(d.scripture)}</p>
               ${d.scriptureReference ? `<p style="margin:0;font-size:14px;color:#8a6a3b">${escapeHtml(d.scriptureReference)}</p>` : ''}
             </blockquote>
           </td></tr>`
        : ''
    }

    <tr><td style="padding:0 26px 6px">${paragraphs}</td></tr>

    ${listBlock(d.prayerLabel || 'Prayer', d.prayer ? [d.prayer] : [])}
    ${listBlock('Further study', asLines(d.furtherStudy))}
    ${listBlock('One-year Bible reading plan', asLines(d.oneYearPlan, /\n/))}
    ${listBlock('Two-year Bible reading plan', asLines(d.twoYearPlan, /\n/))}

    <tr><td style="padding:6px 26px 26px">
      <p style="margin:0 0 16px">
        <a href="${escapeHtml(d.url)}" style="display:inline-block;background:#b45309;color:#fffdf9;text-decoration:none;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;font-weight:600;padding:13px 22px;border-radius:999px">Open today’s devotional</a>
      </p>
      ${
        alsoToday.length
          ? `<p style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.8;color:#5a4632">
               Also published today: ${alsoToday
                 .map((sibling) => `<a href="${siteUrl}${escapeHtml(sibling.href)}" style="color:#b45309">${escapeHtml(sibling.title)}</a> (${escapeHtml(sibling.audienceLabel)})`)
                 .join(' · ')}
             </p>`
          : ''
      }
    </td></tr>
  </table>

  <p style="margin:22px 4px 0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:12px;line-height:1.7;color:#8a7a63">
    You are receiving this because you asked for the daily devotional by email.
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a7a63">Unsubscribe</a> — one click, no login.
    <br>Rhapsody of Realities · Pastor Chris Oyakhilome · <a href="${brand}" style="color:#8a7a63">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a>
  </p>
</div>
</body>
</html>`;
}

export function renderDigestText(input: {
  devotional: DigestDevotional;
  siteUrl: string;
  alsoToday?: DigestPayload['alsoToday'];
  unsubscribeUrl: string;
}): string {
  const { devotional: d, siteUrl, alsoToday = [], unsubscribeUrl } = input;
  const block = (heading: string, items: string[]) => (items.length ? `\n\n${heading.toUpperCase()}\n${items.join('\n')}` : '');
  return [
    `${d.title}`,
    `${d.weekday} ${humanDate(d.date)} · ${d.audienceLabel || d.editionTitle}`,
    d.scripture ? `\n${d.scripture}${d.scriptureReference ? ` — ${d.scriptureReference}` : ''}` : '',
    ...d.message.filter((paragraph) => paragraph.trim()).map((paragraph) => `\n${paragraph.trim()}`),
    block(d.prayerLabel || 'Prayer', d.prayer ? [d.prayer] : []),
    block('Further study', asLines(d.furtherStudy)),
    block('One-year Bible reading plan', asLines(d.oneYearPlan, /\n/)),
    block('Two-year Bible reading plan', asLines(d.twoYearPlan, /\n/)),
    `\nRead it on the site: ${d.url}`,
    alsoToday.length ? `Also today: ${alsoToday.map((s) => `${s.title} (${s.audienceLabel}) ${siteUrl}${s.href}`).join(' | ')}` : '',
    `\nUnsubscribe (one click, no login): ${unsubscribeUrl}`,
  ].join('\n');
}

/**
 * Send today's digest to the whole list, once.
 *
 * The run is claimed in D1 *before* sending, so a retry after a partial failure does not email the
 * people who already got theirs; the row is then updated with what actually happened.
 */
export async function sendDailyDigest(env: Env): Promise<DigestSummary> {
  const startedAt = new Date().toISOString();

  if (!emailConfigured(env)) {
    logWarn('digest: no email provider configured — nothing sent', {});
    return { skipped: 'unconfigured', reason: 'EMAIL_API_URL, EMAIL_API_KEY and EMAIL_FROM must all be set' };
  }

  const siteUrl = siteOrigin(env);
  if (!siteUrl) {
    logWarn('digest: SITE_URL is not a usable origin — nothing sent', { siteUrl: env.SITE_URL ?? null });
    return { skipped: 'no-site-url', reason: 'SITE_URL must be the deployed frontend origin' };
  }

  const payload = await fetchTodaysDevotional(env);
  if (!payload?.devotional) {
    logWarn('digest: no article for today — nothing sent', {});
    return { skipped: 'no-content', reason: 'GET /api/today returned no devotional' };
  }

  const d = payload.devotional;
  const runDate = payload.date || d.date;
  const claimed = await env.DB.prepare(
    `INSERT OR IGNORE INTO digest_runs (run_date, started_at) VALUES (?, ?)`
  )
    .bind(runDate, startedAt)
    .run();

  if ((claimed.meta?.changes ?? 0) === 0) {
    logInfo('digest: already sent for this date — skipping', { runDate });
    return { skipped: 'already-sent', runDate };
  }

  const secret = env.JWT_SECRET ?? '';
  let offset = 0;
  const summary: DigestSummary = { runDate, total: 0, sent: 0, failed: 0, errors: [] };

  for (;;) {
    const rows = await subscribersRepo.listActive(env.DB, PAGE_SIZE, offset);
    if (!rows.length) break;

    const messages: EmailMessage[] = rows.map((row) => {
      // A signed, expiring, per-recipient link: the same capability the unsubscribe route verifies,
      // plus the RFC 8058 headers so Gmail's one-click unsubscribe works without opening the email.
      const unsubscribeUrl = `${siteUrl}/api/subscribers/unsubscribe?email=${encodeURIComponent(row.email)}&token=${makeUnsubscribeToken(
        secret,
        row.email,
        Date.now()
      )}`;
      const html = renderDigestHtml({ devotional: d, siteUrl, alsoToday: payload.alsoToday, unsubscribeUrl });
      const text = renderDigestText({ devotional: d, siteUrl, alsoToday: payload.alsoToday, unsubscribeUrl });
      return {
        to: row.email,
        subject: digestSubject(d),
        html,
        text,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      };
    });

    const batch = await sendEach(env, messages, 5);
    summary.total = (summary.total ?? 0) + batch.total;
    summary.sent = (summary.sent ?? 0) + batch.sent;
    summary.failed = (summary.failed ?? 0) + batch.failed;
    for (const error of batch.errors) if ((summary.errors?.length ?? 0) < 5) summary.errors?.push(error);

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  if (!summary.total) {
    await env.DB.prepare(`UPDATE digest_runs SET skipped = 'no-subscribers', finished_at = ? WHERE run_date = ?`)
      .bind(new Date().toISOString(), runDate)
      .run();
    logInfo('digest: nobody is subscribed yet', { runDate });
    return { ...summary, skipped: 'no-content', reason: 'no active subscribers' };
  }

  await env.DB.prepare(`UPDATE digest_runs SET sent = ?, failed = ?, finished_at = ? WHERE run_date = ?`)
    .bind(summary.sent ?? 0, summary.failed ?? 0, new Date().toISOString(), runDate)
    .run();

  logInfo('digest: sent', { runDate, total: summary.total, sent: summary.sent, failed: summary.failed });
  return summary;
}
