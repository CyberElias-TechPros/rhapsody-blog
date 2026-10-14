import type { Metadata } from 'next';
import { Library } from 'lucide-react';
import { PageHeader } from '@/components/common/StateBlocks';
import { AdSlot } from '@/components/common/AdSlot';
import { SavedLibrary } from '@/components/library/SavedLibrary';

export const metadata: Metadata = {
  title: 'My library',
  description:
    'The devotionals, books and kids’ issues you have saved on this device — no account, nothing uploaded.',
  alternates: { canonical: '/library' },
  // A private, per-device page: it must never be indexed or compete with the content it links to.
  robots: { index: false, follow: true },
};

/**
 * The shelf the bookmark button has been promising.
 *
 * Saving has always been local and sign-in-free (`hooks/useSavedPosts.ts`), but until now the only
 * way to see what you had saved was the account screen — which needs an account, and the whole
 * point of local saving is that it does not. This page reads the same store, so the promise on the
 * button is kept whether or not the reader ever signs in.
 */
export default function LibraryPage() {
  return (
    <div className="container py-16 md:py-20 max-w-5xl">
      <PageHeader
        eyebrow="Yours, on this device"
        title={
          <span className="inline-flex items-center gap-3">
            <Library className="w-8 h-8 text-primary" aria-hidden="true" /> My library
          </span>
        }
        subtitle="Every devotional, book and kids’ issue you tapped the bookmark on. Saved here on your device — no account, no sync, nothing uploaded anywhere."
      />

      <div className="mt-10">
        <SavedLibrary />
      </div>

      <AdSlot position="page" className="mt-16" />
    </div>
  );
}
