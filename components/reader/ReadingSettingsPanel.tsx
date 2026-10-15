'use client';

/**
 * Reading settings: text size, typeface, line spacing, column width, colour theme and the Bible
 * translation scripture links open in. Saved on the device and applied to every devotional.
 */

import { useTheme } from 'next-themes';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalStore } from '@/hooks/useLocalStore';
import { PREFERRED_VERSIONS, type BibleVersion } from '@/lib/bible';
import {
  COLUMN_WIDTHS,
  DEFAULT_PREFS,
  LINE_SPACINGS,
  READING_FONTS,
  TEXT_SIZES,
  prefsStore,
  type ReadingPrefs,
} from '@/lib/reader-data';
import { cn } from '@/lib/utils';

const SIZE_LABEL: Record<ReadingPrefs['size'], { label: string; sample: string }> = {
  sm: { label: 'Small', sample: 'text-sm' },
  md: { label: 'Medium', sample: 'text-base' },
  lg: { label: 'Large', sample: 'text-lg' },
  xl: { label: 'Extra large', sample: 'text-xl' },
};

const FONT_LABEL: Record<ReadingPrefs['font'], { label: string; className: string; hint: string }> = {
  serif: { label: 'Serif', className: 'font-serif', hint: 'The printed look' },
  sans: { label: 'Sans', className: 'font-sans', hint: 'Clean, on screen' },
  legible: { label: 'Legible', className: 'font-sans tracking-wide', hint: 'Designed for low vision' },
};

const SPACING_LABEL: Record<ReadingPrefs['leading'], string> = { normal: 'Normal', relaxed: 'Relaxed', loose: 'Loose' };
const WIDTH_LABEL: Record<ReadingPrefs['width'], string> = { narrow: 'Narrow', normal: 'Normal', wide: 'Wide' };

const THEMES = [
  { id: 'light', label: 'Light', swatch: 'bg-[#fbf7f1] border-[#e7dccb]' },
  { id: 'sepia', label: 'Sepia', swatch: 'bg-[#efe3cc] border-[#d8c6a5]' },
  { id: 'dark', label: 'Dark', swatch: 'bg-[#1d1610] border-[#3a2d22]' },
  { id: 'system', label: 'Auto', swatch: 'bg-gradient-to-br from-[#fbf7f1] from-50% to-[#1d1610] to-50% border-[#c9b9a3]' },
] as const;

function Segmented<T extends string>({
  label,
  value,
  options,
  render,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  render: (option: T) => React.ReactNode;
  onChange: (option: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</legend>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={cn(
              'rounded-lg border px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              value === option ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-secondary'
            )}
          >
            {render(option)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ReadingSettingsPanel({ className }: { className?: string }) {
  const prefs = useLocalStore(prefsStore);
  const { theme, setTheme } = useTheme();
  const set = <K extends keyof ReadingPrefs>(key: K, value: ReadingPrefs[K]) => prefsStore.update((p) => ({ ...p, [key]: value }));

  return (
    <div className={cn('space-y-5', className)}>
      <Segmented
        label="Text size"
        value={prefs.size}
        options={TEXT_SIZES}
        onChange={(v) => set('size', v)}
        render={(v) => (
          <span className="flex flex-col items-center leading-none">
            <span className={cn('font-serif font-semibold', SIZE_LABEL[v].sample)} aria-hidden="true">
              Aa
            </span>
            <span className="sr-only">{SIZE_LABEL[v].label}</span>
          </span>
        )}
      />
      <Segmented
        label="Typeface"
        value={prefs.font}
        options={READING_FONTS}
        onChange={(v) => set('font', v)}
        render={(v) => (
          <span className="flex flex-col items-center gap-0.5">
            <span className={FONT_LABEL[v].className}>{FONT_LABEL[v].label}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">{FONT_LABEL[v].hint}</span>
          </span>
        )}
      />
      <Segmented label="Line spacing" value={prefs.leading} options={LINE_SPACINGS} onChange={(v) => set('leading', v)} render={(v) => SPACING_LABEL[v]} />
      <Segmented label="Column width" value={prefs.width} options={COLUMN_WIDTHS} onChange={(v) => set('width', v)} render={(v) => WIDTH_LABEL[v]} />

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Theme</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              aria-pressed={theme === option.id}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                theme === option.id ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-secondary'
              )}
            >
              <span className={cn('h-5 w-5 rounded-full border', option.swatch)} aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="bible-version" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Bible translation for scripture links
        </label>
        <select
          id="bible-version"
          value={prefs.version}
          onChange={(e) => set('version', e.target.value as BibleVersion)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {PREFERRED_VERSIONS.map((version) => (
            <option key={version} value={version}>
              {version}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted-foreground">References in each devotional open on BibleGateway in this translation.</p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">Saved on this device.</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            prefsStore.write(DEFAULT_PREFS);
            setTheme('system');
          }}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> Reset
        </Button>
      </div>
    </div>
  );
}
