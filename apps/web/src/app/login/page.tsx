import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { LoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('login'), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
  if (await getSession()) redirect(localizePath(safeNext, await getAppLocale()));
  return (
    <div className="drawing-grid min-h-[70dvh] py-12">
      <div className="container-page flex justify-center">
        <LoginForm next={safeNext} />
      </div>
    </div>
  );
}
