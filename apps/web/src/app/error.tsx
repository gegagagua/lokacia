'use client';
import { useEffect } from 'react';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { Home, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@lokacia/ui';
import { HeroGlow } from '@/components/portal/hero-glow';

export default function ErrorPage({ error, retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  const t = useTranslations('home.errors');
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="relative isolate min-h-[70dvh] overflow-hidden" role="alert">
      <HeroGlow variant="page" />
      <div className="container-page flex justify-center py-16 md:py-24">
        <div className="card w-full max-w-xl p-8 text-center shadow-lg md:p-12">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-danger/10 text-danger">
            <TriangleAlert className="size-8" strokeWidth={2} aria-hidden />
          </span>
          <p className="mt-5 text-small font-semibold text-danger tabular" aria-hidden>
            500
          </p>
          <h1 className="mt-1 text-[30px] font-bold leading-[38px] tracking-tight md:text-h2">{t('errorTitle')}</h1>
          <p className="mx-auto mt-3 max-w-md text-[17px] text-muted">{t('errorLead')}</p>
          {error.digest && <p className="mt-3 inline-block rounded-full bg-surface-2 px-3 py-1 text-small text-muted tabular">{t('code', { digest: error.digest })}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => (retry ?? reset)?.()} icon={<RotateCcw className="size-4" strokeWidth={2} aria-hidden />}>
              {t('retry')}
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/">
                <Home className="size-4" strokeWidth={2} aria-hidden />
                {t('home')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
