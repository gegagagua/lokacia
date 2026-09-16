'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExternalLink, LogOut, UserRound } from 'lucide-react';
import { Avatar, Popover } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

export function UserMenu() {
  const t = useTranslations('shell');
  const { user, role } = useCrm();
  return (
    <Popover
      align="end"
      className="w-64 p-1"
      trigger={
        <button type="button" className="ml-1 rounded-full" aria-label={t('user.menu')}>
          <Avatar src={user.avatarUrl} name={user.name} size={32} />
        </button>
      }
    >
      <div className="border-b border-border px-3 py-2">
        <div className="truncate font-medium">{user.name ?? user.phone}</div>
        <div className="text-small text-muted tabular">
          {user.phone} · {t(`roles.${role}`)}
        </div>
      </div>
      <Link href="/settings/profile" className="flex items-center gap-2 rounded-button px-3 py-2 text-[14px] hover:bg-surface-2">
        <UserRound className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
        {t('user.profile')}
      </Link>
      <a href={APP_URL} className="flex items-center gap-2 rounded-button px-3 py-2 text-[14px] hover:bg-surface-2">
        <ExternalLink className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
        {t('user.portal')}
      </a>
      <button
        type="button"
        onClick={async () => {
          await apiFetch('/auth/logout', { method: 'POST', noOrg: true }).catch(() => undefined);
          window.location.href = '/login';
        }}
        className="flex w-full items-center gap-2 rounded-button px-3 py-2 text-left text-[14px] text-danger hover:bg-surface-2"
      >
        <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
        {t('user.logout')}
      </button>
    </Popover>
  );
}
