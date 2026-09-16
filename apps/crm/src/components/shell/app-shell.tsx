'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronsLeft, ChevronsRight, Menu, Search } from 'lucide-react';
import { cn, Drawer, IconButton, LogoMark, LogoWordmark } from '@lokacia/ui';
import { useCrm } from '@/lib/crm-context';
import { NAV, NAV_ITEMS, type NavItem } from '@/lib/nav';
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
    <nav aria-label="CRM" className="flex flex-col gap-4">
      {NAV.map((g) => {
        const items = g.items.filter((i) => !i.perm || can(i.perm));
        if (!items.length) return null;
        return (
          <div key={g.key}>
            {!collapsed && <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{t(`groups.${g.key}`)}</div>}
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
                      className={cn(
                        'flex h-9 items-center gap-2.5 rounded-button border px-3 text-[14px] transition-colors duration-150',
                        active ? 'border-border-strong bg-surface font-medium text-text' : 'border-transparent text-muted hover:bg-surface-2 hover:text-text',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      <Icon className={cn('size-4 shrink-0', active && 'text-primary')} strokeWidth={1.5} aria-hidden />
                      {!collapsed && <span className="truncate">{t(`nav.${i.key}`)}</span>}
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

function MobileTabBar({ onMore }: { onMore: () => void }) {
  const t = useTranslations('shell.nav');
  const pathname = usePathname();
  const { can } = useCrm();
  const items: NavItem[] = NAV_ITEMS.filter((i) => i.mobile && (!i.perm || can(i.perm))).slice(0, 4);
  return (
    <nav aria-label="CRM" className="no-print fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
      {items.map((i) => {
        const Icon = i.icon;
        const active = isActive(pathname, i.href);
        return (
          <Link key={i.key} href={i.href} aria-current={active ? 'page' : undefined} className={cn('flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]', active ? 'text-primary' : 'text-muted')}>
            <Icon className="size-5" strokeWidth={1.5} aria-hidden />
            <span className="max-w-full truncate px-1">{t(i.key)}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onMore} className="flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted">
        <Menu className="size-5" strokeWidth={1.5} aria-hidden />
        {t('more')}
      </button>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('shell');
  const [collapsed, setCollapsed] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const [palette, setPalette] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('lk-crm-sidebar') === 'collapsed');
    } catch {
      /* private mode */
    }
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
    <div className="crm-dense flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-button focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast">
        {t('skip')}
      </a>
      <aside className={cn('no-print sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-bg md:flex', collapsed ? 'w-16' : 'w-60')}>
        <div className={cn('flex h-14 items-center border-b border-border', collapsed ? 'justify-center' : 'justify-between px-4')}>
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="lokacia CRM">
            <LogoMark size={24} className="text-primary" />
            {!collapsed && (
              <>
                <LogoWordmark showGeorgian={false} />
                <span className="rounded-[4px] border border-border-strong px-1 text-[10px] font-medium text-muted">CRM</span>
              </>
            )}
          </Link>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3">
          <NavLinks collapsed={collapsed} />
        </div>
        <div className="border-t border-border p-2">
          <button type="button" onClick={toggle} className="flex h-8 w-full items-center justify-center rounded-button text-muted hover:bg-surface-2" aria-label={collapsed ? 'მენიუს გაშლა' : 'მენიუს აკეცვა'}>
            {collapsed ? <ChevronsRight className="size-4" strokeWidth={1.5} /> : <ChevronsLeft className="size-4" strokeWidth={1.5} />}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg/95 px-3 backdrop-blur md:px-5">
          <IconButton label={t('nav.more')} size="sm" className="md:hidden" onClick={() => setDrawer(true)}>
            <Menu className="size-4" strokeWidth={1.5} />
          </IconButton>
          <Link href="/dashboard" className="md:hidden" aria-label="lokacia CRM">
            <LogoMark size={22} className="text-primary" />
          </Link>
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-button border border-border-strong bg-surface px-3 text-left text-small text-muted hover:border-focus md:max-w-md"
            aria-label={t('palette.open')}
          >
            <Search className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
            <span className="truncate">{t('palette.placeholder')}</span>
            <span className="ml-auto hidden shrink-0 gap-1 sm:flex">
              <kbd>Ctrl</kbd>
              <kbd>K</kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <OrgSwitcher />
            <NotificationsBell />
            <LanguageSwitcher />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <OfflineBanner />
        <main id="main" className="min-w-0 flex-1 px-3 pb-24 pt-4 md:px-6 md:pb-10 md:pt-6">
          {children}
        </main>
      </div>

      <MobileTabBar onMore={() => setDrawer(true)} />
      <Drawer open={drawer} onOpenChange={setDrawer} side="left" title="lokacia CRM">
        <NavLinks onNavigate={() => setDrawer(false)} />
      </Drawer>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
}
