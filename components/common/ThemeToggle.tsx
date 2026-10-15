'use client';

import { BookOpen, Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'sepia', label: 'Sepia', icon: BookOpen },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'Match my device', icon: Monitor },
] as const;

/**
 * Light, sepia (paper-toned, for long reading) and dark palettes (app/globals.css), or follow the
 * device. `next-themes` resolves the stored theme after hydration, so `theme` is `undefined`
 * during SSR and the first client render; until then the moon icon renders, keeping server and
 * client HTML identical.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const current = theme === 'system' ? resolvedTheme : theme;
  const Icon = current === 'dark' ? Sun : current === 'sepia' ? BookOpen : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Colour theme" title="Colour theme">
          <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(({ id, label, icon: OptionIcon }) => (
          <DropdownMenuItem key={id} onSelect={() => setTheme(id)} className="gap-2">
            <OptionIcon className="w-4 h-4" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {theme === id && <Check className="w-4 h-4 text-primary" aria-label="Selected" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
