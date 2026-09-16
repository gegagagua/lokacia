import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getBusinessTypes } from '@/lib/taxonomy';
import { requireSession } from '@/components/account/require-session';
import { OfferThreadView } from '@/components/account/offers/offer-thread';

export const metadata: Metadata = { title: 'მოლაპარაკება', robots: { index: false, follow: false } };

export default async function OfferThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/account/offers/${id}`);
  const t = await getTranslations('offers.thread');
  const types = await getBusinessTypes().catch(() => []);
  return (
    <>
      <nav className="mb-3 text-small">
        <Link href="/account/offers" className="text-link underline-offset-4 hover:underline">
          ← {t('back')}
        </Link>
      </nav>
      <OfferThreadView id={id} businessTypes={types.map((b) => ({ slug: b.slug, nameKa: b.nameKa }))} />
    </>
  );
}
