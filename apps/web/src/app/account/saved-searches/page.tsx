import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { SavedSearchDto } from '@lokacia/contracts';
import { api } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { getNames } from '@/components/portal/data';
import { SavedSearchesList } from '@/components/portal/search/saved-searches-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('alerts.meta');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function SavedSearchesPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/account/saved-searches');
  const t = await getTranslations('alerts');
  const [items, names] = await Promise.all([api<SavedSearchDto[]>('/v1/saved-searches'), getNames()]);
  return (
    <div className="container-page py-8">
      <h1 className="text-h2 font-semibold md:text-h1">{t('heading')}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t('subtitle')}</p>
      <div className="mt-6">
        <SavedSearchesList initial={items} typeNames={names.typeNames} districtNames={names.districtNames} />
      </div>
    </div>
  );
}
