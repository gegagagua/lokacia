import type { Metadata } from 'next';
import { PresentationsView } from '@/components/marketing/presentations-view';

export const metadata: Metadata = { title: 'პრეზენტაციები' };

export default async function PresentationsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: openNew } = await searchParams;
  return <PresentationsView openNew={openNew === '1'} />;
}
