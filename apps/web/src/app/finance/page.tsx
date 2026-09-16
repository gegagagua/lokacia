import type { Metadata } from 'next';
import { pageMetadata } from '@/components/portal/seo';
import { getTranslations } from 'next-intl/server';
import { Banknote, Building2, Hammer, Send, ShieldCheck, Truck, Umbrella, UserCheck } from 'lucide-react';
import type { FinanceProductDto, ListingDetail } from '@lokacia/contracts';
import { getFormat } from '@/i18n/server';
import { cn, EmptyState } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { IconTile, PageHero, SectionHeading } from '@/components/billing/page-parts';
import { PartnerLogo } from '@/components/billing/partner-logo';
import { ApplyButton } from './apply-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('finance');
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: '/finance' });
}

const KINDS = ['fitout_loan', 'leasing', 'insurance'] as const;
const KIND_META = {
  fitout_loan: { icon: Hammer, tone: 'primary' },
  leasing: { icon: Truck, tone: 'link' },
  insurance: { icon: Umbrella, tone: 'accent' },
} as const;

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ listing?: string; product?: string }> }) {
  const t = await getTranslations('finance');
  const fmt = await getFormat();
  const sp = await searchParams;
  const listingId = sp.listing && /^[0-9a-f-]{36}$/i.test(sp.listing) ? sp.listing : null;
  const [products, session, listing] = await Promise.all([
    apiOrNull<FinanceProductDto[]>('/v1/finance/products', { auth: false, revalidate: 120 }).catch(() => null),
    getSession(),
    listingId ? apiOrNull<ListingDetail>(`/v1/listings/${listingId}`, { auth: false, revalidate: 300 }).catch(() => null) : Promise.resolve(null),
  ]);
  const active = (products ?? []).filter((p) => p.active);
  const steps = [
    { icon: Banknote, text: t('how.s1') },
    { icon: Send, text: t('how.s2') },
    { icon: UserCheck, text: t('how.s3') },
  ];

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_380px_at_90%_-10%,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_70%),radial-gradient(700px_360px_at_0%_110%,color-mix(in_srgb,var(--primary-500)_14%,transparent),transparent_70%)]" />
        <div className="container-page relative py-12 md:py-16">
          <PageHero
            eyebrow={t('eyebrow')}
            eyebrowIcon={<Banknote className="size-3.5" strokeWidth={2} aria-hidden />}
            title={t('title')}
            lead={t('subtitle')}
            actions={
              listing ? (
                <p className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-4 text-small shadow-xs">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-soft-text">
                    <Building2 className="size-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 truncate">{t('forListing', { title: listing.title })}</span>
                </p>
              ) : undefined
            }
            aside={
              <div className="card p-5 md:p-6">
                <p className="mb-4 text-small font-semibold text-muted">{t('how.title')}</p>
                <ol className="relative flex flex-col gap-1">
                {steps.map(({ icon: Icon, text }, i) => (
                  <li key={text} className="relative flex items-start gap-4 pb-4 last:pb-0">
                    {i < steps.length - 1 && <span aria-hidden className="absolute left-[21px] top-12 h-[calc(100%-44px)] w-px bg-border-strong" />}
                    <IconTile icon={Icon} tone={i === 2 ? 'success' : 'primary'} />
                    <div className="pt-1">
                      <div className="text-small font-semibold text-muted tabular">{t('how.step', { n: i + 1 })}</div>
                      <div className="font-medium">{text}</div>
                    </div>
                  </li>
                ))}
                </ol>
              </div>
            }
          />
        </div>
      </section>

      <div className="container-page">
        {!active.length ? (
          <EmptyState className="mt-12" icon={<Banknote className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} description={t('emptyText')} />
        ) : (
          KINDS.map((kind) => {
            const items = active.filter((p) => p.kind === kind);
            if (!items.length) return null;
            const meta = KIND_META[kind];
            return (
              <section key={kind} aria-labelledby={`k-${kind}`} className="pt-14 md:pt-20">
                <div className="flex items-center gap-4">
                  <IconTile icon={meta.icon} tone={meta.tone} size="lg" />
                  <SectionHeading id={`k-${kind}`} title={t(`kinds.${kind}`)} lead={t(`kindLead.${kind}`)} />
                </div>
                <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => {
                    const highlighted = sp.product === p.id;
                    return (
                      <article key={p.id} className={cn('card card-hover flex flex-col p-6', highlighted && 'border-primary ring-1 ring-primary')}>
                        <div className="flex items-center gap-3">
                          <PartnerLogo name={p.partner} />
                          <div className="min-w-0">
                            <div className="truncate text-small font-semibold">{p.partner}</div>
                            <div className="text-small text-muted">{t('partner')}</div>
                          </div>
                          <span className="ml-auto inline-flex h-7 shrink-0 items-center rounded-full bg-surface-2 px-2.5 text-[12.5px] font-semibold text-muted">{t(`kinds.${kind}`)}</span>
                        </div>
                        <h3 className="mt-5 text-[20px] font-bold leading-tight tracking-tight">{p.name}</h3>
                        <p className="mt-2 flex-1 text-[15px] text-muted">{p.description}</p>
                        {p.rateText && (
                          <div className="mt-5 rounded-2xl bg-primary-soft px-4 py-3">
                            <div className="text-small font-medium text-primary-soft-text">{t('rate')}</div>
                            <div className="text-[22px] font-bold leading-tight tracking-tight text-primary-soft-text tabular">{p.rateText}</div>
                          </div>
                        )}
                        {(p.minAmountMinor || p.maxAmountMinor) && (
                          <dl className="mt-3 flex items-baseline justify-between gap-3 border-b border-dashed border-border-strong pb-3 text-[15px]">
                            <dt className="text-muted">{t('amountRange')}</dt>
                            <dd className="text-right font-semibold tabular">
                              {p.minAmountMinor ? fmt.money(p.minAmountMinor) : '—'} – {p.maxAmountMinor ? fmt.money(p.maxAmountMinor) : '—'}
                            </dd>
                          </dl>
                        )}
                        <ApplyButton product={p} loggedIn={!!session} listing={listing ? { id: listing.id, title: listing.title } : null} defaultOpen={highlighted && !!session} />
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
        <aside className="mt-16 flex max-w-3xl items-start gap-3 rounded-card border border-border bg-surface-2 p-5 text-small text-muted">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={2} aria-hidden />
          <p>{t('disclaimer')}</p>
        </aside>
      </div>
    </div>
  );
}
