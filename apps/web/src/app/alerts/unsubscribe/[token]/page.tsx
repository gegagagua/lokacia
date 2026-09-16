import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { BellOff } from 'lucide-react';
import { Button, EmptyState } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
import { HeroGlow } from '@/components/portal/page-hero';
import { UnsubscribeButton } from '@/components/portal/search/unsubscribe-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('alerts.meta');
  return { title: t('unsubscribeTitle'), robots: { index: false, follow: false } };
}

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('alerts.unsubscribe');
  const info = await apiOrNull<{ name: string; active: boolean }>(`/v1/saved-searches/unsubscribe/${encodeURIComponent(token)}`, { auth: false });
  return (
    <div className="relative isolate min-h-[70dvh] overflow-hidden py-16 md:py-24">
      <HeroGlow variant="page" />
      <div className="container-page flex justify-center">
        <div className="card w-full max-w-lg p-6 shadow-lg md:p-10">
          {!info ? (
            <EmptyState className="border-0 py-6" title={t('heading')} description={t('notFound')} action={<Button asChild variant="secondary"><Link href="/account/saved-searches">{t('manage')}</Link></Button>} />
          ) : (
            <div className="flex flex-col gap-4">
              <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text">
                <BellOff className="size-6" strokeWidth={2} aria-hidden />
              </span>
              <p className="eyebrow self-start">{t('eyebrow')}</p>
              <h1 className="-mt-1 text-[30px] font-bold leading-[38px] tracking-tight">{t('heading')}</h1>
              {info.active ? (
                <>
                  <p className="text-muted">{t('text', { name: info.name })}</p>
                  <UnsubscribeButton token={token} />
                </>
              ) : (
                <>
                  <p className="text-muted">{t('already')}</p>
                  <Button asChild variant="secondary" className="self-start">
                    <Link href="/account/saved-searches">{t('manage')}</Link>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
