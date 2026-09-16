import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { PropertyOverviewView } from './property-overview';

export const metadata: Metadata = { title: 'ქონების მართვა', robots: { index: false, follow: false } };

export default async function PropertyPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/account/property');
  const t = await getTranslations('property');
  return (
    <div>
      <h1 className="text-h1 font-semibold">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('subtitle')}</p>
      <PropertyOverviewView />
    </div>
  );
}
