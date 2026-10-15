'use client';

/**
 * "Install the app" — captured once for the whole app.
 *
 * Chrome, Edge, Samsung Internet and other Chromium browsers fire `beforeinstallprompt` when the
 * site is installable (manifest + service worker + icons). The event is stashed so an "Install"
 * button anywhere can show the browser's own prompt later. Safari on iOS has no such event; the
 * UI explains "Share → Add to Home Screen" instead.
 */

import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

let started = false;
/** Called once from `PwaProvider` on mount. */
export function startInstallCapture(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  // The inline head script in app/layout.tsx stashes a prompt that fired before hydration.
  const early = (window as Window & { __rhapsodyInstallPrompt?: BeforeInstallPromptEvent }).__rhapsodyInstallPrompt;
  if (early) {
    deferred = early;
    notify();
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const event = deferred;
  deferred = null;
  notify();
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome;
}

export interface InstallState {
  /** The browser will show its install prompt on request. */
  canPrompt: boolean;
  /** Already running as an installed app (or just installed). */
  standalone: boolean;
  /** iPhone/iPad Safari: install is manual, through the Share menu. */
  ios: boolean;
}

const SERVER_STATE: InstallState = { canPrompt: false, standalone: false, ios: false };
let snapshot: InstallState = SERVER_STATE;

function read(): InstallState {
  const standalone =
    installed ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
  const next = { canPrompt: Boolean(deferred), standalone: Boolean(standalone), ios };
  if (next.canPrompt !== snapshot.canPrompt || next.standalone !== snapshot.standalone || next.ios !== snapshot.ios) snapshot = next;
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, read, () => SERVER_STATE);
}
