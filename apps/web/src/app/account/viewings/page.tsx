import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/components/account/require-session';
import { AccountPageHeader } from '@/components/account/page-header';
import { ViewingsBoard } from '@/components/account/viewings/viewings-board';

export const metadata: Metadata = { title: 'ჩვენებები', robots: { index: false, follow: false } };

export default async function ViewingsPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  await requireSession('/account/viewings');
  const { v } = await searchParams;
  const t = await getTranslations('viewings.board');
  return (
    <>
      <AccountPageHeader title={t('title')} description={t('description')} />
      <ViewingsBoard highlightId={v ?? null} />
    </>
  );
}
