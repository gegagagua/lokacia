import type { Metadata } from 'next';
import { OwnerReportsView } from '@/components/marketing/owner-reports-view';

export const metadata: Metadata = { title: 'მესაკუთრის რეპორტები' };

export default function OwnerReportsPage() {
  return <OwnerReportsView />;
}
