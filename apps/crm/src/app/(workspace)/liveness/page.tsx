import type { Metadata } from 'next';
import { LivenessView } from '@/components/marketing/liveness-view';

export const metadata: Metadata = { title: 'აქტუალობის კონტროლი' };

export default function LivenessPage() {
  return <LivenessView />;
}
