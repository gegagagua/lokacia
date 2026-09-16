import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button, SpacePlan } from '@lokacia/ui';

export default async function ListingNotFound() {
  const t = await getTranslations('listing.notFound');
  return (
    <div className="drawing-grid">
      <div className="container-page flex flex-col items-center gap-6 py-20 text-center">
        <div className="w-64 opacity-60">
          <SpacePlan compact areaM2={0.1} widthM={4} depthM={3} title={t('title')} />
        </div>
        <h1 className="text-h2 font-semibold">{t('title')}</h1>
        <p className="max-w-md text-muted">{t('text')}</p>
        <Button asChild>
          <Link href="/search">{t('search')}</Link>
        </Button>
      </div>
    </div>
  );
}
