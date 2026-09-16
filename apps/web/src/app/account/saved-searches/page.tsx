import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { getTranslations } from 'next-intl/server';
import type { SavedSearchDto } from '@lokacia/contracts';
import { api } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { getNames } from '@/components/portal/data';
import { AccountPageHeader } from '@/components/account/page-header';
import Link from '@/i18n/link';
import { Search } from 'lucide-react';
import { Button } from '@lokacia/ui';
import { SavedSearchesList } from '@/components/portal/search/saved-searches-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('alerts.meta');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function SavedSearchesPage() {
  const session = await getSession();
  if (!session) redirect(localizePath('/login?next=/account/saved-searches', await getAppLocale()));
  const t = await getTranslations('alerts');
  const tn = await getTranslations('account.dashboard');
  const [items, names] = await Promise.all([api<SavedSearchDto[]>('/v1/saved-searches'), getNames()]);
  return (
    <div>
      <AccountPageHeader
        title={t('heading')}
        description={t('subtitle')}
        actions={
          <Button asChild variant="secondary">
            <Link href="/search">
              <Search className="size-4" strokeWidth={2} aria-hidden />
              {tn('search')}
            </Link>
          </Button>
        }
      />
      <div>
        <SavedSearchesList initial={items} typeNames={names.typeNames} districtNames={names.districtNames} />
      </div>
    </div>
  );
}
