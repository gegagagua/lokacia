import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { Hammer, Package, PenTool, Scale, Search, Signpost, Sparkles, Wrench } from 'lucide-react';
import { Button, EmptyState, Input, Select } from '@lokacia/ui';
import { getProviders, getServiceCategories } from '@/components/portal/data';
import { pageMetadata } from '@/components/portal/seo';
import { PageHero, SectionHead } from '@/components/portal/page-hero';
import { ProviderCard } from '@/components/portal/services/provider-card';
import { ProvidersLoadMore } from '@/components/portal/services/providers-load-more';
import { CITY_NAMES_KA } from '@/lib/site';
import { getFormat } from '@/i18n/server';

type SP = Promise<Record<string, string | string[] | undefined>>;
const CAT_ICONS: Record<string, typeof Hammer> = { fitout: Hammer, design: PenTool, signage: Signpost, equipment: Package, legal: Scale, cleaning: Sparkles };

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const t = await getTranslations('services.hub');
  const sp = await searchParams;
  const cat = typeof sp.category === 'string' ? sp.category : '';
  const filtered = ['city', 'q'].some((k) => typeof sp[k] === 'string' && sp[k]);
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: cat ? `/services?category=${cat}` : '/services', noindex: filtered });
}

export default async function ServicesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const t = await getTranslations('services.hub');
  const tc = await getTranslations('services.categories');
  const f = await getFormat();
  const catName = (c: { slug: string; nameKa: string }) => (tc.has(c.slug) ? tc(c.slug) : c.nameKa);
  const val = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string).trim() : '');
  const qs = new URLSearchParams();
  for (const k of ['category', 'city', 'q']) if (val(k)) qs.set(k, val(k));
  qs.set('limit', '24');
  const [cats, data] = await Promise.all([getServiceCategories().catch(() => []), getProviders(qs.toString()).catch(() => ({ items: [], total: 0, nextCursor: null }))]);
  const active = val('category');
  const catHref = (slug: string) => {
    const p = new URLSearchParams(qs);
    p.delete('limit');
    if (slug) p.set('category', slug);
    else p.delete('category');
    const s = p.toString();
    return s ? `/services?${s}` : '/services';
  };

  const TONES = ['bg-primary-soft text-primary-soft-text', 'bg-accent-soft text-text', 'bg-link/10 text-link', 'bg-success/12 text-success', 'bg-danger/10 text-danger', 'bg-surface-3 text-text'];

  return (
    <>
      <PageHero
        crumbs={[{ name: 'lokacia.ge', href: '/' }, { name: t('providers'), href: '/services' }]}
        eyebrow={t('eyebrow')}
        eyebrowIcon={<Wrench className="size-3.5" strokeWidth={2} aria-hidden />}
        title={t('title')}
        lead={t('subtitle')}
        actions={
          <Button asChild variant="secondary" size="lg">
            <Link href="/account/services">{t('myServices')}</Link>
          </Button>
        }
      >
        <nav aria-label={t('categories')}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cats.map((c, i) => {
              const Icon = CAT_ICONS[c.slug] ?? Hammer;
              const on = active === c.slug;
              return (
                <li key={c.slug}>
                  <Link
                    href={catHref(on ? '' : c.slug)}
                    aria-current={on ? 'page' : undefined}
                    className={`group flex h-full flex-col gap-3 rounded-card border p-4 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${on ? 'border-primary bg-primary-soft ring-2 ring-primary/30' : 'border-border bg-surface hover:border-border-strong'}`}
                  >
                    <span className={`grid size-11 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${TONES[i % TONES.length]}`}>
                      <Icon className="size-5" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="font-semibold leading-snug">{catName(c)}</span>
                    <span className="mt-auto text-small text-muted tabular">{t('count', { count: c.count })}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </PageHero>

      <div className="container-page py-10 md:py-14">
        <form method="get" action="/services" className="card flex flex-wrap items-end gap-3 p-4 md:p-5" role="search">
          {active && <input type="hidden" name="category" value={active} />}
          <label className="flex min-w-0 flex-[2_1_240px] flex-col gap-1.5 text-small font-medium">
            {t('search')}
            <Input name="q" defaultValue={val('q')} placeholder={t('searchPlaceholder')} prefixIcon={<Search className="size-4" strokeWidth={2} aria-hidden />} />
          </label>
          <label className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5 text-small font-medium">
            {t('city')}
            <Select name="city" defaultValue={val('city')} placeholder={t('anyCity')} options={Object.keys(CITY_NAMES_KA).map((value) => ({ value, label: f.city(value) }))} />
          </label>
          <Button type="submit" className="w-full sm:w-auto" icon={<Search className="size-4" strokeWidth={2} aria-hidden />}>
            {t('apply')}
          </Button>
        </form>

        <SectionHead
          className="mb-6 mt-10"
          title={active ? (cats.find((c) => c.slug === active) ? catName(cats.find((c) => c.slug === active)!) : t('providers')) : t('providers')}
          action={
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-small font-semibold text-primary-soft-text tabular" aria-live="polite">
              {t('count', { count: data.total })}
            </span>
          }
        />
        {data.items.length === 0 ? (
          <EmptyState
            title={t('empty')}
            description={t('emptyHint')}
            action={
              <Button asChild variant="secondary">
                <Link href="/services">{t('all')}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((p) => (
                <li key={p.id}>
                  <ProviderCard p={p} />
                </li>
              ))}
            </ul>
            <ProvidersLoadMore query={qs.toString()} cursor={data.nextCursor} />
          </>
        )}
      </div>
    </>
  );
}
