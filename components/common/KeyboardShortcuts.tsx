'use client';

/**
 * Keyboard shortcuts for readers on a computer. Press `?` to see them.
 *
 * Shortcuts act on elements that opt in with `data-shortcut="…"` (the previous/next day links,
 * the save, listen and focus buttons), so this component never needs to know which page it is
 * on, and a shortcut whose target is absent does nothing. Keys are ignored while typing in a
 * field and when a modifier other than Shift is held, so browser shortcuts keep working.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SHORTCUTS: Array<{ keys: string[]; action: string }> = [
  { keys: ['←', 'P'], action: 'Previous day' },
  { keys: ['→', 'N'], action: 'Next day' },
  { keys: ['T'], action: 'Today’s devotional' },
  { keys: ['/'], action: 'Search' },
  { keys: ['L'], action: 'Listen / pause' },
  { keys: ['S'], action: 'Save to my library' },
  { keys: ['M'], action: 'Mark as read' },
  { keys: ['F'], action: 'Focus mode' },
  { keys: ['A'], action: 'Reading settings' },
  { keys: ['R'], action: 'A random devotional' },
  { keys: ['?'], action: 'Show these shortcuts' },
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function click(shortcut: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-shortcut="${shortcut}"]`);
  if (!el) return false;
  el.click();
  return true;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      // An open dialog or menu owns the keyboard.
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"]')) return;
      const key = event.key;
      let handled = true;
      switch (key) {
        case 'ArrowLeft':
        case 'p':
          handled = click('prev');
          break;
        case 'ArrowRight':
        case 'n':
          handled = click('next');
          break;
        case 't':
          router.push('/today');
          break;
        case '/': {
          const input = document.querySelector<HTMLInputElement>('input[data-shortcut="search"]');
          if (input && input.offsetParent !== null) input.focus();
          else router.push('/search');
          break;
        }
        case 'l':
          handled = click('listen');
          break;
        case 's':
          handled = click('save');
          break;
        case 'm':
          handled = click('read');
          break;
        case 'f':
          handled = click('focus');
          break;
        case 'a':
          handled = click('settings');
          break;
        case 'r':
          router.push('/random');
          break;
        case '?':
          setHelpOpen(true);
          break;
        default:
          handled = false;
      }
      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
            <Keyboard className="w-5 h-5 text-primary" aria-hidden="true" /> Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>Work anywhere on the site, except while you are typing.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.action} className="contents">
              <dt className="flex gap-1">
                {shortcut.keys.map((k) => (
                  <kbd key={k} className="min-w-[1.75rem] rounded-md border border-border bg-secondary px-1.5 py-0.5 text-center font-sans text-xs font-semibold">
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{shortcut.action}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
