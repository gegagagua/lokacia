'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import {
  ArrowUpRight, BadgeCheck, Banknote, Building2, ClipboardCheck, FileText, History, Landmark, LayoutDashboard, Menu, MessageSquare, Settings, ShieldAlert, Sparkles, Tags, Users,
} from 'lucide-react';
import type { AdminDashboard, SessionUser } from '@lokacia/contracts';
import { Avatar, Drawer, IconButton, LogoMark, cn } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { LogoutButton } from './logout-button';

type NavItem = { href: string; key: string; icon: React.ElementType; adminOnly?: boolean; count?: (d: AdminDashboard) => number; urgent?: boolean };

const GROUPS: { key: string; items: NavItem[] }[] = [
  {
    key: 'work',
    items: [
      { href: '/', key: 'dashboard', icon: LayoutDashboard },
      { href: '/moderation', key: 'moderation', icon: ClipboardCheck, count: (d) => d.queues.moderation },
      { href: '/verifications', key: 'verifications', icon: BadgeCheck, count: (d) => d.queues.verifications },
      { href: '/feedback', key: 'feedback', icon: MessageSquare, count: (d) => d.queues.feedback },
      { href: '/escrow', key: 'escrow', icon: ShieldAlert, count: (d) => d.queues.disputes, urgent: true },
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
      { href: '/revenue', key: 'revenue', icon: Banknote, adminOnly: true, count: (d) => d.queues.failedPayments, urgent: true },
      { href: '/settings', key: 'settings', icon: Settings },
    ],
  },
];

const PORTAL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
const isActive = (href: string, pathname: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

function Brand() {
  const t = useTranslations('nav');
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-xl focus-visible:shadow-ring focus-visible:outline-none">
      <span className="grid size-9 place-items-center rounded-xl bg-primary-soft">
        <LogoMark size={22} className="text-primary" title="lokacia.ge" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[18px] font-bold tracking-tight">lokacia</span>
        <span className="mt-1 text-[12px] font-semibold text-muted">{t('badge')}</span>
      </span>
    </Link>
  );
}

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const { data } = useSWR<AdminDashboard>('/admin/dashboard', fetcher, { refreshInterval: 60_000 });
  const isAdmin = user.role === 'admin';
  React.useEffect(() => setOpen(false), [pathname]);

  const current = GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.key }))).find((i) => isActive(i.href, pathname));
  const pending = data ? data.queues.moderation + data.queues.verifications + data.queues.feedback + data.queues.disputes : null;

  const nav = (
    <nav aria-label={t('label')} className="flex flex-col gap-6">
      {GROUPS.map((g) => (
        <div key={g.key}>
          <div className="px-3 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{t(`groups.${g.key}`)}</div>
          <ul className="flex flex-col gap-0.5">
            {g.items
              .filter((i) => !i.adminOnly || isAdmin)
              .map((i) => {
                const active = isActive(i.href, pathname);
                const n = data && i.count ? i.count(data) : 0;
                const Icon = i.icon;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none',
                        active ? 'bg-primary-soft text-primary-soft-text' : 'text-muted hover:bg-surface-2 hover:text-text',
                      )}
                    >
                      {active && <span className="absolute -left-3 top-2 h-6 w-1 rounded-r-full bg-primary" aria-hidden />}
                      <Icon className={cn('size-[18px] shrink-0 transition-transform group-hover:scale-105', active ? 'text-primary-soft-text' : 'text-muted group-hover:text-text')} strokeWidth={2} aria-hidden />
                      <span className="flex-1 truncate">{t(i.key)}</span>
                      {n > 0 && (
                        <span
                          className={cn(
                            'grid h-[22px] min-w-[22px] place-items-center rounded-full px-1.5 text-[12px] font-bold tabular leading-none',
                            i.urgent ? 'bg-danger text-white dark:text-[#1a0b07]' : active ? 'bg-primary text-primary-contrast' : 'bg-accent text-accent-contrast',
                          )}
                          aria-label={t('pending', { count: n })}
                        >
                          {n > 99 ? '99+' : n}
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

  const attention = pending !== null && (
    <Link
      href={data && data.queues.moderation > 0 ? '/moderation' : '/'}
      className="hero-gradient group relative block overflow-hidden rounded-2xl p-4 shadow-md transition-transform duration-200 hover:-translate-y-0.5 focus-visible:shadow-ring focus-visible:outline-none"
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold text-white/80">
        <Sparkles className="size-4 text-[#f7d67a]" strokeWidth={2} aria-hidden />
        {t('attentionTitle')}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="text-[28px] font-bold leading-none tabular text-white">{pending}</span>
        <ArrowUpRight className="size-5 text-white/70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
      </div>
      <p className="mt-1 text-[13px] leading-snug text-white/75">{pending > 0 ? t('attentionText') : t('allClear')}</p>
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-button focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast">
        {t('skip')}
      </a>

      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
          {nav}
        </div>
        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2/70 p-2.5">
            <Avatar name={user.name ?? user.phone} size={38} className="ring-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-semibold">{user.name ?? user.phone}</div>
              <div className="truncate text-[12.5px] text-muted">{t(`role.${user.role}`)}</div>
            </div>
            <LogoutButton iconOnly />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* top bar */}
        <header className="glass sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border px-3 sm:px-4 md:px-8">
          <IconButton label={t('menu')} size="sm" className="lg:hidden" onClick={() => setOpen(true)} aria-expanded={open}>
            <Menu className="size-5" strokeWidth={2} />
          </IconButton>
          <div className="lg:hidden">
            <Brand />
          </div>
          {current && (
            <div className="hidden min-w-0 items-center gap-2 text-[14.5px] lg:flex" aria-hidden>
              <span className="text-muted">{t(`groups.${current.group}`)}</span>
              <span className="text-border-strong">/</span>
              <span className="truncate font-semibold">{t(current.key)}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            <a
              href={PORTAL}
              className="mr-1 hidden h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-[14px] font-semibold text-text shadow-xs transition-all hover:border-border-strong hover:shadow-sm focus-visible:shadow-ring focus-visible:outline-none sm:inline-flex"
            >
              {t('portal')}
              <ArrowUpRight className="size-4 text-muted" strokeWidth={2} aria-hidden />
            </a>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-5 md:px-8 md:pt-8">
          {children}
        </main>
      </div>

      {/* mobile navigation */}
      <Drawer open={open} onOpenChange={setOpen} side="left" title={<Brand />} className="max-w-[300px]">
        <div className="flex flex-col gap-6 pb-2">
          {nav}
          {attention}
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2/70 p-2.5">
            <Avatar name={user.name ?? user.phone} size={38} className="ring-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-semibold">{user.name ?? user.phone}</div>
              <div className="truncate text-[12.5px] text-muted">{t(`role.${user.role}`)}</div>
            </div>
            <LogoutButton iconOnly />
          </div>
          <a href={PORTAL} className="inline-flex items-center gap-1.5 px-1 text-[14.5px] font-semibold text-link hover:underline">
            {t('portal')}
            <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden />
          </a>
        </div>
      </Drawer>
    </div>
  );
}
