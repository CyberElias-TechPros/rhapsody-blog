/**
 * Telegram public-preview parser (`https://t.me/s/<username>`).
 *
 * Replaces the old cheerio-based scraper with the Workers-native HTMLRewriter — a streaming
 * SAX-style parser that runs inside workerd with no Node dependencies.
 *
 * Strategy: per-message state machine. Element handlers are registered globally but only
 * mutate the "current message" context while inside a `.tgme_widget_message_wrap`, so
 * forwarded/service messages and nested widgets can't bleed into the wrong record.
 */

export interface ParsedTelegramMessage {
  messageId: number;
  text: string;
  publishedAt: string; // ISO (falls back to now)
  coverImage: string; // original CDN url ('' when none)
  telegramUrl: string;
}

interface MsgState {
  messageId: number | null;
  dataPost: string | null;
  textParts: string[];
  inText: boolean;
  inLink: boolean;
  linkHref: string;
  linkText: string[];
  hasTextBlock: boolean;
  publishedAt: string | null;
  coverImage: string;
}

const freshState = (): MsgState => ({
  messageId: null,
  dataPost: null,
  textParts: [],
  inText: false,
  inLink: false,
  linkHref: '',
  linkText: [],
  hasTextBlock: false,
  publishedAt: null,
  coverImage: '',
});

/** Parse the /s/ preview page HTML into normalized messages. */
export async function parseTelegramPreview(html: string, username: string): Promise<ParsedTelegramMessage[]> {
  const messages: ParsedTelegramMessage[] = [];
  let cur: MsgState | null = null;

  const push = (m: MsgState) => {
    if (m.messageId === null || !m.hasTextBlock) return;
    const text = normalizeText(m.textParts.join(''));
    if (!text) return;
    messages.push({
      messageId: m.messageId,
      text,
      publishedAt: m.publishedAt ?? new Date().toISOString(),
      coverImage: m.coverImage,
      telegramUrl: `https://t.me/${m.dataPost ?? `${username}/${m.messageId}`}`,
    });
  };

  let wrapDepth = 0;
  const rw = new HTMLRewriter()
    // Message wrapper lifecycle — each *top-level* wrap owns one message state.
    // Nested wraps (inline reply previews embed their own markup) are skipped so they
    // can neither overwrite nor pollute the outer message state.
    .on('div.tgme_widget_message_wrap', {
      element(el) {
        wrapDepth++;
        const primary = wrapDepth === 1;
        if (primary) cur = freshState();
        el.onEndTag(() => {
          wrapDepth--;
          if (primary && cur) {
            push(cur);
            cur = null;
          }
        });
      },
    })
    // data-post="username/1234" carries the message id.
    .on('div.tgme_widget_message', {
      element(el) {
        if (!cur || cur.dataPost) return; // first (outermost) message element of the wrap
        const dataPost = el.getAttribute('data-post');
        if (!dataPost) return;
        const [owner, rawId] = dataPost.split('/');
        // Never attribute a message from a different channel to this one.
        if (owner && owner.toLowerCase() !== username.toLowerCase()) return;
        const id = parseInt(rawId ?? '', 10);
        if (!Number.isFinite(id)) return;
        cur.dataPost = dataPost;
        cur.messageId = id;
      },
    })
    // Primary text block. The js-message_text class marks the real message body;
    // quoted reply previews use js-message_reply_text and are deliberately excluded.
    .on('div.tgme_widget_message_text.js-message_text', {
      element(el) {
        if (!cur || cur.hasTextBlock) return;
        cur.hasTextBlock = true;
        cur.inText = true;
        el.onEndTag(() => {
          if (cur) cur.inText = false;
        });
      },
      text(chunk) {
        if (cur?.inText && !cur.inLink) cur.textParts.push(chunk.text);
      },
    })
    // <br> → newline inside the active text block.
    .on('br', {
      element() {
        if (cur?.inText && !cur.inLink) cur.textParts.push('\n');
      },
    })
    // Paragraph boundaries inside the message text → paragraph break.
    .on('div.tgme_widget_message_text.js-message_text p', {
      element(el) {
        if (cur?.inText) cur.textParts.push('\n');
        el.onEndTag(() => {
          if (cur?.inText) cur.textParts.push('\n');
        });
      },
    })
    // Links → [text](url); only http/https targets survive into the markdown form.
    .on('div.tgme_widget_message_text.js-message_text a', {
      element(el) {
        if (!cur?.inText) return;
        cur.inLink = true;
        cur.linkHref = el.getAttribute('href') ?? '';
        cur.linkText = [];
        el.onEndTag(() => {
          if (!cur || !cur.inLink) return;
          cur.inLink = false;
          const label = cur.linkText.join('').trim();
          const href = cur.linkHref.trim();
          const safe = /^https?:\/\//i.test(href);
          cur.textParts.push(label && safe ? `[${label}](${href})` : label);
        });
      },
      text(chunk) {
        if (cur?.inLink) cur.linkText.push(chunk.text);
      },
    })
    // Publish timestamp (first time element within the message).
    .on('time', {
      element(el) {
        if (!cur || cur.publishedAt) return;
        const dt = el.getAttribute('datetime');
        if (dt && !Number.isNaN(Date.parse(dt))) cur.publishedAt = new Date(dt).toISOString();
      },
    })
    // Cover image URL lives in an inline style attribute.
    .on('a.tgme_widget_message_photo_wrap', {
      element(el) {
        if (!cur || cur.coverImage) return;
        const style = el.getAttribute('style') ?? '';
        const m = style.match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/);
        if (m && /^https?:\/\//i.test(m[1])) cur.coverImage = m[1];
      },
    });

  // Drain the transformed stream — the handlers run as a side effect of consumption.
  await rw.transform(new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })).text();

  return dedupeById(messages).sort((a, b) => a.messageId - b.messageId);
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
};

/** HTMLRewriter hands back raw markup text — decode the entities Telegram actually uses. */
function decodeEntities(input: string): string {
  return input
    .replace(/&#([0-9]{1,7});/g, (_, code: string) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,10});/g, (full, name: string) => NAMED[name.toLowerCase()] ?? full);
}

function normalizeText(input: string): string {
  return decodeEntities(input)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function dedupeById(list: ParsedTelegramMessage[]): ParsedTelegramMessage[] {
  const seen = new Set<number>();
  const out: ParsedTelegramMessage[] = [];
  for (const m of list) {
    if (seen.has(m.messageId)) continue;
    seen.add(m.messageId);
    out.push(m);
  }
  return out;
}
