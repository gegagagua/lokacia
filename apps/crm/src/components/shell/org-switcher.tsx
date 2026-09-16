'use client';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn, Popover } from '@lokacia/ui';
import { useCrm } from '@/lib/crm-context';

/** Switch between agencies the user belongs to; selection persists (cookie) and scopes every API call. */
export function OrgSwitcher() {
  const t = useTranslations('shell');
  const { user, org, role, switchOrg, workspace } = useCrm();
  const brand = workspace?.org.brandColor ?? undefined;
  return (
    <Popover
      align="end"
      className="w-72 p-1"
      trigger={
        <button type="button" className="flex h-9 max-w-[220px] items-center gap-2 rounded-button border border-border bg-surface px-2.5 text-small hover:bg-surface-2" aria-label={t('org.switch')}>
          <span className="size-2.5 shrink-0 rounded-[2px] border border-border-strong" style={{ background: brand ?? 'var(--primary)' }} aria-hidden />
          <span className="hidden truncate font-medium sm:inline">{org.name}</span>
          <span className="hidden whitespace-nowrap text-muted xl:inline">· {t(`roles.${role}`)}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
        </button>
      }
    >
      <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">{t('org.switch')}</div>
      <ul role="listbox" aria-label={t('org.switch')}>
        {user.orgs.map((o) => (
          <li key={o.id} role="option" aria-selected={o.id === org.id}>
            <button
              type="button"
              onClick={() => o.id !== org.id && switchOrg(o.id)}
              className={cn('flex w-full items-center gap-2 rounded-button px-2 py-2 text-left hover:bg-surface-2', o.id === org.id && 'bg-surface-2')}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{o.name}</span>
                <span className="block text-small text-muted">{t(`roles.${o.role}`)}</span>
              </span>
              {o.id === org.id && <Check className="size-4 text-primary" strokeWidth={1.5} aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
