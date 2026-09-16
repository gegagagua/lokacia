import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Home } from 'lucide-react';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { AccountPageHeader } from '@/components/billing/page-parts';
import { PropertyOverviewView } from './property-overview';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('property'), robots: { index: false, follow: false } };
}

export default async function PropertyPage() {
  const session = await getSession();
  if (!session) redirect(localizePath('/login?next=/account/property', await getAppLocale()));
  const t = await getTranslations('property');
  return (
    <div>
      <AccountPageHeader icon={Home} title={t('title')} subtitle={t('subtitle')} />
      <PropertyOverviewView />
    </div>
  );
}
