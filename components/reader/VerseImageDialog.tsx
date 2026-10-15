'use client';

/**
 * "Create a verse image": the day's opening scripture (or its prayer/confession) as a picture
 * for a WhatsApp status, Instagram story or feed post. Drawn on a canvas in the browser; shared
 * through the phone's share sheet when it accepts files, downloaded otherwise.
 */

import { useEffect, useRef, useState } from 'react';
import { Download, ImageIcon, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  VERSE_FORMATS,
  VERSE_THEMES,
  canvasToBlob,
  renderVerseCard,
  type VerseFormat,
  type VerseTheme,
} from '@/lib/verse-image';
import { cn } from '@/lib/utils';

export interface VerseSource {
  id: string;
  label: string;
  text: string;
  reference?: string;
}

export function VerseImageDialog({
  open,
  onOpenChange,
  sources,
  heading,
  subheading,
  fileStem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: VerseSource[];
  heading: string;
  subheading: string;
  /** e.g. `rhapsody-of-realities-15-october-2026` */
  fileStem: string;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [format, setFormat] = useState<VerseFormat>('story');
  const [theme, setTheme] = useState<VerseTheme>('ember');
  // The last finished render and the options it was drawn with. "Busy" is derived — the shown
  // image belongs to other options — so the effect never has to set state synchronously.
  const [result, setResult] = useState<{ key: string; url: string; blob: Blob } | null>(null);
  const urls = useRef<string[]>([]);
  const source = sources.find((item) => item.id === sourceId) ?? sources[0];
  const key = `${source?.id ?? ''}|${format}|${theme}`;
  const busy = !result || result.key !== key;
  const preview = result?.url ?? null;

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    renderVerseCard({
      text: source.text,
      reference: source.reference,
      heading,
      subheading,
      footer: window.location.host,
      format,
      theme,
    })
      .then(canvasToBlob)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        setResult({ key: `${source.id}|${format}|${theme}`, url, blob });
      })
      .catch(() => {
        if (!cancelled) toast.error('This browser could not draw the image.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, source, format, theme, heading, subheading]);

  // Release every generated image when the dialog goes away.
  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const fileName = `${fileStem}-${source?.id ?? 'verse'}-${format}.png`;

  const download = () => {
    if (!preview) return;
    const a = document.createElement('a');
    a.href = preview;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const share = async () => {
    const blob = result?.blob;
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: heading, text: `${heading} — ${subheading}` });
        return;
      }
    } catch {
      return; // dismissed
    }
    download();
  };

  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
            <ImageIcon className="w-5 h-5 text-primary" aria-hidden="true" /> Create a verse image
          </DialogTitle>
          <DialogDescription>For your WhatsApp status, Instagram story or a post. Made on your device — nothing is uploaded.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_15rem]">
          <div className="grid place-items-center rounded-2xl border border-border bg-secondary/40 p-3 min-h-[18rem]">
            {preview ? (
              <img
                src={preview}
                alt={`Preview: ${source?.text ?? ''}`}
                className={cn('max-h-[58vh] w-auto rounded-xl shadow-soft transition-opacity', busy && 'opacity-60')}
              />
            ) : (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-label="Drawing the image" />
            )}
          </div>

          <div className="space-y-5">
            {sources.length > 1 && (
              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Text</legend>
                <div className="grid gap-1.5">
                  {sources.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={item.id === source?.id}
                      onClick={() => setSourceId(item.id)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        item.id === source?.id ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-secondary'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Size</legend>
              <div className="grid gap-1.5">
                {(Object.keys(VERSE_FORMATS) as VerseFormat[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={format === id}
                    onClick={() => setFormat(id)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      format === id ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-secondary'
                    )}
                  >
                    {VERSE_FORMATS[id].label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Colours</legend>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(VERSE_THEMES) as VerseTheme[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={theme === id}
                    onClick={() => setTheme(id)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-xs transition-colors',
                      theme === id ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-secondary'
                    )}
                  >
                    {VERSE_THEMES[id].label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-2">
              {canShareFiles && (
                <Button type="button" onClick={share} disabled={!preview || busy}>
                  <Share2 className="w-4 h-4 mr-2" aria-hidden="true" /> Share image
                </Button>
              )}
              <Button type="button" variant={canShareFiles ? 'outline' : 'default'} onClick={download} disabled={!preview || busy}>
                <Download className="w-4 h-4 mr-2" aria-hidden="true" /> Download PNG
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
