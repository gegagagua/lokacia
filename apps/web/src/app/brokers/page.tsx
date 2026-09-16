import Link from '@/i18n/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Building2, Search, ShieldCheck, Users } from 'lucide-react';
import { Avatar, Button, EmptyState, Input, Select } from '@lokacia/ui';
import { api } from '@/lib/api-server';
import { getDistricts } from '@/components/portal/data';
import { Stars } from '@/components/portal/profiles/stars';
import { JsonLd, pageMetadata } from '@/components/portal/seo';
import { PageHero } from '@/components/portal/page-hero';
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
    <>
      <PageHero
        crumbs={[{ name: t('breadcrumbHome'), href: '/' }, { name: t('brokersTitle'), href: '/brokers' }]}
        eyebrow={t('brokersEyebrow')}
        eyebrowIcon={<ShieldCheck className="size-3.5" strokeWidth={2} aria-hidden />}
        title={t('brokersTitle')}
        lead={t('brokersSubtitle')}
      >
        <form method="get" action="/brokers" role="search" className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end md:p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t('search')}</span>
            <Input name="q" defaultValue={q ?? ''} placeholder={t('searchPlaceholder')} maxLength={80} prefixIcon={<Search className="size-4" strokeWidth={2} aria-hidden />} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t('district')}</span>
            <Select name="district" defaultValue={district ?? ''} placeholder={t('allDistricts')} options={districts.map((d) => ({ value: d.slug, label: d.nameKa }))} />
          </label>
          <Button type="submit" icon={<Search className="size-4" strokeWidth={2} aria-hidden />}>
            {t('apply')}
          </Button>
        </form>
      </PageHero>
      <div className="container-page py-10 md:py-14">
        {brokers.length ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {brokers.map((b) => (
              <li key={b.id}>
                <Link href={`/broker/${b.slug}`} className="card card-hover group flex h-full flex-col gap-4 p-5">
                  <span className="flex items-center gap-3.5">
                    <Avatar src={b.avatarUrl} name={b.name} size={60} className="ring-4 ring-primary-soft" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[17px] font-semibold group-hover:text-link">{b.name}</span>
                      {b.org && (
                        <span className="flex items-center gap-1 truncate text-small text-muted">
                          <Building2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                          <span className="truncate">{b.org.name}</span>
                        </span>
                      )}
                    </span>
                  </span>
                  {b.bio && <span className="line-clamp-2 text-[15px] text-muted">{b.bio}</span>}
                  <span className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-small">
                    <span className="flex items-center gap-1.5 text-muted">
                      {b.rating != null ? <Stars value={b.rating} size="size-3.5" label={t('review.stars', { n: b.rating })} /> : t('noRating')}
                      {b.reviewsCount > 0 && <span className="tabular">({b.reviewsCount})</span>}
                    </span>
                    <span className="rounded-full bg-primary-soft px-2.5 py-0.5 font-semibold text-primary-soft-text tabular">{t('activeListings', { n: b.activeListings })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Users className="size-6" strokeWidth={2} aria-hidden />} title={t('noBrokers')} description={t('noBrokersHint')} action={<Link href="/brokers" className="font-medium text-link hover:underline">{t('allDistricts')}</Link>} />
        )}
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: brokers.slice(0, 50).map((b, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/broker/${b.slug}`), name: b.name })) }} />
      </div>
    </>
  );
}
