import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { getBusinessTypes } from '@/lib/taxonomy';
import { requireSession } from '@/components/account/require-session';
import { OfferThreadView } from '@/components/account/offers/offer-thread';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('negotiation'), robots: { index: false, follow: false } };
}

export default async function OfferThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/account/offers/${id}`);
  const t = await getTranslations('offers.thread');
  const types = await getBusinessTypes().catch(() => []);
  return (
    <>
      <nav className="mb-3 text-small font-medium">
        <Link href="/account/offers" className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-muted shadow-xs ring-1 ring-border transition-colors hover:text-text">
          <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
          {t('back')}
        </Link>
      </nav>
      <OfferThreadView id={id} businessTypes={types.map((b) => ({ slug: b.slug, nameKa: b.nameKa }))} />
    </>
  );
}
