import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ArrowUpRight, CalendarDays, ClipboardList, FileDown, LayoutGrid, MapPin, Phone, Presentation } from 'lucide-react';
import { DEAL_TYPE_LABELS_KA, formatArea, formatDateKa, type PublicPresentation } from '@lokacia/contracts';
import { cn, EmptyState, Logo, PriceTag, SpacePlan } from '@lokacia/ui';
import { PersonAvatar } from '@/components/common/ui';
import { OpenTracker } from '@/components/marketing/open-tracker';
import { apiOrNull } from '@/lib/api-server';
import { heroProps, OrgBrandMark, validBrand } from '../../brand';

async function load(token: string) {
  return apiOrNull<PublicPresentation>(`/v1/crm/presentations/public/${encodeURIComponent(token)}`, { auth: false });
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const t = await getTranslations('marketing.public');
  const p = await load(token);
  return { title: p ? `${p.title} · ${p.org.name}` : t('metaTitle'), robots: { index: false, follow: false, nocache: true }, referrer: 'no-referrer' };
}

/** C10 public branded presentation (tokenized, no login). */
export default async function PublicPresentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('marketing.public');
  const p = await load(token);
  if (!p) {
    return (
      <div className="drawing-grid grid min-h-dvh place-items-center px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-5">
          <Logo />
          <EmptyState title={t('notFound')} description={t('notFoundHint')} className="w-full border-solid bg-surface shadow-md" />
        </div>
      </div>
    );
  }
  const brand = validBrand(p.org.brandColor);
  const hero = heroProps(brand);
  const pdfHref = `/api/v1/crm/presentations/public/${encodeURIComponent(token)}/pdf`;
  const contactLine = [p.org.phone, p.org.website?.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ');
  return (
    <div>
      <OpenTracker token={token} />
      <header className="glass sticky top-0 z-30 border-b border-border/70">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <OrgBrandMark name={p.org.name} logoUrl={p.org.logoUrl} brand={brand} size={38} />
            <div className="min-w-0">
              <div className="truncate font-bold leading-tight tracking-tight">{p.org.name}</div>
              {contactLine && <div className="truncate text-[13px] text-muted tabular">{contactLine}</div>}
            </div>
          </div>
          <a href={pdfHref} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[14px] font-semibold shadow-xs transition-all hover:border-border-strong hover:shadow-sm sm:px-4">
            <FileDown className="size-4" strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">{t('pdf')}</span>
            <span className="sr-only sm:hidden">{t('pdf')}</span>
          </a>
        </div>
      </header>

      <section className="container-page pt-4 md:pt-6">
        <div className={cn('relative overflow-hidden rounded-modal px-5 py-9 shadow-md md:px-12 md:py-14', hero.className)} style={hero.style}>
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full border border-white/10" />
          <div aria-hidden className="pointer-events-none absolute right-10 top-16 size-44 rounded-full border border-white/10" />
          {p.listings.some((l) => l.cover) && (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-10 hidden w-[380px] xl:block">
              {p.listings
                .filter((l) => l.cover)
                .slice(0, 3)
                .map((l, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={l.id}
                    src={l.cover!}
                    alt=""
                    className="absolute aspect-[4/3] w-60 rounded-photo object-cover shadow-lg ring-4 ring-white/15"
                    style={[{ top: '14%', right: '0', transform: 'rotate(4deg)' }, { top: '40%', right: '140px', transform: 'rotate(-5deg)' }, { top: '62%', right: '10px', transform: 'rotate(2deg)' }][i]}
                  />
                ))}
            </div>
          )}
          <div className="relative max-w-3xl xl:max-w-[600px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/20">
                <Presentation className="size-3.5" strokeWidth={2} aria-hidden />
                {t('eyebrow')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] text-white/85 tabular">
                <CalendarDays className="size-3.5" strokeWidth={2} aria-hidden />
                {formatDateKa(p.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] text-white/85 tabular">
                <LayoutGrid className="size-3.5" strokeWidth={2} aria-hidden />
                {t('spaces', { count: p.listings.length })}
              </span>
            </div>
            <h1 className="mt-5 text-[34px] font-bold leading-[1.12] tracking-tight text-white md:text-display">{p.title}</h1>
            {p.contactName && <p className="mt-3 text-[16px] font-medium text-[#f7d67a]">{t('preparedFor', { name: p.contactName })}</p>}
            {p.message && <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[16px] leading-relaxed text-white/80 md:text-[17px]">{p.message}</p>}
            {p.agent && (
              <div className="mt-7 inline-flex max-w-full items-center gap-3 rounded-full bg-white/10 py-1.5 pl-1.5 pr-5 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                <span className="rounded-full bg-surface">
                  <PersonAvatar name={p.agent.name} src={p.agent.avatarUrl} size={40} />
                </span>
                <div className="min-w-0">
                  <div className="text-[12px] leading-4 text-white/70">{t('agent')}</div>
                  <div className="truncate font-semibold leading-5 text-white">{p.agent.name}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container-page flex flex-col gap-8 py-10 md:gap-10 md:py-14">
        {p.listings.map((l, i) => (
          <article key={l.id} className="grid overflow-hidden rounded-card border border-border bg-surface shadow-sm lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3 p-2 lg:p-3">
              <div className="group relative aspect-[4/3] overflow-hidden rounded-photo bg-surface-2">
                {l.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.cover} alt={l.title} className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" loading={i > 0 ? 'lazy' : 'eager'} />
                ) : (
                  <div className="drawing-grid size-full" />
                )}
                <span className="absolute left-3 top-3 grid size-11 place-items-center rounded-2xl bg-surface/95 text-[17px] font-bold tabular shadow-sm">{String(i + 1).padStart(2, '0')}</span>
                <span className="absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-[13px] font-semibold text-accent-contrast shadow-sm">{DEAL_TYPE_LABELS_KA[l.dealType]}</span>
              </div>
              <div className="hidden items-center gap-5 rounded-photo border border-border bg-surface-2/60 p-4 lg:flex">
                <div className="w-36 shrink-0 text-[13px] font-semibold text-muted">{t('plan')}</div>
                <div className="mx-auto w-full max-w-[240px]">
                <SpacePlan areaM2={l.areaM2} widthM={l.passport.widthM} depthM={l.passport.depthM} ceilingM={l.passport.ceilingM} powerKw={l.passport.powerKw} />
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-5 p-5 md:p-7">
              <div>
                <h2 className="text-[24px] font-bold leading-tight tracking-tight md:text-[30px] md:leading-[38px]">{l.title}</h2>
                <p className="mt-2 inline-flex items-start gap-1.5 text-[14.5px] text-muted">
                  <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
                  <span>
                    {l.address}
                    {l.districtName ? `, ${l.districtName}` : ''}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-surface-2 p-4">
                <PriceTag priceMinor={l.priceMinor} currency={l.currency} period={l.pricePeriod} areaM2={l.areaM2} size="lg" />
                <div className="text-right">
                  <div className="text-[13px] font-medium text-muted">{t('area')}</div>
                  <div className="text-[28px] font-bold leading-9 tracking-tight tabular">{formatArea(l.areaM2)}</div>
                </div>
              </div>
              <div>
                <h3 className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold">
                  <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary-soft-text" aria-hidden>
                    <ClipboardList className="size-4" strokeWidth={2} />
                  </span>
                  {t('specs')}
                </h3>
                {l.specs.length ? (
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {l.specs.map((s) => (
                      <div key={s.key} className="flex min-w-0 flex-col-reverse rounded-xl border border-border px-3 py-2">
                        <dt className="truncate text-[12.5px] text-muted">{s.label}</dt>
                        <dd className="truncate text-[15px] font-semibold tabular">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-small text-muted">{t('noSpecs')}</p>
                )}
              </div>
              {l.description && <p className="line-clamp-6 whitespace-pre-wrap text-[15px] leading-relaxed text-text/85">{l.description}</p>}
              <div className="rounded-photo border border-border bg-surface-2/60 p-4 lg:hidden">
                <div className="mb-2 text-[13px] font-semibold text-muted">{t('plan')}</div>
                <div className="mx-auto max-w-[240px]">
                  <SpacePlan areaM2={l.areaM2} widthM={l.passport.widthM} depthM={l.passport.depthM} ceilingM={l.passport.ceilingM} powerKw={l.passport.powerKw} />
                </div>
              </div>
              <a href={l.portalUrl} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-primary-soft px-4 py-2 text-[14px] font-semibold text-primary-soft-text transition-colors hover:bg-primary hover:text-primary-contrast">
                {t('viewOnPortal')}
                <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden />
              </a>
            </div>
          </article>
        ))}

        {p.agent && (
          <section aria-labelledby="agent-cta" className={cn('relative overflow-hidden rounded-modal p-6 shadow-md md:p-10', hero.className)} style={hero.style}>
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <span className="shrink-0 rounded-full bg-surface ring-4 ring-white/20">
                  <PersonAvatar name={p.agent.name} src={p.agent.avatarUrl} size={64} />
                </span>
                <div className="min-w-0">
                  <h2 id="agent-cta" className="text-[22px] font-bold leading-tight text-white md:text-[26px]">{t('contactTitle')}</h2>
                  <p className="mt-1 max-w-lg text-[15px] text-white/75">{t('contactBody')}</p>
                  <p className="mt-2 text-[14px] font-semibold text-white">
                    {p.agent.name} <span className="font-normal text-white/70">· {p.org.name}</span>
                  </p>
                </div>
              </div>
              {p.agent.phone && (
                <a href={`tel:${p.agent.phone}`} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[16px] font-semibold text-accent-contrast shadow-md transition-all hover:-translate-y-0.5 hover:brightness-105">
                  <Phone className="size-4" strokeWidth={2} aria-hidden />
                  <span className="tabular">{p.agent.phone}</span>
                </a>
              )}
            </div>
          </section>
        )}
      </div>

      <footer className="border-t border-border bg-surface">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-small text-muted sm:flex-row">
          <span className="flex items-center gap-2">
            <OrgBrandMark name={p.org.name} logoUrl={p.org.logoUrl} brand={brand} size={24} />
            <span className="font-medium text-text">{p.org.name}</span>
          </span>
          <span className="flex items-center gap-2">
            {t('footer')} <Logo size={18} showGeorgian={false} />
          </span>
        </div>
      </footer>
    </div>
  );
}
