'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@lokacia/ui';

export default function ErrorPage({ error, retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  const t = useTranslations('home.errors');
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="drawing-grid min-h-[60dvh] border-b border-border" role="alert">
      <div className="container-page py-16">
        <p className="compact text-display font-semibold text-danger tabular" aria-hidden>
          500
        </p>
        <h1 className="text-h2 font-semibold md:text-h1">{t('errorTitle')}</h1>
        <p className="mt-3 max-w-lg text-muted">{t('errorLead')}</p>
        {error.digest && <p className="mt-2 text-small text-muted tabular">{t('code', { digest: error.digest })}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => (retry ?? reset)?.()}>{t('retry')}</Button>
          <Button asChild variant="secondary">
            <Link href="/">{t('home')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
