/**
 * Sharing, the way this devotional is actually shared.
 *
 * In Nigeria and across the readership, the day's Rhapsody is passed around as a WhatsApp
 * message: the whole text, pasted into family and church groups every morning, with *bold*
 * headings. "Copy full devotional" produces exactly that message — formatted for WhatsApp
 * (which also reads well in Telegram, SMS and email) and ending with a link back here, so every
 * forwarded copy is also an invitation to the full page, the audio and tomorrow's reading.
 */

import { stripTrailingReference } from '@/lib/bible';
import { formatOrdinalDate } from '@/lib/format';
import { AUDIENCE_SEARCH_NAME } from '@/lib/seo';
import type { Devotional } from '@/lib/types';

type ShareablePost = Pick<
  Devotional,
  | 'title'
  | 'date'
  | 'weekday'
  | 'audience'
  | 'scripture'
  | 'scriptureReference'
  | 'message'
  | 'prayerLabel'
  | 'prayer'
  | 'extras'
  | 'furtherStudy'
  | 'oneYearPlan'
  | 'twoYearPlan'
  | 'author'
>;

/** Markdown emphasis → WhatsApp emphasis (`**bold**` → `*bold*`, `*italic*` → `_italic_`). */
export function toWhatsAppMarkup(markdown: string): string {
  return (markdown ?? '')
    .replace(/\*\*([^*\n]+)\*\*/g, '\u0000$1\u0000')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, '$1_$2_')
    .replace(/\u0000/g, '*')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1')
    .trim();
}

/** The whole day as one WhatsApp-ready message. */
export function devotionalShareText(post: ShareablePost, url: string): string {
  const lines: string[] = [];
  const heading = AUDIENCE_SEARCH_NAME[post.audience].toUpperCase();
  lines.push(`*${heading}*`);
  lines.push(`_${post.weekday ? `${post.weekday}, ` : ''}${formatOrdinalDate(post.date)}_`);
  lines.push('');
  lines.push(`*${post.title.toUpperCase()}*`);
  if (post.scripture) {
    lines.push('');
    const verse = stripTrailingReference(post.scripture);
    lines.push(`_${verse}_${post.scriptureReference ? ` (${post.scriptureReference})` : ''}`);
  }
  for (const paragraph of post.message) {
    lines.push('');
    lines.push(toWhatsAppMarkup(paragraph));
  }
  if (post.prayer) {
    lines.push('');
    lines.push(`*${(post.prayerLabel || 'Prayer').toUpperCase()}*`);
    lines.push(toWhatsAppMarkup(post.prayer));
  }
  for (const extra of post.extras ?? []) {
    lines.push('');
    lines.push(`*${extra.label.toUpperCase()}*`);
    lines.push(toWhatsAppMarkup(extra.text));
  }
  if (post.furtherStudy) {
    lines.push('');
    lines.push(`*FURTHER STUDY:* ${post.furtherStudy}`);
  }
  if (post.oneYearPlan) lines.push(`${post.furtherStudy ? '' : '\n'}*1-YEAR BIBLE READING PLAN:* ${post.oneYearPlan}`);
  if (post.twoYearPlan) lines.push(`*2-YEAR BIBLE READING PLAN:* ${post.twoYearPlan}`);
  lines.push('');
  lines.push(`— ${post.author}`);
  lines.push(`Read, listen and share: ${url}`);
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A one-paragraph teaser for social posts: title, verse, link. */
export function devotionalTeaser(post: Pick<ShareablePost, 'title' | 'date' | 'audience' | 'scripture' | 'scriptureReference'>): string {
  const verse = post.scripture ? stripTrailingReference(post.scripture) : '';
  const short = verse.length > 160 ? `${verse.slice(0, verse.lastIndexOf(' ', 157))}…` : verse;
  return `${AUDIENCE_SEARCH_NAME[post.audience]} — ${formatOrdinalDate(post.date)}: “${post.title}”${
    short ? `\n\n“${short}”${post.scriptureReference ? ` (${post.scriptureReference})` : ''}` : ''
  }`;
}

export type ShareTarget = 'whatsapp' | 'telegram' | 'facebook' | 'x' | 'email' | 'sms';

/** Share-intent URLs. None of these need an SDK, a key or a script on the page. */
export function shareUrl(target: ShareTarget, { url, text, title }: { url: string; text: string; title: string }): string {
  const e = encodeURIComponent;
  switch (target) {
    case 'whatsapp':
      return `https://wa.me/?text=${e(`${text}\n\n${url}`)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${e(url)}&text=${e(text)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`;
    case 'x':
      return `https://twitter.com/intent/tweet?text=${e(text.length > 200 ? `${text.slice(0, 197)}…` : text)}&url=${e(url)}`;
    case 'email':
      return `mailto:?subject=${e(title)}&body=${e(`${text}\n\n${url}`)}`;
    case 'sms':
      return `sms:?&body=${e(`${title} ${url}`)}`;
  }
}
