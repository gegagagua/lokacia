import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ListingDetail } from '@lokacia/contracts';
import { requireSession } from '@/components/account/require-session';
import { ListingWizard } from '@/components/account/wizard/listing-wizard';
import { api, ApiError } from '@/lib/api-server';
import { getBusinessTypes } from '@/lib/taxonomy';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('wizard');
  return { title: t('titleEdit'), robots: { index: false, follow: false } };
}

export default async function EditListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const { step } = await searchParams;
  const user = (await requireSession(`/account/listings/${id}/edit`))!;
  let detail: ListingDetail & { canManage?: boolean; rejectReason?: string | null };
  try {
    detail = await api<ListingDetail & { canManage?: boolean }>(`/v1/listings/${encodeURIComponent(id)}?track=0`);
  } catch (e) {
    if (e instanceof ApiError && [400, 403, 404, 422].includes(e.status)) notFound();
    throw e;
  }
  if (!detail.canManage) notFound();
  if (detail.status === 'rejected') {
    const mine = await api<{ id: string; rejectReason: string | null }[]>('/v1/listings/mine?status=rejected').catch(() => []);
    detail.rejectReason = mine.find((m) => m.id === detail.id)?.rejectReason ?? null;
  }
  const types = await getBusinessTypes();
  return <ListingWizard user={user} types={types.map((b) => ({ slug: b.slug, nameKa: b.nameKa, filterConfig: b.filterConfig }))} detail={detail} initialStep={step} />;
}
