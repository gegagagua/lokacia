import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ResultView } from './result-view';
import { getSession } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('checkoutResult'), robots: { index: false, follow: false } };
}

export default async function CheckoutResultPage({ searchParams }: { searchParams: Promise<{ invoice?: string; status?: string; return?: string }> }) {
  const sp = await searchParams;
  if (!(await getSession())) redirect(localizePath(`/login?next=${encodeURIComponent(`/checkout/result?invoice=${sp.invoice ?? ''}${sp.status ? `&status=${sp.status}` : ''}`)}`, await getAppLocale()));
  const back = sp.return && sp.return.startsWith('/') && !sp.return.startsWith('//') ? sp.return : null;
  return (
    <div className="relative min-h-[70dvh] overflow-hidden py-12 md:py-20">
      <div aria-hidden className="drawing-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="container-page relative flex justify-center">
        <ResultView invoiceId={sp.invoice ?? null} failedHint={sp.status === 'failed'} back={back} />
      </div>
    </div>
  );
}
