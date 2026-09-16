import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { Hammer, Package, PenTool, Scale, Search, Signpost, Sparkles } from 'lucide-react';
import { Button, EmptyState, Input, Select } from '@lokacia/ui';
import { getProviders, getServiceCategories } from '@/components/portal/data';
import { Breadcrumbs, pageMetadata } from '@/components/portal/seo';
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

  return (
    <div>
      <section className="drawing-grid border-b border-border">
        <div className="container-page py-10 md:py-14">
          <Breadcrumbs items={[{ name: 'lokacia.ge', href: '/' }, { name: t('providers'), href: '/services' }]} />
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-h2 font-semibold md:text-h1">{t('title')}</h1>
              <p className="mt-2 text-[17px] text-muted">{t('subtitle')}</p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/account/services">{t('myServices')}</Link>
            </Button>
          </div>
          <nav aria-label={t('categories')} className="mt-8">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {cats.map((c) => {
                const Icon = CAT_ICONS[c.slug] ?? Hammer;
                const on = active === c.slug;
                return (
                  <li key={c.slug}>
                    <Link
                      href={catHref(on ? '' : c.slug)}
                      aria-current={on ? 'page' : undefined}
                      className={`flex h-full flex-col gap-2 rounded-card border p-4 transition-colors duration-150 ${on ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:border-border-strong'}`}
                    >
                      <Icon className="size-5 text-primary" strokeWidth={1.5} aria-hidden />
                      <span className="font-medium leading-snug">{catName(c)}</span>
                      <span className="text-small text-muted tabular">{t('count', { count: c.count })}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </section>

      <div className="container-page py-8">
        <form method="get" action="/services" className="flex flex-wrap items-end gap-3" role="search">
          {active && <input type="hidden" name="category" value={active} />}
          <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-small font-medium">
            {t('search')}
            <Input name="q" defaultValue={val('q')} placeholder={t('searchPlaceholder')} />
          </label>
          <label className="flex w-48 flex-col gap-1.5 text-small font-medium">
            {t('city')}
            <Select name="city" defaultValue={val('city')} placeholder={t('anyCity')} options={Object.keys(CITY_NAMES_KA).map((value) => ({ value, label: f.city(value) }))} />
          </label>
          <Button type="submit" icon={<Search className="size-4" strokeWidth={1.5} aria-hidden />}>
            {t('apply')}
          </Button>
        </form>

        <div className="mb-4 mt-8 flex items-end justify-between gap-3">
          <h2 className="text-h3 font-semibold">
            {active ? (cats.find((c) => c.slug === active)?.nameKa ?? t('providers')) : t('providers')}
          </h2>
          <span className="text-small text-muted tabular" aria-live="polite">
            {t('count', { count: data.total })}
          </span>
        </div>
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
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
