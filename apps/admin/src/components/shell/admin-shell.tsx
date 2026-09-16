'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import {
  BadgeCheck, Banknote, Building2, ClipboardCheck, FileText, Gauge, History, Landmark, LayoutList, Menu, MessageSquare, Settings, ShieldAlert, Tags, Users, X,
} from 'lucide-react';
import type { AdminDashboard, SessionUser } from '@lokacia/contracts';
import { Avatar, IconButton, Logo, cn } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { LogoutButton } from './logout-button';

type NavItem = { href: string; key: string; icon: React.ElementType; adminOnly?: boolean; count?: (d: AdminDashboard) => number };

const GROUPS: { key: string; items: NavItem[] }[] = [
  {
    key: 'work',
    items: [
      { href: '/', key: 'dashboard', icon: Gauge },
      { href: '/moderation', key: 'moderation', icon: ClipboardCheck, count: (d) => d.queues.moderation },
      { href: '/verifications', key: 'verifications', icon: BadgeCheck, count: (d) => d.queues.verifications },
      { href: '/feedback', key: 'feedback', icon: MessageSquare, count: (d) => d.queues.feedback },
      { href: '/escrow', key: 'escrow', icon: ShieldAlert, count: (d) => d.queues.disputes },
    ],
  },
  {
    key: 'people',
    items: [
      { href: '/users', key: 'users', icon: Users },
      { href: '/orgs', key: 'orgs', icon: Building2 },
      { href: '/audit', key: 'audit', icon: History },
    ],
  },
  {
    key: 'content',
    items: [
      { href: '/cms', key: 'cms', icon: FileText },
      { href: '/taxonomy', key: 'taxonomy', icon: Tags },
      { href: '/finance', key: 'finance', icon: Landmark },
    ],
  },
  {
    key: 'money',
    items: [
      { href: '/revenue', key: 'revenue', icon: Banknote, adminOnly: true, count: (d) => d.queues.failedPayments },
      { href: '/settings', key: 'settings', icon: Settings },
    ],
  },
];

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const { data } = useSWR<AdminDashboard>('/admin/dashboard', fetcher, { refreshInterval: 60_000 });
  const isAdmin = user.role === 'admin';
  React.useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav aria-label={t('label')} className="flex flex-col gap-4 px-2 py-3">
      {GROUPS.map((g) => (
        <div key={g.key}>
          <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{t(`groups.${g.key}`)}</div>
          <ul className="flex flex-col">
            {g.items
              .filter((i) => !i.adminOnly || isAdmin)
              .map((i) => {
                const active = i.href === '/' ? pathname === '/' : pathname.startsWith(i.href);
                const n = data && i.count ? i.count(data) : 0;
                const Icon = i.icon;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn('flex h-9 items-center gap-2.5 rounded-button px-2 text-[14px] transition-colors', active ? 'bg-surface-2 font-medium text-text' : 'text-muted hover:bg-surface-2 hover:text-text')}
                    >
                      <Icon className={cn('size-4 shrink-0', active && 'text-primary')} strokeWidth={1.5} aria-hidden />
                      <span className="flex-1 truncate">{t(i.key)}</span>
                      {n > 0 && (
                        <span className={cn('rounded-full px-1.5 text-[11px] tabular leading-5', i.key === 'revenue' || i.key === 'escrow' ? 'bg-danger text-primary-contrast' : 'bg-accent text-accent-contrast')} aria-label={t('pending', { count: n })}>
                          {n}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-button focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast">
        {t('skip')}
      </a>
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Logo size={22} showGeorgian={false} />
          <span className="rounded-[4px] border border-border px-1.5 text-[11px] text-muted">{t('badge')}</span>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Avatar name={user.name ?? user.phone} size={30} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-small font-medium">{user.name ?? user.phone}</div>
            <div className="text-[11px] text-muted">{t(`role.${user.role}`)}</div>
          </div>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-surface px-3 lg:hidden">
        <IconButton label={open ? t('close') : t('menu')} size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
        </IconButton>
        <Logo size={22} showGeorgian={false} />
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-30 overflow-y-auto border-t border-border bg-surface lg:hidden">
          {nav}
          <div className="border-t border-border p-3">
            <LogoutButton compact />
          </div>
        </div>
      )}

      <div className="min-w-0">
        <div className="hidden h-14 items-center justify-end gap-2 border-b border-border bg-bg px-6 lg:flex">
          <a href={process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100'} className="flex items-center gap-1 text-small text-link hover:underline">
            <LayoutList className="size-3.5" strokeWidth={1.5} aria-hidden />
            {t('portal')}
          </a>
          <LogoutButton compact />
        </div>
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
