import type { Metadata } from 'next';
import { ProfileForm } from '@/components/marketing/profile-form';

export const metadata: Metadata = { title: 'ბროკერის პროფილი' };

export default function ProfileSettingsPage() {
  return <ProfileForm />;
}
