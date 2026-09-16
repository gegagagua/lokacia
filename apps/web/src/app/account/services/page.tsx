import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { ServicesDashboard } from '@/components/portal/services/services-dashboard';

export const metadata: Metadata = { title: 'მომსახურებები', robots: { index: false, follow: false } };

export default async function AccountServicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getSession();
  if (!user) redirect('/login?next=/account/services');
  const { tab } = await searchParams;
  const t = await getTranslations('services.orders');
  return (
    <div>
      <h1 className="text-h2 font-semibold md:text-h1">{t('title')}</h1>
      <ServicesDashboard initialTab={tab === 'provider' ? 'provider' : 'mine'} />
    </div>
  );
}
