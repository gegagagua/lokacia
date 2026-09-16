import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, BellRing, Building2, CalendarDays, CheckCircle2, Eye, FileSignature, FileText, Heart, MapPin, MessageSquare, Phone, Plus, Search, Sparkles, TriangleAlert, UserRound, Video } from 'lucide-react';
import type { AccountSummaryDto, ListingStatus } from '@lokacia/contracts';
import { Button } from '@lokacia/ui';
import { api } from '@/lib/api-server';
import { requireSession } from '@/components/account/require-session';
import { ConfirmListingButton } from '@/components/account/dashboard/confirm-listing-button';
import { DateTile, IconTile, KpiCard, SectionCard, type Tone } from '@/components/account/ui';
import { tbTileParts, tbTime } from '@/components/account/viewings/tz';
import { getFormat } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('overview') };
}

const STATUS_ORDER: { s: ListingStatus; cls: string }[] = [
  { s: 'active', cls: 'bg-success' },
  { s: 'stale', cls: 'bg-accent' },
  { s: 'pending_review', cls: 'bg-link' },
  { s: 'draft', cls: 'bg-border-strong' },
  { s: 'rejected', cls: 'bg-danger' },
  { s: 'rented', cls: 'bg-primary' },
  { s: 'sold', cls: 'bg-primary-500' },
  { s: 'archived', cls: 'bg-surface-3' },
];

export default async function AccountDashboard() {
  const user = await requireSession('/account');
  const t = await getTranslations('account.dashboard');
  const f = await getFormat();
  const s = await api<AccountSummaryDto>('/v1/stats/account');
  const isOwner = s.listings.total > 0;
  const p = s.pending;

  type Action = { href: string; icon: typeof FileText; title: string; hint: string; cta: string; tone: Tone };
  const actions = [
    p.offersAwaitingMe > 0 && { href: '/account/offers?box=received', icon: FileSignature, title: t('offersAwaiting', { count: p.offersAwaitingMe }), hint: t('offersAwaitingHint'), cta: t('open'), tone: 'accent' },
    p.unreadMessages > 0 && { href: '/account/messages', icon: MessageSquare, title: t('unreadMessages', { count: p.unreadMessages }), hint: t('unreadHint'), cta: t('reply'), tone: 'link' },
    p.rejectedListings > 0 && { href: '/account/listings?status=rejected', icon: TriangleAlert, title: t('rejected', { count: p.rejectedListings }), hint: t('rejectedHint'), cta: t('open'), tone: 'danger' },
    p.drafts > 0 && { href: '/account/listings?status=draft', icon: FileText, title: t('drafts', { count: p.drafts }), hint: t('draftsHint'), cta: t('continue'), tone: 'neutral' },
  ].filter(Boolean) as Action[];
  const attention = actions.length + p.unconfirmedListings.length;
  const firstName = user.name?.split(' ')[0];

  return (
    <div className="flex flex-col gap-6">
      {/* greeting hero */}
      <section className="hero-gradient relative overflow-hidden rounded-card p-6 shadow-md sm:p-8">
        <div aria-hidden className="absolute -right-16 -top-20 size-72 rounded-full border border-white/10" />
        <div aria-hidden className="absolute -right-4 -top-8 size-44 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[13px] font-semibold text-white/90">
              <CalendarDays className="size-3.5" strokeWidth={2} aria-hidden />
              {f.date(new Date())}
            </p>
            <h1 className="mt-3 text-[30px] font-bold leading-[38px] tracking-tight sm:text-[38px] sm:leading-[46px]">{firstName ? t('greeting', { name: firstName }) : t('greetingNoName')}</h1>
            <p className="mt-2 flex items-center gap-2 text-[16px] text-white/80">
              {attention > 0 ? (
                <>
                  <BellRing className="size-4 text-[#f7d67a]" strokeWidth={2} aria-hidden />
                  {t('attention', { count: attention })}
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 text-[#8fe0c8]" strokeWidth={2} aria-hidden />
                  {t('allClear')}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" className="border-white/20 bg-white/10 text-white shadow-none hover:border-white/30 hover:bg-white/20">
              <Link href="/search">
                <Search className="size-4" strokeWidth={2} aria-hidden />
                {t('search')}
              </Link>
            </Button>
            <Button asChild variant="accent">
              <Link href="/account/listings/new">
                <Plus className="size-4" strokeWidth={2.25} aria-hidden />
                {t('publish')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {isOwner && (
        <section aria-labelledby="kpi">
          <h2 id="kpi" className="sr-only">
            {t('myListings')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Link href="/account/listings" className="card-hover rounded-card focus-visible:shadow-ring focus-visible:outline-none">
              <KpiCard icon={Building2} label={t('kpiListings')} value={f.number(s.listings.total)} trend={<span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-success/12 px-2 text-[12.5px] font-semibold text-success tabular">{t('kpiActive', { count: s.listings.byStatus.active ?? 0 })}</span>} />
            </Link>
            <KpiCard icon={Eye} tone="link" label={t('kpiViews')} value={f.number(s.listings.views30d)} />
            <KpiCard icon={Phone} tone="success" label={t('kpiReveals')} value={f.number(s.listings.reveals30d)} />
            <KpiCard icon={Heart} tone="danger" label={t('kpiSaves')} value={f.number(s.listings.saves30d)} />
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <SectionCard id="pending" title={t('pendingTitle')} description={attention ? t('attention', { count: attention }) : undefined} icon={BellRing} tone="accent" flush>
            {!attention ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <IconTile icon={CheckCircle2} tone="success" size="lg" />
                <p className="text-muted">{t('nothingPending')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {actions.map((a) => (
                  <li key={a.href} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-2/60 sm:flex-row sm:items-center sm:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <IconTile icon={a.icon} tone={a.tone} />
                      <div className="min-w-0">
                        <div className="font-semibold leading-snug">{a.title}</div>
                        <div className="text-small text-muted">{a.hint}</div>
                      </div>
                    </div>
                    <Button asChild size="sm" variant={a.tone === 'accent' || a.tone === 'danger' ? 'primary' : 'secondary'} className="self-start sm:self-auto">
                      <Link href={a.href}>
                        {a.cta}
                        <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                      </Link>
                    </Button>
                  </li>
                ))}
                {p.unconfirmedListings.length > 0 && (
                  <li className="bg-accent-soft/40 px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3.5">
                      <IconTile icon={CheckCircle2} tone="accent" />
                      <div className="min-w-0">
                        <div className="font-semibold leading-snug">{t('confirmTitle')}</div>
                        <div className="text-small text-muted">{t('confirmHint')}</div>
                      </div>
                    </div>
                    <ul className="mt-3 flex flex-col gap-2">
                      {p.unconfirmedListings.map((l) => (
                        <li key={l.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-xs sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <Link href={`/account/listings/${l.id}/stats`} className="line-clamp-1 font-semibold hover:text-link">
                              {l.title}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-small text-muted">
                              {l.status === 'stale' && <span className="inline-flex h-6 items-center rounded-full bg-accent px-2 text-[12px] font-semibold text-accent-contrast">{f.listingStatus('stale')}</span>}
                              {l.lastConfirmedAt ? t('lastConfirmed', { when: f.relativeDays(l.lastConfirmedAt) }) : t('neverConfirmed')}
                            </div>
                          </div>
                          <ConfirmListingButton listingId={l.id} label={t('confirmAction')} doneLabel={t('confirmed')} />
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            )}
          </SectionCard>

          {isOwner && (
            <SectionCard
              id="portfolio"
              title={t('portfolioTitle')}
              icon={Building2}
              action={
                <Button asChild size="sm" variant="ghost">
                  <Link href="/account/listings">
                    {t('manageListings')}
                    <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                  </Link>
                </Button>
              }
            >
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                {STATUS_ORDER.filter((x) => (s.listings.byStatus[x.s] ?? 0) > 0).map((x) => (
                  <span key={x.s} className={`${x.cls} h-full border-r-2 border-surface last:border-r-0`} style={{ width: `${((s.listings.byStatus[x.s] ?? 0) / s.listings.total) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
                {STATUS_ORDER.filter((x) => (s.listings.byStatus[x.s] ?? 0) > 0).map((x) => (
                  <li key={x.s} className="flex items-center gap-2 text-small">
                    <span className={`size-2.5 shrink-0 rounded-full ${x.cls}`} aria-hidden />
                    <span className="truncate text-muted">{f.listingStatus(x.s)}</span>
                    <span className="ml-auto font-bold tabular">{s.listings.byStatus[x.s]}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {!s.tenant.hasTenantProfile && (
            <section className="card flex flex-col gap-4 overflow-hidden border-dashed p-5 sm:flex-row sm:items-center sm:p-6">
              <IconTile icon={UserRound} tone="link" size="lg" />
              <p className="flex-1 text-[15px]">{t('tenantProfileMissing')}</p>
              <Button asChild variant="secondary" size="sm">
                <Link href="/account/profile?tab=tenant">
                  <Sparkles className="size-4" strokeWidth={2} aria-hidden />
                  {t('tenantProfileAction')}
                </Link>
              </Button>
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <SectionCard
            id="upcoming"
            title={t('upcomingTitle')}
            icon={CalendarDays}
            tone="link"
            flush
            action={
              <Link href="/account/viewings" className="text-small font-semibold text-link hover:underline">
                {t('allViewings')}
              </Link>
            }
          >
            {p.upcomingViewings.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <IconTile icon={CalendarDays} tone="neutral" size="lg" />
                <p className="text-small text-muted">{t('noUpcoming')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {p.upcomingViewings.map((v) => {
                  const tile = tbTileParts(v.startsAt, f.locale);
                  return (
                    <li key={v.id}>
                      <Link href={`/account/viewings?v=${v.id}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-2/60">
                        <DateTile day={tile.day} month={tile.month} tone={v.myRole === 'host' ? 'primary' : 'accent'} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-small font-bold tabular">
                            {tbTime(v.startsAt)}
                            <span className="text-muted" aria-hidden>
                              ·
                            </span>
                            <span className="inline-flex items-center gap-1 font-medium text-muted">
                              {v.mode === 'video' ? <Video className="size-3.5" strokeWidth={2} aria-hidden /> : <MapPin className="size-3.5" strokeWidth={2} aria-hidden />}
                              {v.mode === 'video' ? t('modeVideo') : t('modeOnsite')}
                            </span>
                          </div>
                          <div className="line-clamp-1 text-[15px] font-medium">{v.title}</div>
                          <div className="text-[13px] text-muted">{v.myRole === 'host' ? t('roleHost') : t('roleVisitor')}</div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <section aria-labelledby="tenant" className="flex flex-col gap-3">
            <h2 id="tenant" className="px-1 text-[18px] font-bold tracking-tight">
              {t('tenantTitle')}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { href: '/account/favorites', label: t('favorites'), value: s.tenant.favorites, icon: Heart, tone: 'danger' as const },
                { href: '/account/saved-searches', label: t('savedSearches'), value: s.tenant.savedSearches, icon: Search, tone: 'link' as const },
                { href: '/account/offers?box=sent', label: t('offersSent'), value: s.tenant.offersSent, icon: FileSignature, tone: 'primary' as const },
              ].map((c) => (
                <Link key={c.href} href={c.href} className="card card-hover flex flex-col gap-2 p-3.5">
                  <IconTile icon={c.icon} tone={c.tone} size="sm" />
                  <span className="text-[24px] font-bold leading-7 tabular">{f.number(c.value)}</span>
                  <span className="text-[13px] leading-tight text-muted">{c.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
