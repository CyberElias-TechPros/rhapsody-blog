/**
 * Social-card artwork (1200 × 630), rendered by `next/og` at build time.
 *
 * A shared devotional is how this site travels — a link pasted into a WhatsApp group, a status,
 * a Facebook post — and the preview card is the first thing anyone sees. Until now every page
 * shared the same stock image (left over from an earlier project, under another name). Each
 * devotional now gets its own card: the series, the date, the day's title and its opening
 * scripture, which is exactly what a reader scrolling a group chat needs to decide to tap.
 *
 * Satori (the renderer behind `next/og`) supports a subset of CSS: every element with more than
 * one child needs `display: flex`, and fonts must be supplied as TTF/OTF/WOFF. The WOFF files in
 * `assets/fonts` are Fraunces and Inter (SIL Open Font License), the site's own two families.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { stripTrailingReference } from '@/lib/bible';

export const OG_SIZE = { width: 1200, height: 630 } as const;

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: 'normal' | 'italic' };

let fontsPromise: Promise<OgFont[]> | null = null;

/** Loaded once per build worker, not once per image. */
export function loadOgFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    const load = async (file: string) => {
      const buffer = await readFile(path.join(FONT_DIR, file));
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    };
    fontsPromise = Promise.all([
      load('fraunces-latin-600-normal.woff').then((data) => ({ name: 'Fraunces', data, weight: 600 as const, style: 'normal' as const })),
      load('fraunces-latin-400-italic.woff').then((data) => ({ name: 'Fraunces', data, weight: 400 as const, style: 'italic' as const })),
      load('inter-latin-500-normal.woff').then((data) => ({ name: 'Inter', data, weight: 500 as const, style: 'normal' as const })),
      load('inter-latin-700-normal.woff').then((data) => ({ name: 'Inter', data, weight: 700 as const, style: 'normal' as const })),
    ]);
  }
  return fontsPromise;
}

const CREAM = '#fff8ec';

/**
 * Strip characters the bundled Latin fonts cannot draw. `next/og` would otherwise try to fetch a
 * fallback font from the network for them, and builds run offline.
 */
export function ogSafe(text: string): string {
  return (text ?? '')
    .normalize('NFC')
    .replace(/[^\u0020-\u024F\u2010-\u2027\u2030-\u205E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clipText(text: string, max: number): string {
  const clean = ogSafe(text);
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(' ', max - 1);
  return `${clean.slice(0, cut > max * 0.6 ? cut : max - 1).replace(/[\s,;:.–—-]+$/, '')}…`;
}

function BookMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill={CREAM} fillOpacity="0.16" />
      <path d="M13 19.5c6.4-3.2 12.6-3.2 18.2 0v27c-5.6-3.2-11.8-3.2-18.2 0z" fill={CREAM} />
      <path d="M51 19.5c-6.4-3.2-12.6-3.2-18.2 0v27c5.6-3.2 11.8-3.2 18.2 0z" fill={CREAM} fillOpacity="0.82" />
    </svg>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '54px 64px',
        color: CREAM,
        fontFamily: 'Inter',
        backgroundColor: '#5a2a0c',
        backgroundImage:
          'radial-gradient(circle at 88% 8%, rgba(253, 186, 116, 0.55) 0%, rgba(253, 186, 116, 0) 45%), linear-gradient(135deg, #2f1606 0%, #6b2a0b 45%, #b45309 100%)',
      }}
    >
      {children}
    </div>
  );
}

export interface DevotionalCardProps {
  series: string;
  audienceLine: string;
  dateLine: string;
  title: string;
  scripture?: string;
  reference?: string;
  host: string;
}

export function DevotionalOgCard({ series, audienceLine, dateLine, title, scripture, reference, host }: DevotionalCardProps) {
  const safeTitle = clipText(title, 90);
  const titleSize = safeTitle.length <= 28 ? 78 : safeTitle.length <= 48 ? 66 : 56;
  const quote = scripture ? clipText(stripTrailingReference(scripture), 150) : '';

  return (
    <Frame>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BookMark size={60} />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 18 }}>
            <span style={{ fontFamily: 'Fraunces', fontWeight: 600, fontSize: 32 }}>{ogSafe(series)}</span>
            <span style={{ fontSize: 19, opacity: 0.8, marginTop: 2 }}>{ogSafe(audienceLine)}</span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            padding: '10px 20px',
            borderRadius: 999,
            backgroundColor: 'rgba(255, 248, 236, 0.14)',
            border: '1px solid rgba(255, 248, 236, 0.28)',
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {ogSafe(dateLine)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontFamily: 'Fraunces', fontWeight: 600, fontSize: titleSize, lineHeight: 1.07, letterSpacing: -1 }}>
          {safeTitle}
        </div>
        {quote ? (
          <div style={{ display: 'flex', marginTop: 26, fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 27, lineHeight: 1.38, opacity: 0.9 }}>
            {`“${quote}”${reference ? ` — ${ogSafe(reference)}` : ''}`}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 21, opacity: 0.85 }}>
        <span>Daily devotional by Pastor Chris Oyakhilome · Read · Listen · Share</span>
        <span style={{ fontWeight: 700 }}>{ogSafe(host)}</span>
      </div>
    </Frame>
  );
}

/** The site-wide card: used by every page that has no card of its own. */
export function SiteOgCard({ host }: { host: string }) {
  const chips = ['Today’s devotional', 'TeeVo for teens', 'Early Readers', 'Kids', 'Bible reading plan'];
  return (
    <Frame>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <BookMark size={64} />
        <span style={{ marginLeft: 18, fontSize: 24, opacity: 0.85 }}>Daily devotional · Pastor Chris Oyakhilome</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontFamily: 'Fraunces', fontWeight: 600, fontSize: 104, lineHeight: 1, letterSpacing: -2 }}>
          Rhapsody of Realities
        </div>
        <div style={{ display: 'flex', marginTop: 22, fontSize: 32, opacity: 0.92 }}>
          Today’s devotional — read it, listen to it, share it.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 30 }}>
          {chips.map((chip) => (
            <div
              key={chip}
              style={{
                display: 'flex',
                marginRight: 12,
                marginBottom: 10,
                padding: '8px 18px',
                borderRadius: 999,
                backgroundColor: 'rgba(255, 248, 236, 0.14)',
                border: '1px solid rgba(255, 248, 236, 0.28)',
                fontSize: 22,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 21, opacity: 0.8 }}>
        <span>Independent reader site · free, no account needed</span>
        <span style={{ fontWeight: 700 }}>{ogSafe(host)}</span>
      </div>
    </Frame>
  );
}
