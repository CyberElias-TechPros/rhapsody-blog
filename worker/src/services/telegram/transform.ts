/**
 * Message → Post transformations (pure functions — unit tested without any bindings).
 */

import type { ParsedTelegramMessage } from './parse';
import { slugify, truncate } from '../../lib/util';

export interface DerivedPostFields {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tags: string[];
  readingMinutes: number;
}

/** Strip markdown link syntax for display contexts (titles, excerpts, search). */
export const stripLinks = (s: string): string => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();

export function deriveTitle(text: string, messageId: number): string {
  const firstLine = text.split('\n').map((s) => s.trim()).find(Boolean) ?? `Telegram message ${messageId}`;
  return truncate(stripLinks(firstLine), 120);
}

export const slugFor = (title: string, messageId: number): string =>
  `${slugify(title) || 'post'}-${messageId}`;

/** `#hashtag` tokens in the message + the channel slug itself (mirrors the old sync behavior). */
export function deriveTags(text: string, channelSlug: string): string[] {
  const found = (text.toLowerCase().match(/#[a-z0-9_][a-z0-9_-]{0,30}/g) ?? []).map((t) => t.slice(1));
  const set = new Set<string>([...found, channelSlug.toLowerCase()]);
  return [...set].slice(0, 12);
}

export function computeReadingMinutes(text: string): number {
  return Math.max(1, Math.round(stripLinks(text).split(/\s+/).filter(Boolean).length / 200));
}

export function transformMessage(m: ParsedTelegramMessage, channel: { slug: string; name: string }): DerivedPostFields {
  const paragraphs = m.text.split(/\n\s*\n/).flatMap((block) => block.split('\n')).map((s) => s.trim()).filter(Boolean);
  const content = paragraphs.join('\n\n');
  const title = deriveTitle(m.text, m.messageId);
  const excerptSource = paragraphs.slice(1).join(' ') || paragraphs[0] || '';
  return {
    title,
    slug: slugFor(title, m.messageId),
    excerpt: truncate(stripLinks(excerptSource).replace(/\s+/g, ' '), 200),
    content,
    tags: deriveTags(m.text, channel.slug),
    readingMinutes: computeReadingMinutes(m.text),
  };
}
