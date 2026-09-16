import { getTranslations } from 'next-intl/server';
import { UserCog } from 'lucide-react';
import { getSession } from '@/lib/session';
import { StopImpersonationButton } from './stop-impersonation-button';

/** Shown on every page while an admin is acting as another user. */
export async function ImpersonationBanner() {
  const session = await getSession();
  if (!session?.impersonatorId) return null;
  const t = await getTranslations('v2.impersonation');
  return (
    <div role="status" className="relative z-40 bg-[repeating-linear-gradient(135deg,#f0bd3a_0_14px,#e2aa1c_14px_28px)] text-[#17201d]">
      <div className="container-page flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
        <span className="inline-flex min-w-0 items-center gap-2.5 rounded-full bg-[#fff8e6]/90 py-1 pl-1 pr-3 text-small font-semibold shadow-xs">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#17201d] text-[#f0bd3a]">
            <UserCog className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0">{t('text', { name: session.name ?? session.phone ?? '—' })}</span>
        </span>
        <StopImpersonationButton label={t('stop')} />
      </div>
    </div>
  );
}
