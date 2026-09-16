'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExternalLink, LogOut, Settings, UserRound } from 'lucide-react';
import { Popover } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { PersonAvatar } from '@/components/common/ui';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

const itemCls = 'flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left text-[14px] font-medium transition-colors hover:bg-surface-2';

export function UserMenu() {
  const t = useTranslations('shell');
  const { user, role } = useCrm();
  return (
    <Popover
      align="end"
      className="w-72 p-1.5"
      trigger={
        <button type="button" className="rounded-full ring-2 ring-transparent transition-all hover:ring-border-strong focus-visible:shadow-ring focus-visible:outline-none" aria-label={t('user.menu')}>
          <PersonAvatar src={user.avatarUrl} name={user.name ?? user.phone} size={36} />
        </button>
      }
    >
      <div className="mb-1 flex items-center gap-3 rounded-xl bg-surface-2 p-3">
        <PersonAvatar src={user.avatarUrl} name={user.name ?? user.phone} size={40} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{user.name ?? user.phone}</div>
          <div className="truncate text-[12.5px] text-muted tabular">
            {user.phone} · {t(`roles.${role}`)}
          </div>
        </div>
      </div>
      <Link href="/settings/profile" className={itemCls}>
        <UserRound className="size-4 text-muted" strokeWidth={2} aria-hidden />
        {t('user.profile')}
      </Link>
      <Link href="/settings" className={itemCls}>
        <Settings className="size-4 text-muted" strokeWidth={2} aria-hidden />
        {t('nav.settings')}
      </Link>
      <a href={APP_URL} className={itemCls}>
        <ExternalLink className="size-4 text-muted" strokeWidth={2} aria-hidden />
        {t('user.portal')}
      </a>
      <div className="my-1 h-px bg-border" aria-hidden />
      <button
        type="button"
        onClick={async () => {
          await apiFetch('/auth/logout', { method: 'POST', noOrg: true }).catch(() => undefined);
          window.location.href = '/login';
        }}
        className={`${itemCls} text-danger`}
      >
        <LogOut className="size-4" strokeWidth={2} aria-hidden />
        {t('user.logout')}
      </button>
    </Popover>
  );
}
