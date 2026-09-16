import { Suspense } from 'react';
import type { Metadata } from 'next';
import { InboxScreen } from '@/components/inbox/inbox-screen';

export const metadata: Metadata = { title: 'შეტყობინებები' };

export default function InboxPage() {
  return (
    <Suspense>
      <InboxScreen />
    </Suspense>
  );
}
