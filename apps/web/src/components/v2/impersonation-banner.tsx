import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { StopImpersonationButton } from './stop-impersonation-button';

/** Shown on every page while an admin is acting as another user. */
export async function ImpersonationBanner() {
  const session = await getSession();
  if (!session?.impersonatorId) return null;
  const t = await getTranslations('v2.impersonation');
  return (
    <div role="status" className="border-b-2 border-accent bg-accent/15">
      <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2 text-small">
        <span>{t('text', { name: session.name ?? session.phone ?? '—' })}</span>
        <StopImpersonationButton label={t('stop')} />
      </div>
    </div>
  );
}
