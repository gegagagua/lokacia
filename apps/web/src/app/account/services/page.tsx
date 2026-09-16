import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { AccountPageHeader } from '@/components/account/page-header';
import Link from '@/i18n/link';
import { Wrench } from 'lucide-react';
import { Button } from '@lokacia/ui';
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
  const tn = await getTranslations('account.nav');
  return (
    <div>
      <AccountPageHeader
        title={t('title')}
        actions={
          <Button asChild variant="secondary">
            <Link href="/services">
              <Wrench className="size-4" strokeWidth={2} aria-hidden />
              {tn('services')}
            </Link>
          </Button>
        }
      />
      <ServicesDashboard initialTab={tab === 'provider' ? 'provider' : 'mine'} />
    </div>
  );
}
