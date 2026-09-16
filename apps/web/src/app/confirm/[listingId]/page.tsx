import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { LivenessCheckInfo } from '@lokacia/contracts';
import { api } from '@/lib/api-server';
import { ConfirmLiveness, ConfirmInvalid } from '@/components/account/listings/confirm-liveness';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('myListings.confirm');
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ listingId: string }>; searchParams: Promise<{ token?: string }> }) {
  const { listingId } = await params;
  const { token } = await searchParams;
  let info: LivenessCheckInfo | null = null;
  if (token && /^[0-9a-f-]{36}$/i.test(listingId)) {
    info = await api<LivenessCheckInfo>(`/v1/liveness/checks/${listingId}?token=${encodeURIComponent(token)}`, { auth: false }).catch(() => null);
  }
  return (
    <div className="drawing-grid min-h-[70dvh] py-8 sm:py-14">
      <div className="container-page flex justify-center">{info && token ? <ConfirmLiveness info={info} token={token} /> : <ConfirmInvalid />}</div>
    </div>
  );
}
