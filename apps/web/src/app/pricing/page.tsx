import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Check, Minus } from 'lucide-react';
import { formatDateKa, formatMoney, type PlanDto, type PlansResponse } from '@lokacia/contracts';
import { Badge, Button, Card } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { absUrl, SITE_NAME } from '@/lib/site';
import { PlanBuyButton } from './plan-buy-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('billing.pricing');
  const title = t('metaTitle');
  const description = t('metaDescription');
  return {
    title,
    description,
    alternates: { canonical: '/pricing' },
    openGraph: { title: `${title} · ${SITE_NAME}`, description, url: absUrl('/pricing'), type: 'website' },
    twitter: { card: 'summary', title, description },
  };
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

export default async function PricingPage() {
  const t = await getTranslations('billing.pricing');
  const [data, session] = await Promise.all([apiOrNull<PlansResponse>('/v1/billing/plans', { auth: false, revalidate: 60 }).catch(() => null), getSession()]);
  const plans = new Map((data?.plans ?? []).filter((p) => p.active).map((p) => [p.key, p]));
  const promo = !!data?.promoActive;
  const orgs = session?.orgs ?? [];
  const price = (p: PlanDto | undefined, suffix?: string) =>
    !p ? '—' : (
      <>
        {promo && <span className="mr-2">0 ₾</span>}
        <span className={promo ? 'text-body font-normal text-muted line-through decoration-1' : ''}>{formatMoney(p.priceMinor)}</span>
        {suffix && <span className="text-small font-normal text-muted"> {suffix}</span>}
      </>
    );

  const subscriptions: { key: string; audience: string; note?: string }[] = [
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

  return (
    <div className="container-page py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <header className="max-w-2xl">
        <h1 className="text-h1 font-semibold">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
      </header>

      {promo && (
        <div role="status" className="mt-6 flex flex-col gap-1 rounded-card border border-accent bg-accent/10 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold">{t('promoTitle')}</div>
            <div className="text-small text-muted">{t('promoText', { date: data?.promoUntil ? formatDateKa(data.promoUntil) : '' })}</div>
          </div>
          <Badge tone="accent">{t('promoBadge')}</Badge>
        </div>
      )}

      <section aria-labelledby="subs" className="mt-10">
        <h2 id="subs" className="text-h2 font-semibold">
          {t('subscriptions')}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map(({ key, audience, note }) => {
            const p = plans.get(key);
            if (!p) return null;
            const needsOrg = p.audience === 'org';
            const eligible = orgs.filter((o) => o.type === 'agency' && o.role === 'manager');
            return (
              <Card key={key} className={`flex flex-col p-5 ${key === 'broker_pro' ? 'border-primary' : ''}`}>
                <div className="text-small text-muted">{audience}</div>
                <h3 className="mt-1 text-h3 font-semibold">{p.nameKa}</h3>
                <div className="compact mt-3 text-h2 font-semibold tabular">
                  {price(p, note ? `${t('perMonth')} ${note}` : t('perMonth'))}
                </div>
                {needsOrg && p.limits.seats && <div className="text-small text-muted">{t('seatsIncluded', { n: p.limits.seats })}</div>}
                <ul className="mt-4 flex flex-1 flex-col gap-2 text-small">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <PlanBuyButton planKey={key} loggedIn={!!session} orgs={needsOrg ? eligible.map((o) => ({ id: o.id, name: o.name })) : null} label={promo ? t('startFree') : t('subscribe')} className="mt-5" />
              </Card>
            );
          })}
          <Card className="flex flex-col p-5">
            <div className="text-small text-muted">{t('aud.developer')}</div>
            <h3 className="mt-1 text-h3 font-semibold">{plans.get('developer')?.nameKa ?? t('developerName')}</h3>
            <div className="compact mt-3 text-h2 font-semibold">{t('custom')}</div>
            <ul className="mt-4 flex flex-1 flex-col gap-2 text-small">
              {(plans.get('developer')?.features ?? []).map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild variant="secondary" className="mt-5">
              <a href="mailto:sales@lokacia.ge">{t('contactSales')}</a>
            </Button>
          </Card>
        </div>
      </section>

      <section aria-labelledby="one-time" className="mt-12">
        <h2 id="one-time" className="text-h2 font-semibold">
          {t('oneTime')}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="p-5">
            <Badge tone="accent">VIP</Badge>
            <h3 className="mt-2 text-h3 font-semibold">{t('vipTitle')}</h3>
            <p className="mt-1 text-small text-muted">{t('vipText')}</p>
            <dl className="mt-3 flex flex-col gap-1">
              {['vip_7', 'vip_30'].map((k) => (
                <div key={k} className="flex justify-between border-b border-border py-1.5 last:border-0">
                  <dt>{t('days', { n: plans.get(k)?.days ?? (k === 'vip_7' ? 7 : 30) })}</dt>
                  <dd className="font-medium tabular">{price(plans.get(k))}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="secondary" className="mt-4 w-full">
              <Link href={session ? '/account/listings' : '/login?next=/account/listings'}>{t('vipCta')}</Link>
            </Button>
          </Card>
          <Card className="p-5">
            <h3 className="text-h3 font-semibold">{t('reportsTitle')}</h3>
            <p className="mt-1 text-small text-muted">{t('reportsText')}</p>
            <dl className="mt-3 flex flex-col gap-1">
              {['report_basic', 'report_pro'].map((k) => (
                <div key={k} className="flex justify-between gap-2 border-b border-border py-1.5 last:border-0">
                  <dt>{plans.get(k)?.nameKa ?? k}</dt>
                  <dd className="font-medium tabular">{price(plans.get(k))}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="secondary" className="mt-4 w-full">
              <Link href="/reports">{t('reportsCta')}</Link>
            </Button>
          </Card>
          <Card className="p-5">
            <h3 className="text-h3 font-semibold">{t('transferTitle')}</h3>
            <p className="mt-1 text-small text-muted">{t('transferText')}</p>
            <dl className="mt-3 flex flex-col gap-1">
              <div className="flex justify-between border-b border-border py-1.5">
                <dt>{t('transferPaid')}</dt>
                <dd className="font-medium tabular">{price(plans.get('transfer_listing'))}</dd>
              </div>
              <div className="flex justify-between py-1.5">
                <dt>{t('transferCommission')}</dt>
                <dd className="font-medium tabular">1–2%</dd>
              </div>
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="text-h3 font-semibold">{t('servicesTitle')}</h3>
            <p className="mt-1 text-small text-muted">{t('servicesText')}</p>
            <div className="compact mt-3 text-h2 font-semibold tabular">8–12%</div>
            <Button asChild variant="link" className="mt-2">
              <Link href="/services">{t('servicesCta')}</Link>
            </Button>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h3 className="text-h3 font-semibold">{t('apiTitle')}</h3>
            <p className="mt-1 text-small text-muted">{t('apiText')}</p>
            <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
              {['api_basic', 'api_pro'].map((k) => (
                <div key={k} className="flex justify-between gap-2 border-b border-border py-1.5">
                  <dt>{plans.get(k)?.nameKa ?? k}</dt>
                  <dd className="font-medium tabular">{price(plans.get(k), t('perMonth'))}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="secondary" className="mt-4">
              <Link href="/api-access">{t('apiCta')}</Link>
            </Button>
          </Card>
        </div>
      </section>

      <section aria-labelledby="compare" className="mt-12">
        <h2 id="compare" className="text-h2 font-semibold">
          {t('compare')}
        </h2>
        <div className="mt-4 overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[640px] border-collapse bg-surface text-small">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="sticky left-0 bg-surface p-3 text-left font-medium">
                  {t('feature')}
                </th>
                {COLS.map((c) => (
                  <th key={c} scope="col" className="p-3 text-left font-medium">
                    {c === 'free' ? t('free') : (plans.get(c)?.nameKa ?? c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <th scope="row" className="sticky left-0 bg-surface p-3 text-left font-normal">
                    {t(`matrix.${row.key}`)}
                  </th>
                  {COLS.map((c) => {
                    const v = row.plans[c];
                    return (
                      <td key={c} className="p-3 tabular">
                        {typeof v === 'string' ? v : v ? <Check className="size-4 text-primary" strokeWidth={1.5} aria-label={t('yes')} /> : <Minus className="size-4 text-muted" strokeWidth={1.5} aria-label={t('no')} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="faq" className="mt-12 max-w-3xl">
        <h2 id="faq" className="text-h2 font-semibold">
          {t('faqTitle')}
        </h2>
        <div className="mt-4 flex flex-col">
          {FAQ.map((k) => (
            <details key={k} className="group border-b border-border py-3">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-45">+</span>
                {t(`faq.${k}.q`)}
              </summary>
              <p className="mt-2 pl-5 text-muted">{t(`faq.${k}.a`)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
