import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FileDown, MapPin, Phone } from 'lucide-react';
import { DEAL_TYPE_LABELS_KA, formatArea, formatDateKa, type PublicPresentation } from '@lokacia/contracts';
import { Avatar, EmptyState, Logo, PriceTag, SpacePlan, SpecRow } from '@lokacia/ui';
import { OpenTracker } from '@/components/marketing/open-tracker';
import { apiOrNull } from '@/lib/api-server';

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
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <EmptyState title={t('notFound')} description={t('notFoundHint')} className="bg-surface" />
        </div>
      </div>
    );
  }
  const brand = p.org.brandColor ?? 'var(--primary)';
  const pdfHref = `/api/v1/crm/presentations/public/${encodeURIComponent(token)}/pdf`;
  return (
    <div className="pb-16">
      <OpenTracker token={token} />
      <div className="h-1 w-full" style={{ background: brand }} aria-hidden />
      <header className="border-b border-border bg-surface">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            {p.org.logoUrl ? <img src={p.org.logoUrl} alt={p.org.name} className="h-9 w-auto max-w-40 object-contain" /> : <span className="grid size-9 place-items-center rounded-button border border-border-strong font-semibold" style={{ color: brand }}>{p.org.name.slice(0, 1)}</span>}
            <div>
              <div className="font-semibold leading-tight">{p.org.name}</div>
              {(p.org.phone || p.org.website) && <div className="text-small text-muted tabular">{[p.org.phone, p.org.website?.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ')}</div>}
            </div>
          </div>
          <a href={pdfHref} className="inline-flex h-10 items-center gap-2 rounded-button border border-border-strong bg-surface px-4 text-[15px] font-medium hover:bg-surface-2">
            <FileDown className="size-4" strokeWidth={1.5} aria-hidden />
            {t('pdf')}
          </a>
        </div>
      </header>

      <section className="container-page py-8">
        <p className="text-small text-muted tabular">
          {formatDateKa(p.createdAt)} · {t('spaces', { count: p.listings.length })}
          {p.contactName ? ` · ${t('preparedFor', { name: p.contactName })}` : ''}
        </p>
        <h1 className="compact mt-1 text-h2 font-semibold md:text-h1">{p.title}</h1>
        {p.message && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-body">{p.message}</p>}
      </section>

      <div className="container-page flex flex-col gap-6">
        {p.listings.map((l, i) => (
          <article key={l.id} className="grid overflow-hidden rounded-card border border-border bg-surface lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-4 p-5">
              <div>
                <div className="text-small text-muted tabular">
                  {String(i + 1).padStart(2, '0')} · {DEAL_TYPE_LABELS_KA[l.dealType]}
                </div>
                <h2 className="compact text-h3 font-semibold md:text-h2">{l.title}</h2>
                <p className="mt-1 inline-flex items-center gap-1 text-small text-muted">
                  <MapPin className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {l.address}
                  {l.districtName ? `, ${l.districtName}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3 border-y border-border py-3">
                <PriceTag priceMinor={l.priceMinor} currency={l.currency} period={l.pricePeriod} areaM2={l.areaM2} size="lg" />
                <span className="compact text-h2 font-semibold tabular">{formatArea(l.areaM2)}</span>
              </div>
              <div>
                <h3 className="mb-1 text-small font-medium text-muted">{t('specs')}</h3>
                {l.specs.length ? (
                  <div className="grid gap-x-6 sm:grid-cols-2">
                    {l.specs.map((s) => (
                      <SpecRow key={s.key} label={s.label} value={s.value} />
                    ))}
                  </div>
                ) : (
                  <p className="text-small text-muted">{t('noSpecs')}</p>
                )}
              </div>
              {l.description && <p className="line-clamp-6 whitespace-pre-wrap text-[15px] leading-relaxed">{l.description}</p>}
              <a href={l.portalUrl} target="_blank" rel="noreferrer" className="text-[15px] text-link underline-offset-4 hover:underline">
                {t('viewOnPortal')}
              </a>
            </div>
            <div className="flex flex-col border-t border-border bg-bg lg:border-l lg:border-t-0">
              {l.cover && <img src={l.cover} alt={l.title} className="aspect-[4/3] w-full object-cover" loading={i > 0 ? 'lazy' : 'eager'} />}
              <div className="p-4">
                <SpacePlan areaM2={l.areaM2} widthM={l.passport.widthM} depthM={l.passport.depthM} ceilingM={l.passport.ceilingM} powerKw={l.passport.powerKw} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {p.agent && (
        <section className="container-page mt-8">
          <div className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-surface p-5">
            <Avatar src={p.agent.avatarUrl} name={p.agent.name} size={56} />
            <div className="min-w-0 flex-1">
              <div className="text-small text-muted">{t('agent')}</div>
              <div className="text-h3 font-semibold">{p.agent.name}</div>
              <div className="text-small text-muted">{p.org.name}</div>
            </div>
            {p.agent.phone && (
              <a href={`tel:${p.agent.phone}`} className="inline-flex h-11 items-center gap-2 rounded-button px-5 font-medium text-primary-contrast" style={{ background: brand }}>
                <Phone className="size-4" strokeWidth={1.5} aria-hidden />
                <span className="tabular">{p.agent.phone}</span>
              </a>
            )}
          </div>
        </section>
      )}
      <footer className="container-page mt-10 flex items-center justify-center gap-2 text-small text-muted">
        {t('footer')} <Logo size={18} showGeorgian={false} />
      </footer>
    </div>
  );
}
