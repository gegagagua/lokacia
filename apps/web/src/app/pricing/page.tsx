import type { Metadata } from 'next';
import { pageMetadata } from '@/components/portal/seo';
import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeftRight, ArrowRight, BarChart3, Briefcase, Building2, Check, ChevronDown, Code2, HardHat, Mail, Minus, Rocket, ShieldCheck, Sparkles, User, Wrench } from 'lucide-react';
import type { PlanDto, PlansResponse } from '@lokacia/contracts';
import { getFormat } from '@/i18n/server';
import { Button, cn } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { IconTile, PageHero, SectionHeading } from '@/components/billing/page-parts';
import { PlanBuyButton } from './plan-buy-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('billing.pricing');
  const title = t('metaTitle');
  const description = t('metaDescription');
  return pageMetadata({ title, description, path: '/pricing' });
}

const MATRIX: { key: string; plans: Record<string, boolean | string> }[] = [
  { key: 'listings', plans: { free: '1', owner: '5', broker: '∞', broker_pro: '∞', agency: '∞', developer: '∞' } },
  { key: 'stats', plans: { free: false, owner: true, broker: true, broker_pro: true, agency: true, developer: true } },
  { key: 'crm', plans: { free: false, owner: false, broker: true, broker_pro: true, agency: true, developer: false } },
  { key: 'automation', plans: { free: false, owner: false, broker: false, broker_pro: true, agency: true, developer: false } },
  { key: 'ai', plans: { free: false, owner: false, broker: false, broker_pro: true, agency: true, developer: true } },
  { key: 'team', plans: { free: false, owner: false, broker: false, broker_pro: false, agency: true, developer: true } },
  { key: 'feeds', plans: { free: false, owner: false, broker: false, broker_pro: true, agency: true, developer: false } },
  { key: 'offplan', plans: { free: false, owner: false, broker: false, broker_pro: false, agency: false, developer: true } },
];
const COLS = ['free', 'owner', 'broker', 'broker_pro', 'agency', 'developer'] as const;
const FAQ = ['promo', 'cancel', 'vip', 'reports', 'payment', 'invoice', 'commission', 'api'] as const;
const RECOMMENDED = 'broker_pro';
const PLAN_ICON = { owner: User, broker: Briefcase, broker_pro: Rocket, agency: Building2 } as const;

export default async function PricingPage() {
  const t = await getTranslations('billing.pricing');
  const fmt = await getFormat();
  const [data, session] = await Promise.all([apiOrNull<PlansResponse>('/v1/billing/plans', { auth: false, revalidate: 60 }).catch(() => null), getSession()]);
  const plans = new Map((data?.plans ?? []).filter((p) => p.active).map((p) => [p.key, p]));
  const promo = !!data?.promoActive;
  const orgs = session?.orgs ?? [];

  /** Big tier price: promo shows 0 ₾ with the regular price struck through. */
  const bigPrice = (p: PlanDto, suffix: string) => (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-[40px] font-bold leading-none tracking-tight tabular">{promo ? '0 ₾' : fmt.money(p.priceMinor)}</span>
      {promo && <span className="text-[17px] font-medium text-muted line-through decoration-1 tabular">{fmt.money(p.priceMinor)}</span>}
      <span className="text-small text-muted">{suffix}</span>
    </div>
  );
  /** Inline price for service rows. */
  const rowPrice = (p: PlanDto | undefined, suffix?: string) =>
    !p ? '—' : (
      <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5">
        {promo && <span className="font-bold text-success">0 ₾</span>}
        <span className={promo ? 'text-small font-normal text-muted line-through decoration-1' : 'font-semibold'}>{fmt.money(p.priceMinor)}</span>
        {suffix && <span className="text-small font-normal text-muted">{suffix}</span>}
      </span>
    );

  const subscriptions: { key: keyof typeof PLAN_ICON; audience: string; note?: string }[] = [
    { key: 'owner', audience: t('aud.owner') },
    { key: 'broker', audience: t('aud.broker') },
    { key: 'broker_pro', audience: t('aud.broker') },
    { key: 'agency', audience: t('aud.agency'), note: t('fromNote') },
  ];

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((k) => ({ '@type': 'Question', name: t(`faq.${k}.q`), acceptedAnswer: { '@type': 'Answer', text: t(`faq.${k}.a`) } })),
  };

  const developer = plans.get('developer');

  return (
    <div className="pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_50%_-10%,color-mix(in_srgb,var(--primary-500)_16%,transparent),transparent_70%),radial-gradient(600px_300px_at_90%_10%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_70%)]" />
        <div className="container-page relative pb-12 pt-12 md:pb-16 md:pt-20">
          <PageHero center eyebrow={t('eyebrow')} eyebrowIcon={<Sparkles className="size-3.5" strokeWidth={2} aria-hidden />} title={t('title')} lead={t('subtitle')} />
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-small text-muted">
            {(['trustGel', 'trustCancel', 'trustInvoice'] as const).map((k) => (
              <li key={k} className="inline-flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-primary-soft text-primary-soft-text">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {t(k)}
              </li>
            ))}
          </ul>

          {promo && (
            <div role="status" className="hero-gradient relative mx-auto mt-10 max-w-5xl overflow-hidden rounded-modal p-6 shadow-lg md:p-8">
              <div aria-hidden className="absolute -right-16 -top-20 size-64 rounded-full bg-[radial-gradient(circle,rgb(240_189_58/0.45),transparent_65%)]" />
              <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/12 text-[#f7d67a] ring-1 ring-white/20">
                    <Sparkles className="size-6" strokeWidth={2} aria-hidden />
                  </span>
                  <div>
                    <span className="inline-flex h-6 items-center rounded-full bg-[#f0bd3a] px-2.5 text-[12.5px] font-bold text-[#17201d]">{t('promoBadge')}</span>
                    <p className="mt-2 text-[24px] font-bold leading-tight tracking-tight md:text-[28px]">
                      <span className="text-gradient">{t('promoTitle')}</span>
                    </p>
                    <p className="mt-1 text-[#d6e5df]">{t('promoText', { date: data?.promoUntil ? fmt.date(data.promoUntil) : '' })}</p>
                  </div>
                </div>
                {data?.promoUntil && (
                  <div className="shrink-0 rounded-2xl bg-white/10 px-5 py-3 text-left ring-1 ring-white/15 md:text-right">
                    <div className="text-small text-[#c3d6cf]">{t('promoUntilLabel')}</div>
                    <div className="text-[20px] font-bold tabular">{fmt.date(data.promoUntil)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Subscriptions */}
      <section aria-labelledby="subs" className="container-page pt-14 md:pt-20">
        <SectionHeading id="subs" title={t('subscriptions')} lead={t('subscriptionsLead')} />
        <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
          {subscriptions.map(({ key, audience, note }) => {
            const p = plans.get(key);
            if (!p) return null;
            const needsOrg = p.audience === 'org';
            const eligible = orgs.filter((o) => o.type === 'agency' && o.role === 'manager');
            const rec = key === RECOMMENDED;
            return (
              <article
                key={key}
                aria-labelledby={`plan-${key}`}
                className={cn(
                  'relative flex flex-col rounded-card border bg-surface p-6 transition-all duration-200 ease-out',
                  rec ? 'border-primary shadow-lg ring-1 ring-primary xl:-translate-y-3' : 'border-border shadow-sm hover:-translate-y-1 hover:shadow-md',
                )}
              >
                {rec && (
                  <>
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-card bg-gradient-to-b from-primary-soft to-transparent" />
                    <span className="absolute -top-3.5 left-6 inline-flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 text-[12.5px] font-semibold text-primary-contrast shadow-sm">
                      <Sparkles className="size-3.5" strokeWidth={2} aria-hidden />
                      {t('recommended')}
                    </span>
                  </>
                )}
                <div className="relative flex items-center gap-3">
                  <IconTile icon={PLAN_ICON[key]} tone={rec ? 'primary' : key === 'agency' ? 'link' : 'primary'} />
                  <div className="min-w-0">
                    <div className="text-small font-medium text-muted">{audience}</div>
                    <h3 id={`plan-${key}`} className="text-[20px] font-bold leading-tight tracking-tight">
                      {p.nameKa}
                    </h3>
                  </div>
                </div>
                <div className="relative mt-6">{bigPrice(p, note ? `${t('perMonth')} ${note}` : t('perMonth'))}</div>
                {needsOrg && p.limits.seats && <div className="mt-2 text-small text-muted">{t('seatsIncluded', { n: p.limits.seats })}</div>}
                <PlanBuyButton planKey={key} loggedIn={!!session} orgs={needsOrg ? eligible.map((o) => ({ id: o.id, name: o.name })) : null} label={promo ? t('startFree') : t('subscribe')} variant={rec ? 'primary' : 'secondary'} className="relative mt-6" />
                <div className="my-6 h-px bg-border" aria-hidden />
                <p className="text-small font-semibold">{t('includes')}</p>
                <ul className="mt-3 flex flex-1 flex-col gap-2.5 text-[15px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', rec ? 'bg-primary text-primary-contrast' : 'bg-primary-soft text-primary-soft-text')}>
                        <Check className="size-3" strokeWidth={3} aria-hidden />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        {/* Developer / enterprise band */}
        <article aria-labelledby="plan-developer" className="relative mt-6 overflow-hidden rounded-card border border-border bg-surface p-6 shadow-sm md:p-8">
          <div aria-hidden className="drawing-grid pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 opacity-70 [mask-image:linear-gradient(to_left,black,transparent)] lg:block" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <IconTile icon={HardHat} tone="accent" size="lg" />
              <div className="min-w-0">
                <div className="text-small font-medium text-muted">{t('aud.developer')}</div>
                <h3 id="plan-developer" className="text-[22px] font-bold leading-tight tracking-tight">
                  {developer?.nameKa ?? t('developerName')}
                </h3>
                <div className="mt-2 text-[20px] font-bold tracking-tight">{t('custom')}</div>
              </div>
            </div>
            <ul className="grid gap-2.5 text-[15px] sm:grid-cols-2">
              {(developer?.features ?? []).map((f) => (
                <li key={f} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[#7a5200] dark:text-accent">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild variant="accent" size="lg">
              <a href="mailto:sales@lokacia.ge">
                <Mail className="size-4" strokeWidth={2} aria-hidden />
                {t('contactSales')}
              </a>
            </Button>
          </div>
        </article>
      </section>

      {/* One-time services */}
      <section aria-labelledby="one-time" className="container-page pt-16 md:pt-24">
        <SectionHeading id="one-time" eyebrow={t('oneTimeEyebrow')} title={t('oneTime')} lead={t('oneTimeLead')} />
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ServiceCard icon={Sparkles} tone="accent" title={t('vipTitle')} text={t('vipText')}>
            <dl className="mt-5 divide-y divide-border rounded-2xl bg-surface-2 px-4">
              {['vip_7', 'vip_30'].map((k) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-3">
                  <dt>{t('days', { n: plans.get(k)?.days ?? (k === 'vip_7' ? 7 : 30) })}</dt>
                  <dd className="tabular">{rowPrice(plans.get(k))}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="accent" className="mt-5 w-full">
              <Link href={session ? '/account/listings' : '/login?next=/account/listings'}>{t('vipCta')}</Link>
            </Button>
          </ServiceCard>

          <ServiceCard icon={BarChart3} tone="primary" title={t('reportsTitle')} text={t('reportsText')}>
            <dl className="mt-5 divide-y divide-border rounded-2xl bg-surface-2 px-4">
              {['report_basic', 'report_pro'].map((k) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-3">
                  <dt className="min-w-0">{plans.get(k)?.nameKa ?? k}</dt>
                  <dd className="tabular">{rowPrice(plans.get(k))}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link href="/reports">
                {t('reportsCta')}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Link>
            </Button>
          </ServiceCard>

          <ServiceCard icon={ArrowLeftRight} tone="link" title={t('transferTitle')} text={t('transferText')}>
            <dl className="mt-5 divide-y divide-border rounded-2xl bg-surface-2 px-4">
              <div className="flex items-baseline justify-between gap-3 py-3">
                <dt>{t('transferPaid')}</dt>
                <dd className="tabular">{rowPrice(plans.get('transfer_listing'))}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 py-3">
                <dt>{t('transferCommission')}</dt>
                <dd className="font-semibold tabular">1–2%</dd>
              </div>
            </dl>
          </ServiceCard>

          <ServiceCard icon={Wrench} tone="success" title={t('servicesTitle')} text={t('servicesText')}>
            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-[40px] font-bold leading-none tracking-tight tabular">8–12%</span>
              <span className="text-small text-muted">{t('commissionLabel')}</span>
            </div>
            <Link href="/services" className="mt-5 inline-flex items-center gap-1.5 font-semibold text-link hover:underline">
              {t('servicesCta')}
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          </ServiceCard>

          <article className="relative flex flex-col overflow-hidden rounded-card border border-[#1f2c27] bg-[#0b1411] p-6 text-[#edf3f0] shadow-md dark:border-[#4cc3a2]/25 lg:col-span-2">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[radial-gradient(circle,rgb(76_195_162/0.28),transparent_65%)]" />
            <div className="relative flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#133029] text-[#8fe0c8]">
                <Code2 className="size-5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-[20px] font-bold leading-tight tracking-tight">{t('apiTitle')}</h3>
                <p className="mt-1.5 text-[#a3b5ae]">{t('apiText')}</p>
              </div>
            </div>
            <dl className="relative mt-5 grid gap-3 sm:grid-cols-2">
              {['api_basic', 'api_pro'].map((k) => {
                const p = plans.get(k);
                return (
                  <div key={k} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                    <dt className="text-small text-[#a3b5ae]">{p?.nameKa ?? k}</dt>
                    <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 tabular">
                      {!p ? (
                        '—'
                      ) : (
                        <>
                          <span className="text-[26px] font-bold tracking-tight">{promo ? '0 ₾' : fmt.money(p.priceMinor)}</span>
                          {promo && <span className="text-small text-[#a3b5ae] line-through">{fmt.money(p.priceMinor)}</span>}
                          <span className="text-small text-[#a3b5ae]">{t('perMonth')}</span>
                        </>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <div className="relative mt-5">
              <Link href="/api-access" className="inline-flex h-11 items-center gap-2 rounded-button bg-[#4cc3a2] px-5 text-[15px] font-semibold text-[#06120e] transition-all hover:bg-[#6ad2b5] focus-visible:shadow-ring focus-visible:outline-none">
                {t('apiCta')}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* Compare */}
      <section aria-labelledby="compare" className="container-page pt-16 md:pt-24">
        <SectionHeading id="compare" title={t('compare')} lead={t('compareLead')} />
        <div className="mt-8 overflow-hidden rounded-card border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th scope="col" className="sticky left-0 z-10 bg-surface-2 px-5 py-4 text-left text-small font-semibold text-muted">
                    {t('feature')}
                  </th>
                  {COLS.map((c) => (
                    <th key={c} scope="col" className={cn('px-4 py-4 text-center font-semibold', c === RECOMMENDED && 'bg-primary-soft text-primary-soft-text')}>
                      {c === 'free' ? t('free') : (plans.get(c)?.nameKa ?? c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.key} className="border-b border-border transition-colors last:border-0 hover:bg-surface-2/60">
                    <th scope="row" className="sticky left-0 z-10 bg-surface px-5 py-3.5 text-left font-medium">
                      {t(`matrix.${row.key}`)}
                    </th>
                    {COLS.map((c) => {
                      const v = row.plans[c];
                      return (
                        <td key={c} className={cn('px-4 py-3.5 text-center tabular', c === RECOMMENDED && 'bg-primary-soft/40')}>
                          {typeof v === 'string' ? (
                            <span className="font-semibold">{v}</span>
                          ) : v ? (
                            <span className="mx-auto grid size-6 place-items-center rounded-full bg-primary-soft text-primary-soft-text">
                              <Check className="size-3.5" strokeWidth={3} aria-label={t('yes')} />
                            </span>
                          ) : (
                            <Minus className="mx-auto size-4 text-border-strong" strokeWidth={2} aria-label={t('no')} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="container-page pt-16 md:pt-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionHeading id="faq" eyebrow={t('faqEyebrow')} title={t('faqTitle')} lead={t('faqLead')} />
            <div className="mt-6 rounded-card border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <IconTile icon={ShieldCheck} tone="success" size="sm" />
                <p className="font-semibold">{t('faqContactTitle')}</p>
              </div>
              <p className="mt-2 text-small text-muted">{t('faqContactText')}</p>
              <a href="mailto:sales@lokacia.ge" className="mt-3 inline-flex items-center gap-1.5 text-small font-semibold text-link hover:underline">
                <Mail className="size-4" strokeWidth={2} aria-hidden />
                sales@lokacia.ge
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {FAQ.map((k, i) => (
              <details key={k} open={i === 0} className="group rounded-card border border-border bg-surface shadow-xs transition-shadow open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-4 text-[16px] font-semibold focus-visible:shadow-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  {t(`faq.${k}.q`)}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted transition-transform duration-200 group-open:rotate-180 group-open:bg-primary-soft group-open:text-primary-soft-text">
                    <ChevronDown className="size-4" strokeWidth={2} aria-hidden />
                  </span>
                </summary>
                <p className="px-5 pb-5 text-muted">{t(`faq.${k}.a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ServiceCard({ icon, tone, title, text, children }: { icon: React.ComponentProps<typeof IconTile>['icon']; tone: React.ComponentProps<typeof IconTile>['tone']; title: string; text: string; children?: React.ReactNode }) {
  return (
    <article className="card card-hover flex flex-col p-6">
      <IconTile icon={icon} tone={tone} />
      <h3 className="mt-4 text-[20px] font-bold leading-tight tracking-tight">{title}</h3>
      <p className="mt-1.5 flex-1 text-muted">{text}</p>
      {children}
    </article>
  );
}
