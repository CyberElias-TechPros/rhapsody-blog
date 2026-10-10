import type { Metadata } from 'next';
import { RegisterScreen } from '@/components/screens/RegisterScreen';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create an account to manage your newsletter digest and the admin console.',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <RegisterScreen />;
}
