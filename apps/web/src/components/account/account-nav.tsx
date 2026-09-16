'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { BarChart3, Bell, Building2, CalendarDays, CreditCard, FileSignature, Heart, Home, LayoutDashboard, MessageSquare, Search, User, Wrench } from 'lucide-react';
import type { AccountSummaryDto } from '@lokacia/contracts';
import { cn } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { useRealtime } from './realtime';

type Item = { href: string; key: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; count?: number; external?: boolean };

export function AccountNav({ hasOrg, crmUrl }: { hasOrg: boolean; crmUrl: string }) {
  const t = useTranslations('account.nav');
  const pathname = usePathname();
  const { data: unread, mutate: mutateUnread } = useSWR<{ count: number }>('/conversations/unread', fetcher, { refreshInterval: 30_000 });
  const { data: summary, mutate: mutateSummary } = useSWR<AccountSummaryDto>('/stats/account', fetcher, { refreshInterval: 120_000 });
  const live = useRealtime('message', () => void mutateUnread());
  useRealtime('read', () => void mutateUnread());
  useRealtime('notification', () => void mutateSummary());
  void live;

  const groups: { label: string; items: Item[] }[] = [
    {
      label: t('groupMain'),
      items: [
        { href: '/account', key: 'dashboard', icon: LayoutDashboard },
        { href: '/account/listings', key: 'listings', icon: Building2, count: summary?.pending.unconfirmedListings.length || undefined },
        { href: '/account/offers', key: 'offers', icon: FileSignature, count: summary?.pending.offersAwaitingMe || undefined },
        { href: '/account/viewings', key: 'viewings', icon: CalendarDays, count: summary?.pending.upcomingViewings.length || undefined },
        { href: '/account/messages', key: 'messages', icon: MessageSquare, count: unread?.count || undefined },
      ],
    },
    {
      label: t('groupSearch'),
      items: [
        { href: '/account/favorites', key: 'favorites', icon: Heart },
        { href: '/account/saved-searches', key: 'savedSearches', icon: Search },
        { href: '/account/services', key: 'services', icon: Wrench },
      ],
    },
    {
      label: t('groupSettings'),
      items: [
        { href: '/account/profile', key: 'profile', icon: User },
        { href: '/account/org', key: 'org', icon: BarChart3 },
        { href: '/account/billing', key: 'billing', icon: CreditCard },
        { href: '/account/property', key: 'property', icon: Home },
      ],
    },
  ];
  const isActive = (href: string) => (href === '/account' ? pathname === '/account' : pathname === href || pathname.startsWith(`${href}/`));
  const all = groups.flatMap((g) => g.items);

  return (
    <>
      {/* mobile: horizontal tabs */}
      <nav aria-label={t('label')} className="-mx-4 mb-6 overflow-x-auto border-b border-border px-4 lg:hidden">
        <ul className="flex gap-1 pb-2">
          {all.map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={isActive(i.href) ? 'page' : undefined} className={cn('inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-button px-3 text-small', isActive(i.href) ? 'bg-primary text-primary-contrast' : 'text-muted hover:bg-surface-2 hover:text-text')}>
                {t(i.key)}
                {i.count ? <span className={cn('rounded-full px-1.5 text-[11px] tabular', isActive(i.href) ? 'bg-primary-contrast/20' : 'bg-accent text-accent-contrast')}>{i.count}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* desktop: sidebar */}
      <nav aria-label={t('label')} className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wide text-muted">{g.label}</div>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((i) => {
                  const Icon = i.icon;
                  const active = isActive(i.href);
                  return (
                    <li key={i.href}>
                      <Link href={i.href} aria-current={active ? 'page' : undefined} className={cn('flex h-9 items-center gap-2.5 rounded-button px-3 text-[15px] transition-colors', active ? 'bg-surface-2 font-medium text-text' : 'text-muted hover:bg-surface-2 hover:text-text')}>
                        <Icon className={cn('size-4 shrink-0', active && 'text-primary')} strokeWidth={1.5} aria-hidden />
                        <span className="flex-1 truncate">{t(i.key)}</span>
                        {i.count ? (
                          <span className="rounded-full bg-accent px-1.5 text-[11px] font-medium text-accent-contrast tabular" aria-label={t('countLabel', { count: i.count })}>
                            {i.count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {hasOrg && (
            <a href={crmUrl} className="flex items-center gap-2 rounded-card border border-border px-3 py-2.5 text-small text-link hover:bg-surface-2">
              <Bell className="size-4" strokeWidth={1.5} aria-hidden />
              {t('crm')} ↗
            </a>
          )}
        </div>
      </nav>
    </>
  );
}
