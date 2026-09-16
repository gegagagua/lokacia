import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@lokacia/ui';

export async function SiteFooter() {
  const t = await getTranslations('common.footer');
  const n = await getTranslations('common.nav');
  const cols = [
    { title: t('product'), links: [{ href: '/search', label: n('search') }, { href: '/map', label: n('map') }, { href: '/demand', label: n('demand') }, { href: '/services', label: n('services') }, { href: '/projects', label: n('developers') }] },
    { title: t('brokers'), links: [{ href: '/pricing', label: t('pricing') }, { href: '/reports', label: t('reports') }, { href: '/api-access', label: t('api') }, { href: '/brokers', label: t('brokers') }] },
    { title: t('company'), links: [{ href: '/pages/about', label: t('about') }, { href: '/pages/terms', label: t('terms') }, { href: '/pages/privacy', label: t('privacy') }] },
  ];
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="container-page grid gap-8 py-10 md:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Logo size={24} />
          <p className="max-w-xs text-small text-muted">{t('tagline')}</p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="mb-2 text-small font-semibold uppercase tracking-wide text-muted">{c.title}</h2>
            <ul className="flex flex-col gap-1.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[15px] hover:text-link">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-4 text-small text-muted">
          <span>© {new Date().getFullYear()} lokacia.ge. {t('rights')}</span>
          <span>თბილისი · ბათუმი · ქუთაისი · რუსთავი</span>
        </div>
      </div>
    </footer>
  );
}
