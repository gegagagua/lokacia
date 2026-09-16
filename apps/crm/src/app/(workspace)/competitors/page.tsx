import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/common/page-header';
import { CompetitorsTable } from '@/components/marketing/competitors-table';

export const metadata: Metadata = { title: 'კონკურენტების მონიტორინგი' };

export default async function CompetitorsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const t = await getTranslations('marketing.competitors');
  const { new: openNew } = await searchParams;
  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <CompetitorsTable openAdd={openNew === '1'} />
    </div>
  );
}
