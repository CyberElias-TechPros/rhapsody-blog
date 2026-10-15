/**
 * Verse cards drawn on a `<canvas>` in the browser — no server, no upload. Sized for a WhatsApp or
 * Instagram status (9:16), a feed post (4:5) or a square, in three colourways.
 *
 * The text is auto-fitted: the largest size at which the whole verse fits the card wins, so a
 * one-line confession is set large and a long passage still fits without being cut off.
 */

export type VerseFormat = 'story' | 'portrait' | 'square';
export type VerseTheme = 'ember' | 'night' | 'paper';

export const VERSE_FORMATS: Record<VerseFormat, { label: string; width: number; height: number }> = {
  story: { label: 'Status · 9:16', width: 1080, height: 1920 },
  portrait: { label: 'Post · 4:5', width: 1080, height: 1350 },
  square: { label: 'Square · 1:1', width: 1080, height: 1080 },
};

export const VERSE_THEMES: Record<VerseTheme, { label: string; ink: string; soft: string; accent: string }> = {
  ember: { label: 'Ember', ink: '#fff8ec', soft: 'rgba(255,248,236,0.78)', accent: '#fdba74' },
  night: { label: 'Night', ink: '#f5ede0', soft: 'rgba(245,237,224,0.7)', accent: '#f59e0b' },
  paper: { label: 'Paper', ink: '#2a1a0c', soft: 'rgba(42,26,12,0.68)', accent: '#b45309' },
};

export interface VerseCardOptions {
  text: string;
  reference?: string;
  /** Small line at the top, e.g. "Rhapsody of Realities". */
  heading: string;
  /** Date or label under the heading. */
  subheading?: string;
  /** Bottom line, e.g. the site's host name. */
  footer: string;
  format: VerseFormat;
  theme: VerseTheme;
}

const SERIF = 'Fraunces, Georgia, "Times New Roman", serif';
const SANS = 'Inter, "Segoe UI", Roboto, Arial, sans-serif';

/** Greedy word wrap against the context's current font. */
export function wrapText(measure: (text: string) => number, text: string, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest font size (stepping down) at which `text` fits the box. */
export function fitText(
  measureAt: (size: number) => (text: string) => number,
  text: string,
  box: { width: number; height: number },
  sizes: { max: number; min: number; lineHeight: number }
): { size: number; lines: string[] } {
  for (let size = sizes.max; size >= sizes.min; size -= 2) {
    const lines = wrapText(measureAt(size), text, box.width);
    if (lines.length * size * sizes.lineHeight <= box.height) return { size, lines };
  }
  const size = sizes.min;
  const lines = wrapText(measureAt(size), text, box.width);
  const maxLines = Math.max(1, Math.floor(box.height / (size * sizes.lineHeight)));
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,;:.]+$/, '')}…`;
  }
  return { size, lines };
}

function paintBackground(ctx: CanvasRenderingContext2D, theme: VerseTheme, width: number, height: number) {
  if (theme === 'paper') {
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, '#fbf5ea');
    g.addColorStop(1, '#ecdcc0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, width, height);
  if (theme === 'night') {
    g.addColorStop(0, '#120d09');
    g.addColorStop(1, '#2d1f13');
  } else {
    g.addColorStop(0, '#2f1606');
    g.addColorStop(0.45, '#6b2a0b');
    g.addColorStop(1, '#b45309');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.85, height * 0.08, 0, width * 0.85, height * 0.08, width * 0.75);
  glow.addColorStop(0, theme === 'night' ? 'rgba(245,158,11,0.22)' : 'rgba(253,186,116,0.45)');
  glow.addColorStop(1, 'rgba(253,186,116,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function paintBook(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, ink: string) {
  const s = size / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  // `roundRect` is Safari 16+/Firefox 112+; a square tile is a fine fallback.
  if (typeof ctx.roundRect === 'function') ctx.roundRect(0, 0, 64, 64, 14);
  else ctx.rect(0, 0, 64, 64);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fill(new Path2D('M13 19.5c6.4-3.2 12.6-3.2 18.2 0v27c-5.6-3.2-11.8-3.2-18.2 0z'));
  ctx.globalAlpha = 0.82;
  ctx.fill(new Path2D('M51 19.5c-6.4-3.2-12.6-3.2-18.2 0v27c5.6-3.2 11.8-3.2 18.2 0z'));
  ctx.restore();
}

/** Make sure the web fonts are ready before measuring — otherwise the fallback's metrics are used. */
async function fontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`600 64px ${SERIF}`),
        document.fonts.load(`italic 400 64px ${SERIF}`),
        document.fonts.load(`500 32px ${SANS}`),
        document.fonts.load(`700 32px ${SANS}`),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

export async function renderVerseCard(options: VerseCardOptions): Promise<HTMLCanvasElement> {
  await fontsReady();
  const { width, height } = VERSE_FORMATS[options.format];
  const colours = VERSE_THEMES[options.theme];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  paintBackground(ctx, options.theme, width, height);

  const margin = 96;
  // Header: mark + series + date.
  paintBook(ctx, margin, margin, 84, colours.ink);
  ctx.fillStyle = colours.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 44px ${SERIF}`;
  ctx.fillText(options.heading, margin + 110, margin + 42);
  if (options.subheading) {
    ctx.fillStyle = colours.soft;
    ctx.font = `500 30px ${SANS}`;
    ctx.fillText(options.subheading, margin + 110, margin + 84);
  }

  // Footer.
  ctx.fillStyle = colours.soft;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText(options.footer, margin, height - margin);

  // Body: an opening quote mark, the verse auto-fitted, then the reference.
  const top = margin + 190;
  const bottomReserve = margin + 150;
  const boxHeight = height - top - bottomReserve;
  const boxWidth = width - margin * 2;
  const measureAt = (size: number) => {
    ctx.font = `italic 400 ${size}px ${SERIF}`;
    return (text: string) => ctx.measureText(text).width;
  };
  const quote = `“${options.text.replace(/^[“"]+|[”"]+$/g, '').trim()}”`;
  const { size, lines } = fitText(measureAt, quote, { width: boxWidth, height: boxHeight - (options.reference ? 90 : 0) }, {
    // Short verses are set big (a status is read at arm's length); long passages step down to fit.
    max: options.format === 'story' ? 104 : options.format === 'portrait' ? 86 : 76,
    min: 30,
    lineHeight: 1.36,
  });
  const lineHeight = size * 1.36;
  const blockHeight = lines.length * lineHeight + (options.reference ? 90 : 0);
  let y = top + Math.max(0, (boxHeight - blockHeight) / 2) + size;

  ctx.fillStyle = colours.ink;
  ctx.font = `italic 400 ${size}px ${SERIF}`;
  for (const line of lines) {
    ctx.fillText(line, margin, y);
    y += lineHeight;
  }

  if (options.reference) {
    ctx.fillStyle = colours.accent;
    ctx.fillRect(margin, y - size * 0.35, 64, 5);
    ctx.font = `700 38px ${SANS}`;
    ctx.fillStyle = colours.ink;
    ctx.fillText(options.reference, margin + 88, y - size * 0.35 + 14);
  }

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), 'image/png');
  });
}
