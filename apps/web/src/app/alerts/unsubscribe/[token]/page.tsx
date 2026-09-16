import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BellOff } from 'lucide-react';
import { Button, EmptyState } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
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
    <div className="drawing-grid min-h-[60dvh] py-12">
      <div className="container-page flex justify-center">
        <div className="w-full max-w-lg rounded-card border border-border bg-surface p-6 md:p-8">
          {!info ? (
            <EmptyState title={t('heading')} description={t('notFound')} action={<Button asChild variant="secondary"><Link href="/account/saved-searches">{t('manage')}</Link></Button>} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid size-12 place-items-center rounded-full border border-border-strong text-muted">
                <BellOff className="size-5" strokeWidth={1.5} aria-hidden />
              </div>
              <h1 className="text-h2 font-semibold">{t('heading')}</h1>
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
