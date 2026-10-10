import type { Metadata } from 'next';
import { LoginScreen } from '@/components/screens/LoginScreen';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to manage your newsletter digest and the admin console.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginScreen />;
}
