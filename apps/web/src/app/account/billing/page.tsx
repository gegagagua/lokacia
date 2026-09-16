import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { AccountPageHeader } from '@/components/billing/page-parts';
import { BillingDashboard } from './billing-dashboard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('billing'), robots: { index: false, follow: false } };
}

export default async function AccountBillingPage() {
  const session = await getSession();
  if (!session) redirect(localizePath('/login?next=/account/billing', await getAppLocale()));
  const t = await getTranslations('billing.account');
  return (
    <div>
      <AccountPageHeader icon={CreditCard} title={t('title')} subtitle={t('subtitle')} />
      <BillingDashboard />
    </div>
  );
}
