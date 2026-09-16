import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { Button, SpacePlan } from '@lokacia/ui';

export default async function NotFound() {
  const t = await getTranslations('home.errors');
  return (
    <section className="drawing-grid min-h-[60dvh] border-b border-border">
      <div className="container-page grid items-center gap-10 py-16 md:grid-cols-2">
        <div>
          <p className="compact text-display font-semibold text-muted tabular" aria-hidden>
            404
          </p>
          <h1 className="text-h2 font-semibold md:text-h1">{t('notFoundTitle')}</h1>
          <p className="mt-3 max-w-md text-muted">{t('notFoundLead')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/search">{t('search')}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">{t('home')}</Link>
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm rounded-card border border-dashed border-border-strong bg-surface p-6" aria-hidden>
          <SpacePlan areaM2={16} widthM={4} depthM={4} compact title="" />
        </div>
      </div>
    </section>
  );
}
