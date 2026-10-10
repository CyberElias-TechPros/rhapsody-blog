import type { Metadata } from 'next';
import { AccountScreen } from '@/components/screens/AccountScreen';
import { getAllSummaries } from '@/lib/content';

export const metadata: Metadata = {
  title: 'My library',
  description: 'Your saved devotionals and account settings.',
  robots: { index: false, follow: false },
};

/**
 * Not gated: saved devotionals live in this browser and need no account. The account panel
 * inside only appears once a Worker session exists.
 */
export default function AccountPage() {
  return <AccountScreen posts={getAllSummaries()} />;
}
