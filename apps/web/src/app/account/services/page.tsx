import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { ServicesDashboard } from '@/components/portal/services/services-dashboard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('services'), robots: { index: false, follow: false } };
}

export default async function AccountServicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getSession();
  if (!user) redirect(localizePath('/login?next=/account/services', await getAppLocale()));
  const { tab } = await searchParams;
  const t = await getTranslations('services.orders');
  return (
    <div>
      <h1 className="text-h2 font-semibold md:text-h1">{t('title')}</h1>
      <ServicesDashboard initialTab={tab === 'provider' ? 'provider' : 'mine'} />
    </div>
  );
}
