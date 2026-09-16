import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ListingStatsDto } from '@lokacia/contracts';
import { apiOrNull } from '@/lib/api-server';
import { requireSession } from '@/components/account/require-session';
import { ListingStats } from '@/components/account/stats/listing-stats';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('stats');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ListingStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/account/listings/${id}/stats`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const initial = await apiOrNull<ListingStatsDto>(`/v1/stats/listings/${id}?days=30`);
  if (!initial) notFound();
  return <ListingStats listingId={id} initial={initial} />;
}
