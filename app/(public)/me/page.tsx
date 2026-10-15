import type { Metadata } from 'next';
import { BookHeart } from 'lucide-react';
import { PageHeader } from '@/components/common/StateBlocks';
import { MyRhapsody } from '@/components/me/MyRhapsody';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'My Rhapsody',
  description: 'Your reading streak, notes, history, Bible-plan progress and settings — stored on this device, no account needed.',
  path: '/me',
  // Per-device and private: never indexed, never competing with the content it links to.
  index: false,
});

export default function MyRhapsodyPage() {
  return (
    <div className="container py-12 md:py-16 max-w-6xl">
      <PageHeader
        eyebrow="Yours, on this device"
        title={
          <span className="inline-flex items-center gap-3">
            <BookHeart className="w-9 h-9 text-primary" aria-hidden="true" /> My Rhapsody
          </span>
        }
        subtitle="Your streak, notes, reading history and settings. Nothing here is uploaded — it lives in this browser until you delete it."
      />
      <MyRhapsody />
    </div>
  );
}
