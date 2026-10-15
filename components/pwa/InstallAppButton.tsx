'use client';

import { useState } from 'react';
import { CheckCircle2, Download, Share, SquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { promptInstall, useInstallState } from '@/components/pwa/install';

/**
 * "Install the app": the browser's own prompt where there is one (Android, Chrome, Edge), the
 * Share → Add to Home Screen steps on iPhone and iPad, and a quiet confirmation once installed.
 * `fallback` renders where the browser offers neither (e.g. desktop Firefox).
 */
export function InstallAppButton({
  size = 'sm',
  variant = 'outline',
  fallback = null,
  className,
}: {
  size?: 'sm' | 'default' | 'lg';
  variant?: 'outline' | 'default' | 'secondary' | 'ghost';
  fallback?: React.ReactNode;
  className?: string;
}) {
  const { canPrompt, standalone, ios } = useInstallState();
  const [iosOpen, setIosOpen] = useState(false);

  if (standalone) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground ${className ?? ''}`}>
        <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden="true" /> App installed
      </span>
    );
  }

  if (canPrompt) {
    return (
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={async () => {
          const outcome = await promptInstall();
          if (outcome === 'accepted') toast.success('Installed — find Rhapsody on your home screen.');
        }}
      >
        <Download className="w-4 h-4 mr-1.5" aria-hidden="true" /> Install the app
      </Button>
    );
  }

  if (ios) {
    return (
      <>
        <Button type="button" size={size} variant={variant} className={className} onClick={() => setIosOpen(true)}>
          <SquarePlus className="w-4 h-4 mr-1.5" aria-hidden="true" /> Add to Home Screen
        </Button>
        <Dialog open={iosOpen} onOpenChange={setIosOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Install on iPhone or iPad</DialogTitle>
              <DialogDescription>Three taps in Safari, and today’s devotional opens like an app.</DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">1</span>
                <span>
                  Tap the <Share className="inline w-4 h-4 -mt-0.5" aria-label="Share" /> Share button in Safari’s toolbar.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">2</span>
                <span>
                  Scroll and choose <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">3</span>
                <span>
                  Tap <strong>Add</strong>. The icon opens straight to today’s devotional.
                </span>
              </li>
            </ol>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return <>{fallback}</>;
}
