import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Home, MapPinOff } from 'lucide-react';
import { Button, SpacePlan } from '@lokacia/ui';
import { HeroGlow } from '@/components/portal/hero-glow';

export default async function NotFound() {
  const t = await getTranslations('home.errors');
  return (
    <section className="relative isolate min-h-[70dvh] overflow-hidden">
      <HeroGlow variant="page" />
      <div className="container-page grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="eyebrow">
            <MapPinOff className="size-3.5" strokeWidth={2} aria-hidden />
            404
          </p>
          <h1 className="mt-4 text-[34px] font-bold leading-[42px] tracking-tight md:text-h1">{t('notFoundTitle')}</h1>
          <p className="mt-4 max-w-md text-[17px] text-muted">{t('notFoundLead')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/search">
                {t('search')}
                <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/">
                <Home className="size-4" strokeWidth={2} aria-hidden />
                {t('home')}
              </Link>
            </Button>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md" aria-hidden>
          <p className="text-gradient pointer-events-none select-none text-center text-[120px] font-bold leading-none tracking-tighter tabular md:text-[160px]">404</p>
          <div className="card relative -mt-6 rotate-[-3deg] p-6 shadow-lg">
            <SpacePlan areaM2={16} widthM={4} depthM={4} compact title="" />
          </div>
        </div>
      </div>
    </section>
  );
}
