import type { Metadata } from 'next';
import { pageMetadata } from '@/components/portal/seo';
import { getTranslations } from 'next-intl/server';
import type { FinanceProductDto, ListingDetail } from '@lokacia/contracts';
import { getFormat } from '@/i18n/server';
import { Card, EmptyState } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { ApplyButton } from './apply-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('finance');
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: '/finance' });
}

const KINDS = ['fitout_loan', 'leasing', 'insurance'] as const;

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
  return (
    <div className="container-page py-10 md:py-14">
      <header className="max-w-2xl">
        <h1 className="text-h1 font-semibold">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
        {listing && <p className="mt-3 rounded-button border border-border bg-surface px-3 py-2 text-small">{t('forListing', { title: listing.title })}</p>}
      </header>
      {!active.length ? (
        <EmptyState className="mt-8" title={t('empty')} description={t('emptyText')} />
      ) : (
        KINDS.map((kind) => {
          const items = active.filter((p) => p.kind === kind);
          if (!items.length) return null;
          return (
            <section key={kind} aria-labelledby={`k-${kind}`} className="mt-10">
              <h2 id={`k-${kind}`} className="text-h2 font-semibold">
                {t(`kinds.${kind}`)}
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <Card key={p.id} className={`flex flex-col p-5 ${sp.product === p.id ? 'border-primary' : ''}`}>
                    <div className="text-small text-muted">{p.partner}</div>
                    <h3 className="mt-1 text-h3 font-semibold">{p.name}</h3>
                    <p className="mt-2 flex-1 text-small">{p.description}</p>
                    <dl className="mt-3 flex flex-col text-small">
                      {p.rateText && (
                        <div className="flex justify-between border-b border-border py-1.5">
                          <dt className="text-muted">{t('rate')}</dt>
                          <dd className="tabular">{p.rateText}</dd>
                        </div>
                      )}
                      {(p.minAmountMinor || p.maxAmountMinor) && (
                        <div className="flex justify-between py-1.5">
                          <dt className="text-muted">{t('amountRange')}</dt>
                          <dd className="tabular">
                            {p.minAmountMinor ? fmt.money(p.minAmountMinor) : '—'} – {p.maxAmountMinor ? fmt.money(p.maxAmountMinor) : '—'}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <ApplyButton product={p} loggedIn={!!session} listing={listing ? { id: listing.id, title: listing.title } : null} defaultOpen={sp.product === p.id && !!session} />
                  </Card>
                ))}
              </div>
            </section>
          );
        })
      )}
      <p className="mt-10 max-w-2xl text-small text-muted">{t('disclaimer')}</p>
    </div>
  );
}
