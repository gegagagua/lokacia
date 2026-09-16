import Link from '@/i18n/link';
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
  const a = await getTranslations('meta.a11y');
  const user = await getSession();
  const nav = [
    { href: '/search', label: t('search') },
    { href: '/map', label: t('map') },
    { href: '/demand', label: t('demand') },
    { href: '/services', label: t('services') },
    { href: '/projects', label: t('developers') },
  ];
  return (
    <header className="glass sticky top-0 z-40 border-b border-border/70">
      <div className="container-page flex h-[72px] min-w-0 items-center gap-2 sm:gap-4">
        <Link href="/" className="shrink-0 rounded-button" aria-label={a('homeLink')}>
          <Logo size={30} className="hidden sm:inline-flex" />
          <Logo size={24} showGeorgian={false} className="sm:hidden" />
        </Link>
        <nav aria-label={a('mainNav')} className="ml-6 hidden items-center gap-1 rounded-full bg-surface-2/80 p-1 xl:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full px-4 py-2 text-[14.5px] font-medium text-muted transition-all hover:bg-surface hover:text-text hover:shadow-xs">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <ThemeToggle />
          {user && <NotificationsBell />}
          <Button asChild size="sm" variant="accent" className="hidden sm:inline-flex">
            <Link href="/account/listings/new">
              <Plus className="size-4" strokeWidth={2.25} aria-hidden />
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
