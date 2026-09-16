import Link from '@/i18n/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, Building2, CalendarClock, Layers, MapPin } from 'lucide-react';
import { Avatar, Badge, Card, EmptyState, SpecRow } from '@lokacia/ui';
import { getNames, getProject } from '@/components/portal/data';
import { monthsUntil } from '@/components/portal/projects/project-card';
import { PrebookDialog } from '@/components/portal/projects/prebook-dialog';
import { ProjectMap } from '@/components/portal/projects/project-map';
import { UnitsView } from '@/components/portal/projects/units-view';
import { Breadcrumbs, JsonLd, pageMetadata } from '@/components/portal/seo';
import { absUrl } from '@/lib/site';
import { getFormat } from '@/i18n/server';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProject(slug);
  if (!p) return { title: (await getTranslations('meta.titles'))('projectNotFound'), robots: { index: false } };
  const t = await getTranslations('projects');
  const f = await getFormat();
  const desc = [p.description, `${t('completion')}: ${f.date(p.completionDate)}`, t('unitsCount', { n: p.unitsCount }), p.minPriceMinor != null ? t('priceFrom', { price: f.money(p.minPriceMinor) }) : null].filter(Boolean).join(' · ');
  return pageMetadata({ title: `${p.name} — ${p.district?.name ?? p.address}`, description: desc.slice(0, 300), path: `/projects/${p.slug}`, image: p.coverUrl ?? undefined });
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const [p, t, names, f] = await Promise.all([getProject(slug), getTranslations('projects'), getNames(), getFormat()]);
  if (!p) notFound();
  const months = monthsUntil(p.completionDate);
  const center: [number, number] | null = p.lng != null && p.lat != null ? [p.lng, p.lat] : null;
  const points = p.units.filter((u) => u.lat != null && u.lng != null).map((u) => ({ id: u.id, lat: u.lat!, lng: u.lng!, label: `${f.number(u.areaM2)} ${f.areaUnit}`, title: u.title, href: `/listings/${u.slug}` }));
  const available = p.units.filter((u) => u.status === 'active');
  const prices = available.map((u) => u.priceMinor);

  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs items={[{ name: t('breadcrumbHome'), href: '/' }, { name: t('title'), href: '/projects' }, { name: p.name, href: `/projects/${p.slug}` }]} className="mb-4" />

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="drawing-grid relative aspect-[16/9] overflow-hidden rounded-card border border-border bg-bg">
          {p.coverUrl ? <img src={p.coverUrl} alt={p.name} fetchPriority="high" className="absolute inset-0 size-full object-cover" /> : <Building2 className="m-auto size-12 text-muted" strokeWidth={1.5} aria-hidden />}
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <Badge tone="primary" icon={<CalendarClock className="size-3.5" strokeWidth={1.5} aria-hidden />}>
              {months > 0 ? t('inMonths', { n: months }) : t('completed')}
            </Badge>
            <h1 className="mt-3 text-h2 font-semibold md:text-h1">{p.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-muted">
              <MapPin className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
              {p.district ? `${p.district.name} · ` : ''}
              {p.address}
            </p>
          </div>
          <Card className="p-4">
            <SpecRow label={t('completion')} value={f.date(p.completionDate)} icon={<CalendarClock className="size-4" strokeWidth={1.5} aria-hidden />} />
            {p.floors != null && <SpecRow label={t('col.floor')} value={p.floors} icon={<Layers className="size-4" strokeWidth={1.5} aria-hidden />} />}
            <SpecRow label={t('units')} value={p.unitsCount} />
            {p.minAreaM2 != null && p.maxAreaM2 != null && <SpecRow label={t('col.area')} value={t('areaRange', { min: f.number(p.minAreaM2), max: f.number(p.maxAreaM2) })} />}
            {p.minPriceMinor != null && <SpecRow label={t('col.price')} value={t('priceFrom', { price: f.money(p.minPriceMinor) })} />}
          </Card>
          <PrebookDialog projectSlug={p.slug} units={p.units} className="w-full sm:w-auto" />
          <Link href={`/agency/${p.developer.slug}`} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 hover:border-border-strong">
            <Avatar src={p.developer.logoUrl} name={p.developer.name} size={44} />
            <span className="min-w-0">
              <span className="block text-small text-muted">{t('developer')}</span>
              <span className="flex items-center gap-1 font-medium">
                {p.developer.name}
                {p.developer.verified && <BadgeCheck className="size-4 text-success" strokeWidth={1.5} aria-label={t('verified')} />}
              </span>
            </span>
          </Link>
        </div>
      </section>

      {p.description && (
        <section className="mt-10 max-w-3xl" aria-labelledby="about">
          <h2 id="about" className="text-h3 font-semibold">
            {t('about')}
          </h2>
          <p className="mt-2 whitespace-pre-line">{p.description}</p>
        </section>
      )}

      <section className="mt-10" aria-labelledby="units">
        <h2 id="units" className="mb-2 text-h3 font-semibold md:text-h2">
          {t('units')} <span className="tabular text-muted">({p.units.length})</span>
        </h2>
        {p.units.length ? (
          <UnitsView units={p.units} typeNames={names.typeNames} />
        ) : (
          <EmptyState title={t('noUnits')} description={t('noUnitsHint')} action={<PrebookDialog projectSlug={p.slug} units={[]} size="md" />} />
        )}
      </section>

      {center && (
        <section className="mt-10" aria-labelledby="map">
          <h2 id="map" className="mb-3 text-h3 font-semibold">
            {t('map')}
          </h2>
          <ProjectMap center={center} points={points.length ? points : [{ id: p.id, lat: p.lat!, lng: p.lng!, title: p.name }]} label={`${t('map')}: ${p.name}`} />
        </section>
      )}

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: p.name,
          description: p.description ?? undefined,
          url: absUrl(`/projects/${p.slug}`),
          image: p.coverUrl ? absUrl(p.coverUrl) : undefined,
          address: { '@type': 'PostalAddress', streetAddress: p.address, addressLocality: p.city ?? undefined, addressCountry: 'GE' },
          ...(p.lat != null && p.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } } : {}),
          ...(prices.length
            ? {
                makesOffer: {
                  '@type': 'AggregateOffer',
                  priceCurrency: 'GEL',
                  lowPrice: Math.min(...prices) / 100,
                  highPrice: Math.max(...prices) / 100,
                  offerCount: prices.length,
                  offeredBy: { '@type': 'Organization', name: p.developer.name, url: absUrl(`/agency/${p.developer.slug}`) },
                },
              }
            : {}),
        }}
      />
    </div>
  );
}
