import type { Metadata } from 'next';
import { SequencesScreen } from '@/components/sequences/sequences-screen';

export const metadata: Metadata = { title: 'ავტომატური შეტყობინებები' };

export default function SequencesPage() {
  return <SequencesScreen />;
}
