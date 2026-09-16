import type { Metadata } from 'next';
import { ListingsView } from '@/components/listings/listings-view';

export const metadata: Metadata = { title: 'ფართები' };

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <ListingsView initialStatus={status ?? ''} />;
}
