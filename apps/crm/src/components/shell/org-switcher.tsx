'use client';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn, Popover } from '@lokacia/ui';
import { useCrm } from '@/lib/crm-context';

function OrgMark({ name, color, size = 36, logo }: { name: string; color?: string | null; size?: number; logo?: string | null }) {
  if (logo)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={size} height={size} className="shrink-0 rounded-[10px] border border-border bg-surface object-contain" style={{ width: size, height: size }} />;
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[10px] font-bold text-white shadow-xs"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `linear-gradient(135deg, ${color ?? 'var(--primary-500)'}, color-mix(in srgb, ${color ?? 'var(--primary-500)'} 70%, #000))` }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Switch between agencies the user belongs to; selection persists (cookie) and scopes every API call. */
export function OrgSwitcher({ variant = 'compact', collapsed }: { variant?: 'compact' | 'sidebar'; collapsed?: boolean }) {
  const t = useTranslations('shell');
  const { user, org, role, switchOrg, workspace } = useCrm();
  const brand = workspace?.org.brandColor ?? null;
  const logo = workspace?.org.logoUrl ?? null;

  const trigger =
    variant === 'sidebar' ? (
      collapsed ? (
        <button type="button" className="mx-auto grid size-11 place-items-center rounded-xl hover:bg-surface-2 focus-visible:shadow-ring focus-visible:outline-none" aria-label={`${t('org.switch')}: ${org.name}`} title={org.name}>
          <OrgMark name={org.name} color={brand} logo={logo} size={34} />
        </button>
      ) : (
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-2.5 text-left shadow-xs transition-all duration-200 hover:border-border-strong hover:shadow-sm focus-visible:shadow-ring focus-visible:outline-none"
          aria-label={`${t('org.switch')}: ${org.name}`}
        >
          <OrgMark name={org.name} color={brand} logo={logo} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold leading-5">{org.name}</span>
            <span className="block truncate text-[12.5px] leading-4 text-muted">
              {t(`roles.${role}`)}
              {workspace?.org.plan ? ` · ${workspace.org.plan.toUpperCase()}` : ''}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
        </button>
      )
    ) : (
      <button type="button" className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface pl-1 pr-2 shadow-xs hover:bg-surface-2" aria-label={`${t('org.switch')}: ${org.name}`}>
        <OrgMark name={org.name} color={brand} logo={logo} size={30} />
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
      </button>
    );

  return (
    <Popover align={variant === 'sidebar' ? 'start' : 'end'} className="w-72 p-1.5" trigger={trigger}>
      <div className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">{t('org.switch')}</div>
      <ul role="listbox" aria-label={t('org.switch')} className="flex flex-col gap-0.5">
        {user.orgs.map((o) => {
          const current = o.id === org.id;
          return (
            <li key={o.id} role="option" aria-selected={current}>
              <button
                type="button"
                onClick={() => !current && switchOrg(o.id)}
                className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2', current && 'bg-primary-soft/60')}
              >
                <OrgMark name={o.name} color={current ? brand : null} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{o.name}</span>
                  <span className="block text-[12.5px] text-muted">{t(`roles.${o.role}`)}</span>
                </span>
                {current && <Check className="size-4 text-primary" strokeWidth={2.4} aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
