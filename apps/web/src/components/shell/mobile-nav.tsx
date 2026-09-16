'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Drawer, IconButton } from '@lokacia/ui';
import { LanguageLinks } from './language-switcher';

export function MobileNav({ items, loggedIn }: { items: { href: string; label: string }[]; loggedIn: boolean }) {
  const t = useTranslations('common.nav');
  const [open, setOpen] = React.useState(false);
  return (
    <div className="xl:hidden">
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={t('menu')}
        trigger={
          <IconButton label={t('menu')} size="sm">
            <Menu className="size-5" strokeWidth={1.5} />
          </IconButton>
        }
      >
        <nav className="flex flex-col" onClick={() => setOpen(false)}>
          {items.map((n) => (
            <Link key={n.href} href={n.href} className="border-b border-border py-3 text-[17px]">
              {n.label}
            </Link>
          ))}
          <Link href="/pricing" className="border-b border-border py-3 text-[17px]">
            {t('pricing')}
          </Link>
          {loggedIn && (
            <Link href="/account" className="border-b border-border py-3 text-[17px]">
              {t('account')}
            </Link>
          )}
          <Button asChild className="mt-4">
            <Link href="/account/listings/new">{t('publish')}</Link>
          </Button>
        </nav>
        <LanguageLinks className="mt-6" />
      </Drawer>
    </div>
  );
}
