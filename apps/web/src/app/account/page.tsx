import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, CalendarDays, FileSignature, FileText, Heart, MessageSquare, Search, TriangleAlert, UserRound } from 'lucide-react';
import { formatDateTimeKa, formatNumber, type AccountSummaryDto } from '@lokacia/contracts';
import { Badge, Button, Card, Stat } from '@lokacia/ui';
import { api } from '@/lib/api-server';
import { requireSession } from '@/components/account/require-session';
import { AccountPageHeader } from '@/components/account/page-header';
import { ConfirmListingButton } from '@/components/account/dashboard/confirm-listing-button';
import { relativeKa, tbilisi } from '@/components/account/format';

export const metadata: Metadata = { title: 'მიმოხილვა' };

export default async function AccountDashboard() {
  const user = await requireSession('/account');
  const t = await getTranslations('account.dashboard');
  const s = await api<AccountSummaryDto>('/v1/stats/account');
  const isOwner = s.listings.total > 0;
  const p = s.pending;
  const actions = [
    p.offersAwaitingMe > 0 && { href: '/account/offers?box=received', icon: FileSignature, text: t('offersAwaiting', { count: p.offersAwaitingMe }), tone: 'accent' as const },
    p.unreadMessages > 0 && { href: '/account/messages', icon: MessageSquare, text: t('unreadMessages', { count: p.unreadMessages }), tone: 'accent' as const },
    p.rejectedListings > 0 && { href: '/account/listings?status=rejected', icon: TriangleAlert, text: t('rejected', { count: p.rejectedListings }), tone: 'danger' as const },
    p.drafts > 0 && { href: '/account/listings?status=draft', icon: FileText, text: t('drafts', { count: p.drafts }), tone: 'neutral' as const },
  ].filter(Boolean) as { href: string; icon: typeof FileText; text: string; tone: 'accent' | 'danger' | 'neutral' }[];

  return (
    <div className="flex flex-col gap-8">
      <AccountPageHeader
        title={user.name ? t('greeting', { name: user.name.split(' ')[0]! }) : t('greetingNoName')}
        description={t('subtitle')}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/search">
                <Search className="size-4" strokeWidth={1.5} aria-hidden />
                {t('search')}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/account/listings/new">{t('publish')}</Link>
            </Button>
          </>
        }
      />

      {isOwner && (
        <section aria-labelledby="kpi" className="flex flex-col gap-3">
          <h2 id="kpi" className="sr-only">{t('myListings')}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Link href="/account/listings" className="rounded-card focus-visible:outline-2 focus-visible:outline-focus">
              <Stat label={t('kpiListings')} value={formatNumber(s.listings.total)} hint={t('kpiActive', { count: s.listings.byStatus.active ?? 0 })} className="h-full hover:border-border-strong" />
            </Link>
            <Stat label={t('kpiViews')} value={formatNumber(s.listings.views30d)} />
            <Stat label={t('kpiReveals')} value={formatNumber(s.listings.reveals30d)} />
            <Stat label={t('kpiSaves')} value={formatNumber(s.listings.saves30d)} />
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <section aria-labelledby="pending" className="flex min-w-0 flex-col gap-3">
          <h2 id="pending" className="text-h3 font-semibold">{t('pendingTitle')}</h2>
          {p.unconfirmedListings.length > 0 && (
            <Card className="p-0">
              <div className="border-b border-border px-4 py-3">
                <div className="font-medium">{t('confirmTitle')}</div>
                <div className="text-small text-muted">{t('confirmHint')}</div>
              </div>
              <ul>
                {p.unconfirmedListings.map((l) => (
                  <li key={l.id} className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <Link href={`/account/listings/${l.id}/stats`} className="line-clamp-1 font-medium hover:underline">
                        {l.title}
                      </Link>
                      <div className="flex items-center gap-2 text-small text-muted">
                        {l.status === 'stale' && <Badge tone="accent">დაუდასტურებელი</Badge>}
                        {l.lastConfirmedAt ? t('lastConfirmed', { when: relativeKa(l.lastConfirmedAt) }) : t('neverConfirmed')}
                      </div>
                    </div>
                    <ConfirmListingButton listingId={l.id} label={t('confirmAction')} doneLabel={t('confirmed')} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {actions.length > 0 && (
            <ul className="flex flex-col gap-2">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <li key={a.href}>
                    <Link href={a.href} className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 hover:border-border-strong">
                      <Icon className={a.tone === 'danger' ? 'size-5 text-danger' : 'size-5 text-primary'} strokeWidth={1.5} aria-hidden />
                      <span className="flex-1">{a.text}</span>
                      <ArrowRight className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {!p.unconfirmedListings.length && !actions.length && <Card className="px-4 py-6 text-center text-muted">{t('nothingPending')}</Card>}

          {!s.tenant.hasTenantProfile && (
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <UserRound className="size-6 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
              <p className="flex-1 text-[15px]">{t('tenantProfileMissing')}</p>
              <Button asChild variant="secondary" size="sm">
                <Link href="/account/profile?tab=tenant">{t('tenantProfileAction')}</Link>
              </Button>
            </Card>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="upcoming" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 id="upcoming" className="text-h3 font-semibold">{t('upcomingTitle')}</h2>
              <Link href="/account/viewings" className="text-small text-link hover:underline">
                {t('allViewings')}
              </Link>
            </div>
            <Card className="p-0">
              {p.upcomingViewings.length === 0 ? (
                <div className="px-4 py-6 text-center text-small text-muted">{t('noUpcoming')}</div>
              ) : (
                <ul>
                  {p.upcomingViewings.map((v) => (
                    <li key={v.id} className="border-b border-border last:border-b-0">
                      <Link href={`/account/viewings?v=${v.id}`} className="flex gap-3 px-4 py-3 hover:bg-surface-2">
                        <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
                        <div className="min-w-0">
                          <div className="text-small font-medium tabular">{formatDateTimeKa(tbilisi(v.startsAt))}</div>
                          <div className="line-clamp-1 text-[15px]">{v.title}</div>
                          <div className="mt-1 flex gap-1.5">
                            <Badge tone="outline">{v.myRole === 'host' ? t('roleHost') : t('roleVisitor')}</Badge>
                            <Badge tone="outline">{v.mode === 'video' ? t('modeVideo') : t('modeOnsite')}</Badge>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section aria-labelledby="tenant" className="flex flex-col gap-3">
            <h2 id="tenant" className="text-h3 font-semibold">{t('tenantTitle')}</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { href: '/account/favorites', label: t('favorites'), value: s.tenant.favorites, icon: Heart },
                { href: '/account/saved-searches', label: t('savedSearches'), value: s.tenant.savedSearches, icon: Search },
                { href: '/account/offers?box=sent', label: t('offersSent'), value: s.tenant.offersSent, icon: FileSignature },
              ].map((c) => (
                <Link key={c.href} href={c.href} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3 hover:border-border-strong">
                  <c.icon className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                  <span className="compact text-h3 font-semibold tabular">{formatNumber(c.value)}</span>
                  <span className="text-[12px] leading-tight text-muted">{c.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
