import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { LeaseDetailView } from './lease-detail';

export const metadata: Metadata = { title: 'იჯარის დეტალები', robots: { index: false, follow: false } };

export default async function LeasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/account/property/leases/${id}`);
  return (
    <div>
      <LeaseDetailView id={id} />
    </div>
  );
}
