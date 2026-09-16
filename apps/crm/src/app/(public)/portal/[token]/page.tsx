import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { PortalView } from '@lokacia/contracts';
import { EmptyState, Logo } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
import { PortalClient } from './portal-client';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const t = await getTranslations('portal');
  const data = await apiOrNull<PortalView>(`/v1/crm/portal/${encodeURIComponent(token)}`, { auth: false });
  return { title: data ? `${t('metaTitle')} · ${data.org.name}` : t('metaTitle'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/** C8 client portal: public tokenized page (no login). */
export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('portal');
  const data = await apiOrNull<PortalView>(`/v1/crm/portal/${encodeURIComponent(token)}`, { auth: false });
  if (!data) {
    return (
      <div className="drawing-grid grid min-h-dvh place-items-center px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-5">
          <Logo />
          <EmptyState title={t('notFound')} description={t('notFoundHint')} className="w-full border-solid bg-surface shadow-md" />
        </div>
      </div>
    );
  }
  return <PortalClient token={token} initial={data} />;
}
