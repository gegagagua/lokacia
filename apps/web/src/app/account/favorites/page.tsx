import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { getNames } from '@/components/portal/data';
import { FavoritesBoard } from '@/components/portal/favorites/favorites-board';

export const metadata: Metadata = { title: 'ფავორიტები', robots: { index: false, follow: false } };

export default async function FavoritesPage() {
  const user = await getSession();
  if (!user) redirect('/login?next=/account/favorites');
  const t = await getTranslations('favorites');
  const { typeNames } = await getNames();
  return (
    <div>
      <h1 className="text-h2 font-semibold md:text-h1">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('subtitle')}</p>
      <FavoritesBoard typeNames={typeNames} />
    </div>
  );
}
