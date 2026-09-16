import type { Metadata } from 'next';
import { pageMetadata } from '@/components/portal/seo';
import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { API_SCOPES, type PlansResponse } from '@lokacia/contracts';
import { getFormat } from '@/i18n/server';
import { Badge, Button, Card } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { absUrl } from '@/lib/site';
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

export default async function ApiAccessPage() {
  const t = await getTranslations('developers');
  const fmt = await getFormat();
  const [session, plans] = await Promise.all([getSession(), apiOrNull<PlansResponse>('/v1/billing/plans', { auth: false, revalidate: 60 }).catch(() => null)]);
  const apiPlans = (plans?.plans ?? []).filter((p) => p.audience === 'api' && p.active);
  const apiBase = `${absUrl('/api')}/v1`;
  return (
    <div className="container-page py-10 md:py-14">
      <header className="max-w-2xl">
        <Badge tone="link">API</Badge>
        <h1 className="mt-2 text-h1 font-semibold">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <a href="/api/v1/docs" target="_blank" rel="noopener">
              {t('openapi')}
            </a>
          </Button>
          {!session && (
            <Button asChild size="sm">
              <Link href="/login?next=/api-access">{t('loginForKeys')}</Link>
            </Button>
          )}
        </div>
      </header>

      {session && (
        <section aria-labelledby="keys" className="mt-10">
          <h2 id="keys" className="text-h2 font-semibold">
            {t('keys.title')}
          </h2>
          <KeyManager orgs={session.orgs.map((o) => ({ id: o.id, name: o.name }))} />
        </section>
      )}

      <section aria-labelledby="auth" className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 id="auth" className="text-h2 font-semibold">
            {t('auth.title')}
          </h2>
          <p className="mt-2 text-muted">{t('auth.text')}</p>
          <pre className="mt-3 overflow-x-auto rounded-card border border-border bg-surface-2 p-4 text-small">
            <code>{`curl -H "x-api-key: lk_…" \\\n  "${apiBase}/public/districts?city=tbilisi&businessType=cafe"`}</code>
          </pre>
          <h3 className="mt-6 text-h3 font-semibold">{t('limits.title')}</h3>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted">
            <li>{t('limits.perMinute')}</li>
            <li>{t('limits.quota')}</li>
            <li>{t('limits.headers')}</li>
            <li>{t('limits.errors')}</li>
          </ul>
        </div>
        <div className="min-w-0">
          <h3 className="text-h3 font-semibold">{t('sample')}</h3>
          <pre className="mt-3 overflow-x-auto rounded-card border border-border bg-surface-2 p-4 text-small">
            <code>{SAMPLE}</code>
          </pre>
          <h3 className="mt-6 text-h3 font-semibold">{t('scopes')}</h3>
          <ul className="mt-2 flex flex-col text-small">
            {API_SCOPES.map((s) => (
              <li key={s} className="flex justify-between gap-3 border-b border-border py-1.5">
                <code>{s}</code>
                <span className="text-muted">{t(`scopeLabels.${s}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="endpoints" className="mt-12">
        <h2 id="endpoints" className="text-h2 font-semibold">
          {t('endpoints')}
        </h2>
        <div className="mt-4 overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[640px] border-collapse bg-surface text-small">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-3 font-medium">
                  {t('table.endpoint')}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {t('table.params')}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {t('table.scope')}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {t('table.description')}
                </th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.path} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <code>GET {e.path}</code>
                  </td>
                  <td className="p-3 text-muted">
                    <code>{e.params}</code>
                  </td>
                  <td className="p-3">
                    <code>{e.scope}</code>
                  </td>
                  <td className="p-3">{t(`ep.${e.key}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {apiPlans.length > 0 && (
        <section aria-labelledby="api-plans" className="mt-12">
          <h2 id="api-plans" className="text-h2 font-semibold">
            {t('plans')}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {apiPlans.map((p) => (
              <Card key={p.key} className="flex flex-col p-5">
                <h3 className="text-h3 font-semibold">{p.nameKa}</h3>
                <div className="compact mt-2 text-h2 font-semibold tabular">
                  {fmt.money(p.priceMinor)} <span className="text-small font-normal text-muted">{t('perMonth')}</span>
                </div>
                <ul className="mt-3 flex flex-1 list-disc flex-col gap-1 pl-5 text-small">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                  {p.limits.perMin && <li>{t('perMinLimit', { n: p.limits.perMin })}</li>}
                </ul>
                <PlanBuyButton className="mt-4" planKey={p.key} loggedIn={!!session} orgs={session?.orgs.length ? session.orgs.map((o) => ({ id: o.id, name: o.name })) : null} label={plans?.promoActive ? t('subscribeFree') : t('subscribe')} />
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
