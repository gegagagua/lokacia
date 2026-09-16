import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@lokacia/ui';

export async function SiteFooter() {
  const t = await getTranslations('common.footer');
  const n = await getTranslations('common.nav');
  const c = await getTranslations('meta.cities');
  const cols = [
    { title: t('product'), links: [{ href: '/search', label: n('search') }, { href: '/map', label: n('map') }, { href: '/demand', label: n('demand') }, { href: '/services', label: n('services') }, { href: '/projects', label: n('developers') }] },
    { title: t('brokers'), links: [{ href: '/pricing', label: t('pricing') }, { href: '/reports', label: t('reports') }, { href: '/api-access', label: t('api') }, { href: '/brokers', label: t('brokers') }] },
    { title: t('company'), links: [{ href: '/pages/about', label: t('about') }, { href: '/pages/terms', label: t('terms') }, { href: '/pages/privacy', label: t('privacy') }] },
  ];
  return (
    <footer className="hero-gradient mt-24">
      <div className="container-page grid gap-10 py-16 md:grid-cols-4">
        <div className="flex flex-col gap-4 [&_.text-primary]:text-white [&_.text-muted]:text-white/60">
          <Logo size={30} />
          <p className="max-w-xs text-[15px] leading-relaxed text-white/70">{t('tagline')}</p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-white/50">{c.title}</h2>
            <ul className="flex flex-col gap-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[15px] text-white/85 transition-colors hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-5 text-small text-white/55">
          <span>© {new Date().getFullYear()} lokacia.ge. {t('rights')}</span>
          <span>{[c('tbilisi'), c('batumi'), c('kutaisi'), c('rustavi')].join(' · ')}</span>
        </div>
      </div>
    </footer>
  );
}
