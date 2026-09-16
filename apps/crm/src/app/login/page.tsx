import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CalendarDays, ChartLine, Check, SquareKanban, TrendingUp } from 'lucide-react';
import { Logo, LogoMark } from '@lokacia/ui';
import { getSession } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'შესვლა', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/dashboard';
  if (await getSession()) redirect(safeNext);
  const t = await getTranslations('auth');
  return (
    <main id="main" className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="crm-wash flex min-h-dvh flex-col px-4 py-6 sm:px-8 lg:px-14">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <LoginForm next={safeNext} />
        </div>
        <p className="text-center text-[13px] text-muted lg:text-left">© lokacia.ge</p>
      </div>
      <aside aria-hidden className="hero-gradient relative m-3 hidden overflow-hidden rounded-modal lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -right-6 top-20 size-64 rounded-full border border-white/10" />
        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/20">
            <LogoMark size={14} />
            {t('eyebrow')}
          </span>
          <h2 className="mt-5 text-[34px] font-bold leading-[1.18] tracking-tight text-white xl:text-[40px]">{t('heroTitle')}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-white/75">{t('heroBody')}</p>
          <ul className="mt-6 flex flex-col gap-2.5">
            {(['pipeline', 'calendar', 'analytics'] as const).map((k) => (
              <li key={k} className="flex items-center gap-3 text-[15px] font-medium text-white/90">
                <span className="grid size-6 place-items-center rounded-full bg-[#e2aa1c] text-[#17201d]">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {t(`features.${k}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Product illustration: mini pipeline + agenda + KPI chips */}
        <div className="relative mt-10 h-[300px] xl:h-[320px]">
          <div className="absolute left-0 top-6 w-[340px] rotate-[-3deg] rounded-[22px] bg-white/95 p-4 text-[#0f1a17] shadow-lg">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
              <SquareKanban className="size-4 text-[#2e7a69]" strokeWidth={2} />
              {t('mock.openDeals')}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { col: t('mock.lead'), color: '#3a6fd8', deals: [t('mock.dealA'), t('mock.dealC')] },
                { col: t('mock.viewing'), color: '#c68a06', deals: [t('mock.dealB')] },
                { col: t('mock.won'), color: '#1c7a52', deals: [t('mock.dealA')] },
              ].map((c) => (
                <div key={c.col} className="rounded-xl bg-[#f0f4f1] p-1.5">
                  <div className="mb-1.5 flex items-center gap-1 px-1 text-[11px] font-semibold">
                    <span className="size-1.5 rounded-full" style={{ background: c.color }} />
                    {c.col}
                  </div>
                  {c.deals.map((d, i) => (
                    <div key={i} className="mb-1.5 rounded-lg bg-white p-1.5 shadow-xs">
                      <div className="truncate text-[10.5px] font-semibold leading-4">{d}</div>
                      <div className="mt-1 h-1 w-2/3 rounded-full" style={{ background: c.color, opacity: 0.35 }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute right-0 top-0 w-[260px] rotate-[3deg] rounded-[22px] bg-white/95 p-4 text-[#0f1a17] shadow-lg">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
              <CalendarDays className="size-4 text-[#dc6a2c]" strokeWidth={2} />
              {t('mock.today')}
            </div>
            {[
              { time: '11:00', label: t('mock.eventA'), color: '#dc6a2c' },
              { time: '14:30', label: t('mock.eventB'), color: '#7b5ce0' },
            ].map((e) => (
              <div key={e.time} className="mb-2 flex items-center gap-2.5 rounded-xl p-2" style={{ background: `color-mix(in srgb, ${e.color} 12%, white)` }}>
                <span className="h-8 w-1 rounded-full" style={{ background: e.color }} />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tabular" style={{ color: e.color }}>
                    {e.time}
                  </div>
                  <div className="truncate text-[12px] font-medium">{e.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute bottom-4 right-8 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-[#0f1a17] shadow-lg">
            <span className="grid size-10 place-items-center rounded-xl bg-[#e4f1ec] text-[#1a5446]">
              <ChartLine className="size-5" strokeWidth={2} />
            </span>
            <div>
              <div className="text-[12px] text-[#53635d]">{t('mock.conversion')}</div>
              <div className="flex items-center gap-1.5 text-[22px] font-bold leading-7 tabular">
                33,3%
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#1c7a52]/12 px-1.5 text-[11px] font-semibold text-[#1c7a52]">
                  <TrendingUp className="size-3" strokeWidth={2.4} />
                  12%
                </span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-10 flex items-center gap-2 rounded-full bg-[#e2aa1c] px-4 py-2 text-[13px] font-semibold text-[#17201d] shadow-lg">
            <SquareKanban className="size-4" strokeWidth={2} />
            31 · {t('mock.openDeals')}
          </div>
        </div>
      </aside>
    </main>
  );
}
