'use client';

/**
 * The always-available player: a dock pinned to the bottom of the viewport while something is
 * being read aloud.
 *
 * It is rendered by `AudioProvider`'s host in the root layout, not by an article, because
 * playback outlives the page that started it — a reader can walk from today's devotional to the
 * library and back without the audio stopping or the control disappearing. Everything else about
 * it is ordinary: one play/pause, a step back and forward through the article's sections, a
 * progress bar that is accurate to the sentence being spoken, and the rate and voice pickers.
 *
 * When nothing is loaded it renders only a zero-height spacer, so pages do not need to reserve
 * room for a player that may never appear.
 */

import { Pause, Play, SkipBack, SkipForward, Square, Volume2, Waves } from 'lucide-react';
import { RATES } from '@/lib/tts';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAudio, useSortedVoices } from './AudioProvider';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  loading: 'Loading the narration',
  playing: 'Reading aloud',
  paused: 'Paused',
  ended: 'Finished',
  error: 'Playback stopped',
};

export function PlayerDock() {
  const {
    script,
    status,
    index,
    sections,
    progress,
    sectionLabel,
    rate,
    engine,
    error,
    studioAvailable,
    toggle,
    next,
    previous,
    stop,
    seek,
    setRate,
    setVoice,
    setEngine,
    voiceURI,
  } = useAudio();
  const voices = useSortedVoices();

  const open = Boolean(script) && status !== 'idle' && status !== 'unsupported';

  if (!open || !script) {
    // Keeps the document flow identical whether or not a player is up.
    return <div aria-hidden="true" className="h-0" />;
  }

  const playing = status === 'playing' || status === 'loading';
  const pct = Math.round(progress * 100);

  return (
    <>
      {/* Spacer: the dock is fixed, so the page needs its height back or it covers the footer. */}
      <div aria-hidden="true" className="h-20 md:h-[4.5rem]" />

      <div
        role="region"
        aria-label="Devotional audio player"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 backdrop-blur-xl shadow-elegant"
      >
        {/* Clickable progress: a listener who wants the prayer can jump without counting sections. */}
        <div
          className="h-1 w-full bg-secondary cursor-pointer group"
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
            seek(Math.min(sections - 1, Math.floor(ratio * sections)));
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') seek(Math.min(sections - 1, index + 1));
            if (event.key === 'ArrowLeft') seek(Math.max(0, index - 1));
          }}
          role="progressbar"
          tabIndex={0}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Narration progress: ${pct}% — ${sectionLabel}`}
        >
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-glow transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="container flex items-center gap-3 py-2.5">
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={previous}
              disabled={index === 0}
              aria-label="Previous section"
            >
              <SkipBack className="w-4 h-4" aria-hidden="true" />
            </Button>

            <Button
              size="icon"
              className="h-11 w-11 rounded-full gradient-hero text-primary-foreground border-0 shadow-glow"
              onClick={toggle}
              aria-label={playing ? 'Pause the reading' : 'Read this article aloud'}
            >
              {playing ? <Pause className="w-5 h-5" aria-hidden="true" /> : <Play className="w-5 h-5 ml-0.5" aria-hidden="true" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={next}
              disabled={index >= sections - 1}
              aria-label="Next section"
            >
              <SkipForward className="w-4 h-4" aria-hidden="true" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hidden sm:inline-flex"
              onClick={stop}
              aria-label="Stop and close the player"
            >
              <Square className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-sm font-semibold leading-tight">
              <a href={script.href} className="hover:text-primary transition-colors">
                {script.title}
              </a>
            </p>
            <p className="truncate text-xs text-muted-foreground" aria-live="polite">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : (
                <>
                  {STATUS_LABEL[status] ?? 'Ready'}
                  {sectionLabel ? ` · ${sectionLabel}` : ''}
                  {sections > 1 ? ` (${index + 1} of ${sections})` : ''}
                  {script.subtitle ? ` · ${script.subtitle}` : ''}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Studio voices only exist when a key is configured; the toggle is hidden otherwise. */}
            {studioAvailable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-xs" aria-label="Choose a voice engine">
                    {engine === 'studio' ? <Waves className="w-3.5 h-3.5" aria-hidden="true" /> : <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />}
                    <span className="hidden sm:inline">{engine === 'studio' ? 'Studio' : 'Device'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Voice</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => setEngine('browser')}>
                    <Volume2 className="w-4 h-4 mr-2" aria-hidden="true" /> This device
                    <span className="ml-auto text-xs text-muted-foreground">free</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEngine('studio')}>
                    <Waves className="w-4 h-4 mr-2" aria-hidden="true" /> Studio narration
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-12 px-0 text-xs tabular-nums" aria-label="Playback speed">
                  {rate}×
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuLabel>Speed</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {RATES.map((value) => (
                  <DropdownMenuItem key={value} onSelect={() => setRate(value)} className={cn(value === rate && 'text-primary font-medium')}>
                    {value}×{value === 1 && <span className="ml-auto text-xs text-muted-foreground">normal</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* A native select: some systems offer forty voices, and a menu that long is unusable. */}
            {engine === 'browser' && voices.length > 1 && (
              <label className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="sr-only">Narration voice</span>
                <select
                  value={voiceURI ?? ''}
                  onChange={(event) => setVoice(event.target.value || null)}
                  className="max-w-[10rem] h-9 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Default voice</option>
                  {voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:hidden"
              onClick={stop}
              aria-label="Stop and close the player"
            >
              <Square className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
