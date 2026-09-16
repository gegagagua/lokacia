import type { Metadata } from 'next';
import { DuplicatesView } from '@/components/contacts/duplicates-view';

export const metadata: Metadata = { title: 'დუბლიკატები' };

export default function DuplicatesPage() {
  return <DuplicatesView />;
}
