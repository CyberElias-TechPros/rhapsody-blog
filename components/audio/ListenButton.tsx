'use client';

/**
 * The "Listen" control.
 *
 * A server page builds the spoken script (`devotionalScript(post)` in `lib/tts.ts`) and hands it
 * down as a plain prop, so nothing has to be fetched before playback can start. The button then
 * does one of two things: start this article, or — when it is already the one being read — act as
 * the play/pause for it, so a reader who scrolls back to the top always finds the control that
 * matches what they hear.
 *
 * A script that was stopped part-way through is offered as a resume rather than a restart, which
 * is the difference between a listen feature people use and one they abandon at paragraph four.
 */

import { Headphones, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SpokenScript } from '@/lib/tts';
import { cn } from '@/lib/utils';
import { useAudio, useResumeIndex } from './AudioProvider';

interface ListenButtonProps {
  script: SpokenScript;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** `icon` renders the headphone glyph alone, for cards and tight rows. */
  shape?: 'button' | 'icon';
  className?: string;
  /** "Listen", unless the caller wants something else ("Listen to today's devotional"). */
  label?: string;
  /** Show "· 4 min" after the label. */
  showDuration?: boolean;
  /** `data-shortcut` hook for `KeyboardShortcuts` (the article page's main button uses `listen`). */
  shortcut?: string;
}

export function ListenButton({
  script,
  variant = 'outline',
  size = 'default',
  shape = 'button',
  className,
  label,
  showDuration = false,
  shortcut,
}: ListenButtonProps) {
  const { script: current, status, play, toggle } = useAudio();
  const isCurrent = current?.href === script.href;
  const active = isCurrent && (status === 'playing' || status === 'loading');
  const paused = isCurrent && status === 'paused';

  // The resume point is read from the store rather than in an effect, so the label is right on the
  // first client paint (see `useResumeIndex`). While this article is the one playing, the button
  // toggles instead of offering a resume, so the stored index is not what it should show.
  const stored = useResumeIndex(script.href);
  const resumeAt = isCurrent ? null : stored;

  const onClick = () => {
    if (isCurrent) {
      toggle();
      return;
    }
    play(script, resumeAt ?? 0);
  };

  if (shape === 'icon') {
    return (
      <Button
        type="button"
        variant={variant}
        size="icon"
        onClick={onClick}
        className={cn('relative z-10', className)}
        aria-label={active ? `Pause “${script.title}”` : `Listen to “${script.title}”`}
        aria-pressed={active}
        title={active ? 'Pause' : paused ? 'Resume listening' : resumeAt ? 'Resume listening' : 'Listen'}
      >
        {active ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Headphones className="w-4 h-4" aria-hidden="true" />}
      </Button>
    );
  }

  const text = active ? 'Pause' : paused ? 'Resume' : resumeAt ? 'Resume listening' : (label ?? 'Listen');

  return (
    <Button type="button" variant={variant} size={size} onClick={onClick} className={cn('gap-2', className)} data-shortcut={shortcut}>
      {active ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
      <span>
        {text}
        {showDuration && script.minutes > 0 && (
          <span className="ml-1.5 text-xs opacity-70 tabular-nums">· {script.minutes} min</span>
        )}
      </span>
    </Button>
  );
}
