'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarPlus, CircleUserRound, ListPlus, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, SquareKanban } from 'lucide-react';
import { Button, cn, Drawer, LogoMark, LogoWordmark, Popover } from '@lokacia/ui';
import { useCrm } from '@/lib/crm-context';
import { NAV, NAV_ITEMS, type NavItem } from '@/lib/nav';
import { PersonAvatar } from '@/components/common/ui';
import { CommandPalette } from './command-palette';
import { NotificationsBell } from './notifications-bell';
import { OfflineBanner } from './offline-banner';
import { OrgSwitcher } from './org-switcher';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { UserMenu } from './user-menu';

function isActive(pathname: string, href: string) {
  if (href === '/listings') return pathname === '/listings' || (pathname.startsWith('/listings/') && !pathname.startsWith('/listings/new'));
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const t = useTranslations('shell');
  const pathname = usePathname();
  const { can } = useCrm();
  return (
    <nav aria-label="CRM" className="flex flex-col gap-5">
      {NAV.map((g) => {
        const items = g.items.filter((i) => !i.perm || can(i.perm));
        if (!items.length) return null;
        return (
          <div key={g.key}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
            ) : (
              <div className="px-3 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted/80">{t(`groups.${g.key}`)}</div>
            )}
            <ul className="flex flex-col gap-0.5">
              {items.map((i) => {
                const active = isActive(pathname, i.href);
                const Icon = i.icon;
                return (
                  <li key={i.key}>
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? t(`nav.${i.key}`) : undefined}
                      aria-label={collapsed ? t(`nav.${i.key}`) : undefined}
                      className={cn(
                        'group relative flex h-9 items-center gap-3 rounded-[10px] px-3 text-[14px] transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none',
                        active ? 'bg-primary-soft font-semibold text-primary-soft-text' : 'font-medium text-muted hover:bg-surface-2 hover:text-text',
                        collapsed && 'mx-auto size-10 justify-center px-0',
                      )}
                    >
                      {active && !collapsed && <span aria-hidden className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                      <Icon className={cn('size-[18px] shrink-0 transition-colors', active ? 'text-primary-soft-text' : 'text-muted group-hover:text-text')} strokeWidth={2} aria-hidden />
                      {!collapsed && <span className="truncate">{t(`nav.${i.key}`)}</span>}
                      {!collapsed && i.shortcut && <span className="ml-auto hidden text-[11px] font-medium tracking-wide text-muted/70 opacity-0 transition-opacity group-hover:opacity-100 xl:inline">{i.shortcut.toUpperCase()}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarUser({ collapsed }: { collapsed?: boolean }) {
  const t = useTranslations('shell');
  const { user, role } = useCrm();
  if (collapsed) return null;
  return (
    <Link href="/settings/profile" className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2">
      <PersonAvatar name={user.name ?? user.phone} src={user.avatarUrl} size={34} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold leading-5">{user.name ?? user.phone}</span>
        <span className="block truncate text-[12.5px] leading-4 text-muted">{t(`roles.${role}`)}</span>
      </span>
    </Link>
  );
}

function QuickCreate() {
  const t = useTranslations('shell');
  const [open, setOpen] = React.useState(false);
  const items = [
    { href: '/contacts?new=1', label: t('palette.newContact'), icon: CircleUserRound, tone: 'tone-2' },
    { href: '/deals?new=1', label: t('palette.newDeal'), icon: SquareKanban, tone: 'tone-1' },
    { href: '/tasks?new=1', label: t('palette.newTask'), icon: ListPlus, tone: 'tone-4' },
    { href: '/calendar?new=1', label: t('palette.newViewing'), icon: CalendarPlus, tone: 'tone-7' },
  ];
  return (
    <Popover
      align="end"
      open={open}
      onOpenChange={setOpen}
      className="w-[290px] p-1.5"
      trigger={
        <Button size="sm" className="hidden rounded-full px-3.5 sm:inline-flex" aria-label={t('create')}>
          <Plus className="size-4" strokeWidth={2.4} aria-hidden />
          <span className="hidden lg:inline">{t('create')}</span>
        </Button>
      }
    >
      <div className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">{t('create')}</div>
      {items.map((i) => {
        const Icon = i.icon;
        return (
          <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="flex items-center gap-3 whitespace-nowrap rounded-[10px] px-2.5 py-2 text-[14px] font-medium hover:bg-surface-2">
            <span className={cn('grid size-8 place-items-center rounded-[10px] bg-tone-soft text-tone-ink', i.tone)} aria-hidden>
              <Icon className="size-4" strokeWidth={2} />
            </span>
            {i.label}
          </Link>
        );
      })}
    </Popover>
  );
}

function MobileTabBar({ onMore }: { onMore: () => void }) {
  const t = useTranslations('shell.nav');
  const pathname = usePathname();
  const { can } = useCrm();
  const items: NavItem[] = NAV_ITEMS.filter((i) => i.mobile && (!i.perm || can(i.perm))).slice(0, 4);
  return (
    <nav aria-label="CRM" className="glass no-print fixed inset-x-0 bottom-0 z-40 grid border-t border-border pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgb(15_26_23/0.18)] md:hidden" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
      {items.map((i) => {
        const Icon = i.icon;
        const active = isActive(pathname, i.href);
        return (
          <Link key={i.key} href={i.href} aria-current={active ? 'page' : undefined} className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-primary-soft-text' : 'text-muted')}>
            <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-all duration-200', active && 'bg-primary-soft')}>
              <Icon className="size-5" strokeWidth={active ? 2.3 : 2} aria-hidden />
            </span>
            <span className="max-w-full truncate px-1 leading-none">{t(i.key)}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onMore} className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted">
        <span className="grid h-7 w-12 place-items-center rounded-full">
          <Menu className="size-5" strokeWidth={2} aria-hidden />
        </span>
        <span className="leading-none">{t('more')}</span>
      </button>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('shell');
  const [collapsed, setCollapsed] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const [palette, setPalette] = React.useState(false);
  const [mac, setMac] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('lk-crm-sidebar') === 'collapsed');
    } catch {
      /* private mode */
    }
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('lk-crm-sidebar', c ? 'open' : 'collapsed');
      } catch {
        /* private mode */
      }
      return !c;
    });
  };

  return (
    <div className="crm-dense flex min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-button focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast">
        {t('skip')}
      </a>
      <aside className={cn('no-print sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-300 ease-out md:flex', collapsed ? 'w-[76px]' : 'w-[264px]')}>
        <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'justify-between pl-5 pr-3')}>
          <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg focus-visible:shadow-ring focus-visible:outline-none" aria-label="lokacia CRM">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-contrast shadow-sm">
              <LogoMark size={20} />
            </span>
            {!collapsed && (
              <span className="flex items-center gap-1.5">
                <LogoWordmark showGeorgian={false} />
                <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide text-text">CRM</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <button type="button" onClick={toggle} className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text" aria-label={t('collapse')} title={t('collapse')}>
              <PanelLeftClose className="size-[18px]" strokeWidth={2} aria-hidden />
            </button>
          )}
        </div>
        <div className={cn('shrink-0 pb-3', collapsed ? 'px-3' : 'px-3')}>
          <OrgSwitcher variant="sidebar" collapsed={collapsed} />
        </div>
        <div className={cn('scrollbar-thin flex-1 overflow-y-auto pb-4 pt-2', collapsed ? 'px-2' : 'px-3')}>
          <NavLinks collapsed={collapsed} />
        </div>
        <div className="shrink-0 border-t border-border p-3">
          {collapsed ? (
            <button type="button" onClick={toggle} className="mx-auto grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text" aria-label={t('expand')} title={t('expand')}>
              <PanelLeftOpen className="size-[18px]" strokeWidth={2} aria-hidden />
            </button>
          ) : (
            <SidebarUser />
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass no-print sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 px-3 md:gap-3 md:px-6">
          <button type="button" className="grid size-10 shrink-0 place-items-center rounded-xl text-text hover:bg-surface-2 md:hidden" onClick={() => setDrawer(true)} aria-label={t('nav.more')}>
            <Menu className="size-5" strokeWidth={2} aria-hidden />
          </button>
          <Link href="/dashboard" className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-contrast md:hidden" aria-label="lokacia CRM">
            <LogoMark size={18} />
          </Link>
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="group ml-auto grid size-10 shrink-0 place-items-center rounded-full text-left text-[14px] text-muted transition-all duration-200 hover:bg-surface-2 focus-visible:shadow-ring focus-visible:outline-none sm:ml-0 sm:flex sm:h-10 sm:w-auto sm:min-w-0 sm:flex-1 sm:items-center sm:gap-2.5 sm:border sm:border-border sm:bg-surface sm:px-3.5 sm:shadow-xs sm:hover:border-border-strong sm:hover:bg-surface sm:hover:shadow-sm md:max-w-[440px]"
            aria-label={t('palette.open')}
          >
            <Search className="size-[19px] shrink-0 text-muted group-hover:text-text sm:size-4" strokeWidth={2} aria-hidden />
            <span className="hidden truncate sm:inline">{t('palette.placeholder')}</span>
            <span className="ml-auto hidden shrink-0 items-center gap-1 sm:flex" aria-hidden>
              <kbd>{mac ? '⌘' : 'Ctrl'}</kbd>
              <kbd>K</kbd>
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1 sm:ml-auto md:gap-1.5">
            <QuickCreate />
            <NotificationsBell />
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <UserMenu />
          </div>
        </header>
        <OfflineBanner />
        <main id="main" className="min-w-0 flex-1 animate-fade-up px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-7">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

      <MobileTabBar onMore={() => setDrawer(true)} />
      <Drawer open={drawer} onOpenChange={setDrawer} side="left" title="lokacia CRM">
        <div className="flex flex-col gap-4">
          <OrgSwitcher variant="sidebar" />
          <NavLinks onNavigate={() => setDrawer(false)} />
          <div className="flex items-center gap-2 border-t border-border pt-4">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </Drawer>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
}
