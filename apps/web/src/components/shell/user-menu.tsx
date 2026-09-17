'use client';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import type { SessionUser } from '@lokacia/contracts';
import { Avatar, Popover } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { withBase } from '@/lib/base-path';

export function UserMenu({ user }: { user: SessionUser }) {
  const t = useTranslations('common.nav');
  const m = useTranslations('meta.userMenu');
  const crmUrl = process.env.NEXT_PUBLIC_CRM_URL ?? 'http://localhost:3101';
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3102';
  const links = [
    { href: '/account', label: t('account') },
    { href: '/account/listings', label: m('listings') },
    { href: '/account/favorites', label: t('favorites') },
    { href: '/account/offers', label: m('offers') },
    { href: '/account/messages', label: m('messages') },
  ];
  return (
    <Popover
      align="end"
      className="w-64 p-1"
      trigger={
        <button type="button" className="rounded-full focus-visible:outline-2 focus-visible:outline-focus" aria-label={user.name ?? t('account')}>
          <Avatar src={user.avatarUrl} name={user.name ?? user.phone} size={34} />
        </button>
      }
    >
      <div className="border-b border-border px-3 py-2">
        <div className="font-medium">{user.name ?? '—'}</div>
        <div className="text-small text-muted tabular">{user.phone}</div>
      </div>
      <nav className="py-1">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="block rounded-[6px] px-3 py-2 text-[15px] hover:bg-surface-2">
            {l.label}
          </Link>
        ))}
        {user.orgs.some((o) => o.type === 'agency') && (
          <a href={crmUrl} className="block rounded-[6px] px-3 py-2 text-[15px] hover:bg-surface-2">
            {t('crm')} ↗
          </a>
        )}
        {(user.role === 'admin' || user.role === 'moderator') && (
          <a href={adminUrl} className="block rounded-[6px] px-3 py-2 text-[15px] hover:bg-surface-2">
            {t('admin')} ↗
          </a>
        )}
      </nav>
      <button
        type="button"
        className="w-full rounded-[6px] border-t border-border px-3 py-2 text-left text-[15px] text-danger hover:bg-surface-2"
        onClick={async () => {
          await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
          window.location.href = withBase('/');
        }}
      >
        {t('logout')}
      </button>
    </Popover>
  );
}
