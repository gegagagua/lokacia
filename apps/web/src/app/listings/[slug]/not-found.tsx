import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { Search } from 'lucide-react';
import { Button, SpacePlan } from '@lokacia/ui';

export default async function ListingNotFound() {
  const t = await getTranslations('listing.notFound');
  return (
    <div className="container-page py-16 md:py-24">
      <div className="card mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-12 text-center md:px-12">
        <div className="drawing-grid w-full max-w-72 rounded-2xl border border-border p-4 opacity-80">
          <SpacePlan compact areaM2={0.1} widthM={4} depthM={3} title={t('title')} />
        </div>
        <span className="eyebrow">404</span>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight md:text-h2">{t('title')}</h1>
        <p className="max-w-md text-[17px] text-muted">{t('text')}</p>
        <Button asChild size="lg">
          <Link href="/search">
            <Search className="size-4" strokeWidth={2} aria-hidden />
            {t('search')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
