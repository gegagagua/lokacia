'use client';
import { usePathname } from 'next/navigation';
import Link from '@/i18n/link';
import { cn } from '@lokacia/ui';
import { splitLocalePath } from '@/i18n/locale';

export type NavItem = { href: string; label: string };

/** Active when the current path is the item or one of its children (locale prefix ignored). */
export function isActivePath(pathname: string, href: string) {
  const { path } = splitLocalePath(pathname);
  return path === href || path.startsWith(`${href}/`);
}

export function HeaderNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname() ?? '/';
  return (
    <nav aria-label={label} className="ml-6 hidden items-center gap-1 rounded-full bg-surface-2/80 p-1 xl:flex">
      {items.map((n) => {
        const active = isActivePath(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative whitespace-nowrap rounded-full px-4 py-2 text-[14.5px] transition-all duration-200',
              active ? 'bg-primary font-semibold text-primary-contrast shadow-sm' : 'font-medium text-muted hover:bg-surface hover:text-text hover:shadow-xs',
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
