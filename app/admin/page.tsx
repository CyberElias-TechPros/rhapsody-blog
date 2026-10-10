import type { Metadata } from 'next';
import { RequireRole } from '@/auth/RequireRole';
import { AdminScreen } from '@/components/screens/AdminScreen';

export const metadata: Metadata = {
  title: 'Admin',
  description: 'Worker API administration: channel sync, content moderation, subscribers, users and audit log.',
  robots: { index: false, follow: false },
};

/**
 * Client-side gate for UX; the Worker enforces every privileged call. The admin console
 * manages the *Worker's* own data (Telegram-synced posts, subscribers, users) — the published
 * devotionals are static Markdown and are edited by re-running `npm run content:extract`.
 */
export default function AdminPage() {
  return (
    <RequireRole roles={['editor', 'admin']}>
      <AdminScreen />
    </RequireRole>
  );
}
