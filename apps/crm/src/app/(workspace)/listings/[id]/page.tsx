import type { Metadata } from 'next';
import { ListingDetailView } from '@/components/listings/listing-detail';

export const metadata: Metadata = { title: 'ფართი' };

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <ListingDetailView id={id} tab={tab} />;
}
