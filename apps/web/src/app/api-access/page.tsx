import type { Metadata } from 'next';
import { pageMetadata } from '@/components/portal/seo';
import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle, ArrowRight, BookOpen, Check, Gauge, KeyRound, ListChecks, Lock, Rocket, Terminal, Timer } from 'lucide-react';
import { API_SCOPES, type PlansResponse } from '@lokacia/contracts';
import { getFormat } from '@/i18n/server';
import { Button, cn } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { absUrl } from '@/lib/site';
import { CodeBlock, IconTile, SectionHeading } from '@/components/billing/page-parts';
import { KeyManager } from './key-manager';
import { PlanBuyButton } from '../pricing/plan-buy-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('developers');
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: '/api-access' });
}

const ENDPOINTS = [
  { path: '/v1/public/districts', params: 'city, businessType', scope: 'districts:read', key: 'districts' },
  { path: '/v1/public/price-index', params: 'city, districtId, months', scope: 'prices:read', key: 'priceIndex' },
  { path: '/v1/public/vacancy', params: 'city', scope: 'vacancy:read', key: 'vacancy' },
  { path: '/v1/public/traffic', params: 'listingId', scope: 'traffic:read', key: 'traffic' },
  { path: '/v1/public/scores', params: 'listingId | city, businessType', scope: 'scores:read', key: 'scores' },
  { path: '/v1/public/reports/market.pdf', params: 'city', scope: 'reports:read', key: 'report' },
  { path: '/v1/public/usage', params: '—', scope: '—', key: 'usage' },
] as const;

const SAMPLE = `{
  "city": "tbilisi",
  "businessType": "cafe",
  "currency": "GEL",
  "items": [
    {
      "slug": "avlabari",
      "name": "ავლაბარი",
      "center": [44.8155, 41.6935],
      "avgPriceM2Minor": 3672,
      "activeCount": 4,
      "vacancyCount": 4,
      "medianAreaM2": 163
    }
  ]
}`;

/** Minimal JSON highlighter for the static sample (keys, strings, numbers). */
function highlightJson(src: string) {
  const parts: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) parts.push(src.slice(last, m.index));
    if (m[1] && m[2]) parts.push(<span key={i++} className="text-[#8fb4f2]">{m[1]}</span>, m[2]);
    else if (m[1]) parts.push(<span key={i++} className="text-[#8fe0c8]">{m[1]}</span>);
    else parts.push(<span key={i++} className="text-[#f7d67a]">{m[3]}</span>);
    last = re.lastIndex;
  }
  parts.push(src.slice(last));
  return parts;
}

export default async function ApiAccessPage() {
  const t = await getTranslations('developers');
  const fmt = await getFormat();
  const [session, plans] = await Promise.all([getSession(), apiOrNull<PlansResponse>('/v1/billing/plans', { auth: false, revalidate: 60 }).catch(() => null)]);
  const apiPlans = (plans?.plans ?? []).filter((p) => p.audience === 'api' && p.active);
  const apiBase = `${absUrl('/api')}/v1`;
  const promo = !!plans?.promoActive;
  const limits = [
    { icon: Timer, text: t('limits.perMinute') },
    { icon: Gauge, text: t('limits.quota') },
    { icon: ListChecks, text: t('limits.headers') },
    { icon: AlertTriangle, text: t('limits.errors') },
  ];

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0a110f] text-[#edf3f0]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_400px_at_85%_0%,rgb(76_195_162/0.22),transparent_65%),radial-gradient(600px_380px_at_0%_100%,rgb(143_180_242/0.14),transparent_65%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="container-page relative grid items-center gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#133029] px-3 py-1 text-[13px] font-semibold text-[#8fe0c8] ring-1 ring-[#4cc3a2]/30">
              <Terminal className="size-3.5" strokeWidth={2} aria-hidden />
              {t('eyebrow')}
            </span>
            <h1 className="mt-4 text-[34px] font-bold leading-[1.25] tracking-tight md:text-h1 md:leading-[1.22] lg:text-display lg:leading-[1.16]">{t('title')}</h1>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-[#a3b5ae] md:text-[19px]">{t('subtitle')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {session ? (
                <a href="#keys" className="inline-flex h-13 items-center gap-2 rounded-button bg-[#4cc3a2] px-6 text-[16px] font-semibold text-[#06120e] shadow-sm transition-all hover:bg-[#6ad2b5] focus-visible:shadow-ring focus-visible:outline-none">
                  <KeyRound className="size-4" strokeWidth={2} aria-hidden />
                  {t('keys.title')}
                </a>
              ) : (
                <Link href="/login?next=/api-access" className="inline-flex h-13 items-center gap-2 rounded-button bg-[#4cc3a2] px-6 text-[16px] font-semibold text-[#06120e] shadow-sm transition-all hover:bg-[#6ad2b5] focus-visible:shadow-ring focus-visible:outline-none">
                  {t('loginForKeys')}
                  <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                </Link>
              )}
              <a href="/api/v1/docs" target="_blank" rel="noopener" className="inline-flex h-13 items-center gap-2 rounded-button bg-white/8 px-6 text-[16px] font-semibold text-[#edf3f0] ring-1 ring-white/15 transition-all hover:bg-white/12 focus-visible:shadow-ring focus-visible:outline-none">
                <BookOpen className="size-4" strokeWidth={2} aria-hidden />
                {t('openapi')}
              </a>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                { v: 'REST', l: t('heroStatFormat') },
                { v: fmt.number(ENDPOINTS.length), l: t('heroStatEndpoints') },
                { v: fmt.number(API_SCOPES.length), l: t('heroStatScopes') },
              ].map((s) => (
                <div key={s.l} className="flex flex-col-reverse">
                  <dt className="mt-1.5 text-small text-[#a3b5ae]">{s.l}</dt>
                  <dd className="text-[26px] font-bold leading-none tracking-tight tabular">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <CodeBlock title="curl" className="border-white/10 shadow-lg">
              <span className="text-[#6b7f78]">$ </span>
              <span className="text-[#8fe0c8]">curl</span> -H <span className="text-[#f7d67a]">&quot;x-api-key: lk_…&quot;</span> \{'\n'}
              {'  '}
              <span className="text-[#8fb4f2]">&quot;{apiBase}/public/districts?city=tbilisi&amp;businessType=cafe&quot;</span>
            </CodeBlock>
            <CodeBlock title={`${t('sample')} · 200 OK`} className="border-white/10 shadow-lg">
              {highlightJson(SAMPLE)}
            </CodeBlock>
          </div>
        </div>
      </section>

      {session && (
        <section id="keys" aria-labelledby="keys-h" className="container-page scroll-mt-24 pt-14 md:pt-20">
          <SectionHeading id="keys-h" eyebrow={t('keys.eyebrow')} title={t('keys.title')} lead={t('keys.lead')} />
          <KeyManager orgs={session.orgs.map((o) => ({ id: o.id, name: o.name }))} />
        </section>
      )}

      {/* Auth & limits */}
      <section aria-labelledby="auth" className="container-page pt-16 md:pt-24">
        <SectionHeading id="auth" eyebrow={t('quickstart')} title={t('auth.title')} lead={t('auth.text')} />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="card flex min-w-0 flex-col p-6">
            <div className="flex items-center gap-3">
              <IconTile icon={Lock} />
              <h3 className="text-[20px] font-bold tracking-tight">{t('headerTitle')}</h3>
            </div>
            <CodeBlock title="HTTP" className="mt-5">
              <span className="text-[#8fe0c8]">GET</span> /v1/public/districts?city=tbilisi{'\n'}
              <span className="text-[#8fb4f2]">x-api-key</span>: <span className="text-[#f7d67a]">lk_live_••••••••••••</span>
            </CodeBlock>
            <h3 className="mt-7 text-[20px] font-bold tracking-tight">{t('limits.title')}</h3>
            <ul className="mt-4 grid gap-3">
              {limits.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface text-primary-soft-text shadow-xs">
                    <Icon className="size-4" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="pt-1 text-[15px]">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card flex min-w-0 flex-col p-6">
            <div className="flex items-center gap-3">
              <IconTile icon={KeyRound} tone="accent" />
              <h3 className="text-[20px] font-bold tracking-tight">{t('scopes')}</h3>
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {API_SCOPES.map((s) => (
                <li key={s} className="rounded-2xl border border-border p-4 transition-colors hover:border-border-strong">
                  <code className="inline-flex rounded-lg bg-primary-soft px-2 py-0.5 font-mono text-[13px] font-semibold text-primary-soft-text">{s}</code>
                  <p className="mt-2 text-[15px] text-muted">{t(`scopeLabels.${s}`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section aria-labelledby="endpoints" className="container-page pt-16 md:pt-24">
        <SectionHeading id="endpoints" title={t('endpoints')} lead={t('endpointsLead')} />
        <div className="mt-8 overflow-hidden rounded-card border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-small text-muted">
                  <th scope="col" className="px-5 py-3.5 font-semibold">{t('table.endpoint')}</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">{t('table.params')}</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">{t('table.scope')}</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">{t('table.description')}</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={e.path} className="border-b border-border transition-colors last:border-0 hover:bg-surface-2/60">
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <span className="rounded-md bg-success/12 px-1.5 py-0.5 font-mono text-[11.5px] font-bold text-success">GET</span>
                        <code className="font-mono text-[13.5px] font-medium">{e.path}</code>
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <code className="font-mono text-[13px] text-muted">{e.params}</code>
                    </td>
                    <td className="px-5 py-4">
                      {e.scope === '—' ? <span className="text-muted">—</span> : <code className="whitespace-nowrap rounded-lg bg-surface-2 px-2 py-0.5 font-mono text-[12.5px]">{e.scope}</code>}
                    </td>
                    <td className="px-5 py-4">{t(`ep.${e.key}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {apiPlans.length > 0 && (
        <section aria-labelledby="api-plans" className="container-page pt-16 md:pt-24">
          <SectionHeading id="api-plans" title={t('plans')} lead={t('plansLead')} />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {apiPlans.map((p, i) => {
              const pro = i === apiPlans.length - 1 && apiPlans.length > 1;
              return (
                <article key={p.key} className={cn('relative flex flex-col rounded-card border bg-surface p-6 md:p-7', pro ? 'border-primary shadow-lg ring-1 ring-primary' : 'border-border shadow-sm')}>
                  <div className="flex items-center gap-3">
                    <IconTile icon={pro ? Rocket : Terminal} tone={pro ? 'primary' : 'link'} />
                    <h3 className="text-[22px] font-bold tracking-tight">{p.nameKa}</h3>
                  </div>
                  <div className="mt-5 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[40px] font-bold leading-none tracking-tight tabular">{promo ? '0 ₾' : fmt.money(p.priceMinor)}</span>
                    {promo && <span className="text-[17px] text-muted line-through tabular">{fmt.money(p.priceMinor)}</span>}
                    <span className="text-small text-muted">{t('perMonth')}</span>
                  </div>
                  <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-[15px]">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', pro ? 'bg-primary text-primary-contrast' : 'bg-primary-soft text-primary-soft-text')}>
                          <Check className="size-3" strokeWidth={3} aria-hidden />
                        </span>
                        {f}
                      </li>
                    ))}
                    {p.limits.perMin && (
                      <li className="flex gap-2.5">
                        <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', pro ? 'bg-primary text-primary-contrast' : 'bg-primary-soft text-primary-soft-text')}>
                          <Check className="size-3" strokeWidth={3} aria-hidden />
                        </span>
                        {t('perMinLimit', { n: p.limits.perMin })}
                      </li>
                    )}
                  </ul>
                  <PlanBuyButton className="mt-6" variant={pro ? 'primary' : 'secondary'} planKey={p.key} loggedIn={!!session} orgs={session?.orgs.length ? session.orgs.map((o) => ({ id: o.id, name: o.name })) : null} label={promo ? t('subscribeFree') : t('subscribe')} />
                </article>
              );
            })}
          </div>
          {!session && (
            <div className="mt-6 flex justify-center">
              <Button asChild variant="link">
                <a href="/api/v1/docs" target="_blank" rel="noopener">
                  {t('openapi')} →
                </a>
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
