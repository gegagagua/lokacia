import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/components/account/require-session';
import { AccountPageHeader } from '@/components/account/page-header';
import { OffersInbox } from '@/components/account/offers/offers-inbox';

export const metadata: Metadata = { title: 'შეთავაზებები', robots: { index: false, follow: false } };

export default async function OffersPage() {
  await requireSession('/account/offers');
  const t = await getTranslations('offers.inbox');
  return (
    <>
      <AccountPageHeader title={t('title')} description={t('description')} />
      <OffersInbox />
    </>
  );
}
