import Link from '@/i18n/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Search, Users } from 'lucide-react';
import { Avatar, Button, EmptyState, Input, Select } from '@lokacia/ui';
import { api } from '@/lib/api-server';
import { getDistricts } from '@/components/portal/data';
import { Stars } from '@/components/portal/profiles/stars';
import { Breadcrumbs, JsonLd, pageMetadata } from '@/components/portal/seo';
import { absUrl } from '@/lib/site';

export const revalidate = 300;

type BrokerRow = { id: string; name: string; slug: string; avatarUrl: string | null; bio: string | null; org: { name: string; slug: string } | null; activeListings: number; rating: number | null; reviewsCount: number };
type Props = { searchParams: Promise<{ district?: string; q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { district, q } = await searchParams;
  const t = await getTranslations('profiles');
  return { ...(await pageMetadata({ title: t('brokersTitle'), description: t('brokersMetaDescription'), path: '/brokers' })), ...(district || q ? { robots: { index: false, follow: true } } : {}) };
}

export default async function BrokersPage({ searchParams }: Props) {
  const { district, q } = await searchParams;
  const t = await getTranslations('profiles');
  const qs = new URLSearchParams();
  if (district) qs.set('district', district);
  if (q) qs.set('q', q.slice(0, 80));
  const [brokers, districts] = await Promise.all([
    api<BrokerRow[]>(`/v1/profiles/brokers${qs.size ? `?${qs}` : ''}`, { auth: false, revalidate: 300 }).catch(() => [] as BrokerRow[]),
    getDistricts().catch(() => []),
  ]);
  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs items={[{ name: t('breadcrumbHome'), href: '/' }, { name: t('brokersTitle'), href: '/brokers' }]} className="mb-4" />
      <header className="mb-6 max-w-2xl">
        <h1 className="text-h2 font-semibold md:text-h1">{t('brokersTitle')}</h1>
        <p className="mt-2 text-muted">{t('brokersSubtitle')}</p>
      </header>
      <form method="get" action="/brokers" role="search" className="mb-6 grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="text-small font-medium">{t('search')}</span>
          <Input name="q" defaultValue={q ?? ''} placeholder={t('searchPlaceholder')} maxLength={80} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-small font-medium">{t('district')}</span>
          <Select name="district" defaultValue={district ?? ''} placeholder={t('allDistricts')} options={districts.map((d) => ({ value: d.slug, label: d.nameKa }))} />
        </label>
        <Button type="submit" icon={<Search className="size-4" strokeWidth={1.5} aria-hidden />}>
          {t('apply')}
        </Button>
      </form>
      {brokers.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brokers.map((b) => (
            <li key={b.id}>
              <Link href={`/broker/${b.slug}`} className="flex h-full gap-3 rounded-card border border-border bg-surface p-4 hover:border-border-strong">
                <Avatar src={b.avatarUrl} name={b.name} size={56} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{b.name}</span>
                  {b.org && <span className="truncate text-small text-muted">{b.org.name}</span>}
                  <span className="flex items-center gap-1.5 text-small text-muted">
                    {b.rating != null ? <Stars value={b.rating} size="size-3.5" label={t('review.stars', { n: b.rating })} /> : t('noRating')}
                    {b.reviewsCount > 0 && <span className="tabular">({b.reviewsCount})</span>}
                  </span>
                  <span className="text-small tabular">{t('activeListings', { n: b.activeListings })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Users className="size-5" strokeWidth={1.5} aria-hidden />} title={t('noBrokers')} description={t('noBrokersHint')} action={<Link href="/brokers" className="text-link hover:underline">{t('allDistricts')}</Link>} />
      )}
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: brokers.slice(0, 50).map((b, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/broker/${b.slug}`), name: b.name })) }} />
    </div>
  );
}
