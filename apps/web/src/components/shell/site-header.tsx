import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button, Logo } from '@lokacia/ui';
import { Plus } from 'lucide-react';
import { getSession } from '@/lib/session';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { MobileNav } from './mobile-nav';
import { NotificationsBell } from './notifications-bell';
import { LanguageSwitcher } from './language-switcher';

export async function SiteHeader() {
  const t = await getTranslations('common.nav');
  const user = await getSession();
  const nav = [
    { href: '/search', label: t('search') },
    { href: '/map', label: t('map') },
    { href: '/demand', label: t('demand') },
    { href: '/services', label: t('services') },
    { href: '/projects', label: t('developers') },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="shrink-0 rounded-button" aria-label="lokacia.ge — მთავარი">
          <Logo size={26} />
        </Link>
        <nav aria-label="მთავარი ნავიგაცია" className="ml-2 hidden items-center gap-0.5 xl:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-button px-2.5 py-2 text-[15px] text-muted transition-colors hover:bg-surface-2 hover:text-text">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
          {user && <NotificationsBell />}
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/account/listings/new">
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              {t('publish')}
            </Link>
          </Button>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link href="/login">{t('login')}</Link>
            </Button>
          )}
          <MobileNav items={nav} loggedIn={!!user} />
        </div>
      </div>
    </header>
  );
}
