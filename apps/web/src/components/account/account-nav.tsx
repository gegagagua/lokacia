'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, BadgeCheck, Building2, CalendarDays, CreditCard, FileSignature, Heart, Home, LayoutDashboard, MessageSquare, Search, Settings2, User, Users, Wrench } from 'lucide-react';
import type { AccountSummaryDto } from '@lokacia/contracts';
import { Avatar, cn } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { useRealtime } from './realtime';

type Item = { href: string; key: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; count?: number };
export type NavUser = { name: string | null; phone: string | null; avatarUrl: string | null; verified?: boolean };

export function AccountNav({ hasOrg, crmUrl, user }: { hasOrg: boolean; crmUrl: string; user?: NavUser }) {
  const t = useTranslations('account.nav');
  const pathname = usePathname();
  const { data: unread, mutate: mutateUnread } = useSWR<{ count: number }>('/conversations/unread', fetcher, { refreshInterval: 30_000 });
  const { data: summary, mutate: mutateSummary } = useSWR<AccountSummaryDto>('/stats/account', fetcher, { refreshInterval: 120_000 });
  useRealtime('message', () => void mutateUnread());
  useRealtime('read', () => void mutateUnread());
  useRealtime('notification', () => void mutateSummary());

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
        { href: '/account/org', key: 'org', icon: Users },
        { href: '/account/billing', key: 'billing', icon: CreditCard },
        { href: '/account/property', key: 'property', icon: Home },
      ],
    },
  ];
  const isActive = (href: string) => {
    const p = pathname.replace(/^\/(en|ru)(?=\/|$)/, '') || '/';
    return href === '/account' ? p === '/account' : p === href || p.startsWith(`${href}/`);
  };
  const all = groups.flatMap((g) => g.items);
  const mobileRef = React.useRef<HTMLUListElement>(null);
  React.useEffect(() => {
    mobileRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  const badge = (count: number, active: boolean) => (
    <span className={cn('inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-bold tabular', active ? 'bg-primary text-primary-contrast' : 'bg-accent text-accent-contrast')} aria-label={t('countLabel', { count })}>
      {count}
    </span>
  );

  return (
    <>
      {/* mobile: horizontally scrollable pill nav */}
      <nav aria-label={t('label')} className="-mx-4 lg:hidden">
        <ul ref={mobileRef} className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {all.map((i) => {
            const active = isActive(i.href);
            const Icon = i.icon;
            return (
              <li key={i.href} className="shrink-0">
                <Link
                  href={i.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[14px] font-semibold transition-colors', active ? 'border-transparent bg-primary text-primary-contrast shadow-sm' : 'border-border bg-surface text-muted shadow-xs hover:text-text')}
                >
                  <Icon className="size-4" strokeWidth={2} aria-hidden />
                  {t(i.key)}
                  {i.count ? <span className={cn('inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-bold tabular', active ? 'bg-primary-contrast/20' : 'bg-accent text-accent-contrast')}>{i.count}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* desktop: sidebar card */}
      <nav aria-label={t('label')} className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-3">
          {user && (
            <Link href="/account/profile" className="card card-hover group flex items-center gap-3 p-3.5">
              <Avatar src={user.avatarUrl} name={user.name ?? user.phone} size={44} className="ring-primary-soft" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate font-bold leading-tight">
                  <span className="truncate">{user.name ?? t('noName')}</span>
                  {user.verified && <BadgeCheck className="size-4 shrink-0 text-success" strokeWidth={2} aria-hidden />}
                </span>
                <span className="block truncate text-[13px] text-muted tabular">{user.phone}</span>
              </span>
              <Settings2 className="size-4 shrink-0 text-muted transition-colors group-hover:text-text" strokeWidth={2} aria-hidden />
            </Link>
          )}
          <div className="card flex flex-col gap-4 p-2.5">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="mb-1 px-3 pt-1 text-[12px] font-semibold tracking-wide text-muted">{g.label}</div>
                <ul className="flex flex-col gap-0.5">
                  {g.items.map((i) => {
                    const Icon = i.icon;
                    const active = isActive(i.href);
                    return (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn('group flex h-10 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition-all duration-200', active ? 'bg-primary-soft font-semibold text-primary-soft-text' : 'text-muted hover:bg-surface-2 hover:text-text')}
                        >
                          <Icon className={cn('size-[18px] shrink-0 transition-transform duration-200', !active && 'group-hover:scale-110')} strokeWidth={2} aria-hidden />
                          <span className="flex-1 truncate">{t(i.key)}</span>
                          {i.count ? badge(i.count, active) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {hasOrg && (
            <a href={crmUrl} className="hero-gradient group flex items-center gap-3 rounded-card p-4 shadow-sm transition-shadow hover:shadow-md">
              <span className="grid size-9 place-items-center rounded-xl bg-white/15" aria-hidden>
                <Users className="size-4" strokeWidth={2} />
              </span>
              <span className="flex-1 text-[14px] font-semibold">{t('crm')}</span>
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
            </a>
          )}
        </div>
      </nav>
    </>
  );
}
