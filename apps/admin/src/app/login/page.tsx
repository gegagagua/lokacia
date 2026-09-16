import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { Logo, LogoMark } from '@lokacia/ui';
import { getSession } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'შესვლა' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const session = await getSession();
  if (session && (session.role === 'admin' || session.role === 'moderator')) redirect(safeNext);
  const t = await getTranslations('auth');
  const points = [
    { icon: ClipboardCheck, title: t('pointModeration'), text: t('pointModerationText') },
    { icon: BadgeCheck, title: t('pointVerification'), text: t('pointVerificationText') },
    { icon: ShieldCheck, title: t('pointAudit'), text: t('pointAuditText') },
  ];
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* brand panel */}
      <section className="hero-gradient relative hidden overflow-hidden p-12 lg:flex lg:flex-col xl:p-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 size-[520px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-[360px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3 text-white">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/15">
            <LogoMark size={26} className="text-white" title="lokacia.ge" />
          </span>
          <span className="text-[22px] font-bold tracking-tight">lokacia</span>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[13px] font-semibold text-white/85 ring-1 ring-inset ring-white/15">{t('badge')}</span>
        </div>
        <div className="relative mt-auto max-w-lg">
          <h2 className="text-[44px] font-bold leading-[1.1] tracking-tight text-white">
            {t('heroTitle')} <span className="text-gradient">{t('heroAccent')}</span>
          </h2>
          <p className="mt-4 text-[17px] text-white/80">{t('heroText')}</p>
          <ul className="mt-10 flex flex-col gap-4">
            {points.map((p) => (
              <li key={p.title} className="flex items-start gap-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-inset ring-white/10 backdrop-blur">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#f7d67a]">
                  <p.icon className="size-5" strokeWidth={2} aria-hidden />
                </span>
                <span>
                  <span className="block font-bold text-white">{p.title}</span>
                  <span className="block text-[14.5px] text-white/70">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* form panel */}
      <section className="relative flex flex-col items-center justify-center bg-bg px-4 py-12 sm:px-8">
        <div className="pointer-events-none absolute inset-0 drawing-grid opacity-60 lg:hidden" aria-hidden />
        <div className="relative w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo size={30} showGeorgian={false} />
          </div>
          <LoginForm next={safeNext} />
        </div>
      </section>
    </main>
  );
}
