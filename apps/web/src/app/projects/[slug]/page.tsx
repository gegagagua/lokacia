import { getSession } from '@/lib/session';
import Link from '@/i18n/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  LayoutGrid,
  Layers,
  MapPin,
  Ruler,
} from 'lucide-react';
import { Avatar, EmptyState } from '@lokacia/ui';
import { getNames, getProject } from '@/components/portal/data';
import { monthsUntil } from '@/components/portal/projects/project-card';
import { PrebookDialog } from '@/components/portal/projects/prebook-dialog';
import { ProjectMap } from '@/components/portal/projects/project-map';
import { UnitsView } from '@/components/portal/projects/units-view';
import { Breadcrumbs, JsonLd, pageMetadata } from '@/components/portal/seo';
import { HeroGlow, SectionHead } from '@/components/portal/page-hero';
import { absUrl } from '@/lib/site';
import { getFormat } from '@/i18n/server';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProject(slug);
  if (!p)
    return { title: (await getTranslations('meta.titles'))('projectNotFound'), robots: { index: false } };
  const t = await getTranslations('projects');
  const f = await getFormat();
  const desc = [
    p.description,
    `${t('completion')}: ${f.date(p.completionDate)}`,
    t('unitsCount', { n: p.unitsCount }),
    p.minPriceMinor != null ? t('priceFrom', { price: f.money(p.minPriceMinor) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return pageMetadata({
    title: `${p.name} — ${p.district?.name ?? p.address}`,
    description: desc.slice(0, 300),
    path: `/projects/${p.slug}`,
    image: p.coverUrl ?? undefined,
  });
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const [p, t, names, f] = await Promise.all([
    getProject(slug),
    getTranslations('projects'),
    getNames(),
    getFormat(),
  ]);
  if (!p) notFound();
  const months = monthsUntil(p.completionDate);
  const center: [number, number] | null = p.lng != null && p.lat != null ? [p.lng, p.lat] : null;
  const points = p.units
    .filter((u) => u.lat != null && u.lng != null)
    .map((u) => ({
      id: u.id,
      lat: u.lat!,
      lng: u.lng!,
      label: `${f.number(u.areaM2)} ${f.areaUnit}`,
      title: u.title,
      href: `/listings/${u.slug}`,
    }));
  const available = p.units.filter((u) => u.status === 'active');
  const prices = available.map((u) => u.priceMinor);

  const facts = [
    { icon: CalendarClock, label: t('completion'), value: f.date(p.completionDate) },
    p.floors != null ? { icon: Layers, label: t('col.floor'), value: String(p.floors) } : null,
    { icon: LayoutGrid, label: t('units'), value: String(p.unitsCount) },
    p.minAreaM2 != null && p.maxAreaM2 != null
      ? {
          icon: Ruler,
          label: t('col.area'),
          value: t('areaRange', { min: f.number(p.minAreaM2), max: f.number(p.maxAreaM2) }),
        }
      : null,
  ].filter(Boolean) as { icon: typeof Layers; label: string; value: string }[];

  return (
    <>
      <div className="relative isolate overflow-hidden border-b border-border bg-surface">
        <HeroGlow />
        <div className="container-page relative pb-10 pt-6 md:pb-14 md:pt-8">
          <Breadcrumbs
            items={[
              { name: t('breadcrumbHome'), href: '/' },
              { name: t('title'), href: '/projects' },
              { name: p.name, href: `/projects/${p.slug}` },
            ]}
            className="mb-6"
          />

          <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
            <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-surface-2 shadow-md">
              {p.coverUrl ? (
                <img
                  src={p.coverUrl}
                  alt={p.name}
                  fetchPriority="high"
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <Building2
                  className="absolute inset-0 m-auto size-12 text-muted"
                  strokeWidth={1.5}
                  aria-hidden
                />
              )}
              <span className="absolute left-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[13px] font-semibold text-basalt shadow-sm backdrop-blur">
                <CalendarClock className="size-4" strokeWidth={2} aria-hidden />
                {months > 0 ? t('inMonths', { n: months }) : t('completed')}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              <div>
                <p className="eyebrow">
                  <Building2 className="size-3.5" strokeWidth={2} aria-hidden />
                  {t('eyebrow')}
                </p>
                <h1 className="mt-3 text-[32px] font-bold leading-[40px] tracking-tight md:text-h1">
                  {p.name}
                </h1>
                <p className="mt-2 flex items-start gap-1.5 text-[16px] text-muted">
                  <MapPin className="mt-1 size-4 shrink-0 text-primary-500" strokeWidth={2} aria-hidden />
                  {p.district ? `${p.district.name} · ` : ''}
                  {p.address}
                </p>
              </div>
              {p.minPriceMinor != null && (
                <p className="text-[30px] font-bold leading-tight tracking-tight tabular">
                  {t('priceFrom', { price: f.money(p.minPriceMinor) })}
                </p>
              )}
              <dl className="grid grid-cols-2 gap-2.5">
                {facts.map((x) => (
                  <div
                    key={x.label}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-xs"
                  >
                    <span className="hidden size-10 shrink-0 sm:grid place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
                      <x.icon className="size-[18px]" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <dt className="truncate text-[12.5px] text-muted">{x.label}</dt>
                      <dd className="font-semibold leading-snug tabular">{x.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              <PrebookDialog projectSlug={p.slug} units={p.units} className="w-full sm:w-auto" />
              <Link
                href={`/agency/${p.developer.slug}`}
                className="card card-hover flex items-center gap-3 p-3.5"
              >
                <Avatar src={p.developer.logoUrl} name={p.developer.name} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block text-small text-muted">{t('developer')}</span>
                  <span className="flex items-center gap-1 font-semibold">
                    <span className="truncate">{p.developer.name}</span>
                    {p.developer.verified && (
                      <BadgeCheck
                        className="size-4 shrink-0 text-success"
                        strokeWidth={2}
                        aria-label={t('verified')}
                      />
                    )}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted" strokeWidth={2} aria-hidden />
              </Link>
            </div>
          </section>
        </div>
      </div>

      <div className="container-page py-10 md:py-14">
        {p.description && (
          <section className="card mb-12 max-w-4xl p-5 md:p-7" aria-labelledby="about">
            <h2 id="about" className="text-h3 font-bold">
              {t('about')}
            </h2>
            <p className="mt-3 whitespace-pre-line text-[16.5px] leading-relaxed">{p.description}</p>
          </section>
        )}

        <section aria-labelledby="units">
          <SectionHead
            id="units"
            className="mb-2"
            title={
              <>
                {t('units')} <span className="tabular text-muted">({p.units.length})</span>
              </>
            }
          />
          {p.units.length ? (
            <UnitsView units={p.units} typeNames={names.typeNames} loggedIn={!!(await getSession())} />
          ) : (
            <EmptyState
              title={t('noUnits')}
              description={t('noUnitsHint')}
              action={<PrebookDialog projectSlug={p.slug} units={[]} size="md" />}
            />
          )}
        </section>

        {center && (
          <section className="mt-12 md:mt-16" aria-labelledby="map">
            <SectionHead id="map" title={t('map')} className="mb-4" />
            <ProjectMap
              center={center}
              points={points.length ? points : [{ id: p.id, lat: p.lat!, lng: p.lng!, title: p.name }]}
              label={`${t('map')}: ${p.name}`}
            />
          </section>
        )}
      </div>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: p.name,
          description: p.description ?? undefined,
          url: absUrl(`/projects/${p.slug}`),
          image: p.coverUrl ? absUrl(p.coverUrl) : undefined,
          address: {
            '@type': 'PostalAddress',
            streetAddress: p.address,
            addressLocality: p.city ?? undefined,
            addressCountry: 'GE',
          },
          ...(p.lat != null && p.lng != null
            ? { geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } }
            : {}),
          ...(prices.length
            ? {
                makesOffer: {
                  '@type': 'AggregateOffer',
                  priceCurrency: 'GEL',
                  lowPrice: Math.min(...prices) / 100,
                  highPrice: Math.max(...prices) / 100,
                  offerCount: prices.length,
                  offeredBy: {
                    '@type': 'Organization',
                    name: p.developer.name,
                    url: absUrl(`/agency/${p.developer.slug}`),
                  },
                },
              }
            : {}),
        }}
      />
    </>
  );
}
