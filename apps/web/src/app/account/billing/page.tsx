import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { BillingDashboard } from './billing-dashboard';

export const metadata: Metadata = { title: 'გადახდები და ანგარიშები', robots: { index: false, follow: false } };

export default async function AccountBillingPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/account/billing');
  const t = await getTranslations('billing.account');
  return (
    <div>
      <h1 className="text-h1 font-semibold">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('subtitle')}</p>
      <BillingDashboard />
    </div>
  );
}
