import { Suspense } from 'react';
import { DocumentsView } from '@/components/documents/documents-view';

export const metadata = { title: 'დოკუმენტები' };

export default function DocumentsPage() {
  return (
    <Suspense>
      <DocumentsView />
    </Suspense>
  );
}
