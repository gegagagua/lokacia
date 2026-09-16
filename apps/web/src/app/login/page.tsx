import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { BellRing, CalendarCheck, Rocket } from 'lucide-react';
import { HeroGlow } from '@/components/portal/page-hero';
import { LoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('login'), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
  if (await getSession()) redirect(localizePath(safeNext, await getAppLocale()));
  const t = await getTranslations('auth');
  const perks = [
    { icon: BellRing, text: t('perk1') },
    { icon: CalendarCheck, text: t('perk2') },
    { icon: Rocket, text: t('perk3') },
  ];
  return (
    <div className="relative isolate overflow-hidden">
      <HeroGlow variant="page" />
      <div className="container-page grid min-h-[calc(100dvh-72px)] items-center gap-10 py-8 md:py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <section className="hero-gradient relative hidden h-full min-h-[560px] overflow-hidden rounded-modal p-10 shadow-lg lg:flex lg:flex-col" aria-hidden>
          <div className="relative z-10 max-w-md">
            <h2 className="text-[40px] font-bold leading-[48px] tracking-tight">{t('heroTitle')}</h2>
            <p className="mt-4 text-[18px] text-white/80">{t('heroLead')}</p>
            <ul className="mt-8 flex flex-col gap-3">
              {perks.map((p) => (
                <li key={p.text} className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/12 backdrop-blur">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-contrast">
                    <p.icon className="size-5" strokeWidth={2} />
                  </span>
                  <span className="text-[15.5px] font-medium">{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <PlanIllustration />
        </section>
        <div className="flex justify-center lg:justify-start">
          <LoginForm next={safeNext} />
        </div>
      </div>
    </div>
  );
}

/** Decorative floor-plan + pin drawing (illustration colours allowed). */
function PlanIllustration() {
  return (
    <svg viewBox="0 0 420 260" className="pointer-events-none absolute -bottom-10 -right-12 w-[78%] opacity-90" fill="none">
      <rect x="40" y="40" width="330" height="190" rx="10" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
      <path d="M40 130h140M180 40v70M180 150v80M260 130h110M260 130v100" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="2" />
      <path d="M40 22h330M40 16v12M370 16v12" stroke="#f7d67a" strokeOpacity="0.7" strokeWidth="1.5" />
      <rect x="60" y="60" width="100" height="52" rx="8" fill="#ffffff" fillOpacity="0.08" />
      <rect x="200" y="60" width="150" height="52" rx="8" fill="#ffffff" fillOpacity="0.06" />
      <rect x="280" y="150" width="70" height="60" rx="8" fill="#e2aa1c" fillOpacity="0.22" />
      <circle cx="315" cy="170" r="14" fill="#e2aa1c" />
      <circle cx="315" cy="170" r="5" fill="#133a33" />
      <path d="M315 184l-8 14h16z" fill="#e2aa1c" />
      <circle cx="315" cy="170" r="30" stroke="#e2aa1c" strokeOpacity="0.35" strokeWidth="2" />
    </svg>
  );
}
