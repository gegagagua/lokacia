import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { getNames } from '@/components/portal/data';
import { AccountPageHeader } from '@/components/account/page-header';
import { FavoritesBoard } from '@/components/portal/favorites/favorites-board';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('favorites'), robots: { index: false, follow: false } };
}

export default async function FavoritesPage() {
  const user = await getSession();
  if (!user) redirect(localizePath('/login?next=/account/favorites', await getAppLocale()));
  const t = await getTranslations('favorites');
  const { typeNames } = await getNames();
  return (
    <div>
      <AccountPageHeader title={t('title')} description={t('subtitle')} />
      <div className="[&>*:first-child]:mt-0">
        <FavoritesBoard typeNames={typeNames} />
      </div>
    </div>
  );
}
