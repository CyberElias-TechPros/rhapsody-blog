/**
 * A deliberately tiny, *safe* inline-markdown parser for post content.
 *
 * Telegram sync produces text containing only: **bold**, *italic*, `code`, and [label](url)
 * links (see worker transform). Everything else renders as plain text — no HTML is ever
 * produced from user content, so this is XSS-safe by construction. URLs are restricted to
 * http(s) and mailto, and label text is rendered via React (auto-escaped).
 */

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineToken[] }
  | { type: 'italic'; children: InlineToken[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: InlineToken[] };

export interface Block {
  type: 'paragraph' | 'heading2' | 'heading3' | 'quote';
  text: string;
}

const SAFE_URL = /^(https?:\/\/|mailto:)[^\s"']{1,2000}$/i;

export function parseInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer) {
      tokens.push({ type: 'text', text: buffer });
      buffer = '';
    }
  };

  while (i < input.length) {
    const rest = input.slice(i);

    if (rest.startsWith('**')) {
      const end = input.indexOf('**', i + 2);
      if (end > i + 1) {
        flush();
        tokens.push({ type: 'bold', children: parseInline(input.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (rest.startsWith('*') && !rest.startsWith('**')) {
      const end = input.indexOf('*', i + 1);
      // Emphasis needs non-space flanking on both sides (CommonMark-ish heuristic);
      // otherwise leave the asterisk as literal text.
      if (end > i + 1 && input[end - 1] !== '*' && input[i + 1] !== ' ' && input[end - 1] !== ' ') {
        flush();
        tokens.push({ type: 'italic', children: parseInline(input.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (rest.startsWith('`')) {
      const end = input.indexOf('`', i + 1);
      if (end > i) {
        flush();
        tokens.push({ type: 'code', text: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (rest.startsWith('[')) {
      const closeBracket = input.indexOf(']', i + 1);
      if (closeBracket > i && input[closeBracket + 1] === '(') {
        const closeParen = matchingParen(input, closeBracket + 1);
        if (closeParen !== -1) {
          const label = input.slice(i + 1, closeBracket);
          const href = input.slice(closeBracket + 2, closeParen).trim();
          if (SAFE_URL.test(href)) {
            flush();
            tokens.push({ type: 'link', href, children: parseInline(label) });
            i = closeParen + 1;
            continue;
          }
        }
      }
    }

    buffer += input[i];
    i += 1;
  }
  flush();
  return tokens;
}

function matchingParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split post content into blocks. Blank-line separated paragraphs; `## ` / `### ` headings; `> ` quotes. */
export function parseBlocks(content: string): Block[] {
  const out: Block[] = [];
  for (const para of content.replace(/\r/g, '').split(/\n\s*\n/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('### ')) out.push({ type: 'heading3', text: trimmed.slice(4).trim() });
    else if (trimmed.startsWith('## ')) out.push({ type: 'heading2', text: trimmed.slice(3).trim() });
    else if (trimmed.startsWith('> ')) out.push({ type: 'quote', text: trimmed.replace(/^>\s?/gm, '').trim() });
    else out.push({ type: 'paragraph', text: trimmed });
  }
  return out;
}
