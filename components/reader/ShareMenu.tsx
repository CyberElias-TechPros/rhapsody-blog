'use client';

/**
 * Share a devotional the ways readers actually share it: the phone's share sheet, WhatsApp,
 * Telegram, Facebook, X, email or SMS; a copied link; the *whole* devotional as a WhatsApp-ready
 * message; or a verse image for a status. No SDKs or tracking scripts — every option is a plain
 * share-intent link or the browser's own API.
 */

import { useState } from 'react';
import { ClipboardCopy, ImageIcon, Link2, Mail, MessageCircle, MessageSquare, Send, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VerseImageDialog, type VerseSource } from '@/components/reader/VerseImageDialog';
import { useHydrated } from '@/hooks/useLocalStore';
import { navigateTo } from '@/lib/browser';
import { shareUrl, type ShareTarget } from '@/lib/share-text';

/** Placeholder the server leaves in `fullText`; replaced with the real absolute URL on click. */
export const SHARE_URL_TOKEN = '__SHARE_URL__';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / insecure contexts: a hidden textarea and execCommand.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const TARGETS: Array<{ id: ShareTarget; label: string; icon: typeof Send }> = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'facebook', label: 'Facebook', icon: Share2 },
  { id: 'x', label: 'X (Twitter)', icon: Share2 },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'Text message', icon: MessageSquare },
];

export function ShareMenu({
  path,
  title,
  teaser,
  fullText,
  verses = [],
  imageHeading,
  imageSubheading,
  fileStem,
  size = 'sm',
}: {
  /** Site-relative URL of the page being shared. */
  path: string;
  title: string;
  /** One paragraph for social posts. */
  teaser: string;
  /** The whole devotional, WhatsApp-formatted, with `SHARE_URL_TOKEN` where the link goes. */
  fullText?: string;
  verses?: VerseSource[];
  imageHeading?: string;
  imageSubheading?: string;
  fileStem?: string;
  size?: 'sm' | 'default';
}) {
  const hydrated = useHydrated();
  const [imageOpen, setImageOpen] = useState(false);
  const canNativeShare = hydrated && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const url = () => `${window.location.origin}${path}`;

  const open = (target: ShareTarget) => {
    const href = shareUrl(target, { url: url(), text: teaser, title });
    if (target === 'email' || target === 'sms') {
      navigateTo(href);
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: teaser, url: url() });
    } catch {
      /* dismissed */
    }
  };

  const copyLink = async () => {
    if (await copyText(url())) toast.success('Link copied');
    else window.prompt('Copy this link:', url());
  };

  const copyAll = async () => {
    if (!fullText) return;
    const text = fullText.split(SHARE_URL_TOKEN).join(url());
    if (await copyText(text)) {
      toast.success('Devotional copied', { description: 'Paste it into WhatsApp, Telegram or a message — formatting included.' });
    } else {
      toast.error('Could not copy on this browser.');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} data-shortcut="share">
            <Share2 className="w-4 h-4 mr-2" aria-hidden="true" /> Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Share this devotional</DropdownMenuLabel>
          {canNativeShare && (
            <DropdownMenuItem onSelect={nativeShare} className="gap-2">
              <Share2 className="w-4 h-4" aria-hidden="true" /> Share via…
            </DropdownMenuItem>
          )}
          {TARGETS.map(({ id, label, icon: Icon }) => (
            <DropdownMenuItem key={id} onSelect={() => open(id)} className="gap-2">
              <Icon className="w-4 h-4" aria-hidden="true" /> {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={copyLink} className="gap-2">
            <Link2 className="w-4 h-4" aria-hidden="true" /> Copy link
          </DropdownMenuItem>
          {fullText && (
            <DropdownMenuItem onSelect={copyAll} className="gap-2">
              <ClipboardCopy className="w-4 h-4" aria-hidden="true" />
              <span className="flex flex-col">
                Copy full devotional
                <span className="text-[11px] text-muted-foreground">WhatsApp-ready, with the link</span>
              </span>
            </DropdownMenuItem>
          )}
          {verses.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setImageOpen(true)} className="gap-2">
                <ImageIcon className="w-4 h-4" aria-hidden="true" />
                <span className="flex flex-col">
                  Create a verse image
                  <span className="text-[11px] text-muted-foreground">For your status or a post</span>
                </span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {verses.length > 0 && imageOpen && (
        <VerseImageDialog
          open={imageOpen}
          onOpenChange={setImageOpen}
          sources={verses}
          heading={imageHeading ?? 'Rhapsody of Realities'}
          subheading={imageSubheading ?? ''}
          fileStem={fileStem ?? 'rhapsody-of-realities'}
        />
      )}
    </>
  );
}
