'use client';

/**
 * Client-side context stack for the whole app:
 *
 * - ThemeProvider (next-themes) — light, sepia and dark palettes in `app/globals.css`.
 * - AudioProvider — narration playback. It sits *above* the router content so a devotional keeps
 *   being read aloud while the reader moves between pages, and `PlayerDock` renders the control
 *   that goes with it.
 * - QueryClientProvider + AuthProvider — only the Worker-backed screens (account, admin,
 *   newsletter) use them; the blog content is rendered on the server from Markdown.
 *
 * - Site-wide reader features that need no server: reading settings sync, keyboard shortcuts,
 *   back-to-top, the offline banner and the service worker / install prompt (`PwaProvider`).
 *
 * Keeping this in one client component means `app/layout.tsx` stays a server component.
 */

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/auth/AuthProvider';
import { AudioProvider, useAudio } from '@/components/audio/AudioProvider';
import { PlayerDock } from '@/components/audio/PlayerDock';
import { BackToTop } from '@/components/common/BackToTop';
import { KeyboardShortcuts } from '@/components/common/KeyboardShortcuts';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { PwaProvider } from '@/components/pwa/PwaProvider';
import { ReadingPrefsSync } from '@/components/reader/ReadingPrefsSync';

/**
 * Toasts live bottom-right, which is exactly where the player dock sits once something is being
 * read aloud — so they are lifted above it while it is open, and only then.
 */
function AppToaster() {
  const { script, status } = useAudio();
  const docked = Boolean(script) && status !== 'idle' && status !== 'unsupported';
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      offset={docked ? '7rem' : '1.5rem'}
      mobileOffset={docked ? '7rem' : '1rem'}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              // Never hammer the API on client errors; one gentle retry for blips.
              const status = (error as { status?: number })?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={['light', 'sepia', 'dark']}
      disableTransitionOnChange
    >
      <AudioProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {children}
            <PlayerDock />
            <AppToaster />
            <ReadingPrefsSync />
            <KeyboardShortcuts />
            <BackToTop />
            <OfflineBanner />
            <PwaProvider />
          </AuthProvider>
        </QueryClientProvider>
      </AudioProvider>
    </ThemeProvider>
  );
}
